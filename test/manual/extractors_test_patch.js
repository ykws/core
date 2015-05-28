{
  let assert = function assert(...args) {
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
  };

  assert(Object.type(Extractors), 'Object');
  assert(Object.type(Tombfix.Service.extractors), 'Object');
  assert(Extractors, Tombfix.Service.extractors);
  assert(Extractors instanceof Repository);
  assert(Object.getPrototypeOf(Extractors) !== Repository.prototype);
  assert(Object.keys(Extractors).length, Extractors.values.length);


  assert(Array.isArray(Extractors.REDIRECTORS));
  assert(typeof Extractors.normalizeURL, 'function');
  assert(typeof Extractors.extract, 'function');


  console.log([
    `${createURI(Components.stack.filename).fileName}'s ${assert.count} tests:`,
    `  * pass: ${assert.passed}`,
    `  * fail: ${assert.failed}`
  ].join('\n'));
}
