/* global Components, ConverterInputStream, StringInputStream */
/* global FileOutputStream */

(function executeComponent(global) {
  'use strict';

  const {
    interfaces: Ci,
    classes: Cc,
    results: Cr,
    utils: Cu
  } = Components;

  Object.assign(global, {
    // http://mxr.mozilla.org/mozilla-central/source/toolkit/devtools/Console.jsm
    console: Cu.import('resource://gre/modules/Console.jsm', {}).console
  });

  // http://mxr.mozilla.org/mozilla-central/source/toolkit/modules/Services.jsm
  const {Services} = Cu.import('resource://gre/modules/Services.jsm', {});
  // http://mxr.mozilla.org/mozilla-central/source/js/xpconnect/loader/XPCOMUtils.jsm
  const {XPCOMUtils} = Cu.import('resource://gre/modules/XPCOMUtils.jsm', {});
  // http://mxr.mozilla.org/mozilla-central/source/toolkit/modules/Preferences.jsm
  const {Preferences} = Cu.import('resource://gre/modules/Preferences.jsm', {});

  const {
    appinfo: AppInfo,
    dirsvc: DirectoryService,
    io: IOService,
    wm: WindowMediator,
    prompt: PromptService,
    cookies: CookieManager,
    logins: LoginManager,
    strings: StringBundleService,
    obs: ObserverService,
    tm: ThreadManager,
    // http://mxr.mozilla.org/mozilla-central/source/dom/interfaces/storage/nsIDOMStorageManager.idl
    domStorageManager: DOMStorageManager,
    scriptSecurityManager: ScriptSecurityManager
  } = Services;
  const {categoryManager: CategoryManager} = XPCOMUtils;

  const INTERFACES = Object.values(Ci);

  /**
   * XPCOMのコンストラクタを生成する。
   * コンストラクタは指定されたインターフェースの定数を全て持つ。
   *
   * @param {String} clsName クラス名(@mozilla.org/以降を指定する)。
   * @param {String || nsIJSID} target インターフェイスの名前か、インターフェイスそのもの。
   * @param {String || Function} init
   *        初期化関数。
   *        文字列の場合、該当するメソッドが呼び出される。
   *        関数の場合、生成されたインスタンスをthisとして呼び出される。
   * @return {Object}
   */
  function createConstructor(clsName, target, init) {
    let cls = Cc[`@mozilla.org/${clsName}`];

    let ifc = target;

    if (typeof ifc === 'string') {
      let ifcName = ifc;

      for (let prefix of ['', 'nsI', 'mozI']) {
        ifc = Ci[prefix + ifcName];

        if (ifc) {
          break;
        }
      }
    }

    function cons(...args) {
      let instance = cls.createInstance(ifc);

      if (init) {
        if (String.usable(init)) {
          instance[init](...args);
        } else if (typeof init === 'function') {
          init.apply(instance, args);
        }
      }

      return instance;
    }

    return Object.assign(cons, {
      instanceOf(obj) {
        return obj instanceof ifc;
      }
    }, ifc);
  }

  Object.assign(global, {
    Ci,
    Cc,
    Cr,
    Cu,
    Services,
    XPCOMUtils,
    Preferences,
    AppInfo,
    DirectoryService,
    IOService,
    WindowMediator,
    PromptService,
    CookieManager,
    LoginManager,
    StringBundleService,
    ObserverService,
    ThreadManager,
    DOMStorageManager,
    ScriptSecurityManager,
    CategoryManager,
    INTERFACES,
    createConstructor
  }, [
    ['embedding/browser/nsWebBrowserPersist;1', 'WebBrowserPersist'],
    ['widget/htmlformatconverter;1', 'HTMLFormatConverter', {
      ifcName: 'FormatConverter'
    }],
    ['process/util;1', 'Process', {
      init: 'init'
    }],
    ['filepicker;1', 'FilePicker', {
      init: 'init'
    }],
    ['network/file-input-stream;1', 'FileInputStream', {
      init: 'init'
    }],
    ['network/file-output-stream;1', 'FileOutputStream', {
      init: 'init'
    }],
    ['security/hash;1', 'CryptoHash', {
      init: 'init'
    }],
    ['scriptableinputstream;1', 'InputStream', {
      ifcName: 'ScriptableInputStream',
      init: 'init'
    }],
    ['layout/htmlCopyEncoder;1', 'HTMLCopyEncoder', {
      ifcName: 'DocumentEncoder',
      init: 'init'
    }],
    ['file/local;1', 'LocalFile', {
      init: 'initWithPath'
    }],
    ['binaryinputstream;1', 'BinaryInputStream', {
      init: 'setInputStream'
    }],
    ['supports-string;1', 'SupportsString', {
      init(data) {
        this.data = data;
      }
    }],
    ['intl/converter-input-stream;1', 'ConverterInputStream', {
      init(stream, charset, bufferSize) {
        this.init(
          stream,
          charset || 'UTF-8',
          bufferSize || 8192,
          ConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER
        );
      }
    }],
    ['network/buffered-input-stream;1', 'BufferedInputStream', {
      init(stream, bufferSize) {
        this.init(stream, bufferSize || 4096);
      }
    }],
    ['io/string-input-stream;1', 'StringInputStream', {
      init(str) {
        this.setData(str, str.length);
      }
    }],
    ['intl/scriptableunicodeconverter', 'UnicodeConverter', {
      ifcName: 'ScriptableUnicodeConverter',
      init(charset) {
        this.charset = charset || 'UTF-8';
      }
    }],
    ['network/mime-input-stream;1', 'MIMEInputStream', {
      init(stream) {
        this.addContentLength = true;
        this.setData(stream);
      }
    }],
    ['io/multiplex-input-stream;1', 'MultiplexInputStream', {
      init(streams) {
        if (!streams) {
          return;
        }

        for (let stream of streams) {
          if (stream.join) {
            stream = stream.join('\r\n');
          }

          if (typeof stream === 'string') {
            stream = new StringInputStream(`${stream}\r\n`);
          }

          this.appendStream(stream);
        }
      }
    }]
  ].reduce((obj, list) => {
    let [clsName, target, info] = list;
    let ifcName;
    let init;

    if (info) {
      ifcName = info.ifcName;
      init = info.init;
    }

    return Object.assign(obj, {
      [target]: createConstructor(clsName, ifcName || target, init)
    });
  }, {}), [
    'IWebProgressListener', 'IFile', 'ILocalFile', 'IURI', 'IInputStream',
    'IHttpChannel'
  ].reduce((obj, ifcName) => Object.assign(obj, {
    [ifcName]: Ci[`ns${ifcName}`]
  }), {}));

  Object.assign(FileOutputStream, {
    // https://developer.mozilla.org/en-US/docs/PR_Open#Parameters
    PR_RDONLY: 0x01,
    PR_WRONLY: 0x02,
    PR_RDWR: 0x04,
    PR_CREATE_FILE: 0x08,
    PR_APPEND: 0x10,
    PR_TRUNCATE: 0x20,
    PR_SYNC: 0x40,
    PR_EXCL: 0x80
  });

  for (let [clsName, target, ifcName] of [
    ['atom-service', 'AtomService'],
    ['alerts-service', 'AlertsService'],
    ['browser/nav-bookmarks-service', 'NavBookmarksService'],
    ['browser/nav-history-service', 'NavHistoryService'],
    ['browser/annotation-service', 'AnnotationService'],
    ['widget/clipboardhelper', 'ClipboardHelper'],
    ['mime', 'MIMEService'],
    ['intl/texttosuburi', 'TextToSubURI'],
    ['chrome/chrome-registry', 'ChromeRegistry', 'XULChromeRegistry']
  ]) {
    XPCOMUtils.defineLazyServiceGetter(
      global,
      target,
      `@mozilla.org/${clsName};1`,
      `nsI${ifcName || target}`
    );
  }
}(this));
