/* global Components */

(function executeTombfixService(global) {
  'use strict';

  const {
    interfaces: Ci,
    utils: Cu,
    Constructor: CC
  } = Components;

  Object.assign(global, {
    // http://mxr.mozilla.org/mozilla-central/source/toolkit/devtools/Console.jsm
    console: Cu.import(
      'resource://gre/modules/devtools/Console.jsm',
      {}
    ).console
  });

  // http://mxr.mozilla.org/mozilla-central/source/toolkit/modules/Services.jsm
  const {Services} = Cu.import('resource://gre/modules/Services.jsm', {});
  // http://mxr.mozilla.org/mozilla-central/source/js/xpconnect/loader/XPCOMUtils.jsm
  const {XPCOMUtils} = Cu.import('resource://gre/modules/XPCOMUtils.jsm', {});

  const {
    appShell: AppShellService,
    scriptloader: ScriptLoader,
    wm: WindowMediator
  } = Services;

  const FileProtocolHandler = new CC(
    '@mozilla.org/network/protocol;1?name=file',
    'nsIFileProtocolHandler'
  )();

  const CHROME_DIR = 'chrome://tombfix';
  const MAIN_URL = 'https://tombfix.github.io/';
  const SCRIPT_PATHS = [
    'third_party/MochiKit.js',
    'third_party/twitter-text.js',
    'expand.js',
    'component.js',
    'utility.js',
    'tabWatcher.js',
    'repository.js',
    'models.js',
    'Tombfix.Service.js',
    'actions.js',
    'extractors.js',
    'ui.js'
  ];

  function loadScript(url, target) {
    ScriptLoader.loadSubScriptWithOptions(url, Object.assign({
      charset: 'UTF-8',
      ignoreCache: true
    }, target ? {target} : {}));
  }

  function loadLibrary(paths, target) {
    for (let path of paths) {
      loadScript(`${CHROME_DIR}/content/library/${path}`, target);
    }
  }

  // https://developer.mozilla.org/en-US/docs/Components.utils.importGlobalProperties
  Cu.importGlobalProperties(['File', 'URL', 'XMLHttpRequest']);

  loadLibrary(['expand.js'], global);

  // ----[Utility]--------------------------------------------
  function forwardToWindow(propName, ...args) {
    return WindowMediator.getMostRecentWindow(
      'navigator:browser'
    )[propName](...args);
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

    if (env.getPref('disableAllScripts')) {
      return;
    }

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

  // ----[Application]--------------------------------------------
  function setupEnvironment(env) {
    let win = AppShellService.hiddenDOMWindow;

    // 変数/定数はhiddenDOMWindowのものを直接使う
    for (let propName of [
      'window', 'document', 'navigator', 'Node', 'Element', 'KeyEvent',
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

  // https://developer.mozilla.org/en-US/docs/How_to_Build_an_XPCOM_Component_in_Javascript#Using_XPCOMUtils
  function TombfixService(noInit) {
    if (noInit) {
      return;
    }

    // https://developer.mozilla.org/en-US/docs/wrappedJSObject
    this.wrappedJSObject = this.init();
  }

  Object.expand(TombfixService.prototype, {
    className: TombfixService.name,
    classDescription: 'Tombfix\'s JavaScript XPCOM Component',
    contractID: `@${(new URL(MAIN_URL)).hostname}/tombfix-service;1`,
    classID: new Components.ID('{ab5cbd9b-56e1-42e4-8414-2201edb883e7}'),
    QueryInterface: XPCOMUtils.generateQI(),

    CHROME_DIR,
    URL: MAIN_URL,

    global,

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

      // twttrはwindow上に作られる為、事前にenvとwindowで共通のオブジェクトを作っておく
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

      return env;
    }
  });

  // https://developer.mozilla.org/en-US/docs/Mozilla/XPCOM/XPCOM_changes_in_Gecko_2.0#JavaScript_components
  global.NSGetFactory = XPCOMUtils.generateNSGetFactory([TombfixService]);
}(this));
