/* jshint camelcase:false, latedef:false, forin:false */
/* global Components */

(function executeTombfixService(global) {
  'use strict';

  const CHROME_DIR = 'chrome://tombfix',
        EXTENSION_ID = 'tombfix@tombfix.github.io',
        {interfaces: Ci, classes: Cc, utils: Cu} = Components,
        // http://mxr.mozilla.org/mozilla-central/source/toolkit/modules/Services.jsm
        {Services} = Cu.import('resource://gre/modules/Services.jsm', {}),
        // http://mxr.mozilla.org/mozilla-central/source/js/xpconnect/loader/XPCOMUtils.jsm
        {XPCOMUtils} = Cu.import('resource://gre/modules/XPCOMUtils.jsm', {}),
        // http://mxr.mozilla.org/mozilla-central/source/toolkit/devtools/Console.jsm
        /* jshint ignore:start */
        {console} = Cu.import(
          'resource://gre/modules/devtools/Console.jsm',
          {}
        ),
        /* jshint ignore:end */
        {
          appShell: AppShellService,
          scriptloader: ScriptLoader,
          wm: WindowMediator
        } = Services,
        FileProtocolHandler = getService(
          'network/protocol;1?name=file',
          Ci.nsIFileProtocolHandler
        ),
        {nsILocalFile: ILocalFile} = Ci;

  const SCRIPT_FILES = [
    // library/third_party
    'MochiKit.js',
    'twitter-text.js',
    // library
    'component.js',
    'expand.js',
    'utility.js',
    'tabWatcher.js',
    'repository.js',
    'models.js',
    'Tombfix.Service.js',
    'actions.js',
    'extractors.js',
    'ui.js'
  ];

  let loadScript = function loadScript(url, target) {
        ScriptLoader.loadSubScriptWithOptions(url, Object.assign({
          charset: 'UTF-8',
          ignoreCache: true
        }, target ? {target} : {}));
      },
      loadLibrary = function loadLibrary(paths, target) {
        for (let path of paths) {
          loadScript(`${CHROME_DIR}/content/library/${path}`, target);
        }
      };

  // https://developer.mozilla.org/en-US/docs/Components.utils.importGlobalProperties
  Cu.importGlobalProperties(['File', 'URL', 'XMLHttpRequest']);

  loadLibrary(['expand.js'], global);

  var getContentDir;

  // ----[Application]--------------------------------------------
  function getScriptFiles(dir) {
    return [...simpleIterator(
      dir.directoryEntries,
      'nsILocalFile'
    )].reduce((files, file) => {
      if (file.leafName.endsWith('.js')) {
        files.push(file);
      }

      return files;
    }, []);
  }

  function getLibraries() {
    var libDir, thirdPartyDir, scripts;

    libDir = getContentDir();
    libDir.append('library');

    thirdPartyDir = getContentDir();
    thirdPartyDir.setRelativeDescriptor(thirdPartyDir, 'library');
    thirdPartyDir.append('third_party');

    scripts = getScriptFiles(thirdPartyDir).concat(getScriptFiles(libDir));

    return SCRIPT_FILES.map(scriptName => {
      return scripts.find(file => file.leafName === scriptName);
    });
  }

  function setupEnvironment(env) {
    var win = AppShellService.hiddenDOMWindow;

    // 変数/定数はhiddenDOMWindowのものを直接使う
    [
      'navigator', 'document', 'window',
      'XPathResult', 'Node', 'Element', 'KeyEvent', 'Event', 'DOMParser',
      'XSLTProcessor'
    ].forEach(propName => {
      env[propName] = win[propName];
    });

    // メソッドはthisが変わるとエラーになることがあるためbindして使う
    [
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'
    ].forEach(propName => {
      env[propName] = win[propName].bind(win);
    });

    // モーダルにするためhiddenDOMWindowdではなく最新のウィンドウのメソッドを使う
    [
      'alert', 'confirm', 'prompt'
    ].forEach(propName => {
      env[propName] = forwardToWindow.bind(null, propName);
    });
  }

  function forwardToWindow(propName, ...args) {
    var win = WindowMediator.getMostRecentWindow('navigator:browser');

    return win[propName].apply(win, args);
  }

  // ----[Utility]--------------------------------------------
  function getService(clsName, ifc) {
    try {
      let cls = Cc['@mozilla.org/' + clsName];

      return cls ? (ifc ? cls.getService(ifc) : cls.getService()) : null;
    } catch (err) {
      return null;
    }
  }

  function loadAllSubScripts(env) {
    // libraryの読み込み
    loadSubScripts(getLibraries(), env);

    if (!env.getPref('disableAllScripts')) {
      let patchDir;

      // dataDirの設定が不正なものである時に、Tombfixが起動できなくなるのを防ぐ
      try {
        patchDir = env.getPatchDir();
      } catch (err) {
        Cu.reportError(err);
      }

      if (patchDir) {
        // パッチの読み込み
        loadSubScripts(getScriptFiles(patchDir), env);
      }
    }
  }

  function loadSubScripts(files, global = function () {}) {
    var now = Date.now();

    for (let file of files) {
      // クエリを付加しキャッシュを避ける
      ScriptLoader.loadSubScript(
        FileProtocolHandler.getURLSpecFromFile(file) + '?time=' + now,
        global,
        'UTF-8'
      );
    }
  }

  function* simpleIterator(simpleEnum, ifcName) {
    let ifc = typeof ifcName === 'string' ? Ci[ifcName] : ifcName;

    while (simpleEnum.hasMoreElements()) {
      let value = simpleEnum.getNext();

      yield ifc ? value.QueryInterface(ifc) : value;
    }
  }

  function copy(target, obj, re) {
    for (let propName in obj) {
      if (!re || re.test(propName)) {
        target[propName] = obj[propName];
      }
    }

    return target;
  }

  function exposeProperties(obj, recursive) {
    if (obj == null) {
      return;
    }

    Object.defineProperty(obj, '__exposedProps__', {
      value        : {},
      enumerable   : false,
      writable     : true,
      configurable : true
    });

    for (let propName in obj) {
      obj.__exposedProps__[propName] = 'r';

      if (recursive && typeof obj[propName] === 'object') {
        exposeProperties(obj[propName], true);
      }
    }
  }

  getContentDir = (function executeFunc() {
    var {AddonManager} = Cu.import(
          'resource://gre/modules/AddonManager.jsm',
          {}
        ),
        dir = null,
        thread;

    AddonManager.getAddonByID(EXTENSION_ID, addon => {
      var target = addon.getResourceURI('/').QueryInterface(Ci.nsIFileURL)
        .file.QueryInterface(ILocalFile);

      target.setRelativeDescriptor(target, 'chrome/content');

      dir = target;
    });

    // using id:piro (http://piro.sakura.ne.jp/) method
    thread = getService('thread-manager;1').mainThread;

    while (dir === null) {
      thread.processNextEvent(true);
    }

    return function getContentDir() {
      return dir.clone();
    };
  }());

  // https://developer.mozilla.org/en-US/docs/How_to_Build_an_XPCOM_Component_in_Javascript#Using_XPCOMUtils
  function TombfixService(noInit) {
    if (!noInit) {
      // https://developer.mozilla.org/en-US/docs/wrappedJSObject
      this.wrappedJSObject = this.init();
    }
  }

  Object.expand(TombfixService.prototype, {
    className: TombfixService.name,
    classDescription: 'Tombfix\'s JavaScript XPCOM Component',
    contractID: '@tombfix.github.io/tombfix-service;1',
    classID: Components.ID('{ab5cbd9b-56e1-42e4-8414-2201edb883e7}'),
    QueryInterface: XPCOMUtils.generateQI(),

    CHROME_DIR: CHROME_DIR,

    // リロードによって変更されない領域を用意する
    // イベントに安定してフックするためなどに使われる
    constant: {},

    environment: {},

    init() {
      let env = this.environment;

      // ブラウザが開かれるタイミングでインスタンスの要求を受け環境を初期化する
      // 2個目以降のウィンドウからは生成済みの環境を返す
      if (env.reload) {
        return env;
      }

      // 以降のコードはアプリケーション起動後に一度だけ通過する
      env.Tombfix = env.Tombloo = Object.assign(new TombfixService(true), {
        Service: {}
      });

      // ここでwindowやdocumentなどをenvに持ってくる
      setupEnvironment(env);

      // MochiKit内部で使用しているinstanceofで異常が発生するのを避ける
      env.MochiKit = {};

      // for twttr
      env.twttr = env.window.twttr = {};

      // libraryとパッチを読み込む
      loadAllSubScripts(env);

      env.reload = function reload() {
        // getExtensionDir > till > processNextEventが非同期となり、
        // コンテキスト全体の更新動作が不安定になる
        // これを避けるためリロードを遅延させる
        // (設定画面を閉じる際にFirefox 4以降がクラッシュするようになったのを避ける)
        env.setTimeout(() => {
          loadAllSubScripts(env);

          for (let chromeWindow of simpleIterator(
            WindowMediator.getEnumerator('navigator:browser')
          )) {
            env.connectToBrowser(chromeWindow);
          }
        }, 0);
      };

      /* ここから他拡張用の処理 */
      let GM_Tombloo = copy({
        Tombloo : {
          Service : copy(
            {},
            env.Tombloo.Service,
            /(check|share|posters|extractors)/
          ),
        },
      }, env, /(Deferred|DeferredHash|copyString|notify)/);
      let GM_Tombfix = copy({
        Tombfix : {
          Service : copy(
            {},
            env.Tombfix.Service,
            /(check|share|posters|extractors)/
          ),
        },
      }, env, /(Deferred|DeferredHash|copyString|notify)/);

      for (let modelName in env.Models) {
        if (env.Models.hasOwnProperty(modelName)) {
          GM_Tombfix[modelName] = GM_Tombloo[modelName] = copy(
            {},
            env.Models[modelName],
            /^(?!.*(password|cookie))/i
          );
        }
      }

      // 他拡張からの読み取りを許可する(Firefox 17用)
      exposeProperties(GM_Tombloo, true);
      exposeProperties(GM_Tombfix, true);

      // Scriptishサンドボックスの拡張
      try {
        let scope = Cu.import('resource://scriptish/api.js', {});

        scope.GM_API.prototype.GM_Tombloo = GM_Tombloo;
        scope.GM_API.prototype.GM_Tombfix = GM_Tombfix;
      } catch (err) { /* インストールされていない場合や無効になっている場合にエラーになる */ }
      /* 他拡張用の処理ここまで */

      return env;
    }
  });

  // https://developer.mozilla.org/en-US/docs/Mozilla/XPCOM/XPCOM_changes_in_Gecko_2.0#JavaScript_components
  global.NSGetFactory = XPCOMUtils.generateNSGetFactory([TombfixService]);
}(this));
