(function executeRepository(global) {
  'use strict';

  function Repository(...args) {
    this.register(...args);
  }

  Object.expand(Repository.prototype, {
    /**
     * 新しい定義を追加する。
     *
     * @param {Array || Object} items
     * @param {String} targetName 追加対象。この名前の前後に追加される。
     * @param {Boolean} after 追加対象の前に追加するか否か(後か)。
     */
    register(items, targetName, after) {
      let defs = Array.wrap(items);

      if (!defs.length) {
        return;
      }

      if (targetName) {
        let defList = this.values;

        for (let def of defList) {
          delete this[def.name];
        }

        let idx = defList.findIndex(def => def.name === targetName);

        if (idx === -1) {
          idx = defList.length;
        }

        defList.splice(after ? idx + 1 : idx, 0, ...defs);

        defs = defList;
      }

      for (let def of defs) {
        let defName = def.name;

        if (defName) {
          this[defName] = def;
        }
      }
    },
    check(...args) {
      return this.values.filter(def => def.check && def.check(...args));
    },
    get values() {
      return Object.values(this).filter(def => def.name);
    }
  });

  global.Repository = Repository;
}(this));
