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

  let isObject = function isObject(target) {
    return typeof target === 'object' && target !== null;
  };

  assert(isObject(Tombfix));
  assert(isObject(Tombloo));
  assert(Tombfix, Tombloo);
  assert(isObject(Tombfix.Service));
  assert(isObject(Tombloo.Service));
  assert(Tombfix.Service, Tombloo.Service);
  assert(isObject(Extractors));
  assert(isObject(Extractors.ReBlog));
  assert(isObject(Tombfix.Service.extractors));
  assert(isObject(Tombloo.Service.extractors));
  assert(Extractors, Tombloo.Service.extractors);
  assert(Extractors instanceof Repository);
  assert(isObject(Actions));
  assert(isObject(Actions['----']));
  assert(isObject(Tombfix.Service.actions));
  assert(isObject(Tombloo.Service.actions));
  assert(Actions, Tombloo.Service.actions);
  assert(Actions instanceof Repository);
  assert(isObject(Models));
  assert(isObject(Models.Tumblr));
  assert(isObject(models));
  assert(Models, models);
  assert(Models instanceof Repository);
  assert(isObject(Tumblr));

  Tombloo.Service.extractors.register({
    name: 'Tombloo Path Test',
    ICON: 'chrome://tombloo/skin/photo.png',
    check(ctx) {
      return true;
    },
    extract(ctx) {
      addTab('chrome://tombloo/content/overlay/overlay.xul');

      return {};
    }
  });

  console.log([
    `${createURI(Components.stack.filename).fileName}'s ${assert.count} tests:`,
    `  * pass: ${assert.passed}`,
    `  * fail: ${assert.failed}`
  ].join('\n'));
}
