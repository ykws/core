/* global Tombfix, Repository, getMessage, createURI, alert, input, download */
/* global getPatchDir, reload, notify, request, succeed, openDialog */
/* global openOptions */

(function executeActions(global) {
  'use strict';

  global.Actions = Tombfix.Service.actions = new Repository([
    {
      type: 'context',
      icon: 'chrome://tombfix/skin/tombloo_16.png',
      name: getMessage('label.action.installPatch'),
      check(ctx) {
        let targetURL;

        if (ctx.onLink) {
          targetURL = ctx.linkURL;
        } else {
          let info = this.getInfoFromDocument(ctx.document);

          if (info.valid) {
            targetURL = info.url;
          }
        }

        if (!targetURL) {
          return;
        }

        let {hostname, pathname} = new URL(targetURL);

        return ((
          // GitHubでかつraw以外のリンクの場合は除外する
          /^(?:gist\.)?github(?:usercontent)?\.com$/.test(hostname) &&
            pathname.split('/')[3] === 'raw'
        ) || /^raw\d*\.github(?:usercontent)?\.com$/.test(hostname)) &&
          createURI(targetURL).fileExtension === 'js';
      },
      execute(ctx) {
        return this.getInfo(ctx).addCallback(({valid, url}) => {
          if (!valid) {
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

          return download(url, getPatchDir()).addCallback(() => {
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
      },
      getInfo(ctx) {
        return ctx.onLink ? request(ctx.linkURL, {
          responseType: 'blob'
        }).addCallback(
          res => ({
            valid: this.isValidContentType(res.response.type),
            url: res.responseURL
          })
        ) : succeed(this.getInfoFromDocument(ctx.document));
      },
      getInfoFromDocument(doc) {
        return {
          valid: this.isValidContentType(doc.contentType),
          url: doc.URL
        };
      },
      isValidContentType(contentType) {
        return [
          'text/plain', 'application/javascript'
        ].indexOf(contentType) !== -1;
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
