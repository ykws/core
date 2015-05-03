/* global Tombfix, Repository, getMessage, createURI, request, alert, input */
/* global download, getPatchDir, reload, notify, openDialog, openOptions */

(function executeActions(global) {
  'use strict';

  global.Actions = Tombfix.Service.actions = new Repository([
    // FIXME: より簡易にインストールできるように
    {
      type: 'context',
      icon: 'chrome://tombfix/skin/tombloo_16.png',
      name: getMessage('label.action.installPatch'),
      check(ctx) {
        if (ctx.onLink) {
          let uriObj = createURI(ctx.linkURL);

          return uriObj.fileExtension === 'js' && ((
            // GitHubでかつraw以外のリンクの場合は除外する
            /^(?:gist\.)?github(?:usercontent)?\.com$/.test(uriObj.host) &&
            /\/raw\//.test(uriObj.path)
          ) || /^raw\d*\.github(?:usercontent)?\.com$/.test(uriObj.host));
        }
      },
      execute(ctx) {
        // ファイルタイプを取得しチェックする
        return request(ctx.linkURL, {
          responseType: 'blob'
        }).addCallback(({response: blob}) => {
          if ([
            'text/plain', 'application/javascript'
          ].indexOf(blob.type) === -1) {
            alert(getMessage('message.install.invalid'));

            return;
          }

          let result = input({
            'message.install.warning': null,
            'label.install.agree': false
          }, 'message.install.warning');

          if (!(result && result['label.install.agree'])) {
            return;
          }

          return download(ctx.linkURL, getPatchDir()).addCallback(() => {
            reload();
            notify(
              this.name,
              getMessage('message.install.success'),
              notify.ICON_INFO
            );
          });
        }).addErrback(({message}) => {
          alert((
            typeof message === 'string' ? message : message.message
          ) || getMessage('error.contentsNotFound'));
        });
      }
    },
    {
      type: 'menu,context',
      name: getMessage('label.action.changeAccount'),
      execute() {
        openDialog(
          'chrome://tombfix/content/changeAccount/changeAccount.xul',
          'resizable,centerscreen'
        );
      }
    },
    {
      type: 'menu,context',
      name: getMessage('label.action.openScriptFolder'),
      execute() {
        try {
          getPatchDir().launch();
        } catch (err) {
          alert('Error! ' + (err && err.message || err));
        }
      }
    },
    {
      type: 'menu,context',
      name: getMessage('label.action.reloadTombfix'),
      execute() {
        reload();
      }
    },
    {
      type: 'menu,context',
      name: '----'
    },
    {
      type: 'menu,context',
      icon: 'chrome://tombfix/skin/tombloo_16.png',
      name: getMessage('label.action.tombfixOptions'),
      execute() {
        openOptions();
      }
    }
  ]);
}(this));
