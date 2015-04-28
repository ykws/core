// ---- [Widget] -------------------------------------------
var QuickPostForm = {
  show : function(ps, position, message){
    openDialog(
      'chrome://tombfix/content/quickPostForm.xul',
      'chrome,alwaysRaised=yes,resizable=yes,dependent=yes,titlebar=no', ps, position, message);
  },
};

// 設定画面が保存されたタイミングでコンテキストがリロードされクリアされる
// 仕様変更の際はsignal/connectでクリアすること
QuickPostForm.candidates = [];
QuickPostForm.dialog = {
  snap : {
    top : true,
    left : false,
  },
};
QuickPostForm.descriptionContextMenus = [
  {
    name : 'j.mp',
    icon : Models['j.mp'].ICON,

    execute : function(elmText, desc){
      shortenUrls(desc.value, Models['j.mp']).addCallback(function(value){
        desc.value = value;
      });
    },
  },
]


// ----[Shortcutkey]-------------------------------------------------
var shortcutkeys = {};
forEach({
  'shortcutkey.quickPost.link' : function(e){
    cancel(e);

    var win = getMostRecentWindow().content;
    var doc = win.document;

    var ctx = update({
      document  : doc,
      window    : win,
      title     : doc.title,
      selection : ''+win.getSelection(),
      target    : doc.documentElement,
    }, win.location);

    var exts = Tombfix.Service.check(ctx).filter(function(ext){
      return /^Link/.test(ext.name);
    });
    Extractors.extract(ctx, exts[0]).addCallback(function(ps){
      QuickPostForm.show(ps);
    });
  },
  'shortcutkey.quickPost.regular' : function(e){
    cancel(e);

    var win = wrappedObject(e.currentTarget.content);
    var doc = win.document;

    QuickPostForm.show({
      type    : 'regular',
      page    : doc.title,
      pageUrl : win.location.href,
    });
  },

  // 処理を行わなかった場合はtrueを返す
  'shortcutkey.checkAndPost' : function(e){
    var doc = e.originalTarget.ownerDocument;
    var win = wrappedObject(doc.defaultView);

    // XULは処理しない
    if(!doc.body)
      return true;

    var ctx = update({
      document  : doc,
      window    : win,
      title     : doc.title,
      selection : ''+win.getSelection(),
      target    : e.originalTarget,
      mouse     : {
        page   : {x : e.pageX, y : e.pageY},
        screen : {x : e.screenX, y : e.screenY},
      },
    }, win.location);

    var ext = Tombfix.Service.check(ctx)[0];

    // FIXME: xul:popup要素の使用を検討
    var tip = doc.createElement('div');
    tip.setAttribute('style', commentToText(function(){/*
      font-family        : 'Arial Black', Arial, sans-serif;
      font-size          : 12px;

      color              : #666;
      background         : #EEEEEE no-repeat;
      position           : fixed;
      z-index            : 999999999;
      width              : auto;
      height             : 16px;
      line-height        : 16px;
      vertical-align     : middle;
      overflow           : hidden;

      border-radius      : 4px;
      border             : 4px solid #EEE;
      padding-left       : 20px;
      padding-right      : 2px;
    */}));
    tip.textContent = ext.name;
    convertToDataURL(ext.ICON).addCallback(function(dataUrl){
      tip.style.backgroundImage = 'url(' + dataUrl + ')';
    });
    setElementPosition(tip, {x: e.clientX - 24, y: e.clientY - 24});
    doc.body.appendChild(tip);
    setTimeout(function(){
      fade(tip, {
        duration : 1,
        afterFinish : function(){
          removeElement(tip);
        },
      });
    }, 250);

    Tombfix.Service.share(ctx, ext, ext.name.match(/^Link/));
  },
}, function([key, func]){
  key = getPref(key);
  if(key)
    shortcutkeys[key] = {
      execute : func,
    };
});


// ----[browser]-------------------------------------------------
connect(grobal, 'browser-load', function(e){
  var cwin = e.target.defaultView;
  var doc = cwin.document;

  connectToBrowser(cwin);

  var context;
  var menuContext = doc.getElementById('contentAreaContextMenu');
  var menuShare   = doc.getElementById('tombfix-menu-share');
  var menuSelect  = doc.getElementById('tombfix-menu-select');
  var menuAction  = doc.getElementById('tombfix-menu-action');
  var separator = doc.createElement('menuseparator');

  if (getPref('contextMenu.top')) {
    insertSiblingNodesAfter(menuAction.parentNode, separator);
  }

  var menuEditor = !!getExtensionDir('{EDA7B1D7-F793-4e03-B074-E6F303317FB0}');

  // Menu Editor拡張によって個別メニューのイベントを取得できなくなる現象を回避
  menuContext.addEventListener('popupshowing', function(e){
    if(e.eventPhase != Event.AT_TARGET || (context && context.target == cwin.gContextMenu.target) || !cwin.gContextMenu.target)
      return;

    var doc = cwin.gContextMenu.target.ownerDocument;
    var win = doc.defaultView;
    try{
      win.location.host;

      menuShare.disabled = false;
      menuSelect.parentNode.disabled = false;
    }catch(e){
      // about:config などのページで無効にする
      menuShare.disabled = true;
      menuSelect.parentNode.disabled = true;

      return;
    }

    if (getPref('contextMenu.disableMenuShare')) {
      menuShare.hidden = menuShare.disabled = true;
    } else {
      menuShare.hidden = false;
    }

    // command時にはクリック箇所などの情報が失われるためコンテキストを保持しておく
    context = update({}, cwin.gContextMenu, win.location, {
      document  : doc,
      window    : win,
      title     : doc.title,
      selection : ''+win.getSelection(),
      target    : cwin.gContextMenu.target,
      mouse     : {
        page   : {x : e.pageX, y : e.pageY},
        screen : {x : e.screenX, y : e.screenY},
      },
      menu      : cwin.gContextMenu,
    });

    var exts = Tombfix.Service.check(context);
    menuShare.label = 'Share - ' + exts[0].name;
    menuShare.extractor = exts[0].name;
    menuShare.setAttribute('image', exts[0].ICON || 'chrome://tombfix/skin/empty.png');
    menuShare.setAttribute('accesskey', getPref('accesskey.share'));

    if(exts.length<=1){
      menuSelect.parentNode.disabled = true;
    } else {
      menuSelect.parentNode.disabled = false;

      for(var i=0 ; i<exts.length ; i++){
        var ext = exts[i];
        var elmItem = appendMenuItem(menuSelect, ext.name, ext.ICON || 'chrome://tombfix/skin/empty.png');
        elmItem.extractor = ext.name;
        elmItem.showForm = true;
      }
    }

    // Menu Editorが有効になっている場合は衝突を避ける(表示されなくなる)
    if (!menuEditor) {
      let insertPoint;

      if (getPref('contextMenu.top')) {
        insertPoint = cwin.document.getElementById('page-menu-separator');
      } else {
        // リンク上とそれ以外で表示されるメニューが異なる
        // 常に上から2ブロック目あたりに表示する
        [
          'context-sep-navigation',
          'context-sep-open',
          'context-media-sep-commands',
          'context-sep-copyimage',
          'context-sep-stop',
          'context-sep-selectall',
          'context-sep-paste',
          'inspect-separator'
        ].some(function(id){
          insertPoint = cwin.document.getElementById(id);
          return insertPoint && !insertPoint.hidden;
        });
      }

      // 表示される逆順に移動する
      insertSiblingNodesAfter(insertPoint, separator);
      insertSiblingNodesAfter(insertPoint, menuAction.parentNode);
      insertSiblingNodesAfter(insertPoint, menuSelect.parentNode);
      insertSiblingNodesAfter(insertPoint, menuShare);
    }
  }, true);

  menuContext.addEventListener('popuphidden', function(e){
    if(e.eventPhase != Event.AT_TARGET)
      return;

    context = null;

    clearChildren(menuSelect);
    clearChildren(menuAction);
  }, true);

  menuAction.addEventListener('popupshowing', function(e){
    if(e.eventPhase != Event.AT_TARGET)
      return;

    // メニュー生成済みなら返る
    if(menuAction.childNodes.length)
      return;

    createActionMenu(menuAction, context);
  }, true);

  menuContext.addEventListener('command', function(e){
    var target = e.target;
    if(target.extractor){
      Tombfix.Service.share(context, Extractors[target.extractor], target.showForm);

      return;
    }

    if(target.action){
      withWindow(context.window, function(){
        target.action.execute(context);
      });

      return;
    }
  }, true);

  // clickイベントはマウス座標が異常
  menuContext.addEventListener('mousedown', function(e){
    if(!e.target.extractor && !e.target.action)
      return;

    context.originalEvent = e;
    context.mouse.post = {
      x : e.screenX,
      y : e.screenY
    }
  }, true);

  var menuMain = doc.getElementById('tombfix-menu-main');
  menuMain.addEventListener('popupshowing', function(e){
    if(e.eventPhase != Event.AT_TARGET)
      return;

    clearChildren(menuMain);
    createActionMenu(menuMain);
  }, true);

  menuMain.addEventListener('command', function(e){
    e.target.action.execute(context);
  }, true);

  function createActionMenu(root, ctx){
    var doc = root.ownerDocument;
    var df = doc.createDocumentFragment();
    var type = RegExp((ctx)? 'context' : 'menu');
    (function me(actions, parent){
      actions.forEach(function(action){
        // 最初の階層のみアクションタイプを確認する
        // 後方互換のためtypeが未指定のものはメニューバーとして扱う
        if(parent==df && !type.test(action.type || 'menu'))
          return;

        // ブラウザメニューから実行された場合はコンテキストが渡されない
        // extractorの動作を同じにするためwithWindow内でアクションを実行する
        if(action.check && (
          (!ctx)?
            !action.check() :
            !withWindow(ctx.window, function(){
              return action.check(ctx);
            })))
          return;

        var elmItem = appendMenuItem(parent, action.name, action.icon, !!action.children);
        elmItem.action = action;

        if(action.children)
          me(action.children, elmItem.appendChild(doc.createElement('menupopup')));
      });
    })(Tombfix.Service.actions.values, df);
    root.appendChild(df);
  }
});

function connectToBrowser(win){
  // パフォーマンスを考慮しconnectしているものがいなければウォッチしない
  // リロードや設定変更により繰り返し呼ばれたときに多重フックしないようにチェック
  // チェック状況をグローバル環境に持つのは複雑になりリークを招くためwindowに置く
  var Tombfix = win.Tombfix = (win.Tombfix || {});
  var hooked = Tombfix.hooked = (Tombfix.hooked || {});
  var tabbrowser = win.getBrowser();

  if(!hooked.contentReady && connected(grobal, 'content-ready')){
    constant.tabWatcher = constant.tabWatcher || new TabWatcher();
    constant.tabWatcher.watchWindow(win);
    hooked.contentReady = true;
  }

  // ショートカットキーが設定されているか？
  if(!hooked.shortcutkey && !isEmpty(shortcutkeys)){
    win.addEventListener('keydown', function(e){
      var key = shortcutkeys[keyString(e)];
      if(!key)
        return;

      // Shift + Tなどをテキストエリアで入力できるように
      if((e.ctrlKey || e.altKey) || !(/(input|textarea)/i).test(e.target.tagName))
        key.execute(e);
    }, true);
    hooked.shortcutkey = true;
  }

  // マウスショートカットが設定されているか？
  if(!hooked.mouseShortcut && keys(shortcutkeys).some(function(key){return key.indexOf('_DOWN')!=-1})){
    observeMouseShortcut(win, function(e, key){
      key = shortcutkeys[key];
      if(!key)
        return true;

      return key.execute(e);
    });
    hooked.mouseShortcut = true;
  }
}
