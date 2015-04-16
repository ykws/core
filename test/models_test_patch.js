{
  let assert = function assert(...args) {
    if (assert.count == null) {
      assert.count = assert.passed = assert.failed = 0;
    }

    assert.count += 1;

    let [target, val] = args.concat(true);

    if (target === val) {
      assert.passed += 1;
    } else {
      assert.failed += 1;

      console.log(target, val);
      console.trace();
    }
  };

  assert(typeof Models, 'object');
  assert(typeof models, 'object');
  assert(Models, models);
  assert(Models instanceof Repository);
  assert(Object.getPrototypeOf(Models) !== Repository.prototype);
  assert(Object.keys(Models).length, Models.values.length);


  assert(Models.check !== Repository.prototype.check);
  assert(Array.isArray(Models.check({type : 'photo'})));
  assert(Models.check({type : 'photo'}).length !== 0);
  assert(Models.check({type : 'photo'}).length, Repository.prototype.check.call(Models, {type : 'photo'}).length);
  assert(Models.check({type : 'photo', favorite : {name : 'Tumblr'}}).length, Repository.prototype.check.call(Models, {type : 'photo', favorite : {name : 'Tumblr'}}).length);
  assert(Models.check({type : 'photo', favorite : {name : 'Test'}}).length, Repository.prototype.check.call(Models, {type : 'photo', favorite : {name : 'Test'}}).length);
  assert(Models.check({type : 'photo'}).length, Models.check({type : 'photo', favorite : {name : 'Tumblr'}}).length);
  assert(Models.check({type : 'photo'}).length, Models.check({type : 'photo', favorite : {name : 'Test'}}).length);
  assert(Models.check({type : 'photo'}).length !== Models.check({type : 'reblog', favorite : {name : 'Tumblr'}}).length);
  assert(Models.check({type : 'reblog', favorite : {name : 'Tumblr'}}).length !== Repository.prototype.check.call(Models, {type : 'reblog', favorite : {name : 'Tumblr'}}).length);
  assert(Models.check({type : 'reblog', favorite : {name : 'Tumblr'}}).length, 1);
  assert(Models.check({type : 'reblog', favorite : {name : 'Test'}}).length, 0);

  Models.register(Object.assign({}, Tumblr, {
    name : 'Tumblr - test'
  }), 'Tumblr', true);

  assert(Models.check({type : 'reblog', favorite : {name : 'Tumblr'}}).length, 2);

  delete Models['Tumblr - test'];


  assert(Array.isArray(Models.getDefaults({type : 'photo'})));
  assert(Models.getDefaults({type : 'photo'}).length !== 0);
  assert(Models.getDefaults({type : 'photo'}).length, 1);
  assert(Models.getDefaults({type : 'photo', favorite : {name : 'Tumblr'}}).length, 1);
  assert(Models.getDefaults({type : 'photo'}).length, Models.getDefaults({type : 'photo', favorite : {name : 'Tumblr'}}).length);
  assert(Models.getDefaults({type : 'reblog', favorite : {name : 'Tumblr'}}).length, 1);
  assert(Models.getDefaults({type : 'reblog', favorite : {name : 'Test'}}).length, 0);

  setPref('postConfig', '{}');
  Models.register(Object.assign({}, Tumblr, {
    name   : 'Tumblr - test'
  }), 'Tumblr', true);

  assert(Models.getDefaults({type : 'photo'}).length, 0);
  assert(Models.getDefaults({type : 'photo', favorite : {name : 'Tumblr'}}).length, 0);

  setPref('postConfig', '{"Tumblr":{"regular":"enabled","photo":"enabled","quote":"enabled","link":"enabled","video":"enabled","conversation":"enabled","favorite":"default"}}');

  assert(Models.getDefaults({type : 'photo'}).length, 0);
  assert(Models.getDefaults({type : 'photo', favorite : {name : 'Tumblr'}}).length, 1);
  assert(Models.getDefaults({type : 'reblog', favorite : {name : 'Tumblr'}}).length, 1);

  setPref('postConfig', '{"Tumblr - test":{"regular":"enabled","photo":"enabled","quote":"enabled","link":"enabled","video":"enabled","conversation":"enabled","favorite":"default"}}');

  assert(Models.getDefaults({type : 'photo'}).length, 0);
  assert(Models.getDefaults({type : 'photo', favorite : {name : 'Tumblr'}}).length, 1);
  assert(Models.getDefaults({type : 'reblog', favorite : {name : 'Tumblr'}}).length, 1);

  delete Models['Tumblr - test'];
  Preferences.reset('extensions.tombfix.postConfig');

  {
    assert(Array.isArray(Models.getEnables({type : 'photo'})));

    let enablesLen = Models.getEnables({type : 'photo'}).length;

    assert(enablesLen !== 0);
    assert(enablesLen < Models.check({type : 'photo'}).length);
    assert(enablesLen > Models.getDefaults({type : 'photo'}).length);

    Models.register(Object.assign({}, Tumblr, {
      name   : 'Tumblr - test',
      config : void 0
    }), 'Tumblr', true);

    assert(Models['Tumblr - test'].config, void 0);
    assert(Models.getEnables({type : 'photo'}).length, enablesLen + 1);
    assert(Models['Tumblr - test'].config.photo, '');

    delete Models['Tumblr - test'];

    Models.register(Object.assign({}, Tumblr, {
      name   : 'Tumblr - test',
      config : {
        photo : 'default'
      }
    }), 'Tumblr', true);

    assert(Models.getEnables({type : 'photo'}).length, enablesLen + 1);
    assert(Models['Tumblr - test'].config.photo, '');

    delete Models['Tumblr - test'];

    Models.register(Object.assign({}, Tumblr, {
      name   : 'Tumblr - test',
      config : {
        photo : 'disabled'
      }
    }), 'Tumblr', true);

    assert(Models.getEnables({type : 'photo'}).length, enablesLen + 1);
    assert(Models['Tumblr - test'].config.photo, '');

    delete Models['Tumblr - test'];

    setPref('postConfig', '{}');
    Models.register(Object.assign({}, Tumblr, {
      name   : 'Tumblr - test'
    }), 'Tumblr', true);

    assert(Models.getEnables({type : 'photo'}).length, Models.check({type : 'photo'}).length);
    assert(Models.getEnables({type : 'photo', favorite : {name : 'Tumblr'}}).length, Models.check({type : 'photo', favorite : {name : 'Tumblr'}}).length);

    setPref('postConfig', '{"Tumblr":{"regular":"enabled","photo":"enabled","quote":"enabled","link":"enabled","video":"enabled","conversation":"enabled","favorite":"disabled"}}');

    assert(Models.getEnables({type : 'photo'}).length, Models.check({type : 'photo'}).length);
    assert(Models.getEnables({type : 'photo', favorite : {name : 'Tumblr'}}).length, Models.check({type : 'photo', favorite : {name : 'Tumblr'}}).length - 1);
    assert(Models.getEnables({type : 'reblog', favorite : {name : 'Tumblr'}}).length, 1);

    setPref('postConfig', '{"Tumblr - test":{"regular":"enabled","photo":"enabled","quote":"enabled","link":"enabled","video":"enabled","conversation":"enabled","favorite":"disabled"}}');

    assert(Models.getEnables({type : 'photo'}).length, Models.check({type : 'photo'}).length);
    assert(Models.getEnables({type : 'photo', favorite : {name : 'Tumblr'}}).length, Models.check({type : 'photo', favorite : {name : 'Tumblr'}}).length - 1);
    assert(Models.getEnables({type : 'reblog', favorite : {name : 'Tumblr'}}).length, 1);

    setPref('postConfig', '{"Tumblr":{"regular":"disabled","photo":"disabled","quote":"disabled","link":"disabled","video":"disabled","conversation":"disabled","favorite":"default"}}');

    assert(Models.getEnables({type : 'photo'}).length, Models.check({type : 'photo'}).length - 1);
    assert(Models.getEnables({type : 'photo', favorite : {name : 'Tumblr'}}).length, Models.check({type : 'photo', favorite : {name : 'Tumblr'}}).length);
    assert(Models.getEnables({type : 'reblog', favorite : {name : 'Tumblr'}}).length, 2);

    setPref('postConfig', '{"Tumblr - test":{"regular":"disabled","photo":"disabled","quote":"disabled","link":"disabled","video":"disabled","conversation":"disabled","favorite":"default"}}');

    assert(Models.getEnables({type : 'photo'}).length, Models.check({type : 'photo'}).length - 1);
    assert(Models.getEnables({type : 'photo', favorite : {name : 'Tumblr'}}).length, Models.check({type : 'photo', favorite : {name : 'Tumblr'}}).length);
    assert(Models.getEnables({type : 'reblog', favorite : {name : 'Tumblr'}}).length, 2);

    delete Models['Tumblr - test'];
    Preferences.reset('extensions.tombfix.postConfig');
  }

  {
    let _alert = alert,
        _openOptions = openOptions;

    alert = function alert(message) {
      assert(message, getMessage('message.options.postConfig.recovery'));
    };
    openOptions = function openOptions(messageName) {
      assert(messageName, 'message.options.postConfig.recovery');
    };

    Preferences.reset('extensions.tombfix.postConfig');

    let defaultConfig = JSON.stringify(JSON.parse(getPref('postConfig')));

    setPref('postConfig', '');

    assert(JSON.stringify(Models.getModelsConfig()), defaultConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), defaultConfig);

    setPref('postConfig', 'hoge');

    assert(JSON.stringify(Models.getModelsConfig()), defaultConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), defaultConfig);

/*
    setPref('postConfig', false);

    assert(JSON.stringify(Models.getModelsConfig()), defaultConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), defaultConfig);

    setPref('postConfig', true);

    assert(JSON.stringify(Models.getModelsConfig()), defaultConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), defaultConfig);

    setPref('postConfig', 0);

    assert(JSON.stringify(Models.getModelsConfig()), defaultConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), defaultConfig);

    setPref('postConfig', 1);

    assert(JSON.stringify(Models.getModelsConfig()), defaultConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), defaultConfig);
*/

    setPref('postConfig', '"hoge"');

    assert(JSON.stringify(Models.getModelsConfig()), defaultConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), defaultConfig);

    setPref('postConfig', '[]');

    assert(JSON.stringify(Models.getModelsConfig()), defaultConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), defaultConfig);

    Preferences.reset('extensions.tombfix.postConfig');

    assert(JSON.stringify(Models.getModelsConfig()), defaultConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), defaultConfig);

    let sampleConfig = '{"Tumblr":{"regular":"enabled","photo":"enabled","quote":"enabled","link":"enabled","video":"enabled","conversation":"enabled","favorite":"enabled"}}';

    setPref('postConfig', sampleConfig);

    assert(JSON.stringify(Models.getModelsConfig()), sampleConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), sampleConfig);

    setPref('postConfig', '{}');

    assert(JSON.stringify(Models.getModelsConfig()), '{}');
    assert(JSON.stringify(Models.getModelsConfig(true)), '{}');

    setPref('postConfig', defaultConfig);

    assert(JSON.stringify(Models.getModelsConfig()), defaultConfig);
    assert(JSON.stringify(Models.getModelsConfig(true)), defaultConfig);

    Services.prefs.deleteBranch('extensions.tombfix.postConfig');

    assert(JSON.stringify(Models.getModelsConfig()), '{}');
    assert(JSON.stringify(Models.getModelsConfig(true)), '{}');

    Preferences.reset('extensions.tombfix.postConfig');

    assert(JSON.stringify(Models.getModelsConfig()), '{}');
    assert(JSON.stringify(Models.getModelsConfig(true)), '{}');

    setPref('postConfig', 'hoge');

    assert(JSON.stringify(Models.getModelsConfig()), '{}');
    assert(JSON.stringify(Models.getModelsConfig(true)), '{}');

    setPref('postConfig', defaultConfig);

    alert = _alert;
    openOptions = _openOptions;
  }

  {
    let modelsConfig = JSON.parse(getPref('postConfig'));

    assert(Models.getPostConfig(modelsConfig, 'Tumblr', {type : 'photo'}), 'default');
    assert(Models.getPostConfig(modelsConfig, 'Tumblr', {type : 'photo', favorite : {name : 'Tumblr'}}), 'default');
    assert(Models.getPostConfig(modelsConfig, 'Tumblr', {type : 'reblog', favorite : {name : 'Tumblr'}}), 'default');
    assert(Models.getPostConfig(modelsConfig, 'Tumblr', {type : 'photo'}), modelsConfig.Tumblr.photo);
    assert(Models.getPostConfig(modelsConfig, 'Tumblr', {type : 'photo', favorite : {name : 'Tumblr'}}), modelsConfig.Tumblr.favorite);
    assert(Models.getPostConfig(modelsConfig, 'Flickr', {type : 'photo'}), 'enabled');
    assert(Models.getPostConfig(modelsConfig, 'Flickr', {type : 'photo', favorite : {name : 'Tumblr'}}), 'enabled');
    assert(Models.getPostConfig(modelsConfig, 'Flickr', {type : 'photo'}), modelsConfig.Flickr.photo);
    assert(Models.getPostConfig(modelsConfig, 'Flickr', {type : 'photo', favorite : {name : 'Tumblr'}}), modelsConfig.Flickr.photo);
    assert(Models.getPostConfig(modelsConfig, 'HatenaBookmark', {type : 'photo'}), 'disabled');
    assert(Models.getPostConfig(modelsConfig, 'HatenaBookmark', {type : 'photo', favorite : {name : 'Tumblr'}}), 'disabled');
    assert(Models.getPostConfig(modelsConfig, 'HatenaBookmark', {type : 'photo'}), modelsConfig.HatenaBookmark.photo);
    assert(Models.getPostConfig(modelsConfig, 'HatenaBookmark', {type : 'photo', favorite : {name : 'Tumblr'}}), modelsConfig.HatenaBookmark.photo);
    assert(Models.getPostConfig(modelsConfig, 'GoogleCalendar', {type : 'photo'}), '');
    assert(Models.getPostConfig(modelsConfig, 'GoogleCalendar', {type : 'photo', favorite : {name : 'Tumblr'}}), '');
    assert(Models.getPostConfig(modelsConfig, 'GoogleCalendar', {type : 'photo'}) !== modelsConfig.GoogleCalendar.photo);
    assert(Models.getPostConfig(modelsConfig, 'GoogleCalendar', {type : 'photo', favorite : {name : 'Tumblr'}}) !== modelsConfig.GoogleCalendar.photo);
    assert(Models.getPostConfig(modelsConfig, 'Test', {type : 'photo'}), '');
    assert(Models.getPostConfig(modelsConfig, 'Test', {type : 'photo', favorite : {name : 'Tumblr'}}), '');
    assert(Models.getPostConfig(modelsConfig, 'Tumblr', {type : 'reblog'}), '');
    assert(Models.getPostConfig({}, 'Tumblr', {type : 'photo'}), '');

    modelsConfig.Tumblr.favorite = 'enabled';

    assert(Models.getPostConfig(modelsConfig, 'Tumblr', {type : 'photo'}), 'default');
    assert(Models.getPostConfig(modelsConfig, 'Tumblr', {type : 'photo', favorite : {name : 'Tumblr'}}), 'enabled');
    assert(Models.getPostConfig(modelsConfig, 'Tumblr', {type : 'photo', favorite : {name : 'Flickr'}}), 'default');

    modelsConfig['Tumblr - test'] = {
      photo    : 'default',
      favorite : 'default'
    };

    assert(Models.getPostConfig(modelsConfig, 'Tumblr - test', {type : 'photo'}), 'default');
    assert(Models.getPostConfig(modelsConfig, 'Tumblr - test', {type : 'photo', favorite : {name : 'Tumblr'}}), 'default');

    modelsConfig['Tumblr - test'].favorite = 'enabled';

    assert(Models.getPostConfig(modelsConfig, 'Tumblr - test', {type : 'photo'}), 'default');
    assert(Models.getPostConfig(modelsConfig, 'Tumblr - test', {type : 'photo', favorite : {name : 'Tumblr'}}), 'enabled');
  }

  console.log([
    `${createURI(Components.stack.filename).fileName}'s ${assert.count} tests:`,
    `  * pass: ${assert.passed}`,
    `  * fail: ${assert.failed}`
  ].join('\n'));
}
