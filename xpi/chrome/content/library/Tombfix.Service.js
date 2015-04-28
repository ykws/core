Object.assign(Tombfix.Service, {
  /**
   * コンテキストからどのような情報が抽出できるのかチェックする。
   * 処理は同期で行われる。
   *
   * @param {Object} ctx 抽出コンテキスト。
   * @return {Array} extractorのリスト。
   */
  check : function(ctx){
    return withWindow(ctx.window, function(){
      // コンテキストメニューからの呼び出しの場合そちらで設定されている
      // html要素などのルート要素も除外する
      if(!ctx.menu && ctx.target &&
        (ctx.target.parentNode != ctx.target.ownerDocument && ctx.target != ctx.target.ownerDocument)){
        ctx.link = $x('./ancestor-or-self::a', ctx.target);
        ctx.onLink = !!ctx.link;
        ctx.onImage = ctx.target instanceof Ci.nsIDOMHTMLImageElement;
      }

      return Extractors.check(ctx);
    });
  },

  /**
   * コンテキストから情報を抽出しポストする。
   * 設定画面で指定されたサービスが、ポスト先の対象となる。
   * フォームを表示した場合、ポストは行われない。
   *
   * @param {Object} ctx 抽出コンテキスト。
   * @param {Object} ext extractor。抽出方法。
   * @param {Boolean} showForm クイックポストフォームを表示するか。
   * @return {Deferred} ポスト完了後に呼び出される。
   */
  share : function(ctx, ext, showForm){
    // エラー処理をまとめるためDeferredの中に入れる
    return succeed().addCallback(function(){
      return Extractors.extract(ctx, ext);
    }).addCallback(function(ps){
      ctx.ps = ps;

      // 予期せずに連続してquoteをポストしてしまうのを避けるため選択を解除する
      if(ps.type == 'quote' && ctx.window.getSelection().rangeCount)
        ctx.window.getSelection().collapseToStart();

      debug(ps);

      if(!ps || !ps.type)
        return succeed({});

      if(showForm){
        // 利用可能なサービスがあるか？
        if(Models.getEnables(ps).length){
          QuickPostForm.show(ps, (ctx.mouse && (ctx.mouse.post || ctx.mouse.screen)));
        } else {
          Tombfix.Service.alertPreference(ps.type);
        }

        // FIXME: クイックポストフォームのポスト結果を伝えるように
        return succeed({});
      }

      var posters = Models.getDefaults(ps);
      if(!posters.length){
        Tombfix.Service.alertPreference(ps.type);
        return succeed({});
      }

      return Tombfix.Service.post(ps, posters);
    }).addErrback(function(err){
      if(err instanceof CancelledError)
        return;

      Tombfix.Service.alertError(err, ctx.title, ctx.href, ctx.ps);
    });
  },

  /**
   * 対象のポスト先に一括でポストする。
   *
   * @param {Object} ps ポスト内容。
   * @param {Array} posters ポスト対象サービスのリスト。
   * @return {Deferred} ポスト完了後に呼び出される。
   */
  post : function(ps, posters){
    // エラー後再ポスト時のデバッグに使用
    debug(ps);
    debug(posters);

    var self = this;
    var ds = {};
    posters = [].concat(posters);
    posters.forEach(function(p){
      try{
        ds[p.name] = (ps.favorite && RegExp('^' + ps.favorite.name + '(\\s|$)').test(p.name))? p.favor(ps) : p.post(ps);
      } catch(e){
        ds[p.name] = fail(e);
      }
    });

    return new DeferredHash(ds).addCallback(function(ress){
      debug(ress);

      var errs = [];
      var ignoreError = getPref('ignoreError');
      ignoreError = ignoreError && new RegExp(getPref('ignoreError'), 'i');
      for(var name in ress){
        var [success, res] = ress[name];
        if(!success){
          var msg = name + ': ' +
            (res.message.status? 'HTTP Status Code ' + res.message.status : '\n' + self.reprError(res).indent(4));

          if(!ignoreError || !msg.match(ignoreError))
            errs.push(msg);
        }
      }

      if(errs.length)
        self.alertError(errs.join('\n'), ps.page, ps.pageUrl, ps);
    }).addErrback(function(err){
      self.alertError(err, ps.page, ps.pageUrl, ps);
    });
  },

  /**
   * 詳細なエラー情報を表す文字列を生成する。
   *
   * @param {Error} err
   * @return {String}
   */
  reprError : function(err){
    // MochiKitの汎用エラーの場合、内部の詳細エラーを使う
    if(err.name && err.name.match('GenericError'))
      err = err.message;

    if(err.status)
      err = err.message + '(' + err.status + ')';

    if(typeof(err) != 'object')
      return '' + err;

    var msg = [];
    getAllPropertyNames(err, Object.prototype).forEach(function(prop){
      var val = err[prop];
      if(val == null || /(stack|name)/.test(prop) || typeof(val) == 'function')
        return;

      if(prop.toLowerCase() === 'filename' || prop === 'location')
        val = ('' + val).extract(/^.*\/(.*?)(\?|$)/);

      prop =
        (prop === 'fileName')? 'file' :
        (prop === 'lineNumber')? 'line' : prop;

      msg.push((prop === 'message')? val : prop + ' : ' + val);
    });

    return msg.join('\n');
  },

  /**
   * エラーメッセージ付きでポストフォームを再表示する。
   *
   * @param {String || Error} msg エラー、または、エラーメッセージ。
   * @param {String} page エラー発生ページタイトル。
   * @param {String} pageUrl エラー発生ページURL。
   * @param {Object} ps ポスト内容。
   */
  alertError : function(msg, page, pageUrl, ps){
    error(msg);

    msg = getMessage('error.post', this.reprError(msg).indent(2), page, pageUrl);
    if(ps && ps.type){
      // ポスト内容があればフォームを再表示する。
      QuickPostForm.show(ps, null, msg);
    } else {
      if(confirm(msg + '\n\n' + getMessage('message.reopen'))){
        addTab(pageUrl);
      }
    }
  },

  /**
   * 設定画面を開き指定を促す。
   *
   * @param {String} type ポストタイプ。
   */
  alertPreference : function(type){
    var win = openDialog('chrome://tombfix/content/options/options.xul', 'resizable,centerscreen');
    win.addEventListener('load', function(){
      // load時は、まだダイアログが表示されていない
      setTimeout(function(){
        win.alert(getMessage('error.noPoster', type.capitalize()));
      }, 0);
    }, false);
  }
});
