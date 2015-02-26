{
  let assert = function assert(bool) {
    if (bool) {
      console.log(bool);

      return;
    }

    console.trace();
  };

  let quoteFav = {name : 'Tumblr', form : {'post[type]' : 'quote'}},
      regularFav = {name : 'Tumblr', form : {'post[type]' : 'regular'}},
      opt1 = {
        trimTag   : true,
        trimSpace : true
      },
      opt2 = {
        quoteOnly : false,
        trimSpace : true
      },
      opt3 = {
        quoteOnly : false,
        trimTag   : true,
        trimSpace : true
      };

  assert(getQuoteFromPS({}) === '');
  assert(getQuoteFromPS({body : void 0}) === '');
  assert(getQuoteFromPS({body : null}) === '');
  assert(getQuoteFromPS({body : ''}) === '');
  assert(getQuoteFromPS({body : new String('')}) === '');
  assert(getQuoteFromPS({body : Object.assign(new String(''), {flavors : {}})}) === '');

  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element'}) === '"<picture> element"');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga '}) === '" fuga "');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : quoteFav}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element', favorite : quoteFav}) === '"<picture> element"');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga ', favorite : quoteFav}) === '" fuga "');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: fuga'}) === '');
  assert(getQuoteFromPS({type : 'video', body : '<embed>'}) === '');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : regularFav}) === '');
  assert(getQuoteFromPS({type : 'quote', body : '<p>piyo</p>', favorite : regularFav}) === '');

  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {quoteOnly : false}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element'}, {quoteOnly : false}) === '"<picture> element"');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga '}, {quoteOnly : false}) === '" fuga "');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : quoteFav}, {quoteOnly : false}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element', favorite : quoteFav}, {quoteOnly : false}) === '"<picture> element"');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga ', favorite : quoteFav}, {quoteOnly : false}) === '" fuga "');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: fuga'}, {quoteOnly : false}) === '"hoge: fuga"');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: <picture> element'}, {quoteOnly : false}) === '"hoge: <picture> element"');
  assert(getQuoteFromPS({type : 'video', body : '<embed>'}, {quoteOnly : false}) === '');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : regularFav}, {quoteOnly : false}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<p>piyo</p>', favorite : regularFav}, {quoteOnly : false}) === '"piyo"');

  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {trimTag : true}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element'}, {trimTag : true}) === '" element"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture>'}, {trimTag : true}) === '');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga '}, {trimTag : true}) === '" fuga "');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : quoteFav}, {trimTag : true}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element', favorite : quoteFav}, {trimTag : true}) === '" element"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture>', favorite : quoteFav}, {trimTag : true}) === '');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga ', favorite : quoteFav}, {trimTag : true}) === '" fuga "');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: fuga'}, {trimTag : true}) === '');
  assert(getQuoteFromPS({type : 'video', body : '<embed>'}, {trimTag : true}) === '');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : regularFav}, {trimTag : true}) === '');
  assert(getQuoteFromPS({type : 'quote', body : '<p>piyo</p>', favorite : regularFav}, {trimTag : true}) === '');

  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {trimSpace : true}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element'}, {trimSpace : true}) === '"<picture> element"');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga '}, {trimSpace : true}) === '"fuga"');
  assert(getQuoteFromPS({type : 'quote', body : ' '}, {trimSpace : true}) === '');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : quoteFav}, {trimSpace : true}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element', favorite : quoteFav}, {trimSpace : true}) === '"<picture> element"');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga ', favorite : quoteFav}, {trimSpace : true}) === '"fuga"');
  assert(getQuoteFromPS({type : 'quote', body : ' ', favorite : quoteFav}, {trimSpace : true}) === '');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: fuga'}, {trimSpace : true}) === '');
  assert(getQuoteFromPS({type : 'video', body : '<embed>'}, {trimSpace : true}) === '');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : regularFav}, {trimSpace : true}) === '');
  assert(getQuoteFromPS({type : 'quote', body : '<p>piyo</p>', favorite : regularFav}, {trimSpace : true}) === '');

  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, opt1) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element'}, opt1) === '"element"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture>'}, opt1) === '');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga '}, opt1) === '"fuga"');
  assert(getQuoteFromPS({type : 'quote', body : ' '}, opt1) === '');
  assert(getQuoteFromPS({type : 'quote', body : '<p> </p>'}, opt1) === '');

  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, opt2) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element'}, opt2) === '"<picture> element"');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga '}, opt2) === '"fuga"');
  assert(getQuoteFromPS({type : 'quote', body : ' '}, opt2) === '');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : quoteFav}, opt2) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element', favorite : quoteFav}, opt2) === '"<picture> element"');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga ', favorite : quoteFav}, opt2) === '"fuga"');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: fuga'}, opt2) === '"hoge: fuga"');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: <picture> element'}, opt2) === '"hoge: <picture> element"');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: fuga '}, opt2) === '"hoge: fuga"');
  assert(getQuoteFromPS({type : 'video', body : '<embed>'}, opt2) === '');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : regularFav}, opt2) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<p>piyo</p>', favorite : regularFav}, opt2) === '"piyo"');
  assert(getQuoteFromPS({type : 'quote', body : '<p> piyo </p>', favorite : regularFav}, opt2) === '"piyo"');
  assert(getQuoteFromPS({type : 'quote', body : '<p> </p>', favorite : regularFav}, opt2) === '');

  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, opt3) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element'}, opt3) === '"element"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture>'}, opt3) === '');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga '}, opt3) === '"fuga"');
  assert(getQuoteFromPS({type : 'quote', body : ' '}, opt3) === '');
  assert(getQuoteFromPS({type : 'quote', body : '<p> </p>'}, opt3) === '');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : quoteFav}, opt3) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture> element', favorite : quoteFav}, opt3) === '"element"');
  assert(getQuoteFromPS({type : 'quote', body : '<picture>', favorite : quoteFav}, opt3) === '');
  assert(getQuoteFromPS({type : 'quote', body : ' fuga ', favorite : quoteFav}, opt3) === '"fuga"');
  assert(getQuoteFromPS({type : 'quote', body : ' ', favorite : quoteFav}, opt3) === '');
  assert(getQuoteFromPS({type : 'quote', body : '<p> </p>', favorite : quoteFav}, opt3) === '');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: fuga'}, opt3) === '"hoge: fuga"');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: <picture> element'}, opt3) === '"hoge:  element"');
  assert(getQuoteFromPS({type : 'conversation', body : 'hoge: fuga '}, opt3) === '"hoge: fuga"');
  assert(getQuoteFromPS({type : 'video', body : '<embed>'}, opt3) === '');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge', favorite : regularFav}, opt3) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : '<p>piyo</p>', favorite : regularFav}, opt3) === '"piyo"');
  assert(getQuoteFromPS({type : 'quote', body : '<p> piyo </p>', favorite : regularFav}, opt3) === '"piyo"');
  assert(getQuoteFromPS({type : 'quote', body : '<p> </p>', favorite : regularFav}, opt3) === '');

  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : void 0}) === 'hoge');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : null}) === 'hoge');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : ''}) === 'hoge');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : '"'}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : '\''}) === '\'hoge\'');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : 0}) === '0hoge0');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : true}) === 'truehogetrue');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : false}) === 'falsehogefalse');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : ['"']}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : ['"', '"']}) === '"hoge"');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : ['「', '」']}) === '「hoge」');
  assert(getQuoteFromPS({type : 'quote', body : 'hoge'}, {wrap : [1, 0]}) === '1hoge0');
}
