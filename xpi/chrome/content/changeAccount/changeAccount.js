/* global Components */

(function executeChangeAccount(win, doc) {
  'use strict';

  let env = Components.classes[
        '@tombfix.github.io/tombfix-service;1'
      ].getService().wrappedJSObject,
      {Models} = env,
      elmModels = doc.querySelector('.models');

  for (let model of Models.values) {
    if (
      model.login && model.getCurrentUser &&
        model.getPasswords && model.getPasswords().length
    ) {
      let {name} = model;

      elmModels.appendItem(name, name).setAttribute('src', model.ICON);
    }
  }

  if (!elmModels.childElementCount) {
    win.addEventListener('load', () => {
      // load時は、まだダイアログが表示されていない
      setTimeout(() => {
        win.alert(env.getMessage('message.changeAccount.infoNotFound'));
      }, 0);
    });

    return;
  }

  let elmUsers = doc.querySelector('.users'),
      elmLogin = doc.querySelector('.login');

  elmModels.addEventListener('select', () => {
    // ユーザー名の取得で非同期処理を挟むため、その間再描画を止める
    if (elmUsers.refreshing) {
      return;
    }

    let model = Models[elmModels.value];

    elmLogin.disabled = elmUsers.refreshing = true;

    model.getCurrentUser().addBoth(result => {
      let currentUser = typeof result === 'string' ? result : '';

      env.clearChildren(elmUsers);

      for (let {user, password} of model.getPasswords()) {
        let item = elmUsers.appendItem(user, password);

        item.classList.add('listitem-iconic');

        if (currentUser && currentUser === user) {
          item.image = 'chrome://tombfix/skin/tick.png';
          item.disabled = true;

          elmUsers.selectedItem = item;
        } else {
          item.image = 'chrome://tombfix/skin/empty.png';
        }
      }

      elmUsers.refreshing = false;
    });
  });

  elmUsers.addEventListener('select', () => {
    let item = elmUsers.selectedItem;

    if (item) {
      elmLogin.disabled = item.disabled;
    }
  });

  win.addEventListener('load', () => {
    elmModels.selectedIndex = 0;
  });

  win.addEventListener('dialogaccept', () => {
    let item = elmUsers.selectedItem;

    Models[elmModels.value].login(item.label, item.value);
  });
}(window, document));
