var XUL_NS  = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
var HTML_NS = 'http://www.w3.org/1999/xhtml';
var XML_NS  = 'http://www.w3.org/XML/1998/namespace';

var {interfaces: Ci, classes: Cc, results: Cr, utils: Cu} = Components;

var INTERFACES = [];
for(var i in Ci)
	INTERFACES.push(Ci[i]);

if(typeof(update)=='undefined'){
	function update(t, s){
		for(var p in s)
			t[p] = s[p];
		return t;
	}
}

var {console} = Cu.import('resource://gre/modules/devtools/Console.jsm', {}),
	// http://mxr.mozilla.org/mozilla-central/source/toolkit/modules/Preferences.jsm
	{Preferences} = Cu.import('resource://gre/modules/Preferences.jsm', {});

var IWebProgressListener = Ci.nsIWebProgressListener;
var IFile                = Ci.nsIFile;
var ILocalFile           = Ci.nsILocalFile;
var IURI                 = Ci.nsIURI;
var IFileURL             = Ci.nsIFileURL;
var IInputStream         = Ci.nsIInputStream;
var ISelectionListener   = Ci.nsISelectionListener;
var IContentPolicy       = Ci.nsIContentPolicy;
var IHttpChannel         = Ci.nsIHttpChannel;

[
	['StorageService',      'mozIStorageService',        '/storage/service;1'],
	['DirectoryService',    'nsIProperties',             '/file/directory_service;1'],
	['IOService',           'nsIIOService',              '/network/io-service;1'],
	['AtomService',         'nsIAtomService',            '/atom-service;1'],
	['ChromeRegistry',      'nsIXULChromeRegistry',      '/chrome/chrome-registry;1'],
	['WindowMediator',      'nsIWindowMediator',         '/appshell/window-mediator;1'],
	['AlertsService',       'nsIAlertsService',          '/alerts-service;1'],
	['PromptService',       'nsIPromptService',          '/embedcomp/prompt-service;1'],
	['UnescapeHTML',        'nsIScriptableUnescapeHTML', '/feed-unescapehtml;1'],
	['CookieManager',       'nsICookieManager',          '/cookiemanager;1'],
	['LoginManager',        'nsILoginManager',           '/login-manager;1'],
	['StringBundleService', 'nsIStringBundleService',    '/intl/stringbundle;1'],
	['NavBookmarksService', 'nsINavBookmarksService',    '/browser/nav-bookmarks-service;1'],
	['NavHistoryService',   'nsINavHistoryService',      '/browser/nav-history-service;1'],
	['AnnotationService',   'nsIAnnotationService',      '/browser/annotation-service;1'],
	['ObserverService',     'nsIObserverService',        '/observer-service;1'],
	['ClipboardHelper',     'nsIClipboardHelper',        '/widget/clipboardhelper;1'],
	['MIMEService',         'nsIMIMEService',            '/mime;1'],
	['CategoryManager',     'nsICategoryManager',        '/categorymanager;1'],
	['ThreadManager',       'nsIThreadManager',          '/thread-manager;1'],
	['AppInfo',             null,                        '/xre/app-info;1'],
	['DOMStorageManager',   'nsIDOMStorageManager',      '/dom/localStorage-manager;1'],
	['ScriptSecurityManager', 'nsIScriptSecurityManager', '/scriptsecuritymanager;1']
].forEach(function([name, ifc, cid]){
	defineLazyServiceGetter(this, name, '@mozilla.org' + cid, ifc);
}, this);

broad(AppInfo, [Ci.nsIXULRuntime]);  // nsIXULRuntime => AppInfo.OS

var HTMLFormatConverter =
	createConstructor('/widget/htmlformatconverter;1', 'nsIFormatConverter');

var Request =
	createConstructor('/xmlextras/xmlhttprequest;1', 'nsIXMLHttpRequest');

var SupportsString =
	createConstructor('/supports-string;1', 'nsISupportsString', function(data){
		this.data = data;
	});

var LocalFile =
	createConstructor('/file/local;1', 'nsILocalFile', 'initWithPath');

var WebBrowserPersist =
	createConstructor('/embedding/browser/nsWebBrowserPersist;1', 'nsIWebBrowserPersist');

var StorageStatementWrapper =
	createConstructor('/storage/statement-wrapper;1', 'mozIStorageStatementWrapper', 'initialize');

var ScriptError =
	createConstructor('/scripterror;1', 'nsIScriptError', 'init');

var Process =
	createConstructor('/process/util;1', 'nsIProcess', 'init');

var FilePicker =
	createConstructor('/filepicker;1', 'nsIFilePicker', 'init');

var InputStream =
	createConstructor('/scriptableinputstream;1', 'nsIScriptableInputStream', 'init');

var BinaryInputStream =
	createConstructor('/binaryinputstream;1', 'nsIBinaryInputStream', 'setInputStream');

var FileInputStream =
	createConstructor('/network/file-input-stream;1', 'nsIFileInputStream', 'init');

var ConverterInputStream =
	createConstructor('/intl/converter-input-stream;1', 'nsIConverterInputStream', function(stream, charset, bufferSize){
		this.init(stream, charset || 'UTF-8', bufferSize || 8192, ConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
	});

var MIMEInputStream =
	createConstructor('/network/mime-input-stream;1', 'nsIMIMEInputStream', function(stream){
		this.addContentLength = true;
		this.setData(stream);
	});

var BufferedInputStream =
	createConstructor('/network/buffered-input-stream;1', 'nsIBufferedInputStream', function(stream, bufferSize){
		this.init(stream, bufferSize || 4096);
	});

var StringInputStream =
	createConstructor('/io/string-input-stream;1', 'nsIStringInputStream', function(str){
		this.setData(str, str.length);
	});

var UnicodeConverter =
	createConstructor('/intl/scriptableunicodeconverter', 'nsIScriptableUnicodeConverter', function(charset){
		this.charset = charset || 'UTF-8';
	});

var MultiplexInputStream =
	createConstructor('/io/multiplex-input-stream;1', 'nsIMultiplexInputStream', function(streams){
		var self = this;
		streams = streams || [];
		streams.forEach(function(stream){
			if(stream.join)
				stream = stream.join('\r\n');
			
			if(typeof(stream)=='string')
				stream = new StringInputStream(stream + '\r\n');
			
			self.appendStream(stream);
		});
	});

var CryptoHash =
	createConstructor('/security/hash;1', 'nsICryptoHash', 'init');

var FileOutputStream =
	update(createConstructor('/network/file-output-stream;1', 'nsIFileOutputStream', 'init'), {
		PR_RDONLY : 0x01,
		PR_WRONLY : 0x02,
		PR_RDWR   : 0x04,
		PR_CREATE_FILE : 0x08,
		PR_APPEND : 0x10,
		PR_TRUNCATE : 0x20,
		PR_SYNC : 0x40,
		PR_EXCL : 0x80,
	});

var HTMLCopyEncoder =
	createConstructor('/layout/htmlCopyEncoder;1', 'nsIDocumentEncoder', 'init');


// ----[Utility]-------------------------------------------------
function createMock(sample, proto){
	var non = function(){};
	sample = typeof(sample)=='object'? sample : Cc[sample].createInstance();
	
	var ifcs = getInterfaces(sample);
	var Mock = function(){};
	
	for(var key in sample){
		try{
			if(sample.__lookupGetter__(key))
				continue;
			
			var val = sample[key];
			switch (typeof(val)){
			case 'number':
			case 'string':
				Mock.prototype[key] = val;
				continue;
			
			case 'function':
				Mock.prototype[key] = non;
				continue;
			}
		} catch(e){
			// コンポーネント実装により発生するプロパティ取得エラーを無視する
		}
	}
	
	Mock.prototype.QueryInterface = createQueryInterface(ifcs);
	
	// FIXME: extendに変える(アクセサをコピーできない)
	update(Mock.prototype, proto);
	update(Mock, Mock.prototype);
	
	return Mock;
}

function createQueryInterface(ifcNames){
	var ifcs = ['nsISupports'].concat(ifcNames).map(function(ifcName){
		return Ci[''+ifcName];
	});
	
	return function(iid){
		if(ifcs.some(function(ifc){
			return iid.equals(ifc);
		})){
			return this;
		}
		
		throw Cr.NS_NOINTERFACE;
	}
}

/**
 * XPCOMのコンストラクタを生成する。
 * コンストラクタは指定されたインターフェースの定数を全て持つ。
 *
 * @param {String} clsName クラス名(@mozilla.org以降を指定する)。
 * @param {String || nsIJSID} ifc インターフェイス。
 * @param {String || Function} init
 *        初期化関数。
 *        文字列の場合、該当するメソッドが呼び出される。
 *        関数の場合、生成されたインスタンスをthisとして呼び出される。
 */
function createConstructor(clsName, ifc, init){
	var cls = Cc['@mozilla.org' + clsName];
	ifc = typeof(ifc)=='string'? Ci[ifc] : ifc;
	
	var cons = function(){
		var obj = cls.createInstance(ifc);
		if(init){
			if(typeof(init)=='string'){
				obj[init].apply(obj, arguments);
			} else {
				init.apply(obj, arguments);
			}
		}
		return obj;
	};
	
	cons.instanceOf = function(obj){
		return (obj instanceof ifc);
	};
	
	for(var prop in ifc)
		cons[prop] = ifc[prop];
	
	return cons;
}

/**
 * XPCOMサービスを定義する。
 * XPCOMUtils.defineLazyServiceGetterより。
 * Firefox 3.5では存在しないため別途作成した。
 *
 * @param {Object} obj サービスを取得するプロパティを付加するオブジェクト。
 * @param {String} name プロパティ名称。
 * @param {String} cid Contract ID。
 * @param {String} ifc インターフェイス名。
 */
function defineLazyServiceGetter(obj, name, cid, ifc){
	var cls = Cc[cid];
	if(!cls)
		return;
	
	obj.__defineGetter__(name, function(){
		delete this[name];
		try{
			return this[name] = (ifc)? cls.getService(Ci[ifc]) : broad(cls.getService());
		} catch(e){}
	});
}

/**
 * XPCOMインスタンスの実装しているインターフェース一覧を取得する。
 *
 * @param {Object} obj XPCOMインスタンス。
 * @return {Array} インターフェースのリスト。
 */
function getInterfaces(obj){
	var result = [];
	
	for(var i=0,len=INTERFACES.length ; i<len ; i++){
		var ifc = INTERFACES[i];
		try {
			if (obj instanceof ifc) {
				result.push(ifc);
			}
		} catch(e) { }
	}
	
	return result;
}

/**
 * XPCOMインスタンスの実装しているインターフェースを全て利用できるようにする。
 * パフォーマンスに注意する箇所では、インターフェースのリストを渡し検査範囲を限定して使う。
 *
 * @param {Object} obj XPCOMインスタンス。
 * @param {optional Array} ifcs インターフェースのリスト。指定されない場合、全インターフェイスが検査される。
 */
function broad(obj, ifcs){
	ifcs = ifcs || INTERFACES;
	for(var i=0,len=ifcs.length ; i<len ; i++) {
		try {
			if(obj instanceof ifcs[i]);
		} catch(e) { }
	}
	return obj;
};

/**
 * スレッドを使って非ブロックで待機する。
 *
 * @param {Function} cond 待機終了判定処理。trueを返すと待機が終了する。
 */
function till(cond){
	let thread = ThreadManager.mainThread;
	
	do{
		thread.processNextEvent(true);
	}while(cond && !cond());
}

/**
 * 通知バブルを表示する。
 * 処理完了やエラーなどを通知するために用いる。
 * MacのFirefox 3ではGrowlになる。
 *
 * @param {String} title タイトル。
 * @param {String} msg メッセージ。
 * @param {String} icon アイコン種類。定数の中から選択するか、独自のURLを渡す。
 */
function notify(title, msg, icon){
	AlertsService && AlertsService.showAlertNotification(
		icon, title, msg,
		false, '', null);
}
notify.ICON_DOWNLOAD = 'chrome://mozapps/skin/downloads/downloadIcon.png';
notify.ICON_INFO     = 'chrome://global/skin/console/bullet-question.png';
notify.ICON_ERROR    = 'chrome://global/skin/console/bullet-error.png';
notify.ICON_WORN     = 'chrome://global/skin/console/bullet-warning.png';

/**
 * URIを生成する。
 *
 * @param {String || nsIFile || nsIURI} path URLまたはファイルまたはディレクトリパス。nsIURIの場合、そのまま返す。
 */
function createURI(path){
	if(!path)
		return;
	
	if (path instanceof IURI) {
		return path;
	}
	
	try{
		var path = (path instanceof IFile) ? path : new LocalFile(path);
		return broad(IOService.newFileURI(path));
	}catch(e){}
	
	try {
		var uri = IOService.newFileURI(path, null, null);
		uri instanceof Ci.nsIURL;
	} catch(e) {
		uri = IOService.newURI(path, null, null);
		uri instanceof Ci.nsIURL;
	}
	return uri;
}

/**
 * ファイルを取得する。
 *
 * @param {String || nsIFile || nsIURI} uri
 *        URI。file:またはchrome:から始まるアドレスを指定する。
 *        c:\のようなパスも動作する。
 *        nsIFileの場合、そのまま返す。
 */
function getLocalFile(uri){
	if(uri instanceof ILocalFile)
		return uri;
	
	uri = createURI(uri);
	
	if(uri.scheme == 'chrome')
		uri = ChromeRegistry.convertChromeURL(uri);
	
	if(uri.scheme == 'jar')
		uri = createURI(uri.spec.replace(/(^jar:|!\/$)/g, ''));
	
	if(uri.scheme != 'file')
		return;
	
	return IOService.getProtocolHandler('file').
		QueryInterface(Ci.nsIFileProtocolHandler).
		getFileFromURLSpec(uri.spec).
		QueryInterface(ILocalFile);
}

/**
 * 拡張のインストールされているディレクトリを取得する。
 *
 * @param {String} id 拡張ID。
 * @return {String} 
 *         拡張のリソースディレクトリ。
 *         展開しない拡張はjarファイルが返る。
 *         拡張が見つからない場合はnullが返る。
 */
var getExtensionDir = (() => {
	var {AddonManager} = Cu.import('resource://gre/modules/AddonManager.jsm', {});
	return function getExtensionDir(id) {
		// 最終的にXPIProvider.jsmのXPIDatabase.getVisibleAddonForIDにて
		// statement.executeAsyncを使った問い合わせで取得される
		var dir = false;
		AddonManager.getAddonByID(id, function(addon){
			dir = (!addon)? null : getLocalFile(addon.getResourceURI('/'));
		});
		
		till(function(){
			return dir !== false;
		});
		
		return dir;
	};
})();

function setPrefValue(prefName, value) {
	Preferences.set(prefName, value);
}

function getPrefValue(prefName) {
	return Preferences.get(prefName);
}

/**
 * ユーザが通常利用しているダウンロードディレクトリを取得する。
 * Firefoxオプションで指定したディレクトリ、または、最後にダウンロードしたディレクトリになる。
 */
function getDownloadDir(){
	try {
		var dir = new LocalFile(getPrefValue('browser.download.dir') || getPrefValue('browser.download.lastDir'));
		if(dir.exists())
			return dir
	} catch(e) {}
	
	return DirectoryService.get('DfltDwnld', IFile);
}

/**
 * 現在利用しているプロファイルディレクトリを取得する。
 */
function getProfileDir(){
	return DirectoryService.get('ProfD', IFile);
}

/**
 * テンポラリディレクトリを取得する。
 */
function getTempDir(){
	return DirectoryService.get('TmpD', IFile);
}

/**
 * 直近にアクティブだったブラウザウィンドウを取得する。
 */
function getMostRecentWindow(){
	return WindowMediator.getMostRecentWindow('navigator:browser');
}

/**
 * ストリームを処理する。
 * 実行後に必ずストリームが閉じられる。
 *
 * @param {Object} stream ストリーム。
 * @param {Function} func ストリームを利用する処理。ストリームが渡される。
 */
function withStream(stream, func){
	try{
		return func(stream);
	} finally{
		stream && stream.close && stream.close();
	}
}

/**
 * HTML文字列からobject/script/body/styleなどの要素を取り除く。
 * また不完全なタグなどを整形し正しいHTMLへ変換する。
 *
 * @param {String} html HTML文字列。
 * @return {String} 整形されたHTML文字列。
 */
function sanitizeHTML(html){
	var doc = document.implementation.createDocument('', '', null);
	var root = doc.appendChild(doc.createElement('root'));
	
	var fragment = UnescapeHTML.parseFragment(html, false, null, doc.documentElement);
	doc.documentElement.appendChild(fragment);
	
	if(!root.childNodes.length)
		return '';
	return serializeToString(root).match(/^<root>(.*)<\/root>$/)[1];
}

function serializeToString(xml){
	return (new XMLSerializer()).serializeToString(xml);
}
