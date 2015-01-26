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
notify.ICON_INFO = 'chrome://global/skin/icons/information-64.png';

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

// ----[Application]-------------------------------------------------
function getPref(pref) {
	return getPrefValue('extensions.tombfix.' + pref);
}

function setPref(pref, value) {
	setPrefValue('extensions.tombfix.' + pref, value);
}

var CHROME_DIR = 'chrome://tombfix';
var CHROME_CONTENT_DIR = CHROME_DIR + '/content';

var EXTENSION_ID = 'tombfix@tombfix.github.io';

var XUL_NS  = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
var HTML_NS = 'http://www.w3.org/1999/xhtml';

var KEY_ACCEL = (AppInfo.OS == 'Darwin')? 'META' : 'CTRL';
var PATH_DELIMITER = (navigator.appVersion.indexOf('Windows') != -1)? '\\' : '/';

var grobal = this;
disconnectAll(grobal);

// リロードによって変更されない領域を用意する
// イベントに安定してフックするためなどに使われる
if(typeof(constant)=='undefined')
	constant = {};

updatePatchChromeManifest();

function updatePatchChromeManifest(){
	var DELIMITER = '# GENERATED';
	
	var dataDir = createURI(getDataDir()).spec;
	var line = 'content tombfix-patch ' + dataDir;
	var manifest = getChromeManifestFile();
	var contents = getContents(manifest);
	var updated =
		contents.split(DELIMITER).shift() +
		DELIMITER + '\n' +
		line + '\n';
	
	if(contents != updated){
		putContents(manifest, updated);
		ChromeRegistry.checkForNewChrome();
	}
}

function reload(){
	// getExtensionDir > till > processNextEventが非同期となり、
	// コンテキスト全体の更新動作が不安定になる
	// これを避けるためリロードを遅延させる
	// (設定画面を閉じる際にFirefox 4以降がクラッシュするようになったのを避ける)
	setTimeout(function(){
		loadAllSubScripts();
		getWindows().forEach(connectToBrowser);
	}, 0);
}


// ----[XPCOM]-------------------------------------------------
/**
 * JavaScriptコードを評価する。
 *
 * @param {String} js JavaScriptコード。
 * @param {String ||  nsIXPCComponents_utils_Sandbox} url 
 *        同一生成元チェックのベースになるURI、またはサンドボックスオブジェクト。
 * @return {Object} 
 *         評価結果。値がundefinedの場合、評価コンテキスト(サンドボックス)が返る。
 *         'var obj = {};'のようなAPI返り値を処理しやすくする。
 */
function evalInSandbox(js, url){
	var sandbox = (url.importFunction)? url : Cu.Sandbox(url);
	var res = Cu.evalInSandbox(js, sandbox);
	return (typeof(res)=='undefined')? sandbox : res;
}

function wrappedObject(obj){
	return obj.wrappedJSObject || obj;
}

function copyString(str){
	ClipboardHelper.copyString(str);
}

/**
 * 相対パスを解決する。
 *
 * @param {String} relativePath 相対パス。
 * @param {String || nsIFile || nsIURI} basePath 基点となるパス。
 */
function resolveRelativePath(relativePath, basePath){
	return createURI(basePath).resolve(relativePath);
}

function getCookies(host, name){
	host = '' + host;
	return filter(function(c){
		// ホストの末尾が同一か?
		var len = Math.min(c.host.length, host.length);
		return (c.host.slice(-len) == host.slice(-len)) &&
			(name? c.name == name : true);
	}, CookieManager.enumerator);
}

function getCookieString(host, name){
	return getCookies(host, name).map(function(c){
		return c.name + '=' + c.value;
	}).join('; ');
}

function getCookieValue(host, name){
	var cookies = getCookies(host, name);
	if(cookies.length )
		return cookies[0].value;
}

function getPasswords(host, user){
	return map(function(p){
		return {
			user : p.username,
			usernameFieldName : p.usernameField,
			password : p.password,
			passwordFieldName : p.passwordField,
		}
	}, ifilter(function(p){
		return (user? p.username == user : true);
	}, LoginManager.findLogins({}, host, host, null)));
}

var stringBundle = StringBundleService.createBundle(CHROME_DIR + '/locale/messages.properties');
function getMessage(key){
	var ps = Array.splice(arguments, 1);
	try{
		if(ps){
			return stringBundle.formatStringFromName(key, ps, ps.length);
		} else {
			return stringBundle.GetStringFromName(key);
		}
	} catch(e){
		return '';
	}
}

/**
 * 簡単なフォームを表示しユーザーの入力を得る。
 * 以下の形式のフォームを定義できる。
 *  - チェックボックス + OK/キャンセル
 *  - テキストボックス + チェックボックス
 *  - リストボックス
 *
 * @param {Object} form フォーム定義。
 * @param {String} title ウィンドウタイトル。
 */
function input(form, title){
	if(typeof(form)=='string')
		return PromptService.confirm(null, title, form);
	
	function m(key){
		return getMessage(key) || key || '';
	}
	
	// リストボックス形式のフォームか?
	var pair;
	if(some(form, function(p){
		pair = p;
		return isArrayLike(p[1]);
	})){
		var selected = {};
		var [msg, list] = pair;
		if(!PromptService.select(null, m(title), m(msg), list.length, list, selected))
			return;
		
		return list[selected.value];
	}
	
	var args = [null, m(title)];
	for(var msg in form){
		args.push(m(msg));
		
		// メッセージではないか？
		if(form[msg] != null){
			// 値を一時的にオブジェクトに変換する
			var val = {value : form[msg]};
			form[msg] = val;
			args.push(val);
		}
	}
	
	var vals = values(form);
	var method = (vals[0] == null && typeof(vals[1].value) == 'boolean')? 'confirmCheck' : 'prompt';
	
	// テキストボックスのみか？(チェックボックス不要の場合)
	if(method=='prompt' && args.length==4)
		args = args.concat([null, {}]);
	
	if(!PromptService[method].apply(PromptService, args))
		return;
	
	// 返り値を取り出す
	for(var msg in form)
		form[msg] = form[msg] && form[msg].value;
	
	return form;
}

function download(sourceURL, targetFile){
	var d = new Deferred();
	var sourceURI = createURI(sourceURL);
	
	if(!targetFile)
		targetFile = getDownloadDir();
	
	if(targetFile.exists() && targetFile.isDirectory())
		targetFile.append(validateFileName(sourceURI.fileName));
	
	var targetURI = IOService.newFileURI(targetFile);
	
	var p = WebBrowserPersist();
	
	p.progressListener = {
		onLocationChange : function(){},
		onProgressChange : function(){},
		onSecurityChange : function(){},
		onStatusChange   : function(){},
		onStateChange    : function(progress, req, state, status){
			if(state & IWebProgressListener.STATE_STOP){
				broad(req);
				
				var res = {
					channel      : req,
					status       : req.responseStatus,
					statusText   : req.responseStatusText,
				};
				
				if(!res.status || res.status < 400){
					d.callback(targetFile, res);
				}else{
					error(res);
					targetFile.remove(false);
					
					res.message = getMessage('error.http.' + res.status);
					d.errback(res);
				}
			}
		},
	}
	
	p.persistFlags =
		p.PERSIST_FLAGS_FROM_CACHE |
		p.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
		p.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
	p.saveURI(sourceURI, null, null, null, null, targetURI, null);
	
	return d;
}

function createDir(dir, basePath){
	if(basePath){
		basePath = (basePath instanceof IFile)? basePath.path : basePath;
		
		if(basePath.slice(-1) != PATH_DELIMITER)
			basePath += PATH_DELIMITER;
	} else {
		basePath = '';
	}
	
	dir = basePath + ((dir instanceof IFile)? dir.path : dir);
	dir = dir.replace(/[\/\\]/g, PATH_DELIMITER);
	
	// 複数階層を一度に作成するため新しくインスタンスを生成する
	dir = new LocalFile(dir);
	
	if(dir.exists()){
		if(dir.isDirectory())
			dir.permissions = 0774;
	} else {
		dir.create(dir.DIRECTORY_TYPE, 0774);
	}
	
	return dir;
}

function uriToFileName(uri) {
	var uriObj = createURI(uri),
		fileName = uriObj.scheme === 'data' ?
			uri.slice(0, 100) :
			(uriObj.host + uriObj.filePath).replace(/\/$/, '');

	return validateFileName(fileName);
}

function clearCollision(file){
	var name = file.leafName;
	for(var count = 2 ; file.exists() ; count++)
		file.leafName = name.replace(/(.*)\./, '$1('+count+').');
}

function getPatchDir(){
	var dir = getDataDir();
	dir.append('script');
	
	return createDir(dir);
}

function getDataDir(name){
	var path = 'file:///' + getPref('dataDir').replace(/\{(.*?)\}/g, function(all, name){
		return DirectoryService.get(name, IFile).path;
	}).replace(/\\/g, '/')
	
	var dir = createDir(getLocalFile(path));
	name && dir.append(name);
	return dir;
}

/**
 * テンポラリディレクトリを取得する。
 */
function getTempDir(name){
	var dir = DirectoryService.get('TmpD', IFile);
	name && dir.append(name);
	
	return dir;
}

function getTempFile(ext){
	var file = getTempDir();
	file.append(joinText(['tombfix_' + Date.now(), ext], '.'));
	
	return file;
}

function getChromeManifestFile(){
	var manifest = getExtensionDir(EXTENSION_ID);
	manifest.append('chrome.manifest');
	
	return manifest;
}

/**
 * ダイアログを開く。
 *
 * @param {String} url ウィンドウURL。
 * @param {String} features ウィンドウの特徴。
 * @param {Object} value ウィンドウへ渡す値。
 */
function openDialog(url, features, value){
	var win = getMostRecentWindow();
	var args = Array.slice(arguments);
	args.splice(1, 0, '_blank')
	return win.openDialog.apply(win, args);
}

/**
 * ブラウザウィンドウのリストを取得する。
 */
function getWindows(){
	return list(WindowMediator.getEnumerator('navigator:browser'));
}

function addTab(url, background){
	var d = new Deferred();
	var tabbrowser = getMostRecentWindow().getBrowser();
	var tab = tabbrowser.addTab(url);
	var browser = tab.linkedBrowser;
	if(!background)
		tabbrowser.selectedTab = tab;
	
	browser.addEventListener('DOMContentLoaded', function callee(event){
		browser.removeEventListener('DOMContentLoaded', callee, true);
	
		d.callback(wrappedObject(event.originalTarget.defaultView));
	}, true);
	
	return d;
}

function getContents(file, charset){
	file = getLocalFile(file);
	if(!file.exists())
		return '';
	
	try{
		return withStream(new FileInputStream(file, -1, 0, false), function(fis){
			return withStream(new ConverterInputStream(fis, charset, fis.available()), function(cis){
				var out = {};
				cis.readString(fis.available(), out);
				return out.value;
			});
		});
	} catch(e){}
}

function putContents(file, text, charset){
	withStream(new FileOutputStream(file,
		FileOutputStream.PR_WRONLY | FileOutputStream.PR_CREATE_FILE | FileOutputStream.PR_TRUNCATE, 420, -1), function(stream){
		text = text.convertFromUnicode(charset);
		stream.write(text, text.length);
	});
}

/**
 * 外部エディタでファイルを開く。
 * Greasemonkeyで設定されているエディタ、または、ブラウザでソースを開く時に使われるエディタが呼び出される。
 *
 * @param {nsIFile || String} path 対象ファイルのパス。
 */
function openInEditor(path){
	if(path instanceof IFile)
		path = path.path;
	
	var app =
		getLocalFile(getPrefValue('greasemonkey.editor')) ||
		getLocalFile(getPrefValue('view_source.editor.path'));
	if(!app || !app.exists())
		return;
	
	if(AppInfo.OS == 'Darwin'){
		var args = ['-a', app.path, path];
		app = new LocalFile('/usr/bin/open');
		app.followLinks = true;
	} else {
		var args = [path];
	}
	
	new Process(app).run(false, args, args.length);
}

/**
 * チャンネルにクッキーを付加する。
 *
 * @param {nsIHttpChannel} channel
 */
function setCookie(channel){
	// サードパーティのクッキーを送信するか?
	if(!(channel instanceof IHttpChannel) || getPrefValue('network.cookie.cookieBehavior') != 1){
		// デフォルトのクッキー付加処理を利用する
		return channel;
	}
	
	channel.setRequestHeader('Cookie', getCookieString(channel.originalURI.host), true);
	
	return channel;
}

/**
 * POST/GETの通信を行う。
 * マルチパートを使ったアップロードも行える。
 *
 * @param {String} url リクエストURL。
 * @param {Object} opts リクエストオプション。
 * @param {String} opts.referrer リファラURL。
 * @param {Object} opts.headers リクエストヘッダー。
 * @param {String} opts.charset 文字セット。指定されない場合、レスポンスヘッダの文字セットが使われる。
 * @param {String || Object} opts.queryString クエリ。
 * @param {String || Object} opts.sendContent
 *        コンテント。設定されているとPOSTメソッドになる。値に直接ファイルをセットしてもよい。
 * @param {nsIInputStream || nsIFile} opts.KEY.file アップロードファイル。
 * @param {String} opts.KEY.fileName
 *        サーバーへ送信するファイル名。指定されない場合、元のファイル名が使われる。
 * @param {String} opts.KEY.contentType
 *        コンテントタイプ。指定されない場合、application/octet-streamになる。
 */
function request(url, opts){
	if (opts && opts.responseType) {
		return simpleRequest(url, opts);
	}
	
	var d = new Deferred();
	
	opts = opts || {};
	
	var uri = createURI(joinText([url, queryString(opts.queryString)], '?'));
	
	// requestMethodを変更するため要求するインタフェースは必要最小限に留める
	let channel = broad(IOService.newChannelFromURI(uri), [Ci.nsIUploadChannel, IHttpChannel]);
	
	if(opts.referrer)
		channel.referrer = createURI(opts.referrer);
	
	if(opts.headers)
		items(opts.headers).forEach(function([key, value]){
			channel.setRequestHeader(key, value, true);
		});
	
	setCookie(channel);
	
	if(opts.sendContent){
		var contents = opts.sendContent;
		
		// マルチパートチェック/パラメーター準備
		var multipart;
		for(var name in contents){
			// 値として直接ファイルが設定されているか?
			var value = contents[name];
			if(value instanceof IInputStream || value instanceof IFile)
				value = contents[name] = {file : value};
			
			if(value && value.file)
				multipart = true;
		}
		
		if(!multipart){
			contents = queryString(contents);
			channel.setUploadStream(
				new StringInputStream(contents),
				'application/x-www-form-urlencoded', -1);
		} else {
			var boundary = '---------------------------' + Date.now();
			var streams = [];
			
			for(var name in contents){
				var value = contents[name];
				if(value==null)
					continue;
				
				if(!value.file){
					streams.push([
						'--' + boundary,
						'Content-Disposition: form-data; name="' + name + '"',
						'',
						value.convertFromUnicode? value.convertFromUnicode() : value,
					]);
				} else {
					if(value.file instanceof IFile){
						value.contentType = value.contentType || getMimeType(value.file);
						value.fileName = value.file.leafName;
						value.file = IOService.newChannelFromURI(createURI(value.file)).open();
					}
					
					streams.push([
						'--' + boundary,
						'Content-Disposition: form-data; name="' + name + '"; filename="' + (value.fileName || '_') + '"',
						'Content-Type: ' + (value.contentType || 'application/octet-stream'),
						'',
					])
					streams.push(new BufferedInputStream(value.file));
					streams.push('');
				}
			}
			streams.push('--' + boundary + '--');
			
			var mimeStream = new MIMEInputStream(new MultiplexInputStream(streams));
			mimeStream.addHeader('Content-Type', 'multipart/form-data; boundary=' + boundary);
			channel.setUploadStream(mimeStream, null, -1);
		}
	}
	
	var redirectionCount = 0;
	var listener = {
		QueryInterface : createQueryInterface([
			'nsIStreamListener',
			'nsIProgressEventSink',
			'nsIHttpEventSink',
			'nsIInterfaceRequestor',
			'nsIChannelEventSink']),
		
		isAppOfType : function(val){
			// http://hg.mozilla.org/mozilla-central/file/FIREFOX_3_1b2_RELEASE/docshell/base/nsILoadContext.idl#l78
			//
			// 本リスナが特定のアプリケーション目的で使用され、その
			// アプリケーション種別に対して動作可能かを返す。
			// val にはアプリケーション種別を示す nsIDocShell の
			// APP_TYPE_XXX が渡される。
			//
			//   APP_TYPE_UNKNOWN 0
			//   APP_TYPE_MAIL    1
			//   APP_TYPE_EDITOR  2
			return (val == 0);
		},
		
		// nsIProgressEventSink
		onProgress : function(req, ctx, progress, progressMax){},
		onStatus : function(req, ctx, status, statusArg){},
		
		// nsIInterfaceRequestor
		getInterface : function(iid){
			try{
				return this.QueryInterface(iid);
			}catch(e){
				throw Cr.NS_NOINTERFACE;
			}
		},
		
		// nsIHttpEventSink
		onRedirect : function(oldChannel, newChannel){},
		
		// nsIChannelEventSink
		onRedirectResult: function(){},
		
		asyncOnChannelRedirect : function(oldChannel, newChannel, flags, redirectCallback) {
			this.onChannelRedirect(oldChannel, newChannel, flags);
			redirectCallback.onRedirectVerifyCallback(0);
		},
		
		// Firefox 4で廃止(asyncOnChannelRedirectへ移行)
		onChannelRedirect : function(oldChannel, newChannel, flags){
			// channel.redirectionLimitを使うとリダイレクト後のアドレスが取得できない
			redirectionCount++;
			
			if(opts.redirectionLimit!=null && redirectionCount>opts.redirectionLimit){
				// NS_ERROR_REDIRECT_LOOP
				newChannel.cancel(2152398879);
				
				var res = {
					channel : newChannel,
					responseText : '',
					status : oldChannel.responseStatus,
					statusText : oldChannel.responseStatusText,
				};
				d.callback(res);
				
				return;
			}
			
			// HEADメソッドを引き継ぐ(GETに変わり遅くならないように)
			broad(oldChannel);
			if(oldChannel.requestMethod == 'HEAD'){
				broad(newChannel);
				newChannel.requestMethod = 'HEAD';
			}
			
			setCookie(newChannel);
		},
		
		// nsIStreamListener
		onStartRequest: function(req, ctx){
			this.data = [];
		},
		
		onDataAvailable: function(req, ctx, stream, sourceOffset, length){
			this.data.push(new InputStream(stream).read(length));
		},
		
		onStopRequest: function (req, ctx, status){
			// Firefox 3ではcancelするとonStopRequestは呼ばれない
			if(opts.redirectionLimit!=null && redirectionCount>opts.redirectionLimit)
				return;
			
			broad(req);
			
			var text = this.data.join('');
			try{
				var charset = opts.charset || req.contentCharset || text.extract(/content=["'].*charset=(.+?)[;"']/i);
				text = charset? text.convertToUnicode(charset) : text;
				
				var res = {
					channel      : req,
					responseText : text,
					status       : req.responseStatus,
					statusText   : req.responseStatusText,
				};
			} catch(e) {
				// contentCharsetなどのプロパティ取得時にNS_ERROR_NOT_AVAILABLEエラーが発生することがある
				var res = {
					channel      : req,
					responseText : text,
					status       : null,
					statusText   : null,
				};
			}
			
			if(Components.isSuccessCode(status) && res.status < 400){
				d.callback(res);
			}else{
				error(res);
				
				res.message = getMessage('error.http.' + res.status);
				d.errback(res);
			}
		},
	};
	
	// setUploadStream後にPUTになっているのを補正する
	channel.requestMethod =
		(opts.method)? opts.method :
		(opts.sendContent)? 'POST' : 'GET';
	channel.notificationCallbacks = listener;
	channel.asyncOpen(listener, null);
	
	// requestMethod決定後にインターフェースを拡張する
	broad(channel);
	
	// 確実にガベージコレクトされるように解放する
	listener = null;
	channel = null;
	
	return d;
}

// via Taberareloo 3.0.2's request()
// https://github.com/Constellation/taberareloo/blob/3.0.2/src/lib/utils.js#L870
function simpleRequest(url, opt) {
	var req = Request(), // new XMLHttpRequest()
		ret = new Deferred(),
		setHeader = true,
		position = -1,
		data, method, multipart, error;

	opt = opt ? update({}, opt) : {};
	method = opt.method && opt.method.toUpperCase();

	if (opt.queryString) {
		url += queryString(opt.queryString, true);
	}

	// construct FormData (if required)
	multipart = opt.multipart || false;
	if (opt.sendContent && opt.mode && opt.mode === 'raw') {
		// no modify, use sendContent directly
		data = opt.sendContent;
		if (!method) {
			method = 'POST';
		}
	} else if (opt.sendContent && (!method || method === 'POST')) {
		let sendContent = opt.sendContent;
		if (!method) {
			method = 'POST';
		}
		for (let key in sendContent) {
			let file = sendContent[key];

			if (file instanceof IFile) {
				// https://developer.mozilla.org/en-US/docs/Extensions/Using_the_DOM_File_API_in_chrome_code
				file = sendContent[key] = File(file);
			}

			if (file instanceof File) {
				multipart = true;
				break;
			}
		}
		if (multipart) {
			// using FormData is not unstable in Yahoo Model.
			// so, use it in multipart pattern only
			data = new window.FormData();
			for (let key in sendContent) {
				let value = sendContent[key];
				if (value === null || value === undefined) {
					continue;
				}
				data.append(key, value);
			}
		} else {
			data = queryString(sendContent, false);
		}
	}

	// construct method
	if (!method) {
		method = 'GET';
	}

	// open XHR
	if ('username' in opt) {
		req.open(method, url, true, opt.username, opt.password);
	} else {
		req.open(method, url, true);
	}

	// construct responseType
	if (opt.responseType) {
		req.responseType = opt.responseType;
	}

	// construct charset
	if (opt.charset) {
		req.overrideMimeType(opt.charset);
	}

	// construct headers
	if (opt.headers) {
		if (opt.headers['Content-Type']) {
			setHeader = false;
		}
		Object.keys(opt.headers).forEach(function (key) {
			req.setRequestHeader(key, opt.headers[key]);
		});
	}

	if (opt.referrer) {
		req.setRequestHeader('Referer', opt.referrer);
	}

	if (setHeader && opt.sendContent && !multipart) {
		req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	}

	req.addEventListener('progress', function (e) {
		position = e.position;
	});

	req.addEventListener('readystatechange', function () {
		if (req.readyState === 4) {
			var length = 0;
			try {
				length = parseInt(req.getResponseHeader('Content-Length'), 10);
			} catch (err) {
				debug('ERROR', err);
			}
			// 最終時のlengthと比較
			if (position !== length) {
				if (opt.denyRedirection) {
					ret.errback(req);
					error = true;
				}
			}
			if (!error) {
				if (req.status >= 200 && req.status < 300) {
					ret.callback(req);
				} else {
					req.message = getMessage('error.http.' + req.status);
					ret.errback(req);
				}
			}
		}
	});

	if (data) {
		req.send(data);
	} else {
		req.send();
	}

	return ret;
}

function getMimeType(file){
	try{
		return (file instanceof IFile)?
			MIMEService.getTypeFromFile(file) :
			MIMEService.getTypeFromExtension(file)
	}catch(e){
		// 取得に失敗するとエラーが発生する(拡張子が無い場合など)
		return '';
	}
}

// ----[MochiKit]-------------------------------------------------
function connected(src, sig){
	return MochiKit.Signal._observers.some(function(o){
		return o.source === src && o.signal === sig && o.connected;
	});
}

function maybeDeferred(d) {
	return typeof(d) == 'function'?
		MochiKit.Async.maybeDeferred(d) :
		(d==null || !d.addCallback)?
			succeed(d) :
			d;
}

MochiKit.Base.update(MochiKit.Signal._specialKeys, {
	61  : 'KEY_SEMICOLON',
	226 : 'KEY_HORIZONTAL_BAR'
});

function formContents(elm){
	if(typeof(elm)=='string')
		elm = convertToHTMLDocument(elm);
	
	return reduce(function(p, a){
		p[a[0]]=a[1];
		return p;
	}, zip.apply(null, MochiKit.DOM.formContents(elm)), {});
}

// via Taberareloo 3.0.2's queryString()
// https://github.com/Constellation/taberareloo/blob/3.0.2/src/lib/utils.js#L467
function queryString(params, question) {
	var queries;

	if (typeof params === 'string') {
		return params;
	}

	if (isEmpty(params)) {
		return '';
	}

	queries = [];

	for (let key in params) {
		if (params.hasOwnProperty(key)) {
			let value = params[key];
			if (value == null) {
				continue;
			} else if (Array.isArray(value)) {
				value.forEach(function (val) {
					queries.push(encodeURIComponent(key) + '=' + encodeURIComponent(val));
				});
			} else {
				queries.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
			}
		}
	}

	return (question ? '?' : '') + queries.join('&');
}

// via Taberareloo 3.0.2's queryHash()
// https://github.com/Constellation/taberareloo/blob/3.0.2/src/lib/utils.js#L494
function queryHash(query) {
	var hash = {};

	query.replace(/^\?/, '').split(/[&;]/).forEach(function (pair) {
		pair = pair.split('=');

		if (pair.length === 2) {
			let [key, val] = pair;
			if (!hash[key]) {
				hash[key] = val;
			} else if (Array.isArray(hash[key])) {
				hash[key].push(val);
			} else {
				hash[key] = [hash[key], val];
			}
		}
	});

	return hash;
}

registerIteratorFactory(
	'SimpleEnumerator',
	function(it){
		return it && typeof(it.hasMoreElements) == "function";
	},
	function(it){
		var ifcs;
		return {
			next: function(){
				if(!it.hasMoreElements())
					throw StopIteration;
				
				var res = it.getNext();
				if(!ifcs)
					ifcs = getInterfaces(res);
				return broad(res, ifcs);
			}
		};
	});

registerIteratorFactory(
	'TreeWalker',
	function(it){
		return it instanceof Ci.nsIDOMTreeWalker;
	},
	function(it){
		return {
			next: function(){
				var elm;
				if(!(elm = it.nextNode()))
					throw StopIteration;
				
				return elm;
			}
		};
	});

registerIteratorFactory(
	'XPathResult',
	function(it){
		return Object.prototype.toString.call(it).slice(8, -1) === 'XPathResult';
	},
	function(it){
		var i = 0;
		var len = it.snapshotLength;
		return {
			next: function(){
				if(i >= len)
					throw StopIteration;
				
				return it.snapshotItem(i++);
			}
		};
	},
	// iterateNextにマッチしないように先頭に追加する
	true);

registerIteratorFactory(
	'XML',
	function(it){
		return typeof(it) == "xml";
	},
	function(it){
		var i = 0;
		var len = it.length();
		return {
			next: function(){
				if(i >= len)
					throw StopIteration;
				
				return it[i++];
			}
		};
	});

if(NavHistoryService){
	registerIteratorFactory(
		'nsINavHistoryContainerResultNode',
		function(it){
			return it instanceof Ci.nsINavHistoryContainerResultNode;
		},
		function(it){
			var i = 0;
			var len = it.childCount;
			return {
				next: function(){
					if(i >= len)
						throw StopIteration;
					
					return it.getChild(i++);
				}
			};
		});
}

// 実験的、itemsの利用を推奨
registerIteratorFactory(
	'Object',
	function(it){
		return it && typeof(it) == "object";
	},
	function(it){
		var props = keys(it).filter(function(prop){
			return it.hasOwnProperty(prop);
		});
		return {
			next: function(){
				var prop = props.shift();
				if(!prop)
					throw StopIteration;
				
				return [prop, it[prop]];
			}
		};
	});

/*
function deferredForEach(it, func, index){
	index = index || 0;
	it = iter(it);

	var d = succeed();
	try{
		return d.
			addCallback(func, it.next(), index).
			addCallback(deferredForEach, it, func, ++index).
			addErrback(function(e){
				if(e.message!=StopIteration) throw e;
			});
	} catch (e if e==StopIteration){
		return d;
	}
}
*/

// FIXME: JSDeferred的な解決/エラーハンドリング
// 暫定パッチ、事前にリスト作成、無限リストに未対応
function deferredForEach(it, func){
	var d = new Deferred();
	var index = 0
	forEach(it, function(item){
		d.addCallback(func, item, index);
		++index;
	});
	d.addErrback(function(err){
		if(err.message==StopIteration)
			return;
		
		throw err;
	});
	d.callback();
	
	return d;
}

function DeferredHash(ds){
	var props = keys(ds);
	
	return new DeferredList(values(ds)).addCallback(function(results){
		var res = {};
		for (var i = 0; i < results.length; i++)
			res[props[i]] = results[i];
		return res;
	});
};

function getViewDimensions(){
	var d = new Dimensions();
	var doc = currentDocument();
	
	if(doc.compatMode == 'CSS1Compat'){
		d.h = doc.documentElement.clientHeight;
		d.w = doc.documentElement.clientWidth;
	} else {
		d.h = doc.body.clientHeight;
		d.w = doc.body.clientWidth;
	}
	
	return d;
}

function getPageDimensions(){
	var d = new Dimensions();
	var doc = currentDocument();
	
	if(doc.compatMode == 'CSS1Compat'){
		d.h = doc.documentElement.scrollHeight;
		d.w = doc.documentElement.scrollWidth;
	} else {
		d.h = doc.body.scrollHeight;
		d.w = doc.body.scrollWidth;
	}
	
	return d;
}

function getElementPosition(elm){
	return withWindow(elm.ownerDocument.defaultView, function(){
		return MochiKit.Style.getElementPosition(elm);
	});
}

function roundPosition(p){
	return new Coordinates(
		Math.round(p.x),
		Math.round(p.y));
}


// ----[General]-------------------------------------------------
function debug(msg){
	if(!getPref('debug'))
		return msg;
	
	return log(msg);
}

function log(msg) {
	if (!firebug('log', arguments)) {
		console[typeof msg === 'object' ? 'dir' : 'log'](msg);
	}

	return msg;
}

function error(err) {
	if (!firebug('error', arguments)) {
		console.trace();
		console.log(err);
		Cu.reportError(err);
	}
	
	return err;
}

function firebug(method, args){
	if(!getPref('useFirebug'))
		return false;
	
	var win = getMostRecentWindow();
	if(win.FirebugConsole && win.FirebugContext) {
		var console = new win.FirebugConsole(win.FirebugContext, win.content);
		console[method].apply(console, args);
		return true;
	}
	
	// Firebug 1.2~
	if( win.Firebug && win.Firebug.Console ){
		try {
			win.Firebug.Console.logFormatted.call(win.Firebug.Console, Array.slice(args), win.FirebugContext, method);
		
			return true;
		} catch(e) {
			// Firebug 1.4.5でコンソールが開かれていないときに発生するエラーを抑止する
		}
	}

	return false;
}

/**
 * オブジェクトの全てのプロパティを取得する。
 *
 * @param {Object} obj 取得対象のオブジェクト。
 * @param {Object} ancestor プロパティ探索の終端オブジェクト。
 *                 Object.prototypeの列挙を除外する場合などに用いる。
 * @return {Array} プロパティ名のリスト。
 */
function getAllPropertyNames(obj, ancestor){
	var props = {};
	while (obj !== null && obj !== ancestor){
		Object.getOwnPropertyNames(obj).forEach(function(prop){
			props[prop] = null;
		});
		obj = Object.getPrototypeOf(obj);
	}
	return Object.keys(props);
}

function isEmpty(obj){
	for(var i in obj)
		return false;
	return true;
}

function pickUp(a, pop){
	var i = random(a.length);
	return pop ? a.splice(i, 1)[0] : a[i];
}

function random(max){
	return Math.floor(Math.random() * max);
}

/**
 * オブジェクトのプロパティをコピーする。
 * ゲッター/セッターの関数も対象に含まれる。
 *
 * @param {Object} target コピー先。
 * @param {Object} source コピー元。
 * @return {Object} コピー先。
 */
function extend(target, source, overwrite){
	overwrite = overwrite==null? true : overwrite;
	
	for(var p in source){
		var getter = source.__lookupGetter__(p);
		if(getter)
			target.__defineGetter__(p, getter);
		
		var setter = source.__lookupSetter__(p);
		if(setter)
			target.__defineSetter__(p, setter);
		
		if(!getter && !setter && (overwrite || !(p in target)))
			target[p] = source[p];
	}
	
	return target;
}

/**
 * メソッドが呼ばれる前に処理を追加する。
 * より詳細なコントロールが必要な場合はaddAroundを使うこと。
 *
 * @param {Object} target 対象オブジェクト。
 * @param {String} name メソッド名。
 * @param {Function} before 前処理。
 *        対象オブジェクトをthisとして、オリジナルの引数が全て渡されて呼び出される。
 */
function addBefore(target, name, before) {
	var original = target[name];
	target[name] = function() {
		before.apply(target, arguments);
		return original.apply(target, arguments);
	}
}

/**
 * メソッドへアラウンドアドバイスを追加する。
 * 処理を置きかえ、引数の変形や、返り値の加工をできるようにする。
 *
 * @param {Object} target 対象オブジェクト。
 * @param {String || Array} methodNames
 *        メソッド名。複数指定することもできる。
 *        set*のようにワイルドカートを使ってもよい。
 * @param {Function} advice
 *        アドバイス。proceed、args、target、methodNameの4つの引数が渡される。
 *        proceedは対象オブジェクトにバインド済みのオリジナルのメソッド。
 */
function addAround(target, methodNames, advice){
	methodNames = [].concat(methodNames);
	
	// ワイルドカードの展開
	for(var i=0 ; i<methodNames.length ; i++){
		if(methodNames[i].indexOf('*')==-1) continue;
		
		var hint = methodNames.splice(i, 1)[0];
		hint = new RegExp('^' + hint.replace(/\*/g, '.*'));
		for(var prop in target) {
			if(hint.test(prop) && typeof(target[prop]) == 'function')
				methodNames.push(prop);
		}
	}
	
	methodNames.forEach(function(methodName){
		var method = target[methodName];
		target[methodName] = function() {
			var self = this;
			return advice(
				function(args){
					return method.apply(self, args);
				},
				arguments, self, methodName);
		};
		target[methodName].overwrite = (method.overwrite || 0) + 1;
	});
}

/**
 * 配列を結合し文字列を作成する。
 * 空要素は除外される。
 * 配列が空の場合は、空文字列が返される。
 * 配列の入れ子は直列化される。
 *
 * @param {Array} txts 文字列配列。
 * @param {String} delm 区切り文字列。
 * @param {Boolean} trimTag 各文字列からHTMLタグを除外するか。
 * @return {String} 結合された文字列。
 */
function joinText(txts, delm, trimTag){
	if(!txts)
		return '';
	
	if(delm==null)
		delm = ',';
	txts = flattenArray([].concat(txts).filter(function(txt){
		return txt != null && txt != '';
	}));
	return (trimTag? txts.map(methodcaller('trimTag')) : txts).join(delm);
}

// http://mxr.mozilla.org/mozilla/source/toolkit/content/contentAreaUtils.js#811
function validateFileName(fileName){
	if (navigator.appVersion.indexOf("Windows") != -1) {
		return fileName.
			replace(/[\"]+/g, "'").
			replace(/[\*\:\?]+/g, " ").
			replace(/[\<]+/g, "(").
			replace(/[\>]+/g, ")").
			replace(/[\\\/\|]+/g, "_");
	}
	else if (navigator.appVersion.indexOf("Macintosh") != -1){
		return fileName.replace(/[\:\/]+/g, "_");
	}
	
	return fileName.replace(/[\/]+/g, "_");
}

/**
 * Windows上でWSHを実行する。
 * スクリプト内から表示された文字列はコールバックされる。
 *
 * @param {Function} func WSHスクリプト。
 * @param {Array} args WSHスクリプトの引数。
 * @param {Boolean} blocking 同期で実行するか。デフォルトは非同期。
 * @return {Deferred}
 */
function runWSH(func, args, blocking){
	args = (args==null)? [] : [].concat(args);
	args.unshift(func);
	
	var d = new Deferred();
	
	var bat = getTempFile('bat');
	var script = getTempFile();
	var out = new LocalFile(script.path + '.out');
	
	// リダイレクト結果を取得するためバッチ経由で実行する
	putContents(bat, [
		'cscript //E:JScript //Nologo',
		script.path.quote(),
		'>',
		out.path.quote()
	].join(' '));
	putContents(script,
		runWSH.utility +
		'var ARGS = ' + uneval(args) + ';\n' +
		uneval(function(){
			try{
				WScript.echo('(' + JSON.stringify(ARGS.shift().apply(null, ARGS)) + ')');
			} catch(e) {
				WScript.echo('throw ' + JSON.stringify(e) + ';');
			}
		}) + '();');
	
	var end = function(){
		var res = getContents(out, 'Shift-JIS').replace(/\s+$/, '');
		
		out.remove(false);
		bat.remove(false);
		script.remove(false);
		
		try{
			res = eval(res);
			d.callback(res);
		}catch(e){
			d.errback(e);
		}
	};
	
	var process = new Process(bat);
	if(!process.runAsync || blocking){
		process.run(true, [], 0);
		end();
	} else {
		process.runAsync([], 0, {
			observe : end,
		});
	}
	
	return d;
}

runWSH.utility = getContents(CHROME_CONTENT_DIR + '/wsh.js');

function getFinalUrl(url){
	return request(url, {
		method : 'HEAD',
	}).addCallback(function(res){
		return res.channel.URI.spec;
	});
}

function getJSON(url, opts){
	return request(url, opts).addCallback(function(res){
		return evalInSandbox('(function(){return ' + res.responseText + '})()', url);
	});
}

// ----[State]-------------------------------------------------
var State = {
	make : function(cls, stateSetName, stateSet, defaultStateName){
		if(arguments.length == 3){
			defaultStateName = stateSet;
			stateSet = stateSetName;
			stateSetName = void(0);
		}
		
		var p = cls.prototype;
		var K = this.K;
		forEach(this.gatherProperties(stateSet), function(prop){
			for(var i in stateSet){
				var state = stateSet[i];
				if(!state[prop])
					state[prop] = K;
			}
		});
		
		update(p, stateSet[defaultStateName]);
		
		if(stateSetName){
			update(p, this._multiProto);
			if(!p.state){
				p.state={};
				p.stateSet={};
			}
			p.state[stateSetName] = defaultStateName;
			p.stateSet[stateSetName] = stateSet;
		} else {
			update(p, this._singleProto);
			p.state = defaultStateName;
			p.stateSet = stateSet;
		}
	},
	
	gatherProperties : function(stateSet){
		var props = {};
		for(var i in stateSet)
			for(var prop in stateSet[i])
				props[prop] = true;
		
		return keys(props);
	},
	
	K : function(arg){
		return arg;
	},
	
	_singleProto: {
		changeState : function(stateName){
			update(this, this.stateSet[stateName]);
			this.state = stateName;
			
			if(this.onChangeState)
				this.onChangeState();
		}
	},
	
	_multiProto: {
		changeState : function(stateSetName, stateName){
			update(this, this.stateSet[stateSetName][stateName]);
			
			// 各オブジェクト個別の状態を持つためにクローンを行い変更する
			this.state = update({}, this.state);
			this.state[stateSetName] = stateName;
			
			if(this.onChangeState)
				this.onChangeState();
		}
	}
}

function dynamicBind(func, self){
	return function(){
		return self[func].apply(self, arguments);
	}
}

// ----[DOM/XML]-------------------------------------------------
'tree treecols treecol treechildren treeitem treerow treecell splitter'.split(' ').forEach(function(tag){
	grobal[tag.toUpperCase()] = bind(E, null, tag);
});

function E(){
	var tag = Array.prototype.shift.call(arguments);
	var elm = currentDocument().createElement(tag);
	
	var text = [];
	function processChild(arr){
		Array.prototype.forEach.call(arr, function(value){
			if(!value)
				return;
			
			if(value && value.nodeType){
				elm.appendChild(value);
				return;
			}
			
			switch (typeof(value)) {
				case 'string':
				case 'number':
					elm.appendChild(currentDocument().createTextNode(value))
					break;
				
				default:
					if(value.forEach){
						processChild(value)
						break;
					}
					
					for(var key in value){
						var attr = value[key];
						switch(key){
						case 'class': elm.className = attr; break;
						case 'style': elm.style.cssText = attr; break;
						default:      elm.setAttribute(key, attr);
						}
					};
					break;
			}
		});
	}
	processChild(arguments);
	
	return elm;
}

function unescapeHTML(s){
	return s.replace(
		/&amp;/g, '&').replace(
		/&quot;/g, '"').replace(
		/&lt;/g, '<').replace(
		/&gt;/g, '>');
}

function clearChildren(p){
	Array.slice(p.childNodes).forEach(p.removeChild, p);
}

function tagName(elm){
	return elm.tagName? elm.tagName.toLowerCase() : '';
}

function $x(exp, context, multi) {
	context = context || currentDocument();
	
	var doc = context.ownerDocument || context;
	var exp = doc.createExpression(exp, {
		lookupNamespaceURI : function(prefix){
			switch (prefix){
			case 'xul':
				return XUL_NS;
			case 'html':
			case 'xhtml':
				return HTML_NS;
			default:
				return '';
			}
		},
	});
	
	var value = function(node){
		if(!node)
			return;
		
		switch (node.nodeType) {
		case Node.ELEMENT_NODE:
			return node;
		case Node.ATTRIBUTE_NODE:
			return node.value;
		case Node.TEXT_NODE:
			return node.textContent;
		}
	}
	
	var result = exp.evaluate(context, XPathResult.ANY_TYPE, null);
	switch (result.resultType) {
		case XPathResult.STRING_TYPE : return result.stringValue;
		case XPathResult.NUMBER_TYPE : return result.numberValue;
		case XPathResult.BOOLEAN_TYPE: return result.booleanValue;
		case XPathResult.UNORDERED_NODE_ITERATOR_TYPE: {
			if(!multi)
				return value(result.iterateNext());
			
			result = exp.evaluate(context, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
			var ret = [];
			for (var i = 0, len = result.snapshotLength; i < len ; i++) {
				ret.push(value(result.snapshotItem(i)));
			}
			return ret;
		}
	}
	return null;
}

function convertToDOM(text){
	return new DOMParser().parseFromString(text.replace(/xmlns=["'].*?["']/g,''), 'text/xml');
}

function convertToHTMLDocument(html, doc) {
	html = html.replace(/<!DOCTYPE.*?>/, '').replace(/<html.*?>/, '').replace(/<\/html>.*/, '');
	
	doc = doc || currentDocument() || document;
	var xsl = (new DOMParser()).parseFromString(
		'<?xml version="1.0"?>\
			<stylesheet version="1.0" xmlns="http://www.w3.org/1999/XSL/Transform">\
			<output method="html"/>\
		</stylesheet>', 'text/xml');
	
	var xsltp = new XSLTProcessor();
	xsltp.importStylesheet(xsl);
	
	doc = xsltp.transformToDocument(doc.implementation.createDocument('', '', null));
	doc.appendChild(doc.createElement('html'));
	
	var range = doc.createRange();
	range.selectNodeContents(doc.documentElement);
	doc.documentElement.appendChild(range.createContextualFragment(html));
	
	return doc
}

/**
 * HTMLが表示された状態のプレーンテキストを取得する。
 * 範囲選択をしてコピーした時に得られる文字列に類似。
 *
 * @param {Element || Selection} src DOM要素または選択範囲。
 * @param {Boolean} safe
 *        script要素などの不要要素を除去する。
 *        セキュアなHTMLになるわけではない。
 *        (UnescapeHTMLを用いたsanitizeHTMLメソッドの利用も検討すること)。
 * @return {String} HTML文字列。
 */
function convertToHTMLString(src, safe){
	var me = convertToHTMLString;
	
	// 選択範囲の適切な外側まで含めてHTML文字列へ変換する(pre内選択なども正常処理される)
	var doc = src.ownerDocument || src.focusNode.ownerDocument;
	var encoder = new HTMLCopyEncoder(doc, 'text/unicode', HTMLCopyEncoder.OutputRaw);
	encoder[src.nodeType? 'setNode' : 'setSelection'](src);
	
	var html = encoder.encodeToString();
	if(!safe)
		return html;
	
	// DOMツリーに戻し不要な要素を除去する
	var root;
	if(src.getRangeAt){
		var ancestor = src.getRangeAt(0).commonAncestorContainer;
		root = (src.anchorNode == ancestor)?
			doc.createElement('div') :
			ancestor.cloneNode(false);
		
		// 親にtableを持たない要素にtrを追加すると消える
		if(tagName(root)=='tbody')
			doc.createElement('table').appendChild(root);
 	} else {
		root = doc.createElement('div');
	}
	root.innerHTML = html;
	
	forEach($x('.//*[contains(",' + me.UNSAFE_ELEMENTS + ',", concat(",", local-name(.), ","))]', root, true), removeElement);
	forEach(doc.evaluate('.//@*[not(contains(",' + me.SAFE_ATTRIBUTES + ',", concat(",", local-name(.), ",")))]', root, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null), function(attr){
		attr.ownerElement.removeAttribute(attr.name);
	});
	
	src = appendChildNodes(doc.createDocumentFragment(), root.childNodes);
	
	// 再度HTML文字列へ変換する
	return me(src);
}

update(convertToHTMLString , {
	UNSAFE_ELEMENTS : 'frame,iframe,script,style',
	SAFE_ATTRIBUTES : 'action,align,cellpadding,cellspacing,checked,cite,clear,cols,colspan,content,coords,enctype,face,for,href,label,method,name,nohref,nowrap,rel,rows,rowspan,shape,span,src,style,target,type,usemap,valign,value',
});

/**
 * HTML表示状態のプレーンテキストを取得する。
 * 範囲選択をしてコピーした時に得られる文字列に類似。
 *
 * @param {String || Element || Selection} src HTML文字列、DOM要素、選択範囲のいずれか。
 * @return {String} プレーンテキスト。
 */
function convertToPlainText(src){
	// DOM要素または選択範囲か?
	if(typeof(src)!='string')
		src = convertToHTMLString(src);
	
	// DocumentEncoder(text/plan)を用いるとpre要素内の選択で改行が欠落した
	// クリップボードへのコピー処理と同一のフレーバー作成の方法を使う
	var res = {};
	var converter = new HTMLFormatConverter();
	
	// 2倍のバッファサイズはnsCopySupport.cppの実装より(HTMLの2倍の文字列になることはないという仮定と思われる)
	converter.convert('text/html', new SupportsString(src), src.length * 2, 'text/unicode', res, {})
	
	return broad(res.value).data.replace(/\r/g, '').trim();
}

/**
 * HTML表示状態のプレーンテキストを取得する。
 * 範囲選択をしてコピーした時に得られる文字列に類似。
 *
 * @param {Element || Selection} src DOM要素または選択範囲。
 * @return {String} プレーンテキスト。
 */
function createFlavoredString(src){
	var res = new String(convertToPlainText(src));
	res.flavors = {
		html : convertToHTMLString(src, true),
	};
	return res;
}

/**
 * 表現形式を指定して値を取得する。
 *
 * @param {String} name フレーバー名("html"など)。
 */
function getFlavor(src, name){
	return (src==null || !src.flavors)? src :
		src.flavors[name] || src;
}

function appendMenuItem(menu, label, image, hasChildren){
	var doc = menu.ownerDocument;
	if((/^----/).test(label))
		return menu.appendChild(doc.createElement('menuseparator'));
	
	var item = menu.appendChild(doc.createElement(hasChildren? 'menu' : 'menuitem'));
	item.setAttribute('label', label);
	
	if(image){
		item.setAttribute('class', hasChildren? 'menu-iconic' : 'menuitem-iconic');
		item.setAttribute('image', image);
	}
	
	return item;
}

function keyString(e){
	// 初回呼び出し時にキーテーブルを作成する
	var table = [];
	for(var name in KeyEvent)
		if(name.indexOf('DOM_VK_')==0)
			table[KeyEvent[name]] = name.substring(7);
	
	return (keyString = function(e){
		var code = e.keyCode;
		var res = [];
		(e.metaKey  || code==KeyEvent.DOM_VK_META)    && res.push('META');
		(e.ctrlKey  || code==KeyEvent.DOM_VK_CONTROL) && res.push('CTRL');
		(e.shiftKey || code==KeyEvent.DOM_VK_SHIFT)   && res.push('SHIFT');
		(e.altKey   || code==KeyEvent.DOM_VK_ALT)     && res.push('ALT');

		if((code < KeyEvent.DOM_VK_SHIFT || KeyEvent.DOM_VK_ALT < code) && code != KeyEvent.DOM_VK_META)
			res.push(table[code]);
		
		return res.join(' + ');
	})(e);
}

function cancel(e){
	e.preventDefault();
	e.stopPropagation();
}

function capture(src, pos, dim, scale){
	pos = pos || {x:0, y:0};
	
	// デフォルトではAppShellService.hiddenDOMWindowが使われる
	var canvas = document.createElementNS(HTML_NS, 'canvas');
	var ctx = canvas.getContext('2d');
	canvas.width = dim.w;
	canvas.height = dim.h;
	
	if(scale){
		scale	= scale.w? scale.w/dim.w :
			scale.h? scale.h/dim.h : scale;
		
		canvas.width = dim.w * scale;
		canvas.height = dim.h * scale;
		ctx.scale(scale, scale);
	}
	
	if(src instanceof Ci.nsIDOMHTMLImageElement){
		ctx.drawImage(src, pos.x, pos.y);
	} else {
		ctx.drawWindow(src, pos.x, pos.y, dim.w, dim.h, '#FFF');
	}
	
	return canvas.toDataURL('image/png', '');
}

function convertToDataURL(src){
	return loadImage(src).addCallback(function(img){
		var canvas = document.createElementNS(HTML_NS, 'canvas');
		var ctx = canvas.getContext('2d');
		
		canvas.width = img.width;
		canvas.height = img.height;
		
		ctx.drawImage(img, 0, 0);
		
		return canvas.toDataURL('image/png', '');
	});
}

function toGrayScale(src){
	return loadImage(src).addCallback(function(img){
		var canvas = document.createElementNS(HTML_NS, 'canvas');
		var ctx = canvas.getContext('2d');
		
		canvas.width = img.width;
		canvas.height = img.height;
		
		ctx.drawImage(img, 0, 0);
		
		var image = ctx.getImageData(0, 0, img.width, img.height);
		for(var i=0, d=image.data, len=d.length ; i<len ; i+=4)
			d[i] = d[i+1] = d[i+2] = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
		
		ctx.putImageData(image, 0, 0);
		
		return canvas.toDataURL();
	});
}

function loadImage(src){
	var d = new Deferred();
	
	if(src instanceof Ci.nsIDOMHTMLImageElement){
		var img = src;
	} else {
		var img = document.createElementNS(HTML_NS, 'img');
		img.src = src;
	}
	
	img.addEventListener('load', function(){
		try{
			d.callback(img);
		}catch(e){
			// ロードが複数回呼び出されて発生するエラーを抑止する
		}
	}, false);
	
	img.addEventListener('error', function(){
		d.errback(img);
	}, false);
	
	return d;
}

function getSelectionContents(sel){
	if(!sel)
		return;
	
	sel = (sel.getSelection)? sel.getSelection() : sel;
	if(sel.rangeCount && !sel.isCollapsed)
		return sel.getRangeAt(0).cloneContents();
}


// ----[UI]-------------------------------------------------
var AbstractTreeView = createMock('@mozilla.org/xul/xul-tree-builder;1');

/**
 * マウスショートカットを監視する。
 * マウスダウンにより1セッションがはじまり、全てのボタンのマウスアップで終わる。
 * 2重実行を防ぐため、そのセッションで一度でも処理が行われると以降は実行されない。
 *
 * @param {Element} target 監視対象のエレメント
 * @param {Function} check イベント処理関数(未処理の場合はtrueを返す)
 */
function observeMouseShortcut(target, check){
	var BUTTONS = ['LEFT_DOWN', 'CENTER_DOWN', 'RIGHT_DOWN'];
	var downed = {};
	var event;
	var executed = false;
	target.addEventListener('mousedown', function(e){
		if(isEmpty(downed)){
			target.addEventListener('keydown', onKeyDown, true);
			target.addEventListener('keypress', cancelEvent, true);
			executed = false;
			
			// Firefox 2において後でclientXなどが取得できなくなるためクローンする
			event = update({}, e);
		}
		
		downed[BUTTONS[e.button]] = true;
		
		checkKey(e, [keyString(e), keys(downed)])
	}, true);
	
	target.addEventListener('mouseup', function(e){
		delete downed[BUTTONS[e.button]];
		if(isEmpty(downed)){
			target.removeEventListener('keydown', onKeyDown, true);
			target.removeEventListener('keypress', cancelEvent, true);
			event = null;
		}
	}, true);
	
	target.addEventListener('contextmenu', cancelEvent, true);
	target.addEventListener('click', cancelEvent, true);
	
	function cancelEvent(e){
		// クリックによる遷移やコンテキストメニュー、ショートカットキーなどを抑制する
		if(executed)
			cancel(e)
	}
	
	function onKeyDown(e){
		var code = e.keyCode;
		if(KeyEvent.DOM_VK_SHIFT <= code && code <= KeyEvent.DOM_VK_ALT)
			return;
		
		if(executed){
			cancel(e)
			return;
		}
		
		if(checkKey(e, [keys(downed), keyString(e)]))
			cancel(e);
	}
	
	function checkKey(e, keys){
		var hit = !check(event, joinText(keys, (' + ')));
		if(hit)
			executed = true;
		
		return hit;
	}
}

function selectElement(doc){
	var deferred = new Deferred();
	doc = doc || currentDocument();
	
	var target;
	function onMouseOver(e){
		target = e.target;
		target.originalBackground = target.style.background;
		target.style.background = selectElement.TARGET_BACKGROUND;
	}
	function onMouseOut(e){
		unpoint(e.target);
	}
	function onClick(e){
		cancel(e);
		
		finalize();
		deferred.callback(target);
	}
	function onKeyDown(e){
		cancel(e);
		
		switch(keyString(e)){
		case 'ESCAPE':
			finalize();
			deferred.cancel();
			return;
		}
	}
	function unpoint(elm){
		if(elm.originalBackground!=null){
			elm.style.background = elm.originalBackground;
			elm.originalBackground = null;
		}
	}
	function finalize(){
		doc.removeEventListener('mouseover', onMouseOver, true);
		doc.removeEventListener('mouseout', onMouseOut, true);
		doc.removeEventListener('click', onClick, true);
		doc.removeEventListener('keydown', onKeyDown, true);
		
		unpoint(target);
	}
	
	doc.addEventListener('mouseover', onMouseOver, true);
	doc.addEventListener('mouseout', onMouseOut, true);
	doc.addEventListener('click', onClick, true);
	doc.addEventListener('keydown', onKeyDown, true);
	
	return deferred;
}
selectElement.TARGET_BACKGROUND = '#888';

function selectRegion(doc){
	var deferred = new Deferred();
	doc = doc || currentDocument();
	
	var win = doc.defaultView;
	
	doc.documentElement.style.cursor = 'crosshair';
	
	var style = doc.createElement('style');
	style.innerHTML = commentToText(function(){/*
		* {
			cursor: crosshair !important;
			-moz-user-select: none;
		}
	*/});
	doc.body.appendChild(style);
	
	var region, p, d, moving, square;
	function mouse(e){
		return {
			x: e.clientX,
			y: e.clientY
		};
	}
	
	function onMouseMove(e){
		var to = mouse(e);
		
		if(moving){
			p = {
				x: Math.max(to.x - d.w, 0),
				y: Math.max(to.y - d.h, 0)
			};
			setElementPosition(region, p);
		}
		
		d = {
			w: to.x - p.x,
			h: to.y - p.y
		};
		if(square){
			var s = Math.min(d.w, d.h);
			d = {w: s, h: s};
		}
		setElementDimensions(region, d);
	}
	
	function onMouseDown(e){
		cancel(e);
		
		p = mouse(e);
		region = doc.createElement('div');
		region.setAttribute('style', [
			'background : #888;',
			'opacity    : 0.5;',
			'position   : fixed;',
			'z-index    : 999999999;',
			'top        : ' + p.y + 'px;',
			'left       : ' + p.x + 'px;'
		].join('\n'));
		doc.body.appendChild(region);
		
		doc.addEventListener('mousemove', onMouseMove, true);
		doc.addEventListener('mouseup', onMouseUp, true);
		win.addEventListener('keydown', onKeyDown, true);
		win.addEventListener('keyup', onKeyUp, true);
	}
	
	function onKeyDown(e){
		cancel(e);
		
		switch(keyString(e)){
		case 'SHIFT': square = true; return;
		case 'SPACE': moving = true; return;
		case 'ESCAPE':
			finalize();
			deferred.cancel();
			return;
		}
	}
	
	function onKeyUp(e){
		cancel(e);
		
		switch(keyString(e)){
		case 'SHIFT': square = false; return;
		case 'SPACE': moving = false; return;
		}
	}
	
	function onMouseUp(e){
		cancel(e);
		
		p = getElementPosition(region);
		finalize();
		
		// FIXME: 暫定/左上方向への選択不可/クリックとのダブルインターフェース未実装
		if(!d || d.w<0 || d.h<0){
			deferred.cancel();
			return;
		}
		
		deferred.callback({
			position: p,
			dimensions: d,
		});
	}
	
	function onClick(e){
		// リンククリックによる遷移を抑止する
		cancel(e);
		
		// mouseupよりも後にイベントが発生するため、ここで取り除く
		doc.removeEventListener('click', onClick, true);
	}
	
	function finalize(){
		doc.removeEventListener('mousedown', onMouseDown, true);
		doc.removeEventListener('mousemove', onMouseMove, true);
		doc.removeEventListener('mouseup', onMouseUp, true);
		win.removeEventListener('keydown', onKeyDown, true);
		win.removeEventListener('keyup', onKeyUp, true);
		
		doc.documentElement.style.cursor = '';
		
		removeElement(region);
		removeElement(style);
	}
	
	doc.addEventListener('mousedown', onMouseDown, true);
	doc.addEventListener('click', onClick, true);
	doc.defaultView.focus();
	
	return deferred;
}

function flashView(doc){
	var d = new Deferred();
	var doc = doc || currentDocument();
	var flash = doc.createElement('div');
	flash.setAttribute('style', commentToText(function(){/*
		background : #EEE;
		position   : fixed;
		z-index    : 999999999;
		top        : 0;
		left       : 0;
	*/}));
	setElementDimensions(flash, getViewDimensions());
	doc.body.appendChild(flash);
	fade(flash, {
		duration : 0.1,
		afterFinish : function(){
			removeElement(flash);
			d.callback();
		},
	});
	
	return d;
}

// ----[Model/Service]-------------------------------------------------
/**
 * 同一ログインセッション中に共通の値を共有するサービスのベースクラス。
 * ポスト前のサーバー接続回数を減らすことを目的としている。
 * ポスト毎にトークンなどが変わるサービスに対しては利用できない。
 */
AbstractSessionService = {
	/**
	 * セッションの同一性を確認する。
	 * セッションが変わっていたら以前のアカウントデータは消去される。
	 * セッションの同一性は、サブクラスのgetAuthCookieの返り値で判定される。
	 * 
	 * @return {String} 
	 *         セッションが以前と同一ならsame、
	 *         変わっていたらchanged、
	 *         存在しない場合はnoneが、それぞれ返る。
	 */
	updateSession : function(){
		var cookie = this.getAuthCookie();
		if(cookie && this.cookie == cookie)
			return 'same';
		
		delete this.cookie;
		delete this.user;
		delete this.token;
		delete this.password;
		
		if(!cookie)
			return 'none';
		
		this.cookie = cookie;
		
		return 'changed';
	},
	
	/**
	 * セッションに関連するトークンやユーザー名などの情報を取得する。
	 *
	 * @param {String} key 
	 *        取得対象プロパティ名。
	 *        user/token/passwordのいずれかを想定。
	 * @param {Function} func 
	 *        セッション値取得関数。
	 *        新規取得時またはセッション変更時に呼び出される。
	 *        Deferred経由で値を返すこと。
	 */
	getSessionValue : function(key, func){
		var self = this;
		switch (this.updateSession()){
		case 'none':
			return fail(new Error(getMessage('error.notLoggedin')));
		
		case 'same':
			if(self[key])
				return succeed(self[key]);
		
		case 'changed':
			return func.apply(self).addCallback(function(value){
				return self[key] = value;
			});
		}
	},
}

var openInActionBase = {
	check : function check() {
		return true;
	},
	execute : function execute(ctx) {
		var app = this.getFile(getPrefValue(this.prefKey));

		if (!app) {
			while (true) {
				let path = prompt(this.prompt);

				if (path === null) {
					return;
				}

				app = this.getFile(path);

				if (app) {
					setPrefValue(this.prefKey, path);

					break;
				}
			}
		}

		try {
			new Process(app).run(false, [ctx.href], 1);
		} catch (err) {
			alert(err);
			setPrefValue(this.prefKey, '');
		}
	},
	getFile : function getFile(path) {
		try {
			let file = getLocalFile(path);

			return file.exists() && file.isFile() && file;
		} catch (err) {}
	}
};

function commentToText(commentFunc) {
	return commentFunc.toString().replace(/^.*?\r?\n/, '').replace(/\r?\n.*?$/, '');
}

function getTextContent(node) {
	return node ? node.textContent : '';
}

function getLocalStorage(origin) {
	return DOMStorageManager.createStorage(
		null, ScriptSecurityManager.getNoAppCodebasePrincipal(IOService.newURI(origin, '', null)), ''
	);
}

function downloadWithReferrer(url, referrer) {
	return request(url, {referrer: referrer}).addCallback(function(){
		return download(url, getTempDir());
	});
}

// support pixiv unofficial API's format
function getCSVList(csv) {
	var frags, results, start, end, doublequote, comma;

	frags = csv.split('');
	results = [];
	start = end = doublequote = 0;
	comma = true;

	for (let i = 0, len = frags.length; i < len; i += 1) {
		let frag = frags[i];

		if (frag === '"') {
			if (start + 1 !== i) {
				if (comma) {
					comma = false;
					start = i;
					results.push(frag);
				} else {
					if (end + 1 === i && doublequote !== end - 1) {
						doublequote = i - 1;
					}

					end = i;
					results[results.length - 1] += frag;
				}
			} else {
				doublequote = i;
				results[results.length - 1] += frag;
			}
		} else if (frag === ',') {
			if (start < end && doublequote + 1 !== end) {
				if (comma) {
					results.push('');
				} else {
					comma = true;
				}
			} else {
				results[results.length - 1] += frag;
			}
		} else {
			results[results.length - 1] += frag;
		}
	}

	return results;
}

function getDOMWindowUtils() {
	return getMostRecentWindow().content
		.QueryInterface(Ci.nsIInterfaceRequestor)
		.getInterface(Ci.nsIDOMWindowUtils);
}

function getNodesFromPosition(screenX, screenY) {
	var win = getMostRecentWindow().content,
		domWindowUtils = getDOMWindowUtils(),
		zoom = domWindowUtils.screenPixelsPerCSSPixel,
		xPos = (screenX / zoom) - win.mozInnerScreenX,
		yPos = (screenY / zoom) - win.mozInnerScreenY;

	return domWindowUtils.nodesFromRect(xPos, yPos, 0, 0, 0, 0, false, false);
}
