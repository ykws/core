/* global Components */

(function executeChangeAccount(win, doc) {
  'use strict';

  let env = Components.classes[
    '@tombfix.github.io/tombfix-service;1'
  ].getService().wrappedJSObject;
  let {Models} = env;

  function getAccountInfoList(model) {
    let infoList;

    if (model.getPasswords) {
      infoList = model.getPasswords();
    }

    return Array.isArray(infoList) ? infoList : [];
  }

  let targets = Models.values.filter(model =>
    model.login && model.getCurrentUser && getAccountInfoList(model).length
  );

  if (!targets.length) {
    doc.querySelector('.left-box').hidden = true;

    win.addEventListener('load', () => {
      // load時は、まだダイアログが表示されていない
      env.showMessage.async(env, ['message.changeAccount.infoNotFound', win]);
    });

    return;
  }

  let services = doc.querySelector('.services');
  let loginButton = doc.querySelector('.login-button');
  let accounts = doc.querySelector('.accounts');

  function createAccountList(accountInfoList, currentUserList) {
    for (let {user, password} of accountInfoList) {
      let account = accounts.appendItem(user, password);

      account.classList.add('listitem-iconic', 'account');

      if (currentUserList.some(currentUser =>
        currentUser && currentUser === user
      )) {
        account.image = 'chrome://tombfix/skin/tick.png';
        account.disabled = true;

        accounts.selectedItem = account;
      } else {
        account.image = 'chrome://tombfix/skin/empty.png';
      }
    }
  }

  services.addEventListener('select', () => {
    loginButton.disabled = true;

    let model = Models[services.value];

    model.getCurrentUser().addErrback(() => []).addCallback(list => {
      if (model.name !== services.value) {
        return;
      }

      env.clearChildren(accounts);

      // 「アカウントの切り替え」を開いて2回目以降にアカウントリストの表示がおかしくなるのを防ぐ
      createAccountList.async(null, [
        getAccountInfoList(model),
        Array.wrap(list)
      ]);
    });
  });

  accounts.addEventListener('select', () => {
    let account = accounts.selectedItem;

    if (!account) {
      return;
    }

    loginButton.disabled = account.disabled;
  });

  win.addEventListener('dialogaccept', () => {
    let account = accounts.selectedItem;

    Models[services.value].login(account.label, account.value);
  });

  win.addEventListener('load', () => {
    // load後でないとアイコンが表示されない
    for (let model of targets) {
      let modelName = model.name;
      let menuitem = services.appendItem(modelName, modelName);

      menuitem.classList.add('menuitem-iconic');
      menuitem.image = model.ICON;
    }

    services.selectedIndex = 0;
  });
}(window, document));
