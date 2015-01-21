/* global Components */

(function executeOverlay(win) {
  'use strict';

  // createInstanceで呼び出し初期化を促す
  // 他の場所ではgetServiceを用いてよい
  let env = Components.classes[
    '@tombfix.github.io/tombfix-service;1'
  ].createInstance().wrappedJSObject;

  win.addEventListener('load', evt => {
    env.signal(env, 'browser-load', evt);
  });
}(window));
