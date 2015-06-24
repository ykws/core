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

  let prefix = getPref('model.twitter.template.prefix'),
      template = getPref('model.twitter.template'),
      truncateStatus = getPref('model.twitter.truncateStatus');

  setPref('model.twitter.template.prefix', '');
  setPref('model.twitter.template', '');
  setPref('model.twitter.truncateStatus', false);

  // Text
  assert(Twitter.createStatus({
    type        : 'regular',
    item        : 'hoge',
    itemUrl     : undefined,
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['fuga'],
    description : 'foobar'
  }), 'foobar hoge #fuga');
  assert(Twitter.createStatus({
    type        : 'regular',
    item        : '',
    itemUrl     : undefined,
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    description : 'hoge'
  }), 'hoge');
  // Photo
  assert(Twitter.createStatus({
    type        : 'photo',
    item        : 'Google',
    itemUrl     : 'https://www.google.co.jp/images/srpr/logo11w.png',
    page        : 'Google',
    pageUrl     : 'https://www.google.co.jp/',
    tags        : ['hoge'],
    description : 'fuga'
  }), 'fuga Google https://www.google.co.jp/ #hoge');
  assert(Twitter.createStatus({
    type        : 'photo',
    item        : 'Google',
    itemUrl     : 'https://www.google.co.jp/images/srpr/logo11w.png',
    page        : 'Google',
    pageUrl     : 'https://www.google.co.jp/',
    description : ''
  }), 'Google https://www.google.co.jp/');
  // Photo(Capture)
  assert(Twitter.createStatus({
    type        : 'photo',
    item        : 'Tombfix',
    itemUrl     : undefined,
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge'],
    description : 'fuga',
    file        : {}
  }), 'fuga Tombfix http://tombfix.github.io/ #hoge');
  assert(Twitter.createStatus({
    type        : 'photo',
    item        : 'Tombfix',
    itemUrl     : undefined,
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    description : '',
    file        : {}
  }), 'Tombfix http://tombfix.github.io/');
  // Quote
  assert(Twitter.createStatus({
    type        : 'quote',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    body        : ((str) => {
      str.flavors = { html : 'Tombfix' };
      return str;
    })(new String('Tombfix')),
    tags        : ['hoge'],
    description : 'fuga'
  }), 'fuga "Tombfix" Tombfix http://tombfix.github.io/ #hoge');
  assert(Twitter.createStatus({
    type        : 'quote',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    body        : ((str) => {
      str.flavors = { html : 'Tombfix' };
      return str;
    })(new String('Tombfix'))
  }), '"Tombfix" Tombfix http://tombfix.github.io/');
  // Link
  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge'],
    description : 'fuga'
  }), 'fuga Tombfix http://tombfix.github.io/ #hoge');
  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/'
  }), 'Tombfix http://tombfix.github.io/');
  // Chat
  assert(Twitter.createStatus({
    type        : 'conversation',
    item        : 'test1',
    itemUrl     : 'http://tsuyuhara.tumblr.com/post/70206435185',
    page        : '† - test1',
    pageUrl     : 'http://tsuyuhara.tumblr.com/post/70206435185',
    body        : 'syoichi: test2',
    tags        : ['hoge'],
    description : 'fuga',
    favorite    : {
      name     : 'Tumblr',
      endpoint : 'http://www.tumblr.com/reblog/70206435185/rQGsSyZi',
      form     : {}
    }
  }), 'fuga "syoichi: test2" test1 http://tsuyuhara.tumblr.com/post/70206435185 #hoge');
  assert(Twitter.createStatus({
    type        : 'conversation',
    item        : 'test1',
    itemUrl     : 'http://tsuyuhara.tumblr.com/post/70206435185',
    page        : '† - test1',
    pageUrl     : 'http://tsuyuhara.tumblr.com/post/70206435185',
    body        : 'syoichi: test2',
    favorite    : {
      name     : 'Tumblr',
      endpoint : 'http://www.tumblr.com/reblog/70206435185/rQGsSyZi',
      form     : {}
    }
  }), '"syoichi: test2" test1 http://tsuyuhara.tumblr.com/post/70206435185');
  // Video
  assert(Twitter.createStatus({
    type        : 'video',
    item        : 'Google Chrome: Hatsune Miku (初音ミク)',
    itemUrl     : 'http://www.youtube.com/watch?v=MGt25mv4-2Q',
    page        : 'Google Chrome: Hatsune Miku (初音ミク) - YouTube',
    pageUrl     : 'http://www.youtube.com/watch?v=MGt25mv4-2Q',
    tags        : ['hoge'],
    description : 'fuga',
    author      : 'GoogleChromeJapan',
    authorUrl   : 'http://www.youtube.com/user/GoogleChromeJapan'
  }), 'fuga Google Chrome: Hatsune Miku (初音ミク) http://www.youtube.com/watch?v=MGt25mv4-2Q #hoge');
  assert(Twitter.createStatus({
    type        : 'video',
    item        : 'Google Chrome: Hatsune Miku (初音ミク)',
    itemUrl     : 'http://www.youtube.com/watch?v=MGt25mv4-2Q',
    page        : 'Google Chrome: Hatsune Miku (初音ミク) - YouTube',
    pageUrl     : 'http://www.youtube.com/watch?v=MGt25mv4-2Q',
    author      : 'GoogleChromeJapan',
    authorUrl   : 'http://www.youtube.com/user/GoogleChromeJapan'
  }), 'Google Chrome: Hatsune Miku (初音ミク) http://www.youtube.com/watch?v=MGt25mv4-2Q');

  // Edge Case
  assert(Twitter.createStatus({
    type        : 'quote',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    body        : ' '
  }), 'Tombfix http://tombfix.github.io/');
  assert(Twitter.createStatus({
    type        : 'quote',
    item        : '',
    itemUrl     : 'http://tsuyuhara.tumblr.com/post/71963590605',
    page        : '† - test',
    pageUrl     : 'http://tsuyuhara.tumblr.com/post/71963590605',
    body        : [
      '<p><a href="http://tsuyuhara.tumblr.com/post/71963590605" class="tumblr_blog">',
      'tsuyuhara</a>:</p>\n\n<blockquote><p>test</p></blockquote>\n\n<p></p>'
    ].join(''),
    favorite    : {
      name     : 'Tumblr',
      endpoint : 'http://www.tumblr.com/reblog/71963590605/PrNB53Jd',
      form     : {}
    }
  }), '"tsuyuhara:\n\ntest" http://tsuyuhara.tumblr.com/post/71963590605');

  // prefix
  setPref('model.twitter.template.prefix', '見てる:');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/'
  }), '見てる: Tombfix http://tombfix.github.io/');
  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : 'hoge'
  }), 'hoge Tombfix http://tombfix.github.io/');

  setPref('model.twitter.template.prefix', '');

  // template
  setPref('model.twitter.template', '%desc% %quote% %title% %url%%br%%tags% [via Template]');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge'],
    description : 'fuga'
  }), 'fuga Tombfix http://tombfix.github.io/\n#hoge [via Template]');
  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/'
  }), 'Tombfix http://tombfix.github.io/\n[via Template]');
  assert(Twitter.createStatus({
    type        : 'regular',
    item        : 'hoge',
    itemUrl     : undefined,
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['fuga'],
    description : 'foobar'
  }), 'foobar hoge\n#fuga [via Template]');
  assert(Twitter.createStatus({
    type        : 'regular',
    item        : '',
    itemUrl     : undefined,
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    description : 'hoge'
  }), 'hoge\n[via Template]');

  setPref('model.twitter.template', '%quote% %title% %url% %desc%');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge'],
    description : 'fuga'
  }), 'Tombfix http://tombfix.github.io/ fuga');
  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/'
  }), 'Tombfix http://tombfix.github.io/');

  setPref('model.twitter.template', '%desc% %url%');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : 'hoge'
  }), 'hoge http://tombfix.github.io/');
  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/'
  }), 'http://tombfix.github.io/');

  setPref('model.twitter.template', '%title%%br%%url%%br%%tags%');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge'],
    description : 'fuga'
  }), 'Tombfix\nhttp://tombfix.github.io/\n#hoge');
  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/'
  }), 'Tombfix\nhttp://tombfix.github.io/');

  setPref('model.twitter.template', '%br%%url%%br%');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/'
  }), 'http://tombfix.github.io/');

  setPref('model.twitter.template', '%title%%br%  %url%  %br%%tags%');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge'],
    description : 'fuga'
  }), 'Tombfix\nhttp://tombfix.github.io/\n#hoge');

  setPref('model.twitter.template', '%title%%br%%url%  %desc%%br%%tags%');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge'],
    description : 'fuga'
  }), 'Tombfix\nhttp://tombfix.github.io/ fuga\n#hoge');

  setPref('model.twitter.template', '  %title%%br%  %url%  %desc%  %br%%tags%  ');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge'],
    description : 'fuga'
  }), 'Tombfix\nhttp://tombfix.github.io/ fuga\n#hoge');

  setPref('model.twitter.template', '');

  // prefix + template
  setPref('model.twitter.template.prefix', '見てる:');
  setPref('model.twitter.template', '%desc% %quote% %title% %url%%br%%tags% [via Template]');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge'],
    description : 'fuga'
  }), 'fuga Tombfix http://tombfix.github.io/\n#hoge [via Template]');
  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/'
  }), '見てる: Tombfix http://tombfix.github.io/\n[via Template]');

  setPref('model.twitter.template.prefix', '%title%');
  setPref('model.twitter.template', '%desc% %url%%br%%tags%');

  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge'],
    description : 'fuga'
  }), 'fuga http://tombfix.github.io/\n#hoge');
  assert(Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/'
  }), 'Tombfix http://tombfix.github.io/');

  setPref('model.twitter.template.prefix', '');
  setPref('model.twitter.template', '');

  // truncateStatus
  setPref('model.twitter.truncateStatus', true);

  assert(Twitter.getTweetLength([
    'abc 123 テスト 𠮷野家 𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷\n',
    'tombfix.github.io http://tombfix.github.io/ ',
    'http://tombfix.github.io/a0b2739c3045b3d95ca8da051fc411b0028b7925bd2' +
      '00899b780138ab91e3eafa2d76efe6f571347cb23e70cf6e2e7dbe26da70e510' +
      'c218772514cbb ',
    'https://twitter.com/ http://www.youtube.com/watch?v=MGt25mv4-2Q#t=1'
  ].join('')), Twitter.STATUS_MAX_LENGTH);

  let str = '𠮷'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 1);
  let tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  // require Firefox 27+
  str = '𠮷'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    [...str].slice(0, -2).join(''),
    '… http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH + 1);

  assert(str.length > Twitter.STATUS_MAX_LENGTH);
  assert(Twitter.createStatus({
    type        : 'regular',
    item        : '',
    itemUrl     : undefined,
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    description : str
  }), str);

  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 2),
    '… http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 42);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge', 'fuga', 'piyo', 'poyo', 'foo', 'bar'],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 4);
  assert(tweet, [
    str,
    ' Tombfix http://tombfix.github.io/ #hoge #fuga #piyo #poyo #foo'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 9);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge', 'fuga', 'piyo', 'poyo', 'foo', 'bar'],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' Tombfix http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 8);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge', 'fuga', 'piyo', 'poyo', 'foo', 'bar'],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' Tombf… http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 4);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge', 'fuga', 'piyo', 'poyo', 'foo', 'bar'],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' T… http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 3);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge', 'fuga', 'piyo', 'poyo', 'foo', 'bar'],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 2);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 2);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge', 'fuga', 'piyo', 'poyo', 'foo', 'bar'],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 1);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 1);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge', 'fuga', 'piyo', 'poyo', 'foo', 'bar'],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge', 'fuga', 'piyo', 'poyo', 'foo', 'bar'],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str.slice(0, -2),
    '… http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 11);
  tweet = Twitter.createStatus({
    type        : 'quote',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    body        : ((str) => {
      str.flavors = { html : 'Tombfix' };
      return str;
    })(new String('Tombfix')),
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' "Tombfix" http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 10);
  tweet = Twitter.createStatus({
    type        : 'quote',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    body        : ((str) => {
      str.flavors = { html : 'Tombfix' };
      return str;
    })(new String('Tombfix')),
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' "Tombf…" http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 6);
  tweet = Twitter.createStatus({
    type        : 'quote',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    body        : ((str) => {
      str.flavors = { html : 'Tombfix' };
      return str;
    })(new String('Tombfix')),
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' "T…" http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 5);
  tweet = Twitter.createStatus({
    type        : 'quote',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    body        : ((str) => {
      str.flavors = { html : 'Tombfix' };
      return str;
    })(new String('Tombfix')),
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 4);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = [
    'http://tombfix.github.io/ ',
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 2)
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = [
    'http://tombfix.github.io/ ',
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 1)
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str.slice(0, -2),
    '… http://tombfix.github.io/'
  ].join(''));

  str = [
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 2),
    ' http://tombfix.github.io/'
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = [
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 1),
    ' '
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['hoge', 'fuga', 'piyo', 'poyo', 'foo', 'bar'],
    description : str + 'http://tombfix.github.io/'
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 20);
  assert(tweet, [
    str,
    '… http://tombfix.github.io/'
  ].join(''));

  str = [
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 3),
    ' '
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str + 'http://tombfix.github.io/'
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    '… http://tombfix.github.io/'
  ].join(''));

  str = [
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 2),
    ' '
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str + 'http://tombfix.github.io/'
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str.slice(0, -1),
    '… http://tombfix.github.io/'
  ].join(''));

  str = [
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 4),
    ' http://tombfix.github.io/ a'
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = [
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 3),
    ' http://tombfix.github.io/ a'
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str.slice(0, -2),
    '… http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 2);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str + ' http://tombfix.github.io/ a'
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 21);
  assert(tweet, [
    str,
    ' … http://tombfix.github.io/'
  ].join(''));

  str = [
    'http://tombfix.github.io/',
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 3 - 3),
    'http://tombfix.github.io/'
  ].join(' ');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = [
    'http://tombfix.github.io/ ',
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 3 - 2)
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str + ' http://tombfix.github.io/'
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 20);
  assert(tweet, [
    str,
    ' … http://tombfix.github.io/'
  ].join(''));

  str = [
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 3 - 3),
    ' http://tombfix.github.io/ http://tombfix.github.io/'
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = [
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 3 - 2),
    ' http://tombfix.github.io/'
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str + ' http://tombfix.github.io/'
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 20);
  assert(tweet, [
    str,
    ' … http://tombfix.github.io/'
  ].join(''));

  str = [
    'a http://tombfix.github.io/',
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 3 - 7),
    'http://tombfix.github.io/ a'
  ].join(' ');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = [
    'a http://tombfix.github.io/',
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 3 - 6),
    'http://tombfix.github.io/ a'
  ].join(' ');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str.slice(0, -2),
    '… http://tombfix.github.io/'
  ].join(''));

  str = [
    'a http://tombfix.github.io/ ',
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 3 - 5),
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str + ' http://tombfix.github.io/ a'
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 21);
  assert(tweet, [
    str,
    ' … http://tombfix.github.io/'
  ].join(''));

  str = [
    'a http://tombfix.github.io/',
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 3 - 5),
    'http://tombfix.github.io/'
  ].join(' ');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = [
    'a http://tombfix.github.io/ ',
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 3 - 4)
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str + ' http://tombfix.github.io/'
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 20);
  assert(tweet, [
    str,
    ' … http://tombfix.github.io/'
  ].join(''));

  str = [
    'a http://tombfix.github.io/ ',
    'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 5)
  ].join('');
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str + ' http://tombfix.github.io/'
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    '… http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 4);
  tweet = Twitter.createStatus({
    type        : 'quote',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    body        : 'tombfix.github.io',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' "tombfix.github.io" http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 3);
  tweet = Twitter.createStatus({
    type        : 'quote',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    body        : 'tombfix.github.io',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 24);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 2);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'tombfix.github.io',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' tombfix.github.io http://tombfix.github.io/'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length * 2 - 1);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'tombfix.github.io',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : [],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 22);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/'
  ].join(''));

  // truncateStatus + prefix + template
  setPref('model.twitter.template.prefix', '見てる:');
  setPref('model.twitter.template', '%desc% %quote% %title% %url%%br%%tags% [via Template]');

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 31);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : str,
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['foo', 'bar'],
    description : ''
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    '見てる:',
    str,
    'http://tombfix.github.io/\n#foo #bar [via Template]'
  ].join(' '));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 30);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : str,
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['foo', 'bar'],
    description : ''
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH - 4);
  assert(tweet, [
    '見てる:',
    str,
    'http://tombfix.github.io/\n#foo [via Template]'
  ].join(' '));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 21);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : str,
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['foo', 'bar'],
    description : ''
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    '見てる:',
    str,
    'http://tombfix.github.io/\n[via Template]'
  ].join(' '));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 20);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : str,
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['foo', 'bar'],
    description : ''
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    '見てる:',
    str.slice(0, -2) + '…',
    'http://tombfix.github.io/\n[via Template]'
  ].join(' '));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 16);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['foo', 'bar'],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str,
    ' http://tombfix.github.io/\n[via Template]'
  ].join(''));

  str = 'a'.repeat(Twitter.STATUS_MAX_LENGTH - Twitter.OPTIONS.short_url_length - 15);
  tweet = Twitter.createStatus({
    type        : 'link',
    item        : 'Tombfix',
    itemUrl     : 'http://tombfix.github.io/',
    page        : 'Tombfix',
    pageUrl     : 'http://tombfix.github.io/',
    tags        : ['foo', 'bar'],
    description : str
  });

  assert(Twitter.getTweetLength(tweet), Twitter.STATUS_MAX_LENGTH);
  assert(tweet, [
    str.slice(0, -2),
    '… http://tombfix.github.io/\n[via Template]'
  ].join(''));

  setPref('model.twitter.template.prefix', prefix);
  setPref('model.twitter.template', template);
  setPref('model.twitter.truncateStatus', truncateStatus);

  console.log([
    `${createURI(Components.stack.filename).fileName}'s ${assert.count} tests:`,
    `  * pass: ${assert.passed}`,
    `  * fail: ${assert.failed}`
  ].join('\n'));
}
