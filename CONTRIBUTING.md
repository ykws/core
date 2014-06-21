# Issueについて

不具合の報告時には、以下の情報を記載して頂けると原因を特定しやすくなります。

1. Tombfixのバージョン
2. Firefoxのバージョン
3. OS
4. 新規プロファイルでの状況
5. インストールしているパッチ
6. サードパーティCookieを拒否しているか([参考](https://support.mozilla.org/ja/kb/disable-third-party-cookies))
7. インストールしている拡張機能(アドオン)

可能な限り新規プロファイルで不具合が発生するかどうかを確認するようお願いします(新規プロファイルの作成方法については[こちら](https://support.mozilla.org/ja/kb/profile-manager-create-and-remove-firefox-profiles)が参考になります)。新規プロファイルのデフォルトの設定でも発生する不具合であれば、5~7の情報は省略できます。  
様々な変更が行われている常用のプロファイルでの不具合は原因の特定が難しい為、なるべく多くの情報が記載されている方が望ましいです。

機能などの要望については、それが必要とされる具体的な理由などを記載して頂けるとありがたいです。

いずれの場合にも、既に問題が報告されていないかどうかを確認すると良いでしょう。

# Pull Requestについて

現在、[Gruntfile.js](https://github.com/tombfix/core/blob/master/Gruntfile.js)でコメントアウトされているファイル以外への変更は、[.jshintrc](https://github.com/tombfix/core/blob/master/.jshintrc)と[.jscsrc](https://github.com/tombfix/core/blob/master/.jscsrc)に従い、[Travis CI](https://travis-ci.org/tombfix/core)上でJSHintとJSCSにより構文チェックされます。  
Pull Requestをなさる際は、Travis CIのチェックを通る(All is well)ようお願いします。
