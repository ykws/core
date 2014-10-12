/* global request, Tombfix, Repository, getMessage, createURI, alert, input */
/* global download, getPatchDir, reload, notify, openDialog */

(function executeActions(global) {
  'use strict';

  global.Actions = Tombfix.Service.actions = new Repository([
    // FIXME: より簡易にインストールできるように
    {
      type : 'context',
      icon : 'chrome://tombfix/skin/tombloo_16.png',
      name : getMessage('label.action.installPatch'),
      check : function check(ctx) {
        if (ctx.onLink) {
          let uri = createURI(ctx.linkURL);

          return uri.fileExtension === 'js' && ((
            // GitHubでかつraw以外のリンクの場合は除外する
            /^(?:gist\.)?github(?:usercontent)?\.com$/.test(uri.host) &&
            /\/raw\//.test(uri.path)
          ) || /^raw\d*\.github(?:usercontent)?\.com$/.test(uri.host));
        }
      },
      execute : function execute(ctx) {
        // ファイルタイプを取得しチェックする
        return request(ctx.linkURL).addCallback(res => {
          var result;

          if (
            [
              'text/plain', 'application/javascript'
            ].indexOf(res.channel.contentType) === -1
          ) {
            alert(getMessage('message.install.invalid'));

            return;
          }

          result = input({
            'message.install.warning' : null,
            'label.install.agree' : false,
          }, 'message.install.warning');

          if (!(result && result['label.install.agree'])) {
            return;
          }

          return download(ctx.linkURL, getPatchDir()).addCallback(() => {
            // 異常なスクリプトが含まれているとここで停止する
            reload();
            notify(
              this.name,
              getMessage('message.install.success'),
              notify.ICON_INFO
            );
          });
        }).addErrback(err => {
          alert(err.message.message);
        });
      }
    },

    {
      type : 'menu,context',
      name : getMessage('label.action.changeAccount'),
      execute : function execute() {
        openDialog(
          'chrome://tombfix/content/library/login.xul',
          'resizable,centerscreen'
        );
      }
    },

    {
      type : 'menu,context',
      name : getMessage('label.action.openScriptFolder'),
      execute : function execute() {
        try {
          getPatchDir().launch();
        } catch (err) {
          alert('Error! ' + (err && err.message || err));
        }
      }
    },

    {
      type : 'menu,context',
      name : getMessage('label.action.reloadTombfix'),
      execute : () => reload()
    },

    {
      type : 'menu,context',
      name : '----'
    },

    {
      type : 'menu,context',
      icon : 'chrome://tombfix/skin/tombloo_16.png',
      name : getMessage('label.action.tombfixOptions'),
      execute : function execute() {
        openDialog(
          'chrome://tombfix/content/prefs.xul',
          'resizable,centerscreen'
        );
      }
    }
  ]);
}(this));
