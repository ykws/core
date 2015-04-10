var env = Components.classes['@tombfix.github.io/tombfix-service;1'].getService().wrappedJSObject;
env.extend(this, env, false);

var prefpane = document.getElementsByTagName('prefpane')[0];
function getField(name){
	return document.getElementsByAttribute('preference', name)[0];
}

function keyStringField(name, meta){
	var elm = getField(name);
	elm.addEventListener('keydown', function(e){
		var key = keyString(e);
		switch(key) {
		case 'TAB':
		case 'SHIFT + TAB':
			return;
		}

		cancel(e);
		elm.value = (key=='ESCAPE')? '' :
			(meta)? key : key.split(' + ').pop();
		prefpane.userChangedValue(elm);
	}, true);
}

function mouseStringField(name){
	var elm = getField(name);
	observeMouseShortcut(elm, function(e, key){
		elm.value = key;
		prefpane.userChangedValue(elm);

		// 全てのキーを処理しなかったことにしてイベントが停止するのを避ける
		return true;
	});
	elm.addEventListener('keydown', function(e){
		switch(keyString(e)) {
		case 'TAB':
		case 'SHIFT + TAB':
			return;

		case 'ESCAPE':
			elm.value = '';
			prefpane.userChangedValue(elm);
		}

		cancel(e);
	}, false);
	elm.addEventListener('contextmenu', cancel, true);
}

mouseStringField('shortcutkey.checkAndPost');
keyStringField('shortcutkey.quickPost.link', true);
keyStringField('shortcutkey.quickPost.regular', true);
keyStringField('accesskey.share', false);


var elmDataDir = getField('dataDir');
elmDataDir.nextSibling.addEventListener('command', function(){
	var fp = new FilePicker(window, getMessage('label.dataDir'), FilePicker.modeGetFolder);
	fp.displayDirectory = getDataDir();
	if(fp.show() == fp.returnOK){
		elmDataDir.value = fp.file.path.replace(getProfileDir().path, '{ProfD}');
		prefpane.userChangedValue(elmDataDir);
	}
}, true)


var tagProvider = document.getElementsByAttribute('preference', 'tagProvider')[0];
for(var name in Models){
	if(Models[name].getSuggestions){
		var elmRadio = tagProvider.appendItem(name, name);

		// ロード後にアイコンを設定するために保持する
		// (アイコンのロードに失敗すると設定画面が開かないため)
		elmRadio.src = Models[name].ICON;
	}
}

window.addEventListener('load', function(){
	// スクリプト実行時点でprefpaneのコンストラクターからvalueが先に与えられているため、
	// 後から追加したradioのチェックをつけることはできない。
	// またロード中はradiogroup._getRadioChildrenに反映されていないため、
	// valueの変更でチェックをつけることもできない。
	tagProvider.value = tagProvider.value;

	// 準備していたアイコンを設定する
	// (Firefox側で問題が修正された後はこのコードは不要)
	forEach(tagProvider.getElementsByTagName('radio'), function(elmRadio){
		elmRadio.setAttribute('src', elmRadio.src);
	});
}, true)


function PosterTree(elmTree){
	this.load();

	this.elmTree = elmTree;

	elmTree.addEventListener('click', bind('onClick', this), true);
	elmTree.addEventListener('mousedown', bind('onMouseDown', this), true);
	elmTree.addEventListener('mouseup', bind('onMouseUp', this), true);
	elmTree.addEventListener('mouseout', bind('onMouseOut', this), true);
	elmTree.addEventListener('mousemove', bind('onMouseMove', this), true);
	elmTree.view = this;


	this.elmToggle = $x('.//xul:treecol', elmTree);
	this.elmToggle.image = $x('.//xul:image', this.elmToggle);
	this.elmToggle.label = $x('.//xul:label', this.elmToggle);
	this.elmToggle.closed = false;
	this.cycleHeader({index : 0});
}

PosterTree.prototype = extend(new AbstractTreeView(), {
	TYPES : 'regular photo quote link video conversation favorite'.split(' '),

	resetData : function(rows){
		// ロード以前はboxが存在しない
		this.box && this.box.rowCountChanged(0, -this.rows.length);
		this.rows = rows;
		this.box && this.box.rowCountChanged(0, this.rows.length);
	},

	load : function(){
		var self = this;
		var configs = JSON.parse(getPref('postConfig'));

		self.all = [];

		values(Models).forEach(function(model){
			// インターフェースが実装されているポスト対象のサービスでない場合は処理しない
			if(!model.check)
				return;

			var row = [model.name];
			row.icon = model.ICON;

			var config = configs[model.name] || {};
			self.TYPES.forEach(function(type){
				var postable = (type=='favorite')? !!model.favor : model.check({
					type : type,
					pageUrl : {
						match : function(){return true}
					},
				});
				row.push(config[type] || (postable? 'enabled' : null));
			});

			self.all.push(row);
		});

		self.rows = [].concat(self.all);
	},

	save : function(){
		var configs = {};
		var self = this;
		this.all.forEach(function(row){
			var config = configs[row[0]] = {};
			for(var j=1 ; j<row.length ; j++){
				if(!row[j])
					continue;
				config[self.TYPES[j-1]] = row[j];
			}
		});

		setPref('postConfig', JSON.stringify(configs));
	},

	// DOM
	changeCursor : function(cursor){
		if(this.elmTree.style.cursor == cursor)
			return;

		this.elmTree.style.cursor = cursor;
	},

	setProp :function(pos, prop){
		if(!pos)
			return;

		this.rows[pos.row][pos.col] = prop;
		this.box.invalidateCell(pos.row, this.box.columns.getColumnAt(pos.col));
	},

	getCellAt : function(e){
		var row={}, col={}, obj={};
		this.box.getCellAt(e.clientX, e.clientY, row, col, obj);

		if(!col.value)
			return;

		var pos = {
			row : row.value,
			col : col.value.index,
		};
		if(pos.col>0 && this.rows[pos.row] && this.rows[pos.row][pos.col])
			return pos;
	},

	// cycleCellはmousedownで発生してしまうため使わない
	onClick : function(e){
		// ドラッグ後のマウスアップではないか?
		var pos = this.getCellAt(e);
		if(!pos || !this.downed || (this.downed.row!=pos.row || this.downed.col!=pos.col))
			return;

		var val = this.rows[pos.row][pos.col];
		this.setProp(pos,
			(val=='default')? 'enabled' :
			(val=='enabled')? 'disabled' : 'default'
		);
	},

	onMouseDown : function(e){
		var pos = this.getCellAt(e);
		if(!pos)
			return;

		this.source = this.rows[pos.row][pos.col];
		this.downed = pos;
	},

	onMouseUp : function(e){
		delete this.source;
		this.changeCursor(this.getCellAt(e)? 'pointer' : '')
	},

	onMouseOut : function(e){
		delete this.source;
	},

	onMouseMove : function(e){
		var pos = this.getCellAt(e);
		if(!this.source){
			this.changeCursor(pos? 'pointer' : '');
			return;
		}

		this.changeCursor('url(chrome://tombfix/skin/' + this.source + '.png), pointer');
		this.setProp(pos, this.source);
	},


	// nsITreeView
	get rowCount() {
		return this.rows.length;
	},

	setTree : function(box) {
		this.box = box;
	},

	getCellProperties : function(row, {index : col}, props){
		var val = this.rows[row][col];
		if (col!=0 && val) {
			if (props) {
				props.AppendElement(AtomService.getAtom(val));
			} else {
				return AtomService.getAtom(val);
			}
		}
	},

	getCellText : function(row, {index : col}){
		return this.rows[row][col];
	},

	getImageSrc : function(row, {index : col}){
		if(col==0)
			return this.rows[row].icon;
	},

	cycleHeader : function({index : col}){
		if(col!=0)
			return;

		var elmToggle = this.elmToggle;
		var closed = elmToggle.closed;
		var button = closed? {
			image : 'twisty-open.png',
			label : getMessage('label.collapseServices'),
		} : {
			image : 'twisty-clsd.png',
			label : getMessage('label.openServices'),
		};
		elmToggle.image.src = 'chrome://global/skin/tree/' + button.image;
		elmToggle.label.value = button.label;

		this.resetData(closed? [].concat(this.all) : reduce(function(memo, row){
			var used = row.some(function(cell){
				return (/(default|enable)/).test(cell);
			});
			if(used)
				memo.push(row);

			return memo;
		}, this.all, []));

		elmToggle.closed = !closed;
	},
});

// MacではOK/キャンセルが表示されないため無条件にunloadで保存する
var tree = new PosterTree(document.getElementById('posters'));
window.addEventListener(AppInfo.OS.indexOf('WIN') == 0? 'beforeaccept' : 'unload', function(){
	tree.save()
}, true);

// beforeaccept時点ではpreferenceが更新されていないためunloadを使う
window.addEventListener('unload', function(){
	// ショートカットキーの変更を反映させる
	// タグのキャッシュもクリアされる
	reload();
}, true);
