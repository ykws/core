Tombfix.Service.actions = new Repository([
	{
		type : 'context',
		icon : 'chrome://tombfix/skin/tombloo_16.png',
		name : getMessage('label.action.installPatch'),
		check : function(ctx){
			// GitHubでかつraw以外のリンクの場合は除外する
			// FIXME: より簡易にインストールできるように
			var url = ctx.linkURL;
			return ctx.onLink && 
				(createURI(url).fileExtension == 'js') && 
				!(/github\.com/.test(url) && !/\/raw\//.test(url));
		},
		execute : function(ctx){
			var self = this;
			
			// ファイルタイプを取得しチェックする
			var url;
			return request(ctx.linkURL).addCallback(function(res){
				if(!/^text\/.*(javascript|plain)/.test(res.channel.contentType)){
					alert(getMessage('message.install.invalid'));
					return;
				}
				
				var res = input({
					'message.install.warning' : null,
					'label.install.agree' : false,
				}, 'message.install.warning');
				if(!res || !res['label.install.agree'])
					return;
				
				return download(ctx.linkURL, getPatchDir()).addCallback(function(file){
					// 異常なスクリプトが含まれているとここで停止する
					reload();
					
					notify(self.name, getMessage('message.install.success'), notify.ICON_INFO);
				});
			});
		},
	},
	
	{
		type : 'menu,context',
		name : getMessage('label.action.changeAccount'),
		execute : function(){
			openDialog('chrome://tombfix/content/library/login.xul', 'resizable,centerscreen');
		},
	},
	{
		type : 'menu,context',
		name : '----',
	},
	{
		type : 'menu,context',
		icon : 'chrome://tombfix/skin/tombloo_16.png',
		name : getMessage('label.action.tombfixOptions'),
		execute : function(){
			openDialog('chrome://tombfix/content/prefs.xul', 'resizable,centerscreen');
		},
	},
]);

var openInActionBase = {
	check : function(ctx){
		return true;
	},
	execute : function(ctx){
		var app = this.getFile(getPrefValue(this.prefKey));
		if(!app){
			while(true){
				var path = prompt(this.prompt);
				if(path === null)
					return;
				
				app = this.getFile(path);
				if(app){
					setPrefValue(this.prefKey, path);
					break;
				}
			}
		}
		
		try{
			new Process(app).run(false, [ctx.href], 1);
		}catch(e){
			alert(e);
			setPrefValue(this.prefKey, '');
		}
	},
	getFile : function(path){
		try{
			var file = getLocalFile(path);
			return file.exists() && file.isFile() && file;
		}catch(e){}
	},
}
