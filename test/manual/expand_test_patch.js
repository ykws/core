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

  {
    let obj = {};

    assert(Object.expand(obj, {test : 0}), obj);
    assert('test' in obj);
    assert(obj.hasOwnProperty('test'));
    assert(Object.keys(obj).indexOf('test'), -1);
    assert(Object.getOwnPropertyNames(obj).indexOf('test') !== -1);
    assert(obj.test, 0);

    obj.test = true;

    assert(obj.test);

    obj = {record : 1};

    assert(Object.expand(obj, {get test() {return this.record;}, set test(val) {this.record = val;}}), obj);
    assert('test' in obj);
    assert(obj.hasOwnProperty('test'));
    assert(Object.keys(obj).indexOf('test'), -1);
    assert(Object.getOwnPropertyNames(obj).indexOf('test') !== -1);
    assert(obj.test, 1);

    obj.test = false;

    assert(obj.test, false);

    assert(Object.expand(obj, {get test() {return 1;}, set test(val) {return 1;}}).test, 1);
    assert(Object.expand(obj, {get test() {return 2;}}).test, 2);
    assert(Object.expand(obj, {hoge : 3, set fuga(val) {return 4;}}).test, 2);
    assert(obj.hoge, 3);
    assert(obj.fuga, void 0);
    assert(Object.expand(obj, {fuga : 5}).fuga, 5);

    assert(Object.expand(obj, {get piyo() {return 6;}}).piyo, 6);

    obj.piyo = 7;

    assert(obj.piyo, 6);

    assert(Object.expand(obj, {get foo() {return 8;}, set foo(val) {}}).foo, 8);

    obj.foo = 9;

    assert(obj.foo, 8);

    obj = {get test() {}, set test(val) {}};

    assert(Object.expand(obj, {get test() {return 10;}}).test, 10);

    assert(Object.getOwnPropertyDescriptor(obj, 'test').set, void 0);

    assert(Object.expand(obj, {}), obj);
  }

  {
    assert(Array.isArray(Array.wrap()));
    assert(Array.wrap().length, 0);
    assert(Array.wrap(void 0).length, 0);
    assert(Array.isArray(Array.wrap(null)));
    assert(Array.wrap(null).length, 0);

    let arr = [];

    assert(Array.isArray(Array.wrap(arr)));
    assert(Array.wrap(arr).length, 0);
    assert(Array.wrap(arr), arr);
    assert(Array.wrap('"').length, 1);
    assert(Array.wrap('test').length, 1);
    assert(Array.wrap('test')[0], 'test');
    assert(Array.wrap('').length, 1);
    assert(Array.wrap('')[0], '');
    assert(Array.wrap(0).length, 1);
    assert(Array.wrap(false).length, 1);
    assert(Array.wrap(['"']).length, 1);
    assert(Array.wrap(['「', '」']).length, 2);
  }

  assert(Array.isArray(Array.hashtags()));
  assert(Array.hashtags().length, 0);
  assert(Array.hashtags(void 0).length, 0);
  assert(Array.isArray(Array.hashtags(null)));
  assert(Array.hashtags(null).length, 0);
  assert(Array.isArray(Array.hashtags(0)));
  assert(Array.hashtags(0).length, 0);
  assert(Array.isArray(Array.hashtags(false)));
  assert(Array.hashtags(false).length, 0);
  assert(Array.isArray(Array.hashtags('')));
  assert(Array.hashtags('').length, 0);
  assert(Array.isArray(Array.hashtags(new String(''))));
  assert(Array.hashtags(new String('')).length, 0);
  assert(Array.isArray(Array.hashtags({})));
  assert(Array.hashtags({}).length, 0);
  assert(Array.isArray(Array.hashtags('hoge')));
  assert(Array.hashtags('hoge').length, 0);
  assert(Array.isArray(Array.hashtags([])));
  assert(Array.hashtags([]).length, 0);
  assert(Array.isArray(Array.hashtags([void 0])));
  assert(Array.hashtags([void 0]).length, 0);
  assert(Array.isArray(Array.hashtags([null])));
  assert(Array.hashtags([null]).length, 0);
  assert(Array.isArray(Array.hashtags([''])));
  assert(Array.hashtags(['']).length, 0);
  assert(Array.isArray(Array.hashtags([0])));
  assert(Array.hashtags([0]).length, 0);
  assert(Array.isArray(Array.hashtags([false])));
  assert(Array.hashtags([false]).length, 0);
  assert(Array.isArray(Array.hashtags([{}])));
  assert(Array.hashtags([{}]).length, 0);
  assert(Array.isArray(Array.hashtags([[]])));
  assert(Array.hashtags([[]]).length, 0);
  assert(Array.isArray(Array.hashtags(['hoge'])));
  assert(Array.hashtags(['hoge']).length, 1);
  assert(Array.hashtags(['hoge'])[0], '#hoge');
  assert(Array.hashtags([new String('hoge')]).length, 1);
  assert(Array.hashtags([new String('hoge')])[0], '#hoge');
  assert(Array.hashtags(['hoge', 'fuga']).length, 2);
  assert(Array.hashtags(['hoge', 'fuga'])[0], '#hoge');
  assert(Array.hashtags(['hoge', 'fuga'])[1], '#fuga');
  assert(Array.hashtags(['hoge', '']).length, 1);
  assert(Array.hashtags(['hoge', ''])[0], '#hoge');
  assert(Array.hashtags(['hoge', '#fuga']).length, 2);
  assert(Array.hashtags(['hoge', '#fuga'])[0], '#hoge');
  assert(Array.hashtags(['hoge', '#fuga'])[1], '#fuga');

  assert(Array.isArray([].merge()));
  assert([].merge().length, 0);
  assert(Array.isArray([].merge(void 0)));
  assert([].merge(void 0).length, 0);
  assert(Array.isArray([].merge(null)));
  assert([].merge(null).length, 0);
  assert(Array.isArray([].merge([])));
  assert([].merge([]).length, 0);
  assert(Array.isArray([].merge(0)));
  assert([].merge(0).length, 1);
  assert([].merge(0)[0], 0);
  assert(Array.isArray([].merge(false)));
  assert([].merge(false).length, 1);
  assert([].merge(false)[0], false);
  assert(Array.isArray([].merge('')));
  assert([].merge('').length, 1);
  assert([].merge('')[0], '');
  assert(Array.isArray([].merge('hoge')));
  assert([].merge('hoge').length, 1);
  assert([].merge('hoge')[0], 'hoge');
  assert(Array.isArray([void 0].merge()));
  assert([void 0].merge().length, 1);
  assert([void 0].merge()[0], void 0);
  assert(Array.isArray(['fuga'].merge()));
  assert(['fuga'].merge().length, 1);
  assert(['fuga'].merge()[0], 'fuga');
  assert(Array.isArray(['fuga'].merge(void 0)));
  assert(['fuga'].merge(void 0).length, 1);
  assert(['fuga'].merge(void 0)[0], 'fuga');
  assert(Array.isArray(['fuga'].merge(null)));
  assert(['fuga'].merge(null).length, 1);
  assert(['fuga'].merge(null)[0], 'fuga');
  assert(Array.isArray(['fuga'].merge('hoge')));
  assert(['fuga'].merge('hoge').length, 2);
  assert(['fuga'].merge('hoge')[0], 'hoge');
  assert(['fuga'].merge('hoge')[1], 'fuga');
  assert(Array.isArray(['fuga'].merge(['hoge'])));
  assert(['fuga'].merge(['hoge']).length, 2);
  assert(['fuga'].merge(['hoge'])[0], 'hoge');
  assert(['fuga'].merge(['hoge'])[1], 'fuga');
  assert(Array.isArray(['fuga', 'piyo'].merge(['hoge'])));
  assert(['fuga', 'piyo'].merge(['hoge']).length, 3);
  assert(['fuga', 'piyo'].merge(['hoge'])[0], 'hoge');
  assert(['fuga', 'piyo'].merge(['hoge'])[1], 'fuga');
  assert(['fuga', 'piyo'].merge(['hoge'])[2], 'piyo');
  assert(Array.isArray(['fuga'].merge(['hoge', 'piyo'])));
  assert(['fuga'].merge(['hoge', 'piyo']).length, 3);
  assert(['fuga'].merge(['hoge', 'piyo'])[0], 'hoge');
  assert(['fuga'].merge(['hoge', 'piyo'])[1], 'piyo');
  assert(['fuga'].merge(['hoge', 'piyo'])[2], 'fuga');
  assert(Array.isArray(['fuga', 'piyo'].merge(['hoge', 'foo'])));
  assert(['fuga', 'piyo'].merge(['hoge', 'foo']).length, 4);
  assert(['fuga', 'piyo'].merge(['hoge', 'foo'])[0], 'hoge');
  assert(['fuga', 'piyo'].merge(['hoge', 'foo'])[1], 'foo');
  assert(['fuga', 'piyo'].merge(['hoge', 'foo'])[2], 'fuga');
  assert(['fuga', 'piyo'].merge(['hoge', 'foo'])[3], 'piyo');
  assert(Array.isArray(['fuga'].merge('hoge', void 0)));
  assert(['fuga'].merge('hoge', void 0).length, 2);
  assert(['fuga'].merge('hoge', void 0)[0], 'hoge');
  assert(['fuga'].merge('hoge', void 0)[1], 'fuga');
  assert(Array.isArray(['fuga'].merge('hoge', null)));
  assert(['fuga'].merge('hoge', null).length, 2);
  assert(['fuga'].merge('hoge', null)[0], 'hoge');
  assert(['fuga'].merge('hoge', null)[1], 'fuga');
  assert(Array.isArray(['fuga'].merge('hoge', {})));
  assert(['fuga'].merge('hoge', {}).length, 2);
  assert(['fuga'].merge('hoge', {})[0], 'hoge');
  assert(['fuga'].merge('hoge', {})[1], 'fuga');
  assert(Array.isArray(['fuga'].merge('hoge', {indexFunc : void 0})));
  assert(['fuga'].merge('hoge', {indexFunc : void 0}).length, 2);
  assert(['fuga'].merge('hoge', {indexFunc : void 0})[0], 'hoge');
  assert(['fuga'].merge('hoge', {indexFunc : void 0})[1], 'fuga');
  assert(Array.isArray(['fuga'].merge('hoge', {indexFunc : null})));
  assert(['fuga'].merge('hoge', {indexFunc : null}).length, 2);
  assert(['fuga'].merge('hoge', {indexFunc : null})[0], 'hoge');
  assert(['fuga'].merge('hoge', {indexFunc : null})[1], 'fuga');
  assert(Array.isArray([{name : 'fuga'}].merge(void 0, {indexFunc : obj => obj.name === 'fuga'})));
  assert([{name : 'fuga'}].merge(void 0, {indexFunc : obj => obj.name === 'fuga'}).length, 1);
  assert([{name : 'fuga'}].merge(void 0, {indexFunc : obj => obj.name === 'fuga'})[0].name, 'fuga');
  assert(Array.isArray([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga'})));
  assert([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga'}).length, 2);
  assert([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga'})[0].name, 'hoge');
  assert([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga'})[1].name, 'fuga');
  assert(Array.isArray([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'piyo'})));
  assert([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'piyo'}).length, 2);
  assert([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'piyo'})[0].name, 'fuga');
  assert([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'piyo'})[1].name, 'hoge');
  assert(Array.isArray([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga'})));
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga'}).length, 3);
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga'})[0].name, 'hoge');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga'})[1].name, 'fuga');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga'})[2].name, 'piyo');
  assert(Array.isArray([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'piyo'})));
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'piyo'}).length, 3);
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'piyo'})[0].name, 'fuga');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'piyo'})[1].name, 'hoge');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'piyo'})[2].name, 'piyo');
  assert(Array.isArray([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'foo'})));
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'foo'}).length, 3);
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'foo'})[0].name, 'fuga');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'foo'})[1].name, 'piyo');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'foo'})[2].name, 'hoge');
  assert(Array.isArray([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo'})));
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo'}).length, 4);
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo'})[0].name, 'fuga');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo'})[1].name, 'hoge');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo'})[2].name, 'foo');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo'})[3].name, 'piyo');
  assert(Array.isArray(['fuga'].merge('hoge', {after : void 0})));
  assert(['fuga'].merge('hoge', {after : void 0}).length, 2);
  assert(['fuga'].merge('hoge', {after : void 0})[0], 'hoge');
  assert(['fuga'].merge('hoge', {after : void 0})[1], 'fuga');
  assert(Array.isArray(['fuga'].merge('hoge', {after : false})));
  assert(['fuga'].merge('hoge', {after : false}).length, 2);
  assert(['fuga'].merge('hoge', {after : false})[0], 'hoge');
  assert(['fuga'].merge('hoge', {after : false})[1], 'fuga');
  assert(Array.isArray(['fuga'].merge(void 0, {after : true})));
  assert(['fuga'].merge(void 0, {after : true}).length, 1);
  assert(['fuga'].merge(void 0, {after : true})[0], 'fuga');
  assert(Array.isArray(['fuga'].merge('hoge', {after : true})));
  assert(['fuga'].merge('hoge', {after : true}).length, 2);
  assert(['fuga'].merge('hoge', {after : true})[0], 'fuga');
  assert(['fuga'].merge('hoge', {after : true})[1], 'hoge');
  assert(Array.isArray([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga', after : true})));
  assert([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga', after : true}).length, 2);
  assert([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga', after : true})[0].name, 'fuga');
  assert([{name : 'fuga'}].merge({name : 'hoge'}, {indexFunc : obj => obj.name === 'fuga', after : true})[1].name, 'hoge');
  assert(Array.isArray([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : false})));
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : false}).length, 4);
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : false})[0].name, 'fuga');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : false})[1].name, 'hoge');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : false})[2].name, 'foo');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : false})[3].name, 'piyo');
  assert(Array.isArray([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'fuga', after : true})));
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'fuga', after : true}).length, 4);
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'fuga', after : true})[0].name, 'fuga');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'fuga', after : true})[1].name, 'hoge');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'fuga', after : true})[2].name, 'foo');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'fuga', after : true})[3].name, 'piyo');
  assert(Array.isArray([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : true})));
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : true}).length, 4);
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : true})[0].name, 'fuga');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : true})[1].name, 'piyo');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : true})[2].name, 'hoge');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'piyo', after : true})[3].name, 'foo');
  assert(Array.isArray([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : true})));
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : true}).length, 4);
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : true})[0].name, 'fuga');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : true})[1].name, 'piyo');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : true})[2].name, 'hoge');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : true})[3].name, 'foo');
  assert(Array.isArray([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : false})));
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : false}).length, 4);
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : false})[0].name, 'fuga');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : false})[1].name, 'piyo');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : false})[2].name, 'hoge');
  assert([{name : 'fuga'}, {name : 'piyo'}].merge([{name : 'hoge'}, {name : 'foo'}], {indexFunc : obj => obj.name === 'bar', after : false})[3].name, 'foo');

  assert(JSON.parseable(void 0), false);
  assert(JSON.parseable(''), false);
  assert(JSON.parseable(NaN), false);
  assert(JSON.parseable([]), false);
  assert(JSON.parseable({}), false);
  assert(JSON.parseable(Infinity), false);
  assert(JSON.parseable('hoge'), false);
  assert(JSON.parseable('\'hoge\''), false);
  assert(JSON.parseable('{hoge : 0}'), false);
  assert(JSON.parseable('{\'hoge\' : 0}'), false);
  assert(JSON.parseable('{"hoge" : \'fuga\'}'), false);
  assert(JSON.parseable(null));
  assert(JSON.parseable(0));
  assert(JSON.parseable(false));
  assert(JSON.parseable(1));
  assert(JSON.parseable(true));
  assert(JSON.parseable('[]'));
  assert(JSON.parseable('{}'));
  assert(JSON.parseable('""'));
  assert(JSON.parseable('"hoge"'));
  assert(JSON.parseable('{"hoge" : 0}'));
  assert(JSON.parseable('{"hoge" : "fuga"}'));

  {
    assert(Object.type(), 'Undefined');
    assert(Object.type(void 0), 'Undefined');
    assert(Object.type(null), 'Null');
    assert(Object.type(false), 'Boolean');
    assert(Object.type(0), 'Number');
    assert(Object.type(''), 'String');
    assert(Object.type(new String('')), 'String');
    assert(Object.type([]), 'Array');
    assert(Object.type({}), 'Object');
    assert(Object.type(/(?:)/), 'RegExp');
    assert(Object.type(function () {}), 'Function');
    assert(Object.type(new Date()), 'Date');
    assert(Object.type(new Error()), 'Error');
    assert(Object.type(true), 'Boolean');
    assert(Object.type(NaN), 'Number');
    assert(Object.type(Infinity), 'Number');
    assert(Object.type(undefined), 'Undefined');
    assert(Object.type(Object.create(null)), 'Object');
    assert(Object.type('hoge'), 'String');
    assert(Object.type(new String('hoge')), 'String');

    let str = new String('test');

    Object.setPrototypeOf(str, null);

    assert(Object.type(str), 'String');
  }

  assert(Array.isArray(Object.values()));
  assert(Object.values().length, 0);
  assert(Object.values(void 0).length, 0);
  assert(Array.isArray(Object.values(null)));
  assert(Object.values(null).length, 0);
  assert(Object.values({}).length, 0);
  assert(Array.isArray(Object.values({hoge : '0'})));
  assert(Object.values({hoge : '0'}).length, 1);
  assert(Object.values({hoge : '0'})[0], '0');
  assert(Object.values({hoge : '0', fuga : '1'}).length, 2);
  assert(Object.values({hoge : '0', fuga : '1', piyo : '2'}).length, 3);
  assert(Object.values({hoge : '0', fuga : '1', piyo : '2'}).reduce((curr, prev) => curr + prev), '012');
  assert(Object.values('hoge').join(''), 'hoge');

  assert(Array.isArray(Object.entries()));
  assert(Object.entries().length, 0);
  assert(Object.entries(void 0).length, 0);
  assert(Array.isArray(Object.entries(null)));
  assert(Object.entries(null).length, 0);
  assert(Object.entries({}).length, 0);
  assert(Array.isArray(Object.entries({hoge : 0})));
  assert(Object.entries({hoge : 0}).length, 1);
  assert(Array.isArray(Object.entries({hoge : 0})[0]));
  assert(Object.entries({hoge : 0})[0].length, 2);
  assert(Object.entries({hoge : 0})[0][0], 'hoge');
  assert(Object.entries({hoge : 0})[0][1], 0);
  assert(Object.entries({hoge : 0, fuga : 1}).length, 2);
  assert(Object.entries({hoge : 0, fuga : 1, piyo : 2}).length, 3);
  assert(Object.entries({hoge : 0, fuga : 1, piyo : 2}).map(([, val]) => val).reduce((curr, prev) => curr + prev), 3);
  assert(Object.entries('hoge').map(([, val]) => val).join(''), 'hoge');

  {
    assert(String.usable(), false);
    assert(String.usable(void 0), false);
    assert(String.usable(null), false);
    assert(String.usable(false), false);
    assert(String.usable(0), false);
    assert(String.usable([]), false);
    assert(String.usable({}), false);
    assert(String.usable(/(?:)/), false);
    assert(String.usable(Object.create(null)), false);
    assert(String.usable(''), false);
    assert(String.usable(new String('')), false);
    assert(String.usable('hoge'));
    assert(String.usable(new String('hoge')));

    let str = new String('test');

    Object.setPrototypeOf(str, null);

    assert(String.usable(str), false);
  }

  assert('a'.indent(2), '  a');
  assert('a'.indent(2, '	'), '		a');
  assert('a\na'.indent(2), '  a\n  a');
  assert('a'.indent(0), 'a');

  assert('a'.wrap(), 'a');
  assert('a'.wrap(void 0), 'a');
  assert('a'.wrap(null), 'a');
  assert('a'.wrap(''), 'a');
  assert('a'.wrap('"'), '"a"');
  assert('a'.wrap('\''), '\'a\'');
  assert('a'.wrap('t'), 'tat');
  assert('a'.wrap('t', void 0), 'tat');
  assert('a'.wrap('t', null), 'tat');
  assert('a'.wrap('t', 's'), 'tas');
  assert('a'.wrap('t', ''), 'ta');
  assert('a'.wrap('', 's'), 'as');
  assert('test'.wrap('[', ']'), '[test]');
  assert('test'.wrap('「', '」'), '「test」');
  assert('e'.wrap(0), '0e0');
  assert('e'.wrap(9), '9e9');
  assert('e'.wrap(0, 0), '0e0');
  assert('e'.wrap(0, 1), '0e1');
  assert('e'.wrap(1, 0), '1e0');
  assert('true'.wrap(false), 'falsetruefalse');

  assert('test'.extract(/^(t)e(st)$/), 't');
  assert('test'.extract(/^(t)e(st)$/, 2), 'st');
  assert('test'.capitalize(), 'Test');
  assert('テスト'.convertToUnicode(), 'ƹ');
  assert('テスト'.convertToUnicode('Shift_JIS'), 'ﾆｹﾈ');
  assert('テスト'.convertToUnicode('EUC-JP'), '胴');
  assert('テスト'.convertToUnicode('iso-2022-jp'), '���');
  assert('テスト'.convertFromUnicode(), 'ãã¹ã');
  assert('テスト'.convertFromUnicode('Shift_JIS'), 'eXg');
  assert('テスト'.convertFromUnicode('EUC-JP'), '¥Æ¥¹¥È');
  assert('テスト'.convertFromUnicode('iso-2022-jp'), '$B%F%9%H');

  assert(''.md5(), 'd41d8cd98f00b204e9800998ecf8427e');
  assert(''.md5(true), '1B2M2Y8AsgTpgAmY7PhCfg==');
  assert('a'.md5(), '0cc175b9c0f1b6a831c399e269772661');
  assert('a'.md5(void 0), '0cc175b9c0f1b6a831c399e269772661');
  assert('a'.md5(null), '0cc175b9c0f1b6a831c399e269772661');
  assert('a'.md5(false), '0cc175b9c0f1b6a831c399e269772661');
  assert('a'.md5(false, 'UTF-8'), '0cc175b9c0f1b6a831c399e269772661');
  assert('a'.md5(true), 'DMF1ucDxtqgxw5niaXcmYQ==');
  assert('a'.md5(true, 'UTF-8'), 'DMF1ucDxtqgxw5niaXcmYQ==');
  assert('テスト'.md5(), 'b0f1c5a480f416234a803b35d9932c57');
  assert('テスト'.md5(false, 'utf8'), 'b0f1c5a480f416234a803b35d9932c57');
  assert('テスト'.md5(false, 'Shift_JIS'), '3f0326f4e56c3f4b54feede9071cafbf');

  assert('%3A%40%2F%23%3F%3D%2B%26%3B%2C%24%22%E3%83%86%E3%82%B9%E3%83%88'.unEscapeURI(), ':@/#?=+&;,$"テスト');
  assert('%3A%40%2F%23%3F%3D%2B%26%3B%2C%24%22%E3%83%86%E3%82%B9%E3%83%88'.unEscapeURI(), decodeURIComponent('%3A%40%2F%23%3F%3D%2B%26%3B%2C%24%22%E3%83%86%E3%82%B9%E3%83%88'));
  assert('abcdefghijklmnopqrstuvwxyz0123456789-_.!~*\'()'.unEscapeURI(), 'abcdefghijklmnopqrstuvwxyz0123456789-_.!~*\'()');
  assert('%A5%C6%A5%B9%A5%C8'.unEscapeURI(), '%A5%C6%A5%B9%A5%C8');
  assert('%A5%C6%A5%B9%A5%C8'.unEscapeURI('EUC-JP'), 'テスト');
  assert('a<!--test-->a'.trimTag(), 'aa');
  assert('<div>a</div>'.trimTag(), 'a');
  assert('<div>a<p>a</div>'.trimTag(), 'aa');
  assert('<!--test--><div>a</div>'.trimTag(), 'a');
  assert('<!--test-->\n<div>a</div>'.trimTag(), '\na');
  assert('123abc'.charLength, 6);
  assert('吉野家'.charLength, 3);
  assert('𠮷野家'.charLength, 3);

  console.log([
    `${createURI(Components.stack.filename).fileName}'s ${assert.count} tests:`,
    `  * pass: ${assert.passed}`,
    `  * fail: ${assert.failed}`
  ].join('\n'));
}
