var Models, models;
this.Models = this.models = Models = models = new Repository();


var Tumblr = update({}, AbstractSessionService, {
	name : 'Tumblr',
	ICON : 'http://www.tumblr.com/images/favicon.gif',
	MEDIA_URL : 'http://media.tumblr.com/',
	TUMBLR_URL : 'http://www.tumblr.com/',
	PAGE_LIMIT : 50,
	
	/**
	 * 各Tumblrの基本情報(総件数/タイトル/タイムゾーン/名前)を取得する。
	 *
	 * @param {String} user ユーザー名。
	 * @return {Object} ポスト共通情報。ポストID、タイプ、タグなどを含む。
	 */
	getInfo : function(user, type){
		return request('http://'+user+'.tumblr.com/api/read', {
			queryString : {
				type  : type,
				start : 0,
				num   : 0,
			}
		}).addCallback(function(res){
			var doc = convertToDOM(res.responseText);
			var posts = doc.querySelector('posts');
			var tumblelog = doc.querySelector('tumblelog');
			return {
				type     : posts ? posts.getAttribute('type') : '',
				start    :  1 * posts ? posts.getAttribute('start') : '',
				total    :  1 * posts ? posts.getAttribute('total') : '',
				name     : tumblelog ? tumblelog.getAttribute('name') : '',
				title    : tumblelog ? tumblelog.getAttribute('title') : '',
				timezone : tumblelog ? tumblelog.getAttribute('timezone') : '',
			};
		});
	},
	
	/**
	 * Tumblr APIからポストデータを取得する。
	 *
	 * @param {String} user ユーザー名。
	 * @param {optional String} type ポストタイプ。未指定の場合、全タイプとなる。
	 * @param {String} count 先頭から何件を取得するか。
	 * @param {Function} handler 
	 *        各ページ個別処理関数。段階的に処理を行う場合に指定する。
	 *        ページ内の全ポストが渡される。
	 * @return {Deferred} 取得した全ポストが渡される。
	 */
	read : function(user, type, count, handler){
		// FIXME: ストリームにする
		var pages = Tumblr._splitRequests(count);
		var result = [];
		
		var d = succeed();
		d.addCallback(function(){
			// 全ページを繰り返す
			return deferredForEach(pages, function(page, pageNum){
				// ページを取得する
				return request('http://'+user+'.tumblr.com/api/read', {
					queryString : {
						type  : type,
						start : page[0],
						num   : page[1],
					},
				}).addCallback(function(res){
					var doc = convertToDOM(res.responseText);
					
					// 全ポストを繰り返す
					var posts = map(function(post){
						var info = {
							user : user,
							id   : post.getAttribute('id'),
							url  : post.getAttribute('url'),
							date : post.getAttribute('date'),
							type : post.getAttribute('type'),
							tags : map(function(tag){return tag.textContent}, post.querySelectorAll('tag')),
						};
						
						return Tumblr[info.type.capitalize()].convertToModel(post, info);
					}, doc.querySelectorAll('posts > post'));
					
					result = result.concat(posts);
					
					return handler && handler(posts, (pageNum * Tumblr.PAGE_LIMIT));
				}).addCallback(wait, 1); // ウェイト
			});
		});
		d.addErrback(function(err){
			if(err.message!=StopProcess)
				throw err;
		})
		d.addCallback(function(){
			return result;
		});
		
		return d;
	},
	
	/**
	 * API読み込みページリストを作成する。
	 * TumblrのAPIは120件データがあるとき、100件目から50件を読もうとすると、
	 * 差し引かれ70件目から50件が返ってくる。
	 *
	 * @param {Number} count 読み込み件数。
	 * @return {Array}
	 */
	_splitRequests : function(count){
		var res = [];
		var limit = Tumblr.PAGE_LIMIT;
		for(var i=0,len=Math.ceil(count/limit) ; i<len ; i++){
			res.push([i*limit, limit]);
		}
		count%limit && (res[res.length-1][1] = count%limit);
		
		return res;
	},
	
	/**
	 * reblog情報を取り除く。
	 *
	 * @param {Array} form reblogフォーム。
	 * @return {Deferred}
	 */
	trimReblogInfo : function(form){
		if(!getPref('model.tumblr.trimReblogInfo'))
		 return;
		 
		function trimQuote(entry){
			entry = entry.replace(/<p><\/p>/g, '').replace(/<p><a[^<]+<\/a>:<\/p>/g, '');
			entry = (function callee(all, contents){
				return contents.replace(/<blockquote>(([\n\r]|.)+)<\/blockquote>/gm, callee);
			})(null, entry);
			return entry.trim();
		}
		
		switch(form['post[type]']){
		case 'link':
			form['post[three]'] = trimQuote(form['post[three]']);
			break;
		case 'regular':
		case 'photo':
		case 'video':
			form['post[two]'] = trimQuote(form['post[two]']);
			break;
		case 'quote':
			form['post[two]'] = form['post[two]'].replace(/ \(via <a.*?<\/a>\)/g, '').trim();
			break;
		}
		
		return form;
	},
	
	/**
	 * ポスト可能かをチェックする。
	 *
	 * @param {Object} ps
	 * @return {Boolean}
	 */
	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type);
	},
	
	/**
	 * 新規エントリーをポストする。
	 *
	 * @param {Object} ps
	 * @return {Deferred}
	 */
	post : function(ps){
		var self = this;
		var endpoint = Tumblr.TUMBLR_URL + 'new/' + ps.type;
		return this.postForm(function(){
			return self.getForm(endpoint).addCallback(function(form){
				update(form, Tumblr[ps.type.capitalize()].convertToForm(ps));
				
				self.appendTags(form, ps);
				
				return request(endpoint, {sendContent : form});
			});
		});
	},
	
	/**
	 * ポストフォームを取得する。
	 * reblogおよび新規エントリーのどちらでも利用できる。
	 *
	 * @param {Object} url フォームURL。
	 * @return {Deferred}
	 */
	getForm : function(url){
		var self = this;
		return request(url).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var form = formContents(doc);
			delete form.preview_post;
			form.redirect_to = Tumblr.TUMBLR_URL+'dashboard';
			
			if(form.reblog_post_id){
				self.trimReblogInfo(form);
				
				// Tumblrから他サービスへポストするため画像URLを取得しておく
				if (form['post[type]'] === 'photo') {
					form.image = $x('id("edit_post")//img[contains(@src, "media.tumblr.com/") or contains(@src, "data.tumblr.com/")]/@src', doc);
					if (!form.image) {
						let photoset = doc.querySelector('iframe.photoset');
						if (photoset) {
							return request(photoset.src, {
								responseType: 'document'
							}).addCallback(res => {
								var doc = res.response;
								var photoset_photo = doc.querySelector('.photoset_photo');

								if (photoset_photo) {
									form.image = photoset_photo.href;
								}

								return form;
							});
						}
					}
				}
			}
			
			return form;
		});
	},
	
	/**
	 * フォームへタグとプライベートを追加する。
	 *
	 * @param {Object} url フォームURL。
	 * @return {Deferred}
	 */
	appendTags : function(form, ps){
		if(ps.private!=null)
			form['post[state]'] = (ps.private)? 'private' : 0;
		
		if (ps.type !== 'regular' && getPref('model.tumblr.queue')) {
			form['post[state]'] = 2;
		}
		
		if (getPref('model.tumblr.appendContentSource')) {
			if (!ps.favorite || !ps.favorite.name || ps.favorite.name !== 'Tumblr') {
				// not reblog post
				if (ps.pageUrl && ps.pageUrl !== 'http://') {
					form['post[source_url]'] = ps.pageUrl;
					if (ps.type !== 'link') {
						form['post[three]'] = ps.pageUrl;
					}
				}
			}
		}
		
		return update(form, {
			'post[tags]' : (ps.tags && ps.tags.length)? joinText(ps.tags, ',') : '',
		});
	},
	
	/**
	 * reblogする。
	 * Extractors.ReBlogの各抽出メソッドを使いreblog情報を抽出できる。
	 *
	 * @param {Object} ps
	 * @return {Deferred}
	 */
	favor : function(ps){
		// メモをreblogフォームの適切なフィールドの末尾に追加する
		var form = ps.favorite.form;
		items(Tumblr[ps.type.capitalize()].convertToForm({
			description : ps.description,
		})).forEach(function([name, value]){
			if(!value)
				return;
			
			form[name] += '\n\n' + value;
		});
		
		this.appendTags(form, ps);
		
		return this.postForm(function(){
			return request(ps.favorite.endpoint, {sendContent : form})
		});
	},
	
	/**
	 * フォームをポストする。
	 * 新規エントリーとreblogのエラー処理をまとめる。
	 *
	 * @param {Function} fn
	 * @return {Deferred}
	 */
	postForm : function(fn){
		var self = this;
		var d = succeed();
		d.addCallback(fn);
		d.addCallback(function(res){
			var url = res.channel.URI.asciiSpec;
			switch(true){
			case /dashboard/.test(url):
				return;
			
			case /login/.test(url):
				throw new Error(getMessage('error.notLoggedin'));
			
			default:
				// このチェックをするためリダイレクトを追う必要がある
				// You've used 100% of your daily photo uploads. You can upload more tomorrow.
				if(res.responseText.match('more tomorrow'))
					throw new Error("You've exceeded your daily post limit.");
				
				var doc = convertToHTMLDocument(res.responseText);
				throw new Error(convertToPlainText(doc.getElementById('errors')));
			}
		});
		return d;
	},
	
	getPasswords : function(){
		return getPasswords('https://www.tumblr.com');
	},
	
	login : function(user, password){
		var LOGIN_FORM_URL = 'https://www.tumblr.com/login';
		var self = this;
		notify(self.name, getMessage('message.changeAccount.logout'), self.ICON);
		return Tumblr.logout().addCallback(function(){
			return request(LOGIN_FORM_URL).addCallback(function(res){
				notify(self.name, getMessage('message.changeAccount.login'), self.ICON);
				var doc = convertToHTMLDocument(res.responseText);
				var form = doc.getElementById('signup_form');
				return request(LOGIN_FORM_URL, {
					sendContent : update(formContents(form), {
						'user[email]'    : user,
						'user[password]' : password
					})
				});
			}).addCallback(function(){
				self.updateSession();
				self.user = user;
				notify(self.name, getMessage('message.changeAccount.done'), self.ICON);
			});
		});
	},
	
	logout : function(){
		return request(Tumblr.TUMBLR_URL+'logout');
	},
	
	getAuthCookie : function(){
		return getCookieString('www.tumblr.com');
	},
	
	/**
	 * ログイン中のユーザーを取得する。
	 * 結果はキャッシュされ、再ログインまで再取得は行われない。
	 * アカウント切り替えのためのインターフェースメソッド。
	 *
	 * @return {Deferred} ログインに使われるメールアドレスが返される。
	 */
	getCurrentUser : function(){
		switch (this.updateSession()){
		case 'none':
			return succeed('');
			
		case 'same':
			if(this.user)
				return succeed(this.user);
			
		case 'changed':
			var self = this;
			return request(Tumblr.TUMBLR_URL+'preferences').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return self.user = $x('id("user_email")/@value', doc);
			});
		}
	},
	
	/**
	 * ポストや削除に使われるトークン(form_key)を取得する。
	 * 結果はキャッシュされ、再ログインまで再取得は行われない。
	 *
	 * @return {Deferred} トークン(form_key)が返される。
	 */
	getToken : function(){
		switch (this.updateSession()){
		case 'none':
			throw new Error(getMessage('error.notLoggedin'));
			
		case 'same':
			if(this.token)
				return succeed(this.token);
			
		case 'changed':
			var self = this;
			return request(Tumblr.TUMBLR_URL+'new/text').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return self.token = $x('id("form_key")/@value', doc);
			});
		}
	},
	
	getTumblelogs : function(){
		return request(Tumblr.TUMBLR_URL+'new/text').addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return $x('id("channel_id")//option[@value!=0]', doc, true).map(function(opt){
				return {
					id : opt.value,
					name : opt.textContent,
				}
			});
		});
	},
});


Tumblr.Regular = {
	convertToModel : function(post, info){
		return update(info, {
			body  : getTextContent(post.querySelector('regular-body')),
			title : getTextContent(post.querySelector('regular-title')),
		});
	},
	
	convertToForm : function(ps){
		return {
			'post[type]' : ps.type,
			'post[one]'  : ps.item,
			'post[two]'  : joinText([getFlavor(ps.body, 'html'), ps.description], '\n\n'),
		};
	},
}

Tumblr.Photo = {
	convertToModel : function(post, info){
		var photoUrl500 = getTextContent(post.querySelector('photo-url[max-width="500"]'));
		var image = Tombfix.Photo.getImageInfo(photoUrl500);
		
		return update(info, {
			photoUrl500   : photoUrl500,
			photoUrl400   : getTextContent(post.querySelector('photo-url[max-width="400"]')),
			photoUrl250   : getTextContent(post.querySelector('photo-url[max-width="250"]')),
			photoUrl100   : getTextContent(post.querySelector('photo-url[max-width="100"]')),
			photoUrl75    : getTextContent(post.querySelector('photo-url[max-width="75"]')),
			
			body          : getTextContent(post.querySelector('photo-caption')),
			imageId       : image.id,
			extension     : image.extension,
		});
	},
	
	convertToForm : function(ps){
		var form = {
			'post[type]'  : ps.type,
			't'           : ps.item,
			'u'           : ps.pageUrl,
			'post[two]'   : joinText([
				(ps.item? ps.item.link(ps.pageUrl) : '') + (ps.author? ' (via ' + ps.author.link(ps.authorUrl) + ')' : ''), 
				ps.description], '\n\n'),
			'post[three]' : ps.pageUrl,
		};
		ps.file? (form['images[o1]'] = ps.file) : (form['photo_src'] = ps.itemUrl);
		
		return form;
	},
	
	/**
	 * 画像をダウンロードする。
	 *
	 * @param {nsIFile} file 保存先のローカルファイル。このファイル名が取得先のURLにも使われる。
	 * @return {Deferred}
	 */
	download : function(file){
		return download(Tumblr.MEDIA_URL + file.leafName, file);
	},
}

Tumblr.Video = {
	convertToModel : function(post, info){
		return update(info, {
			body    : getTextContent(post.querySelector('video-caption')),
			source  : getTextContent(post.querySelector('video-source')),
			player  : getTextContent(post.querySelector('video-player')),
		});
	},
	
	convertToForm : function(ps){
		return {
			'post[type]' : ps.type,
			'post[one]'  : getFlavor(ps.body, 'html') || ps.itemUrl,
			'post[two]'  : joinText([
				(ps.item? ps.item.link(ps.pageUrl) : '') + (ps.author? ' (via ' + ps.author.link(ps.authorUrl) + ')' : ''), 
				ps.description], '\n\n'),
		};
	},
}

Tumblr.Link = {
	convertToModel : function(post, info){
		return update(info, {
			title  : getTextContent(post.querySelector('link-text')),
			source : getTextContent(post.querySelector('link-url')),
			body   : getTextContent(post.querySelector('link-description')),
		});
	},
	
	convertToForm : function(ps){
		var thumb = getPref('thumbnailTemplate').replace(RegExp('{url}', 'g'), ps.pageUrl);
		return {
			'post[type]'  : ps.type,
			'post[one]'   : ps.item,
			'post[two]'   : ps.itemUrl,
			'post[three]' : joinText([thumb, getFlavor(ps.body, 'html'), ps.description], '\n\n'),
		};
	},
}

Tumblr.Conversation = {
	convertToModel : function(post, info){
		return update(info, {
			title : getTextContent(post.querySelector('conversation-title')),
			body  : getTextContent(post.querySelector('conversation-text')),
		});
	},
	
	convertToForm : function(ps){
		return {
			'post[type]' : ps.type,
			'post[one]'  : ps.item,
			'post[two]'  : joinText([getFlavor(ps.body, 'html'), ps.description], '\n\n'),
		};
	},
}

Tumblr.Quote = {
	convertToModel : function(post, info){
		return update(info, {
			body   : getTextContent(post.querySelector('quote-text')),
			source : getTextContent(post.querySelector('quote-source')),
		});
	},
	
	convertToForm : function(ps){
		return {
			'post[type]' : ps.type,
			'post[one]'  : getFlavor(ps.body, 'html'),
			'post[two]'  : joinText([(ps.item? ps.item.link(ps.pageUrl) : ''), ps.description], '\n\n'),
		};
	},
}

Models.register(Tumblr);


/*
 * Tumblrフォーム変更対応パッチ(2013/1/25周辺)
 * UAを古いAndroidにして旧フォームを取得。
 *
 * polygonplanetのコードを簡略化(パフォーマンス悪化の懸念あり)
 * https://gist.github.com/polygonplanet/4643063
 *
 * 2013年5月末頃の変更に対応する為、UAをIE8に変更
*/
var request_ = request;
request = function(url, opts){
	if(/^https?:\/\/(?:\w+\.)*tumblr\..*\/(?:reblog\/|new\/\w+)/.test(url)){
		if (!(opts && opts.responseType)) {
			opts = updatetree(opts, {
				responseType : 'text'
			});
		}
		opts = updatetree(opts, {
			headers : {
				'User-Agent' : 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0)'
			}
		});
	}
	
	return request_(url, opts);
};


Models.register(Object.assign({
	name     : 'FriendFeed',
	ICON     : 'https://friendfeed.com/favicon.ico',
	// via https://friendfeed.com/share/bookmarklet
	POST_URL : 'https://friendfeed.com/a/bookmarklet',

	check(ps) {
		if (/^(?:regular|photo|quote|link|conversation|video)$/.test(ps.type)) {
			if (ps.file) {
				return ps.itemUrl;
			}

			return true;
		}
	},

	post(ps) {
		return this.getSessionValue('token', () => {
			return succeed(getCookieValue('friendfeed.com', 'AT'));
		}).addCallback(token => {
			return request(this.POST_URL, {
				responseType : 'json',
				sendContent  : Object.assign({
					at : token
				}, this.getInfo(ps))
			});
		}).addCallback(({response : json}) => {
			if (!json.success) {
				throw new Error(getMessage('error.resultsUnclear'));
			}
		});
	},

	getInfo(ps) {
		var info = {
			title   : ps.item,
			link    : ps.itemUrl,
			comment : joinText([
				Twitter.createQuote(ps.body || ''),
				ps.description,
				...((ps.tags || []).map(tag => '#' + tag))
			], ' ', true)
		};

		if (ps.type === 'regular' && !info.title) {
			Object.assign(info, {
				title   : info.comment,
				comment : ''
			});
		} else if (ps.type === 'photo') {
			Object.assign(info, {
				link   : ps.pageUrl,
				image0 : ps.itemUrl
			});
		}

		return info;
	},

	getAuthCookie() {
		return getCookieString('friendfeed.com', 'U');
	}
}, AbstractSessionService));


Models.register({
	name : 'FFFFOUND',
	ICON : 'http://ffffound.com/favicon.ico',
	URL  : 'http://FFFFOUND.com/',
	
	getToken : function(){
		return request(FFFFOUND.URL + 'bookmarklet.js').addCallback(function(res){
			return res.responseText.match(/token ?= ?'(.*?)'/)[1];
		});
	},
	
	check : function(ps){
		return ps.type == 'photo' && !ps.file;
	},
	
	post : function(ps){
		return this.getToken().addCallback(function(token){
			return request(FFFFOUND.URL + 'add_asset', {
				referrer : ps.pageUrl,
				queryString : {
					token   : token,
					url     : ps.itemUrl,
					referer : ps.pageUrl,
					title   : ps.item,
				},
			}).addCallback(function(res){
				if(res.responseText.match('(FAILED:|ERROR:) +(.*?)</span>'))
					throw new Error(RegExp.$2.trim());
				
				if(res.responseText.match('login'))
					throw new Error(getMessage('error.notLoggedin'));
			});
		});
	},
	
	favor : function(ps){
		return this.iLoveThis(ps.favorite.id)
	},
	
	remove : function(id){
		return request(FFFFOUND.URL + 'gateway/in/api/remove_asset', {
			referrer : FFFFOUND.URL,
			sendContent : {
				collection_id : id,
			},
		});
	},
	
	iLoveThis : function(id){
		return request(FFFFOUND.URL + 'gateway/in/api/add_asset', {
			referrer : FFFFOUND.URL,
			sendContent : {
				collection_id : 'i'+id,
				inappropriate : false,
			},
		}).addCallback(function(res){
			var error = res.responseText.extract(/"error":"(.*?)"/);
			if(error == 'AUTH_FAILED')
				throw new Error(getMessage('error.notLoggedin'));
			
			// NOT_FOUND / EXISTS / TOO_BIG
			if(error)
				throw new Error(RegExp.$1.trim());
		});
	},
});


// Flickr API Documentation
// https://www.flickr.com/services/api/
Models.register(update({
	name           : 'Flickr',
	ICON           : 'https://www.flickr.com/favicon.ico',
	API_KEY        : 'ecf21e55123e4b31afa8dd344def5cc5',
	ORIGIN         : 'https://www.flickr.com',
	REST_API_URL   : 'https://api.flickr.com/services/rest',
	UPLOAD_API_URL : 'https://up.flickr.com/services/upload/',

	check : function (ps) {
		return ps.type == 'photo';
	},

	post : function (ps) {
		return this.getToken().addCallback(token => {
			return (ps.file ? succeed(ps.file) : download(ps.itemUrl, getTempFile())).addCallback(file => {
				return request(this.UPLOAD_API_URL, {
					// via https://www.flickr.com/services/api/upload.api.html
					sendContent : update({
						photo       : file,
						title       : ps.item || ps.page,
						description : ps.description,
						tags        : joinText(ps.tags, ' '),
						is_public   : ps.private ? 0 : 1
					}, token)
				});
			});
		});
	},

	callMethod : function (info, apiKey) {
		return this.getToken(apiKey).addCallback(token => {
			return request(this.REST_API_URL, {
				responseType : 'json',
				queryString  : update({
					nojsoncallback : 1,
					format         : 'json'
				}, info, token)
			});
		}).addCallback(({response : json}) => {
			if (json.stat !== 'ok') {
				throw new Error(json.message);
			}

			return json;
		});
	},

	favor : function (ps) {
		return this.callMethod({
			// via https://www.flickr.com/services/api/flickr.favorites.add.html
			method   : 'flickr.favorites.add',
			photo_id : ps.favorite.id
		}).addErrback(err => {
			// Error Codes: 3
			if (err.message !== 'Photo is already in favorites') {
				throw err;
			}
		});
	},

	getSizes : function (id) {
		return this.callMethod({
			// via https://www.flickr.com/services/api/flickr.photos.getSizes.html
			method   : 'flickr.photos.getSizes',
			photo_id : id
		}, true).addCallback(json => json.sizes.size);
	},

	getInfo : function (id) {
		return this.callMethod({
			// via https://www.flickr.com/services/api/flickr.photos.getInfo.html
			method   : 'flickr.photos.getInfo',
			photo_id : id
		}, true).addCallback(json => json.photo);
	},

	getToken : function (apiKey) {
		return apiKey ? succeed({api_key : this.API_KEY}) : this.getSessionValue('token', () => {
			return request(this.ORIGIN).addCallback(({responseText : html}) => {
				var {flickrAPI} = JSON.parse(html.extract(/var yconf = ({.+});/));

				return {
					api_key    : flickrAPI.api_key,
					auth_hash  : flickrAPI.auth_hash,
					auth_token : flickrAPI.auth_token
				};
			});
		});
	},

	getAuthCookie : function () {
		return getCookieString('flickr.com', 'cookie_accid');
	}
}, AbstractSessionService));


Models.register({
	name : 'Picasa',
	ICON : 'http://picasaweb.google.com/favicon.ico',
	URL  : 'http://picasaweb.google.com',
	
	check : function(ps){
		return ps.type=='photo';
	},
	
	post : function(ps){
		var self = this;
		return ((ps.file)? 
			succeed(ps.file) : 
			download(ps.itemUrl, getTempFile(createURI(ps.itemUrl).fileExtension))
		).addCallback(function(file){
			return self.upload(file);
		});
	},
	
	/**
	 * 画像をアップロードする。
	 *
	 * @param {File} files 
	 *        画像ファイル。単数または複数(最大5ファイル)。
	 * @param {optional String} user 
	 *        ユーザーID。省略された場合は現在Googleアカウントでログインしていると仮定される。
	 * @param {optional String || Number} album 
	 *        アルバム名称またはアルバムID。
	 *        省略された場合はmodel.picasa.defaultAlbumの設定値か先頭のアルバムとなる。
	 * @param {String || nsIFile || nsIURI} basePath 基点となるパス。
	 */
	upload : function(files, user, album){
		files = [].concat(files);
		
		album = album || getPref('model.picasa.defaultAlbum');
		
		var self = this;
		var user = user || this.getCurrentUser();
		var endpoint;
		return maybeDeferred((typeof(album)=='number')? album : this.getAlbums(user).addCallback(function(albums){
			var entry = albums.feed.entry;
			if(album){
				// 大/小文字が表示されているものと異なる
				for (var a in entry)
					if(album.match(entry[a].gphoto$name.$t, 'i'))
						return entry[a].gphoto$id.$t;
				throw new Error('Album not found.');
			} else {
				// アルバムが指定されていない場合は先頭のアルバムとする
				return entry[0].gphoto$id.$t;
			}
		})).addCallback(function(aid){
			// トークンを取得しポスト準備をする
			return request(self.URL + '/lh/webUpload', {
				queryString : {
					uname : user,
					aid   : aid,
				}
			}).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				var form = doc.getElementById('lhid_uploadFiles');
				endpoint = resolveRelativePath(form.action, self.URL);
				
				return formContents(form);
			});
		}).addCallback(function(token){
			var ps = {};
			files.forEach(function(file, i){
				ps['file' + i] = file;
			});
			
			return request(endpoint, {
				sendContent : update(token, ps, {
					num : files.length,
				})
			});
		});
	},
	
	getAlbums : function(user){
		user = user || this.getCurrentUser();
		return getJSON('http://picasaweb.google.com/data/feed/back_compat/user/' + user + '?alt=json&kind=album');
	},
	
	getCurrentUser : function(){
		var cookie = getCookies('google.com', 'GAUSR')[0];
		if(!cookie)
			throw new Error(getMessage('error.notLoggedin'));
			
		return cookie.value.split('@').shift();
	},
});


Models.register({
	name      : 'WeHeartIt',
	ICON      : 'https://weheartit.com/favicon.ico',
	ORIGIN    : 'https://weheartit.com',
	ENTRY_URL : 'https://weheartit.com/entry/',

	check : function (ps) {
		return ps.type === 'photo' && !ps.file;
	},

	post : function (ps) {
		this.checkLogin();

		return request(this.ORIGIN + '/create_entry', {
			sendContent : {
				title : ps.item,
				media : ps.itemUrl,
				via   : ps.pageUrl,
				tags  : (ps.tags || []).join()
			}
		});
	},

	favor : function (ps) {
		this.checkLogin();

		return request(this.ENTRY_URL + ps.favorite.id + '/heart', {
			method : 'POST'
		});
	},

	checkLogin : function () {
		if (!getCookieString('.weheartit.com', 'login_token')) {
			throw new Error(getMessage('error.notLoggedin'));
		}
	}
});


Models.register({
	name : '4u',
	ICON : 'data:image/x-icon,%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%10%00%00%00%10%08%03%00%00%00(-%0FS%00%00%00ZPLTE%FF%FF%FF%F9%F9%F9%C3%C3%C3%AE%AE%AE%E7%E7%E7%24%24%24EEE%60%60%60!!!%DE%DE%DEoooZZZWWW%CC%CC%CC%0C%0C%0CKKK%D2%D2%D2fff%06%06%06uuu%D5%D5%D5%1B%1B%1B%93%93%93ccclll%BA%BA%BA%C0%C0%C0%AB%AB%AB%00%00%00%8D%8D%8D2%BF%0C%CD%00%00%00IIDAT%18%95c%60%20%17021%B3%20%F3YX%D9%D898%91%04%B8%B8%D1t%B0%F3%A0%09%F0%F2%F1%0B%A0%8Ap%0A%0A%093%A2%0A%89%88%8A%A1i%13%97%40%E2H%B20H%89J%23%09%08%F3%C9%88%CA%E2w%3A%1E%00%00%E6%DF%02%18%40u1A%00%00%00%00IEND%AEB%60%82',
	URL : 'http://4u.straightline.jp/',
	
	check : function(ps){
		return ps.type == 'photo' && !ps.file;
	},
	
	post : function(ps){
		return request(this.URL + 'power/manage/register', {
			referrer : ps.pageUrl,
			queryString : {
				site_title  : ps.page,
				site_url    : ps.pageUrl,
				alt         : ps.item,
				src         : ps.itemUrl,
				bookmarklet : 1,
			},
		}).addCallback(function(res){
			if(res.channel.URI.asciiSpec.match('login'))
				throw new Error(getMessage('error.notLoggedin'));
		});
	},
	
	favor : function(ps){
		return this.iLoveHer(ps.favorite.id);
	},
	
	iLoveHer : function(id){
		return request(this.URL + 'user/manage/do_register', {
			redirectionLimit : 0,
			referrer : this.URL,
			queryString : {
				src : id,
			},
		}).addCallback(function(res){
			if(res.channel.URI.asciiSpec.match('login'))
				throw new Error(getMessage('error.notLoggedin'));
		});
	},
});


Models.register({
	name     : 'Gyazo',
	ICON     : 'chrome://tombfix/skin/favicon/gyazo.ico',
	POST_URL : 'https://gyazo.com/upload.cgi',

	check(ps) {
		return ps.type === 'photo';
	},

	post(ps) {
		return (
			ps.file ? succeed(ps.file) : download(ps.itemUrl, getTempDir())
		).addCallback(file => {
			return request(this.POST_URL, {
				responseType : 'text',
				// via https://github.com/gyazo/Gyazo/blob/master/Server/upload.cgi#L13-14
				sendContent  : {
					id        : getPref('model.gyazo.id'),
					imagedata : file
				}
			}).addCallback(res => {
				// via https://github.com/gyazo/Gyazo/blob/master/Server/upload.cgi#L31
				// IDが不正な場合でもX-Gyazo-Idは新たに発行されるようなので
				// X-Gyazo-Idがある場合は既存のIDよりもそちらを使った方が良い
				let gyazoID = res.getResponseHeader('X-Gyazo-Id');

				if (gyazoID) {
					setPref('model.gyazo.id', gyazoID);
				}

				addTab(res.responseText);
			});
		});
	}
});


Models.register({
	name : 'Local',
	ICON : 'chrome://tombfix/skin/local.ico',
	
	check : function(ps){
		return (/(regular|photo|quote|link)/).test(ps.type);
	},
	
	post : function(ps){
		if(ps.type=='photo'){
			return this.Photo.post(ps);
		} else {
			return Local.append(getDataDir(ps.type + '.txt'), ps);
		}
	},
	
	append : function(file, ps){
		putContents(file, joinText([
			joinText([joinText(ps.tags, ' '), ps.item, ps.itemUrl, ps.body, ps.description], '\n\n', true), 
			getContents(file)
		], '\n\n\n'));
		
		return succeed();
	},
	
	Photo : {
		post : function(ps){
			var file = getDataDir('photo');
			createDir(file);
			
			if(ps.file){
				file.append(ps.file.leafName);
			} else {
				var uri = createURI(ps.itemUrl);
				var fileName = validateFileName(uri.fileName);
				file.append(fileName);
			}
			clearCollision(file);
			
			return succeed().addCallback(function(){
				if(ps.file){
					ps.file.copyTo(file.parent, file.leafName);
					return file;
				} else {
					return download(ps.itemUrl, file);
				}
			}).addCallback(function(file){
				if(AppInfo.OS == 'Darwin'){
					var script = getTempDir('setcomment.scpt');
					
					putContents(script, [
						'set aFile to POSIX file ("' + file.path + '" as Unicode text)',
						'set cmtStr to ("' + ps.pageUrl + '" as Unicode text)',
						'tell application "Finder" to set comment of (file aFile) to cmtStr'
					].join('\n'), 'UTF-16');
					
					var process = new Process(new LocalFile('/usr/bin/osascript'));
					process.run(false, [script.path], 1);
				}
			});
		},
	},
});


Models.register(update({
	name              : 'Twitter',
	ICON              : 'https://twitter.com/favicon.ico',
	ORIGIN            : 'https://twitter.com',
	ACCOUT_URL        : 'https://twitter.com/settings/account',
	TWEET_API_URL     : 'https://twitter.com/i/tweet',
	UPLOAD_API_URL    : 'https://upload.twitter.com/i/media/upload.iframe',
	STATUS_MAX_LENGTH : 140,
	OPTIONS           : {
		// for twttr.txt.getTweetLength()
		short_url_length       : 22,
		short_url_length_https : 23
	},

	check : function (ps) {
		return /^(?:regular|photo|quote|link|conversation|video)$/.test(ps.type);
	},

	post : function (ps) {
		return this.getToken().addCallback(token => {
			var status = this.createStatus(ps);

			return ps.type === 'photo' ?
				this.upload(ps, token, status) :
				this.update(token, status);
		});
	},

	getToken : function () {
		if (!this.getAuthCookie()) {
			throw new Error(getMessage('error.notLoggedin'));
		}

		return request(this.ACCOUT_URL, {
			responseType : 'document'
		}).addCallback(res => ({
			authenticity_token : res.response.querySelector('.authenticity_token').value
		}));
	},

	createStatus : function (ps) {
		var contents, maxLen, status;

		contents = {
			desc  : (ps.description || '').trim(),
			quote : ps.type !== 'video' && ps.body ? this.createQuote(ps.body) : '',
			title : (ps.item || '').trim(),
			url   : ps.itemUrl || '',
			tags  : (ps.tags || []).map(tag => '#' + tag)
		};
		maxLen = this.STATUS_MAX_LENGTH;

		if (ps.favorite && ps.favorite.name === 'Tumblr' && contents.quote) {
			contents.quote = this.createQuote(ps.body.trimTag());
		}

		if (ps.type === 'photo') {
			contents.url = ps.pageUrl;
			maxLen -= this.OPTIONS.short_url_length + 1;
		}

		status = this.joinContents(contents);

		if (ps.type !== 'regular' && getPref('model.twitter.truncateStatus')) {
			let over = this.getTweetLength(status) - maxLen;

			if (over > 0) {
				return this.truncateStatus(contents, over);
			}
		}

		return status;
	},

	createQuote : function (body) {
		body = body.trim();

		return body && body.wrap('"');
	},

	getTweetLength : function (str) {
		return twttr.txt.getTweetLength(str, this.OPTIONS);
	},

	joinContents : function ({desc, quote, title, url, tags}) {
		var prefix = desc ? '' : getPref('model.twitter.template.prefix'),
			template = getPref('model.twitter.template');

		return template ?
			this.extractTemplate(prefix, template, arguments[0]) :
			joinText([prefix, desc, quote, title, url, ...tags], ' ');
	},

	extractTemplate : function (prefix, template, contents) {
		contents.usage = {};

		template = template.replace(/%(desc|quote|title|url|tags|br)%/g, (match, name) => {
			if (name === 'br') {
				return '\n';
			}

			contents.usage[name] = true;

			return contents[name].length ? match : '';
		}).trim().replace(/^ +| +$/mg, '').replace(/ +/g, ' ');

		return joinText([prefix, ...(template.split(' '))].map(content => {
			return content.replace(/%(desc|quote|title|url|tags)%/g, (match, name) => name === 'tags' ?
				contents.tags.join(' ') :
				contents[name]
			);
		}), ' ');
	},

	truncateStatus : function (contents, over) {
		var truncator = {
			tags  : tags => {
				contents.tags = tags = tags.reverse().filter(tag => {
					if (over <= 0) {
						return true;
					}

					over -= tag.charLength + 1;
				}).reverse();

				if (tags.length || over <= 0) {
					return true;
				}
			},
			title : title => {
				title = this.truncateContent(title, over);

				if (title) {
					contents.title = title + '…';
				} else {
					over -= this.getTweetLength(contents.title) + 1;
					contents.title = title;

					if (over > 0) {
						return false;
					}
				}

				return true;
			},
			quote : quote => {
				quote = this.truncateContent(quote.slice(1, -1), over);

				if (quote) {
					contents.quote = (quote + '…').wrap('"');
				} else {
					over -= this.getTweetLength(contents.quote) + 1;
					contents.quote = quote;

					if (over > 0) {
						return false;
					}
				}

				return true;
			},
			desc  : desc => {
				contents.desc = this.truncateContent(desc, over) + '…';
			}
		};

		for (let name of Object.keys(truncator)) {
			if (contents.usage && !contents.usage[name]) {
				contents[name] = name === 'tags' ? [] : '';
			}

			let content = contents[name];

			if (content.length && truncator[name](content)) {
				break;
			}
		}

		return this.joinContents(contents);
	},

	truncateContent : function (content, over) {
		var strArr = [...content], // for surrogate pair
			urls = twttr.txt.extractUrlsWithIndices(content).reverse(),
			twLen = this.getTweetLength(content);

		if (!urls.length || twLen <= over + 1) {
			return strArr.slice(0, -(over + 1)).join('');
		}

		for (let {indices} of urls) {
			let [start, end] = indices,
				len = strArr.length;

			if (over < len - end) {
				break;
			}

			strArr = strArr.slice(0, start - (len === end ? end : len));
			over -= twLen - this.getTweetLength(strArr.join(''));

			if (over < 0) {
				break;
			}

			twLen = this.getTweetLength(strArr.join(''));
		}

		if (over >= 0) {
			strArr = strArr.slice(0, -(over + 1));
		}

		return strArr.join('');
	},

	update : function (token, status) {
		token.status = status;

		// can't handle a post error correctly. Twitter's Bug?
		/*
		return request(this.TWEET_API_URL + '/create', {
			responseType : 'json',
			sendContent : token
		}).addErrback(({message : req}) => {
			throw new Error(req.response.message.trimTag());
		});
		*/

		return request(this.TWEET_API_URL + '/create', {
			responseType : 'text',
			sendContent : token
		}).addErrback(({message : req}) => {
			var text = req.responseText, json;

			try {
				json = JSON.parse(text);
			} catch (err) {
				throw new Error(getMessage('error.resultsUnclear'));
			}

			throw new Error(json.message.trimTag());
		});
	},

	upload : function (ps, token, status) {
		return (ps.file ? succeed(ps.file) : download(ps.itemUrl, getTempDir())).addCallback(file => {
			var bis = new BinaryInputStream(new FileInputStream(file, -1, 0, false));

			return request(this.UPLOAD_API_URL, {
				responseType : 'document',
				sendContent  : update({
					media : btoa(bis.readBytes(bis.available()))
				}, token)
			}).addErrback(() => {
				throw new Error(getMessage('message.model.twitter.upload'));
			}).addCallback(({response : doc}) => {
				var json = JSON.parse(doc.scripts[0].textContent.extract(
					/parent\.postMessage\(JSON\.stringify\((\{.+\})\), ".+"\);/
				));

				return this.update(update({
					media_ids : json.media_id_string
				}, token), status);
			});
		});
	},

	favor : function (ps) {
		return this.getToken().addCallback(token => {
			token.id = ps.favorite.id;

			return request(this.TWEET_API_URL + '/favorite', {
				sendContent : token
			});
		});
	},

	login : function (user, password) {
		notify(this.name, getMessage('message.changeAccount.logout'), this.ICON);

		return (this.getCurrentUser() ? this.logout() : succeed()).addCallback(() => {
			return request(this.ORIGIN, {
				responseType : 'document'
			}).addCallback(({response : doc}) => {
				var form = doc.querySelector('form.signin');

				notify(this.name, getMessage('message.changeAccount.login'), this.ICON);

				return request(this.ORIGIN + '/sessions', {
					sendContent : update(formContents(form), {
						'session[username_or_email]' : user,
						'session[password]'          : password
					})
				});
			});
		}).addCallback(() => {
			this.updateSession();
			this.user = user;

			notify(this.name, getMessage('message.changeAccount.done'), this.ICON);
		});
	},

	logout : function () {
		return request(this.ACCOUT_URL, {
			responseType : 'document'
		}).addCallback(({response : doc}) => {
			return request(this.ORIGIN + '/logout', {
				sendContent : formContents(doc.getElementById('signout-form'))
			});
		});
	},

	getAuthCookie : function () {
		return getCookieString('twitter.com', 'auth_token');
	},

	getCurrentUser : function () {
		return request(this.ACCOUT_URL, {
			responseType : 'document'
		}).addCallback(({response : doc}) => {
			var user = doc.getElementsByName('user[screen_name]')[0].value;

			if (!/[^\w]/.test(user)) {
				this.user = user;
			}

			return user;
		});
	},

	getPasswords : function () {
		return getPasswords(this.ORIGIN);
	}
}, AbstractSessionService));


Models.register(update({
	name : 'Plurk',
	ICON : 'http://www.plurk.com/static/favicon.png',
	
	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return Plurk.addPlurk(
			':',
			joinText([ps.item, ps.itemUrl, ps.body, ps.description], ' ', true)
		);
	},
	
	addPlurk : function(qualifier, content){
		return Plurk.getToken().addCallback(function(token){
			return request('http://www.plurk.com/TimeLine/addPlurk', {
				redirectionLimit : 0,
				sendContent : update(token, {
					qualifier : qualifier,
					content   : content,
				}),
			});
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('plurk.com', 'plurkcookiea').extract(/user_id=(.+)/);
	},
	
	getToken : function(){
		var status = this.updateSession();
		switch (status){
		case 'none':
			throw new Error(getMessage('error.notLoggedin'));
			
		case 'same':
			if(this.token)
				return succeed(this.token);
			
		case 'changed':
			var self = this;
			return request('http://www.plurk.com/').addCallback(function(res){
				return self.token = {
					uid : res.responseText.extract(/"user_id": (.+?),/)
				};
			});
		}
	},
}, AbstractSessionService));


Models.register({
	name : 'Google',
	ICON : 'http://www.google.com/favicon.ico',
});


Models.register({
	name : 'GoogleBookmarks',
	ICON : Models.Google.ICON,
	POST_URL : 'https://www.google.com/bookmarks/mark',
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return request(this.POST_URL, {
			queryString : {
				op     : 'edit',
				output : 'popup',
			},
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			if(doc.getElementById('gaia_loginform'))
				throw new Error(getMessage('error.notLoggedin'));
			
			return request('https://www.google.com' + $x('//form[@name="add_bkmk_form"]/@action', doc), {
				redirectionLimit : 0,
				sendContent : update(formContents(doc), {
					title      : ps.item,
					bkmk       : ps.itemUrl,
					annotation : joinText([ps.body, ps.description], ' ', true),
					labels     : joinText(ps.tags, ','),
				}),
			});
		});
	},
	
	getEntry : function(url){
		return request(this.POST_URL, {
			queryString : {
				op     : 'edit',
				output : 'popup',
				bkmk   : url,
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var form = formContents(doc);
			return {
				saved       : (/(edit|編集)/i).test($x('//h1/text()', doc)),
				item        : form.title,
				tags        : form.labels.split(/,/).map(methodcaller('trim')),
				description : form.annotation,
			};
		});
	},
	
	getUserTags : function(){
		return request('https://www.google.com/bookmarks/mark', {
			queryString : {
				op : 'add'
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return $x("//div[@id='sidenav']//a[contains(@href, 'q=label')]", doc, true).map(function(elmTag){
				var tokens = elmTag.textContent.match(/(.+)\((\d+)\)/);
				return {
					name      : tokens[1].trim(),
					frequency : tokens[2],
				};
			});
		});
	},
	
	getSuggestions : function(url){
		var self = this;
		return new DeferredHash({
			tags  : self.getUserTags(),
			entry : self.getEntry(url),
		}).addCallback(function(ress){
			var entry = ress.entry[1];
			var tags = ress.tags[1];
			return {
				form        : entry.saved? entry : null,
				tags        : tags,
				duplicated  : entry.saved,
				recommended : [],
				editPage    : self.POST_URL + '?' + queryString({
					op   : 'edit',
					bkmk : url
				}),
			};
		});
	},
});


Models.register({
	name : 'GoogleCalendar',
	ICON : 'http://calendar.google.com/googlecalendar/images/favicon.ico',
	
	check : function(ps){
		return (/(regular|link)/).test(ps.type) && !ps.file;
	},
	
	getAuthCookie : function(){
		return getCookieString('www.google.com', 'secid').split('=').pop();
	},
	
	post : function(ps){
		if(ps.item && (ps.itemUrl || ps.description)){
			return this.addSchedule(ps.item, joinText([ps.itemUrl, ps.body, ps.description], '\n'), ps.date);
		} else {
			return this.addSimpleSchedule(ps.description);
		}
	},
	
	addSimpleSchedule : function(description){
		if(!this.getAuthCookie())
			throw new Error(getMessage('error.notLoggedin'));
		
		var endpoint = 'http://www.google.com/calendar/m';
		return request(endpoint, {
			queryString : {
				hl : 'en',
			},
		}).addCallback(function(res){
			// form.secidはクッキー内のsecidとは異なる
			var form = formContents(res.responseText);
			return request(endpoint, {
				redirectionLimit : 0,
				sendContent: {
					ctext  : description,
					secid  : form.secid,
					as_sdt : form.as_sdt,
				},
			});
		});
	},
	
	addSchedule : function(title, description, from, to){
		from = from || new Date();
		to = to || new Date(from.getTime() + (86400 * 1000));
		
		return request('http://www.google.com/calendar/event', {
				queryString : {
					action  : 'CREATE', 
					secid   : this.getAuthCookie(), 
					dates   : from.toLocaleFormat('%Y%m%d') + '/' + to.toLocaleFormat('%Y%m%d'),
					text    : title, 
					details : description,
					sf      : true,
					crm     : 'AVAILABLE',
					icc     : 'DEFAULT',
					output  : 'js',
					scp     : 'ONE',
				}
		});
	},
});


Models.register({
	name       : 'Dropmark',
	ICON       : 'chrome://tombfix/skin/favicon/dropmark.ico',
	CONVERTERS : {
		regular      : ps => ({
			content_type : 'text',
			name         : ps.item,
			content_text : ps.description
		}),
		photo        : ps => ps.file ? {
			content_type      : 'file',
			name              : ps.item + (ps.itemUrl || ps.pageUrl).wrap(' (', ')'),
			'content_files[]' : ps.file
		} : {
			content_type : 'link',
			name         : ps.item + ps.pageUrl.wrap(' (', ')'),
			content_link : ps.itemUrl
		},
		quote        : ps => ({
			content_type : 'text',
			name         : ps.item + ps.itemUrl.wrap(' (', ')'),
			content_text : joinText([ps.body.wrap('"'), ps.description], '\n', true)
		}),
		link         : ps => ({
			content_type : 'link',
			name         : ps.item,
			content_link : ps.itemUrl
		}),
		video        : ps => ({
			content_type : 'link',
			name         : ps.item,
			content_link : ps.itemUrl
		}),
		conversation : ps => ({
			content_type : 'text',
			name         : ps.item + ps.itemUrl.wrap(' (', ')'),
			content_text : joinText([ps.body, ps.description], '\n', true)
		})
	},

	check : function (ps) {
		return /^(?:regular|photo|quote|link|video|conversation)$/.test(ps.type);
	},

	post : function (ps) {
		this.checkLogin();

		return this.getLastViewedPageURL().addCallback(url => {
			return request(url + '/items', {
				sendContent : update({
					csrf_token : this.getToken((new URL(url)).hostname)
				}, this.CONVERTERS[ps.type](ps))
			}).addErrback(err => {
				throw new Error(err.message.responseText);
			});
		});
	},

	getLastViewedPageURL : function () {
		// via http://dropmark.com/support/getting-started/browser-extensions-bookmarklets/
		return getFinalUrl('https://app.dropmark.com/?view=bookmarklet');
	},

	getToken : function (hostname) {
		// ホストによりトークンが異なる
		return getCookieValue(hostname, 'csrf_token');
	},

	checkLogin : function () {
		if (!getCookieString('.dropmark.com', 'user_id')) {
			throw new Error(getMessage('error.notLoggedin'));
		}
	}
});


Models.register({
	name     : 'Evernote',
	ICON     : 'chrome://tombfix/skin/favicon/evernote.ico',
	POST_URL : 'https://www.evernote.com/clip.action',
	 
	check : function(ps){
		return (/(regular|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		var self = this;
		ps = update({}, ps);
		if(!this.getAuthCookie())
			throw new Error(getMessage('error.notLoggedin'));
		
		var d = succeed();
		if(ps.type=='link' && !ps.body && getPref('model.evernote.clipFullPage')){
			d = request(ps.itemUrl).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				ps.body = convertToHTMLString(doc.documentElement, true);
			});
		}
		
		return d.addCallback(function(){
			return self.getToken();
		}).addCallback(function(token){
			return request(self.POST_URL, {
				redirectionLimit : 0,
				sendContent : update(token, {
					saveQuicknote : 'save',
					format        : 'microclip',
					
					url      : ps.itemUrl,
					title    : ps.item || 'no title',
					comment  : ps.description,
					body     : getFlavor(ps.body, 'html'),
					tags     : joinText(ps.tags, ','),
					fullPage : (ps.body)? 'true' : 'false',
				}),
			});
		}).addBoth(function(res){
			// 正常終了していない可能性を考慮(ステータスコード200で失敗していた)
			if(res.status != 302)
				throw new Error('An error might occur.');
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('evernote.com', 'auth');
	},
	
	getToken : function(){
		return request(this.POST_URL, {
			sendContent: {
				format    : 'microclip', 
				quicknote : 'true'
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return {
				_sourcePage   : $x('//input[@name="_sourcePage"]/@value', doc),
				__fp          : $x('//input[@name="__fp"]/@value', doc),
				noteBookGuide : $x('//select[@name="notebookGuid"]//option[@selected="selected"]/@value', doc),
			};
		});
	},
});


Models.register(update({
	name : 'Pinboard',
	ICON : 'http://pinboard.in/favicon.ico',
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	getCurrentUser : function(){
		var cookie = getCookies('pinboard.in', 'login')[0];
		if(!cookie)
			throw new Error(getMessage('error.notLoggedin'));
		
		return cookie.value;
	},
	
	post : function(ps){
		var self = this;
		return succeed().addCallback(function(){
			self.getCurrentUser();
			
			return request('https://pinboard.in/add', {
				queryString : {
					title : ps.item,
					url   : ps.itemUrl,
				}
			})
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var form = formContents($x('//form[contains(@action, "add")]', doc));
			
			return request('https://pinboard.in/add', {
				sendContent : update(form, {
					title       : ps.item,
					url         : ps.itemUrl,
					description : joinText([ps.body, ps.description], ' ', true),
					tags        : joinText(ps.tags, ' '),
					private     : 
						(ps.private == null)? form.private : 
						(ps.private)? 'on' : '',
				}),
			});
		});
	},
	
	getUserTags : function(){
		var self = this;
		return succeed().addCallback(function(){
			self.getCurrentUser();
			
			return request('https://pinboard.in/user_tag_list/');
		}).addCallback(function(res){
			return evalInSandbox(
				res.responseText, 
				'https://pinboard.in/'
			).usertags.map(function(tag){
				// 数字のみのタグが数値型になり並べ替え時の比較で失敗するのを避ける
				return {
					name      : ''+tag,
					frequency : 0,
				}
			});
		});
	},
	
	getRecommendedTags : function(url){
		return request('https://pinboard.in/ajax_suggest', {
			queryString : {
				url : url,
			}
		}).addCallback(function(res){
			// 空配列ではなく、空文字列が返ることがある
			return res.responseText? 
				evalInSandbox(res.responseText, 'https://pinboard.in/').map(function(tag){
					// 数字のみのタグが数値型になるのを避ける
					return ''+tag;
				}) : [];
		});
	},
	
	getSuggestions : function(url){
		var self = this;
		var ds = {
			tags        : this.getUserTags(),
			recommended : this.getRecommendedTags(url),
			suggestions : succeed().addCallback(function(){
				self.getCurrentUser();
				
				return request('https://pinboard.in/add', {
					queryString : {
						url : url,
					}
				});
			}).addCallback(function(res){
				var form = formContents(res.responseText);
				return {
					editPage : 'https://pinboard.in/add?url=' + url,
					form : {
						item        : form.title,
						description : form.description,
						tags        : form.tags.split(' '),
						private     : !!form.private,
					},
					
					// 入力の有無で簡易的に保存済みをチェックする
					// (submitボタンのラベルやalertの有無でも判定できる)
					duplicated : !!(form.tags || form.description),
				}
			})
		};
		
		return new DeferredHash(ds).addCallback(function(ress){
			var res = ress.suggestions[1];
			res.recommended = ress.recommended[1]; 
			res.tags = ress.tags[1];
			
			return res;
		});
	},
}));


Models.register({
	name         : 'Delicious',
	ICON         : 'https://delicious.com/favicon.ico',
	ORIGIN       : 'https://delicious.com',
	API_URL      : 'https://avosapi.delicious.com/api/v1/',
	// https://delicious.com/rss
	FEED_API_URL : 'http://feeds.delicious.com/v2/json/',

	check : function (ps) {
		if (/^(?:photo|quote|link|conversation|video)$/.test(ps.type)) {
			if (ps.file) {
				return ps.itemUrl;
			}

			return true;
		}
	},

	post : function (ps) {
		var user = this.getInfo(), that, retry;

		if (!user) {
			throw new Error(getMessage('error.notLoggedin'));
		}

		that = this;
		retry = true;

		return (function addBookmark() {
			return request(that.API_URL + 'posts/addoredit', {
				responseType : 'json',
				queryString  : {
					description : ps.item,
					url         : ps.itemUrl,
					tags        : joinText(ps.tags),
					note        : joinText([ps.body, ps.description], ' ', true),
					private     : ps.private ? 'on' : '',
					replace     : 'true'
				}
			}).addCallback(({response : info}) => {
				if (info.error) {
					if (retry) {
						retry = false;

						return that.updateSessionStatus(user).addCallback(addBookmark);
					}

					throw new Error(info.error);
				}
			});
		}());
	},

	getInfo : function () {
		var {user} = getLocalStorage(this.ORIGIN);

		if (user) {
			user = JSON.parse(user);

			if (user.isLoggedIn) {
				return user;
			}
		}
	},

	updateSessionStatus : function ({username, password_hash}) {
		return request(
			this.API_URL + 'account/webloginhash/' + username + '/' + password_hash,
			{ responseType : 'json' }
		).addCallback(res => res.response);
	},

	getCompose : function (url) {
		return request(this.API_URL + 'posts/compose', {
			responseType : 'json',
			queryString  : { url : url }
		}).addCallback(res => res.response);
	},

	/**
	 * ユーザーの利用しているタグ一覧を取得する。
	 *
	 * @return {Array}
	 */
	getUserTags : function () {
		// 下記のAPIではプライベートなタグは取得できない
		// http://feeds.delicious.com/v2/json/tags/{username}
		return this.getInfo() ? request(this.API_URL + 'posts/you/tags', {
			responseType : 'json'
		}).addCallback(res => {
			var {pkg} = res.response, tags;

			if (!(pkg && pkg.num_tags)) {
				return [];
			}

			tags = pkg.tags;

			return Object.keys(tags).map(tag => ({
				name      : tag,
				frequency : tags[tag]
			}));
		}) : succeed([]);
	},

	/**
	 * 人気のタグ一覧を取得する。
	 *
	 * @return {Array}
	 */
	getPopularTags : function (url) {
		return request(this.FEED_API_URL + 'urlinfo/' + url.md5(), {
			responseType : 'json'
		}).addCallback(res => {
			var [info] = res.response;

			return info ? Object.keys(info.top_tags) : [];
		});
	},

	/**
	 * タグ、人気のタグ、おすすめタグ、ネットワークなどを取得する。
	 * ブックマーク済みでも取得できる。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function (url) {
		return new DeferredHash({
			tags    : this.getUserTags(),
			popular : this.getPopularTags(url),
			compose : this.getCompose(url)
		}).addCallback(ress => {
			var {pkg} = ress.compose[1],
				suggestions = {
					tags        : ress.tags[1],
					popular     : ress.popular[1],
					recommended : pkg.suggested_tags,
					duplicated  : pkg.previously_saved
				};

			if (suggestions.duplicated) {
				update(suggestions, {
					form     : {
						item        : pkg.previously_saved_title,
						tags        : pkg.previous_tags,
						description : pkg.previously_saved_note,
						private     : pkg.previously_saved_privacy
					},
					editPage : this.ORIGIN + '/save?url=' + url
				});
			}

			return suggestions;
		});
	}
});


Models.register({
	name : 'Digg',
	ICON : 'chrome://tombfix/skin/favicon/digg.ico',
	
	check : function(ps){
		return ps.type=='link';
	},
	
	post : function(ps){
		return Digg.dig(ps.item, ps.itemUrl);
	},
	
	dig : function(title, url){
		var url = 'http://digg.com/submit?' + queryString({
			phase : 2,
			url   : url,
			title : title, 
		});
		
		return request(url).addCallback(function(res){
			if(res.channel.URI.asciiSpec.match('digg.com/register/'))
				throw new Error(getMessage('error.notLoggedin'));
			
			var html = res.responseText;
			var pagetype = html.extract(/var pagetype ?= ?"(.+?)";/);
			
			// 誰もdigしていなかったらフォームを開く(CAPTCHAがあるため)
			// 一定時間後にページ遷移するためdescriptionを設定するのが難しい
			if(pagetype=='other')
				return addTab(url, true);
			
			var matches = (/javascript:dig\((.+?),(.+?),'(.+?)'\)/).exec(html);
			return request('http://digg.com/diginfull', {
				sendContent : {
					id       : matches[2],
					row      : matches[1],
					digcheck : matches[3],
					type     : 's',
					loc      : pagetype,
				},
			});
		});
	},
});


Models.register(update({}, AbstractSessionService, {
	name : 'StumbleUpon',
	ICON : 'http://www.stumbleupon.com/favicon.ico',
	
	check : function(ps){
		return ps.type=='link';
	},
	
	post : function(ps){
		return this.iLikeIt(ps.item, ps.itemUrl, ps.description);
	},
	
	iLikeIt : function(title, url, comment){
		var username;
		return StumbleUpon.getCurrentId().addCallback(function(id){
			username = id;
			
			return StumbleUpon.getCurrentPassword();
		}).addCallback(function(password){
			return request('http://www.stumbleupon.com/rate.php', {
				queryString : {
					username : username,
				},
				sendContent : {
					rating   : 1,
					username : username,
					password : ('StumbleUpon public salt' + username + password).sha1(),
					url      : url,
					yr       : 0,
					yts      : 0,
					yhd      : 0,
					ycur_q   : 0,
					ycur_t   : '',
					ycur_s   : '',
					ypre_q   : 0,
					ypre_t   : '',
					ypre_s   : '',
					version  : 'mozbar 3.26 xpi',
				},
			});
		}).addCallback(function(res){
			if(/NEWURL/.test(res.responseText))
				return addTab('http://www.stumbleupon.com/newurl.php?' + queryString({
					title   : title,
					url     : url,
					rating  : 1,
					referer : url,
				}), true).addCallback(function(win){
					$x('id("searchtext")', win.document).value = comment;
				});
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('stumbleupon.com', 'PHPSESSID');
	},
	
	getCurrentUser : function(){
		return this.getSessionValue('user', function(){
			return request('http://www.stumbleupon.com/').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				var user = $x('id("t-home")/a/@href', doc).extract('http://(.+?)\.stumbleupon\.com');
				if(user=='www')
					throw new Error(getMessage('error.notLoggedin'));
				
				return user;
			});
		});
	},
	
	getCurrentId : function(){
		return this.getSessionValue('id', function(){
			var ps = {};
			return succeed().addCallback(function(){
				return StumbleUpon.getCurrentUser();
			}).addCallback(function(user){
				ps.username = user;
				
				return StumbleUpon.getCurrentPassword();
			}).addCallback(function(password){
				ps.password = password;
				
				return request('https://www.stumbleupon.com/userexists.php', {
					sendContent : ps,
				});
			}).addCallback(function(res){
				return res.responseText.extract(/USER (.+)/);
			});
		});
	},
	
	getCurrentPassword : function(user){
		return this.getSessionValue('password', function(){
			return StumbleUpon.getCurrentUser().addCallback(function(user){
				var passwords = getPasswords('http://www.stumbleupon.com', user);
				if(!passwords.length)
					throw new Error(getMessage('error.passwordNotFound'));
				
				return passwords[0].password;
			});
		});
	},
}));


Models.register({
	name : 'FirefoxBookmark',
	ICON : 'chrome://tombfix/skin/firefox.ico',
	ANNO_DESCRIPTION : 'bookmarkProperties/description',
	
	check : function(ps){
		return ps.type == 'link';
	},
	
	post : function(ps){
		return succeed(this.addBookmark(ps.itemUrl, ps.item, ps.tags, ps.description));
	},
	
	addBookmark : function(uri, title, tags, description){
		var bs = NavBookmarksService;
		
		var folder;
		var index = bs.DEFAULT_INDEX;
		
		// ハッシュタイプの引数か?
		if(typeof(uri)=='object' && !(uri instanceof IURI)){
			if(uri.index!=null)
				index = uri.index;
			
			folder = uri.folder;
			title = uri.title;
			tags = uri.tags;
			description = uri.description;
			uri = uri.uri;
		}
		
		uri = createURI(uri);
		tags = tags || [];
		
		// フォルダが未指定の場合は未整理のブックマークになる
		folder = (!folder)? 
			bs.unfiledBookmarksFolder : 
			this.createFolder(folder);
		
		// 同じフォルダにブックマークされていないか?
		if(!bs.getBookmarkIdsForURI(uri, {}).some(function(item){
			return bs.getFolderIdForItem(item) == folder;
		})){
			var folders = [folder].concat(tags.map(bind('createTag', this)));
			folders.forEach(function(folder){
				bs.insertBookmark(
					folder, 
					uri,
					index,
					title);
			});
		}
		
		this.setDescription(uri, description);
	},
	
	getBookmark : function(uri){
		uri = createURI(uri);
		var item = this.getBookmarkId(uri);
		if(item)
			return {
				title       : NavBookmarksService.getItemTitle(item),
				uri         : uri.asciiSpec,
				description : this.getDescription(item),
			};
	},
	
	isBookmarked : function(uri){
		return this.getBookmarkId(uri) != null;
		
		// 存在しなくてもtrueが返ってくるようになり利用できない
		// return NavBookmarksService.isBookmarked(createURI(uri));
	},
	
	isVisited : function(uri) {
		try{
			var query = NavHistoryService.getNewQuery();
			var options = NavHistoryService.getNewQueryOptions();
			query.uri = createURI(uri);
			
			var root = NavHistoryService.executeQuery(query, options).root;
			root.containerOpen = true;
			
			return !!root.childCount;
		} catch(e) {
			return false;
		} finally {
			root.containerOpen = false;
		}
	},
	
	removeBookmark : function(uri){
		this.removeItem(this.getBookmarkId(uri));
	},
	
	removeItem : function(itemId){
		NavBookmarksService.removeItem(itemId);
	},
	
	getBookmarkId : function(uri){
		if(typeof(uri)=='number')
			return uri;
		
		uri = createURI(uri);
		return NavBookmarksService.getBookmarkIdsForURI(uri, {}).filter(function(item){
			while(item = NavBookmarksService.getFolderIdForItem(item))
				if(item == NavBookmarksService.tagsFolder)
					return false;
			
			return true;
		})[0];
	},
	
	getDescription : function(uri){
		try{
			return AnnotationService.getItemAnnotation(this.getBookmarkId(uri), this.ANNO_DESCRIPTION);
		} catch(e){
			return '';
		}
	},
	
	setDescription : function(uri, description){
		if(description == null)
			return;
		
		description = description || '';
		try{
			AnnotationService.setItemAnnotation(this.getBookmarkId(uri), this.ANNO_DESCRIPTION, description, 
				0, AnnotationService.EXPIRE_NEVER);
		} catch(e){}
	},
	
	createTag : function(name){
		return this.createFolder(name, NavBookmarksService.tagsFolder);
	},
	
	/*
	NavBookmarksServiceに予め存在するフォルダID
		placesRoot
		bookmarksMenuFolder
		tagsFolder
		toolbarFolder
		unfiledBookmarksFolder
	*/
	
	/**
	 * フォルダを作成する。
	 * 既に同名のフォルダが同じ場所に存在する場合は、新たに作成されない。
	 *
	 * @param {String} name フォルダ名称。
	 * @param {Number} parentId 
	 *        フォルダの追加先のフォルダID。省略された場合ブックマークメニューとなる。
	 * @return {Number} 作成されたフォルダID。
	 */
	createFolder : function(name, parentId){
		parentId = parentId || NavBookmarksService.bookmarksMenuFolder;
		
		return this.getFolder(name, parentId) ||
			NavBookmarksService.createFolder(parentId, name, NavBookmarksService.DEFAULT_INDEX);
	},
	
	/**
	 * フォルダIDを取得する。
	 * 既に同名のフォルダが同じ場所に存在する場合は、新たに作成されない。
	 *
	 * @param {String} name フォルダ名称。
	 * @param {Number} parentId 
	 *        フォルダの追加先のフォルダID。省略された場合ブックマークメニューとなる。
	 */
	getFolder : function(name, parentId) {
		parentId = parentId || NavBookmarksService.bookmarksMenuFolder;
		
		let query = NavHistoryService.getNewQuery();
		let options = NavHistoryService.getNewQueryOptions();
		query.setFolders([parentId], 1);
		
		let root = NavHistoryService.executeQuery(query, options).root;
		try{
			root.containerOpen = true;
			for(let i=0, len=root.childCount; i<len; ++i){
				let node = root.getChild(i);
				if(node.type === node.RESULT_TYPE_FOLDER && node.title === name)
					return node.itemId;
			}
		} finally {
			root.containerOpen = false;
		}
	},
});


Models.register({
	name : 'Pocket',
	ICON : 'https://getpocket.com/favicon.ico',

	check : function (ps) {
		return /^(?:quote|link)$/.test(ps.type);
	},

	post : function (ps) {
		if (!getCookieString('.getpocket.com', 'sess_user_id')) {
			throw new Error(getMessage('error.notLoggedin'));
		}

		return request('https://getpocket.com/edit', {
			responseType : 'document',
			queryString : {
				url   : ps.itemUrl,
				tags  : (ps.tags || []).join()
			}
		}).addCallback(({response : doc}) => {
			if (new URL(doc.URL).pathname !== '/edit') {
				throw new Error(getMessage('error.notLoggedin'));
			}
		});
	}
});


Models.register(update({
	name   : 'Instapaper',
	ICON   : 'chrome://tombfix/skin/favicon/instapaper.png',
	ORIGIN : 'https://www.instapaper.com',

	check : function (ps) {
		return /^(?:quote|link)$/.test(ps.type);
	},

	post : function (ps) {
		return this.getSessionValue('token', () => {
			return request(this.ORIGIN + '/u', {
				responseType : 'document'
			}).addCallback(({response : doc}) => {
				return $x('//input[@id="form_key"]/@value', doc);
			});
		}).addCallback(token => {
			return request(this.ORIGIN + '/edit', {
				sendContent : {
					'form_key'            : token,
					'bookmark[url]'       : ps.itemUrl,
					'bookmark[title]'     : ps.item,
					'bookmark[selection]' : joinText([
						Twitter.createQuote(ps.body || ''),
						ps.description
					], '\n\n')
				}
			});
		});
	},

	getAuthCookie : function () {
		return getCookieString('www.instapaper.com', 'pfu');
	}
}, AbstractSessionService));


Models.register({
	name      : 'Readability',
	ICON      : 'chrome://tombfix/skin/favicon/readability.png',
	// via https://www.readability.com/bookmarklets
	QUEUE_URL : 'https://www.readability.com/articles/queue',

	check : function (ps) {
		return ps.type === 'link';
	},

	post : function (ps) {
		return this.queue(ps.itemUrl).addErrback(err => {
			throw new Error(err.message.response.body.textContent);
		}).addCallback(({response : doc}) => {
			if (doc.URL === this.QUEUE_URL) {
				throw new Error(getMessage('error.notLoggedin'));
			}
			if ((new URL(doc.URL)).pathname === '/articles/fail') {
				throw new Error(doc.querySelector('.fail-desc > h1').textContent);
			}
		});
	},

	queue : function (url, read) {
		var token = this.getToken();

		if (!(token || read)) {
			throw new Error(getMessage('error.notLoggedin'));
		}

		return request(this.QUEUE_URL, {
			responseType : 'document',
			sendContent : {
				token : token,
				url   : url,
				read  : read ? 1 : 0
			}
		});
	},

	getToken : function () {
		return getCookieValue('readability.com', 'readabilityToken');
	}
});


Models.register({
	name : 'Remember The Milk',
	ICON : 'http://www.rememberthemilk.com/favicon.ico',
	POST_URL: 'http://www.rememberthemilk.com/services/ext/addtask.rtm',
	
	check : function(ps){
		return (/(regular|link)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return this.addSimpleTask(
			joinText([ps.item, ps.body, ps.description], ' ', true), 
			ps.date, ps.tags);
	},
	
	/**
	 * 簡単なタスクを追加する。
	 * ブックマークレットのフォーム相当の機能を持つ。
	 *
	 * @param {String} task タスク名。
	 * @param {Date} due 期日。未指定の場合、当日になる。
	 * @param {Array} tags タグ。
	 * @param {String || Number} list 
	 *        追加先のリスト。リスト名またはリストID。未指定の場合、デフォルトのリストとなる。
	 */
	addSimpleTask : function(task, due, tags, list){
		var self = this;
		return request(self.POST_URL).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			if(!doc.getElementById('miniform'))
				throw new Error(getMessage('error.notLoggedin'));
			
			var form = formContents(doc);
			if(list){
				forEach($x('id("l")/option', doc, true), function(option){
					if(option.textContent == list){
						list = option.value;
						throw StopIteration;
					}
				})
				form.l = list;
			}
			
			return request(self.POST_URL, {
				sendContent : update(form, {
					't'  : task,
					'tx' : joinText(tags, ','),
					'd'  : (due || new Date()).toLocaleFormat('%Y-%m-%d'),
				}),
			});
		});
	}
});


// http://developer.yahoo.co.jp/jlp/MAService/V1/parse.html
Models.register({
	name : 'Yahoo',
	APP_ID : '16y9Ex6xg64GBDD.tmwF.WIdXURG0iTT25NUQ72RLF_Jzt2_MfXDDZfKehYkX6dPZqk-',
	
	parse : function(ps){
		ps.appid = this.APP_ID;
		return request('http://jlp.yahooapis.jp/MAService/V1/parse', {
			charset     : 'utf-8',
			sendContent : ps
		}).addCallback(function(res){
			return convertToDOM(res.responseText);
		});
	},
	
	getKanaReadings : function(str){
		return this.parse({
			sentence : str,
			response : 'reading',
		}).addCallback(function(dom){
			return $x('//reading/text()', dom, true);
		});
	},
	
	getRomaReadings : function(str){
		return this.getKanaReadings(str).addCallback(function(readings){
			return readings.join('\u0000').toRoma().split('\u0000');
		});
	},
});


Models.register(update({
	name   : 'YahooBookmarks',
	ICON   : 'http://i.yimg.jp/images/sicons/ybm16.gif',
	ORIGIN : 'http://bookmarks.yahoo.co.jp',

	check : function (ps) {
		if (/^(?:photo|quote|link|video|conversation)$/.test(ps.type)) {
			if (ps.file) {
				return ps.itemUrl;
			}

			return true;
		}
	},

	post : function (ps) {
		return this.getSessionValue('token', () => {
			return request(this.ORIGIN + '/bookmarklet', {
				responseType : 'document'
			}).addCallback(({response : doc}) => {
				var script = doc.querySelector('script:not([src])');

				if (!script || doc.getElementById('login_form')) {
					throw new Error(getMessage('error.notLoggedin'));
				}

				return script.textContent.trim().extract(/^cic = "([^"]+)"$/);
			});
		}).addCallback(token => {
			return request(this.ORIGIN + '/create/post', {
				sendContent : {
					crumb : token,
					title : ps.item,
					url   : ps.itemUrl,
					memo  : joinText([
						Twitter.createQuote(ps.body || ''),
						ps.description
					], '\n\n', true)
				}
			});
		});
	},

	getAuthCookie : function () {
		return getCookieString('.yahoo.co.jp', 'T');
	}
}, AbstractSessionService));


Models.register({
	name : 'Faves',
	ICON : 'chrome://tombfix/skin/favicon/faves.ico',
	
	/**
	 * タグを取得する。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function(url){
		// 同期でエラーが起きないようにする
		return succeed().addCallback(function(){
			return request('https://secure.faves.com/v1/tags/get');
		}).addCallback(function(res){
			return {
				duplicated : false,
				tags : reduce(function(memo, tag){
					memo.push({
						name      : tag.getAttribute('tag'),
						frequency : tag.getAttribute('count'),
					});
					return memo;
				}, convertToDOM(res.responseText).querySelectorAll('tag'), []),
			};
		});
	},
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return request('https://secure.faves.com/v1/posts/add', {
			queryString : {
				url         : ps.itemUrl,
				description : ps.item,
				shared      : ps.private? 'no' : '',  
				tags        : joinText(ps.tags, ' '),
				extended    : joinText([ps.body, ps.description], ' ', true),
			},
		});
	},
});


Models.register({
	name : 'Snipshot',
	ICON : 'chrome://tombfix/skin/favicon/snipshot.png',
	
	check : function(ps){
		return ps.type=='photo';
	},
	
	post : function(ps){
		return request('http://services.snipshot.com/', {
			sendContent : {
				snipshot_input : ps.file || ps.itemUrl,
			},
		}).addCallback(function(res){
			return addTab(res.channel.URI.asciiSpec);
		}).addCallback(function(win){
			win.SnipshotImport = {
				title : ps.page,
				url   : ps.pageUrl,
			};
		});
	},
});


Models.register(update({
	name    : 'Hatena',
	ICON    : 'https://www.hatena.ne.jp/favicon.ico',
	ORIGIN  : 'https://www.hatena.ne.jp',
	API_URL : 'http://b.hatena.ne.jp/my.name',

	getPasswords : function () {
		return getPasswords(this.ORIGIN);
	},

	login : function (user, password) {
		notify(this.name, getMessage('message.changeAccount.logout'), this.ICON);

		return (this.getAuthCookie() ? this.logout() : succeed()).addCallback(() => {
			notify(this.name, getMessage('message.changeAccount.login'), this.ICON);

			return request(this.ORIGIN + '/login', {
				sendContent : {
					name       : user,
					password   : password,
					persistent : 1
				}
			});
		}).addCallback(() => {
			this.updateSession();
			this.user = user;

			delete this.userInfo;

			notify(this.name, getMessage('message.changeAccount.done'), this.ICON);
		});
	},

	logout : function () {
		return request(this.ORIGIN + '/logout');
	},

	getAuthCookie : function () {
		return getCookieString('.hatena.ne.jp', 'rk');
	},

	getToken : function () {
		return this.getUserInfo().addCallback(json => json.rks);
	},

	getCurrentUser : function () {
		return this.getUserInfo().addCallback(json => json.name);
	},

	getUserInfo : function () {
		return this.getSessionValue('userInfo', () => {
			return request(this.API_URL, {
				responseType : 'json'
			}).addCallback(({response : json}) => {
				if (json.login === 0) {
					throw new Error(getMessage('error.notLoggedin'));
				}

				return json;
			});
		});
	},

	reprTags: function (tags) {
		return (tags || []).map(tag => tag.wrap('[', ']')).join('');
	}
}, AbstractSessionService));


Models.register({
	name : 'HatenaFotolife',
	ICON : 'http://f.hatena.ne.jp/favicon.ico',

	check : function (ps) {
		return ps.type === 'photo';
	},

	post : function (ps) {
		return Hatena.getUserInfo().addCallback(json => {
			return (ps.file ?
				succeed(ps.file) :
				// 拡張子を指定しないとアップロードに失敗する(エラーは起きない)
				download(ps.itemUrl, getTempFile(createURI(ps.itemUrl).fileExtension))
			).addCallback(file => {
				return request('http://f.hatena.ne.jp/' + json.name + '/up', {
					sendContent : {
						mode       : 'enter',
						rkm        : json.rkm,
						// image1 - image5
						// fototitle1 - fototitle5 (optional)
						image1     : file,
						fototitle1 : ps.item || ps.page,
						folder     : '',
						taglist    : Hatena.reprTags(ps.tags)
					}
				});
			});
		});
	}
});


Models.register({
	name   : 'HatenaBookmark',
	ICON   : 'chrome://tombfix/skin/favicon/hatenabookmark.png',
	ORIGIN : 'http://b.hatena.ne.jp',

	check : function (ps) {
		if (/^(?:photo|quote|link|conversation|video)$/.test(ps.type)) {
			if (ps.file) {
				return ps.itemUrl;
			}

			return true;
		}
	},

	post : function (ps) {
		return Hatena.getToken().addCallback(token => {
			var description = joinText([ps.body, ps.description], ' ', true);

			// alternate: http://b.hatena.ne.jp/{username}/add.edit
			return request(this.ORIGIN + '/bookmarklet.edit', {
				sendContent : {
					rks     : token,
					url     : ps.itemUrl.replace(/%[0-9a-f]{2}/g, str => str.toUpperCase()),
					// タイトルは共有されているため送信しない
					title   : null,
					// http://b.hatena.ne.jp/help/tag
					comment : Hatena.reprTags(ps.tags) + description.replace(/[\n\r]+/g, ' '),
					private : ps.private ? 1 : null
				}
			});
		});
	},

	getEntry : function (url) {
		return request(this.ORIGIN + '/my.entry', {
			responseType : 'json',
			queryString  : { url : url }
		}).addCallback(res => res.response);
	},

	/**
	 * ユーザーの利用しているタグ一覧を取得する。
	 *
	 * @return {Array}
	 */
	getUserTags : function (user) {
		return request(this.ORIGIN + '/' + user + '/tags.json', {
			responseType : 'json'
		}).addCallback(res => {
			var {tags} = res.response;

			return Object.keys(tags).map(tag => ({
				name      : tag,
				frequency : tags[tag].count
			}));
		});
	},

	/**
	 * タグ、おすすめタグ、キーワードを取得する
	 * ページURLが空の場合、タグだけが返される。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function (url) {
		return Hatena.getCurrentUser().addCallback(user => {
			return new DeferredHash({
				tags  : this.getUserTags(user),
				entry : this.getEntry(url)
			});
		}).addCallback(ress => {
			var entry = ress.entry[1],
				suggestions = {
					tags        : ress.tags[1],
					recommended : entry.recommend_tags,
					duplicated  : entry.bookmarked_data
				};

			if (suggestions.duplicated) {
				update(suggestions, {
					form     : {
						item        : entry.title,
						tags        : entry.bookmarked_data.tags,
						description : entry.bookmarked_data.comment,
						private     : entry.bookmarked_data.private
					},
					editPage : this.ORIGIN + '/add' + queryString({
						mode : 'confirm',
						url  : url
					}, true)
				});
			}

			return suggestions;
		});
	}
});


Models.register( {
	name     : 'HatenaDiary',
	ICON     : 'http://d.hatena.ne.jp/favicon.ico',
	POST_URL : 'http://d.hatena.ne.jp',
	
	check : function(ps){
		return (/(regular|photo|quote|link)/).test(ps.type) && !ps.file;
	},
	
	converters: {
		regular : function(ps, title){
			return ps.description;
		},
		
		photo : function(ps, title){
			return [
				'<blockquote cite=' + ps.pageUrl + ' title=' + title + '>',
				'	<img src=' + ps.itemUrl + ' />',
				'</blockquote>',
				ps.description
			].join('\n');
		},
		
		link : function(ps, title){
			return [
				'<a href=' + ps.pageUrl + ' title=' + title + '>' + ps.page + '</a>',
				ps.description
			].join('\n');
		},
		
		quote : function(ps, title){
			return [
				'<blockquote cite=' + ps.pageUrl + ' title=' + title + '>' + ps.body + '</blockquote>',
				ps.description
			].join('\n');
		},
	},
	
	post : function(ps){
		var self = this;
		
		return Hatena.getUserInfo().addCallback(function(info){
			var title = ps.item || ps.page || '';
			var endpoint = [self.POST_URL, info.name, ''].join('/');
			return request(endpoint, {
				redirectionLimit : 0,
				referrer         : endpoint,
				sendContent      : {
					rkm   : info.rkm,
					title : Hatena.reprTags(ps.tags) + title,
					body  : self.converters[ps.type](ps, title),
				},
			});
		});
	}
});


Models.register(Object.assign({
	name   : 'HatenaStar',
	ICON   : 'https://s.hatena.ne.jp/favicon.ico',
	ORIGIN : 'https://s.hatena.ne.jp',

	check(ps) {
		if (/^(?:photo|quote|link|conversation|video)$/.test(ps.type)) {
			if (ps.file) {
				return ps.itemUrl;
			}

			return true;
		}
	},

	post(ps) {
		return HatenaStar.getToken().addCallback(token => {
			return request(this.ORIGIN + '/star.add.json', {
				responseType : 'json',
				queryString  : {
					rks   : token,
					uri   : ps.itemUrl,
					quote : joinText([ps.body, ps.description], ' ', true)
				}
			});
		}).addCallback(({response : json}) => {
			let {errors} = json;

			if (errors) {
				throw new Error(joinText(errors, '\n', true));
			}
		});
	},

	getToken() {
		return this.getSessionValue('token', () => {
			return request(this.ORIGIN + '/entries.json', {
				responseType : 'json'
			});
		}).addCallback(({response : json}) => {
			let {rks} = json;

			if (!rks) {
				throw new Error(getMessage('error.notLoggedin'));
			}

			return rks;
		});
	},

	getAuthCookie() {
		return Hatena.getAuthCookie();
	}
}, AbstractSessionService));


Models.register({
	name : '絶対復習',
	URL  : 'http://brushup.narihiro.info',
	ICON : 'chrome://tombfix/skin/item.ico',
	
	getAuthCookie : function(){
		return getCookieString('brushup.narihiro.info', 'brushup_auth_token').split('=').pop();
	},
	
	check: function(ps) {
		return (/(regular|link|quote)/).test(ps.type) && !ps.file;
	},
	
	post: function(ps) {
		return this.add(ps.item, joinText([ps.itemUrl, ps.body, ps.description], '\n'), ps.tags);
	},
	
	add : function(title, description, tags){
		var self = this;
		return request(this.URL + '/reminders/new').addCallback(function(res){
			if(res.channel.URI.asciiSpec.match('login'))
				throw new Error(getMessage('error.notLoggedin'));
			
			var doc = convertToHTMLDocument(res.responseText);
			var form = formContents(doc);
			
			return request(self.URL + $x('id("new_reminder")/@action', doc), {
				redirectionLimit : 0,
				sendContent : update(form, {
					'reminder[title]'    : title,
					'reminder[body]'     : description,
					'reminder[tag_list]' : joinText(tags, ' '),
				}),
			});
		});
	},
});


Models.register({
	name : 'MediaMarker',
	ICON : 'http://mediamarker.net/favicon.ico',
	check : function(ps){
		return ps.type == 'link' && !ps.file;
	},
	
	getAuthCookie : function(){
		return getCookieString('mediamarker.net', 'mediax_ss');
	},
	
	post : function(ps){
		if(!this.getAuthCookie())
			throw new Error(getMessage('error.notLoggedin'));
		
		return request('http://mediamarker.net/reg', {
			queryString : {
				mode    : 'marklet',
				url     : ps.itemUrl,
				comment : ps.description,
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var url = $x('id("reg")/@action', doc);
			if(!url)
				throw new Error(getMessage('error.alreadyExists'));
			
			return request(url, {
				redirectionLimit : 0,
				sendContent : update(formContents(doc), {
					title : ps.item,
					tag   : joinText(ps.tags, '\n'),
				})
			});
		});
	}
});


Models.register({
	name : 'LibraryThing',
	ICON : 'http://www.librarything.com/favicon.ico',
	
	check : function(ps){
		return ps.type == 'link' && !ps.file;
	},
	
	getAuthCookie : function(){
		return getCookies('librarything.com', 'cookie_userid');
	},
	
	getHost : function(){
		var cookies = this.getAuthCookie();
		if(!cookies.length)
			throw new Error(getMessage('error.notLoggedin'));
		
		return cookies[0].host;
	},
	
	post : function(ps){
		var self = this;
		return request('http://' + self.getHost() + '/import_submit.php', {
			sendContent : {
				form_textbox : ps.itemUrl,
			},
		}).addCallback(function(res){
			var err = res.channel.URI.asciiSpec.extract('http://' + self.getHost() + '/import.php?pastealert=(.*)');
			if(err)
				throw new Error(err);
			
			var doc = convertToHTMLDocument(res.responseText);
			return request('http://' + self.getHost() + '/import_questions_submit.php', {
				redirectionLimit : 0,
				sendContent : update(formContents(doc), {
					masstags :	joinText(ps.tags, ','),
				}),
			});
		});
	}
});


Models.register({
	name : '8tracks',
	ICON : 'http://8tracks.com/favicon.ico',
	URL  : 'http://8tracks.com',
	
	upload : function(file){
		file = getLocalFile(file);
		return request(this.URL + '/tracks', {
			redirectionLimit : 0,
			sendContent : {
				'track_files[]' : file,
			},
		});
	},
	
	getPlayToken : function(){
		return getJSON(this.URL + '/sets/new.json').addCallback(function(res){
			return res.play_token;
		});
	},
	
	getPlaylist : function(mixId){
		var self = this;
		var tracks = [];
		var number = 0;
		var d = new Deferred();
		
		self.getPlayToken().addCallback(function(token){
			(function callee(){
				var me = callee;
				return getJSON(self.URL + '/sets/' + token + '/' + ((number==0)? 'play' : 'next')+ '.json', {
					queryString : {
						mix_id : mixId,
					}
				}).addCallback(function(res){
					var track = res.set.track;
					
					// 最後のトラック以降にはトラック個別情報が含まれない
					if(!track.url){
						d.callback(tracks);
						return;
					}
					
					track.number = ++number;
					tracks.push(track);
					me();
				}).addErrback(function(e){
					error(e);
					
					// 異常なトラックをスキップする(破損したJSONが返る)
					if(e.message.name == 'SyntaxError')
						me();
				});
			})();
		});
		
		return d;
	}
});


Models.register({
	name : 'is.gd',
	ICON : 'http://is.gd/favicon.ico',
	URL  : 'http://is.gd/',
	
	shorten : function(url){
		if((/\/\/is\.gd\//).test(url))
			return succeed(url);
		
		return request(this.URL + '/api.php', {
			redirectionLimit : 0,
			queryString : {
				longurl : url,
			},
		}).addCallback(function(res){
			return res.responseText;
		});
	},
	
	expand : function(url){
		return request(url, {
			redirectionLimit : 0,
		}).addCallback(function(res){
			return res.channel.URI.spec;
		});
	},
});


Models.register({
	name    : 'bit.ly',
	ICON    : 'chrome://tombfix/skin/favicon/bitly.png',
	URL     : 'http://api.bit.ly',
	API_KEY : 'R_8d078b93e8213f98c239718ced551fad',
	USER    : 'to',
	VERSION : '2.0.1',
	
	shorten : function(url){
		var self = this;
		if(url.match('//(bit.ly|j.mp)/'))
			return succeed(url);
		
		return this.callMethod('shorten', {
			longUrl : url,
		}).addCallback(function(res){
			return res[url].shortUrl;
		});
	},
	
	expand : function(url){
		var hash = url.split('/').pop();
		return this.callMethod('expand', {
			hash : hash,
		}).addCallback(function(res){
			return res[hash].longUrl;
		});
	},
	
	callMethod : function(method, ps){
		var self = this;
		return request(this.URL + '/' + method, {
			queryString : update({
				version : this.VERSION,
				login   : this.USER,
				apiKey  : this.API_KEY,
			}, ps),
		}).addCallback(function(res){
			res = evalInSandbox('(' + res.responseText + ')', self.URL);
			if(res.errorCode){
				var error = new Error([res.statusCode, res.errorCode, res.errorMessage].join(': '))
				error.detail = res;
				throw error;
			}
			
			return res.results;
		});
	},
});


Models.register(update({}, Models['bit.ly'], {
	name : 'j.mp',
	ICON : 'https://j.mp/favicon.ico',
	URL  : 'http://api.j.mp',
}));


Models.register({
	name : 'Nicovideo',
	URL  : 'http://www.nicovideo.jp',
	ICON : 'http://www.nicovideo.jp/favicon.ico',
	
	getPageInfo : function(id){
		return request(this.URL + '/watch/' + id, {
			charset : 'UTF-8',
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return {
				title : doc.title.extract(/(.*)‐/),
				lists : $x('id("des_2")//a[contains(@href, "/mylist/")]/@href', doc, true),
				links : $x('id("des_2")//a[starts-with(@href, "http") and contains(@href, "/watch/")]/@href', doc, true),
			}
		});
	},
	
	download : function(id, title){
		var self = this;
		return ((title)? succeed(title) : self.getPageInfo(id).addCallback(itemgetter('title'))).addCallback(function(title){
			return request(self.URL + '/api/getflv?v='+id).addCallback(function(res){
				var params = parseQueryString(res.responseText);
				var file = getDownloadDir();
				file.append(validateFileName(title + '.flv'));
				return download(params.url, file, true);
			});
		});
	},
});


// 全てのサービスをグローバルコンテキストに置く(後方互換)
Models.copyTo(this);


/**
 * ポストを受け取ることができるサービスのリストを取得する。
 * 
 * @param {Object} ps ポスト情報。
 * @return {Array}
 */
Models.check = function(ps){
	return this.values.filter(function(m){
		if((ps.favorite && ps.favorite.name==m.name) || (m.check && m.check(ps)))
			return true;
	});
}

/**
 * デフォルトのサービスのリストを取得する。
 * ユーザーの設定が適用される。
 *
 * @param {Object} ps ポスト情報。
 * @return {Array}
 */
Models.getDefaults = function(ps){
	var config = JSON.parse(getPref('postConfig'));
	return this.check(ps).filter(function(m){
		return Models.getPostConfig(config, m.name, ps) == 'default';
	});
}

/**
 * 利用可能なサービスのリストを取得する。
 * ユーザーの設定が適用される。
 *
 * @param {Object} ps ポスト情報。
 * @return {Array}
 */
Models.getEnables = function(ps){
	var config = JSON.parse(getPref('postConfig'));
	return this.check(ps).filter(function(m){
		m.config = (m.config || {});
		
		// クイックポストフォームにて、取得後にデフォルトなのか利用可能なのかを
		// 判定する必要があったため、サービスに設定値を保存し返す
		var val = m.config[ps.type] = Models.getPostConfig(config, m.name, ps);
		return val==null || (/(default|enable)/).test(val);
	});
}

/**
 * ポスト設定値を文字列で取得する。
 * 
 * @param {Object} config ポスト設定。
 * @param {String} name サービス名。
 * @param {Object} ps ポスト情報。
 * @return {String}
 */
Models.getPostConfig = function(config, name, ps){
	var c = config[name] || {};
	return (ps.favorite && ps.favorite.name==name)? c.favorite : c[ps.type];
}


function shortenUrls(text, model){
	var reUrl = /https?[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#\^]+/g;
	if(!reUrl.test(text))
		return text;
		
	var urls = text.match(reUrl);
	return gatherResults(urls.map(function(url){
		return model.shorten(url);
	})).addCallback(function(ress){
		zip(urls, ress).forEach(function([url, res]){
			text = text.replace(url, res);
		});
		
		return text;
	});
}
