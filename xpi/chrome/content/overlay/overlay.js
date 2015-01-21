/* global Components */

(function executeOverlay(win) {
  'use strict';

  // createInstanceで呼び出し初期化を促す
  // 他の場所ではgetServiceを用いてよい
  let env = Components.classes[
    '@tombfix.github.io/tombfix-service;1'
  ].createInstance().wrappedJSObject;

  win.addEventListener('load', evt => {
    // Element Hiding Helper for Adblock Plusとの衝突を避ける
    // (詳細不明/ロード時の処理を遅延し起動表示を高速化する)
    setTimeout(() => {
      env.signal(env, 'browser-load', evt);
    }, 0);
  });
}(window));
