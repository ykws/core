{
  let assert = function assert(bool) {
    if (bool) {
      console.log(bool);

      return;
    }

    console.trace();
  };

  {
    let obj = {};

    assert(Object.expand(obj, {test : 0}) === obj);
    assert('test' in obj);
    assert(obj.hasOwnProperty('test'));
    assert(Object.keys(obj).indexOf('test') === -1);
    assert(Object.getOwnPropertyNames(obj).indexOf('test') !== -1);
    assert(obj.test === 0);

    obj.test = true;

    assert(obj.test);

    obj = {record : 1};

    assert(Object.expand(obj, {get test() {return this.record;}, set test(val) {this.record = val;}}) === obj);
    assert('test' in obj);
    assert(obj.hasOwnProperty('test'));
    assert(Object.keys(obj).indexOf('test') === -1);
    assert(Object.getOwnPropertyNames(obj).indexOf('test') !== -1);
    assert(obj.test === 1);

    obj.test = false;

    assert(obj.test === false);

    assert(Object.expand(obj, {get test() {return 1;}, set test(val) {return 1;}}).test === 1);
    assert(Object.expand(obj, {get test() {return 2;}}).test === 2);
    assert(Object.expand(obj, {hoge : 3, set fuga(val) {return 4;}}).test === 2);
    assert(obj.hoge === 3);
    assert(obj.fuga === void 0);
    assert(Object.expand(obj, {fuga : 5}).fuga === 5);

    assert(Object.expand(obj, {get piyo() {return 6;}}).piyo === 6);

    obj.piyo = 7;

    assert(obj.piyo === 6);

    assert(Object.expand(obj, {get foo() {return 8;}, set foo(val) {}}).foo === 8);

    obj.foo = 9;

    assert(obj.foo === 8);

    obj = {get test() {}, set test(val) {}};

    assert(Object.expand(obj, {get test() {return 10;}}).test === 10);

    assert(Object.getOwnPropertyDescriptor(obj, 'test').set === void 0);

    assert(Object.expand(obj, {}) === obj);
  }

  {
    assert(Array.isArray(Array.wrap()));
    assert(Array.wrap().length === 0);
    assert(Array.wrap(void 0).length === 0);
    assert(Array.isArray(Array.wrap(null)));
    assert(Array.wrap(null).length === 0);

    let arr = [];

    assert(Array.isArray(Array.wrap(arr)));
    assert(Array.wrap(arr).length === 0);
    assert(Array.wrap(arr) === arr);
    assert(Array.wrap('"').length === 1);
    assert(Array.wrap('test').length === 1);
    assert(Array.wrap('test')[0] === 'test');
    assert(Array.wrap('').length === 1);
    assert(Array.wrap('')[0] === '');
    assert(Array.wrap(0).length === 1);
    assert(Array.wrap(false).length === 1);
    assert(Array.wrap(['"']).length === 1);
    assert(Array.wrap(['「', '」']).length === 2);
  }

  assert('a'.indent(2) === '  a');
  assert('a'.indent(2, '	') === '		a');
  assert('a\na'.indent(2) === '  a\n  a');
  assert('a'.indent(0) === 'a');

  assert('a'.wrap() === 'a');
  assert('a'.wrap(void 0) === 'a');
  assert('a'.wrap(null) === 'a');
  assert('a'.wrap('') === 'a');
  assert('a'.wrap('"') === '"a"');
  assert('a'.wrap('\'') === '\'a\'');
  assert('a'.wrap('t') === 'tat');
  assert('a'.wrap('t', void 0) === 'tat');
  assert('a'.wrap('t', null) === 'tat');
  assert('a'.wrap('t', 's') === 'tas');
  assert('a'.wrap('t', '') === 'ta');
  assert('a'.wrap('', 's') === 'as');
  assert('test'.wrap('[', ']') === '[test]');
  assert('test'.wrap('「', '」') === '「test」');
  assert('e'.wrap(0) === '0e0');
  assert('e'.wrap(9) === '9e9');
  assert('e'.wrap(0, 0) === '0e0');
  assert('e'.wrap(0, 1) === '0e1');
  assert('e'.wrap(1, 0) === '1e0');
  assert('true'.wrap(false) === 'falsetruefalse');

  assert('test'.extract(/^(t)e(st)$/) === 't');
  assert('test'.extract(/^(t)e(st)$/, 2) === 'st');
  assert('test'.capitalize() === 'Test');
  assert('テスト'.convertToUnicode() === 'ƹ');
  assert('テスト'.convertToUnicode('Shift_JIS') === 'ﾆｹﾈ');
  assert('テスト'.convertToUnicode('EUC-JP') === '胴');
  assert('テスト'.convertToUnicode('iso-2022-jp') === '���');
  assert('テスト'.convertFromUnicode() === 'ãã¹ã');
  assert('テスト'.convertFromUnicode('Shift_JIS') === 'eXg');
  assert('テスト'.convertFromUnicode('EUC-JP') === '¥Æ¥¹¥È');
  assert('テスト'.convertFromUnicode('iso-2022-jp') === '$B%F%9%H');
  assert('%3A%40%2F%23%3F%3D%2B%26%3B%2C%24%22%E3%83%86%E3%82%B9%E3%83%88'.unEscapeURI() === ':@/#?=+&;,$"テスト');
  assert('%3A%40%2F%23%3F%3D%2B%26%3B%2C%24%22%E3%83%86%E3%82%B9%E3%83%88'.unEscapeURI() === decodeURIComponent('%3A%40%2F%23%3F%3D%2B%26%3B%2C%24%22%E3%83%86%E3%82%B9%E3%83%88'));
  assert('abcdefghijklmnopqrstuvwxyz0123456789-_.!~*\'()'.unEscapeURI() === 'abcdefghijklmnopqrstuvwxyz0123456789-_.!~*\'()');
  assert('%A5%C6%A5%B9%A5%C8'.unEscapeURI() === '%A5%C6%A5%B9%A5%C8');
  assert('%A5%C6%A5%B9%A5%C8'.unEscapeURI('EUC-JP') === 'テスト');
  assert('a<!--test-->a'.trimTag() === 'aa');
  assert('<div>a</div>'.trimTag() === 'a');
  assert('<div>a<p>a</div>'.trimTag() === 'aa');
  assert('<!--test--><div>a</div>'.trimTag() === 'a');
  assert('<!--test-->\n<div>a</div>'.trimTag() === '\na');
  assert('123abc'.charLength === 6);
  assert('吉野家'.charLength === 3);
  assert('𠮷野家'.charLength === 3);
}
