Tombfix.environment.Extractors = Object.create(Object.expand(new Repository(), {
  REDIRECTORS: [
    {
      re: new RegExp(`^https?://(?:${[
        'feedproxy.google.com', 'tinyurl.com', 'bitly.com', 'bit.ly', 'j.mp',
        'is.gd', 'goo.gl', 'nico.ms', 'p.tl', 'ift.tt', 'g.co'
      ].join('|').replace(/\./g, '\\.')})/`),
      getURL(url) {
        return request(url, {
          responseType: 'document'
        }).addCallback(
          // res.responseURLではhashが省略されてしまう為、それ以外からURLを取得する
          ({response: doc}) => doc.URL
        );
      }
    },
    {
      re: /^https?:\/\/t\.co\//,
      getURL(url) {
        return request(url, {
          responseType: 'document'
        }).addCallback(({response: doc}) => (new URL(doc.title)).href);
      }
    },
    {
      re: /^https?:\/\/www\.google\.(?:com|co\.jp)\/url\?/,
      getURL(url) {
        return succeed((new URL(url)).searchParams.get('url') || url);
      }
    }
  ],
  normalizeURL(url) {
    if (url) {
      let target = this.REDIRECTORS.find(redirector => redirector.re.test(url));

      if (target) {
        return target.getURL(url).addErrback(() => url);
      }
    }

    return succeed(url);
  },
  extract(ctx, extractor) {
    let doc = ctx.document,
        originalURL = ctx.href;

    // ドキュメントタイトルを取得する
    {
      let title = '';

      if (typeof doc.title === 'string') {
        title = doc.title;
      } else {
        // idがtitleの要素を回避する
        let titleElm = doc.querySelector('head > title');

        if (titleElm) {
          title = titleElm.textContent;
        }
      }

      if (!title) {
        title = createURI(originalURL).fileBaseName;
      }

      ctx.title = title == null ? originalURL : title.trim();
    }

    // Canonical Linkが設定されていれば使う
    {
      let canonicalLink = doc.querySelector('link[rel="canonical"]');

      if (canonicalLink) {
        let canonicalURL = canonicalLink.href;

        if (canonicalURL) {
          let re;

          // ignoreCanonicalが不正な正規表現である時に処理が停止するのを防ぐ
          try {
            re = new RegExp(getPref('ignoreCanonical'));
          } catch (err) {
            Cu.reportError(err);
          }

          if (re && !re.test(originalURL)) {
            ctx.href = (new URL(canonicalURL, originalURL)).href;
          }
        }
      }
    }

    return withWindow(ctx.window, () => maybeDeferred(
      // currentDocument()などの為に、
      // このwithWindow()内でextractor.extract()を必ず同期的に実行しなければならない
      extractor.extract(ctx)
    )).addCallback(originalPS =>
      originalPS ? this.normalizeURL(originalPS.itemUrl).addCallback(url =>
        Object.assign({
          page    : ctx.title,
          pageUrl : ctx.href
        }, originalPS, {
          itemUrl : url
        })
      ) : {}
    );
  }
}));
// for Patch Compatibility
Tombfix.Service.extractors = Extractors;

Extractors.register([
  {
    name : 'Amazon',
    ICON : 'https://www.amazon.com/favicon.ico',
    preCheck(ctx) {
      // FIXME: this check code should be strict.
      return /amazon\./.test(ctx.hostname) && this.getASIN(ctx);
    },
    extract(ctx) {
      let doc = ctx.document,
          // 日本に特化(comの取得方法不明)
          date = new Date(doc.body.innerHTML.extract(
            '発売日：.*?</b>.*?([\\d/]+)'
          ));

      if (!Number.isNaN(Number(date))) {
        ctx.date = date;
      }

      ctx.href = this.normalizeURL(ctx.hostname, this.getASIN(ctx));

      let productTitleElm = doc.querySelector(
        'span[id="productTitle"], span[id="btAsinTitle"]'
      );

      if (productTitleElm) {
        let productTitle = productTitleElm.textContent;

        if (productTitle) {
          ctx.title = 'Amazon: ' + productTitle.trim();

          let authorNames = this.getAuthorNames(doc);

          if (authorNames.length) {
            ctx.title += ': ' + authorNames.join(', ');
          }
        }
      }
    },
    getASIN(ctx) {
      let asinElm = ctx.document.querySelector(
        'input[name="ASIN"], input[name="ASIN.0"], input[name="idx.asin"]'
      );

      return asinElm ? asinElm.value : '';
    },
    normalizeURL(hostname, asin) {
      let url = `http://${hostname}/dp/${asin}`,
          associateID = getPref('amazonAffiliateId');

      return associateID ? url + '?tag=' + associateID : url;
    },
    getAuthorNames(doc) {
      return [...doc.querySelectorAll([
        'a.contributorNameID',
        '.author > a',
        '.buying > .parseasinTitle ~ a',
        '.buying > .parseasinTitle + span > a',
        '.buying .contributorNameTrigger > a',
        '#brand',
        '.brandLink > a'
      ].join(', '))].reduce((arr, author) => {
        let authorName = author.textContent.trim();

        if (authorName) {
          arr.push(authorName);
        }

        return arr;
      }, []);
    }
  },
  {
    name: 'ReBlog',
    ICON: 'chrome://tombfix/skin/reblog.ico',
    CONVERTERS: {
      regular: {
        data: info => ({
          'post[two]': info.reblogTree + info['post[two]']
        }),
        ps: info => ({
          type: 'quote',
          body: getFlavoredString(info['post[two]'])
        })
      },
      photo: {
        data: info => ({
          'post[two]': info.reblogTree + info['post[two]']
        }),
        ps: info => ({
          itemUrl: info.photos[0].original_size.url
          // body: getFlavoredString(info['post[two]'])
        })
      },
      quote: {
        data: info => ({
          'post[two]': info['post[two]']
        }),
        ps: info => ({
          body: getFlavoredString(info['post[one]'])
        })
      },
      link: {
        data: info => ({
          'post[three]': info.reblogTree + info['post[three]']
        }),
        ps: () => ({
          // body: getFlavoredString(info['post[three]'])
        })
      },
      conversation: {
        data: () => ({}),
        ps: info => ({
          item: info['post[one]']
          // body: info['post[two]']
        })
      },
      video: {
        data: info => ({
          'post[two]': info.reblogTree + info['post[two]']
        }),
        ps: () => ({
          // body: getFlavoredString(info['post[two]'])
        })
      }
    },
    extract(ctx, options) {
      return this.getInfo(ctx, options).addCallback(({apiInfo, svcInfo}) => {
        let postType = svcInfo.type;
        let converter = this.CONVERTERS[postType];
        let data = {
          reblog: true,
          reblog_key: apiInfo.reblog_key,
          reblog_post_id: options.postID,
          'post[type]': postType,
          'post[one]': svcInfo.one || '',
          'post[two]': svcInfo.two || '',
          'post[three]': svcInfo.three || ''
        };
        let info = Object.assign({
          reblogTree: svcInfo.reblog_tree || ''
        }, data);

        if (getPref('model.tumblr.trimReblogInfo')) {
          info = this.trimReblogInfo(info);
        }

        return Object.assign({
          type: postType,
          item: ctx.title,
          itemUrl: ctx.href,
          favorite: {
            name: 'Tumblr',
            form: Object.assign(data, converter.data(info)),
            info
          }
        }, converter.ps(Object.assign({
          photos: apiInfo.photos
        }, data)));
      });
    },
    getInfo(ctx, options) {
      let {url, postID} = options;

      if (!postID) {
        postID = options.postID = this.getPostID(url);
      }

      return this.getAPIInfo(url, postID).addCallback(apiInfo =>
        new DeferredHash(Object.assign({
          reblogPostInfo: Tumblr.getReblogPostInfo(postID, apiInfo.reblog_key)
        }, options.override ? {
          entryPage: this.overridePageInfo(ctx, url)
        } : {})).addCallback(({reblogPostInfo}) => {
          let svcInfo = reblogPostInfo[1];

          if (!reblogPostInfo[0]) {
            throw svcInfo;
          }

          return {apiInfo, svcInfo};
        })
      );
    },
    getPostID(url, special) {
      if (url) {
        let {pathname} = new URL(url);

        if (special) {
          return pathname.extract(/^\/(?:(?:post|image)\/)?(\d+)/);
        }

        return pathname.extract(/^\/(?:post|image)\/(\d+)/);
      }

      return '';
    },
    getNoSlugURL(url) {
      let urlObj = new URL(url);

      urlObj.pathname = urlObj.pathname.split('/').slice(0, 3).join('/');

      return urlObj.toString();
    },
    getIframe(doc) {
      // for XML page
      if (!(doc && doc.body)) {
        return null;
      }

      let iframe = doc.querySelector('iframe#tumblr_controls');

      if (iframe) {
        let {src} = iframe;

        if (src && (new URL(src)).hostname.endsWith('.tumblr.com')) {
          return iframe;
        }
      }

      return doc.querySelector('iframe.tmblr-iframe');
    },
    getAPIInfo(url, postID) {
      return Tumblr.getPostInfo((new URL(url)).hostname, postID).addErrback(
        () => {
          throw new Error(getMessage('error.contentsNotFound'));
        }
      ).addCallback(apiInfo => {
        let postType = apiInfo.type
          .replace(/^text$/, 'regular')
          .replace(/^chat$/, 'conversation');

        if (!this.CONVERTERS[postType]) {
          throw new Error(getMessage('error.contentsTypeNotSupported'));
        }

        return apiInfo;
      });
    },
    overridePageInfo(ctx, url) {
      return request(this.getNoSlugURL(url), {
        responseType: 'document'
      }).addCallback(({response: doc}) => {
        ctx.title = doc.title;
        ctx.href = getCanonicalURL(doc) || url;
      });
    },
    getDataList(info) {
      let converter = this.CONVERTERS[info['post[type]']];

      if (converter) {
        let key = Object.keys(converter.data(info))[0];

        if (key) {
          let val = info[key];

          if (val) {
            return [key, val];
          }
        }
      }

      return [];
    },
    trimReblogInfo(info) {
      let {reblogTree} = info;

      if (reblogTree) {
        info.reblogTree = this.trimReblogTree(reblogTree);
      }

      let list = this.getDataList(info);

      if (list.length) {
        info[list[0]] = this.trimReblogSource(list[1]);
      }

      return info;
    },
    trimReblogTree(html) {
      return (function removeBlockquote(all, contents) {
        return contents.replace(
          /<blockquote>(([\n\r]|.)+)<\/blockquote>/gm,
          removeBlockquote
        );
      }(
        null,
        html.replace(/<p><\/p>/g, '').replace(/<p><a[^<]+<\/a>:<\/p>/g, '')
      )).trim();
    },
    trimReblogSource(html) {
      let str = html;
      let strictVia = [
        '\\(via (?:<a class="tumblr_blog" href="[^"]+">[^<]+</a>',
        '<a href="[^"]+" class="tumblr_blog">[^<]+</a>)\\)'
      ].join('|');

      if ((new RegExp(strictVia)).test(str)) {
        str = str
          .replace(new RegExp(` ${strictVia}`, 'g'), '')
          .replace(new RegExp(strictVia.wrapTag('p'), 'g'), '');
      }

      let via = 'via <a[^<]+</a>(?:, <a[^<]+</a>)?';

      if (!(new RegExp(via)).test(str)) {
        return str;
      }

      return html
        .replace(new RegExp(`\\(${via}\\)`.wrapTag('p'), 'g'), '')
        .replace(new RegExp(
          ` *(?:\\(|\\(</p>\\n<p>)${via}(?:\\)|</p>\\n<p>\\)) *`,
          'g'
        ), '</p>\n\n<p>')
        .replace(/<p>\n*<\/p>/g, '')
        .replace(/<p>\n+/g, '<p>')
        .replace(/\n+<\/p>/g, '</p>')
        .replace(/\n\n+/g, '\n\n').trim();
    }
  }
]);

Extractors.register([
  {
    name     : 'LDR',
    PARAM_RE : new RegExp(
      '[?&;]' +
        '(?:fr?(?:om)?|track|ref|FM)=(?:r(?:ss(?:all)?|df)|atom)' +
        '(?:[&;].*)?'
    ),
    getItem(ctx) {
      if (
        ctx.host === 'reader.livedoor.com' &&
          ctx.pathname === '/reader/'
      ) {
        let {target} = ctx;

        if (target) {
          return target.closest('.item');
        }
      }
    },
    getInfo(ctx) {
      let item = this.getItem(ctx);

      if (!item) {
        return;
      }

      let info = {},
        itemTitle = item.querySelector('.item_title > a');

      info.title = itemTitle ? itemTitle.textContent : '';

      let permalink = item.querySelector('.item_info > a');

      info.href = permalink ?
        permalink.href.replace(this.PARAM_RE, '') :
        '';

      if (!info.href) {
        let feedTitle = this.getFeedTitle(ctx);

        info.href = feedTitle ? feedTitle.href : '';

        if (!info.href && itemTitle) {
          info.href = itemTitle.href;
        }
        if (!info.href) {
          info.href = ctx.href;
        }
      }

      let author = item.querySelector('.author');

      info.author = author ? author.textContent.replace('by ', '') : '';

      return info;
    },
    overwriteCTX(ctx) {
      let info = this.getInfo(ctx);

      if (info) {
        let feedTitle = this.getFeedTitle(ctx);

        ctx.title = feedTitle ?
          feedTitle.textContent + (info.title && ' - ' + info.title) :
          info.title;

        ctx.href = info.href;
        ctx.host = (new URL(info.href)).hostname;
      }

      return ctx;
    },
    getFeedTitle(ctx) {
      return ctx.document.querySelector('.title a');
    }
  },

  {
    name : 'Quote - LDR',
    ICON : 'http://reader.livedoor.com/favicon.ico',
    check(ctx) {
      return ctx.selection && !ctx.onImage && Extractors.LDR.getItem(ctx);
    },
    extract(ctx) {
      return Extractors.Quote.extract(Extractors.LDR.overwriteCTX(ctx));
    }
  },

  {
    name : 'ReBlog - LDR',
    ICON : 'http://reader.livedoor.com/favicon.ico',
    check(ctx) {
      if (ctx.selection || (ctx.onLink && !ctx.onImage)) {
        return;
      }

      let info = Extractors.LDR.getInfo(ctx);

      if (!info) {
        return;
      }

      if (/^[^.]+\.tumblr\.com$/.test((new URL(info.href)).hostname)) {
        return true;
      }

      if (ctx.onImage) {
        let {src} = ctx.target;

        if (src) {
          return (new URL(src)).hostname === 'data.tumblr.com';
        }
      }
    },
    extract(ctx) {
      Extractors.LDR.overwriteCTX(ctx);

      return Extractors.ReBlog.extract(ctx, {
        url      : ctx.href,
        override : true
      });
    }
  },

  {
    name : 'Photo - LDR(FFFFOUND!)',
    ICON : 'http://reader.livedoor.com/favicon.ico',
    check(ctx) {
      if (!ctx.selection && ctx.onImage) {
        let info = Extractors.LDR.getInfo(ctx);

        if (info) {
          return (new URL(info.href)).hostname === 'ffffound.com';
        }
      }
    },
    extract(ctx) {
      let info = Extractors.LDR.getInfo(ctx);

      Extractors.LDR.overwriteCTX(ctx);

      let uriObj = createURI(info.href);

      ctx.href = uriObj.prePath + uriObj.filePath;

      let {author} = info;

      return {
        type      : 'photo',
        item      : info.title,
        itemUrl   : ctx.target.src,
        author    : author,
        authorUrl : 'http://ffffound.com/home/' + author + '/found/',
        favorite  : {
          name : 'FFFFOUND',
          id   : ctx.href.split('/').pop()
        }
      };
    }
  },

  {
    name : 'Photo - LDR',
    ICON : 'http://reader.livedoor.com/favicon.ico',
    check(ctx) {
      return !ctx.selection && ctx.onImage && Extractors.LDR.getItem(ctx);
    },
    extract(ctx) {
      Extractors.LDR.overwriteCTX(ctx);

      return Extractors.check(ctx)[0].extract(ctx);
    }
  },

  {
    name : 'Link - LDR',
    ICON : 'http://reader.livedoor.com/favicon.ico',
    check(ctx) {
      return !(ctx.selection || ctx.onImage || ctx.onLink) &&
        Extractors.LDR.getItem(ctx);
    },
    extract(ctx) {
      return Extractors.Link.extract(Extractors.LDR.overwriteCTX(ctx));
    }
  },

  {
    name         : 'Quote - Twitter',
    ICON         : Twitter.ICON,
    TWEET_URL_RE : /^https?:\/\/twitter\.com\/(.+?)\/status(?:es)?\/(\d+)/,
    check(ctx) {
      return !ctx.onImage && !ctx.onVideo && !(ctx.onLink && !ctx.selection) &&
        this.TWEET_URL_RE.test(ctx.href) && this.getTweet(ctx);
    },
    extract(ctx) {
      let url = ctx.href;

      return {
        type     : 'quote',
        item     : 'Twitter / ' + url.extract(this.TWEET_URL_RE),
        itemUrl  : url,
        body     : this.getCustomFlavoredString(
          ctx.selection ?
            ctx.window.getSelection() :
            this.modifyTweet(this.getTweet(ctx), ctx)
        ),
        favorite : {
          name : 'Twitter',
          id   : url.extract(this.TWEET_URL_RE, 2)
        }
      };
    },
    getTweet(ctx) {
      return ctx.document.querySelector('.permalink-tweet .tweet-text');
    },
    getCustomFlavoredString(src) {
      return Object.assign(new String(
        src instanceof Element ? src.textContent : convertToPlainText(src)
      ), {
        flavors : {
          html : convertToHTMLString(src, true)
        }
      });
    },
    modifyTweet(elm, ctx) {
      let cloneElm = elm.cloneNode(true);

      for (let tcoEllipsis of cloneElm.querySelectorAll('.tco-ellipsis')) {
        tcoEllipsis.remove();
      }

      for (let link of cloneElm.querySelectorAll('a.twitter-timeline-link')) {
        let firstInvisible = link.querySelector('.invisible');

        if (
          firstInvisible &&
            this.TWEET_URL_RE.test(firstInvisible.textContent) &&
            link.querySelector('.js-display-url')
        ) {
          firstInvisible.remove();
        }
      }

      let doc = ctx.document;

      for (let emoji of cloneElm.querySelectorAll('img.twitter-emoji[alt]')) {
        let {alt} = emoji;

        if (alt) {
          emoji.parentNode.insertBefore(doc.createTextNode(alt), emoji);
          emoji.remove();
        }
      }

      return cloneElm;
    }
  },

  {
    name : 'Quote - inyo.jp',
    ICON : 'chrome://tombfix/skin/quote.png',
    check : function(ctx){
      return ctx.href.match('//inyo.jp/quote/[a-f0-9]+');
    },
    extract : function(ctx){
      return {
        type     : 'quote',
        item     : $x('//span[@class="title"]/text()'),
        itemUrl  : ctx.href,
        body     : createFlavoredString((ctx.selection)?
          ctx.window.getSelection() : $x('//blockquote[contains(@class, "text")]/p')),
      }
    },
  },

  {
    name : 'Photo - Amazon',
    ICON : Extractors.Amazon.ICON,
    check(ctx) {
      if (ctx.selection || !Extractors.Amazon.preCheck(ctx)) {
        return;
      }

      let {target} = ctx;

      if (!target) {
        return;
      }

      let src = $x([
        `self::img[${[
          '@id="imgBlkFront"', '@id="imgBlkBack"', '@id="igImage"',
          '@id="prodImage"', '@id="main-image"',
          'contains(concat(" ", (@class), " "), " fullScreen ")',
          '@name="coverimage"'
        ].join(' or ')}]/@src`,
        `./ancestor::*[${[
          '@id="prodImageCell"',
          'contains(concat(" ", (@class), " "), " imgTagWrapper ")',
          'contains(concat(" ", (@class), " "), " pageImage ")',
          '@id="main-image-wrapper"'
        ].join(' or ')}]//img/@src`
      ].join('|'), target);

      return src && !/\/comingsoon_|\/no-img-/.test(src);
    },
    extract(ctx) {
      Extractors.Amazon.extract(ctx);

      return this.getImageURL(ctx).addCallback(url => ({
        type    : 'photo',
        item    : ctx.title,
        itemUrl : url
      }));
    },
    getImageURL(ctx) {
      let targetURL = this.getTargetURL(ctx);

      if ((new URL(targetURL)).hostname.endsWith('.cloudfront.net')) {
        return succeed(targetURL);
      }

      let mainThumb = this.getMainImageThumbnail(ctx);

      if (
        mainThumb &&
          this.getImageID(targetURL) !== this.getImageID(mainThumb.src)
      ) {
        return succeed(this.getLargeImageURL(ctx));
      }

      return this.loadImage(ctx);
    },
    getTargetURL(ctx) {
      let {target} = ctx,
          url = target.src;

      // 拡大レンズなど画像以外の要素か?
      if (!url) {
        url = $x('../img/@src', target);
      }

      if (url.startsWith('data:image/')) {
        let mainImage = this.getMainImageThumbnail(ctx);

        if (mainImage) {
          url = mainImage.src;
        }
      }

      return url;
    },
    getMainImageThumbnail(ctx) {
      return ctx.document.querySelector([
        '#imgThumbs img', '#thumb_strip img', '#altImages img',
        '#thumbs-image > img'
      ].join(', '));
    },
    getImageID(url) {
      return (new URL(url)).pathname.extract(/^\/images\/[A-Z]\/(.+?)\./);
    },
    getLargeImageURL(ctx) {
      let urlObj = new URL(this.getTargetURL(ctx)),
          pathnameFragment = urlObj.pathname.split('.');

      if (pathnameFragment.length > 2) {
        pathnameFragment.splice(-2, 1, 'LZZZZZZZ');
      } else {
        pathnameFragment.splice(1, 0, 'LZZZZZZZ');
      }

      // カスタマーイメージ用
      urlObj.pathname = pathnameFragment.join('.').replace(
        '.L.LZZZZZZZ.',
        '.L.'
      );

      return urlObj.toString();
    },
    loadImage(ctx) {
      let deferred = new Deferred(),
          img = ctx.document.createElement('img');

      img.addEventListener('load', () => {
        // 画像が存在しない場合1ピクセル四方の画像が返される
        deferred.callback(
          img.width < 50 && img.height < 50 ?
            this.getLargeImageURL(ctx) :
            img.src
        );
      });
      // 画像が存在していてもエラーになることがある
      img.addEventListener('error', () => {
        deferred.callback(this.getLargeImageURL(ctx));
      });

      // tools4hack
      // http://tools4hack.santalab.me/new-ipad-get-largeartwork-amazon-img.html
      img.src = `http://z-ecx.images-amazon.com/images/P/${
        Extractors.Amazon.getASIN(ctx)
      }.09.MAIN._FMpng_SCRMZZZZZZ_.png`;

      return deferred;
    }
  },

  {
    name : 'Quote - Amazon',
    ICON : Extractors.Amazon.ICON,
    check(ctx) {
      return ctx.selection && !ctx.onImage && Extractors.Amazon.preCheck(ctx);
    },
    extract(ctx) {
      Extractors.Amazon.extract(ctx);

      return Extractors.Quote.extract(ctx);
    }
  },

  {
    name : 'Link - Amazon',
    ICON : Extractors.Amazon.ICON,
    check(ctx) {
      return !(ctx.selection || ctx.onImage || ctx.onLink) &&
        Extractors.Amazon.preCheck(ctx);
    },
    extract(ctx) {
      Extractors.Amazon.extract(ctx);

      return Extractors.Link.extract(ctx);
    }
  },

  {
    name: 'ReBlog - Tumblr',
    ICON: Extractors.ReBlog.ICON,
    check(ctx) {
      return !(ctx.selection || ctx.onImage || ctx.onLink) &&
        Extractors.ReBlog.getIframe(ctx.document) &&
        Extractors.ReBlog.getPostID(ctx.href, true);
    },
    extract(ctx) {
      let url = ctx.href;

      return Extractors.ReBlog.extract(ctx, {
        url,
        postID: Extractors.ReBlog.getPostID(url, true)
      });
    }
  },

  {
    name: 'ReBlog - Dashboard',
    ICON: Extractors.ReBlog.ICON,
    check(ctx) {
      return ctx.hostname.endsWith('.tumblr.com') && !ctx.selection &&
        Extractors.ReBlog.getPostID(this.getPermalinkURL(ctx), true);
    },
    extract(ctx) {
      let url = this.getPermalinkURL(ctx);

      return Extractors.ReBlog.extract(ctx, {
        url,
        postID: Extractors.ReBlog.getPostID(url, true),
        override: true
      });
    },
    getPermalinkURL(ctx) {
      let {target} = ctx;

      if (!target) {
        return '';
      }

      let post = target.closest('.post');

      if (!post) {
        return '';
      }

      let link = post.querySelector('a[id^="permalink_"]');

      if (link) {
        return link.href;
      }

      let {json} = post.dataset;

      if (JSON.parseable(json)) {
        let data = JSON.parse(json).share_popover_data;

        if (data) {
          return data.post_url;
        }
      }

      return '';
    }
  },

  {
    name: 'ReBlog - Tumblr link',
    ICON: Extractors.ReBlog.ICON,
    check(ctx) {
      return !ctx.selection && ctx.onLink &&
        Extractors.ReBlog.getPostID(ctx.link.href);
    },
    extract(ctx) {
      return Extractors.ReBlog.extract(ctx, {
        url: ctx.link.href,
        override: true
      });
    }
  },

  {
    name : 'Photo - Ameba blog',
    ICON : 'http://ameblo.jp/favicon.ico',
    check : function(ctx){
      return ctx.onLink &&
        ctx.host == ('ameblo.jp') &&
        ctx.onImage &&
        ctx.target.src.match(/\/t[0-9]+_/);
    },
    extract : function(ctx){
      return {
        type    : 'photo',
        item    : ctx.title,
        itemUrl : ctx.target.src.replace(/(\/t[0-9]+_)/, '/o'),
      };
    },
  },

  {
    name          : 'Photo - Flickr',
    ICON          : Models.Flickr.ICON,
    // via https://www.flickr.com/services/api/misc.urls.html
    PHOTO_PAGE_RE : new RegExp(
      '^(https?://(?:www\\.)?flickr\\.com/photos/[^/]+/)(\\d+)'
    ),
    IMAGE_RE      : new RegExp(
      '^https?://(?:[^/.]+\\.)?static\\.?flickr\\.com' +
        '/\\d+(?:/\\d+)?/(\\d+)_'
    ),
    // via https://www.flickr.com/groups/api/discuss/72157616713786392/
    SHORT_RE      : /^https?:\/\/flic\.kr\/p(?:\/img)?\/([^\/._?#]+)/,
    check(ctx) {
      return !ctx.selection && this.getPhotoID(ctx);
    },
    extract(ctx) {
      let photoID = this.getPhotoID(ctx);

      return new DeferredHash({
        info  : Flickr.getInfo(photoID),
        sizes : Flickr.getSizes(photoID)
      }).addCallback(ress => {
        let [success, info] = ress.info;

        if (!success) {
          throw new Error(info.message);
        }

        let title = info.title._content || 'Untitled';

        ctx.title = title + ' on Flickr';
        ctx.href  = info.urls.url[0]._content;

        return {
          type      : 'photo',
          item      : title,
          itemUrl   : this.getImageURL(ress.sizes[1]),
          author    : info.owner.username,
          authorUrl : ctx.href.extract(this.PHOTO_PAGE_RE),
          favorite  : {
            name : 'Flickr',
            id   : photoID
          }
        };
      });
    },
    getPhotoID(ctx) {
      let targetURL = ctx.onLink ? ctx.link.href : ctx.href;

      if (this.PHOTO_PAGE_RE.test(ctx.href)) {
        if (ctx.document.querySelector('.error-404-page-view')) {
          return;
        }

        let {target} = ctx;

        if (target && target.closest('.photo-well-scrappy-view')) {
          targetURL = ctx.href;
        }
      }

      let imageURL = ctx.onImage ? ctx.target.src : (
        ctx.hasBGImage ? ctx.bgImageURL : ''
      );

      for (let url of [imageURL, targetURL]) {
        if (url) {
          let photoID = url.extract(this.PHOTO_PAGE_RE, 2) ||
            url.extract(this.IMAGE_RE) ||
            String(this.decodeBase58(url.extract(this.SHORT_RE)));

          if (0 < Number(photoID)) {
            return photoID;
          }
        }
      }
    },
    // via http://d.hatena.ne.jp/NeoCat/20091228/1262015896
    decodeBase58(str) {
      let base58Letters = '123456789' +
          'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ',
        num = 0;

      for (let len = str.length, multi = 1; len; len -= 1, multi *= 58) {
        num += base58Letters.indexOf(str[len - 1]) * multi;
      }

      return num;
    },
    getImageURL(sizes) {
      let limitSize = getPref('extractor.photo.flickr.limitSize'),
        limit = Number(limitSize),
        url;

      for (let size of sizes.slice().reverse()) {
        if (size.media === 'photo') {
          url = size.source;

          if (limitSize) {
            if (size.width <= limit && size.height <= limit) {
              return url;
            }
          } else {
            return url;
          }
        }
      }

      return url;
    }
  },

  {
    name : 'Photo - Google Book Search',
    ICON : Models.Google.ICON,
    check : function(ctx){
      if(!(/^books.google./).test(ctx.host))
        return;

      return !!this.getImage(ctx);
    },
    extract : function(ctx){
      ctx.target = this.getImage(ctx);

      return Extractors['Photo - Upload from Cache'].extract(ctx);
    },
    getImage : function(ctx){
      // 標準モード
      var img = $x('./ancestor::div[@class="pageImageDisplay"]//img[contains(@src, "//books.google.")]', ctx.target);
      if(img)
        return img;

      // HTMLモード
      var div = $x('./ancestor::div[@class="html_page_image"]', ctx.target);
      if(div){
        var img = new Image();
        img.src = getStyle(div, 'background-image').replace(/url\((.*)\)/, '$1');

        return img;
      }
    },
  },

  {
    name : 'Photo - Kiva',
    ICON : 'http://www.kiva.org/favicon.ico',
    check : function(ctx){
      return (ctx.onImage && this.isOriginalUrl(ctx.target.src)) ||
        (ctx.onLink && this.isOriginalUrl(ctx.link.href));
    },
    extract : function(ctx){
      return this.getFinalUrl(ctx.onLink? ctx.link.href : ctx.target.src).addCallback(function(url){
        return {
          type    : 'photo',
          item    : ctx.title,
          itemUrl : url,
        }
      });
    },
    isOriginalUrl : function(url){
      return /^http:\/\/www\.kiva\.org\/img\//.test(url);
    },
    getFinalUrl : function(original){
      var self = this;
      return getFinalUrl(original).addCallback(function(url){
        // ホスティングサイトに変わったか?
        if(!self.isOriginalUrl(url))
          return url;

        // s3と仮定してテストしてみる
        return getFinalUrl(original.replace('www', 's3'));
      }).addErrback(function(){
        return original;
      });
    },
  },

  {
    name : 'Photo - We Heart It',
    ICON : WeHeartIt.ICON,
    RE   : new RegExp(
      '^https?://' +
        '(?:data\\d+\\.whicdn\\.com/images|weheartit\\.com/entry)/\\d+'
    ),

    check   : function (ctx) {
      if (!ctx.selection) {
        let doc = ctx.document;

        if (
          /^image/.test(doc.contentType) || !this.RE.test(ctx.href) ||
          doc.querySelector('meta[itemprop="url"]')
        ) {
          return this.getEntryID(ctx);
        }
      }
    },
    extract : function (ctx) {
      var id = this.getEntryID(ctx),
        url = WeHeartIt.ENTRY_URL + id;

      return request(url, {
        responseType : 'document'
      }).addCallback(({response : doc}) => {
        var ps = {},
          {title} = doc,
          author = doc.querySelector('a[itemprop="provider"]');

        if (author) {
          update(ps, {
            author    : author.querySelector('.avatar').title,
            authorUrl : author.href
          });
        }

        ctx.title = title;
        ctx.href = url;

        return update(ps, {
          type      : 'photo',
          item      : title,
          itemUrl   : doc.querySelector('meta[property="og:image"]').content,
          favorite  : {
            name : 'WeHeartIt',
            id   : id
          }
        });
      });
    },
    getEntryID : function (ctx) {
      var url = ctx.onImage ? ctx.target.src : (
        ctx.onLink ? ctx.link.href : ctx.href
      );

      if (this.RE.test(url)) {
        return url.extract(/\/(\d+)/);
      }
    }
  },

  {
    name : 'Photo - Fishki.Net',
    ICON : 'http://de.fishki.net/favicon.ico',
    check : function(ctx){
      return ctx.onImage &&
        ctx.target.src.match('//fishki.net/');
    },
    extract : function(ctx){
      return {
        type    : 'photo',
        item    : ctx.title,
        itemUrl : ctx.target.src.replace('//fishki.net/', '//de.fishki.net/'),
      }
    },
  },

  {
    name : 'Photo - Google',
    ICON : Models.Google.ICON,
    check : function(ctx){
      return (ctx.onLink && ctx.link.href.match('http://lh..(google.ca|ggpht.com)/.*(png|gif|jpe?g)$'));
    },
    extract : function(ctx){
      return request(ctx.link.href).addCallback(function(res){
        return {
          type    : 'photo',
          item    : ctx.title,
          itemUrl : $x('//img[1]', convertToHTMLDocument(res.responseText)).src,
        }
      });
    },
  },

  {
    name : 'Photo - 1101.com/ajisha',
    ICON : 'http://www.1101.com/favicon.ico',
    check : function(ctx){
      return (ctx.onLink && ctx.link.href.match('http://www.1101.com/ajisha/p_.*.html'));
    },
    extract : function(ctx){
      return {
        type      : 'photo',
        item      : ctx.title,
        itemUrl   : ctx.link.href.replace(
          new RegExp('http://www.1101.com/ajisha/p_(.+).html'),
          'http://www.1101.com/ajisha/photo/p_$1_z.jpg'),
      }
    },
  },

  {
    name : 'Photo - Picasa',
    ICON : 'http://picasaweb.google.com/favicon.ico',
    check : function(ctx){
      return (/picasaweb\.google\./).test(ctx.host) && ctx.onImage;
    },
    extract : function(ctx){
      var item = $x('//span[@class="gphoto-context-current"]/text()') || $x('//div[@class="lhcl_albumtitle"]/text()') || '';
      return {
        type      : 'photo',
        item      : item.trim(),
        itemUrl   : ctx.target.src.replace(/\?.*/, ''),
        author    : $x('id("lhid_user_nickname")/text()').trim(),
        authorUrl : $x('id("lhid_portraitlink")/@href'),
      }
    },
  },

  {
    name : 'Photo - webshots',
    ICON : 'chrome://tombfix/skin/photo.png',
    check : function(ctx){
      return ctx.host.match('^.+\.webshots\.com') && this.getAuthor();
    },
    extract : function(ctx){
      var author = this.getAuthor();
      return {
        type      : 'photo',
        item      : $x('//div[@class="media-info"]/h1/text()'),
        itemUrl   : $x('//li[@class="fullsize first"]/a/@href'),
        author    : author.textContent.trim(),
        authorUrl : author.href,
      }
    },
    getAuthor : function(){
      return $x('(//img[@class="user-photo"])[1]/ancestor::a');
    },
  },

  {
    name : 'Photo - Blogger',
    ICON : 'https://www.blogger.com/favicon.ico',
    check : function(ctx){
      return ctx.onLink &&
        (''+ctx.link).match(/(png|gif|jpe?g)$/i) &&
        (''+ctx.link).match(/(blogger|blogspot)\.com\/.*\/s\d{2,}-h\//);
    },
    extract : function(ctx){
      return {
        type    : 'photo',
        item    : ctx.title,
        itemUrl : (''+ctx.link).replace(/\/(s\d{2,})-h\//, '/$1/'),
      }
    },
  },

  {
    name : 'Photo - Shorpy',
    ICON : 'http://www.shorpy.com/favicon.ico',
    check : function(ctx){
      return ctx.onImage &&
        ctx.target.src.match(/www.shorpy.com\/.*.preview\.jpg/i);
    },
    extract : function(ctx){
      return {
        type    : 'photo',
        item    : ctx.title,
        itemUrl : ctx.target.src.replace('\.preview\.jpg', '.jpg'),
      }
    },
  },

  {
    name : 'Photo - FFFFOUND!',
    ICON : Models.FFFFOUND.ICON,
    check : function(ctx){
      return (ctx.href.match('http://ffffound.com/image/') && (/^asset/).test(ctx.target.id)) ||
        (ctx.onLink && ctx.link.href.match('http://ffffound.com/image/'));
    },
    extract : function(ctx){
      if(ctx.href.match('http://ffffound.com/image/') && (/^asset/).test(ctx.target.id)){
        var d = succeed(currentDocument());
      } else {
        var d = request(ctx.link.href).addCallback(function(res){
          // 相対パスを処理するためdocumentを渡す
          var doc = convertToHTMLDocument(res.responseText, ctx.document);

          ctx.href = ctx.link.href;
          ctx.target = $x('(//img[starts-with(@id, "asset")])', doc);

          return doc;
        })
      }

      d.addCallback(function(doc){
        var author = $x('//div[@class="saved_by"]/a[1]', doc);
        ctx.title = $x('//title/text()', doc) || '';

        var uri = createURI(ctx.href);
        ctx.href = uri.prePath + uri.filePath;

        return {
          type      : 'photo',
          item      : $x('//div[@class="title"]/a/text()', doc).trim(),
          itemUrl   : ctx.target.src.replace(/_m(\..{3})$/, '$1'),
          author    : author.textContent,
          authorUrl : author.href,
          favorite  : {
            name : 'FFFFOUND',
            id   : ctx.href.split('/').pop(),
          },
        }
      });

      return d;
    },
  },

  {
    name : 'Photo - Google Image Search',
    ICON : Google.ICON,
    check(ctx) {
      if (
        /^www\.google\.(?:co\.jp|com)$/.test(ctx.hostname) &&
          ctx.pathname === '/search' &&
          queryHash(ctx.search).tbm === 'isch' &&
          !ctx.selection && ctx.onImage && ctx.onLink
      ) {
        let urls = this.getURLs(ctx);

        return urls.imgurl && urls.imgrefurl;
      }
    },
    extract(ctx) {
      let {imgurl : itemUrl, imgrefurl} = this.getURLs(ctx);

      ctx.href = imgrefurl;

      return request(imgrefurl, {
        responseType : 'document'
      }).addCallback(({response : doc}) => {
        ctx.title = doc.title || createURI(itemUrl).fileName;

        return {
          type    : 'photo',
          item    : ctx.title,
          itemUrl : itemUrl
        };
      });
    },
    getURLs(ctx) {
      let {imgurl, imgrefurl} = queryHash((new URL(
        $x('parent::a/@href', ctx.target)
      )).search);

      return {
        imgurl    : imgurl.unEscapeURI().unEscapeURI(),
        imgrefurl : imgrefurl.unEscapeURI().unEscapeURI()
      };
    }
  },

  {
    name : 'Photo - MediaWiki Thumbnail',
    ICON : 'http://www.mediawiki.org/favicon.ico',
    check : function (ctx) {
      if (ctx.onLink) {
        let {body} = ctx.document;

        // for XML page
        if (body && body.classList.contains('mediawiki')) {
          let uri = createURI(ctx.link.href);

          return /wiki\/.+:/.test(uri.path) &&
            /^(?:svg|png|gif|jpe?g)$/i.test(uri.fileExtension);
        }
      }
    },
    extract : function (ctx) {
      var uri = createURI(ctx.link.href);

      return request(uri.spec, {
        responseType : 'document'
      }).addCallback(({response : doc}) => {
        var anchor, url;

        // SVGの場合サムネイルを取得する
        if (/^svg$/i.test(uri.fileExtension)) {
          anchor = doc.querySelector(
            '#file .mw-filepage-other-resolutions > .mw-thumbnail-link:last-child'
          );

          if (!anchor) {
            let img = doc.querySelector('#file > a > img');

            if (img) {
              url = img.src;
            }
          }
        } else {
          anchor = doc.querySelector('#file > a');
        }
        if (anchor) {
          url = anchor.href;
        }

        return {
          type  : 'photo',
          item  : ctx.title,
          itemUrl : url ? uri.resolve(url) : ctx.target.src
        };
      });
    }
  },

  {
    name : 'Photo - ITmedia',
    ICON : 'http://www.itmedia.co.jp/favicon.ico',
    REFERRER: 'http://www.itmedia.co.jp/',
    check : function(ctx){
      return ctx.onLink && ctx.link.href.match('http://image.itmedia.co.jp/l/im/');
    },
    extract : function(ctx){
      ctx.target = {
        src : ctx.link.href.replace('/l/im/', '/'),
      };
      return downloadWithReferrer(ctx.target.src, this.REFERRER).addCallback(function(file){
        return {
          type    : 'photo',
          item    : ctx.title,
          itemUrl : ctx.target.src,
          file    : file
        };
      });
    }
  },

  {
    name : 'Photo - Cheezburger',
    ICON : 'chrome://tombfix/skin/photo.png',
    check : function(ctx){
      return ctx.onImage && /(thereifixedit\.files\.wordpress\.com|chzbgr\.com)/.test(ctx.target.src);
    },
    extract : function(ctx){
      var img = ctx.target;
      var src = capture(img, null, {
        w : img.naturalWidth,
        h : img.naturalHeight - 12,
      });
      return download(src, getTempDir(uriToFileName(ctx.href) + '.png')).addCallback(function(file){
        return {
          type : 'photo',
          item : ctx.title,
          file : file,
        }
      });
    },
  },

  {
    name : 'Photo - Tabelog',
    ICON : 'http://tabelog.com/favicon.ico',
    check : function(ctx){
      return /tabelog\.com/.test(ctx.host) && /link-(left|right)/.test(ctx.target.id);
    },
    extract : function(ctx){
      return {
        type    : 'photo',
        item    : ctx.title,
        itemUrl : $x('//p[@class="original-photo"]/a/@href'),
      }
    },
  },

  {
    name           : 'Photo - pixiv',
    ICON           : 'http://www.pixiv.net/favicon.ico',
    REFERRER       : 'http://www.pixiv.net/',
    PAGE_URL       : 'http://www.pixiv.net/member_illust.php' +
      '?mode=medium&illust_id=',
    PUBLIC_API_URL : 'https://public-api.secure.pixiv.net/v1/',
    TOKEN_API_URL  : 'https://oauth.secure.pixiv.net/v2/auth/token',
    DIR_IMG_RE     : new RegExp(
      '^https?://(?:[^.]+\\.)?(?:secure\\.)?pixiv\\.net/' +
        'img\\d+/(?:works/\\d+x\\d+|img)/[^/]+/' +
        '(?:mobile/)?(\\d+)(?:_p(\\d+)|_[^_]+)*\\.'
    ),
    DATE_IMG_RE    : new RegExp(
      '^https?://(?:[^.]+\\.)?(?:secure\\.)?pixiv\\.net/' +
        '(?:c/\\d+x\\d+/img-master|img-inf|img-original)' +
        '/img/\\d+/\\d+/\\d+/\\d+/\\d+/\\d+' +
        '/(\\d+)(?:-[\\da-f]{32})?(?:_(?:p|ugoira)(\\d+))?'
    ),
    IMG_PAGE_RE    : /^https?:\/\/(?:[^.]+\.)?pixiv\.net\/member_illust\.php/,
    // via http://help.pixiv.net/171/
    IMG_EXTENSIONS : ['jpg', 'png', 'gif', 'jpeg'],
    FIRST_BIG_P_ID : 11319936,
    CLIENT_ID      : 'bYGKuGVw91e0NMfPGp44euvGt59s',
    CLIENT_SECRET  : 'HP3RmkgAmEGro0gn1x9ioawQE8WMfvLXDz3ZqxpK',
    accessToken    : '',
    check(ctx) {
      return !ctx.selection && this.getIllustID(ctx);
    },
    extract(ctx) {
      let that = this,
          retry = true;

      return this.getInfo(ctx).addCallback(function getImage(info) {
        let {imageURL, pageTitle, illustID} = info;

        return downloadWithReferrer(
          imageURL,
          that.REFERRER
        ).addCallback(file => {
          ctx.title = pageTitle;
          ctx.href = that.PAGE_URL + illustID;

          return {
            type    : 'photo',
            item    : pageTitle,
            itemUrl : imageURL,
            file    : file
          };
        }).addErrback(err => {
          // when image extension is wrong
          if (retry) {
            retry = false;

            if (that.DATE_IMG_RE.test(imageURL)) {
              return that.fixImageExtensionFromList(info).addCallback(getImage);
            }
          }

          throw err;
        });
      });
    },
    getIllustID(ctx) {
      let imageURL = (ctx.onImage && ctx.target.src) || '',
          backgroundImageURL = (ctx.hasBGImage && ctx.bgImageURL) || '',
          targetURL = (ctx.onLink && ctx.link.href) || ctx.href || '';

      for (let url of [imageURL, backgroundImageURL, targetURL]) {
        if (this.DIR_IMG_RE.test(url) || this.DATE_IMG_RE.test(url)) {
          return url.extract(
            this.DIR_IMG_RE.test(url) ? this.DIR_IMG_RE : this.DATE_IMG_RE
          );
        }
      }

      if (
        this.isImagePage(ctx.link) || (
          !imageURL && targetURL === ctx.href && this.isImagePage(ctx) &&
            this.getImageURLFromDocument(ctx)
        )
      ) {
        return (new URL(targetURL)).searchParams.get('illust_id');
      }
    },
    getInfo(ctx) {
      let illustID = this.getIllustID(ctx);

      return this.getMediumPage(ctx, illustID).addCallback(doc => {
        let url = this.getImageURLFromDocument({document : doc}, illustID);

        if (
          !url || (!this.DIR_IMG_RE.test(url) && !this.DATE_IMG_RE.test(url))
        ) {
          // for limited access about mypixiv & age limit on login, and delete
          throw new Error(getMessage('error.contentsNotFound'));
        }

        let info = {
          imageURL  : url,
          pageTitle : doc.title,
          illustID  : illustID
        };

        return succeed().addCallback(() =>
          this.DATE_IMG_RE.test(url) && /\/img-inf\//.test(url) &&
            !this.isUgoiraPage(doc) ?
            this.getWorkInfo(illustID).addCallback(workInfo =>
              this.getOriginalImageURL(ctx, workInfo)
            ).addErrback(() => this.getLargeThumbnailURL(url)) :
            (this.getFullSizeImageURL(ctx, info, doc) || url)
        ).addCallback(imageURL => Object.assign(info, {imageURL}));
      });
    },
    getMediumPage(ctx, illustID) {
      if (!ctx.onImage && !ctx.onLink && this.isImagePage(ctx, 'medium')) {
        return succeed(ctx.document);
      }

      return request(this.PAGE_URL + illustID, {
        responseType : 'document'
      }).addCallback(({response : doc}) => doc);
    },
    isImagePage(target, mode) {
      if (target && this.IMG_PAGE_RE.test(target.href)) {
        let queries = queryHash(target.search);

        return Boolean(
          queries.illust_id && (mode ? queries.mode === mode : queries.mode)
        );
      }

      return false;
    },
    isUgoiraPage(doc) {
      return Boolean(doc.querySelector('._ugoku-illust-player-container'));
    },
    getImageURLFromDocument(ctx, illustID) {
      let img = this.getImageElement(ctx, illustID);

      if (img) {
        let url = img.src || img.dataset.src;

        if (url) {
          return url;
        }
      }

      let doc = ctx.document;

      if (this.isUgoiraPage(doc)) {
        let ogImage = doc.querySelector('meta[property="og:image"]');

        if (ogImage) {
          let url = ogImage.content;

          if (url) {
            return url;
          }
        }

        return this.getUgoiraImageURLFromDocument(doc);
      }

      return '';
    },
    getImageElement(ctx, illustID) {
      let currentIllustID = illustID || queryHash(ctx.search).illust_id,
          anchor = `a[href*="illust_id=${currentIllustID}"]`;

      return ctx.document.querySelector([
        // mode=medium on login
        anchor + ' > div > img',
        '.works_display > div > img',
        // mode=big and mode=manga_big on login
        'body > img:only-child',
        // mode=manga
        'img.image',
        // book(mode=manga)
        'div.image > img',
        // non-r18 illust on logout
        '.cool-work-main > .img-container > a.medium-image > img',
        // r18 on logout
        '.cool-work-main > .sensored > img',
        // ugoira on logout
        anchor + ` > img[src*="${currentIllustID}"]`
      ].join(', '));
    },
    getUgoiraImageURLFromDocument(doc) {
      let str = doc.body.innerHTML.extract(
        /pixiv\.context\.ugokuIllustFullscreenData\s*=\s*({.+});/
      );

      if (str) {
        let info = JSON.parse(str);

        if (info) {
          let {src} = info;

          if (src) {
            let urlObj = new URL(src);

            urlObj.pathname = urlObj.pathname
              .replace(/^\/img-zip-ugoira\//, '/img-original/')
              .replace(/_ugoira\d+x\d+\.zip$/, '_ugoira0.jpg');

            return urlObj.toString();
          }
        }
      }

      return '';
    },
    getLargeThumbnailURL(url) {
      let urlObj = new URL(url);

      urlObj.pathname = urlObj.pathname.replace(
        /(\/\d+(?:_[\da-f]{10})?_)[^_.]+\./,
        '$1s.'
      );

      return urlObj.toString();
    },
    getFullSizeImageURL(ctx, info, doc) {
      let cleanedURL = this.getCleanedURL(info.imageURL);

      if (!this.isOldIllustPage(cleanedURL, doc)) {
        let pageNum = this.getPageNumber(ctx);

        if (this.isUgoiraPage(doc)) {
          let urlObj = new URL(cleanedURL);

          urlObj.pathname = urlObj.pathname.replace(
            /^\/(?:c\/\d+x\d+\/img-master|img-inf)\//,
            '/img-original/'
          ).replace(
            /(\/\d+(?:-[\da-f]{32})?_)[^.\/]+\./,
            `$1ugoira${pageNum}.`
          );

          return urlObj.toString();
        }
        if (this.DIR_IMG_RE.test(cleanedURL)) {
          return cleanedURL.replace(
            /img\/[^\/]+\/\d+(?:_[\da-f]{10})?/,
            '$&_' + (this.FIRST_BIG_P_ID > info.illustID ? '' : 'big_') +
              'p' + pageNum
          );
        }
        if (this.DATE_IMG_RE.test(cleanedURL)) {
          return cleanedURL.replace(
            /(\/\d+(?:-[\da-f]{32})?_p)\d+/,
            '$1' + pageNum
          );
        }
      }

      return cleanedURL;
    },
    getCleanedURL(url) {
      let urlObj = new URL(url),
          {pathname} = urlObj;

      if (this.DIR_IMG_RE.test(url)) {
        pathname = pathname.replace(/works\/\d+x\d+/, 'img').replace(
          /(img\/[^\/]+\/)(?:mobile\/)?(\d+(?:_[\da-f]{10})?)(?:_[^.]+)?/,
          '$1$2'
        );
      } else if (
        this.DATE_IMG_RE.test(url) &&
          /^\/c\/\d+x\d+\/img-master\//.test(pathname) &&
          /\/\d+(?:-[\da-f]{32})?_p\d+_(?:master|square)\d+\./.test(pathname)
      ) {
        pathname = pathname.replace(
          /^\/c\/\d+x\d+\/img-master\//,
          '/img-original/'
        ).replace(
          /(\/\d+(?:-[\da-f]{32})?_p\d+)_(?:master|square)\d+\./,
          '$1.'
        );
      }

      urlObj.pathname = pathname;

      return urlObj.toString();
    },
    isOldIllustPage(url, doc) {
      if (this.DIR_IMG_RE.test(url)) {
        let pageTitle = doc.title;

        if (doc.querySelector('.introduction form')) {
          let authorNameElm = doc.querySelector('.userdata > .name');

          if (authorNameElm) {
            return pageTitle.endsWith(
              `」イラスト/${authorNameElm.textContent.trim()} [pixiv]`
            );
          }
        }

        return pageTitle.endsWith('のイラスト [pixiv]');
      }

      return false;
    },
    getPageNumber(ctx) {
      let imageURL = (ctx.onImage && ctx.target.src) || '',
          backgroundImageURL = (ctx.hasBGImage && ctx.bgImageURL) || '',
          targetURL = (ctx.onLink && ctx.link.href) || ctx.href || '';

      return (() => {
        for (let url of [imageURL, backgroundImageURL, targetURL]) {
          if (url) {
            let urlObj = new URL(url);

            if (this.DIR_IMG_RE.test(url) || this.DATE_IMG_RE.test(url)) {
              return url.extract(
                this.DIR_IMG_RE.test(url) ? this.DIR_IMG_RE : this.DATE_IMG_RE,
                2
              );
            }
            if (this.isImagePage(urlObj, 'manga_big')) {
              return urlObj.searchParams.get('page');
            }
          }
        }
      })() || '0';
    },
    getWorkInfo(illustID) {
      let that = this,
          retry = true;

      return (function recursive(forceUpdate) {
        return succeed().addCallback(() => {
          if (forceUpdate || !that.accessToken) {
            return that.getAccessToken().addCallback(accessToken => {
              if (!accessToken) {
                throw new Error(getMessage('error.contentsNotFound'));
              }
            });
          }
        }).addCallback(() =>
          that.callMethod('works/' + illustID, {
            image_sizes : 'large'
          }).addErrback(err => {
            if (retry) {
              retry = false;

              return recursive(true);
            }

            throw err;
          })
        );
      }()).addCallback(json => json.response[0]);
    },
    callMethod(method, options) {
      return request(this.PUBLIC_API_URL + method + '.json', {
        responseType : 'json',
        queryString  : Object.assign({
          access_token : this.accessToken
        }, options)
      }).addCallback(
        ({response : json}) => json
      ).addErrback(err => {
        let res = err.message;

        if (res) {
          let json = res.response;

          if (json && json.has_error) {
            throw new Error(json.errors.system.message);
          }
        }

        throw err;
      });
    },
    getAccessToken() {
      let [accountInfo] = this.getAccountInfoList();

      if (!accountInfo) {
        return succeed('');
      }

      let sessIDInfo = this.getSESSIDInfo();

      return request(this.TOKEN_API_URL, {
        responseType : 'json',
        sendContent  : {
          client_id     : this.CLIENT_ID,
          client_secret : this.CLIENT_SECRET,
          grant_type    : 'password',
          username      : accountInfo.username,
          password      : accountInfo.password
        }
      }).addCallback(({response : json}) => {
        // 認証によりPHPSESSIDが更新され、ログインしていても強制的にログアウトになってしまうのを防ぐ
        if (sessIDInfo.length) {
          CookieManager.remove('.pixiv.net', 'PHPSESSID', '/', false);
          CookieManager.add(...sessIDInfo);
        }

        return this.setAccessToken(json.access_token);
      }).addErrback(() => '');
    },
    setAccessToken(accessToken) {
      if (!accessToken) {
        return '';
      }

      this.accessToken = accessToken;

      return accessToken;
    },
    getAccountInfoList() {
      return [
        'https://www.secure.pixiv.net', 'http://www.pixiv.net'
      ].reduce((list, origin) => list.concat(
        LoginManager.findLogins({}, origin, '', null)
      ), []);
    },
    getSESSIDInfo() {
      let [info] = getCookies('.pixiv.net', 'PHPSESSID');

      return info ? [
        'host', 'path', 'name', 'value', 'isSecure', 'isHttpOnly', 'isSession',
        'expiry'
      ].map(propName => info[propName]) : [];
    },
    getOriginalImageURL(ctx, workInfo) {
      let {metadata} = workInfo;

      if (metadata) {
        let pageNum = this.getPageNumber(ctx);

        if (workInfo.type === 'ugoira') {
          let {frames} = metadata;

          if (frames) {
            if (frames.length <= pageNum) {
              pageNum = 0;
            }

            return workInfo.image_urls.large.replace(
              /_ugoira\d+/,
              `_ugoira${pageNum}`
            );
          }
        } else if (workInfo.page_count > 1) {
          if (workInfo.page_count <= pageNum) {
            pageNum = 0;
          }

          return metadata.pages[pageNum].image_urls.large;
        }
      }

      return workInfo.image_urls.large;
    },
    fixImageExtensionFromList(info) {
      let that = this,
          uriObj = createURI(info.imageURL),
          extension = uriObj.fileExtension,
          extensionList = this.IMG_EXTENSIONS.filter(candidate =>
            extension !== candidate
          );

      return (function recursive() {
        uriObj.fileExtension = extensionList.shift();

        let imageURL = uriObj.spec;

        return downloadWithReferrer(imageURL, that.REFERRER).addCallback(() =>
          Object.assign(info, {imageURL})
        ).addErrback(() => {
          if (extensionList.length) {
            return recursive();
          }

          throw new Error(getMessage('error.contentsNotFound'));
        });
      }());
    }
  },

  {
    name : 'Photo - Lightbox',
    ICON : 'chrome://tombfix/skin/photo.png',
    PATTERNS : [
      {re: /(nextLink|prevLink|hoverNav)/, image: 'lightboxImage'},
      {re: /(lbPrevLink|lbNextLink|lbImage)/, image: 'lbImage'}
    ],
    getPattern : function(ctx){
      var id = ctx.target.id;
      var ps = this.PATTERNS;
      for(var i=0 ; i<ps.length ; i++)
        if(ps[i].re.test(id))
          return ps[i];
    },
    check : function(ctx){
      return !!this.getPattern(ctx);
    },
    extract : function(ctx){
      var img  = $x('id("' + this.getPattern(ctx).image + '")');
      return {
        type    : 'photo',
        item    : ctx.title,
        itemUrl : (img instanceof Ci.nsIDOMHTMLImageElement)?
          img.src :
          resolveRelativePath(img.style.backgroundImage.extract(/\([" ]*([^"]+)/), ctx.href),
      }
    }
  },

  {
    name : 'Photo - area element',
    ICON : 'chrome://tombfix/skin/photo.png',
    check : function(ctx){
      if(currentDocument().elementFromPoint && tagName(ctx.target)=='area')
        return true;
    },
    extract : function(ctx){
      var target = ctx.target;
      return {
        type    : 'photo',
        item    : ctx.title,
        itemUrl : $x('//img[@usemap="#' + target.parentNode.name + '"]', target.ownerDocument).src,
      }
    },
  },

  {
    name : 'Photo - image link',
    ICON : 'chrome://tombfix/skin/photo.png',
    check : function(ctx){
      if(!ctx.onLink)
        return;

      var uri = createURI(ctx.link.href);
      return uri && (/(png|gif|jpe?g)$/i).test(uri.fileExtension);
    },
    extract : function(ctx){
      ctx.target = {
        src : ctx.link.href
      };

      return Extractors.Photo.extract(ctx);
    },
  },

  {
    name : 'Photo - Data URI',
    ICON : 'chrome://tombfix/skin/photo.png',
    check : function(ctx){
      return ctx.onImage && ctx.target.src.match(/^data:/);
    },
    extract : function(ctx){
      var src = ctx.target.src || ctx.target.toDataURL();
      return download(src, getTempDir(uriToFileName(ctx.href) + '.png')).addCallback(function(file){
        return {
          type : 'photo',
          item : ctx.title,
          file : file,
        }
      });
    },
  },

  {
    name : 'Photo - Canvas',
    ICON : 'chrome://tombfix/skin/photo.png',
    check : function(ctx){
      return tagName(ctx.target)=='canvas';
    },
    extract : function(ctx){
      return Extractors['Photo - Data URI'].extract(ctx);
    },
  },

  {
    name   : 'Photo - SVG to PNG',
    ICON   : 'chrome://tombfix/skin/photo.png',
    WIDTH  : '300px',
    HEIGHT : '300px',
    check : function (ctx) {
      return !ctx.selection && this.getSVGURL(ctx);
    },
    extract : function (ctx) {
      return request(this.getSVGURL(ctx), {
        responseType : 'document'
      }).addCallback(({response: doc}) => {
        if (doc.contentType !== 'image/svg+xml') {
          throw new Error(getMessage('error.contentsNotFound'));
        }

        return convertToDataURL(
          this.getFixedSVGDataURL(doc.querySelector('svg'))
        );
      }).addCallback(dataURL => {
        ctx.target = {
          src : dataURL
        };

        return Extractors['Photo - Data URI'].extract(ctx);
      });
    },
    getSVGURL : function (ctx) {
      var svg = $x('./ancestor-or-self::*[local-name() = "svg"]', ctx.target),
        imageURL, targetURL;

      if (svg) {
        return this.getFixedSVGDataURL(svg, ctx);
      }

      imageURL = ctx.onImage ? ctx.target.src : (ctx.hasBGImage ? ctx.bgImageURL : '');
      targetURL = ctx.onLink ? ctx.link.href : (!ctx.onImage && ctx.href);

      for (let url of [imageURL, targetURL]) {
        if (url) {
          let uri = createURI(url);

          if (
            uri.fileExtension === 'svg' ||
              url.startsWith('data:image/svg+xml')
          ) {
            return url;
          }
        }
      }
    },
    getFixedSVGDataURL : function (rawSVG, ctx) {
      var svg = rawSVG.cloneNode(true);

      if (!svg.getAttribute('xmlns')) {
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      if (!svg.getAttribute('xmlns:xlink')) {
        svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      }
      if (!svg.getAttribute('width') || !svg.getAttribute('height')) {
        let width, height;

        if (ctx) {
          let computedStyle = ctx.window.getComputedStyle(rawSVG);

          width = computedStyle.width;
          height = computedStyle.height;
        } else {
          width = this.WIDTH;
          height = this.HEIGHT;
        }

        if (!svg.getAttribute('width')) {
          svg.setAttribute('width', width);
        }
        if (!svg.getAttribute('height')) {
          svg.setAttribute('height', height);
        }
      }

      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        svg.outerHTML
      );
    }
  },

  {
    name : 'Photo',
    ICON : 'chrome://tombfix/skin/photo.png',
    PROTECTED_SITES : [
      'files.posterous.com/',
      'image.itmedia.co.jp/',
      'wretch.yimg.com/',
      'pics.*.blog.yam.com/',
      '/www.imgscan.com/image_c.php',
      'keep4u.ru/imgs/',
      '/www.toofly.com/userGallery/',
      '/www.dru.pl/',
      'adugle.com/shareimagebig/',
      'gizmag.com/pictures/',
      '/awkwardfamilyphotos.com/',
      '/docs.google.com/',
      'share-image.com/pictures/big/',
      '^https?://i\\d+\\.(?:secure\\.)?pixiv\\.net/'
    ],
    check : function(ctx){
      return ctx.onImage;
    },
    extract : function(ctx){
      var target = ctx.target;
      var itemUrl = (tagName(target)=='object')? target.data : target.src;

      if(this.PROTECTED_SITES.some(function(re){
        return RegExp(re).test(itemUrl);
      })){
        return Extractors['Photo - Upload from Cache'].extract(ctx);
      };

      if(ctx.document.contentType.match(/^image/))
        ctx.title = ctx.href.split('/').pop();

      // ポスト先のサービスがリダイレクトを処理できずエラーになることがあるため必ずチェックをする(テスト中)
      return getFinalUrl(itemUrl).addCallback(function(url){
        return {
          type    : 'photo',
          item    : ctx.title,
          itemUrl : url,
        }
      });
    },
  },

  {
    name : 'Photo - Upload from Cache',
    ICON : 'chrome://tombfix/skin/photo.png',
    check : function(ctx){
      return ctx.onImage;
    },
    extract : function(ctx){
      if(ctx.document.contentType.match(/^image/))
        ctx.title = ctx.href.split('/').pop();

      var target = ctx.target;
      var itemUrl = (tagName(target)=='object')? target.data : target.src;

      return download(itemUrl, getTempDir()).addCallback(function(file){
        return {
          type    : 'photo',
          item    : ctx.title,
          itemUrl : itemUrl,
          file    : file,
        }
      });
    },
  },

  {
    name : 'Video - Vimeo',
    ICON : 'https://vimeo.com/favicon.ico',
    check(ctx) {
      return !ctx.selection && !ctx.onLink && !ctx.onImage &&
        ctx.hostname === 'vimeo.com' && /^\/\d+$/.test(ctx.pathname) &&
        this.getAuthor(ctx.document);
    },
    extract(ctx) {
      let author = this.getAuthor(ctx.document);

      return {
        type      : 'video',
        item      : ctx.title.replace(/ on Vimeo$/, ''),
        itemUrl   : ctx.href,
        author    : author.textContent,
        authorUrl : author.href
      };
    },
    getAuthor(doc) {
      return doc.querySelector('.byline > a[rel="author"]');
    }
  },

  {
    name    : 'Video - YouTube',
    ICON    : 'https://www.youtube.com/favicon.ico',
    ORIGIN  : 'https://www.youtube.com',
    // via https://developers.google.com/youtube/v3/docs/videos/list
    API_URL : 'https://www.googleapis.com/youtube/v3/videos',
    API_KEY : 'AIzaSyACVKBQgqThsTtzvxSwpPdS7jSDgIT9Srw',
    check(ctx) {
      return !ctx.selection && !(ctx.onImage && !ctx.onLink) &&
        this.getVideoID(ctx);
    },
    extract(ctx) {
      let videoID = this.getVideoID(ctx);

      return this.getInfo(videoID).addCallback(info => {
        let {title} = info;

        ctx.title = title + ' - YouTube';
        ctx.href = `${this.ORIGIN}/watch?v=${videoID}`;

        return {
          type      : 'video',
          item      : title,
          itemUrl   : ctx.href,
          author    : info.channelTitle,
          authorUrl : `${this.ORIGIN}/channel/${info.channelId}`
        };
      });
    },
    getVideoID(ctx) {
      let targetURL = ctx.onLink ? ctx.link.href : ctx.href;

      if (targetURL) {
        let urlObj = new URL(targetURL);

        if (
          /^(?:www\.)?youtube\.com$/.test(urlObj.hostname) &&
            urlObj.pathname === '/watch'
        ) {
          if (
            targetURL === ctx.href &&
              !$x('//embed/@src | //video/@src', ctx.document)
          ) {
            return;
          }

          return urlObj.searchParams.get('v');
        }
        if (urlObj.hostname === 'youtu.be') {
          return urlObj.pathname.slice(1);
        }
      }
    },
    getInfo(videoID) {
      return request(this.API_URL, {
        responseType : 'json',
        referrer     : 'https://tombfix.github.io/',
        queryString  : {
          part : 'snippet',
          id   : videoID,
          key  : this.API_KEY
        }
      }).addErrback(err => {
        let res = err.message;

        if (res && res.response) {
          return res;
        }

        throw err;
      }).addCallback(({response : json}) => {
        let {error} = json;

        if (error) {
          throw new Error(error.message);
        }

        let {items} = json;

        if (!(items && items.length)) {
          throw new Error(getMessage('error.contentsNotFound'));
        }

        return items[0].snippet;
      });
    }
  },

  {
    name          : 'Video - Dailymotion',
    ICON          : 'https://www.dailymotion.com/favicon.ico',
    ORIGIN        : 'https://www.dailymotion.com',
    // via https://developer.dailymotion.com/documentation#graph-api
    API_URL       : 'https://api.dailymotion.com',
    VIDEO_PAGE_RE : new RegExp(
      '^https?://(?:www\\.)?dailymotion\\.com/video/([\\da-z]+)',
      'i'
    ),
    SHORT_RE      : /^https?:\/\/(?:www\.)?dai\.ly\/([\da-z]+)/i,
    check(ctx) {
      return !ctx.selection && !(ctx.onImage && !ctx.onLink) &&
        this.getVideoID(ctx);
    },
    extract(ctx) {
      let videoID = this.getVideoID(ctx);

      return this.getInfo(videoID).addCallback(info => {
        let {title} = info;

        ctx.title = title + ' - Dailymotion';
        ctx.href = `${this.ORIGIN}/video/${videoID}`;

        return {
          type      : 'video',
          item      : title,
          itemUrl   : ctx.href,
          author    : info['owner.screenname'],
          authorUrl : `${this.ORIGIN}/${info['owner.username']}`
        };
      });
    },
    getVideoID(ctx) {
      let targetURL = ctx.onLink ? ctx.link.href : ctx.href;

      if (targetURL) {
        let {href} = new URL(targetURL);

        return href.extract(this.VIDEO_PAGE_RE) ||
          href.extract(this.SHORT_RE);
      }
    },
    getInfo(videoID) {
      return request(`${this.API_URL}/video/${videoID}`, {
        responseType : 'json',
        queryString  : {
          // via https://developer.dailymotion.com/documentation#fields-selection
          fields : 'title,owner.screenname,owner.username'
        }
      }).addErrback(res => {
        throw new Error(res.message.response.error.message);
      }).addCallback(({response : json}) => {
        let {error} = json;

        if (error) {
          throw new Error(error.message);
        }

        return json;
      });
    }
  },

  {
    name : 'Video - Nicovideo',
    ICON : 'http://www.nicovideo.jp/favicon.ico',

    check : function (ctx) {
      if (!ctx.selection && !ctx.onImage && !ctx.onLink) {
        return /^http:\/\/www\.nicovideo\.jp\/watch\//.test(ctx.href);
      }
    },
    extract : function (ctx) {
      var externalPlayerURL = 'http://ext.nicovideo.jp/thumb_' + ctx.pathname.slice(1) + '?thumb_mode=swf&ap=1&c=1';

      return {
        type    : 'video',
        item    : ctx.title,
        itemUrl : ctx.href,
        body    : '<embed type="application/x-shockwave-flash" width="485" height="385" src="' + externalPlayerURL + '">'
      };
    }
  },

  {
    name : 'Quote',
    ICON : 'chrome://tombfix/skin/quote.png',
    check : function(ctx){
      return ctx.selection;
    },
    extract : function(ctx){
      return {
        type    : 'quote',
        item    : ctx.title,
        itemUrl : ctx.href,
        body    : createFlavoredString(ctx.window.getSelection()),
      }
    },
  },

  {
    name  : 'Quote - textarea',
    ICON  : 'chrome://tombfix/skin/quote.png',

    check : function (ctx) {
      if (!ctx.selection) {
        let target = ctx.target;

        if (target && ('selectionStart' in target)) {
          // raise NS_ERROR_FAILURE(DOMException?) in case of input[type="submit"], and so on
          try {
            return target.selectionStart !== target.selectionEnd;
          } catch (err) { }
        }
      }
    },
    extract : function (ctx) {
      var target = ctx.target,
        text = target.value.slice(
          Math.min(target.selectionStart, target.selectionEnd),
          Math.max(target.selectionStart, target.selectionEnd)
        );

      return {
        type    : 'quote',
        item    : ctx.title,
        itemUrl : ctx.href,
        body    : createFlavoredString(document.createTextNode(text))
      };
    }
  },

  {
    name : 'Link - trim parameters',
    ICON : 'chrome://tombfix/skin/link.png',
    TARGET_SITES : [
      '//itunes.apple.com/',
    ],
    check : function(ctx){
      return this.TARGET_SITES.some(function(re){
        return RegExp(re).test(ctx.href);
      });
    },
    extract : function(ctx){
      var uri = createURI(ctx.href);
      ctx.href = uri.prePath + uri.filePath;
      return Extractors.Link.extract(ctx);
    },
  },

  {
    name : 'Link - link',
    ICON : 'chrome://tombfix/skin/link.png',
    check : function(ctx){
      return ctx.onLink;
    },
    extract : function(ctx){
      // リンクテキストが無い場合はページタイトルで代替する
      var title = convertToPlainText(ctx.link) || ctx.link.title;
      if(!title || title==ctx.link.href)
        title = ctx.title;

      return {
        type    : 'link',
        item    : title,
        itemUrl : ctx.link.href,
      };
    },
  },

  {
    name : 'Link',
    ICON : 'chrome://tombfix/skin/link.png',
    check : function(ctx){
      return true;
    },
    extract : function(ctx){
      var ps;
      if(ctx.onLink){
        // リンクテキストが無い場合はページタイトルで代替する
        var title = ctx.target.textContent;
        if(!title || title==ctx.target.href)
          title = ctx.title;

        ps = {
          type    : 'link',
          item    : title,
          itemUrl : ctx.link.href,
        };
      } else {
        ps = {
          type    : 'link',
          item    : ctx.title,
          itemUrl : ctx.href,
        }
      }

      if(ctx.date)
        ps.date = ctx.date;

      return ps;
    },
  },

  {
    name : 'Photo - background image',
    ICON : 'chrome://tombfix/skin/photo.png',
    check : function(ctx){
      return ctx.bgImageURL;
    },
    extract : function(ctx){
      return {
        type    : 'photo',
        item    : ctx.title,
        itemUrl : ctx.bgImageURL,
      }
    }
  },

  {
    name : 'Photo - covered',
    ICON : 'chrome://tombfix/skin/photo.png',
    check : function (ctx) {
      if (!ctx.selection && ctx.mouse) {
        return this.getCoveredImageInfo(ctx);
      }
    },
    extract : function (ctx) {
      var info = this.getCoveredImageInfo(ctx);

      return Extractors[
        info.target ? 'Photo' : 'Photo - background image'
      ].extract(update(ctx, info));
    },
    getCoveredImageInfo : function (ctx) {
      var {screen} = ctx.mouse,
        nodes = getNodesFromPosition(screen.x, screen.y);

      if (!nodes) {
        return;
      }

      // For check()'s performance, `limit` must be small.
      for (let idx = 1, len = nodes.length, limit = 3; idx < len && idx <= limit; idx += 1) {
        let coveredNode = nodes[idx];

        if (coveredNode instanceof window.HTMLImageElement && coveredNode.src) {
          return {
            target : coveredNode
          };
        }
        if (coveredNode instanceof Element) {
          let bgImageURL = ctx.window.getComputedStyle(coveredNode)
            .backgroundImage.extract(/^url\((["']?)(.+)\1\)$/, 2);

          if (bgImageURL && bgImageURL !== ctx.bgImageURL) {
            return {
              bgImageURL : bgImageURL
            };
          }
        }
      }
    }
  },

  {
    name : 'Photo - Capture',
    ICON : 'chrome://tombfix/skin/photo.png',
    check : function(ctx){
      return true;
    },
    extract : function(ctx){
      // ショートカットキーからポストするためcaptureTypeを追加
      var type = ctx.captureType || input({'Capture Type' : ['Region', 'Element', 'View', 'Page']});
      if(!type)
        return;

      var win = ctx.window;
      return succeed().addCallback(function(){
        switch (type){
        case 'Region':
          return selectRegion().addCallback(function(region){
            return capture(win, region.position, region.dimensions);
          });

        case 'Element':
          return selectElement().addCallback(function(elm){
            // getBoundingClientRectで少数が返され切り取り範囲がずれるため丸める
            return capture(win, roundPosition(getElementPosition(elm)), getElementDimensions(elm));
          });

        case 'View':
          return capture(win, getViewportPosition(), getViewDimensions());

        case 'Page':
          return capture(win, {x:0, y:0}, getPageDimensions());
        }
      }).addCallback(function(image){
        return download(image, getTempDir(uriToFileName(ctx.href) + '.png'));
      }).addCallback(function(file){
        return {
          type : 'photo',
          item : ctx.title,
          file : file,
        }
      });
    }
  },

  {
    name : 'Text',
    ICON : 'chrome://tombfix/skin/text.png',
    check : function(ctx){
      return true;
    },
    extract : function(ctx){
      return {
        type : 'regular',
      }
    }
  },
]);
