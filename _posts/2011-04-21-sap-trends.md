---
layout: post
title: "[SAP] 新製品やトレンドの備忘録的まとめ"
date: 2011-04-21 01:27:27.000 +09:00
categories:
- SAP
tags:
- Cloud
- HANA
- NetWeaver
- WebDynpro
---

軽い気持ちで SAP の最新技術を調べていたら、かなり興味深かった。せっかくなので記事としてまとめてみます。本業として関わっていた頃はトレンドを追いかける余裕もなく、それほど興味も持っていなかったけど、外部から SAP 技術を眺める立場になると、逆に最新技術に興味がシフトしている。今の時代は、ちょっと指先を動かすだけで誰でもある程度の最新情報を得られるので便利な反面、当事者には厳しい時代になってきました。

 
斜め読みが多いので、間違いを見つけたらご指摘いただけると助かります。

 
BI 製品への注力

 
#### インメモリー コンピューティング エンジン SAP HANA 1.0 リリース (Dec. 2010)

 
やっぱりこれが一番ホットなんじゃないかと。残念ながら実物を見たことがないので、実際のところどうなのかは知らない。Intel Xeon 7500 に最適化されているということなので、プロセッサとしては微妙に古い。

 
後述の EIM 4.0 とか NetWeaver 7.3 が出てきたので、SAP は ERP より BI よりになっていくのだろうか。BI といえば、SAS とか MicroStrategy というイメージもあるが。

 
[http://www.sap.com/press.epx?PressID=14464](http://www.sap.com/press.epx?PressID=14464) <br />
[http://www.sdn.sap.com/irj/scn/weblogs?blog=/pub/wlg/21904](http://www.sdn.sap.com/irj/scn/weblogs?blog=/pub/wlg/21904)

 
#### SAP BI4.0, EIM 4.0 リリース (Mar. 2011)

 
Business Object 側の製品で新バージョンが出て、HANA との連携を謳っている。元のバージョンを知らないだけに、これもよく分からない。日本に来るのはまだ先の話なのかね。

 
[http://www.sdn.sap.com/irj/boc/bi](http://www.sdn.sap.com/irj/boc/bi) <br />
[http://www.sdn.sap.com/irj/scn/weblogs?blog=/pub/wlg/24307](http://www.sdn.sap.com/irj/scn/weblogs?blog=/pub/wlg/24307)

  
#### NetWeaver 7.3 リリース (Nov. 2010)

 
本丸の登場です。7.2 っていつ出たっけ、という間に NetWeaver 7.3 がリリース。7.2 は BPM 専用ということか。 <br />
下のリンクの 2 番目のスライドが面白い。”The first version of BW 7.30X running on HANA (coming soon)” では BWA と NetWeaver BW の演算部分を HANA に置き換えて、ついにはデータベースが不要になるようです。

 
話は逸れますが、BWA は SAP のインデックス サーバーである TREX の技術をベースにして作られています。NetWeaver 6.4 の認定を取った時から 「こいつは来る」 と睨んでいたので、予想が当たって結構嬉しい。だがその割に TREX をまともに触ることはなかった・・・。

 
BW 以外の新機能は後述。

 
[http://www.sap.com/japan/about/press/press.epx?pressid=14449](http://www.sap.com/japan/about/press/press.epx?pressid=14449) <br />
[http://www.sdn.sap.com/irj/sdn/edw?rid=/library/uuid/300347b5-9bcf-2d10-efa9-8cc8d89ee72c](http://www.sdn.sap.com/irj/sdn/edw?rid=/library/uuid/300347b5-9bcf-2d10-efa9-8cc8d89ee72c)

 
### <font size="3">SaaS – SAP Business ByDesign</font>

 
実は 2007 年から中堅市場向けに SaaS を提供しています。要するに、従量課金方式の業務アプリケーションです。ただ、独、米、英、仏、印、中の 6 ヶ国のみで日本では提供していないらしい。そろそろ日本でも機が熟してきたと思うんですけどね。各企業も SaaS に抵抗がなくなってきてそう。で、最近の動きがこちら。

 
#### Business ByDesign Feature Pack 2.6 リリース (Feb. 2011)

  
iPad, Blackberry 向けの SDK が含まれています。営業向けに、出先で CRM にささっとアクセスできるというのがわかりやすいイメージだと思う。iPhone は確か 2.5 でサポートされていたような。Windows Phone 7 と Android は夏に出るらしい 3.0 で対応予定。

 
ただ、開発環境が Visual Studio で、言語がどうやら C# らしい。このへんが賛否両論を巻き起こしそうなところ。確かに、モバイル向けのアプリ開発者って Visual Studio を使ってるイメージがあまりない。

 
[http://www.sap.com/press.epx?PressID=14707](http://www.sap.com/press.epx?PressID=14707)

 
### <font size="3">クラウド開発基盤 – SAP River (Jun. 2010)</font>

 
いつのまにかこんなものが始まっていて驚いた。REALTECH のブログで取り上げられていたのが凄い。彼らのブログを読んでいれば、SAP のトレンドはばっちりなのではないかと思う。たぶん多くの分野で本家より詳しいと思います。

 
サーバーサイド JavaScript をベースにした技術らしいです。データ駆動開発で、要件がマッチすれば本当に簡単にアプリケーションを作れそうな感じ。ByDesign が C# になってしまったが、確かに JavaScript ならニュートラルですね。

 
既に稼働済みのサイトは 2 つ。iApprove は分からないが、Carbon Impact は Amazon EC2 で動いています。OS とか Web サーバーは何でもいいのだろうか。もう少し追いかけてみないと分からない。買収した Coghead の技術をベースにしているらしいです。

 
- Carbon Impact 5.0 by SAP: [http://sapcarbonimpact.com/](http://sapcarbonimpact.com/)
- iApprove by KeyTree: [http://www.keytree.co.uk/iapprove/index.php](http://www.keytree.co.uk/iapprove/index.php)

 
[http://wiki.sdn.sap.com/wiki/display/EmTech/River](http://wiki.sdn.sap.com/wiki/display/EmTech/River) <br />
[http://www.sdn.sap.com/irj/scn/weblogs?blog=/pub/wlg/22784](http://www.sdn.sap.com/irj/scn/weblogs?blog=/pub/wlg/22784) <br />
[http://www.sdn.sap.com/irj/scn/weblogs?blog=/pub/wlg/23695](http://www.sdn.sap.com/irj/scn/weblogs?blog=/pub/wlg/23695) <br />
[http://solution.realtech.jp/2011/03/sap-river-sdn.html](http://solution.realtech.jp/2011/03/sap-river-sdn.html)

 
### <font size="3">Duet Enterprise リリース (Feb. 2011)</font>

 
Duet 1.0 が世界的にもイマイチな評価だった印象がある中、Duet Enterprise リリース開始。Office 2010 との連携製品で、今回は SharePoint Server 2010 との連携がメインのようです。

 
製品としては面白いけど敷居が高そう。SharePoint のシェアってどのぐらいなんだろう。便利は便利だけど、市場はそこまで求めてないような気もする。売り方次第では行けるのかな。でもSharePoint も SAP も高いし・・。

 
[http://www.sap.com/japan/press.epx?pressid=14789](http://www.sap.com/japan/press.epx?pressid=14789) <br />
[http://technet.microsoft.com/ja-jp/library/ff972433(d=lightweight).aspx](http://technet.microsoft.com/ja-jp/library/ff972433(d=lightweight).aspx)

 
### <font size="3">仮想化</font>

 
#### Citrix XenServer のサポート開始 (Nov. 2010)

 
これで、ユーザーの選択肢は ESX, Hyper-V, Xen の 3 択になりました。どれかが勝つというよりかは、シェアを分け合いそうな気もします。ただ、サポートの手厚さという意味では、やはり Hyper-V だろうか。でも技術的には VMware はやっぱり強い。Xen は使ったことがないから分からない。一番安いのはどれだろう。

 
#### SAP GUI の仮想化

 
今後は、サーバーだけじゃなくて、クライアントの仮想化も進むと思われます。現在サポートされているのは、VMware View 4.5 と VMware ThinApp ですが、そのうち Microsoft App-V もサポートされるでしょう。でも結局は、仮想デスクトップが主流になるかも。

 
### <font size="3">その他</font>

 
#### Silverlight Islands

 
EhP2 から WebDynpro for ABAP, Java で Silverlight との統合が行われました。特に ABAP で Silverlight が統合されたのは画期的。標準のサンプル アプリケーションで体感できるので、これは環境があれば是非見てほしい。以下 3 つの WebDynpro Component が用意されています。

 
- DEMO_SILVERLIGHT_FLIGHTS
- DEMO_SILVERLIGHT_SEATS
- WDR_TEST_SILVERLIGHT

 
![]({{site.assets_url}}2011-04-21-image2.png) ← パズル

 
![]({{site.assets_url}}2011-04-21-image3.png)

 
2 枚目の画面は従来の WebDynpro コントロールと Silverlight との比較ができるページですが、SIlverlight いいです。さくさく動きます。技術的には、MIME リポジトリの SAP/PUBLIC/BC/UR/nw7/SilverlightIslands 下に SIlverlight Islands エンジンに XAP と DLL が入っています。他のものも MIME に強引に入れれば統合できたり？Windows 以外でもちゃんと動くのかどうかも気になる。これは今度時間を作ってアプリを作ってみたい。ちょうど Silverlight に手を出そうとしていたし。

 
[http://help.sap.com/saphelp_nw70ehp2/helpdata/en/54/07ec96bd5a4764be4996fff231b4de/frameset.htm](http://help.sap.com/saphelp_nw70ehp2/helpdata/en/54/07ec96bd5a4764be4996fff231b4de/frameset.htm) <br />
[http://help.sap.com/saphelp_nw70ehp2/helpdata/en/61/bdfa1563a64a188ec95d2280fbb98e/frameset.htm](http://help.sap.com/saphelp_nw70ehp2/helpdata/en/61/bdfa1563a64a188ec95d2280fbb98e/frameset.htm)

 
#### SAP NetWeaver 7.3 の新機能

 
ヘルプ ポータルにリリース ノートが出ていたので、AS ABAP の部分をざっと見て気になったところを箇条書きで。これは 7.0 EhP2 とも被る部分が多い。 <br />
[http://help.sap.com/saphelp_nw73/helpdata/en/a2/fc644eb17e43b3a6442c5c522ad55e/frameset.htm](http://help.sap.com/saphelp_nw73/helpdata/en/a2/fc644eb17e43b3a6442c5c522ad55e/frameset.htm)

 
- IPv6 サポート
- DECFLOAT Data Types <br />
ついに浮動小数点がサポートされた！だが ABAP で浮動小数点計算って要らないような気がする。 <br />
[http://www.sdn.sap.com/irj/scn/weblogs?blog=/pub/wlg/18115](http://www.sdn.sap.com/irj/scn/weblogs?blog=/pub/wlg/18115)
- Dynamic Work Processes <br />
幾つかのプロファイル パラメーターは、サーバー再起動が不要になったようです。 <br />
[http://help.sap.com/saphelp_nw73/helpdata/en/46/c24a5fb8db0e5be10000000a1553f7/frameset.htm](http://help.sap.com/saphelp_nw73/helpdata/en/46/c24a5fb8db0e5be10000000a1553f7/frameset.htm)
- Embedded Search <br />
Enterprise Search が進化したのかな。TREX が統合されたらしい。 <br />
[http://help.sap.com/saphelp_nw73/helpdata/en/77/3d61cec12a4c1088d78ac909b9abb4/frameset.htm](http://help.sap.com/saphelp_nw73/helpdata/en/77/3d61cec12a4c1088d78ac909b9abb4/frameset.htm)

 
# 久々にブログ記事を書いたら、時間がかかるかかる。3時間以上もかかった気がする。継続しないとダメですね。

