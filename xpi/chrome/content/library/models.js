var Models, models;
this.Models = this.models = Models = models = new Repository();


var Tumblr = update({}, AbstractSessionService, {
	name : 'Tumblr',
	ICON : 'http://www.tumblr.com/images/favicon.gif',
	TUMBLR_URL : 'http://www.tumblr.com/',
	SVC_URL : 'https://www.tumblr.com/svc/',
	
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
		var self = this, doc;
		return request(url).addCallback(function(res){
			doc = convertToHTMLDocument(res.responseText);

			var form = formContents(doc);
			delete form.preview_post;
			form.redirect_to = Tumblr.TUMBLR_URL+'dashboard';

			if (!form['post[type]']) {
				let {pathname} = new URL(url),
					match = /^\/reblog\/(\d+)\/([^\/]+)/.exec(pathname);

				if (match) {
					let [reblogID, reblogKey] = match.slice(1);

					return Tumblr.getReblogPostInfo(reblogID, reblogKey).addCallback(info => {
						form['post[type]'] = info.type;

						if (!form.reblog_post_id) {
							form.reblog_post_id = info.parent_id;
						}

						return form;
					});
				}
			}

			return form;
		}).addCallback(function(form){
			if(form.reblog_post_id){
				self.trimReblogInfo(form);
				
				// Tumblrから他サービスへポストするため画像URLを取得しておく
				if (form['post[type]'] === 'photo') {
					form.image = $x('id("edit_post")//img[contains(@src, "media.tumblr.com/") or contains(@src, "data.tumblr.com/")]/@src', doc);
					if (!form.image) {
						let img = doc.querySelector('.reblog_content img');

						if (img) {
							form.image = img.src;
						}
					}
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
				throw new Error(convertToPlainText(doc.getElementById('errors') || doc.querySelector('.errors')));
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

	getReblogPostInfo(reblogID, reblogKey, postType) {
		return request(this.SVC_URL + 'post/fetch', {
			responseType : 'json',
			queryString  : {
				reblog_id  : reblogID,
				reblog_key : reblogKey,
				post_type  : postType || ''
			}
		}).addCallback(({response : json}) => {
			if (json.errors === false) {
				let {post} = json;

				if (post) {
					return post;
				}
			}

			throw new Error(json.error || getMessage('error.contentsNotFound'));
		});
	}
});


Tumblr.Regular = {
	convertToForm : function(ps){
		return {
			'post[type]' : ps.type,
			'post[one]'  : ps.item,
			'post[two]'  : joinText([getFlavor(ps.body, 'html'), ps.description], '\n\n'),
		};
	},
}

Tumblr.Photo = {
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
}

Tumblr.Video = {
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
	convertToForm : function(ps){
		return {
			'post[type]' : ps.type,
			'post[one]'  : ps.item,
			'post[two]'  : joinText([getFlavor(ps.body, 'html'), ps.description], '\n\n'),
		};
	},
}

Tumblr.Quote = {
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
 *
 * 2015年1月29日の変更に対応する為、UAをFirefox for Android(Mobile)に変更
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
				'User-Agent' : 'Mozilla/5.0 (Android; Mobile; rv:35.0) Gecko/35.0 Firefox/35.0'
			}
		});
		if (getCookieValue('www.tumblr.com', 'disable_mobile_layout') === '1') {
			// via https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsICookieManager#remove()
			CookieManager.remove('www.tumblr.com', 'disable_mobile_layout', '/', false);
		}
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
	ICON : 'https://www.google.com/favicon.ico',

	getAuthCookie() {
		// via https://www.google.com/policies/technologies/types/
		return getCookieValue('.google.com', 'SID');
	}
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
	name         : 'GoogleCalendar',
	ICON         : 'https://calendar.google.com/googlecalendar/images/favicon.ico',
	CALENDAR_URL : 'https://www.google.com/calendar/',

	check(ps) {
		return /^(?:regular|link)$/.test(ps.type);
	},

	post(ps) {
		if (!Google.getAuthCookie()) {
			throw new Error(getMessage('error.notLoggedin'));
		}

		if (ps.item && (ps.itemUrl || ps.description)) {
			return this.addSchedule(
				ps.item,
				joinText([
					ps.itemUrl,
					(ps.body || '').trimTag(),
					ps.description
				], '\n'),
				ps.date
			);
		} else {
			return this.addSimpleSchedule(ps.description);
		}
	},

	addSchedule(title, description, from, to) {
		return this.getToken().addCallback(token => {
			return request(this.CALENDAR_URL + 'event', {
				sendContent : {
					action  : 'CREATE',
					crm     : 'AVAILABLE',
					icc     : 'DEFAULT',
					scp     : 'ONE',
					sf      : true,
					secid   : token,
					text    : title,
					details : description,
					dates   : this.getDates(from, to)
				}
			});
		});
	},

	addSimpleSchedule(description) {
		return request(this.CALENDAR_URL + 'm?hl=en', {
			responseType : 'document'
		}).addCallback(({response : doc}) => {
			return request(this.CALENDAR_URL + 'm', {
				sendContent : Object.assign(formContents(doc.documentElement), {
					ctext : description || ''
				})
			});
		});
	},

	getToken() {
		return maybeDeferred(
			this.getSECID() || request(
				this.CALENDAR_URL + 'render'
			).addCallback(() => this.getSECID())
		);
	},

	getSECID() {
		return getCookieValue('www.google.com', 'secid');
	},

	getDates(from, to) {
		let begin = from || new Date(),
			end = to || new Date(begin.getTime() + 86400000);

		return this.createDateString(begin) + '/' + this.createDateString(end);
	},

	// via Taberareloo 4.0.4's GoogleCalendar.createDateString()
	// https://github.com/taberareloo/taberareloo/blob/4.0.4/src/lib/models.js#L1618-1629
	createDateString(dateObj) {
		return [
			dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate()
		].map(date => {
			let numStr = String(date);

			if (numStr.length === 1) {
				numStr = '0' + numStr;
			}

			return numStr;
		}).join('');
	}
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
	name    : 'Delicious',
	ICON    : 'https://delicious.com/favicon.ico',
	ORIGIN  : 'https://delicious.com',
	API_URL : 'https://avosapi.delicious.com/api/v1/',

	check(ps) {
		if (/^(?:photo|quote|link|conversation|video)$/.test(ps.type)) {
			if (ps.file) {
				return ps.itemUrl;
			}

			return true;
		}
	},

	post(ps) {
		let info = this.getInfo();

		if (!info) {
			throw new Error(getMessage('error.notLoggedin'));
		}

		let that = this,
			retry = true;

		return (function addBookmark() {
			return request(that.API_URL + 'posts/addoredit', {
				responseType : 'json',
				queryString  : {
					description : ps.item,
					url         : ps.itemUrl,
					tags        : joinText(ps.tags),
					note        : joinText(
						[ps.body, ps.description],
						' ',
						true
					),
					private     : ps.private ? 'on' : '',
					replace     : 'true'
				}
			}).addCallback(({response : json}) => {
				let {error} = json;

				if (json.status === 'success' && !error) {
					return;
				}

				if (error) {
					if (retry) {
						retry = false;

						return that.updateSessionStatus(info).addCallback(
							addBookmark
						);
					}

					throw new Error(error);
				}

				throw new Error(getMessage('error.postingContentsIncorrect'));
			});
		}());
	},

	getInfo() {
		let {user} = getLocalStorage(this.ORIGIN);

		if (user) {
			let info = JSON.parse(user);

			if (info.isLoggedIn) {
				return info;
			}
		}
	},

	updateSessionStatus({username, password_hash}) {
		return request([
			this.API_URL + 'account/webloginhash',
			username,
			password_hash
		].join('/'), {
			responseType : 'json'
		}).addCallback(({response : json}) => json);
	},

	md5(str, charset) {
		let crypto = new CryptoHash(CryptoHash.MD5),
			data = new UnicodeConverter(charset).convertToByteArray(str, {});

		crypto.update(data, data.length);

		return crypto.finish(false).split('').map(char =>
			('0' + char.charCodeAt().toString(16)).slice(-2)
		).join('');
	},

	getCompose(url) {
		return request(this.API_URL + 'posts/compose', {
			responseType : 'json',
			queryString  : {url}
		}).addCallback(({response : json}) => json);
	},

	/**
	 * ユーザーの利用しているタグ一覧を取得する。
	 *
	 * @return {Array}
	 */
	getUserTags() {
		// 下記のAPIではプライベートなタグは取得できない
		// http://feeds.delicious.com/v2/json/tags/{username}
		return this.getInfo() ? request(this.API_URL + 'posts/you/tags', {
			responseType : 'json'
		}).addCallback(({response : json}) => {
			let {pkg} = json;

			if (!(pkg && pkg.num_tags)) {
				return [];
			}

			let {tags} = pkg;

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
	getPopularTags(url) {
		return request(this.API_URL + 'posts/md5/' + this.md5(url), {
			responseType : 'json'
		}).addCallback(({response : json}) => {
			let {pkg} = json;

			if (!pkg) {
				return [];
			}

			let [info] = pkg;

			return info ? info.tags : [];
		});
	},

	/**
	 * タグ、人気のタグ、おすすめタグ、ネットワークなどを取得する。
	 * ブックマーク済みでも取得できる。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions(url) {
		return new DeferredHash({
			tags    : this.getUserTags(),
			popular : this.getPopularTags(url),
			compose : this.getCompose(url)
		}).addCallback(ress => {
			let {pkg} = ress.compose[1],
				suggestions = {
					tags        : ress.tags[1],
					popular     : ress.popular[1],
					recommended : pkg ? pkg.suggested_tags : [],
					duplicated  : pkg ? pkg.previously_saved : false
				};

			if (suggestions.duplicated) {
				Object.assign(suggestions, {
					form     : {
						item        : pkg.previously_saved_title,
						tags        : pkg.previous_tags,
						description : pkg.previously_saved_note,
						private     : pkg.previously_saved_privacy
					},
					editPage : this.ORIGIN + '/save' + queryString({url}, true)
				});
			}

			return suggestions;
		});
	}
});


Models.register({
	name     : 'StumbleUpon',
	ICON     : 'https://www.stumbleupon.com/favicon.ico?_nospa=true',
	POST_URL : 'https://www.stumbleupon.com/submit?_nospa=true',

	check(ps) {
		if (/^(?:photo|quote|link|conversation|video)$/.test(ps.type)) {
			if (ps.file) {
				return ps.itemUrl;
			}

			return true;
		}
	},

	post(ps) {
		return request(this.POST_URL, {
			responseType : 'document'
		}).addCallback(({response : doc}) => {
			if (!doc.getElementById('submit-form')) {
				throw new Error(getMessage('error.notLoggedin'));
			}

			return request(this.POST_URL, {
				responseType : 'json',
				sendContent  : Object.assign(formContents(doc.body), {
					url         : ps.itemUrl,
					'user-tags' : joinText(ps.tags),
					review      : joinText([
						Twitter.createQuote((ps.body || '').trimTag()),
						ps.description
					], '\n\n'),
					language    : '',
					_output     : 'json'
				})
			});
		}).addCallback(({response : json}) => {
			if (!json._success) {
				throw new Error(json._reason[0].message);
			}
		});
	}
});


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
	name     : 'Remember The Milk',
	ICON     : 'https://www.rememberthemilk.com/favicon.ico',
	// via https://www.rememberthemilk.com/help/?ctx=quickadd.firefox
	POST_URL : 'https://www.rememberthemilk.com/services/ext/addtask.rtm',

	check(ps) {
		return /^(?:regular|link)$/.test(ps.type);
	},

	post(ps) {
		return this.addSimpleTask(
			joinText([ps.item, ps.body, ps.description], ' ', true),
			ps.date,
			ps.tags
		);
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
	addSimpleTask(task, due, tags, list) {
		return request(this.POST_URL, {
			responseType : 'document'
		}).addCallback(({response : doc}) => {
			let selectList = doc.getElementById('l');

			if (!selectList) {
				throw new Error(getMessage('error.notLoggedin'));
			}

			let form = formContents(doc.body);

			if (list) {
				for (let option of selectList.options) {
					if (option.textContent === list) {
						list = option.value;

						break;
					}
				}

				form.l = list;
			}

			return request(this.POST_URL, {
				responseType : 'document',
				sendContent  : Object.assign(form, {
					t  : task,
					d  : (due || new Date()).toString(),
					tx : joinText(tags)
				})
			});
		}).addCallback(({response : doc}) => {
			if (doc.getElementById('miniform')) {
				throw new Error(getMessage('error.postingContentsIncorrect'));
			}
		});
	}
});


Models.register({
	name    : 'Yahoo JMA',
	// via http://developer.yahoo.co.jp/webapi/jlp/ma/v1/parse.html
	API_URL : 'http://jlp.yahooapis.jp/MAService/V1/parse',
	APP_ID  : '16y9Ex6xg64GBDD.tmwF.WIdXURG0iTT25NUQ72RLF_Jzt2_MfXDDZfKehYkX6dPZqk-',

	parse(params) {
		return request(this.API_URL, {
			responseType : 'document',
			sendContent  : Object.assign({
				appid : this.APP_ID
			}, params)
		}).addCallback(({response : doc}) => doc);
	},

	getKanaReadings(str) {
		return this.parse({
			sentence : str,
			results  : 'ma',
			response : 'reading'
		}).addCallback(doc => {
			return Array.prototype.map.call(
				doc.querySelectorAll('reading'),
				reading => reading.textContent
			);
		});
	},

	getRomaReadings(str) {
		return this.getKanaReadings(str).addCallback(readings => {
			return this.kanaToRoma(readings.join('\u0000')).split('\u0000');
		});
	},

	// via https://github.com/shogo4405/KanaXS/blob/master/src/main/javascript/toKatakanaCase.js
	hiraganaToKatakana(str) {
		return String.fromCodePoint.apply(null, Array.from(str).map(char => {
			let codePoint = char.codePointAt();

			return (0x3041 <= codePoint && codePoint <= 0x3096) ?
				codePoint + 0x0060 :
				codePoint;
		}));
	},

	kanaToRoma(str) {
		let charStr = this.hiraganaToKatakana(str),
			len = charStr.length,
			res = '';

		for (let idx = 0, mora; idx < len; idx += mora.length) {
			mora = charStr.slice(idx, idx + 2);

			let roma = this.katakanaTable.get(mora);

			if (!roma) {
				mora = charStr.slice(idx, idx + 1);
				roma = this.katakanaTable.get(mora);

				if (!roma) {
					roma = mora;
				}
			}

			res += roma;
		}

		return res.replace(/ltu(.)/g, '$1$1');
	},

	katakanaTable : new Map([
		['ウァ', 'wha'], ['ウィ', 'wi'], ['ウェ', 'we'], ['ウォ', 'who'],
		['キャ', 'kya'], ['キィ', 'kyi'], ['キュ', 'kyu'], ['キェ', 'kye'],
		['キョ', 'kyo'], ['クャ', 'qya'], ['クュ', 'qyu'], ['クァ', 'qwa'],
		['クィ', 'qwi'], ['クゥ', 'qwu'], ['クェ', 'qwe'], ['クォ', 'qwo'],
		['ギャ', 'gya'], ['ギィ', 'gyi'], ['ギュ', 'gyu'], ['ギェ', 'gye'],
		['ギョ', 'gyo'], ['グァ', 'gwa'], ['グィ', 'gwi'], ['グゥ', 'gwu'],
		['グェ', 'gwe'], ['グォ', 'gwo'], ['シャ', 'sha'], ['シィ', 'syi'],
		['シュ', 'shu'], ['シェ', 'sye'], ['ショ', 'sho'], ['スァ', 'swa'],
		['スィ', 'swi'], ['スゥ', 'swu'], ['スェ', 'swe'], ['スォ', 'swo'],
		['ジャ', 'ja'], ['ジィ', 'jyi'], ['ジュ', 'ju'], ['ジェ', 'jye'],
		['ジョ', 'jo'], ['チャ', 'cha'], ['チィ', 'tyi'], ['チュ', 'chu'],
		['チェ', 'tye'], ['チョ', 'cho'], ['ツァ', 'tsa'], ['ツィ', 'tsi'],
		['ツェ', 'tse'], ['ツォ', 'tso'], ['テャ', 'tha'], ['ティ', 'thi'],
		['テュ', 'thu'], ['テェ', 'the'], ['テョ', 'tho'], ['トァ', 'twa'],
		['トィ', 'twi'], ['トゥ', 'twu'], ['トェ', 'twe'], ['トォ', 'two'],
		['ヂャ', 'dya'], ['ヂィ', 'dyi'], ['ヂュ', 'dyu'], ['ヂェ', 'dye'],
		['ヂョ', 'dyo'], ['デャ', 'dha'], ['ディ', 'dhi'], ['デュ', 'dhu'],
		['デェ', 'dhe'], ['デョ', 'dho'], ['ドァ', 'dwa'], ['ドィ', 'dwi'],
		['ドゥ', 'dwu'], ['ドェ', 'dwe'], ['ドォ', 'dwo'], ['ニャ', 'nya'],
		['ニィ', 'nyi'], ['ニュ', 'nyu'], ['ニェ', 'nye'], ['ニョ', 'nyo'],
		['ヒャ', 'hya'], ['ヒィ', 'hyi'], ['ヒュ', 'hyu'], ['ヒェ', 'hye'],
		['ヒョ', 'hyo'], ['フャ', 'fya'], ['フュ', 'fyu'], ['フョ', 'fyo'],
		['ファ', 'fa'], ['フィ', 'fi'], ['フゥ', 'fwu'], ['フェ', 'fe'],
		['フォ', 'fo'], ['ビャ', 'bya'], ['ビィ', 'byi'], ['ビュ', 'byu'],
		['ビェ', 'bye'], ['ビョ', 'byo'], ['ヴァ', 'va'], ['ヴィ', 'vi'],
		['ヴ', 'vu'], ['ヴェ', 've'], ['ヴォ', 'vo'], ['ヴャ', 'vya'],
		['ヴュ', 'vyu'], ['ヴョ', 'vyo'], ['ピャ', 'pya'], ['ピィ', 'pyi'],
		['ピュ', 'pyu'], ['ピェ', 'pye'], ['ピョ', 'pyo'], ['ミャ', 'mya'],
		['ミィ', 'myi'], ['ミュ', 'myu'], ['ミェ', 'mye'], ['ミョ', 'myo'],
		['リャ', 'rya'], ['リィ', 'ryi'], ['リュ', 'ryu'], ['リェ', 'rye'],
		['リョ', 'ryo'], ['ア', 'a'], ['イ', 'i'], ['ウ', 'u'], ['エ', 'e'],
		['オ', 'o'], ['カ', 'ka'], ['キ', 'ki'], ['ク', 'ku'], ['ケ', 'ke'],
		['コ', 'ko'], ['サ', 'sa'], ['シ', 'shi'], ['ス', 'su'], ['セ', 'se'],
		['ソ', 'so'], ['タ', 'ta'], ['チ', 'chi'], ['ツ', 'tsu'], ['テ', 'te'],
		['ト', 'to'], ['ナ', 'na'], ['ニ', 'ni'], ['ヌ', 'nu'], ['ネ', 'ne'],
		['ノ', 'no'], ['ハ', 'ha'], ['ヒ', 'hi'], ['フ', 'fu'], ['ヘ', 'he'],
		['ホ', 'ho'], ['マ', 'ma'], ['ミ', 'mi'], ['ム', 'mu'], ['メ', 'me'],
		['モ', 'mo'], ['ヤ', 'ya'], ['ユ', 'yu'], ['ヨ', 'yo'], ['ラ', 'ra'],
		['リ', 'ri'], ['ル', 'ru'], ['レ', 're'], ['ロ', 'ro'], ['ワ', 'wa'],
		['ヲ', 'wo'], ['ン', 'nn'], ['ガ', 'ga'], ['ギ', 'gi'], ['グ', 'gu'],
		['ゲ', 'ge'], ['ゴ', 'go'], ['ザ', 'za'], ['ジ', 'zi'], ['ズ', 'zu'],
		['ゼ', 'ze'], ['ゾ', 'zo'], ['ダ', 'da'], ['ヂ', 'di'], ['ヅ', 'du'],
		['デ', 'de'], ['ド', 'do'], ['バ', 'ba'], ['ビ', 'bi'], ['ブ', 'bu'],
		['ベ', 'be'], ['ボ', 'bo'], ['パ', 'pa'], ['ピ', 'pi'], ['プ', 'pu'],
		['ペ', 'pe'], ['ポ', 'po'], ['ァ', 'la'], ['ィ', 'li'], ['ゥ', 'lu'],
		['ェ', 'le'], ['ォ', 'lo'], ['ヵ', 'lka'], ['ヶ', 'lke'], ['ッ', 'ltu'],
		['ャ', 'lya'], ['ュ', 'lyu'], ['ョ', 'lyo'], ['ヮ', 'lwa'],
		['。', '.'], ['、', ', '], ['ー', '-']
	])
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
			}).addCallback(({response : json}) => {
				let {rks} = json;

				if (!rks) {
					throw new Error(getMessage('error.notLoggedin'));
				}

				return rks;
			});
		});
	},

	getAuthCookie() {
		return Hatena.getAuthCookie();
	}
}, AbstractSessionService));


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
	}
});


Models.register({
	name    : 'bit.ly',
	ICON    : 'chrome://tombfix/skin/favicon/bitly.png',
	// via http://dev.bitly.com/authentication.html
	API_URL : 'https://api-ssl.bitly.com/v3',
	// see https://bitly.com/a/your_api_key
	USER    : 'to',
	API_KEY : 'R_8d078b93e8213f98c239718ced551fad',

	shorten(url) {
		// via http://dev.bitly.com/links.html#v3_shorten
		return this.callMethod('shorten', {
			longUrl : url
		}).addCallback(json => {
			if (json.status_txt === 'OK') {
				return json.data.url;
			}
			if (json.status_txt === 'ALREADY_A_BITLY_LINK') {
				return url;
			}

			throw new Error(json.status_txt);
		});
	},

	callMethod(method, info) {
		return request(this.API_URL + '/' + method, {
			responseType : 'json',
			queryString  : Object.assign({
				// via http://dev.bitly.com/authentication.html#apikey
				login  : this.USER,
				apiKey : this.API_KEY,
				domain : this.name
			}, info)
		}).addCallback(({response : json}) => json);
	}
});


Models.register(Object.assign({}, Models['bit.ly'], {
	name : 'j.mp',
	ICON : 'https://j.mp/favicon.ico'
}));


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
