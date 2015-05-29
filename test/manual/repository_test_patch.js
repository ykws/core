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

  assert(typeof Repository, 'function');
  assert(Object.getOwnPropertyNames(new Repository()).length, 0);
  assert(Object.getOwnPropertyNames(new Repository([])).length, 0);
  assert(Object.getOwnPropertyNames(new Repository({})).length, 0);
  assert(Object.getOwnPropertyNames(new Repository(function () {})).length, 0);

  assert(Array.isArray((new Repository()).values));
  assert((new Repository()).values.length, 0);

  assert(Array.isArray((new Repository()).check()));
  assert((new Repository()).check().length, 0);
  assert(Array.isArray((new Repository()).check({})));
  assert((new Repository()).check({}).length, 0);

  assert((new Repository()).unregister(), void 0);

  assert((new Repository()).register(), void 0);
  assert((new Repository()).register({}), void 0);
  assert((new Repository()).register({name : 'Hoge'}), void 0);
  assert((new Repository()).register({name : 'Hoge'}, 'Fuga'), void 0);
  assert((new Repository()).register({name : 'Hoge'}, 'Fuga', true), void 0);

  let Test = new Repository();

  Test.register({name : 'Hoge'});

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test.register({name : 'Fuga', check : () => true});

  assert(Object.keys(Test).length, 2);
  assert(Test.values.length, 2);
  assert(Test.values[0].name, 'Hoge');
  assert(Test.Fuga.name, 'Fuga');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test.register({name : 'Piyo', check : () => false}, 'Hoge');

  assert(Object.keys(Test).length, 3);
  assert(Test.values.length, 3);
  assert(Test.values[0].name, 'Piyo');
  assert(Test.values[1].name, 'Hoge');
  assert(Test.values[2].name, 'Fuga');
  assert(Test.Piyo.name, 'Piyo');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test.register({name : 'Foo', check : arg => Boolean(arg)}, 'Piyo', true);

  assert(Object.keys(Test).length, 4);
  assert(Test.values.length, 4);
  assert(Test.values[0].name, 'Piyo');
  assert(Test.values[1].name, 'Foo');
  assert(Test.values[2].name, 'Hoge');
  assert(Test.values[3].name, 'Fuga');
  assert(Test.Foo.name, 'Foo');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 2);

  Test.register([{
    name : 'Bar'
  }, {
    name  : 'Baz',
    check : (num1, num2, num3) => num1 === 1 && num2 === 2 && num3 === 3
  }]);

  assert(Object.keys(Test).length, 6);
  assert(Test.values.length, 6);
  assert(Test.values[0].name, 'Piyo');
  assert(Test.values[1].name, 'Foo');
  assert(Test.values[2].name, 'Hoge');
  assert(Test.values[3].name, 'Fuga');
  assert(Test.values[4].name, 'Bar');
  assert(Test.values[5].name, 'Baz');
  assert(Test.Bar.name, 'Bar');
  assert(Test.Baz.name, 'Baz');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 2);
  assert(Test.check(1, 2, 3).length, 3);

  Test.register([{
    name : 'Qux'
  }, {
    name : 'Quux'
  }, {
    name : 'Corge',
    check() {
      return this.name === 'Corge';
    }
  }], 'Piyo');

  assert(Object.keys(Test).length, 9);
  assert(Test.values.length, 9);
  assert(Test.values[0].name, 'Qux');
  assert(Test.values[1].name, 'Quux');
  assert(Test.values[2].name, 'Corge');
  assert(Test.values[3].name, 'Piyo');
  assert(Test.values[4].name, 'Foo');
  assert(Test.values[5].name, 'Hoge');
  assert(Test.values[6].name, 'Fuga');
  assert(Test.values[7].name, 'Bar');
  assert(Test.values[8].name, 'Baz');
  assert(Test.Qux.name, 'Qux');
  assert(Test.Quux.name, 'Quux');
  assert(Test.Corge.name, 'Corge');
  assert(Test.check().length, 2);
  assert(Test.check({}).length, 3);
  assert(Test.check(1, 2, 3).length, 4);

  Test = new Repository();

  Test.register({name : 'Hoge'}, 'Baz');

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test.register({name : 'Fuga', check : () => true}, 'Baz');

  assert(Object.keys(Test).length, 2);
  assert(Test.values.length, 2);
  assert(Test.values[0].name, 'Hoge');
  assert(Test.Fuga.name, 'Fuga');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test.register({name : 'Piyo', check : () => false}, 'Baz', true);

  assert(Object.keys(Test).length, 3);
  assert(Test.values.length, 3);
  assert(Test.values[0].name, 'Hoge');
  assert(Test.values[1].name, 'Fuga');
  assert(Test.values[2].name, 'Piyo');
  assert(Test.Piyo.name, 'Piyo');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test = new Repository({name : 'Hoge'});

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test = new Repository([{
    name : 'Hoge'
  }, {
    name  : 'Fuga',
    check : () => true
  }]);

  assert(Object.keys(Test).length, 2);
  assert(Test.values.length, 2);
  assert(Test.values[0].name, 'Hoge');
  assert(Test.Fuga.name, 'Fuga');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test = new Repository({name : 'Hoge'}, 'Baz');

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test = new Repository([{
    name : 'Hoge'
  }, {
    name  : 'Fuga',
    check : () => true
  }], 'Baz');

  assert(Object.keys(Test).length, 2);
  assert(Test.values.length, 2);
  assert(Test.values[0].name, 'Hoge');
  assert(Test.Fuga.name, 'Fuga');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test = new Repository({name : 'Hoge'}, 'Baz', true);

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test = new Repository([{
    name : 'Hoge'
  }, {
    name  : 'Fuga',
    check : () => true
  }], 'Baz', true);

  assert(Object.keys(Test).length, 2);
  assert(Test.values.length, 2);
  assert(Test.values[0].name, 'Hoge');
  assert(Test.Fuga.name, 'Fuga');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test = new Repository([{
    name : 'Hoge'
  }, {
    name  : 'Fuga',
    check : () => true
  }], 'Hoge');

  assert(Object.keys(Test).length, 2);
  assert(Test.values.length, 2);
  assert(Test.values[0].name, 'Hoge');
  assert(Test.Fuga.name, 'Fuga');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test = new Repository([{
    name : 'Hoge'
  }, {
    name  : 'Fuga',
    check : () => true
  }], 'Hoge', true);

  assert(Object.keys(Test).length, 2);
  assert(Test.values.length, 2);
  assert(Test.values[0].name, 'Hoge');
  assert(Test.Fuga.name, 'Fuga');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test = new Repository({name : 'Hoge'});

  Test.register({name : 'Hoge', check : () => true});

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test.register({name : 'Hoge', check : () => false}, 'Baz');

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test.register({name : 'Hoge', check : () => true}, 'Hoge');

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test.register({name : 'Hoge', check : () => true}, 'Hoge', true);

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test = new Repository();

  Test.Hoge = {name : 'Hoge'};

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test.func1 = function (...args) {
    return args;
  };

  assert(Object.keys(Test).length, 2);
  assert(Test.values.length, 1);
  assert(Test.func1.name, '');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Object.expand(Test, {
    func2(...args) {
      return args;
    }
  });

  assert(Object.keys(Test).length, 2);
  assert(Test.values.length, 1);
  assert(Test.func2.name, 'func2');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test.register({name : 'Fuga', check : () => true}, 'Baz');

  assert(Object.keys(Test).length, 3);
  assert(Test.values.length, 2);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.Fuga.name, 'Fuga');
  assert(Test.func1.name, '');
  assert(Test.func2.name, 'func2');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test = new Repository({name : 'Hoge'});

  Test.Hoge.name = 'Fuga';

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test.register({name : 'Piyo', check : () => true}, 'Baz');

  assert(Object.keys(Test).length, 3);
  assert(Test.values.length, 3);
  assert(Test.values[0].name, 'Fuga');
  assert(Test.values[1].name, 'Fuga');
  assert(Test.values[2].name, 'Piyo');
  assert(Test.Hoge.name, 'Fuga');
  assert(Test.Fuga.name, 'Fuga');
  assert(Test.Piyo.name, 'Piyo');
  assert(Test.check().length, 1);
  assert(Test.check({}).length, 1);

  Test = new Repository();

  Test.register({name : 'Hoge'});

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test.unregister();

  assert(Object.keys(Test).length, 0);
  assert(Test.values.length, 0);
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test = new Repository();

  Test.register({name : 'Hoge'});

  Test.func1 = function (...args) {
    return args;
  };

  assert(Object.keys(Test).length, 2);
  assert(Test.values.length, 1);
  assert(Test.Hoge.name, 'Hoge');
  assert(Test.func1.name, '');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  Test.unregister();

  assert(Object.keys(Test).length, 1);
  assert(Test.values.length, 0);
  assert(Test.func1.name, '');
  assert(Test.check().length, 0);
  assert(Test.check({}).length, 0);

  console.log([
    `${createURI(Components.stack.filename).fileName}'s ${assert.count} tests:`,
    `  * pass: ${assert.passed}`,
    `  * fail: ${assert.failed}`
  ].join('\n'));
}
