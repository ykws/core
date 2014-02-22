/* global UnicodeConverter, CryptoHash */

(function executePrototype() {
  'use strict';

  function extendBuiltInObject(builtInObject, obj) {
    var props = {};

    Object.keys(obj).forEach(function setDescriptor(key) {
      props[key] = {
        value        : obj[key],
        enumerable   : false,
        writable     : true,
        configurable : true
      };
    });

    return Object.defineProperties(builtInObject, props);
  }

  extendBuiltInObject(Date, {
    TIME_SECOND : 1000,
    TIME_MINUTE : 1000 * 60,
    TIME_HOUR   : 1000 * 60 * 60,
    TIME_DAY    : 1000 * 60 * 60 * 24
  });

  extendBuiltInObject(Number.prototype, {
    pad         : function pad(len, ch) {
      return this.toString().pad(len, ch || '0');
    },
    toHexString : function toHexString() {
      return ('0' + this.toString(16)).slice(-2);
    }
  });

  extendBuiltInObject(Array.prototype, {
    split : function split(step) {
      var res, i, len;

      if (!step) {
        return this.slice();
      }

      res = [];
      i = 0;
      len = this.length;

      while (i < len) {
        res.push(this.slice(i, i += step));
      }

      return res;
    }
  });

  extendBuiltInObject(String, {
    katakana: {
      'ウァ' : 'wha',
      'ウィ' : 'wi',
      'ウェ' : 'we',
      'ウォ' : 'who',
      'キャ' : 'kya',
      'キィ' : 'kyi',
      'キュ' : 'kyu',
      'キェ' : 'kye',
      'キョ' : 'kyo',
      'クャ' : 'qya',
      'クュ' : 'qyu',
      'クァ' : 'qwa',
      'クィ' : 'qwi',
      'クゥ' : 'qwu',
      'クェ' : 'qwe',
      'クォ' : 'qwo',
      'ギャ' : 'gya',
      'ギィ' : 'gyi',
      'ギュ' : 'gyu',
      'ギェ' : 'gye',
      'ギョ' : 'gyo',
      'グァ' : 'gwa',
      'グィ' : 'gwi',
      'グゥ' : 'gwu',
      'グェ' : 'gwe',
      'グォ' : 'gwo',
      'シャ' : 'sha',
      'シィ' : 'syi',
      'シュ' : 'shu',
      'シェ' : 'sye',
      'ショ' : 'sho',
      'スァ' : 'swa',
      'スィ' : 'swi',
      'スゥ' : 'swu',
      'スェ' : 'swe',
      'スォ' : 'swo',
      'ジャ' : 'ja',
      'ジィ' : 'jyi',
      'ジュ' : 'ju',
      'ジェ' : 'jye',
      'ジョ' : 'jo',
      'チャ' : 'cha',
      'チィ' : 'tyi',
      'チュ' : 'chu',
      'チェ' : 'tye',
      'チョ' : 'cho',
      'ツァ' : 'tsa',
      'ツィ' : 'tsi',
      'ツェ' : 'tse',
      'ツォ' : 'tso',
      'テャ' : 'tha',
      'ティ' : 'thi',
      'テュ' : 'thu',
      'テェ' : 'the',
      'テョ' : 'tho',
      'トァ' : 'twa',
      'トィ' : 'twi',
      'トゥ' : 'twu',
      'トェ' : 'twe',
      'トォ' : 'two',
      'ヂャ' : 'dya',
      'ヂィ' : 'dyi',
      'ヂュ' : 'dyu',
      'ヂェ' : 'dye',
      'ヂョ' : 'dyo',
      'デャ' : 'dha',
      'ディ' : 'dhi',
      'デュ' : 'dhu',
      'デェ' : 'dhe',
      'デョ' : 'dho',
      'ドァ' : 'dwa',
      'ドィ' : 'dwi',
      'ドゥ' : 'dwu',
      'ドェ' : 'dwe',
      'ドォ' : 'dwo',
      'ニャ' : 'nya',
      'ニィ' : 'nyi',
      'ニュ' : 'nyu',
      'ニェ' : 'nye',
      'ニョ' : 'nyo',
      'ヒャ' : 'hya',
      'ヒィ' : 'hyi',
      'ヒュ' : 'hyu',
      'ヒェ' : 'hye',
      'ヒョ' : 'hyo',
      'フャ' : 'fya',
      'フュ' : 'fyu',
      'フョ' : 'fyo',
      'ファ' : 'fa',
      'フィ' : 'fi',
      'フゥ' : 'fwu',
      'フェ' : 'fe',
      'フォ' : 'fo',
      'ビャ' : 'bya',
      'ビィ' : 'byi',
      'ビュ' : 'byu',
      'ビェ' : 'bye',
      'ビョ' : 'byo',
      'ヴァ' : 'va',
      'ヴィ' : 'vi',
      'ヴ'  : 'vu',
      'ヴェ' : 've',
      'ヴォ' : 'vo',
      'ヴャ' : 'vya',
      'ヴュ' : 'vyu',
      'ヴョ' : 'vyo',
      'ピャ' : 'pya',
      'ピィ' : 'pyi',
      'ピュ' : 'pyu',
      'ピェ' : 'pye',
      'ピョ' : 'pyo',
      'ミャ' : 'mya',
      'ミィ' : 'myi',
      'ミュ' : 'myu',
      'ミェ' : 'mye',
      'ミョ' : 'myo',
      'リャ' : 'rya',
      'リィ' : 'ryi',
      'リュ' : 'ryu',
      'リェ' : 'rye',
      'リョ' : 'ryo',

      'ア'  : 'a',
      'イ'  : 'i',
      'ウ'  : 'u',
      'エ'  : 'e',
      'オ'  : 'o',
      'カ'  : 'ka',
      'キ'  : 'ki',
      'ク'  : 'ku',
      'ケ'  : 'ke',
      'コ'  : 'ko',
      'サ'  : 'sa',
      'シ'  : 'shi',
      'ス'  : 'su',
      'セ'  : 'se',
      'ソ'  : 'so',
      'タ'  : 'ta',
      'チ'  : 'chi',
      'ツ'  : 'tsu',
      'テ'  : 'te',
      'ト'  : 'to',
      'ナ'  : 'na',
      'ニ'  : 'ni',
      'ヌ'  : 'nu',
      'ネ'  : 'ne',
      'ノ'  : 'no',
      'ハ'  : 'ha',
      'ヒ'  : 'hi',
      'フ'  : 'fu',
      'ヘ'  : 'he',
      'ホ'  : 'ho',
      'マ'  : 'ma',
      'ミ'  : 'mi',
      'ム'  : 'mu',
      'メ'  : 'me',
      'モ'  : 'mo',
      'ヤ'  : 'ya',
      'ユ'  : 'yu',
      'ヨ'  : 'yo',
      'ラ'  : 'ra',
      'リ'  : 'ri',
      'ル'  : 'ru',
      'レ'  : 're',
      'ロ'  : 'ro',
      'ワ'  : 'wa',
      'ヲ'  : 'wo',
      'ン'  : 'nn',
      'ガ'  : 'ga',
      'ギ'  : 'gi',
      'グ'  : 'gu',
      'ゲ'  : 'ge',
      'ゴ'  : 'go',
      'ザ'  : 'za',
      'ジ'  : 'zi',
      'ズ'  : 'zu',
      'ゼ'  : 'ze',
      'ゾ'  : 'zo',
      'ダ'  : 'da',
      'ヂ'  : 'di',
      'ヅ'  : 'du',
      'デ'  : 'de',
      'ド'  : 'do',
      'バ'  : 'ba',
      'ビ'  : 'bi',
      'ブ'  : 'bu',
      'ベ'  : 'be',
      'ボ'  : 'bo',
      'パ'  : 'pa',
      'ピ'  : 'pi',
      'プ'  : 'pu',
      'ペ'  : 'pe',
      'ポ'  : 'po',

      'ァ'  : 'la',
      'ィ'  : 'li',
      'ゥ'  : 'lu',
      'ェ'  : 'le',
      'ォ'  : 'lo',
      'ヵ'  : 'lka',
      'ヶ'  : 'lke',
      'ッ'  : 'ltu',
      'ャ'  : 'lya',
      'ュ'  : 'lyu',
      'ョ'  : 'lyo',
      'ヮ'  : 'lwa',
      '。'  : '.',
      '、'  : ', ',
      'ー'  : '-'
    }
  });

  extendBuiltInObject(String.prototype, {
    pad : function pad(len, ch) {
      len = len - this.length;

      if (len <= 0) {
        return this.toString();
      }

      return (ch || ' ').repeat(len) + this;
    },
    indent : function indent(num, c) {
      c = c || ' ';

      return this.replace(/^/mg, c.repeat(num));
    },
    wrap : function wrap(prefix, suffix) {
      suffix = suffix || prefix;

      return prefix + this + suffix;
    },
    extract : function extract(re, group) {
      var res = this.match(re);
      group = group == null ? 1 : group;

      return res ? res[group] : '';
    },
    decapitalize : function decapitalize() {
      return this.substr(0, 1).toLowerCase() + this.substr(1);
    },
    capitalize : function capitalize() {
      return this.substr(0, 1).toUpperCase() + this.substr(1);
    },
    toByteArray : function toByteArray(charset) {
      return new UnicodeConverter(charset).convertToByteArray(this, {});
    },
    md5 : function md5(charset) {
      var crypto = new CryptoHash(CryptoHash.MD5),
          data = this.toByteArray(charset);

      crypto.update(data, data.length);

      return crypto.finish(false).split('').map(function getHexString(char) {
        return char.charCodeAt().toHexString();
      }).join('');
    },
    sha1 : function sha1(charset) {
      var crypto = new CryptoHash(CryptoHash.SHA1),
          data = this.toByteArray(charset);

      crypto.update(data, data.length);

      return crypto.finish(true);
    },
    convertToUnicode : function convertToUnicode(charset) {
      return new UnicodeConverter(charset).ConvertToUnicode(this);
    },
    convertFromUnicode : function convertFromUnicode(charset) {
      return new UnicodeConverter(charset).ConvertFromUnicode(this);
    },
    trimTag : function trimTag() {
      return this.replace(/<!--[\s\S]+?-->/gm, '').replace(/<[\s\S]+?>/gm, '');
    },
    includesFullwidth : function includesFullwidth() {
      return (/[^ -~｡-ﾟ]/).test(this);
    },
    // https://code.google.com/p/kanaxs/
    toHiragana : function toHiragana() {
      var c, i = this.length, ary = [];

      while (i--) {
        c = this.charCodeAt(i);
        ary[i] = (0x30A1 <= c && c <= 0x30F6) ? c - 0x0060 : c;
      }

      return String.fromCharCode.apply(null, ary);
    },
    toKatakana : function toKatakana() {
      var c, i = this.length, ary = [];

      while (i--) {
        c = this.charCodeAt(i);
        ary[i] = (0x3041 <= c && c <= 0x3096) ? c + 0x0060 : c;
      }

      return String.fromCharCode.apply(null, ary);
    },
    toRoma : function toRoma() {
      var res = '',
          str = this.toKatakana(),
          len = str.length,
          table = String.katakana;

      for (let i = 0, kana, roma; i < len; i += kana.length) {
        kana = str.substr(i, 2);
        roma = table[kana];

        if (!roma) {
          kana = str.substr(i, 1);
          roma = table[kana];
        }

        if (!roma) {
          roma = kana;
        }

        res += roma;
      }

      return res.replace(/ltu(.)/g, '$1$1');
    }
  });

  Object.defineProperties(String.prototype, {
    charLength : {
      set : function returnCharLength() {
        return this.charLength;
      },
      get : function getCharLength() {
        return [...this].length;
      },
      enumerable   : false,
      configurable : true
    }
  });
}());
