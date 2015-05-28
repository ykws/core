// ==UserScript==
// @name           GM_Tombfix and GM_Tombloo test
// @namespace      tombfix.github.io
// @include        http://*
// @include        https://*
// ==/UserScript==

function assert(...args) {
  if (assert.count == null) {
    assert.count = assert.passed = assert.failed = 0;
  }

  assert.count += 1;

  let [target, val] = args.concat(true);

  if (target === val) {
    assert.passed += 1;
  } else {
    assert.failed += 1;

    console.log(target, val);
    console.trace();
  }
}

assert(typeof GM_Tombfix, 'object');
assert(typeof GM_Tombloo, 'object');
assert(typeof GM_Tombfix.Tombfix, 'object');
assert(typeof GM_Tombloo.Tombloo, 'object');
assert(typeof GM_Tombfix.Tombfix.Service, 'object');
assert(typeof GM_Tombloo.Tombloo.Service, 'object');
// assert(typeof GM_Tombfix.Tombfix.Service.check, 'function');
// assert(typeof GM_Tombloo.Tombloo.Service.check, 'function');
// assert(typeof GM_Tombfix.Tombfix.Service.share, 'function');
// assert(typeof GM_Tombloo.Tombloo.Service.share, 'function');
assert(typeof GM_Tombfix.Tombfix.Service.extractors, 'object');
assert(typeof GM_Tombloo.Tombloo.Service.extractors, 'object');
assert(typeof GM_Tombfix.Tumblr, 'object');
assert(typeof GM_Tombloo.Tumblr, 'object');
assert(GM_Tombfix.Tumblr.name, 'Tumblr');
assert(GM_Tombloo.Tumblr.name, 'Tumblr');
assert(GM_Tombfix.Tumblr.getPasswords, void 0);
assert(GM_Tombloo.Tumblr.getPasswords, void 0);
assert(GM_Tombfix.Tumblr.getAuthCookie, void 0);
assert(GM_Tombloo.Tumblr.getAuthCookie, void 0);
// assert(typeof GM_Tombfix.Deferred, 'function');
// assert(typeof GM_Tombloo.Deferred, 'function');
// assert(typeof GM_Tombfix.DeferredHash, 'function');
// assert(typeof GM_Tombloo.DeferredHash, 'function');
// assert(typeof GM_Tombfix.copyString, 'function');
// assert(typeof GM_Tombloo.copyString, 'function');
// assert(typeof GM_Tombfix.notify, 'function');
// assert(typeof GM_Tombloo.notify, 'function');

console.log([
  `${assert.count} tests:`,
  `  * pass: ${assert.passed}`,
  `  * fail: ${assert.failed}`
].join('\n'));
