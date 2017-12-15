---
layout: post
title: "Calculating PI in ABAP"
date: 2015-03-04 00:29:43.000 -08:00
categories:
- Other
- SAP
tags:
- ABAP
- NetWeaver
---

およそ 4 年振りの SAP ネタです。

 
つい先日、これまで書き散らしていた諸々のソース コードを整理して、GitHub やら TFS にアップロードしていたのですが、その中に 2009 年に書いた ABAP のコードを見つけました。2009 年と言えば社会人 2 年目。暇つぶしに ABAP で円周率を計算していたとは、舐めた社員ですな。当時、社内のポータル サイトで共有したような記憶がありますが、まあ別にここで公開してもいいでしょう、ということで GitHub にアップロードしました。

 
[https://github.com/msmania/pi](https://github.com/msmania/pi)

 
意外にも、GitHub には多くの ABAP のコードがアップロードされていて驚きました。円周率なんて計算してもしょうがないですが、GItHub にはビジネス的に有用なプログラムもあるはずです。

 
なお、アルゴリズムとしてはマチンの公式を使っています。

 
もう ABAP については記憶の彼方にいってしまってほとんど覚えていないのですが、aRFC を使って複数ワークプロセスに処理を分散させるぐらいのことまでは実現していました。当時のメモを見ると、今後に向けた改善点として、以下の 3 つが書かれていました。なんかうける。

 
- N 型より INT2 型を使う 
- 汎用モジュールからの戻り値を ABAP メモリか SAP メモリに展開してコピーしないようにする 
- 算術幾何平均を使う 

 
といっても、コードを紹介するだけだと面白くないので、久々に NetWeaver の Trial 版をインストールしてみました。4 年前に書いたインストールの記事に関しては、幾つかのブログからリンクして頂けているようで、アクセス数がそれなりにあります。公開資料が少ないこともあって、需要はあるのでしょう。それに ITPro の某特集のように情報がいつまでも古いと申し訳ないですし。

 
### 1. まずはダウンロード

 
かつて SDN (SAP Developer Network) と呼ばれていたサイトは、SCN (SAP Community Network) という名前に変わっていました。開発者以外の人にも見てほしい、ということなんでしょうかね。

 
その SCN とやらでは、どこのリンクを辿れば ABAP がダウンロードできるのか分かりません。そこで、ダウンロード ページで "ABAP Trial" で検索して、以下のページを見つけました。このページの "Trial Version" というボタンをクリックしてユーザー情報を登録すると、真のダウンロード ページへのリンクを含むメールを受け取ることができます。なんか随分めんどくさくなってるなー。

 
SAP NetWeaver Application Server ABAP 7.03 64-bit Trial | SAP Store <br />
[https://store.sap.com/sap/cpa/ui/sid/0000000218](https://store.sap.com/sap/cpa/ui/sid/0000000218)

 
メールに書いてあったリンクから、↓ のようなページに辿り着きます。NetWeaver 7.03 のダウンロードページなのに、なぜか 7.02 のリンクもあります。とりあえず全部ダウンロードしておきましょう。

 
![]({{site.assets_url}}2015-03-04-image.png)

 
IE の場合だけかもしれませんが、ここで単純にリンクをクリックすると、rar ファイルをテキストとして開こうとしてブラウザーが大変なことになるので、「右クリック → ファイルを保存」で保存するようにして下さい。

 
ダウンロードしたファイルは ↓ の 5 つ。全部で 10GB ちょっとです。拡張子は rar、exe、zip とバラバラです。

 
![]({{site.assets_url}}2015-03-04-image1.png)

 
NetWeaver 7.02 と GUI for Java は、成り行きでダウンロードしただけで今回は使いません。使うのは以下の 2 つのファイルです。詳しく調べていませんが、すでに NetWeaver 7.03 ってのも古いのでしょうかね。時代は HANA！クラウド！なのかな。

 
- ABAP_7_03_SP04_64_bit_Trial_3_9_2_GB.rar 
- ABAP_SAP_GUI_for_Windows_7_30_PL4_HF1_121_MB.exe 

 
Hyper-V の仮想マシンに入れるので、rar を解凍して、ISO に固めなおしておきます。元の rar と比べて大してサイズはほとんど変わらず・・・。初めから ISO でダウンロードできればいいのに。

 
### 2. サーバーの準備

 
そう言えば、前回の記事でインストールしていたのは 32bit の NetWeaver でした。ブログを見ると、64bit の無償版は提供されていなかったらしく、なんだか時代の変遷を感じます。今回は潤沢なリソースを使って、さくっとインストールを終わらせようと思います。用意したのはこちら ↓

 
- OS: Windows Server 2012 R2 (Hyper-V 仮想マシン) 
- 仮想プロセッサー コア数: 4 
- メモリ: 8GB 
- ディスク: 100GB on SSD 
- ネットワーク構成: Windows Server 2012 R2 ドメイン 

 
8GB あれば余裕じゃん、ってことでスワップ領域の設定は特に変えません。VHD は、OS をインストールしたディスクとは別に用意しました。インストール前のディスク構成はこんな感じ。

 
![]({{site.assets_url}}2015-03-04-image2.png)

  
### 3. sapinst の実行

 
仮想マシンを起動し、作っておいた ISO をマウントし、以下のパスにある sapinst.exe を起動します。同じフォルダーに PowerShell スクリプトがあってちょっと気になる。名前からしてクラスター環境へのインストール用か。

 
SAP_NetWeaver_703_Installation_Master\DATA_UNITS\BS2011_IM_WINDOWS_X86_64\sapinst.exe

 
![]({{site.assets_url}}2015-03-04-image3.png)

 
sapinst が起動します。なんか懐かしい！

 
![]({{site.assets_url}}2015-03-04-image4.png)

 
そう言えば SAPinst って Java がないと駄目なんじゃなかったっけ、と思いましたが、今回は特に JRE も JDK も入れていません。プロセス ツリーを見ると、なぜか Java が動いています。どこから来たんだこいつは。

 
![]({{site.assets_url}}2015-03-04-image5.png)

 
どうやら、sapinst.exe の初回実行時に、インストール メディアに入っている SAPJVM4 が自動的に解凍されていたようです。Java.exe は %temp% にコピーされていました。バージョンを見ると、Java1.6 互換になっています。

 
```
C:\MSWORK> %temp%\sapinst_exe.2080.1425356341\jre\bin\java -version 
java version "1.6.0_21" 
Java(TM) SE Runtime Environment (build 6.1.021) 
SAP Java Server VM (build 6.1.021, Dec 23 2010 01:45:56 - 61_REL - optU - windows amd64 - 6 - bas2:146884 (mixed mode))
```
 
話を sapinst に戻します。sapinst の画面は、前回の記事とほぼ同じです。最初の画面で、インストールシステム ABAP+MaxDB+Central System を選択し、Next をクリックします。

 
ログオフを求められるので、OK をクリックしてログオフし、再度同じユーザーでログオンします。

 
![]({{site.assets_url}}2015-03-04-image6.png)

 
ライセンス条項を確認し、問題なければ accept を選んで Next をクリックします。

 
![]({{site.assets_url}}2015-03-04-image7.png)

 
マスター パスワードの入力です。今まで通り pswd_NSP を使おうとしたら、なぜか弾かれてしまったので Password1 を使いました。

 
![]({{site.assets_url}}2015-03-04-image8.png)

 
パスワードの要件は以下の通りです。MaxDB と NetWeaver でそれぞれ別の要件があるので面倒です。実はこの 2 つに加えて第三の要件、Windows のパスワード要件もあり、それは sapinst ではチェックしてくれないので要注意です。sapinst が OK でも Active Directory で無効なパスワードだと、インストールの最初のフェーズでエラーになります。そうなっても sapinst をやり直せばいいのですが、確実に一発で通したい場合は、入力するパスワードで Windows のユーザーを作れるかどうかを予め確認しておくのが一つの手です。

 
![]({{site.assets_url}}2015-03-04-image9.png)

 
パスワードが通ると、以下のポップアップが出ました。前提条件を満たしていないようですが、ここは強気の続行です。No をクリックします。

 
![]({{site.assets_url}}2015-03-04-image10.png)

 
何を満たしていなかったかと言うと、OS バージョンとスワップ領域のサイズでした。結果的にはどちらも問題になりませんでした。OS は Server 2012 R2 なので Windows 6.3 のはずですが、なぜか 6.2 と表示されています。

 
![]({{site.assets_url}}2015-03-04-image11.png)

 
次がサマリーのページです。縦に長くなりますが、全部貼り付けます。

 
![]({{site.assets_url}}2015-03-04-image12.png)

 
![]({{site.assets_url}}2015-03-04-image13.png)

 
![]({{site.assets_url}}2015-03-04-image14.png)

 
![]({{site.assets_url}}2015-03-04-image15.png)

 
念のため、全部の設定項目を確認しておいたほうがよいです。特に見るべきなのは、インストール先のドライブでしょうか。ウィザードでは何も聞かれませんでしたが、上記の例だと、基本的には全て S: ドライブにインストールされるように自動的に設定されています。もし全部 C: ドライブに入れたい場合は、該当項目にチェックをつけて、Revise をクリックしてください。

 
今回はこのまま Next をクリックしてインストールを開始します。

 
先ほど触れましたが、Active Directory のパスワードの要件を満たしていないと、エラーになります。実際に引っかかりましたので、エラーの画面を紹介します。

 
![]({{site.assets_url}}2015-03-04-image16.png)

 
このエラーの続行は不可能なので、Stop をクリックします。すると、ログ ビューアー的な画面が出てきます。

 
![]({{site.assets_url}}2015-03-04-image17.png)

 
エラーメッセージは以下の通り。IADsUser::SetInfo がエラーになっているので、これは Active Directory で既定で有効になっている、複雑なパスワード ポリシーを満たしていないことが原因と考えられます。

 
```
ERROR      2015-03-02 20:41:36.75 [synxcuser.cpp:1883] 
           CSyUserImpl::addToOS(PSyUserDataInt data, ISyProgressObserver* ) 
           lib=syslib module=syslib 
FSL-00009  System call failed. Error -2147022651 (The password does not meet the password policy requirements. Check the minimum password length, password complexity and password history requirements.

) in execution of system call 'IADsUser::SetInfo' with parameter (), line (1882) in file (synxcuser.cpp), stack trace: iaxxejsctl.cpp: 146: EJS_ControllerImpl::executeScript() 
d:\depot\bas\720_rel\bc_720-2_rel\gen\optu\ntamd64\ins\sapinst\impl\src\ejs\iaxxejsbas.hpp: 461: EJS_Base::dispatchFunctionCall() 
iaxxejsexp.cpp: 178: EJS_Installer::invokeModuleCall() 
iaxxbaccount.cpp: 66: CIaOsAccount::createUser_impl() 
synxcaccmg.cpp: 168: PSyUserInt CSyAccountMgtImpl::createUser(PSyUserDataInt, ISyProgressObserver*) const 
syxxccache.cpp: 284: CSyAccountCache::getUserImpl(name="CONTOSO\SAPServiceNSP", sid="", create=true) 
syxxccache.cpp: 293: CSyAccountCache::getUserImpl(name="CONTOSO\SAPServiceNSP", sid="", create=true, ISyProgressObserver* ) 
synxcuser.cpp: 134: CSyUserImpl::CSyUserImpl(PSyUserDataInt, bool) 
synxcuser.cpp: 1669: CSyUserImpl::addToOS(PSyUserDataInt data, ISyProgressObserver* )
```
 
新たに sapinst をウィザードからやり直すときは、sapinst の生成したログをすべて削除してから sapinst.exe を実行してください。ログが残っていると、入力済みの値を使ってインストールが勝手に始まってしまいます。

 
Import ABAP 時の様子はこんな感じです ↓

 
![]({{site.assets_url}}2015-03-04-image18.png) ![]({{site.assets_url}}2015-03-04-image19.png)

 
Import ABAP は何の問題もなく通過しましたが、最後から 4 つ前のフェーズ Start instance でインスタンスの起動に失敗して sapinst がエラーになりました。

 
![]({{site.assets_url}}2015-03-04-image20.png)

 
単純に起動に失敗しただけなので、これは続行できる可能性があるエラーです。sapinst の以下のポップアップはそのままにして、とりあえず SAP インスタンスの手動起動を試みます。

 
![]({{site.assets_url}}2015-03-04-image21.png)

 
既にデスクトップに sapmmc ができているのでそれを開いて・・・

 
![]({{site.assets_url}}2015-03-04-image22.png)

 
アイコンが黄色になっているので、まずは止めます。

 
![]({{site.assets_url}}2015-03-04-image23.png)

 
![]({{site.assets_url}}2015-03-04-image24.png)

 
止めた後は特に何もせず、そのまま起動を行なったところ、無事起動しました。原因は不明ですが、まあよくあることです。今回は違いましたが、ここでの原因として、メモリ不足で SAP が起動できなかった、ということもあり得ます。SAP インスタンスの起動中は、タスク マネージャーなどでリソースの状態を確認しておく癖をつけておくと何かと役に立つはずです。

 
![]({{site.assets_url}}2015-03-04-image25.png)

 
このあと SAPinst の画面で Retry をクリックし、無事インストールが終了しました。エラー対応も含めて 1 時間くらい。速い！

 
![]({{site.assets_url}}2015-03-04-image26.png)

 
おまじないとして、この後 OS を再起動してから SAP インスタンスを起動します。起動後でもメモリ消費量は 4GB 弱だったので、仮想マシンへのメモリの割り当てを 5GB に減らしておきました。

  
### 4. SAP GUI のインストール

 
ABAP を使うためには、SAP GUI もインストールしないといけません。クライアント用に別の Hyper-V 仮想マシンを用意します。

 
- OS: Windows 8.1 64bit 
- RAM: 2GB 
- Java: JRE 7 Update 76 (JAVA_HOME や PATH といった環境変数の設定は不要) <br />
[http://www.oracle.com/technetwork/java/javase/downloads/jre7-downloads-1880261.html](http://www.oracle.com/technetwork/java/javase/downloads/jre7-downloads-1880261.html) 

 
無償版のパッケージに入っているインストーラーでは、いきなり SAP GUI 7.30 をインストールできないので、最初に SAP GUI 7.20 をインストールし、その後に 7.30 へのアップグレードを行ないます。7.20 だけなら Java は要らないのですが、7.30 にアップグレードするには 32bit JRE 6 か 7 が必要になります。最新の JRE 8 ではインストールできませんでした。sapinst と違って、SAPJVM はフロントエンド コンポーネント向きではないのでしょうかね。

 
SAP GUI 7.20 のインストーラーは ↓ のパスにあります。

 
Frontend&tools\SAP_GUI_for_Windows_7.20_Patchlevel_7_SDN_version_20110701_1428.exe

 
7.20 のインストール後、別途ダウンロードした ABAP_SAP_GUI_for_Windows_7_30_PL4_HF1_121_MB.exe を実行してアップグレードを行います。

 
これで SAP GUI 7.30 がインストールできました。

 
![]({{site.assets_url}}2015-03-04-image27.png)

 
先ほどインストールした NetWeaver への接続を作ります。SID は NSP、インスタンス番号は 00 です。

 
![]({{site.assets_url}}2015-03-04-image28.png)

 
作業用には、ユーザー名 bcuser、パスワード minisap のアカウントを使います。クライアントは 001 で。

 
minisap 環境で使う機会はほとんどなさそうですが、sap* と ddic ユーザーのパスワードは、インストール時に入力したマスター パスワードになっています。

 
ログオンできました。SAP GUI 7.30 といえど、見た目に大きな変更はないようです。それにしても懐かしい。

 
![]({{site.assets_url}}2015-03-04-image29.png)

 
### 5. ABAP プログラムを書く

 
さて、ここからの手順はかなり記憶があやふやです。何はともあれ、トランザクション SE80 を実行します。ドロップダウンでは Local Objects を選んでおきます。シングルシステムで、移送の予定がないからです。移送とか懐かしい・・・

 
![]({{site.assets_url}}2015-03-04-image30.png)

 
まずはクラスから作るので、メニューからクラスライブラリ - クラスを選びます。

 
![]({{site.assets_url}}2015-03-04-image31.png)

 
適当に名前や説明を入れて保存します。

 
![]({{site.assets_url}}2015-03-04-image32.png)

 
ローカル オブジェクトには $TMP というパッケージが自動的に割り当てられる、ということをトレーニングで覚えた気がします。フロッピーのボタンをクリックして保存します。

 
![]({{site.assets_url}}2015-03-04-image33.png)

 
こんな画面になりました。

 
![]({{site.assets_url}}2015-03-04-image34.png)

 
画面上でいちいちインターフェースを作っていくのは面倒なので、Source Code-Based というボタンを押してコード モードに移ります。ここでは、GitHub のリポジトリから z_longint.abap をコピペします。コードを保存したら Ctrl+F2 で文法チェックし、問題なければ Ctrl+F3 で有効化します。

 
![]({{site.assets_url}}2015-03-04-image35.png)

 
多倍長演算を行うクラスができたので、このクラスを使って円周率を計算するプログラムを作ります。幾つかのバージョンを用意していますが、ここでは一番シンプルな奴を使います。

 
コンテキスト メニューからプログラムの新規作成を選びます。

 
![]({{site.assets_url}}2015-03-04-image36.png)

 
名前を入れてチェックのアイコンをクリックします。

 
![]({{site.assets_url}}2015-03-04-image37.png)

 
タイトルを適当に入力して Save をクリックします。

 
![]({{site.assets_url}}2015-03-04-image38.png)

 
$TMP パッケージが選ばれていることを確認し、フロッピー アイコンをクリックします。

 
![]({{site.assets_url}}2015-03-04-image39.png)

 
コード入力の画面が表示されるので、今度は GitHub から zcalc_pi.abap をコピペして保存します。先ほどと同様に Ctrl+F2 で文法チェックし、問題なければ Ctrl+F3 で有効化します。

 
![]({{site.assets_url}}2015-03-04-image40.png)

 
特に意味はないですが、プログラムの実行は別トランザクションでやってみます。トランザクション SE38 を実行し、プログラム名に先ほど入力した名前 zcalc_pi を入力して F8 キーを押します。

 
![]({{site.assets_url}}2015-03-04-image41.png)

 
無事、結果が表示されました。計算時間は 1 秒ちょっとになっています。さすが ABAP。遅い。

 
![]({{site.assets_url}}2015-03-04-image42.png)

 
というわけで、久々の SAP ネタでした。

