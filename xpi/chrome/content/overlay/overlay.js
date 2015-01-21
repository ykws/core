(function(){
	// createInstanceで呼び出し初期化を促す
	// 他の場所ではgetServiceを用いてよい
	var env = Cc['@tombfix.github.io/tombfix-service;1'].createInstance().wrappedJSObject;
	
	window.addEventListener('load', function(e){
		// Element Hiding Helper for Adblock Plusとの衝突を避ける
		// (詳細不明/ロード時の処理を遅延し起動表示を高速化する)
		setTimeout(function(){
			env.signal(env, 'browser-load', e);
		}, 0);
	}, false);
})();
