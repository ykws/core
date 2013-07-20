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
	 * ポストを削除する。
	 *
	 * @param {Number || String} id ポストID。
	 * @return {Deferred}
	 */
	remove : function(id){
		var self = this;
		return this.getToken().addCallback(function(token){
			return request(Tumblr.TUMBLR_URL+'delete', {
				redirectionLimit : 0,
				referrer    : Tumblr.TUMBLR_URL,
				sendContent : {
					id          : id,
					form_key    : token,
					redirect_to : 'dashboard',
				},
			});
		});
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
				if(form['post[type]']=='photo')
					form.image = $x('id("edit_post")//img[contains(@src, "media.tumblr.com/") or contains(@src, "data.tumblr.com/")]/@src', doc);
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
	
	openTab : function(ps){
		if(ps.type == 'reblog')
			return addTab(Tumblr.TUMBLR_URL + 'reblog/' + ps.token.id + '/' + ps.token.token +'?redirect_to='+encodeURIComponent(ps.pageUrl));
		
		var form = Tumblr[ps.type.capitalize()].convertToForm(ps);
		return addTab(Tumblr.TUMBLR_URL+'new/' + ps.type).addCallback(function(win){
			withDocument(win.document, function(){
				populateForm(currentDocument().getElementById('edit_post'), form);
				
				var setDisplay = function(id, style){
					currentDocument().getElementById(id).style.display = style;
				}
				switch(ps.type){
				case 'photo':
					setDisplay('photo_upload', 'none');
					setDisplay('photo_url', 'block');
					
					setDisplay('add_photo_link', 'none');
					setDisplay('photo_link', 'block');
					
					break;
				case 'link':
					setDisplay('add_link_description', 'none');
					setDisplay('link_description', 'block');
					break;
				}
			});
		});
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
	 * ログイン中のユーザーIDを取得する。
	 *
	 * @return {Deferred} ユーザーIDが返される。
	 */
	getCurrentId : function(){
		switch (this.updateSession()){
		case 'none':
			return succeed('');
			
		case 'same':
			if(this.id)
				return succeed(this.id);
			
		case 'changed':
			var self = this;
			return request(Tumblr.TUMBLR_URL+'customize').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return self.id = $x('id("edit_tumblelog_name")/@value', doc);
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
		opts = updatetree(opts, {
			headers : {
				'User-Agent' : 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0)'
			}
		});
	}
	
	return request_(url, opts);
};


var Wedata = {
	name : 'Wedata',
	URL : 'http://wedata.net',
	ICON : 'chrome://tombfix/skin/item.ico',
	API_KEY : '61d69503acff33a28b61c0495eeefd6fb8c919a9',
	
	request :function(path, method, data){
		var opts = {
			method : method,
		};
		data = data || {};
		
		if(!method){
			opts.queryString = data;
		} else {
			data.api_key = Wedata.API_KEY;
			opts.sendContent = data;
		}
		
		path = [Wedata.URL].concat(path);
		
		return request(path.join('/'), opts).addCallback(function(res){
			if(/(json|javascript)/.test(res.channel.contentType)){
				return evalInSandbox('(' + res.responseText + ')', Wedata.URL);
			} else {
				return res;
			}
		});
	},
};

Wedata.Database = function(name, data){
	this.name = name;
	
	update(this, data);
};

update(Wedata.Database.prototype, {
	save : function(){
		var self = this;
		var data = {};
		
		// これ以外のパラメーターを送るとエラーが発生する
		forEach('name description required_keys optional_keys permit_other_keys'.split(' '), function(key){
			data['database[' + key + ']'] = self[key];
		});
		
		if(self.resource_url){
			return Wedata.request(['databases', this.name], 'PUT', data).addCallback(function(){
				return self;
			});
		} else {
			return Wedata.request('databases', 'POST', data).addCallback(function(res){
				self.resource_url = res.channel.getResponseHeader('Location');
				
				return self;
			});
		}
	},
	
	remove : function(){
		return Wedata.request(['databases', this.name], 'DELETE');
	},
	
	getItems : function(){
		return Wedata.Item.findByDatabase(this.name);
	},
});

update(Wedata.Database, {
	findByName : function(name){
		return Wedata.request(['databases', name + '.json']).addCallback(function(db){
			return new Wedata.Database(null, db);
		});
	},
	
	findAll : function(){
		return Wedata.request('databases.json').addCallback(function(dbs){
			return dbs.map(function(db){
				return new Wedata.Database(null, db);
			});
		});
	},
});

Wedata.Item = function(db, name, info){
	// Wedataから取得したデータか?
	if(typeof(info.data)=='object' && info.resource_url){
		info.database = db;
	} else {
		info = {
			name : name,
			database : db,
			data : info,
		};
	}
	
	update(this, info.data);
	
	this.getMetaInfo = function(){
		return info;
	}
};

update(Wedata.Item.prototype, {
	save : function(){
		var self = this;
		var info = this.getMetaInfo();
		var db = info.database;
		var data = {
			name : info.name,
		};
		
		for(var key in this){
			var value = this[key];
			if(typeof(value)=='function')
				continue;
			
			data['data[' + key + ']'] = value;
		}
		
		if(info.resource_url){
			var id = info.resource_url.split('/').pop();
			return Wedata.request(['items', id], 'PUT', data).addCallback(function(){
				return self;
			});
		} else {
			return Wedata.request(['databases', db, 'items'], 'POST', data).addCallback(function(res){
				self.getMetaInfo().resource_url = res.channel.getResponseHeader('Location');
				
				return self;
			});
		}
	},
	
	remove : function(){
		var id = this.getMetaInfo().resource_url.split('/').pop();
		
		return Wedata.request(['items', id], 'DELETE');
	},
});

update(Wedata.Item, {
	findByDatabase : function(db){
		return this.findByDatabaseAndKeyword(db);
	},
	
	findByDatabaseAndKeyword : function(db, word){
		return Wedata.request(['databases', db, 'items.json'], null, {
			query : word,
		}).addCallback(function(items){
			return items.map(function(item){
				return new Wedata.Item(db, item.name, item);
			});
		});
	},
});

Models.register(Wedata);


Models.register({
	name : 'FriendFeed',
	ICON : 'http://friendfeed.com/favicon.ico',
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	getAuthCookie : function(){
		return getCookieString('friendfeed.com', 'U');
	},
	
	getToken : function(){
		return getCookieString('friendfeed.com', 'AT').split('=').pop();
	},
	
	post : function(ps){
		if(!this.getAuthCookie())
			throw new Error(getMessage('error.notLoggedin'));
		
		var self = this;
		return request('https://friendfeed.com/a/bookmarklet', {
			redirectionLimit : 0,
			sendContent : {
				at      : self.getToken(),
				link    : ps.pageUrl,
				title   : ps.page,
				image0  : ps.type == 'photo'? ps.itemUrl : '',
				comment : joinText([ps.body, ps.description], ' ', true),
			},
		});
	},
});


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
// http://www.flickr.com/services/api/
Models.register(update({
	name : 'Flickr',
	ICON : 'http://www.flickr.com/favicon.ico',
	API_KEY : 'ecf21e55123e4b31afa8dd344def5cc5',
	API_REST_URL: 'http://flickr.com/services/rest/',
	API_UPLOAD_URL: 'http://up.flickr.com/services/upload/',
	
	check : function(ps){
		return ps.type == 'photo';
	},
	
	post : function(ps){
		return (ps.file? succeed(ps.file) : download(ps.itemUrl, getTempFile())).addCallback(function(file){
			return Models.Flickr.upload({
				photo       : file,
				title       : ps.item || ps.page || '',
				description : ps.description || '',
				is_public   : ps.private? 0 : 1,
				tags        : joinText(ps.tags, ' '),
			});
		});
	},
	
	favor : function(ps){
		return this.addFavorite(ps.favorite.id);
	},
	
	callMethod : function(ps){
		return request(this.API_REST_URL, {
			queryString : update({
				api_key        : this.API_KEY,
				nojsoncallback : 1,
				format         : 'json',
			}, ps),
		}).addCallback(function(res){
			var json = JSON.parse(res.responseText);
			if(json.stat!='ok')
				throw json.message;
			return json;
		});
	},
	
	callAuthMethod : function(ps){
		var that = this;
		return this.getToken().addCallback(function(page){
			if(ps.method=='flickr.photos.upload')
				delete ps.method;
			
			update(ps, page.token);
			ps.cb = new Date().getTime(),
			ps.api_sig = (page.secret + keys(ps).sort().filter(function(key){
				// ファイルを取り除く
				return typeof(ps[key])!='object';
			}).map(function(key){
				return key + ps[key]
			}).join('')).md5();
			
			return request(ps.method? that.API_REST_URL : that.API_UPLOAD_URL, {
				sendContent : ps,
			});
		}).addCallback(function(res){
			res = convertToDOM(res.responseText);
			if(res.querySelector('[stat]').getAttribute('stat')!='ok'){
				var errElem = res.querySelector('err');
				var err = new Error(errElem.getAttribute('msg'))
				err.code = errElem.getAttribute('code');
				
				throw err;
			}
			return res;
		});
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
			return request('http://flickr.com/').addCallback(function(res){
				var html = res.responseText;
				return self.token = {
					secret : html.extract(/"secret"[ :]+"(.*?)"/),
					token  : {
						api_key    : html.extract(/"api_key"[ :]+"(.*?)"/),
						auth_hash  : html.extract(/"auth_hash"[ :]+"(.*?)"/),
						auth_token : html.extract(/"auth_token"[ :]+"(.*?)"/),
					},
				};
			});
		}
	},
	
	addFavorite : function(id){
		return this.callAuthMethod({
			method   : 'flickr.favorites.add',
			photo_id : id,
		}).addErrback(function(err){
			switch(err.message){
			case 'Photo is already in favorites': // code = 3
				return;
			}
			
			throw err;
		});
	},
	
	removeFavorite : function(id){
		return this.callAuthMethod({
			method   : 'flickr.favorites.remove',
			photo_id : id,
		});
	},
	
	getSizes : function(id){
		return this.callMethod({
			method   : 'flickr.photos.getSizes',
			photo_id : id,
		}).addCallback(function(res){
			return res.sizes.size;
		});
	},
	
	getInfo : function(id){
		return this.callMethod({
			method   : 'flickr.photos.getInfo',
			photo_id : id,
		}).addCallback(function(res){
			return res.photo;
		});
	},
	
	// photo
	// title (optional)
	// description (optional)
	// tags (optional)
	// is_public, is_friend, is_family (optional)
	// safety_level (optional)
	// content_type (optional)
	// hidden (optional)
	upload : function(ps){
		return this.callAuthMethod(update({
			method   : 'flickr.photos.upload',
		}, ps)).addCallback(function(res){
			return getTextContent(res.querySelector('photoid'));
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('flickr.com', 'cookie_accid');
	},
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
	name     : 'Twitpic',
	ICON     : 'http://twitpic.com/images/favicon.ico',
	POST_URL : 'http://twitpic.com/upload',
	
	check : function(ps){
		return ps.type=='photo';
	},
	
	post : function(ps){
		var self = this;
		return ((ps.file)? 
			succeed(ps.file) : 
			download(ps.itemUrl, getTempFile(createURI(ps.itemUrl).fileExtension))
		).addCallback(function(file){
			return self.upload({
				media      : file,
				message    : ps.description,
				post_photo : 1, // Twitterへクロスポスト
			});
		});
	},
	
	upload : function(ps){
		var self = this;
		return this.getToken().addCallback(function(token){
			return request(self.POST_URL + '/process', {
				sendContent : update(token, ps),
			});
		});
	},
	
	getToken : function(){
		var self = this;
		return request(self.POST_URL).addCallback(function(res){
			// 未ログインの場合トップにリダイレクトされる(クッキー判別より安全と判断)
			if(res.channel.URI.asciiSpec != self.POST_URL)
				throw new Error(getMessage('error.notLoggedin'));
			
			var doc = convertToHTMLDocument(res.responseText);
			return {
				form_auth : $x('//input[@name="form_auth"]/@value', doc)
			};
		});
	},
});


Models.register({
	name : 'WeHeartIt',
	ICON : 'http://weheartit.com/favicon.ico',
	URL  : 'http://weheartit.com/',
	
	check : function(ps){
		return ps.type == 'photo' && !ps.file;
	},
	
	post : function(ps){
		if(!this.getAuthCookie())
			return fail(new Error(getMessage('error.notLoggedin')));
		
		return request(this.URL + 'add.php', {
			redirectionLimit : 0,
			referrer : ps.pageUrl,
			queryString : {
				via   : ps.pageUrl,
				title : ps.item,
				img   : ps.itemUrl,
			},
		});
	},
	
	favor : function(ps){
		return this.iHeartIt(ps.favorite.id);
	},
	
	iHeartIt : function(id){
		if(!this.getAuthCookie())
			return fail(new Error(getMessage('error.notLoggedin')));
		
		return request(this.URL + 'inc_heartedby.php', {
			redirectionLimit : 0,
			referrer : this.URL,
			queryString : {
				do    : 'heart',
				entry : id,
			},
		});
	},
	
	getAuthCookie : function(){
		// クッキーの動作が不安定なため2つをチェックし真偽値を返す
		return getCookieString('weheartit.com', 'password') && getCookieString('weheartit.com', 'name');
	},
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
	name : 'Gyazo',
	ICON : 'http://gyazo.com/public/img/favicon.ico',
	
	check : function(ps){
		return ps.type=='photo' && ps.file;
	},
	
	getId : function(){
		var id = getPref('model.gyazo.id');
		if(!id){
			with(new Date()){
				id = getFullYear() + [getMonth()+1, getDate(), getHours(), getMinutes(), getSeconds()].map(function(n){
					return (''+n).pad(2, '0');
				}).join('');
			}
			setPref('model.gyazo.id', id);
		}
		return id;
	},
	
	post : function(ps){
		return request('http://gyazo.com/upload.cgi', {
			sendContent : {
				id        : this.getId(),
				imagedata : ps.file,
			},
		}).addCallback(function(res){
			addTab(res.responseText);
		});
	},
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


Models.register({
	name : 'Twitter',
	ICON : 'http://twitter.com/favicon.ico',
	URL  : 'https://twitter.com',
	SHORTEN_SERVICE : 'bit.ly',
	
	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return this.update(joinText([ps.description, (ps.body)? '"' + ps.body + '"' : '', ps.item, ps.itemUrl], ' '));
	},
	
	update : function(status){
		var self = this;
		var POST_URL = self.URL + '/i/tweet/create';
		
		return maybeDeferred((status.length < 140)? 
			status : 
			shortenUrls(status, Models[this.SHORTEN_SERVICE])
		).addCallback(function(shortend){
			status = shortend;
			
			return Twitter.getToken();
		}).addCallback(function(token){
			token.status = status;
			
			return request(POST_URL, {
				sendContent : token,
			});
		}).addErrback(function(res){
			throw new Error(JSON.parse(res.message.responseText).message);
		}).addCallback(function(res){
			return JSON.parse(res.responseText);
		});
	},
	
	favor : function(ps){
		return this.addFavorite(ps.favorite.id);
	},
	
	getToken : function(){
		return request(this.URL + '/account/settings').addCallback(function(res){
			var html = res.responseText;
			if(~html.indexOf('class="signin"'))
				throw new Error(getMessage('error.notLoggedin'));
			
			return {
				authenticity_token : html.extract(/authenticity_token.+value="(.+?)"/),
				siv                : html.extract(/logout\?siv=(.+?)"/),
			}
		});
	},
	
	changePicture : function(url){
		var self = this;
		return ((url instanceof IFile)? succeed(url) : download(url, getTempDir())).addCallback(function(file){
			return request(self.URL + '/account/settings').addCallback(function(res){
				var form = convertToHTMLDocument(res.responseText).getElementById('account_settings_form');
				var ps = formContents(form);
				var endpoint = self.URL + '/settings/profile';
				return request(endpoint, {
					referrer : endpoint,
					sendContent : update(ps, {
						'profile_image[uploaded_data]' : file,
					}),
				});
			});
		});
	},
	
	remove : function(id){
		var self = this;
		return Twitter.getToken().addCallback(function(ps){
			ps._method = 'delete';
			return request(self.URL + '/status/destroy/' + id, {
				redirectionLimit : 0,
				referrer : self.URL + '/',
				sendContent : ps,
			});
		});
	},
	
	addFavorite : function(id){
		var self = this;
		return Twitter.getToken().addCallback(function(ps){
			return request(self.URL + '/favourings/create/' + id, {
				redirectionLimit : 0,
				referrer : self.URL + '/',
				sendContent : ps,
			});
		});
	},
	
	getRecipients : function(){
		var self = this;
		return request(this.URL + '/direct_messages/recipients_list?twttr=true').addCallback(function(res){
			return map(function([id, name]){
				return {id:id, name:name};
			}, evalInSandbox('(' + res.responseText + ')', self.URL));
		});
	},
});


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


// copied from http://userscripts.org/scripts/show/19741
Models.register({
	name : 'GoogleWebHistory',
	ICON : Models.Google.ICON,
	
	getCh : function(url){
		function r(x,y){
			return Math.floor((x/y-Math.floor(x/y))*y+.1);
		}
		function m(c){
			var i,j,s=[13,8,13,12,16,5,3,10,15];
			for(i=0;i<9;i+=1){
				j=c[r(i+2,3)];
				c[r(i,3)]=(c[r(i,3)]-c[r(i+1,3)]-j)^(r(i,3)==1?j<<s[i]:j>>>s[i]);
			}
		}
		
		return (this.getCh = function(url){
			url='info:'+url;
			
			var c = [0x9E3779B9,0x9E3779B9,0xE6359A60],i,j,k=0,l,f=Math.floor;
			for(l=url.length ; l>=12 ; l-=12){
				for(i=0 ; i<16 ; i+=1){
					j=k+i;c[f(i/4)]+=url.charCodeAt(j)<<(r(j,4)*8);
				}
				m(c);
				k+=12;
			}
			c[2]+=url.length;
			
			for(i=l;i>0;i--)
				c[f((i-1)/4)]+=url.charCodeAt(k+i-1)<<(r(i-1,4)+(i>8?1:0))*8;
			m(c);
			
			return'6'+c[2];
		})(url);
	},
	
	post : function(url){
		return request('http://www.google.com/search?client=navclient-auto&ch=' + GoogleWebHistory.getCh(url) + '&features=Rank&q=info:' + escape(url));
	},
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
	name : 'Dropmark',
	ICON : 'http://dropmark.com/favicon.ico',
	URL  : 'http://dropmark.com/',
	
	check : function(ps){
		return (/(regular|photo|quote|link)/).test(ps.type) && !ps.file;
	},
	
	converters: {
		regular : function(ps){
			return {
				content_type : 'text',
				name         : ps.item,
				content_text : ps.description,
			}
		},
		
		quote : function(ps){
			return {
				content_type : 'text', 
				name         : ps.item + ps.pageUrl.wrap(' (', ')'),
				content_text : joinText([ps.body.wrap('"'), ps.description], '\n', true),
			}
		},
		
		photo : function(ps){
			return {
				type    : 'image', 
				name    : ps.item + ps.pageUrl.wrap(' (', ')'),
				content : ps.itemUrl,
			}
		},
		
		link : function(ps){
			return {
				type    : 'link', 
				name    : ps.page,
				content : ps.pageUrl,
			}
		},
	},
	
	post : function(ps){
		return Dropmark.getPostPage().addCallback(function(url){
			return request(url + '/items', {
				redirectionLimit : 0,
				sendContent      : update(Dropmark.converters[ps.type](ps), {
					csrf_token : Dropmark.getToken(createURI(url).host),
					ajax       : true,
				}),
			});
		});
	},
	
	getToken : function(host){
		// ホストによりトークンが異なる
		return getCookieValue(host, 'csrf_token');
	},
	
	getPostPage : function(){
		return Dropmark.getLastViewedPage();
	},
	
	getLastViewedPage : function(){
		return getFinalUrl('http://app.dropmark.com/');
	},
	
	getLastViewedId : function(){
		return getCookieValue('dropmark.com', 'last_viewed');
	},
});


Models.register({
	name     : 'Evernote',
	ICON     : 'http://www.evernote.com/favicon.ico',
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
	API_URL : 'https://avosapi.delicious.com/api/v1/',

	check : function(ps){
		return /^(?:photo|quote|link|conversation|video)$/.test(ps.type) && !ps.file;
	},

	post : function(ps){
		var that = this, retry = true;

		return this.getInfo().addCallback(function AddBookmark(user) {
			return request(that.API_URL + 'posts/addoredit', {
				queryString : {
					description : ps.item,
					url         : ps.itemUrl,
					note        : joinText([ps.body, ps.description], ' ', true),
					tags        : joinText(ps.tags),
					private     : ps.private,
					replace     : true
				}
			}).addCallback(function(res){
				var info = JSON.parse(res.responseText);

				if (info.error) {
					if (retry) {
						retry = false;
						return that.updateSession(user).addCallback(AddBookmark);
					}

					throw new Error(info.error);
				}
			});
		});
	},

	getInfo : function(){
		return getLocalStorageValue('delicious.com', 'user').addCallback(function(user){
			if(!user || !user.isLoggedIn) {
				throw new Error(getMessage('error.notLoggedin'));
			}

			return user;
		});
	},

	updateSession : function(user){
		var {username, password_hash} = user;

		return request(
			this.API_URL + 'account/webloginhash/' + username + '/' + password_hash
		).addCallback(function(res){
			return JSON.parse(res.responseText);
		});
	},

	/**
	 * ユーザーの利用しているタグ一覧を取得する。
	 *
	 * @return {Array}
	 */
	getUserTags : function(){
		return Delicious.getInfo().addCallback(function(user){
			return request('http://feeds.delicious.com/v2/json/tags/' + user.username);
		}).addCallback(function(res){
			var tags = JSON.parse(res.responseText);

			// タグが無いか?(取得失敗時も発生)
			if (!tags || isEmpty(tags)) {
				return [];
			}

			return reduce(function(memo, tag){
				memo.push({
					name      : tag[0],
					frequency : tag[1]
				});
				return memo;
			}, tags, []);
		}).addErrback(function(err){
			// Delicious移管によりfeedが停止されタグの取得に失敗する
			// 再開時に動作するように接続を試行し、失敗したら空にしてエラーを回避する
			error(err);

			return [];
		});
	},

	/**
	 * タグ、おすすめタグ、ネットワークなどを取得する。
	 * ブックマーク済みでも取得できる。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function(url){
		var that = this;

		return new DeferredHash({
			tags : this.getUserTags(),
			suggestions : this.getInfo().addCallback(function(){
				// フォームを開いた時点でブックマークを追加し過去のデータを修正可能にするか?
				// 過去データが存在すると、お勧めタグは取得できない
				// (現時点で保存済みか否かを確認する手段がない)
				return request(that.API_URL + 'posts/compose', {
					queryString : { url : url }
				});
			}).addCallback(function(res){
				var {pkg} = JSON.parse(res.responseText);
				return {
					editPage : 'https://delicious.com/save?url=' + url,
					form : {
						item        : pkg.suggested_title,
						description : pkg.note,
						tags        : pkg.suggested_tags/*,
						private     : null*/
					},

					duplicated : pkg.previously_saved,
					recommended : pkg.suggested_tags
				}
			})
		}).addCallback(function(ress){
			var res = ress.suggestions[1];
			res.tags = ress.tags[1];
			return res;
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
	ICON : 'http://getpocket.com/favicon.ico',
	check : function(ps){
		return /quote|link/.test(ps.type);
	},
	post : function(ps){
		return request('http://getpocket.com/edit.php').addCallback(function(res) {
			var doc = convertToHTMLDocument(res.responseText);
			var form = $x('id("content")/form', doc);
			if(/login/.test(form.action))
				throw new Error(getMessage('error.notLoggedin'));
			
			return request('http://getpocket.com/edit_process.php', {
				queryString : {
					BL : 1
				},
				sendContent : update(formContents(form), {
					tags  : ps.tags? ps.tags.join(',') : '',
					title : ps.item,
					url   : ps.itemUrl
				})
			});
		});
	}
});


Models.register(update({
	name : 'Instapaper',
	ICON : 'chrome://tombfix/skin/favicon/instapaper.png',
	POST_URL: 'http://www.instapaper.com/edit',
	check : function(ps){
		return (/(quote|link)/).test(ps.type);
	},
	
	getAuthCookie : function(){
		return getCookieString('www.instapaper.com', 'pfu');
	},
	
	post : function(ps){
		var url = this.POST_URL;
		return this.getSessionValue('token', function(){
			return request(url).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return $x('//input[@id="form_key"]/@value', doc);
			});
		}).addCallback(function(token){
			return request(url, {
				redirectionLimit: 0,
				sendContent: {
					'form_key': token,
					'bookmark[url]': ps.itemUrl,
					'bookmark[title]': ps.item,
					'bookmark[selection]': joinText([ps.body, ps.description])
				}
			});
		});
	}
}, AbstractSessionService));


Models.register({
	name : 'Readability',
	ICON : 'chrome://tombfix/skin/favicon/readability.png',
	URL  : 'http://www.readability.com/',
	
	check : function(ps){
		return ps.type == 'link';
	},
	
	post : function(ps){
		return Readability.queue(ps.itemUrl);
	},
	
	getToken : function(){
		return request(Readability.URL + 'extension/ajax/sync').addCallback(function(res){
			res = JSON.parse(res.responseText);
			
			if(!res.success)
				throw new Error(getMessage('error.notLoggedin'));
			
			return res.readabilityToken;
		});
	},
	
	queue : function(url, read){
		return Readability.getToken().addCallback(function(token){
			return request(Readability.URL + 'articles/queue', {
				redirectionLimit : 0,
				sendContent : {
					token : token,
					url   : url,
					
					read  : read? 1 : 0,
				}
			});
		});
	},
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


// http://www.kawa.net/works/ajax/romanize/japanese.html
Models.register({
	name : 'Kawa',
	
	getRomaReadings : function(text){
		return request('http://www.kawa.net/works/ajax/romanize/romanize.cgi', {
			queryString : {
				// mecab-utf8
				// japanese
				// kana
				mode : 'japanese',
				q : text,
			},
		}).addCallback(function(res){
			return map(function(s){
				return s.getAttribute('title') || s.textContent;
			}, convertToDOM(res.responseText).querySelectorAll('li > span'));
		});
	},
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


Models.register({
	name : 'YahooBookmarks',
	ICON : 'http://bookmarks.yahoo.co.jp/favicon.ico',
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return request('http://bookmarks.yahoo.co.jp/action/post').addCallback(function(res){
			if(res.responseText.indexOf('login_form')!=-1)
				throw new Error(getMessage('error.notLoggedin'));
			
			return formContents($x('(id("addbookmark")//form)[1]', convertToHTMLDocument(res.responseText)));
		}).addCallback(function(fs){
			return request('http://bookmarks.yahoo.co.jp/action/post/done', {
				redirectionLimit : 0,
				sendContent  : {
					title      : ps.item,
					url        : ps.itemUrl,
					desc       : joinText([ps.body, ps.description], ' ', true),
					tags       : joinText(ps.tags, ' '),
					crumbs     : fs.crumbs,
					visibility : ps.private==null? fs.visibility : (ps.private? 0 : 1),
				},
			});
		});
	},
	
	/**
	 * タグ、おすすめタグを取得する。
	 * ブックマーク済みでも取得することができる。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function(url){
		return request('http://bookmarks.yahoo.co.jp/bookmarklet/showpopup', {
			queryString : {
				u : url,
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			if(!$x('id("bmtsave")', doc))
				throw new Error(getMessage('error.notLoggedin'));
			
			function getTags(part){
				return evalInSandbox(unescapeHTML(res.responseText.extract(RegExp('^' + part + ' ?= ?(.+)(;|$)', 'm'))), 'http://bookmarks.yahoo.co.jp/') || [];
			}
			
			return {
				duplicated : !!$x('//input[@name="docid"]', doc),
				popular : getTags('rectags'),
				tags : getTags('yourtags').map(function(tag){
					return {
						name      : tag,
						frequency : -1,
					}
				}),
			};
		});
	},
});


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
	name : 'Hatena',
	ICON : 'http://www.hatena.ne.jp/favicon.ico',
	
	getPasswords : function(){
		return getPasswords('https://www.hatena.ne.jp');
	},
	
	login : function(user, password){
		var self = this;
		notify(self.name, getMessage('message.changeAccount.logout'), self.ICON);
		return (this.getAuthCookie()? this.logout() : succeed()).addCallback(function(){
			notify(self.name, getMessage('message.changeAccount.login'), self.ICON);
			return request('https://www.hatena.ne.jp/login', {
				sendContent : {
					name : user,
					password : password,
					persistent : 1,
					location : 'http://www.hatena.ne.jp/',
				},
			});
		}).addCallback(function(){
			self.updateSession();
			self.user = user;
			delete self.userInfo;
			notify(self.name, getMessage('message.changeAccount.done'), self.ICON);
		});
	},
	
	logout : function(){
		return request('http://www.hatena.ne.jp/logout');
	},
	
	getAuthCookie : function(){
		return getCookieString('.hatena.ne.jp', 'rk');
	},
	
	getToken : function(){
		return this.getUserInfo().addCallback(itemgetter('rks'));
	},
	
	getCurrentUser : function(){
		return this.getUserInfo().addCallback(itemgetter('name'));
	},
	
	getUserInfo : function(){
		return this.getSessionValue('userInfo', function(){
			return request('http://b.hatena.ne.jp/my.name').addCallback(function(res){
				return JSON.parse(res.responseText);
			});
		});
	},
	
	reprTags: function (tags) {
		return tags ? tags.map(function(t){
			return '[' + t + ']';
		}).join('') : '' ;
	},
}, AbstractSessionService));


Models.register({
	name : 'HatenaFotolife',
	ICON : 'http://f.hatena.ne.jp/favicon.ico',
	
	check : function(ps){
		return ps.type=='photo';
	},
	
	post : function(ps){
		// 拡張子を指定しないとアップロードに失敗する(エラーは起きない)
		return (ps.file? succeed(ps.file) : download(ps.itemUrl, getTempFile(createURI(ps.itemUrl).fileExtension))).addCallback(function(file){
			return Models.HatenaFotolife.upload({
				fototitle1 : ps.item || ps.page,
				image1     : file,
			});
		});
	},
	
	// image1 - image5
	// fototitle1 - fototitle5 (optional)
	upload : function(ps){
		return Hatena.getToken().addCallback(function(token){
			ps.rkm = token;
			
			return Hatena.getCurrentUser();
		}).addCallback(function(user){
			return request('http://f.hatena.ne.jp/'+user+'/up', {
				sendContent : update({
					mode : 'enter',
				}, ps),
			});
		});
	},
});


Models.register(update({
	name : 'HatenaBookmark',
	ICON : 'chrome://tombfix/skin/favicon/hatenabookmark.png',
	POST_URL : 'http://b.hatena.ne.jp/add',
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		// タイトルは共有されているため送信しない
		return this.addBookmark(ps.itemUrl, null, ps.tags, joinText([ps.body, ps.description], ' ', true));
	},
	
	getEntry : function(url){
		var self = this;
		return request('http://b.hatena.ne.jp/my.entry', {
			queryString : {
				url : url
			}
		}).addCallback(function(res){
			return JSON.parse(res.responseText);
		});
	},
	
	getUserTags : function(user){
		return request('http://b.hatena.ne.jp/' + user + '/tags.json').addCallback(function(res){
			var tags = JSON.parse(res.responseText)['tags'];
			return items(tags).map(function(pair){
				return {
					name      : pair[0],
					frequency : pair[1].count
				}
			});
		});
	},
	
	addBookmark : function(url, title, tags, description){
		return Hatena.getToken().addCallback(function(token){
			return request('http://b.hatena.ne.jp/bookmarklet.edit', {
				redirectionLimit : 0,
				sendContent : {
					rks     : token,
					url     : url.replace(/%[0-9a-f]{2}/g, function(s){
						return s.toUpperCase();
					}),
					title   : title, 
					comment : Hatena.reprTags(tags) + description.replace(/[\n\r]+/g, ' '),
				},
			});
		});
	},
	
	/**
	 * タグ、おすすめタグ、キーワードを取得する
	 * ページURLが空の場合、タグだけが返される。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function(url){
		var self = this;
		return Hatena.getCurrentUser().addCallback(function(user){
			return new DeferredHash({
				tags : self.getUserTags(user),
				entry : self.getEntry(url),
			});
		}).addCallback(function(ress){
			var entry = ress.entry[1];
			var tags = ress.tags[1];
			
			var duplicated = !!entry.bookmarked_data;
			var endpoint = HatenaBookmark.POST_URL + '?' + queryString({
				mode : 'confirm',
				url  : url,
			});
			var form = {item : entry.title};
			if(duplicated){
				form = update(form, {
					description : entry.bookmarked_data.comment,
					tags        : entry.bookmarked_data.tags,
					private     : entry.bookmarked_data.private,
				});
			}
			
			return {
				form        : form,
				editPage    : endpoint,
				tags        : tags,
				duplicated  : duplicated,
				recommended : entry.recommend_tags,
			}
		});
	},
}, AbstractSessionService));


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


Models.register({
	name : 'HatenaStar',
	ICON : 'http://s.hatena.ne.jp/favicon.ico',
	
	getToken : function(){
		return request('http://s.hatena.ne.jp/entries.json').addCallback(function(res){
			if(!res.responseText.match(/"rks":"(.*?)"/))
				throw new Error(getMessage('error.notLoggedin'));
			return RegExp.$1;
		})
	},
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return HatenaStar.getToken().addCallback(function(token){
			return request('http://s.hatena.ne.jp/star.add.json', {
				redirectionLimit : 0,
				queryString : {
					rks      : token,
					title    : ps.item,
					quote    : joinText([ps.body, ps.description], ' ', true),
					location : ps.pageUrl,
					uri      : ps.itemUrl,
				},
			});
		});
	},
	
	remove : function(ps){
		return HatenaStar.getToken().addCallback(function(token){
			return request('http://s.hatena.ne.jp/star.delete.json', {
				redirectionLimit : 0,
				queryString : {
					rks   : token,
					uri   : ps.itemUrl,
					quote : joinText([ps.body, ps.description], ' ', true),
				},
			});
		});
	},
});


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
				throw new Error(getMessage('error.alreadyExsits'));
			
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
	name : 'TextConversionServices',
	DATABASE_NAME : 'Text Conversion Services',
	
	actions : {
		replace : function(original, str) {
			return str;
		},
		prepend : function(original, str) {
			return [str, original].join(' ');
		},
		append : function(original, str) {
			return [original, str].join(' ');
		}
	},
	
	charsets : {
		sjis : 'Shift_JIS',
		euc  : 'EUC-JP',
		jis  : 'iso-2022-jp',
		utf8 : 'utf-8',
	},
	
	getServices : function(){
		if(this.services)
			return succeed(this.services);
		
		var self = this;
		return Wedata.Item.findByDatabase(this.DATABASE_NAME).addCallback(function(services){
			return self.services = services;
		});
	},
	
	getService : function(name){
		return this.getServices().addCallback(function(services){
			return ifilter(function(service){
				return service.getMetaInfo().name == name;
			}, services).next();
		});
	},
	
	convert : function(str, name){
		var service;
		var self = this;
		
		return this.getService(name).addCallback(function(res){
			var strForRequest;
			
			service = res;
			
			charset = self.charsets[service.charset];
			if(charset != 'utf-8'){
				strForRequest = escape(str.convertFromUnicode(charset));
			} else {
				strForRequest = encodeURIComponent(str);
			}
			
			return request(service.url.replace(/%s/, strForRequest), {
				charset : charset,
			});
		}).addCallback(function(res){
			res = res.responseText;
			
			if(service.xpath){
				var doc = convertToHTMLDocument(res);
				res = $x(service.xpath, doc);
				res = (res.textContent || res).replace(/\n+/g, '');
			}
			
			return self.actions[service.action || 'replace'](str, res);
		});
	},
});


Models.register({
	name : 'Sharebee.com',
	URL  : 'http://sharebee.com/',
	
	decrypt : function(url){
		return request(url.startsWith(this.URL)? url : this.URL + url).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return {
				fileName : $x('//h2/span[@title]/@title', doc),
				links    : $x('//table[@class="links"]//a/@href', doc, true),
			}
		});
	},
});


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


Models.register({
	name : 'Soundcloud',
	URL  : 'http://soundcloud.com/',
	ICON : 'http://soundcloud.com/favicon.ico',
	
	normalizeTrackUrl : function(url){
		if(!url)
			return;
		
		url = createURI(url);
		url = url.prePath + url.filePath;
		
		return url.replace(/(\/download|\/)+$/g, '');
	},
	
	getPageInfo : function(url){
		var self = this;
		url = this.normalizeTrackUrl(url);
		
		return request(url).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var tokens = url.split('/');
			var track = tokens.pop();
			var user = tokens.pop();
			
			var info = {user:user, track:track};
			['uid', 'token', 'waveformUrl', 'streamUrl'].forEach(function(prop){
				// Unicodeエスケープを戻す
				var value = res.responseText.extract('"' + prop + '":"(.+?)"');
				info[prop] = evalInSandbox('"' + value + '"', self.URL);
			});
			
			info.download = !!$x('//a[contains(@class, "download")]', doc);
			info.type = (info.download)? $x('//span[contains(@class, "file-type")]/text()', doc) || 'mp3' : 'mp3';
			
			info.title = $x('//div[contains(@class, "info-header")]//h1', doc).textContent.replace(/[\n\r\t]/g, '');
			
			return info;
		});
	},
	
	download : function(url, file){
		var self = this;
		url = this.normalizeTrackUrl(url);
		
		return this.getPageInfo(url).addCallback(function(info){
			if(!file){
				file = getDownloadDir();
				file.append(self.name);
				file.append(info.user);
				createDir(file);
				
				file.append(validateFileName(
					info.title + 
					((info.download)? '' : ' (STREAM)') + 
					'.' + info.type));
			}
			
			return download(info.download? url + '/download' : info.streamUrl, file, true);
		});
	},
});


Models.register(update({}, AbstractSessionService, {
	name : 'NDrive',
	ICON : 'http://ndrive.naver.jp/favicon.ico',
	
	check : function(ps){
		return (/(photo|link)/).test(ps.type);
	},
	
	post : function(ps){
		var self = this;
		return (ps.file? succeed(ps.file) : download(ps.itemUrl, getTempDir())).addCallback(function(file){
			return self.upload(file, null, ps.item + '.' + createURI(file).fileExtension);
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('ndrive1.naver.jp', 'njid_inf');
	},
	
	getUserInfo : function(){
		return request('http://ndrive.naver.jp/').addCallback(function(res){
			function getString(name){
				return res.responseText.extract(RegExp('\\s' + name + '\\s*=\\s*[\'"](.+?)[\'"]'));
			}
			
			return {
				userId          : getString('userId'),
				userIdx         : getString('userIdx'),
				cmsServerDomain : getString('cmsServerDomain'),
			}
		});
	},
	
	toW3CDTF : function(date){
		with(date){
			return getFullYear() + '-' + (getMonth()+1).pad(2) + '-' + getDate().pad(2) + 
			'T' + getHours().pad(2) + ':' + getMinutes().pad(2) + ':' + getSeconds().pad(2) + 
			toTimeString().split('GMT').pop().replace(/(\d{2})(\d{2})/, '$1:$2');
		}
	},
	
	/**
	 * ファイルのアップロード可否を確認する。
	 * ファイルが重複する場合など、そのままアップロードできない場合はエラーとなる。
	 * 
	 * @param {String} path 
	 *        アップロード対象のパス。ルート(/)からはじまる相対パスで記述する。
	 * @param {optional Number} size 
	 *        アップロードするファイルのサイズ。
	 * @return {Deferred} 処理結果。
	 */
	checkUpload : function(path, size){
		var self = this;
		
		size = size || 1;
		
		return this.getSessionValue('user', this.getUserInfo).addCallback(function(info){
			return request('http://' + info.cmsServerDomain + '/CheckUpload.ndrive', {
				sendContent : {
					cookie      : getCookieString('ndrive1.naver.jp'),
					userid      : info.userId,
					useridx     : info.userIdx,
					
					dstresource : path,
					uploadsize  : size,
				}
			}).addCallback(function(res){
				res = evalInSandbox('(' + res.responseText + ')', self.ICON);
				
				if(res.resultcode != 0)
					throw res;
				return res;
			});
		});
	},
	
	uniqueFile : function(path){
		var self = this;
		return this.checkUpload(path).addCallback(function(){
			return path;
		}).addErrback(function(err){
			err = err.message;
			
			// Duplicated File Exist以外のエラーは抜ける
			if(err.resultcode != 9)
				throw err;
			
			return self.uniqueFile(self.incrementFile(path));
		});
	},
	
	incrementFile : function(path){
		var paths = path.split('/');
		var name = paths.pop();
		
		// 既に括弧数字が含まれているか?
		var re = /(.*\()(\d+)(\))/;
		if(re.test(name)){
			name = name.replace(re, function(all, left, num, right){
				return left + (++num) + right;
			});
		} else {
			name = (name.contains('.'))?
				name.replace(/(.*)(\..*)/, '$1(2)$2') : 
				name + '(2)';
		}
		
		paths.push(name);
		return paths.join('/');
	},
	
	validateFileName : function(name){
		return name.replace(/[:\|\?\*\/\\]/g, '-').replace(/"/g, "'").replace(/</g, "(").replace(/>/g, ")");
	},
	
	/**
	 * ファイルをアップロードする。
	 * 空要素は除外される。
	 * 配列が空の場合は、空文字列が返される。
	 * 配列の入れ子は直列化される。
	 * 
	 * @param {LocalFile || String} file 
	 *        アップロード対象のファイル。ファイルへのURIでも可。
	 * @param {optional String} dir 
	 *        アップロード先のディレクトリ。
	 *        省略された場合はmodel.ndrive.defaultDirの設定値かルートになる。
	 *        先頭および末尾のスラッシュの有無は問わない。
	 * @param {optional String} name 
	 *        アップロード後のファイル名。
	 *        省略された場合は元のファイル名のままとなる。
	 * @param {optional Boolean} overwrite 
	 *        上書きフラグ。
	 *        上書きせずに同名のファイルが存在した場合は末尾に括弧数字((3)など)が付加される。
	 * @return {Deferred} 処理結果。
	 */
	upload : function(file, dir, name, overwrite){
		var self = this;
		
		file = getLocalFile(file);
		name = this.validateFileName(name || file.leafName);
		
		if(!dir)
			dir = getPref('model.ndrive.defaultDir') || '';
		
		if(dir && dir.slice(-1)!='/')
			dir += '/' ;
		
		if(!dir.startsWith('/'))
			dir = '/' + dir;
		
		var path = dir + name;
		
		// 上書きしない場合はファイル名のチェックを先に行う
		return ((overwrite)? succeed(path) : self.uniqueFile(path)).addCallback(function(fixed){
			path = fixed;
			
			return self.getSessionValue('user', this.getUserInfo);
		}).addCallback(function(info){
			return request('http://' + info.cmsServerDomain + path, {
				sendContent : {
					overwrite       : overwrite? 'T' : 'F',
					NDriveSvcType   : 'NHN/ND-WEB Ver',
					Upload          : 'Submit Query',
					
					// FIXME: マルチパートの場合、自動でエンコードされない(Tumblrはデコードを行わない)
					cookie          : encodeURIComponent(getCookieString('ndrive1.naver.jp')),
					userid          : info.userId,
					useridx         : info.userIdx,
					
					Filename        : file.leafName,
					filesize        : file.fileSize,
					getlastmodified : self.toW3CDTF(new Date(file.lastModifiedTime)),
					Filedata        : file,
				}
			});
		});
	}
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
