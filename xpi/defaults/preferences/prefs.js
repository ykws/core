/* jshint maxlen: false */
/* global pref */

// "Post Config"
pref('extensions.tombfix.postConfig', '{"Tumblr":{"regular":"default","photo":"default","quote":"default","link":"default","video":"default","conversation":"default","favorite":"default"},"FriendFeed":{"regular":"disabled","photo":"enabled","quote":"disabled","link":"enabled","video":"disabled","conversation":"disabled"},"Pinterest":{"photo":"enabled","video":"enabled"},"FFFFOUND":{"photo":"disabled","favorite":"disabled"},"Flickr":{"photo":"enabled","favorite":"disabled"},"WeHeartIt":{"photo":"enabled","favorite":"enabled"},"Gyazo":{"photo":"enabled"},"Local":{"regular":"disabled","photo":"disabled","quote":"disabled","link":"disabled"},"Dropmark":{"regular":"enabled","photo":"enabled","quote":"enabled","link":"enabled","video":"disabled","conversation":"disabled"},"Twitter":{"regular":"enabled","photo":"disabled","quote":"disabled","link":"disabled","video":"disabled","conversation":"disabled","favorite":"enabled"},"Plurk":{"regular":"enabled","photo":"enabled","quote":"disabled","link":"enabled","video":"enabled","conversation":"disabled"},"GoogleBookmarks":{"photo":"disabled","quote":"disabled","link":"enabled","video":"disabled","conversation":"disabled"},"GoogleCalendar":{"regular":"enabled","link":"disabled"},"Evernote":{"regular":"enabled","quote":"enabled","link":"enabled","video":"disabled","conversation":"disabled"},"Pinboard":{"photo":"disabled","quote":"disabled","link":"enabled","video":"disabled","conversation":"disabled"},"Delicious":{"photo":"disabled","quote":"disabled","link":"enabled","video":"disabled","conversation":"disabled"},"StumbleUpon":{"photo":"disabled","quote":"disabled","link":"enabled","video":"disabled","conversation":"disabled"},"FirefoxBookmark":{"link":"enabled"},"Pocket":{"quote":"enabled","link":"enabled"},"Instapaper":{"quote":"disabled","link":"enabled"},"Readability":{"link":"enabled"},"Remember The Milk":{"regular":"enabled","link":"disabled"},"YahooBookmarks":{"photo":"disabled","quote":"disabled","link":"enabled","video":"disabled","conversation":"disabled"},"HatenaFotolife":{"photo":"enabled"},"HatenaBookmark":{"photo":"disabled","quote":"disabled","link":"enabled","video":"disabled","conversation":"disabled"},"HatenaDiary":{"regular":"enabled","photo":"disabled","quote":"disabled","link":"disabled"},"HatenaStar":{"photo":"disabled","quote":"disabled","link":"disabled","video":"disabled","conversation":"disabled"},"MediaMarker":{"photo":"disabled","quote":"disabled","link":"disabled","video":"disabled","conversation":"disabled"},"LibraryThing":{"link":"disabled"}}');

// "Post"
pref('extensions.tombfix.accesskey.share', 'J');
pref('extensions.tombfix.contextMenu.top', false);
pref('extensions.tombfix.contextMenu.disableMenuShare', false);
pref('extensions.tombfix.shortcutkey.quickPost.link', '');
pref('extensions.tombfix.shortcutkey.quickPost.regular', '');
pref('extensions.tombfix.shortcutkey.checkAndPost', '');
pref('extensions.tombfix.tagProvider', '');
pref('extensions.tombfix.tagAutoComplete', true);
pref('extensions.tombfix.ignoreError', '');

// "Services"
pref('extensions.tombfix.model.tumblr.queue', false);
pref('extensions.tombfix.model.tumblr.trimReblogInfo', false);
pref('extensions.tombfix.model.tumblr.appendContentSource', true);
pref('extensions.tombfix.extractor.photo.flickr.limitSize', '');
pref('extensions.tombfix.model.twitter.showTweetLength', false);
pref('extensions.tombfix.model.twitter.truncateStatus', false);
pref('extensions.tombfix.model.twitter.template.prefix', '');
pref('extensions.tombfix.model.twitter.template', '');

// "Entry Contents / etc."
pref('extensions.tombfix.amazonAffiliateId', '');
pref('extensions.tombfix.thumbnailTemplate', '');
pref('extensions.tombfix.disableAllScripts', false);
pref('extensions.tombfix.dataDir', '{ProfD}/tombfix');

// Localize
pref('extensions.tombfix@tombfix.github.io.description', 'chrome://tombfix/locale/extensions.properties');

// Others
pref('extensions.tombfix.ignoreCanonical', '^https?://(?:twitter\\.com|www\\.youtube\\.com|weheartit\\.com|vimeo\\.com)/');
pref('extensions.tombfix.model.evernote.clipFullPage', true);
pref('extensions.tombfix.model.gyazo.id', '');

// Debug
pref('extensions.tombfix.debug', false);
pref('extensions.tombfix.useFirebug', true);
