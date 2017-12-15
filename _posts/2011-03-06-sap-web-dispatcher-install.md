---
layout: post
title: "[SAP] 無償版 NetWeaver に SAP Web Dispatcher を導入する"
date: 2011-03-06 22:37:15.000 +09:00
categories:
- SAP
tags:
- icmon
- sapwebdisp
- web dispatcher
---

SAP GUI による DIAG 接続は、SAProuter というプロキシ プログラムを使って中継させることができました。しかし HTTP 接続には対応していません。HTTP の場合は、適当なプロキシ ソフトを拾ってきて使えばできそうですが、SAP 謹製の SAP Web Dispatcher というプログラムを使って実現することもできます。もちろん、これも Trial 版の NetWeaver に含まれています。ありがたいですね。

 
SAP Web Dispatcher の本来の用途は名前の通り、複数のウェブ サーバー インスタンスを負荷分散することです。CISCO などが作っているハードウェア ロードバランサーの代わりとして（実際は併用したりしますが）使うことができます。そんな背景もあり、SAProuter と違って高機能で、設定も複雑です。今回は負荷分散することが目的ではなく、単純に中継させるだけを目的として構築してみます。

 
SAProuter のように経路の両端に設置する必要はなく、中継サーバー上でプログラムを実行するだけで動きます。今回は、VMware のホスト サーバーを SAP Web Dispatcher サーバーとして、ゲスト OS のサブネットと、ホスト側のサブネットを中継させます。環境は SAProuter のときと同じです。

 
```
<SAP サーバー>
VMware ゲスト OS 
Windows Server 2008 x86 
SAP NetWeaver 7.02 
IP: 192.168.2.10 （固定 IP） 
VMware の NIC で HostOny を指定し、ホスト OS とのみ通信できるようにしてある 

<SAP Web Dispatcher サーバー>
VMware ホスト OS 
Windows Server 2008 R2  SP1 
IP (VMnet1): 192.168.2.1 （Manage Virtual Networks で設定しています） 
IP (物理NIC): 192.168.1.3 （ただし DHCP 設定） 

<SAP クライアント>
IP: 192.168.1.4 
ブラウザー: IE 9.0 /  Chrome9.0 
OS: WIndows 7 SP1 x86 
ホスト名: adenosine （ワークグループ構成） 
```
 
SAP Web Dispatcher の実体はフォルダー usr\sap\NSP\SYS\exe\uc\NTI386 に入っている sapwebdisp.exe ですが、他のモジュールとの連携もあり、以下のファイル全てを SAP Web DIspatcher サーバーの適当なフォルダーにコピーします。今回は F:\usr\sap\WD720 というフォルダーを作って、それを使います。

 
```
sapwebdisp.exe   - SAP Web Dispatcher 本体 
sapwebdisp.pdb   - SAP Web Dispatcher デバッグ シンボル 
sapcsa.dll       - ユーザー入力フィルタリング用のライブラリ 
sapcpp47.dll     - SAP製 IO ストリームライブラリ (sapcsa.dll が使う) 
wdispadmin.SAR   - 管理ツール アーカイブ 
sapcar.exe       - SAR ファイル解凍プログラム 
icmon.exe        - 管理ユーザーをメンテナンスするためのツール 
```
 
全部 usr\sap\NSP\SYS\exe\uc\NTI386 に入っていますのでご安心を。デバッグ シンボルが入っているのは嬉しいですね。実は主要な SAP カーネル プログラムは、常にデバッグ シンボルとともに提供されています。素晴らしいです。SAP のデバッグについてはそのうち触れます。

 
ログ出力用に log フォルダーを作っておき、次のような構成となりました。

 
![]({{site.assets_url}}2011-03-06-image36.png)

 
ちなみに、sapwebdisp.exe のバージョンは 7200.70.18.23869 でした。NetWeaver 7.01 に付属の sapwebdisp.exe を使っても設定手順は変わりませんが、SAProuter と同じように ICU 関連 DLL もコピーして下さい。

 
![]({{site.assets_url}}2011-03-06-image37.png)

 
次に作るのは起動用のバッチ ファイルです。SAProuter と同じように ntscmgr.exe を使えばサービス化できますが、今回はサービス化せず、バッチファイルで起動します。

 
```
REM 
REM startWebDisp.bat 
REM

echo off 
cls 
echo SAP Web Dispatcher starting... 
set WEBDISP=F:\usr\sap\WD720 
sapwebdisp pf="%WEBDISP%\wd_10.pfl" -f "%WEBDISP%\log\dev_webdisp.log" -t 1
```
 
パラメーターで指定しているのは、SAP Web Dispatcher のインスタンス プロファイルとトレース ファイル、そしてトレース レベルです。そうです、SAP Web Dispatcher はそれ自身がインスタンス プロファイルを持ちます。

 
その他の起動オプションは以下のページをご覧ください。 <br />
[http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/de/89023c59698908e10000000a11402f/frameset.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/de/89023c59698908e10000000a11402f/frameset.htm)

 
次にインスタンス プロファイルを作ります。試行錯誤の結果、こんな感じでまとまりました。全部に意味があります。

 
```
# 
# wd_10.pfl 
#

# SAPSYSTEM must be set so that the shared memory areas can be created. 
# The number must be different from the other SAP instances on the host.

SAPSYSTEM = 10 
INSTANCE_NAME = WD720

DIR_ROOT = F:\usr\sap\$(INSTANCE_NAME) 
DIR_GLOBAL =     $(DIR_ROOT) 
DIR_EXECUTABLE = $(DIR_ROOT) 
DIR_LOGGING =    $(DIR_ROOT)\log 
DIR_ICMAN_ROOT = $(DIR_ROOT)\icmandir

# Message Server Description 
# SAP Web Dispatcher connects NetWeaver Message Server

rdisp/mshost = 192.168.2.10 
ms/http_port = 8100

# ICM settings

icm/security_log = LOGFILE=$(DIR_LOGGING)\dev_icm_sec.log,MAXSIZEKB=500 
icm/server_port_0 = PROT=HTTP,PORT=7778,TIMEOUT=3600,PROCTIMEOUT=3600 
icm/authfile = $(DIR_ROOT)\icmauth.txt 
icm/HTTPS/trust_client_with_issuer = * 
icm/HTTPS/trust_client_with_subject = *
```
 
コメントにも書いてあるように、SAP Web Dispatcher にはインスタンス番号が必要です。どうやら共有メモリを確保するために使われるようです。

 
インスタンス プロファイルをロードする処理は、ABAP インスタンスと共通のコードが使われているようで、特有の「癖」がけっこうあります。例えば、DIR_* 系のプロファイル パラメーターを暗黙的に持っていて、何も設定していないとログファイルなどを適当に usr\sap\D## などのパスに吐き出したりします。そんなわけで、DIR_* 系のパラメーターや、インスタンス名を明示的に指定しています。

 
今回はインスタンス番号は 10、インスタンス名は WD720 にしました。まあ・・・なんでも構いません。

 
SAP Web Dispatcher と NetWeaver との接点は、メッセージ サーバーの HTTP ポート 8100 と、ICM のポート 8000 ですが、プロファイル パラメーターとして指定するのはメッセージ サーバーの情報だけで十分です。必要なインスタンス情報は、メッセージサーバーから自動的に取得してくれます。

 
反対側の、ユーザーが接続する側のポートを icm/server_port_0 というパラメーターで 7778 に設定しています。SAProuter を 7777 にしたからというだけの理由です。ICM を設定したのと同じパラメーター名ですが、このパラメーター自体は ICM とは直接関係ありません。単にパラメーター名が同じだけです。このへんも実装が使いまわされているのでしょうかね。タイムアウト値を、SAP Web Dispatcher 側で独自に指定できることに注意してください。ここを指定しないと、確かデフォルト値が 10 秒ぐらいになるので、ICM 側のタイムアウト値が十分に長くても、Web Dispatcher 側でタイムアウトが発生してしまいます。

 
icm/authfile というパラメーターで icmauth.txt というファイルを指定していますが、これはまだ作っていませんね。icmauth.txt は、Web DIspatcher の管理ユーザーが記載されたテキストファイルで、最初にコピーした icmon.exe で作成します。が、摩訶不思議なことに icmon.exe にはファイルを新規作成する力がありません。権限不足でしょうか。そんなわけで、先に空ファイルを作っておきます。icmon の シンボルがあればデバッグできるのに。

 
エクスプローラーで新規の空ファイル F:\usr\sap\WD720\icmauth.txt を作成し、コマンド プロンプトから以下のコマンドを実行してください。ユーザーは Administrator で実行しています。

 
```
f:\usr\sap\WD720>icmon pf=wd_10.pfl -a 
icmon=>sapparam: SAPSYSTEMNAME neither in Profile nor in Commandline 
Maintain authentication file 
============================

Filename (F:\usr\sap\WD720\icmauth.txt): （何も入力せずエンター） 
Maintain authentication file: F:\usr\sap\WD720\icmauth.txt 
======================================

    a - add user to set 
    c - change passwd of existing user in set 
    g - change group of existing user in set 
    x - change client cert data of existing user in set 
    d - delete user from set 
    l - list users of set 
    s - save changes of set to file 
    q - quit (without saving)

-->
```
 
コマンドを実行するときに、先ほど作ったプロファイル ファイルを指定します。-a オプションが管理ユーザーをメンテナンスするためのオプションです。icmon については以下のページを参考にしてください。

 
[http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/0b/6aedff404d6b4a8cac8f1359e1b47c/frameset.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/0b/6aedff404d6b4a8cac8f1359e1b47c/frameset.htm)

 
今回はユーザーを新たに作るので、上のメニューで “a – add user to set” を選択し、必要事項を入力していくだけです。やっていることは、次のページに書かれていることそのままです。

 
[http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/82/9e98d786f040209e6a9e8145153939/frameset.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/82/9e98d786f040209e6a9e8145153939/frameset.htm)

 
```
Filename (F:\usr\sap\WD720\icmauth.txt): 
Maintain authentication file: F:\usr\sap\WD720\icmauth.txt 
======================================

    a - add user to set 
    c - change passwd of existing user in set 
    g - change group of existing user in set 
    x - change client cert data of existing user in set 
    d - delete user from set 
    l - list users of set 
    s - save changes of set to file 
    q - quit (without saving)

--> a 
User name: icmadm 
Enter new password: ******** 
Re-enter password: ******** 
Group name: admin 
Subject value of client cert: CN=template,* 
new entry locally created

Press <RETURN> to continue （何も入力せずエンター） 
Maintain authentication file: F:\usr\sap\WD720\icmauth.txt 
======================================

    a - add user to set 
    c - change passwd of existing user in set 
    g - change group of existing user in set 
    x - change client cert data of existing user in set 
    d - delete user from set 
    l - list users of set 
    s - save changes of set to file 
    q - quit (without saving)

--> s

old file renamed to F:\usr\sap\WD720\icmauth.txt.bak 
changes saved to file F:\usr\sap\WD720\icmauth.txt

Press <RETURN> to continue （何も入力せずエンター） 
Maintain authentication file: F:\usr\sap\WD720\icmauth.txt 
======================================

    a - add user to set 
    c - change passwd of existing user in set 
    g - change group of existing user in set 
    x - change client cert data of existing user in set 
    d - delete user from set 
    l - list users of set 
    s - save changes of set to file 
    q - quit (without saving)

--> q

f:\usr\sap\WD720>
```
 
アカウントは何でも OK なので、icmadm / pswd_ICM と入力しました。忘れても、icmon で再登録できます。ちなみに icmauth.txt の内容は、こんな感じになっていました。

 
```
# Authentication file for ICM and SAP Web Dispatcher authentication 
icmadm:$apr1$lfzz6v4.$ZYlfRGerjhM.dwX4Lokfo0:admin:CN=template,*:noflags 
```
 
単純な構造ですね。”pswd_ICM “ という文字列が、何らかのハッシュ アルゴリズムで赤字の文字列に変換されているだけです。これは SAP の常套手段です。

 
そんなこんなで、フォルダーの中がこんな感じになりました。 <br />
icmon.exe を実行したときに、トレースファイル dev_icmon とバックアップファイル icmauth.txt.bak が勝手にできました。 <br />
![]({{site.assets_url}}2011-03-06-image38.png)

 
ではいよいよ実行ですが、その前に、SAP サーバー側でファイアー ウォールの設定をします。開けるポートは、8100 と 8100 です。どちらか片方でも欠けるとエラーになるので、気を付けてください。

 
![]({{site.assets_url}}2011-03-06-0007.png)

 
いよいよ実行です。コンソールはこんな出力になるはずです。 <br />
![]({{site.assets_url}}2011-03-06-image39.png)

 
起動すると、log フォルダーの中に以下の 3 種類のログが出力されるはずです。それぞれ確認し、エラーや警告が出力されていないことを確認してください。 <br />
![]({{site.assets_url}}2011-03-06-image40.png)

 
SAP Web Dispatcher 701 と 720 の大きな違いは、720 になって ABAP システムログ （トランザクション SM21） 形式のログ ファイルを出力するようになったことでしょうか。それが SLOG&lt;インスタンス番号&gt;.LOG というファイルです。ただし、テキストエディタで見てもよく分かりません。

 
初回起動時、プロファイル パラメーター DIR_ICMAN_ROOT で指定したフォルダーに wdispadmin.SAR が解凍されます。SAR ファイルというのは、SAP 独自形式の圧縮ファイルです。なぜ JAR のように ZIP 形式を採用しなかったのは、SAP のプライドなんでしょうか。圧縮/解凍は、予めコピーしておいた sapcar.exe を使って自動的に行われます。

 
![]({{site.assets_url}}2011-03-06-image41.png)

 
この icmandir フォルダーに解凍されたファイル群は、SAP Web Dispatcher の管理コンソールの Web アプリケーションです。この管理コンソールにログオンするときに、先ほど icmon.exe で作ったアカウント icmadm を使います。この Web アプリケーションは ICP というファイル形式になっていて、C のような文法で書かれています。SAP 独自のエンジンと思いますが、他では見たことがありません。ITS 時代の Business HTML とも違う。

 
何はともあれ、無事起動したようです。最後に、SAP Web Dispatcher サーバーのファイアウォール設定で、7778 ポートを開けておきます。

 
![]({{site.assets_url}}2011-03-06-image42.png)

 
ようやく舞台が整いました。では、ブラウザーでアクセスします。

 
前回の記事にも書きましたが、クッキー生成の関係で、ホスト名の文字列はピリオドを 2 以上含んでいなければなりません。ここでもそのルールが適用され、ピリオドを 2 つ含めた文字列でSAP Web Dispatcher サーバーにアクセスしなければなりません。今回、SAP Web Dispatcher サーバーはワークグループ構成なので、前回と同様に、クライアント PC の hosts エイリアスで対応します。hosts ファイルに以下の行を追加します。

 
```
192.168.1.3    adenosine    adenosine.sap.local
```
 
まずは管理コンソールにアクセスします。URL は以下です。 <br />
[http://adenosine.sap.local:7778/sap/admin](http://adenosine.sap.local:7778/sap/admin)

 
ログオン認証が必要になるので、ここで icmon.exe で作成した icmadm アカウントを入力します。

 
![]({{site.assets_url}}2011-03-06-image43.png)

 
無事表示されました！

 
![]({{site.assets_url}}2011-03-06-image44.png)

 
この管理ツールを使うと、設定されているパラメーターの確認や、ログの表示、管理ユーザーのメンテナンス、ワーカースレッドやメモリの状態など、多様な表示/編集することができます。

 
次は NetWeaver にログオンしてみましょう。前回の記事では、SOA Manager と Webgui に以下の URL でログオンしました。 <br />
[http://win2008-nw702.sap.local:8000/sap/bc/gui/sap/its/webgui](http://win2008-nw702.sap.local:8000/sap/bc/gui/sap/its/webgui) <br />
[http://win2008-nw702.sap.local:8000/sap/bc/webdynpro/sap/appl_soap_management](http://win2008-nw702.sap.local:8000/sap/bc/webdynpro/sap/appl_soap_management)

 
SAP Web Dispatcher は接続先をディスパッチするだけでアクセス パスは変更しないので、今回の場合は ”win2008-nw702.sap.local:8000” をそのまま “adenosine.sap.local:7778” で置き換えるだけです。すなわち、

 
[http://adenosine.sap.local:7778/sap/bc/webdynpro/sap/appl_soap_management](http://adenosine.sap.local:7778/sap/bc/webdynpro/sap/appl_soap_management) <br />
[http://adenosine.sap.local:7778/sap/bc/gui/sap/its/webgui](http://adenosine.sap.local:7778/sap/bc/gui/sap/its/webgui)

 
にアクセスします。

 
まずは SOA Manager。ログオン画面が出てくるので、SAP ユーザーでログオンします。

 
![]({{site.assets_url}}2011-03-06-image45.png)

 
![]({{site.assets_url}}2011-03-06-image46.png)

 
無事表示されました。

 
![]({{site.assets_url}}2011-03-06-image47.png)

 
webgui も同様に問題なくアクセスできます。

 
![]({{site.assets_url}}2011-03-06-image48.png)

 
これで、SAP GUI、ブラウザーを使って、ともに外部のサブネットから NetWeaver へアクセスできるようになりました。簡単な図を作りましたので、参考までに。

 
![]({{site.assets_url}}2011-03-06-topology.png)

