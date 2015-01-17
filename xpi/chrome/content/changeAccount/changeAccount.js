/* global Components */

(function executeChangeAccount(win, doc) {
  'use strict';

  let env = Components.classes[
        '@tombfix.github.io/tombfix-service;1'
      ].getService().wrappedJSObject,
      {Models} = env,
      services = doc.querySelector('.services');

  for (let model of Models.values) {
    if (
      model.login && model.getCurrentUser &&
        model.getPasswords && model.getPasswords().length
    ) {
      let modelName = model.name;

      services.appendItem(modelName, modelName).setAttribute('src', model.ICON);
    }
  }

  if (!services.childElementCount) {
    win.addEventListener('load', () => {
      // load時は、まだダイアログが表示されていない
      setTimeout(() => {
        win.alert(env.getMessage('message.changeAccount.infoNotFound'));
      }, 0);
    });

    return;
  }

  let loginButton = doc.querySelector('.login-button'),
      accounts = doc.querySelector('.accounts');

  services.addEventListener('select', () => {
    loginButton.disabled = true;

    let model = Models[services.value];

    model.getCurrentUser().addBoth(result => {
      if (model.name !== services.value) {
        return;
      }

      env.clearChildren(accounts);

      let currentUser = typeof result === 'string' ? result : '';

      for (let {user, password} of model.getPasswords()) {
        let account = accounts.appendItem(user, password);

        account.classList.add('listitem-iconic');

        if (currentUser && currentUser === user) {
          account.image = 'chrome://tombfix/skin/tick.png';
          account.disabled = true;

          accounts.selectedItem = account;
        } else {
          account.image = 'chrome://tombfix/skin/empty.png';
        }
      }
    });
  });

  accounts.addEventListener('select', () => {
    let account = accounts.selectedItem;

    if (account) {
      loginButton.disabled = account.disabled;
    }
  });

  win.addEventListener('dialogaccept', () => {
    let account = accounts.selectedItem;

    Models[services.value].login(account.label, account.value);
  });

  win.addEventListener('load', () => {
    services.selectedIndex = 0;
  });
}(window, document));
