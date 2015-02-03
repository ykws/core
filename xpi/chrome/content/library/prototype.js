/* global UnicodeConverter, TextToSubURI */

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

  extendBuiltInObject(String.prototype, {
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
    capitalize : function capitalize() {
      return this.substr(0, 1).toUpperCase() + this.substr(1);
    },
    convertToUnicode : function convertToUnicode(charset) {
      return new UnicodeConverter(charset).ConvertToUnicode(this);
    },
    convertFromUnicode : function convertFromUnicode(charset) {
      return new UnicodeConverter(charset).ConvertFromUnicode(this);
    },
    unEscapeURI : function unEscapeURI(charset = 'UTF-8') {
      return TextToSubURI.unEscapeURIForUI(charset, this);
    },
    trimTag : function trimTag() {
      return this.replace(/<!--[\s\S]+?-->/gm, '').replace(/<[\s\S]+?>/gm, '');
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
