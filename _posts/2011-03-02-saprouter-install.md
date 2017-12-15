---
layout: post
title: "[SAP] 無償版 NetWeaver に SAProuter を設定してみた"
date: 2011-03-02 00:36:05.000 +09:00
categories:
- SAP
tags:
- SAProuter
- saprouttab
---

SAP とサポート契約を結ぶと、OSS (Online Service System) と呼ばれるリモートサービスを受けることできます。このサービスを使うと、SAP 側のサポート担当者は、インターネットや専用回線越しにカスタマーシステムにログオンすることが可能になっています。この回線のことを OSS 回線と呼んだり呼ばなかったりします。

 
この OSS 回線の両端には、必ず SAP ルーターという小さなソフトウェアがいます。すなわち SAP のサポート側と、カスタマー側です。OSS 用途以外ではほとんど脚光を浴びることのない SAP ルーターですが、実は OSS 回線の門番以外としても当然使うことができます。しかも、この SAP ルーター、例の無償版 NetWeaver にも含まれていて、好きなように使うことができます。仮想マシンのように、閉じた環境で SAP を使いたい場合など、別のサブネットから排他的に SAP GUI でログオンできるように環境を作れるのはかなり便利だと思います。手順もけっこう簡単です。

 
SAP ルーターについては、本家の以下のページをお読みください。けっこう分かりやすく書かれています。この中で触れられている SNC （セキュアネットワークコミュニケーション） という暗号化通信がけっこう面白いのですが、無償版には含まれていないので試せません。残念です。

 
[http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/4f/992d39446d11d189700000e8322d00/frameset.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/4f/992d39446d11d189700000e8322d00/frameset.htm)

 
今回は、以前の記事で VMware 仮想マシン (Windows Server 2008 x86) 上に入れた NetWeaver 7.02 を使います。ネットワークなどの構成は以下のようになっています。

 
&lt;SAP サーバー&gt;

 
- VMware ゲスト OS 
- Windows Server 2008 x86 
- SAP NetWeaver 7.02 
- IP: 192.168.2.10 （固定 IP） 
- VMware の NIC で HostOny を指定し、ホスト OS とのみ通信できるようにしてある 

 
&lt;SAProuter サーバー&gt;

 
- VMware ホスト OS 
- Windows Server 2008 R2 
- IP (VMnet1): 192.168.2.1 （Manage Virtual Networks で設定しています） 
- IP (物理NIC): 192.168.1.3 （ただし DHCP 設定） 

 
&lt;SAP クライアント&gt;

 
- Windows 7 x86 
- SAP GUI 7.20 
- IP: 192.168.1.4 （ただし DHCP 設定） 

 
こんな感じです。

 
異なるサブネットに属している SAP クライアントと SAP サーバーは、直接通信できませんが、間に SAProuter を介入させることで可能になります。これが、「ルーター」 と呼ばれる所以でしょう。また、ポート番号を絞ることができるので、ファイアウォールによる防御効果を高めることができます。

 
SAProuter は、無償版 NetWeaver をインストールしたときに自動的に展開されています。NetWeaver を C: ドライブにインストールした場合は、以下のファイルがあるはずです。まさにこれが SAProuter です。

 
```
C:\usr\sap\NSP\SYS\exe\uc\NTI386\saprouter.exe
```
 
Windows エクスプローラーのプロパティから、プログラムのバージョンを見ることができます。同じ無償版でも、NetWeaver 7.01 と NetWeaver 7.02 に含まれている SAProuter のバージョンは異なります。

 
参考までに、手元にあるファイルはこうなっていました。

 
NetWeaver 7.01 - 7010.29.15.58313 （リリース 701 のパッチレベル 29 ということです）

 
![]({{site.assets_url}}2011-03-02-image.png)

 
NetWeaver 7.02 – 7200.70.18.23869 （リリース 720 のパッチレベル 70 ということです）

 
![]({{site.assets_url}}2011-03-02-image1.png)

 
58313 や 23869 といった細かいビルド番号は無視して構いません。

 
基本的には新しいバージョンほどバグが修正されていたり、新しいオプションが増えているので、今回であれば 7200.70 を使うべきでしょう。SAProuter が扱う SAP プロトコルが変わっているわけではないので、NetWeaver 7.01 にログオンするのに SAProuter 7200 を使っても問題ありません。R/3 でも問題なく動くはずです。逆に、混在させても動きますが、オプションによっては古い SAProuter が対応していなかったりします。

 
今回の 2 つのファイルの間には大きな違いがあり、7200.70 が単体で動作するのに対して、7010.29 の動作には以下の DLL が必要になります。

 
icudt30.dll <br />
icuin30.dll <br />
icuuc30.dll

 
これらの DLL も、saprouter.exe と同じフォルダーに入っているので、コピーするファイルが複数になるだけですが。この ICU*** という DLL は、SAP のものではなく、IBM の DLL です。ICU というのは、正式には IBM International Components for Unicode の略です。エクスポートされた関数名をざっと見たところ、標準 C ランタイムの IBM 版といったところでしょうか。Windows 環境であれば wchar_t 使えば終わりですが、SAP は UNIX, Linux や z/OS といったマルチ プラットフォームで動作する製品なので、このような外部ライブラリを使うことで、コード移植の手間を少なくしているのだと思われます。

 
具体的な手順を紹介していきます。

 
## SAP サーバーの設定

 
SAProuter 用に適当なフォルダーを作り、saprouter.exe をコピーします。今回は NetWeaver の入っている usr\sap に SAProuter というフォルダーを作りました。こんな感じ。

 
![]({{site.assets_url}}2011-03-02-image12.png)

 
niping.exe というのは、ICMP ではなく SAP プロトコルを使った ping コマンドのようなものです。saprouter.exe と同じところに入っています。今回は使いませんが、疎通確認の時よく使うので、まとめてコピーしておくと楽です。

 
次に、起動用のバッチファイルを作ります。こんな感じです。

 
```
REM 
REM startRouter.bat 
REM

echo off 
cls 
echo SAProuter starting... 
set ROUTER=C:\usr\sap\SAProuter 
saprouter -r -S 7777 -R "%ROUTER%\saprouttab" -G "%ROUTER%\saprouter.log" -J 10000000 -T "%ROUTER%\dev_saprouter" -V1 -E 
```
 
ここで設定しているのは以下の通りです。

 
- ポート番号: 7777 
- ルート許可テーブル ファイルの指定 
- ログファイルの指定、最大サイズ指定 
- トレース ファイルの指定、及び、トレース レベルの設定 

 
これ以外のオプションについては、以下のページをご覧ください。

 
[http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/4f/992e1d446d11d189700000e8322d00/frameset.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/4f/992e1d446d11d189700000e8322d00/frameset.htm)

 
次にルート許可テーブル ファイルを作ります。接続を許可/却下するホストや、TCP ポート番号、接続パスワードの指定を行うことができます。単なるテキストファイルです。

 
```
# 
# saprouttab 
#


# allow connections 
# P    <source>      <dest>          <port>    <password>

P      192.168.2.1   192.168.2.10    3200      sapsap

 
```
 
上記の場合、192.168.2.1 （SAProuter サーバー） から 192.168.2.10 （自分: SAP サーバー） への TCP ポート 3200 を使った接続を許可しています。ただし接続パスワードとして sapsap という文字列が必要になります。ポート 3200 というのは、SAP GUI が SAP インスタンスへ接続するときのポートの 1 つです。

 
ルート許可テーブルの書き方は以下のページを見てください。中継する SAProuter の数を制限する仕様が新しく追加されたようですね。

 
[http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/4f/992dfe446d11d189700000e8322d00/content.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/4f/992dfe446d11d189700000e8322d00/content.htm)

 
フォルダの中身がこんな感じになります。

 
![]({{site.assets_url}}2011-03-02-image3.png)

 
ここで、startRouter.bat を実行すると、以下のウィンドウが表示されて接続の待機が始まりますので、このまま放置しておきます。起動したタイミングで、ログファイル、トレースファイルが自動的に作成されます。

 
![]({{site.assets_url}}2011-03-02-image4.png)

 
コンソールが邪魔な場合は、以下のページに書いてあるように、saprouter.exe がもともと入っていたディレクトリにある ntscmgr.exe というユーティリティ プログラムを使って、SAProuter を Windows サービスとして登録することができます。サービスにすることで、ユーザーがログオンしなくても SAProuter を起動できるようになります。興味があれば試してみてください。普通に sc.exe でもできると思います。

 
[http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/4f/992dab446d11d189700000e8322d00/content.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/4f/992dab446d11d189700000e8322d00/content.htm)

 
最後に、SAP サーバーのファイアーウォール設定で、忘れずにポート 7777 を開いてください。

 
![]({{site.assets_url}}2011-03-02-image5.png)

 
 

 
## SAProuter サーバーの設定

 
SAP サーバーでの設定を使い回します。SAP サーバーで作った SAProuter フォルダーを丸ごと SAProuter サーバーの適当な場所にコピーして下さい。今回は F:\usr\sap\SAProuter としてコピーしました。

 
![]({{site.assets_url}}2011-03-02-image13.png)

 
ドライブ名が C: から F: に変わったので、起動バッチファイルのドライブ名だけを変更します。環境に合わせて設定して下さい。

 
```
REM 
REM startRouter.bat 
REM

echo off 
cls 
echo SAProuter starting... 
set ROUTER=F:\usr\saps\SAProuter 
saprouter -r -S 7777 -R "%ROUTER%\saprouttab" -G "%ROUTER%\saprouter.log" -J 10000000 -T "%ROUTER%\dev_saprouter" -V1 –E
```
 
ルート許可テーブルを以下のように編集します。任意のホストから、TCP ポート 7777 への接続を許可するように設定しています。接続パスワードは password です。

 
```
# 
# saprouttab 
#


# allow connections 
# P    <source>    <dest>        <port>    <password>

P      *           192.168.2.10  7777      password
```
 
startRouter.bat を起動し、最後に SAProuter サーバーのファイアーウォール設定で、ポート 7777 を開けておきます。

 
![]({{site.assets_url}}2011-03-02-image7.png)

 
![]({{site.assets_url}}2011-03-02-image8.png)

 
2 つの SAProuter の設定は以上です。 

 
 

 
## SAP クライアントの設定

 
環境は整ったので、SAP クライアントから SAP GUI を使ってログオンします。SAP NetWeaver と 2 つの SAProuter が起動していることを再度確認してください。

 
SAProuter を介してログオンするためには、SAP GUI のログオン エントリーにおいて、SAProuter ストリングというものを指定する必要があります。

 
SAProuter ストリングとは、中継すべき SAProuter のサーバー名やパスワードを連続して書き連ねたものです。パスワードは直書きします。そういう意味では、パスワードというよりは、チェック サムのようなものと捉えていたほうがいいかもしれません。パケット キャプチャをすると分かりますが、なんとこのパスワードは平文でネットワーク上を流れていきます。せめてハッシュぐらい使えよ、と。

 
[http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/4f/992df1446d11d189700000e8322d00/content.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/ja/4f/992df1446d11d189700000e8322d00/content.htm)

 
今回の場合は以下のように入力します。構成を正しく把握していないと間違いやすいので、気を付けてください。私もよく混乱します。

 
**/H/192.168.1.3/S/7777/W/password/H/192.168.2.10/S/7777/W/sapsap**

 
![]({{site.assets_url}}2011-03-02-image14.png)

 
あとは、いつも通りログオン可能です。

 
ログオン セッションの確立や切断時には、指定したログ ファイルに接続元やポート番号が時刻とともに記録されます。また、ルート許可テーブルによって許可されていない接続の要求があった場合も、ログファイルやトレースファイルに記録されます。便利です。

 
なお、ログオン セッション確立中に SAProuter が落ちると、SAP GUI が次のようなダイアログを表示して、セッションが切れます。つまり、SAProuter も SPOF になるので注意が必要です。

 
![]({{site.assets_url}}2011-03-02-image15.png) ![]({{site.assets_url}}2011-03-02-image16.png)

