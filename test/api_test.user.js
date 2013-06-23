// ==UserScript==
// @name           GM_Tombfix and GM_Tombloo test
// @namespace      https://github.com/tombfix/core
// @include        http://*
// @include        https://*
// ==/UserScript==

console.log(typeof GM_Tombfix, typeof GM_Tombloo);
console.log(typeof GM_Tombfix.Tombfix, typeof GM_Tombloo.Tombloo);
console.log(typeof GM_Tombfix.Tombfix.Service, typeof GM_Tombloo.Tombloo.Service);
console.log(typeof GM_Tombfix.Tombfix.Service.extractors, typeof GM_Tombloo.Tombloo.Service.extractors);
console.log(typeof GM_Tombfix.Tumblr, typeof GM_Tombloo.Tumblr);
