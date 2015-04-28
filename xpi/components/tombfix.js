/* global Components */

(function executeTombfixService(global) {
  'use strict';

  const CHROME_DIR = 'chrome://tombfix',
        SCRIPT_PATHS = [
          'third_party/MochiKit.js',
          'third_party/twitter-text.js',
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
        ],
        {interfaces: Ci, utils: Cu} = Components,
        // http://mxr.mozilla.org/mozilla-central/source/toolkit/modules/Services.jsm
        {Services} = Cu.import('resource://gre/modules/Services.jsm', {}),
        // http://mxr.mozilla.org/mozilla-central/source/js/xpconnect/loader/XPCOMUtils.jsm
        {XPCOMUtils} = Cu.import('resource://gre/modules/XPCOMUtils.jsm', {}),
        // http://mxr.mozilla.org/mozilla-central/source/toolkit/devtools/Console.jsm
        /* jshint ignore: start */
        {console} = Cu.import(
          'resource://gre/modules/devtools/Console.jsm',
          {}
        ),
        /* jshint ignore: end */
        {
          appShell: AppShellService,
          scriptloader: ScriptLoader,
          wm: WindowMediator
        } = Services,
        FileProtocolHandler = new Components.Constructor(
          '@mozilla.org/network/protocol;1?name=file',
          'nsIFileProtocolHandler'
        )();

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

  // ----[Utility]--------------------------------------------
  function forwardToWindow(propName, ...args) {
    return WindowMediator.getMostRecentWindow(
      'navigator:browser'
    )[propName](...args);
  }

  function copy(targetObj, obj, re) {
    return Object.keys(obj).reduce((target, propName) => {
      if (!re || re.test(propName)) {
        target[propName] = obj[propName];
      }

      return target;
    }, targetObj);
  }

  function exposeProperties(obj, recursive) {
    Object.expand(obj, {
      __exposedProps__: {}
    });

    for (let propName of Object.keys(obj)) {
      obj.__exposedProps__[propName] = 'r';

      if (recursive) {
        let val = obj[propName];

        if (typeof val === 'object' && val !== null) {
          exposeProperties(val, true);
        }
      }
    }
  }

  function* simpleIterator(simpleEnum, ifcName) {
    let ifc = typeof ifcName === 'string' ? Ci[ifcName] : ifcName;

    while (simpleEnum.hasMoreElements()) {
      let value = simpleEnum.getNext();

      yield ifc ? value.QueryInterface(ifc) : value;
    }
  }

  function getScriptFiles(dir) {
    return [...simpleIterator(dir.directoryEntries, 'nsILocalFile')].filter(
      file => file.leafName.endsWith('.js')
    );
  }

  function loadSubScripts(files, target) {
    for (let file of files) {
      // 壊れたパッチを読み込んだ時に、Tombfixが起動できなくなるのを防ぐ
      // また、壊れたパッチがあると他の動作するパッチを読み込めなくなるのを防ぐ
      try {
        loadScript(FileProtocolHandler.getURLSpecFromFile(file), target);
      } catch (err) {
        Cu.reportError(err);
      }
    }
  }

  function loadAllSubScripts(env) {
    // libraryの読み込み
    loadLibrary(SCRIPT_PATHS, env);

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

  // ----[Application]--------------------------------------------
  function setupEnvironment(env) {
    let win = AppShellService.hiddenDOMWindow;

    // 変数/定数はhiddenDOMWindowのものを直接使う
    for (let propName of [
      'window', 'document', 'navigator', 'Node', 'Element', 'Event', 'KeyEvent',
      'DOMParser', 'XPathResult', 'XSLTProcessor'
    ]) {
      env[propName] = win[propName];
    }

    // メソッドはthisが変わるとエラーになることがあるためbindして使う
    for (let propName of [
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'
    ]) {
      env[propName] = win[propName].bind(win);
    }

    // モーダルにするためhiddenDOMWindowではなく最新のウィンドウのメソッドを使う
    for (let propName of ['alert', 'confirm', 'prompt']) {
      env[propName] = forwardToWindow.bind(null, propName);
    }
  }

  function setupExternalExtentionEnvironment(env) {
    /* jshint camelcase: false */
    let GM_Tombfix = copy({
          Tombfix: {
            Service: copy(
              {},
              env.Tombfix.Service,
              /^(?:check|share|extractors)$/
            )
          }
        }, env, /(Deferred|copyString|notify)/),
        GM_Tombloo = copy({
          Tombloo: {
            Service: copy(
              {},
              env.Tombloo.Service,
              /^(?:check|share|extractors)$/
            )
          }
        }, env, /(Deferred|copyString|notify)/);

    for (let model of env.Models.values) {
      let modelName = model.name;

      GM_Tombfix[modelName] = GM_Tombloo[modelName] = copy(
        {},
        env.Models[modelName],
        /^(?!.*(password|cookie))/i
      );
    }

    // 他拡張からの読み取りを許可する(Firefox 17+)
    exposeProperties(GM_Tombfix, true);
    exposeProperties(GM_Tombloo, true);

    // Scriptishサンドボックスの拡張
    try {
      let scope = Cu.import('resource://scriptish/api.js', {});

      scope.GM_API.prototype.GM_Tombfix = GM_Tombfix;
      scope.GM_API.prototype.GM_Tombloo = GM_Tombloo;
    } catch (err) { /* インストールされていない場合や無効になっている場合にエラーになる */ }
  }

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

      setupExternalExtentionEnvironment(env);

      return env;
    }
  });

  // https://developer.mozilla.org/en-US/docs/Mozilla/XPCOM/XPCOM_changes_in_Gecko_2.0#JavaScript_components
  global.NSGetFactory = XPCOMUtils.generateNSGetFactory([TombfixService]);
}(this));
