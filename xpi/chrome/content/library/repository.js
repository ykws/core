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

        this.unregister();

        defs = defList.merge(defs, {
          indexFunc: def => def.name === targetName,
          after
        });
      }

      for (let def of defs) {
        let defName = def.name;

        if (defName) {
          this[defName] = def;
        }
      }
    },
    unregister() {
      for (let def of this.values) {
        // jscs: disable disallowKeywords
        delete this[def.name];
        // jscs: enable
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
