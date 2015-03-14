/* global UnicodeConverter, CryptoHash, TextToSubURI */

(function executeExpand() {
  'use strict';

  Object.defineProperty(Object, 'expand', {
    value        : function expand(target, props) {
      return Object.defineProperties(
        target,
        Object.keys(props).reduce((descriptors, propName) => {
          return Object.assign(descriptors, {
            [propName] : Object.assign(
              Object.getOwnPropertyDescriptor(props, propName),
              {enumerable : false}
            )
          });
        }, {})
      );
    },
    writable     : true,
    enumerable   : false,
    configurable : true
  });

  Object.expand(Array, {
    wrap(target) {
      return target == null ? [] : (Array.isArray(target) ? target : [target]);
    }
  });

  Object.expand(String.prototype, {
    indent(num, char) {
      return this.replace(/^/mg, (char || ' ').repeat(num));
    },
    wrap(prefix, suffix) {
      return prefix == null ? this : (
        prefix + this + (suffix == null ? prefix : suffix)
      );
    },
    extract(re, group) {
      let match = this.match(re);

      return match ? match[group == null ? 1 : group] : '';
    },
    capitalize() {
      return this.slice(0, 1).toUpperCase() + this.slice(1);
    },
    convertToUnicode(charset) {
      return new UnicodeConverter(charset).ConvertToUnicode(this);
    },
    convertFromUnicode(charset) {
      return new UnicodeConverter(charset).ConvertFromUnicode(this);
    },
    md5(base64, charset) {
      let crypto = new CryptoHash(CryptoHash.MD5),
          data = new UnicodeConverter(charset).convertToByteArray(this, {});

      crypto.update(data, data.length);

      return base64 ? crypto.finish(true) : crypto.finish(false).split('').map(
        char => ('0' + char.charCodeAt().toString(16)).slice(-2)
      ).join('');
    },
    unEscapeURI(charset) {
      return TextToSubURI.unEscapeURIForUI(charset || 'UTF-8', this);
    },
    trimTag() {
      return this.replace(/<!--[\s\S]+?-->/gm, '').replace(/<[\s\S]+?>/gm, '');
    },
    get charLength() {
      return [...this].length;
    }
  });
}());
