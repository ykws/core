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

  let isObject = function isObject(target) {
    return typeof target === 'object' && target !== null;
  };
  let isFunction = function isFunction(target) {
    return typeof target === 'function';
  };

  assert(isObject(Ci));
  assert(isObject(Cc));
  assert(isObject(Cr));
  assert(isObject(Cu));

  assert(isObject(console));

  assert(isObject(Services));
  assert(isObject(XPCOMUtils));
  assert(isFunction(Preferences));

  assert(isObject(AppInfo));
  assert(isObject(DirectoryService));
  assert(isObject(IOService));
  assert(isObject(WindowMediator));
  assert(isObject(PromptService));
  assert(isObject(CookieManager));
  assert(isObject(LoginManager));
  assert(isObject(StringBundleService));
  assert(isObject(ObserverService));
  assert(isObject(ThreadManager));
  assert(isObject(DOMStorageManager));
  assert(isObject(ScriptSecurityManager));
  assert(isObject(CategoryManager));

  assert(Array.isArray(INTERFACES));

  assert(isFunction(createConstructor));

  assert(isFunction(WebBrowserPersist));
  assert(isFunction(HTMLFormatConverter));
  assert(isFunction(Process));
  assert(isFunction(FilePicker));
  assert(isFunction(FileInputStream));
  assert(isFunction(FileOutputStream));
  assert(isFunction(CryptoHash));
  assert(isFunction(InputStream));
  assert(isFunction(HTMLCopyEncoder));
  assert(isFunction(LocalFile));
  assert(isFunction(BinaryInputStream));

  assert(isFunction(SupportsString));
  assert(isFunction(ConverterInputStream));
  assert(isFunction(BufferedInputStream));
  assert(isFunction(StringInputStream));
  assert(isFunction(UnicodeConverter));
  assert(isFunction(MIMEInputStream));
  assert(isFunction(MultiplexInputStream));

  assert(isObject(IWebProgressListener));
  assert(isObject(IFile));
  assert(isObject(ILocalFile));
  assert(isObject(IURI));
  assert(isObject(IInputStream));
  assert(isObject(IHttpChannel));

  assert(isObject(AtomService));
  assert(isObject(AlertsService));
  assert(isObject(NavBookmarksService));
  assert(isObject(NavHistoryService));
  assert(isObject(AnnotationService));
  assert(isObject(ClipboardHelper));
  assert(isObject(MIMEService));
  assert(isObject(TextToSubURI));
  assert(isObject(ChromeRegistry));

  console.log([
    `${createURI(Components.stack.filename).fileName}'s ${assert.count} tests:`,
    `  * pass: ${assert.passed}`,
    `  * fail: ${assert.failed}`
  ].join('\n'));
}
