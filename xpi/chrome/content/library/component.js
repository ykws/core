/* global Components, ConverterInputStream, StringInputStream, update */
/* global createConstructor, FileOutputStream */
/* exported Cr, Preferences, console, AppInfo, StorageService */
/* exported DirectoryService, IOService, WindowMediator, PromptService */
/* exported CookieManager, LoginManager, StringBundleService, ObserverService */
/* exported ThreadManager, DOMStorageManager, ScriptSecurityManager */
/* exported CategoryManager, CacheService */

var {interfaces: Ci, classes: Cc, results: Cr, utils: Cu} = Components,
    // http://mxr.mozilla.org/mozilla-central/source/toolkit/modules/Services.jsm
    {Services} = Cu.import('resource://gre/modules/Services.jsm', {}),
    // http://mxr.mozilla.org/mozilla-central/source/js/xpconnect/loader/XPCOMUtils.jsm
    {XPCOMUtils} = Cu.import('resource://gre/modules/XPCOMUtils.jsm', {}),
    // http://mxr.mozilla.org/mozilla-central/source/toolkit/modules/Preferences.jsm
    {Preferences} = Cu.import('resource://gre/modules/Preferences.jsm', {}),
    // http://mxr.mozilla.org/mozilla-central/source/toolkit/devtools/Console.jsm
    {console} = Cu.import('resource://gre/modules/devtools/Console.jsm', {}),
    {
      appinfo               : AppInfo,
      storage               : StorageService,
      dirsvc                : DirectoryService,
      io                    : IOService,
      wm                    : WindowMediator,
      prompt                : PromptService,
      cookies               : CookieManager,
      logins                : LoginManager,
      strings               : StringBundleService,
      obs                   : ObserverService,
      tm                    : ThreadManager,
      domStorageManager     : DOMStorageManager,
      scriptSecurityManager : ScriptSecurityManager,
      cache                 : CacheService
    } = Services,
    {categoryManager: CategoryManager} = XPCOMUtils;

(function executeComponent(global) {
  'use strict';

  [
    'IWebProgressListener', 'IFile', 'ILocalFile', 'IURI', 'IURL', 'IFileURL',
    'IInputStream', 'ISelectionListener', 'IContentPolicy', 'IHttpChannel',
    'ICache'
  ].forEach(name => {
    global[name] = Ci['ns' + name];
  });

  global.INTERFACES = Object.keys(Ci).map(name => Ci[name]);

  [
    ['AtomService',         'atom-service'],
    ['AlertsService',       'alerts-service'],
    ['NavBookmarksService', 'browser/nav-bookmarks-service'],
    ['NavHistoryService',   'browser/nav-history-service'],
    ['AnnotationService',   'browser/annotation-service'],
    ['ClipboardHelper',     'widget/clipboardhelper'],
    ['MIMEService',         'mime'],
    ['ChromeRegistry',      'chrome/chrome-registry', 'XULChromeRegistry'],
    ['UnescapeHTML',        'feed-unescapehtml',      'ScriptableUnescapeHTML']
  ].forEach(function defineInGlobal([name, cid, ifc]) {
    XPCOMUtils.defineLazyServiceGetter(
      global,
      name,
      '@mozilla.org/' + cid + ';1',
      'nsI' + (ifc || name)
    );
  });

  // http://mxr.mozilla.org/mozilla-central/source/toolkit/components/exthelper/extIApplication.idl
  XPCOMUtils.defineLazyServiceGetter(
    global,
    'FuelApplication',
    '@mozilla.org/fuel/application;1',
    'fuelIApplication'
  );

  /**
   * XPCOMのコンストラクタを生成する。
   * コンストラクタは指定されたインターフェースの定数を全て持つ。
   *
   * @param {String} clsName クラス名(@mozilla.org/以降を指定する)。
   * @param {String || nsIJSID} ifc インターフェイス。
   * @param {String || Function} init
   *        初期化関数。
   *        文字列の場合、該当するメソッドが呼び出される。
   *        関数の場合、生成されたインスタンスをthisとして呼び出される。
   */
  global.createConstructor = function createConstructor(clsName, ifc, init) {
    var cls = Cc['@mozilla.org/' + clsName];

    if (typeof ifc === 'string') {
      let ifcName = ifc, prefixes = ['', 'nsI', 'mozI'];

      for (let idx = 0, len = prefixes.length; idx < len; idx += 1) {
        ifc = Ci[prefixes[idx] + ifcName];

        if (ifc) {
          break;
        }
      }
    }

    function cons() {
      var obj = cls.createInstance(ifc);

      if (init) {
        (typeof init === 'string' ? obj[init] : init).apply(obj, arguments);
      }

      return obj;
    }

    cons.instanceOf = function (obj) {
      return obj instanceof ifc;
    };

    return update(cons, ifc);
  };

  [
    ['WebBrowserPersist',       'embedding/browser/nsWebBrowserPersist;1', {}],
    ['Request',                 'xmlextras/xmlhttprequest;1',      {
      ifc: 'XMLHttpRequest'
    }],
    ['HTMLFormatConverter',     'widget/htmlformatconverter;1',    {
      ifc: 'FormatConverter'
    }],
    ['ScriptError',             'scripterror;1',                   {
      init: 'init'
    }],
    ['Process',                 'process/util;1',                  {
      init: 'init'
    }],
    ['FilePicker',              'filepicker;1',                    {
      init: 'init'
    }],
    ['FileInputStream',         'network/file-input-stream;1',     {
      init: 'init'
    }],
    ['FileOutputStream',        'network/file-output-stream;1',    {
      init: 'init'
    }],
    ['CryptoHash',              'security/hash;1',                 {
      init: 'init'
    }],
    ['InputStream',             'scriptableinputstream;1',         {
      ifc: 'ScriptableInputStream',
      init: 'init'
    }],
    ['HTMLCopyEncoder',         'layout/htmlCopyEncoder;1',        {
      ifc: 'DocumentEncoder',
      init: 'init'
    }],
    ['LocalFile',               'file/local;1',                    {
      init: 'initWithPath'
    }],
    ['StorageStatementWrapper', 'storage/statement-wrapper;1',     {
      init: 'initialize'
    }],
    ['BinaryInputStream',       'binaryinputstream;1',             {
      init: 'setInputStream'
    }],
    ['SupportsString',          'supports-string;1',               {
      init: function (data) {
        this.data = data;
      }
    }],
    ['ConverterInputStream',    'intl/converter-input-stream;1',   {
      init: function (stream, charset, bufferSize) {
        this.init(
          stream,
          charset || 'UTF-8',
          bufferSize || 8192,
          ConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER
        );
      }
    }],
    ['BufferedInputStream',     'network/buffered-input-stream;1', {
      init: function (stream, bufferSize) {
        this.init(stream, bufferSize || 4096);
      }
    }],
    ['StringInputStream',       'io/string-input-stream;1',        {
      init: function (str) {
        this.setData(str, str.length);
      }
    }],
    ['UnicodeConverter',        'intl/scriptableunicodeconverter', {
      ifc: 'ScriptableUnicodeConverter',
      init: function (charset) {
        this.charset = charset || 'UTF-8';
      }
    }],
    ['MIMEInputStream',         'network/mime-input-stream;1',     {
      init: function (stream) {
        this.addContentLength = true;
        this.setData(stream);
      }
    }],
    ['MultiplexInputStream',    'io/multiplex-input-stream;1',     {
      init: function (streams) {
        (streams || []).forEach(stream => {
          if (stream.join) {
            stream = stream.join('\r\n');
          }

          if (typeof stream === 'string') {
            stream = new StringInputStream(stream + '\r\n');
          }

          this.appendStream(stream);
        });
      }
    }]
  ].forEach(function defineInGlobal([name, cid, obj]) {
    global[name] = createConstructor(cid, obj.ifc || name, obj.init);
  });

  update(FileOutputStream, {
    // https://developer.mozilla.org/en-US/docs/PR_Open#Parameters
    PR_RDONLY      : 0x01,
    PR_WRONLY      : 0x02,
    PR_RDWR        : 0x04,
    PR_CREATE_FILE : 0x08,
    PR_APPEND      : 0x10,
    PR_TRUNCATE    : 0x20,
    PR_SYNC        : 0x40,
    PR_EXCL        : 0x80
  });
}(this));
