/* global Components, keyString, cancel, observeMouseShortcut, FilePicker */
/* global getDataDir, getProfileDir, Models, $x, AbstractTreeView, getPref */
/* global setPref, AtomService, getMessage, getPrefValue, reload */

(function executeOptions(global, win, doc) {
  'use strict';

  let env = Components.classes[
    '@tombfix.github.io/tombfix-service;1'
  ].getService().wrappedJSObject;

  env.extend(global, env, false);

  let main = doc.querySelector('.main');

  function getField(prefName) {
    return doc.getElementsByAttribute('preference', prefName)[0];
  }

  function changeValue(elm, value) {
    elm.value = value;
    main.userChangedValue(elm);
  }

  function keyStringField(prefName, meta) {
    let elm = getField(prefName);

    elm.addEventListener('keydown', evt => {
      let key = keyString(evt);

      switch (key) {
      case 'TAB':
      case 'SHIFT + TAB':
        return;
      }

      cancel(evt);
      changeValue(
        elm,
        key === 'ESCAPE' ? '' : (meta ? key : key.split(' + ').pop())
      );
    });
  }

  function mouseStringField(prefName) {
    let elm = getField(prefName);

    observeMouseShortcut(elm, (evt, key) => {
      changeValue(elm, key);

      // 全てのキーを処理しなかったことにしてイベントが停止するのを避ける
      return true;
    });

    elm.addEventListener('keydown', evt => {
      switch (keyString(evt)) {
      case 'TAB':
      case 'SHIFT + TAB':
        return;

      case 'ESCAPE':
        changeValue(elm, '');
      }

      cancel(evt);
    });
    elm.addEventListener('contextmenu', cancel);
  }

  keyStringField('accesskey.share', false);
  keyStringField('shortcutkey.quickPost.regular', true);
  keyStringField('shortcutkey.quickPost.link', true);
  mouseStringField('shortcutkey.checkAndPost');


  win.addEventListener('load', () => {
    let elmTagProvider = getField('tagProvider'),
        tagProviderName = elmTagProvider.value;

    // ロード前にアイコンを設定すると、
    // アイコンのロードに失敗した時に設定画面が開かなかったり、
    // 問題がなくても開くのに時間がかかるため、ロード後にmenuitemを追加してアイコンを設定する
    for (let model of Models.values) {
      if (model.getSuggestions) {
        let modelName = model.name,
            menuitem = elmTagProvider.appendItem(modelName, modelName);

        menuitem.classList.add('menuitem-iconic');
        menuitem.image = model.ICON;

        if (tagProviderName === modelName) {
          elmTagProvider.selectedItem = menuitem;
        }
      }
    }
  });


  let elmDataDir = getField('dataDir');

  elmDataDir.nextElementSibling.addEventListener('command', () => {
    let fp = new FilePicker(win, null, FilePicker.modeGetFolder);

    fp.displayDirectory = getDataDir();

    if (fp.show() === FilePicker.returnOK) {
      changeValue(
        elmDataDir,
        fp.file.path.replace(getProfileDir().path, '{ProfD}')
      );
    }
  });


  function ModelsTree(elmTree) {
    this.load();

    this.elmTree = elmTree;

    elmTree.addEventListener('click', this);
    elmTree.addEventListener('mousedown', this);
    elmTree.addEventListener('mouseup', this);
    elmTree.addEventListener('mouseout', this);
    elmTree.addEventListener('mousemove', this);

    elmTree.view = this;

    this.elmToggle = $x('.//xul:treecol', elmTree);
    this.elmToggle.image = $x('.//xul:image', this.elmToggle);
    this.elmToggle.label = $x('.//xul:label', this.elmToggle);
    this.elmToggle.closed = false;

    this.cycleHeader({
      index : 0
    });
  }

  ModelsTree.prototype = Object.expand(new AbstractTreeView(), {
    constructor : ModelsTree,

    TYPES : [
      'regular', 'photo', 'quote', 'link', 'video', 'conversation', 'favorite'
    ],

    load() {
      let modelsConfig = JSON.parse(getPref('postConfig'));

      this.all = Models.values.reduce((all, model) => {
        // インターフェースが実装されているポスト対象のサービスでない場合は処理しない
        if (model.check) {
          let modelName = model.name,
              modelConfig = modelsConfig[modelName];

          all.push([modelName].concat(
            this.TYPES.map(type => modelConfig ? (modelConfig[type] || '') : (
              type === 'favorite' ? Boolean(model.favor) : model.check({
                type    : type,
                pageUrl : {
                  match : () => true
                }
              })
            ) ? 'enabled' : '')
          ));
        }

        return all;
      }, []);
      this.rows = this.all.slice();
    },
    save() {
      setPref('postConfig', JSON.stringify(this.all.reduce((target, row) => {
        let clone = row.slice(),
            modelConfig = target[clone.shift()] = {};

        clone.forEach((val, idx) => {
          if (val) {
            modelConfig[this.TYPES[idx]] = val;
          }
        });

        return target;
      }, {})));
    },

    handleEvent(evt) {
      let pos = this.getCellAt(evt);

      switch (evt.type) {
      // cycleCellはmousedownで発生してしまうため使わない
      case 'click':
        // ドラッグ後のマウスアップではないか?
        if (
          pos && this.downed &&
            this.downed.row === pos.row && this.downed.col === pos.col
        ) {
          let val = this.rows[pos.row][pos.col];

          this.setProp(pos, val === 'default' ? 'enabled' : (
            val === 'enabled' ? 'disabled' : 'default'
          ));
        }

        break;
      case 'mousedown':
        if (pos) {
          this.source = this.rows[pos.row][pos.col];
          this.downed = pos;
        }

        break;
      case 'mouseup':
        delete this.source;

        this.changeCursor(pos ? 'pointer' : '');

        break;
      case 'mouseout':
        delete this.source;

        break;
      case 'mousemove':
        if (!this.source) {
          this.changeCursor(pos ? 'pointer' : '');

          break;
        }

        this.changeCursor(
          'url("chrome://tombfix/skin/' + this.source + '.png"), pointer'
        );
        this.setProp(pos, this.source);

        break;
      }
    },

    // DOM
    getCellAt(evt) {
      let rowObj = {}, colObj = {};

      this.box.getCellAt(evt.clientX, evt.clientY, rowObj, colObj, {});

      if (colObj.value) {
        let pos = {
          row : rowObj.value,
          col : colObj.value.index
        };

        if (pos.col > 0) {
          let row = this.rows[pos.row];

          if (row && row[pos.col]) {
            return pos;
          }
        }
      }
    },
    setProp(pos, prop) {
      if (pos) {
        this.rows[pos.row][pos.col] = prop;
        this.box.invalidateCell(pos.row, this.box.columns.getColumnAt(pos.col));
      }
    },
    changeCursor(cursor) {
      let treeStyle = this.elmTree.style;

      if (treeStyle.cursor !== cursor) {
        treeStyle.cursor = cursor;
      }
    },
    resetData(rows) {
      // ロード以前はboxが存在しない
      if (this.box) {
        this.box.rowCountChanged(0, -this.rows.length);
      }

      this.rows = rows;

      if (this.box) {
        this.box.rowCountChanged(0, this.rows.length);
      }
    },

    // http://mxr.mozilla.org/mozilla-central/source/layout/xul/tree/nsITreeView.idl
    get rowCount() {
      return this.rows.length;
    },
    setTree(box) {
      this.box = box;
    },
    getCellProperties(row, {index : col}) {
      if (col !== 0) {
        let val = this.rows[row][col];

        if (val) {
          return AtomService.getAtom(val);
        }
      }
    },
    getCellText(row, {index : col}) {
      return this.rows[row][col];
    },
    getImageSrc(row, {index : col}) {
      if (col === 0) {
        return Models[this.rows[row][0]].ICON;
      }
    },
    cycleHeader({index : col}) {
      if (col !== 0) {
        return;
      }

      let {elmToggle} = this,
          opened = !elmToggle.closed;

      elmToggle.image.src = 'chrome://global/skin/tree/' + (
        opened ? 'twisty-clsd.png' : 'twisty-open.png'
      );
      elmToggle.label.value = getMessage(
        opened ? 'label.openServices' : 'label.collapseServices'
      );

      this.resetData(opened ? this.all.reduce((rows, row) => {
        if (row.some(cell => /^(?:default|enabled)$/.test(cell))) {
          rows.push(row);
        }

        return rows;
      }, []) : this.all.slice());

      elmToggle.closed = opened;
    }
  });

  let tree = new ModelsTree(doc.querySelector('.post-config > tree'));

  win.addEventListener(
    getPrefValue('browser.preferences.instantApply') ?
      'unload' :
      'beforeaccept',
    () => {
      tree.save();
    }
  );

  // beforeaccept時点ではpreferenceが更新されていないためunloadを使う
  win.addEventListener('unload', () => {
    // ショートカットキーの変更を反映させる
    // タグのキャッシュもクリアされる
    reload();
  });
}(this, window, document));
