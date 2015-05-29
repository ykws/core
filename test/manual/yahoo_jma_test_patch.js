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

  assert(Models['Yahoo JMA'].hiraganaToKatakana('aiueo'), 'aiueo');
  assert(Models['Yahoo JMA'].hiraganaToKatakana('あいうえお'), 'アイウエオ');
  assert(Models['Yahoo JMA'].hiraganaToKatakana('かきくけこ'), 'カキクケコ');
  assert(Models['Yahoo JMA'].kanaToRoma('aiueo'), 'aiueo');
  assert(Models['Yahoo JMA'].kanaToRoma('あいうえお'), 'aiueo');
  assert(Models['Yahoo JMA'].kanaToRoma('かきくけこ'), 'kakikukeko');
  assert(Models['Yahoo JMA'].kanaToRoma('アイウエオ'), 'aiueo');
  assert(Models['Yahoo JMA'].kanaToRoma('カキクケコ'), 'kakikukeko');
  assert(Models['Yahoo JMA'].katakanaTable.get('ア'), 'a');

  console.log([
    `${createURI(Components.stack.filename).fileName}'s ${assert.count} tests:`,
    `  * pass: ${assert.passed}`,
    `  * fail: ${assert.failed}`
  ].join('\n'));
}
