let Models = this.Models = Object.create(Object.expand(new Repository(), {
  /**
   * ポストを受け取ることができるサービスのリストを取得する。
   *
   * @param {Object} ps ポスト情報。
   * @return {Array}
   */
  check(ps) {
    return this.values.filter(model =>
      isFavorite(ps, model.name) || (model.check && model.check(ps))
    );
  },
  /**
   * デフォルトのサービスのリストを取得する。
   * ユーザーの設定が適用される。
   *
   * @param {Object} ps ポスト情報。
   * @return {Array}
   */
  getDefaults(ps) {
    let modelsConfig = this.getModelsConfig(true);

    return this.check(ps).filter(model =>
      this.getPostConfig(modelsConfig, model.name, ps) === 'default'
    );
  },
  /**
   * 利用可能なサービスのリストを取得する。
   * ユーザーの設定が適用される。
   *
   * @param {Object} ps ポスト情報。
   * @return {Array}
   */
  getEnables(ps) {
    let modelsConfig = this.getModelsConfig(true);

    return this.check(ps).filter(model => {
      model.config = model.config || {};

      // クイックポストフォームにて、取得後にデフォルトなのか利用可能なのかを
      // 判定する必要があったため、サービスに設定値を保存し返す
      let val = model.config[ps.type] =
        this.getPostConfig(modelsConfig, model.name, ps);

      return !val || /^(?:default|enabled)$/.test(val);
    });
  },
  getModelsConfig(options) {
    const PREF_NAME = 'extensions.tombfix.postConfig';

    if (
      !JSON.parseable(Preferences.get(PREF_NAME)) ||
        Object.type(JSON.parse(Preferences.get(PREF_NAME))) !== 'Object'
    ) {
      Preferences.reset(PREF_NAME);

      if (Preferences.get(PREF_NAME) === void 0) {
        Preferences.set(PREF_NAME, '{}');
      }

      const MESSAGE_NAME = 'message.options.postConfig.recovery';

      if (options) {
        openOptions(MESSAGE_NAME);
      } else {
        alert(getMessage(MESSAGE_NAME));
      }
    }

    return JSON.parse(Preferences.get(PREF_NAME));
  },
  /**
   * ポスト設定値を文字列で取得する。
   *
   * @param {Object} modelsConfig ポスト設定。
   * @param {String} modelName サービス名。
   * @param {Object} ps ポスト情報。
   * @return {String}
   */
  getPostConfig(modelsConfig, modelName, ps) {
    let modelConfig = modelsConfig[modelName];

    if (modelConfig) {
      let val = modelConfig[
        isFavorite(ps, modelName) ? 'favorite' : ps.type
      ];

      if (typeof val === 'string') {
        return val;
      }
    }

    return '';
  }
}));
// for Patch Compatibility
this.models = Models;


var Tumblr = update({}, AbstractSessionService, {
  name : 'Tumblr',
  ICON : 'http://www.tumblr.com/images/favicon.gif',
  ORIGIN : 'https://www.tumblr.com',
  TUMBLR_URL : 'http://www.tumblr.com/',
  API_URL : 'https://api.tumblr.com/',
  // Tombfix's OAuth Consumer Key
  API_KEY : 'wiHRMlZeYbLaIA0CCfb5UzGtEsIJOLgMtJ4OJPPe7WYCQG1GOU',
  SVC_URL : 'https://www.tumblr.com/svc/',

  blogID : '',

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
   * Reblogする。
   * Extractors.ReBlogの各抽出メソッドを使いReblog情報を抽出できる。
   *
   * @param {Object} ps
   * @return {Deferred}
   */
  favor(ps) {
    let {endpoint, form} = ps.favorite;

    if (!endpoint) {
      throw new Error(getMessage('error.notLoggedin'));
    }

    // メモをReblogフォームの適切なフィールドの末尾に追加する
    for (let [itemName, itemValue] of Object.entries(
      this[ps.type.capitalize()].convertToForm({
        description : ps.description
      })
    )) {
      if (itemValue) {
        form[itemName] += `\n\n${itemValue}`;
      }
    }

    this.appendTags(form, ps);

    return this.postForm(() =>
      request(endpoint, {
        sendContent : form
      })
    );
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

  login(user, password) {
    const LOGIN_URL = this.ORIGIN + '/login';

    let modelName = this.name,
        iconURL = this.ICON;

    return succeed().addCallback(() => {
      if (this.isLoggedIn()) {
        notify(modelName, getMessage('message.changeAccount.logout'), iconURL);

        return this.logout();
      }
    }).addCallback(() => {
      return request(LOGIN_URL, {
        responseType : 'document'
      });
    }).addCallback(({response : doc}) => {
      notify(modelName, getMessage('message.changeAccount.login'), iconURL);

      return request(LOGIN_URL, {
        sendContent : Object.assign(formContents(
          doc.querySelector('form#signup_form')
        ), {
          'user[email]'    : user,
          'user[password]' : password
        })
      });
    }).addCallback(() => {
      this.updateSession();
      this.user = user;

      notify(modelName, getMessage('message.changeAccount.done'), iconURL);
    });
  },

  logout() {
    return request(this.ORIGIN + '/logout');
  },

  getPasswords() {
    return getPasswords(this.ORIGIN);
  },

  /**
   * ログイン中のユーザーを取得する。
   * 結果はキャッシュされ、再ログインまで再取得は行われない。
   * 「アカウントの切り替え」のためのインターフェースメソッド。
   *
   * @return {Deferred} ログインに使われるメールアドレスが返される。
   */
  getCurrentUser() {
    return this.getSessionValue('user', () => {
      return request(this.ORIGIN + '/settings/account', {
        responseType : 'document'
      }).addCallback(({response : doc}) => {
        return doc.querySelector(
          '.email_group > .group_content p'
        ).textContent.trim();
      });
    }).addErrback(() => '');
  },

  getBlogs() {
    return new DeferredHash({
      primaryblogID       : this.getPrimaryBlogID(),
      postFormBuilderData : this.getPostFormBuilderData()
    }).addCallback(({primaryblogID, postFormBuilderData}) => {
      if (!primaryblogID[0]) {
        throw primaryblogID[1];
      }
      if (!postFormBuilderData[0]) {
        throw postFormBuilderData[1];
      }

      let blogs = postFormBuilderData[1].channels;

      if (blogs.length < 2) {
        return blogs;
      }

      let blogID = primaryblogID[1];

      return blogs.splice(blogs.findIndex(
        blog => blog.name === blogID
      ), 1).concat(blogs);
    });
  },

  getPrimaryBlogID() {
    return request(this.ORIGIN + '/settings/blog/', {
      responseType : 'text'
    }).addCallback(res => {
      let {pathname} = new URL(res.responseURL);

      if (pathname === '/login') {
        throw new Error(getMessage('error.notLoggedin'));
      }

      let blogID = pathname.extract(/^\/settings\/blog\/([^\/]+)/);

      if (blogID) {
        return blogID;
      }

      throw new Error(getMessage('error.unknown'));
    });
  },

  getPostFormBuilderData() {
    return request(this.SVC_URL + 'post/get_post_form_builder_data', {
      responseType : 'json'
    }).addCallback(res => {
      if ((new URL(res.responseURL)).pathname === '/login') {
        throw new Error(getMessage('error.notLoggedin'));
      }

      let json = res.response;

      if (json && json.meta) {
        let {msg} = json.meta;

        if (msg === 'OK') {
          let {response} = json;

          if (response) {
            return response;
          }
        } else if (msg) {
          throw new Error(msg);
        }
      }

      throw new Error(getMessage('error.unknown'));
    });
  },

  getPostInfo(hostname, postID) {
    // https://www.tumblr.com/docs/en/api/v2#posts
    return request(`${this.API_URL}v2/blog/${hostname}/posts`, {
      responseType : 'json',
      queryString  : {
        api_key : this.API_KEY,
        id      : postID
      }
    }).addCallback(({response : json}) => {
      let {meta} = json;

      if (meta.status === 200) {
        let {posts} = json.response;

        if (posts && posts.length) {
          return posts[0];
        }
      }

      throw new Error(meta.msg || getMessage('error.contentsNotFound'));
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
  },

  getReblogPage(reblogID, reblogKey) {
    return request(`${this.ORIGIN}/reblog/${reblogID}/${reblogKey}`, {
      responseType : 'document',
      queryString  : {
        redirect_to : `${this.ORIGIN}/dashboard`
      }
    }).addCallback(({response : doc}) => {
      if ((new URL(doc.URL)).pathname === '/register') {
        throw new Error(getMessage('error.notLoggedin'));
      }

      return doc;
    });
  },

  /**
   * ユーザーの利用しているタグ一覧を取得する。
   *
   * @return {Array}
   */
  getUserTags() {
    return Tumblr.isLoggedIn() ? this.getBlogs().addCallback(blogs => (
      this.blogID ? blogs.find(blog => blog.name === this.blogID) : blogs[0]
    ).tags.map(tag => ({
      name : tag
    }))).addErrback(() => []) : succeed([]);
  },

  /**
   * タグを取得する。
   *
   * @return {Object}
   */
  getSuggestions() {
    return this.getUserTags().addCallback(tags => ({tags}));
  },

  isLoggedIn() {
    return getCookieValue('.tumblr.com', 'logged_in') === '1';
  },

  getAuthCookie() {
    return getCookieValue('www.tumblr.com', 'pfs');
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


if (getPref('model.tumblr.secondaryBlogs') && Tumblr.isLoggedIn()) {
  Tumblr.getBlogs().addCallback(blogs => {
    if (blogs.length < 2) {
      return;
    }

    Models.register(blogs.slice(1).map(({name : blogID}) => {
      let copyModel = Object.assign({}, Tumblr, {
        name   : 'Tumblr - ' + blogID,
        blogID : blogID
      });

      addBefore(copyModel, 'appendTags', form => {
        form.channel_id = blogID;
      });

      // 「アカウントの切り替え」に表示されないように
      delete copyModel.getPasswords;

      return copyModel;
    }), 'Tumblr', true);
  }).addErrback(() => {});
}


Models.register({
  name    : 'Pinterest',
  ICON    : 'https://www.pinterest.com/favicon.ico',
  ORIGIN  : 'https://www.pinterest.com',
  boardID : null,

  check(ps) {
    return /^(?:photo|video)$/.test(ps.type);
  },

  post(ps) {
    return this.getBoardID().addCallback(boardID =>
      this.getImageURL(ps).addCallback(imageURL =>
        this.getResource('PinResource/create/', {
          board_id    : boardID,
          image_url   : imageURL,
          link        : ps.pageUrl,
          description : joinText([
            ps.item,
            ps.description,
            Array.hashtags(ps.tags).join(' ')
          ], ' ')
        })
      )
    );
  },

  getBoardID() {
    return this.boardID ?
      succeed(this.boardID) :
      this.getBoards().addCallback(boards => {
        let recBoards = boards.boards_shortlist;

        return (recBoards.length ? recBoards : boards.all_boards)[0].id;
      });
  },

  getImageURL(ps) {
    return ps.type === 'video' ? this.findPinImages(ps.itemUrl).addCallback(
      items => items[0].url
    ) : (ps.file ? this.upload(ps.file) : succeed(ps.itemUrl));
  },

  getBoards() {
    return this.getResource('BoardPickerBoardsResource/get/', null, () => {
      throw new Error(getMessage('error.notLoggedin'));
    }).addCallback(data => {
      if (!data.all_boards.length) {
        throw new Error(getMessage('message.model.pinterest.board'));
      }

      return data;
    });
  },

  findPinImages(url) {
    return this.getResource('FindPinImagesResource/get/', {
      url : url
    }).addCallback(({items}) => {
      if (!items.length) {
        throw new Error(getMessage('error.contentsNotFound'));
      }

      return items;
    });
  },

  upload(file) {
    return this.callMethod('/upload-image/', {
      img : file
    }).addCallback(json => {
      if (!json.success) {
        throw new Error(json.error);
      }

      return json.image_url;
    });
  },

  getResource(path, options, errback) {
    return this.callMethod('/resource/' + path, options ? {
      data : JSON.stringify({options})
    } : null).addErrback(err => {
      if (errback) {
        errback();
      }

      let json = err.message.response;

      if (json && json.resource_response) {
        return json;
      }

      throw err;
    }).addCallback(json => {
      let {data, error} = json.resource_response;

      if (!data || error) {
        if (error) {
          let {message} = error;

          if (message) {
            throw new Error(message);
          }
        }

        throw new Error(getMessage('error.unknown'));
      }

      return data;
    });
  },

  callMethod(method, content) {
    return request(this.ORIGIN + method, {
      responseType : 'json',
      referrer     : this.ORIGIN,
      headers      : {
        'X-Requested-With' : 'XMLHttpRequest',
        'X-CSRFToken'      : getCookieValue(
          '.pinterest.com',
          'csrftoken'
        )
      },
      sendContent  : content
    }).addCallback(({response : json}) => json);
  }
});


Models.Pinterest.getBoards().addCallback(boards => {
  let allBoards = boards.all_boards;

  if (allBoards.length < 2) {
    return;
  }

  Models.register(allBoards.map(board =>
    Object.assign({}, Pinterest, {
      name    : 'Pinterest - ' + board.name,
      boardID : board.id
    })
  ), 'Pinterest', true);
}).addErrback(() => {});


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
Models.register(Object.assign({
  name           : 'Flickr',
  ICON           : 'https://www.flickr.com/favicon.ico',
  API_KEY        : 'ecf21e55123e4b31afa8dd344def5cc5',
  ORIGIN         : 'https://www.flickr.com',
  REST_API_URL   : 'https://api.flickr.com/services/rest',
  UPLOAD_API_URL : 'https://up.flickr.com/services/upload/',

  check(ps) {
    return ps.type === 'photo';
  },

  post(ps) {
    return this.getToken().addCallback(token => {
      return getFileFromPS(ps).addCallback(file => {
        return request(this.UPLOAD_API_URL, {
          responseType : 'document',
          // via https://www.flickr.com/services/api/upload.api.html
          sendContent  : Object.assign({
            photo       : file,
            title       : ps.item,
            description : ps.description,
            tags        : joinText(ps.tags, ' ')
          }, ps.private == null ? {} : {
            is_public : ps.private ? 0 : 1
          }, token)
        });
      }).addCallback(({response : doc}) => {
        if (doc.querySelector('rsp').getAttribute('stat') !== 'ok') {
          throw new Error(
            doc.querySelector('err').getAttribute('msg')
          );
        }
      });
    });
  },

  favor(ps) {
    // via https://www.flickr.com/services/api/flickr.favorites.add.html
    return this.callMethod('favorites.add', {
      photo_id : ps.favorite.id
    }).addErrback(err => {
      // Error Codes: 3
      if (err.message !== 'Photo is already in favorites') {
        throw err;
      }
    });
  },

  getToken(apiKeyOnly) {
    if (apiKeyOnly && !this.getAuthCookie()) {
      return succeed({api_key : this.API_KEY});
    }

    return this.getSessionValue('token', () => {
      return request(this.ORIGIN, {
        responseType : 'document'
      }).addCallback(({response : doc}) => {
        for (let script of doc.scripts) {
          let text = script.textContent.extract(
            /var yconf = ({.+});/
          );

          if (text) {
            let {flickrAPI} = JSON.parse(text);

            return {
              api_key   : flickrAPI.api_key,
              auth_hash : flickrAPI.auth_hash
            };
          }
        }
      });
    });
  },

  callMethod(method, info, apiKeyOnly) {
    return this.getToken(apiKeyOnly).addCallback(token => {
      return request(this.REST_API_URL, {
        responseType : 'json',
        queryString  : Object.assign({
          method         : 'flickr.' + method,
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

  getInfo(photoID) {
    // via https://www.flickr.com/services/api/flickr.photos.getInfo.html
    return this.callMethod('photos.getInfo', {
      photo_id : photoID
    }, true).addCallback(json => json.photo);
  },

  getSizes(photoID) {
    // via https://www.flickr.com/services/api/flickr.photos.getSizes.html
    return this.callMethod('photos.getSizes', {
      photo_id : photoID
    }, true).addCallback(json => json.sizes.size);
  },

  /**
   * ユーザーの利用しているタグ一覧を取得する。
   *
   * @return {Array}
   */
  getUserTags() {
    // via https://www.flickr.com/services/api/flickr.tags.getListUser.html
    return this.callMethod('tags.getListUser').addCallback(
      json => json.who.tags.tag.map(tag => ({
        name : tag._content
      }))
    ).addErrback(() => []);
  },

  /**
   * タグを取得する。
   *
   * @return {Object}
   */
  getSuggestions() {
    return this.getUserTags().addCallback(tags => ({tags}));
  },

  getAuthCookie() {
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
  name           : 'Gyazo',
  ICON           : 'chrome://tombfix/skin/favicon/gyazo.ico',
  // via https://gyazo.com/api/docs/image#easy_auth
  UPLOAD_API_URL : 'https://upload.gyazo.com/api/upload/easy_auth',
  CLIENT_ID      : 'a300152784a920653ba6e1b4637e55835f6eecbc96d33dfc127c89db8' +
    '0e70f6c',

  check(ps) {
    return ps.type === 'photo';
  },

  post(ps) {
    return request(this.UPLOAD_API_URL, {
      responseType : 'json',
      sendContent  : {
        client_id   : this.CLIENT_ID,
        image_url   : getImageURLFromPS(ps),
        referer_url : ps.pageUrl,
        title       : ps.page || ''
      }
    }).addCallback(({response : json}) => {
      addTab(json.get_image_url);
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


Models.register(Object.assign({
  name              : 'Twitter',
  ICON              : 'https://twitter.com/favicon.ico',
  ORIGIN            : 'https://twitter.com',
  ACCOUT_URL        : 'https://twitter.com/settings/account',
  TWEET_API_URL     : 'https://twitter.com/i/tweet',
  UPLOAD_API_URL    : 'https://upload.twitter.com/i/media/upload.json',
  STATUS_MAX_LENGTH : 140,
  OPTIONS           : {
    // for twttr.txt.getTweetLength()
    short_url_length       : 23,
    short_url_length_https : 23
  },

  check(ps) {
    return /^(?:regular|photo|quote|link|video|conversation)$/.test(ps.type);
  },

  post(ps) {
    return this.getToken().addCallback(token => {
      let status = this.createStatus(ps);

      return ps.type === 'photo' ?
        this.upload(ps, token, status) :
        this.update(token, status);
    });
  },

  favor(ps) {
    return this.getToken().addCallback(token =>
      this.callMethod('favorite', Object.assign(token, {
        id : ps.favorite.id
      }))
    );
  },

  login(user, password) {
    let modelName = this.name,
        iconURL = this.ICON;

    return succeed().addCallback(() => {
      if (this.getAuthCookie()) {
        notify(modelName, getMessage('message.changeAccount.logout'), iconURL);

        return this.logout();
      }
    }).addCallback(() =>
      request(this.ORIGIN + '/login', {
        responseType : 'document'
      })
    ).addCallback(({response : doc}) => {
      notify(modelName, getMessage('message.changeAccount.login'), iconURL);

      return request(this.ORIGIN + '/sessions', {
        sendContent : Object.assign(formContents(
          doc.querySelector('form.signin')
        ), {
          'session[username_or_email]' : user,
          'session[password]'          : password
        })
      });
    }).addCallback(() => {
      notify(modelName, getMessage('message.changeAccount.done'), iconURL);
    });
  },

  logout() {
    return request(this.ACCOUT_URL, {
      responseType : 'document'
    }).addCallback(({response : doc}) =>
      request(this.ORIGIN + '/logout', {
        sendContent : formContents(doc.getElementById('signout-form'))
      })
    );
  },

  getPasswords() {
    return getPasswords(this.ORIGIN);
  },

  getCurrentUser() {
    return request(this.ACCOUT_URL, {
      responseType : 'document'
    }).addCallback(({response : doc}) =>
      doc.querySelector('[name="user[screen_name]"]').value
    ).addErrback(() => '');
  },

  getToken() {
    return this.getSessionValue('token', () =>
      request(this.ACCOUT_URL, {
        responseType : 'document'
      }).addCallback(({response : doc}) => {
        let tokenElm = doc.querySelector('.authenticity_token');

        if (tokenElm) {
          return {
            authenticity_token : tokenElm.value
          };
        }

        throw new Error(getMessage('error.unknown'));
      })
    );
  },

  callMethod(method, content) {
    return request(`${this.TWEET_API_URL}/${method}`, {
      responseType : 'json',
      referrer     : this.ORIGIN,
      sendContent  : content
    }).addErrback(err => {
      let json = err.message.response;

      if (json) {
        let {message} = json;

        if (message) {
          throw new Error(message.trimTag());
        }
      }

      throw err;
    });
  },

  update(token, status) {
    return this.callMethod('create', Object.assign(token, {status}));
  },

  upload(ps, token, status) {
    return getFileFromPS(ps).addCallback(file =>
      request(this.UPLOAD_API_URL, {
        responseType : 'json',
        sendContent  : Object.assign({
          media : fileToBase64(file)
        }, token)
      }).addErrback(err => {
        let json = err.message.response;

        if (json) {
          let {error} = json;

          if (error) {
            throw new Error(error);
          }
        }

        throw err;
      })
    ).addCallback(({response : json}) =>
      this.update(Object.assign({
        media_ids : json.media_id_string
      }, token), status)
    );
  },

  createStatus(ps) {
    let contents = {
      desc  : (ps.description || '').trim(),
      quote : ps.type !== 'video' && ps.body ? this.createQuote(ps.body) : '',
      title : (ps.item || '').trim(),
      url   : ps.itemUrl || '',
      tags  : Array.hashtags(ps.tags)
    };

    if (contents.quote && isFavorite(ps, 'Tumblr')) {
      contents.quote = this.createQuote(ps.body.trimTag());
    }

    let maxLen = this.STATUS_MAX_LENGTH;

    if (ps.type === 'photo') {
      contents.url = ps.pageUrl;
      maxLen -= this.OPTIONS.short_url_length + 1;
    }

    let status = this.joinContents(contents);

    if (ps.type !== 'regular' && getPref('model.twitter.truncateStatus')) {
      let over = this.getTweetLength(status) - maxLen;

      if (over > 0) {
        return this.truncateStatus(contents, over);
      }
    }

    return status;
  },

  createQuote(body) {
    let str = body.trim();

    return str && str.wrap('"');
  },

  getTweetLength(str) {
    return twttr.txt.getTweetLength(str, this.OPTIONS);
  },

  joinContents(contents) {
    let template = getPref('model.twitter.template'),
        {desc, quote, title, url, tags} = contents,
        prefix = desc ? '' : getPref('model.twitter.template.prefix');

    return template ?
      this.extractTemplate(prefix, template, contents) :
      joinText([prefix, desc, quote, title, url, ...tags], ' ');
  },

  extractTemplate(prefix, template, contents) {
    contents.usage = {};

    let fixedTemplate = template.replace(
      /%(desc|quote|title|url|tags|br)%/g,
      (match, name) => {
        if (name === 'br') {
          return '\n';
        }

        contents.usage[name] = true;

        return contents[name].length ? match : '';
      }
    ).trim().replace(/^ +| +$/mg, '').replace(/ +/g, ' ');

    return joinText([prefix, ...(fixedTemplate.split(' '))].map(content =>
      content.replace(
        /%(desc|quote|title|url|tags)%/g,
        (match, name) => name === 'tags' ?
          contents.tags.join(' ') :
          contents[name]
      )
    ), ' ');
  },

  truncateStatus(contents, overLength) {
    let over = overLength;
    let truncators = {
      tags  : array => {
        let arr = array.slice();

        contents.tags = arr = arr.reverse().filter(tag => {
          if (over <= 0) {
            return true;
          }

          over -= tag.charLength + 1;
        }).reverse();

        if (arr.length || over <= 0) {
          return true;
        }
      },
      title : string => {
        let str = this.truncateContent(string, over);

        if (str) {
          contents.title = str + '…';
        } else {
          over -= this.getTweetLength(string) + 1;
          contents.title = str;

          if (over > 0) {
            return false;
          }
        }

        return true;
      },
      quote : string => {
        let str = this.truncateContent(string.slice(1, -1), over);

        if (str) {
          contents.quote = (str + '…').wrap('"');
        } else {
          over -= this.getTweetLength(string) + 1;
          contents.quote = str;

          if (over > 0) {
            return false;
          }
        }

        return true;
      },
      desc  : string => {
        contents.desc = this.truncateContent(string, over) + '…';
      }
    };

    for (let truncatorName of Object.keys(truncators)) {
      if (contents.usage && !contents.usage[truncatorName]) {
        contents[truncatorName] = truncatorName === 'tags' ? [] : '';
      }

      let content = contents[truncatorName];

      if (content.length && truncators[truncatorName](content)) {
        break;
      }
    }

    return this.joinContents(contents);
  },

  truncateContent(content, overLength) {
    // for surrogate pair
    let strArr = [...content],
        urls = twttr.txt.extractUrlsWithIndices(content).reverse(),
        twLen = this.getTweetLength(content),
        over = overLength;

    if (!urls.length || twLen <= over + 1) {
      return strArr.slice(0, -(over + 1)).join('');
    }

    for (let {indices : [start, end]} of urls) {
      let len = strArr.length;

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

  getAuthCookie() {
    return getCookieValue('.twitter.com', 'auth_token');
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
  // via http://dropmark.com/support/getting-started/browser-extensions-bookmarklets/
  ORIGIN     : 'https://app.dropmark.com',
  CONVERTERS : {
    regular      : ps => ({
      item_type   : 'text',
      content     : ps.description,
      description : ''
    }),
    photo        : ps => ps.file ? {
      item_type   : 'file',
      'file[]'    : ps.file,
      link        : '',
      description : joinText([
        ps.itemUrl,
        ps.pageUrl,
        ps.description
      ], '\n')
    } : {
      description : joinText([ps.pageUrl, ps.description], '\n')
    },
    quote        : ps => {
      let content = Twitter.createQuote((ps.body || '').trimTag())

      return Object.assign({
        item_type : 'text',
        content   : content
      }, content ? {} : {
        // contentが無い時に、item_typeがtextからlinkになってしまうのを防ぐ
        link : ''
      });
    },
    conversation : ps => ({
      item_type : 'text',
      content   : ps.body
    })
  },

  check(ps) {
    return /^(?:regular|photo|quote|link|video|conversation)$/.test(ps.type);
  },

  post(ps) {
    return this.getInfo(ps).addCallback(({url, data}) => {
      return request(url + '/items/new', {
        sendContent : Object.assign({}, data, {
          // item_typeがlinkやtextの場合は、
          // このリクエストでもdescriptionをポストできるが、fileの場合はポストできない。
          // よって、このリクエストではdescriptionの内容をsendContentに反映させず、
          // 次のputDescription()のリクエストでdescriptionを個別にポストする。
          description : ''
        })
      }).addErrback(err => {
        throw new Error(err.message.responseText);
      }).addCallback(res => {
        let json = JSON.parse(res.responseText);

        if (!json.success) {
          throw new Error(json.message);
        }

        if (data.description) {
          return this.putDescription((
            new URL(url)
          ).origin, json.id, data);
        }
      });
    });
  },

  getInfo(ps) {
    return request(this.ORIGIN + '/?view=bookmarklet', {
      responseType : 'document'
    }).addCallback(({response : doc}) => {
      if ((new URL(doc.URL)).pathname !== '/login') {
        let collectionName = doc.querySelector('.collection-name');

        if (collectionName) {
          let tokenElm = doc.querySelector('meta[name="_csrf"]');

          if (tokenElm) {
            let converter = this.CONVERTERS[ps.type];

            return {
              url  : collectionName.href,
              data : Object.assign({
                _csrf       : tokenElm.content,
                item_type   : 'link',
                name        : ps.item || '',
                link        : ps.itemUrl || '',
                tags        : joinText(ps.tags),
                description : ps.description || ''
              }, converter ? converter(ps) : {})
            };
          }
        }
      }

      throw new Error(getMessage('error.notLoggedin'));
    });
  },

  putDescription(origin, id, data) {
    return request(origin + '/items/' + id, {
      method       : 'PUT',
      mode         : 'raw',
      responseType : 'json',
      headers      : {
        'X-CSRF-TOKEN' : data._csrf
      },
      sendContent  : queryString({
        description : data.description
      })
    }).addCallback(({response : json}) => {
      if (!json.success) {
        throw new Error(json.message);
      }
    });
  },

  /**
   * ユーザーの利用しているタグ一覧を取得する。
   *
   * @return {Array}
   */
  getUserTags() {
    return request(this.ORIGIN + '/tags', {
      responseType : 'json'
    }).addCallback(({response : json}) => json ? json.map(tag => ({
      name      : tag.name,
      frequency : tag.items_total_count
    })) : []);
  },

  /**
   * タグを取得する。
   *
   * @return {Object}
   */
  getSuggestions() {
    return this.getUserTags().addCallback(tags => ({tags}));
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
    return request(this.API_URL + 'posts/md5/' + url.md5(), {
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

  check(ps) {
    return /^(?:quote|link)$/.test(ps.type);
  },

  post(ps) {
    let {tags} = ps;

    return request('https://getpocket.com/edit', {
      responseType : 'text',
      queryString  : {
        url  : ps.itemUrl,
        tags : Array.wrap(tags).length ? tags.join(',') : ''
      }
    }).addCallback(res => {
      if (new URL(res.responseURL).pathname === '/edit') {
        return;
      }

      throw new Error(getMessage('error.notLoggedin'));
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


Models.register(Object.assign({
  name    : 'Hatena',
  ICON    : 'https://www.hatena.ne.jp/favicon.ico',
  ORIGIN  : 'https://www.hatena.ne.jp',
  API_URL : 'https://b.hatena.ne.jp/my.name',

  login(user, password) {
    let modelName = this.name,
      icon = this.ICON;

    notify(modelName, getMessage('message.changeAccount.login'), icon);

    return request(this.ORIGIN + '/login', {
      sendContent : {
        name       : user,
        password   : password,
        persistent : 1
      }
    }).addCallback(() => {
      notify(modelName, getMessage('message.changeAccount.done'), icon);
    });
  },

  getPasswords() {
    return getPasswords(this.ORIGIN);
  },

  getCurrentUser() {
    return this.getInfo().addCallback(info => info.name);
  },

  getToken() {
    return this.getInfo().addCallback(info => info.rks);
  },

  getInfo() {
    return this.getSessionValue('info', () => {
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

  reprTags(tags) {
    return Array.wrap(tags).length ?
      tags.map(tag => tag.wrap('[', ']')).join('') :
      '';
  },

  // via http://developer.hatena.ne.jp/ja/documents/auth/misc/rkm
  getRKM() {
    let rk = this.getAuthCookie();

    return rk ? rk.md5(true).replace(/=+$/, '') : '';
  },

  getAuthCookie() {
    return getCookieValue('.hatena.ne.jp', 'rk');
  }
}, AbstractSessionService));


Models.register({
  name : 'HatenaFotolife',
  ICON : 'http://f.hatena.ne.jp/favicon.ico',

  check(ps) {
    return ps.type === 'photo';
  },

  post(ps) {
    return Hatena.getInfo().addCallback(info => {
      return getFileFromPS(ps).addCallback(file => {
        // can't upload from "http://f.hatena.ne.jp/my/up"
        return request(`http://f.hatena.ne.jp/${info.name}/up`, {
          responseType : 'document',
          sendContent  : {
            mode       : 'enter',
            rkm        : info.rkm,
            // can set a specific folder
            // folder     : '',
            // can set "image{2-5}" & "fototitle{2-5}" too
            image1     : file,
            // can contain tags
            fototitle1 : ps.item || '',
            taglist    : Hatena.reprTags(ps.tags)
          }
        }).addCallback(({response : doc}) => {
          if (!(new URL(doc.URL)).pathname.endsWith('/edit')) {
            let message = doc.querySelector(
              '.option-message > strong'
            );

            if (message) {
              throw new Error(message.textContent.trim());
            }

            throw new Error(getMessage('error.unknown'));
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

  check(ps) {
    return /^(?:photo|quote|link|conversation|video)$/.test(ps.type) &&
      (!ps.file || ps.itemUrl);
  },

  post(ps) {
    return Hatena.getToken().addCallback(token => {
      // alternate: http://b.hatena.ne.jp/{username}/add.edit
      return request(this.ORIGIN + '/bookmarklet.edit', {
        responseType : 'document',
        sendContent  : Object.assign({
          rks     : token,
          url     : ps.itemUrl,
          // タイトルはユーザー間で共有されるので送信しない
          // title   : ps.item || '',
          // via http://b.hatena.ne.jp/help/entry/tag
          comment : Hatena.reprTags(ps.tags) + joinText([
            (ps.body || '').trimTag(),
            ps.description
          ], ' ').replace(/[\r\n]+/g, ' ')
        }, ps.private == null ? {} : {
          private        : ps.private ? 1 : 0,
          with_status_op : 1
        })
      });
    }).addCallback(({response : doc}) => {
      let errormsg = doc.querySelector('.errormsg');

      if (errormsg) {
        throw new Error(errormsg.textContent.trim());
      }
    });
  },

  getEntry(url) {
    return request(this.ORIGIN + '/my.entry', {
      responseType : 'json',
      queryString  : {url}
    }).addCallback(({response : json}) => json);
  },

  /**
   * ユーザーの利用しているタグ一覧を取得する。
   *
   * @return {Array}
   */
  getUserTags(user) {
    // "http://b.hatena.ne.jp/my/tags.json" is slow.
    return request(`${this.ORIGIN}/${user}/tags.json`, {
      responseType : 'json'
    }).addCallback(({response : json}) =>
      Object.entries(json.tags).map(([tag, tagData]) => ({
        name      : tag,
        frequency : tagData.count
      }))
    ).addErrback(() => []);
  },

  /**
   * ユーザーのタグ、おすすめのタグを取得する。
   * ブックマーク済みでも取得できる。
   *
   * @param {String} url 関連情報を取得する対象のページURL。
   * @return {Object}
   */
  getSuggestions(url) {
    return Hatena.getCurrentUser().addCallback(user => new DeferredHash({
      tags  : this.getUserTags(user),
      entry : this.getEntry(url)
    })).addCallback(ress => {
      let suggestions = {
        tags : ress.tags[1]
      };

      if (ress.entry[0]) {
        let entry = ress.entry[1];

        suggestions.recommended = entry.recommend_tags;

        let data = entry.bookmarked_data;

        suggestions.duplicated = Boolean(data);

        if (suggestions.duplicated) {
          suggestions.form = Object.assign({
            item        : entry.title,
            tags        : data.tags,
            description : data.comment
          }, data.private == null ? {} : {
            private : data.private === '1'
          });
          // via http://b.hatena.ne.jp/register
          suggestions.editPage = this.ORIGIN + '/bookmarklet' +
            queryString({url}, true);
        }
      }

      return suggestions;
    }).addErrback(() => ({}));
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
        ' <img src=' + ps.itemUrl + ' />',
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

    return Hatena.getInfo().addCallback(function(info){
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
  name      : 'MediaMarker',
  ICON      : 'http://mediamarker.net/favicon.ico',
  // via http://mediamarker.net/help/tool#addbinder
  ORIGIN    : 'http://mediamarker.net',
  ORIGIN_RE : /^https?:\/\/mediamarker\.net$/,

  check(ps) {
    return /^(?:photo|quote|link|conversation|video)$/.test(ps.type) &&
      (!ps.file || ps.itemUrl);
  },

  post(ps) {
    return this.getInfo(ps.itemUrl).addCallback(({form, editURL}) => {
      let comment = joinText([getQuoteFromPS(ps), ps.description], '\n'),
        tag = joinText(ps.tags, '\n');

      return request(form.action, {
        responseType : 'document',
        sendContent  : Object.assign(formContents(form), {
          // タイトルはユーザー間で共有されるので送信しない
          // title : ps.item || '',
          // 対象のURLにリダイレクトされるのを防ぐ
          reg2 : null
        }, (editURL || comment) ? {
          comment : comment
        } : {}, (editURL || tag) ? {
          tag : tag
        } : {}, ps.private == null ? {} : {
          public : ps.private ? '1' : '0'
        })
      });
    }).addCallback(({response : doc}) => {
      let message = doc.querySelector('.message');

      if (message) {
        this.checkMessRed(message);

        throw new Error(getMessage('error.unknown'));
      }
    });
  },

  getInfo(url, params) {
    return request(this.ORIGIN + '/reg', {
      responseType : 'document',
      queryString  : Object.assign({
        mode : 'marklet',
        url  : url
      }, params)
    }).addCallback(({response : doc}) => {
      let form = doc.querySelector('form#reg');

      return form ? {form} : request(this.getEditURL(doc), {
        responseType : 'document'
      }).addCallback(({response : editDoc}) => ({
        form    : editDoc.querySelector('form#edit'),
        editURL : editDoc.URL
      }));
    }).addCallback(info => {
      let {form} = info;

      if (form) {
        let actionURL = form.action;

        if (actionURL) {
          let urlObj = new URL(actionURL);

          if (
            this.ORIGIN_RE.test(urlObj.origin) &&
              /^\/u\/[^\/]+\/(?:reg|edit)$/.test(urlObj.pathname)
          ) {
            return info;
          }
        }
      }

      throw new Error(getMessage('error.unknown'));
    });
  },

  getEditURL(doc) {
    let message = doc.querySelector('.message');

    if (message) {
      this.checkMessRed(message);

      let link = message.querySelector('td > a[href]:nth-of-type(2)');

      if (
        link && this.ORIGIN_RE.test(link.origin) &&
          /^\/u\/[^\/]+\/edit\d+$/.test(link.pathname)
      ) {
        return link.href;
      }
    }

    throw new Error(getMessage('error.unknown'));
  },

  checkMessRed(message) {
    let messRed = message.querySelector('.message .mess_red');

    if (messRed) {
      throw new Error((messRed.firstChild || messRed).textContent.trim());
    }
  },

  /**
   * ユーザーの利用しているタグ一覧を取得する。
   *
   * @return {Array}
   */
  getUserTags() {
    return this.getInfo(this.ORIGIN, {
      again : 1
    }).addCallback(info => {
      return [...info.form.querySelectorAll('#usetag > #view1 a')].map(
        link => ({
          name : link.textContent
        })
      );
    }).addErrback(() => []);
  },

  getRecommendedTagsFromForm(form) {
    return [...form.querySelectorAll('#poptag a')].map(
      link => link.textContent
    );
  },

  /**
   * ユーザーのタグ、おすすめのタグを取得する。
   * ブックマーク済みでも取得できる。
   *
   * @param {String} url 関連情報を取得する対象のページURL。
   * @return {Object}
   */
  getSuggestions(url) {
    return new DeferredHash({
      tags : this.getUserTags(),
      info : this.getInfo(url)
    }).addCallback(ress => {
      let suggestions = {
        tags : ress.tags[1]
      };

      if (ress.info[0]) {
        let {form, editURL} = ress.info[1];

        suggestions.recommended = this.getRecommendedTagsFromForm(form);
        suggestions.duplicated = Boolean(editURL);

        if (suggestions.duplicated) {
          let data = formContents(form);

          suggestions.form = Object.assign({
            item        : data.title || '',
            tags        : (data.tag || '').split('\n'),
            description : data.comment || ''
          }, data.public == null ? {} : {
            private : data.public === '1'
          });
          suggestions.editPage = editURL;
        }
      }

      return suggestions;
    }).addErrback(() => ({}));
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
          masstags :  joinText(ps.tags, ','),
        }),
      });
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
Object.assign(this, Models);
