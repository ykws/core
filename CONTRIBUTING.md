# Issue について

不具合の報告については、注意すべき点が多いです。

まず、前提として、Tombfix は Firefox の状態によって挙動が左右される為、Tombfix の Web サービス側にコンテンツを投稿する機能のほとんどが、Tombfix がインストールされている Firefox でサービスのアカウントにログインしていないとサービスに投稿できない仕様となっております。  
また、そうしたサービス側にコンテンツを投稿する類の機能などの場合、サービス側がメンテナンスを行っていたり、Web ブラウザー上でサービスを閲覧できないなどの何らかの障害が発生している場合、Tombfix からサービス側にコンテンツを投稿できない場合が多いです。

上記の状況に該当しない場合には不具合を[こちら](https://github.com/tombfix/core/issues/new)から [Issues](https://github.com/tombfix/core/issues) に報告するようお願いします。  
不具合の詳細について、以下の項目に該当する場合は、それに関する情報を記載するようお願いします。

* QuickPostForm やアラートでエラーが表示された場合、それのスクリーンショットやメッセージなどを記載
* 特定のサイトで問題が発生した場合、それの URL を記載

そして、不具合の報告時には、以下の情報も記載して頂けると原因を特定しやすくなります。

1. Tombfix のバージョン
2. Firefox のバージョン
3. OS
4. Tombfix のみがインストールされた新規プロファイルでも不具合が発生するか
5. Tombfix を再インストールしても不具合が発生するか
6. インストールしているパッチ
7. サードパーティ Cookie を拒否しているか([参考 1](https://support.mozilla.org/ja/kb/disable-third-party-cookies)、[参考 2](https://github.com/tombfix/core/issues/196))
8. インストールしている拡張機能(アドオン)

可能な限り新規プロファイルでも不具合が発生するかどうかを確認するようお願いします(新規プロファイルの作成方法については[こちら](https://support.mozilla.org/ja/kb/profile-manager-create-and-remove-firefox-profiles)が参考になります)。新規プロファイルのデフォルトの設定でも発生する不具合であれば、5~8 の情報は省略できます。  
様々な変更が行われている常用のプロファイルでの不具合は原因の特定が難しい為、なるべく多くの情報が記載されている方が望ましいです。

機能などの要望については、それが必要とされる具体的な理由などを記載して頂けるとありがたいです。

いずれの場合にも、既に問題が報告されていないかどうかを確認すると良いでしょう。

# Pull Request について

現在、[Gruntfile.js](https://github.com/tombfix/core/blob/master/Gruntfile.js) でコメントアウトされているファイル以外への変更は、[.jshintrc](https://github.com/tombfix/core/blob/master/.jshintrc) と [.jscsrc](https://github.com/tombfix/core/blob/master/.jscsrc) と [.eslintrc](https://github.com/tombfix/core/blob/master/.eslintrc) に従い、[Travis CI](https://travis-ci.org/tombfix/core) 上で JSHint と JSCS と ESLint により構文チェックされます。  
Pull Request をなさる際は、Travis CI のチェックを通る(All is well)ようお願いします。

なお、コミットについては、[Commits](https://github.com/tombfix/core/commits/master) を参考にして、以下のようにすると良いでしょう。

* コミットメッセージは英語で記述する
* コミットタイトルの先頭で動詞を用いる際は現在形で、最初の文字を大文字にする
* コミットタイトルの文字数は最大でも 72 文字とする
* 特定の Issue に関連付ける際は、コミットタイトルの最後に`#ISSUE_ID`の形式で記述する
* コミットタイトルに変更点を書ききれない場合は、コミットディスクリプションに詳細を書き、コミットタイトルは手短に簡潔に書く
* コミットはその変更点に見合った適切な粒度で分割し、なるべく 1 つのコミットが、大き過ぎず、小さ過ぎない形にし、且つ複雑にならないようにする
* 分割する事が適切ではないなどの理由で複数の変更点を 1 つのコミットに含める場合、コミットディスクリプションで、Markdown のように`*`で複数の変更点をリスト表記で記述する
