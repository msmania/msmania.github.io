---
layout: post
title: "[SAP] HTTP を使って NetWeaver に接続する"
date: 2011-03-06 15:01:36.000 +09:00
categories:
- SAP
tags:
- ABAP
- GUI for HTML
- ICF
- ICM
- ITS
- WebDynpro
- Webgui
---

多くの場合、NetWeaver ABAP には SAP GUI という SAP 独自のクライアント アプリケーションを使ってログオン、及び、各操作を行います。一方、NetWeaver Java の場合はもちろん、ブラウザーがクライアント アプリケーションとなります。逆に SAP GUI を使うことはできません。

 
以前にも触れたことがありますが、SAP GUI と NetWeaver との通信に使われるプロトコルは、DIAG と呼ばれる（おそらく）仕様が非公開のプロトコルが使われています。しかしながら NetWeaver ABAP も Java と同じように、ブラウザからアクセスすることもできます。Java でいう JSP のような技術は ABAP にも存在し、名前は BSP = Business Server Page といいます。ASP という名前にしなかったのは、マイクロソフトの Active Server Page に対する配慮でしょうか。

 
現在の NetWeaver 7.x では、HTTP を処理するコンポーネントは ICM (Internet Communication Manager) に統合されています。NetWeaver 7.1x 系では確か Java でも ICM が HTTP 要求を処理しているはずです。プロセスでいうと icman です。こいつが HTTP ポートを開けています。

 
話を ABAP に絞ります。HTTP 通信は ICM が担当しますが、中のロジックはもちろん ABAP 側で処理します。ブラウザから来た HTTP リクエストを ICM がうまいこと処理して、最終的にはABAP プログラムであるイベント ハンドラにリクエストが届き、ワークプロセスでそれを処理します。で、HTTP 応答を ICM 経由で返します。じゃあ、ICM と ワークプロセスの通信はどうなってるの、という疑問が出てきます。このへんはちゃんと確かめていませんが、おそらくメッセージ サーバーを使って HTTP で通信しています。メッセージサーバーにも HTTP ポート (39##) があります。SAP 公式手順はないですが、ICM を別サーバーで構築することもできる気がします。スタンドアロン ICM みたいな。

 
ちょっと知っている人は、じゃあ、ICF とか ITS ってのは何よ、と思いますね。ICF は Internet Communication Framework という名前で、ICM に統合されているかのような印象を受けます。が、こいつは ABAP です。フレームワークという名の通り、ABAP プログラムが HTTP を処理するためのフレームワークのことです。

 
[http://help.sap.com/saphelp_nw70ehp1/helpdata/en/72/c730ddc06511d4ad310000e83539c3/frameset.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/en/72/c730ddc06511d4ad310000e83539c3/frameset.htm)

 
ICF というのはけっこう大きな実装で、全体を見るのはけっこう難しいです。というか見たことないですすみません。例えば、ABAP の HTTP リクエスト ハンドラーは ABAP クラスとして IF_HTTP_EXTENSION というインターフェースを実装しなければなりませんが、IF_HTTP_EXTENSION は ICF の一部と言えるでしょう。自分で実装したクラスは、ICF サービスとして、ICF の一部に登録することになります。細かいことは、自分で ABAP プログラムを見たり、上のヘルプ ポータルを参考にして下さい。（丸投げ）

 
で、次は ITS (Internet Transaction Server) ですね。結論から言うと、ITS というコンポーネントは既に存在しません。ICF サービスとして、標準の NetWeaver ABAP に含まれています。そのためか統合 ITS と呼ばれたりもします。でもこれは ICF サービスに過ぎません。その昔、SAP のアプリケーション サーバー （NetWeaver と呼ばれる前） に HTTP の機能がなかった時代に、HTTP を処理するコンポーネントが新たに作られました。これが ITS です。HTTP 要求を受け取る W-Gate と ABAP と通信する A-Gate に分かれていて、W-Gate のほうは確か IIS や Apache でも代用できたような記憶があります。このときは、まだ普通のウェブ サーバーの体をなしていて、HTML などはファイル システム上にデプロイする仕組みになっていました。現在の ICF では、ファイル システムは使わず、データベース内に独自のリポジトリを作って、それを ABAP が処理しています。そもそもスタティックな HTML はほとんど使いません。ITS 時代には、BSP の前身である HTMLBusiness という素敵な技術があって、これがまたけっこう面白いです。

 
現在 ITS を覚える意味はあまりないかもしれませんが、ヘルプはこれです。 <br />
[http://help.sap.com/saphelp_470/helpdata/en/0d/654d356560054ce10000009b38f889/frameset.htm](http://help.sap.com/saphelp_470/helpdata/en/0d/654d356560054ce10000009b38f889/frameset.htm)

 
統合 ITS についてはこれです。 <br />
[http://help.sap.com/saphelp_nw70ehp1/helpdata/en/6c/d30ea76d444ee3b1ea48026fe0fbb6/frameset.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/en/6c/d30ea76d444ee3b1ea48026fe0fbb6/frameset.htm)

 
実際に動かしてみましょうか。環境はいつものこれです。

 
ホスト名: win2008-nw702 （ワークグループ構成） <br />
IP: 192.168.1.3 <br />
OS: Windows Server 2008 x86 （VMware ゲスト） <br />
RAM: 2GB （VMware による割り当て） <br />
NetWeaver: SAP NetWeaver 7.0 EhP2 SP6 <br />
SID: NSP <br />
インスタンス番号: 00 <br />
インストール ドライブ: C: <br />


 
まずはインスタンス プロファイルに以下のパラメーターを設定し、NetWeaver を再起動します。この環境では、インスタンス プロファイルは C:\usr\sap\NSP\SYS\profile\NSP_DVEBMGS00_win2008-nw702 です、念のため。

 
```
SAPLOCALHOSTFULL = win2008-nw702.sap.local 
icm/host_name_full = $(SAPLOCALHOSTFULL) 
icm/server_port_0 = PROT=HTTP,PORT=80$$ 
icm/min_threads = 5 
icm/max_threads = 10 
icm/max_conn = 20 
icm/keep_alive_timeout = 3600 
icm/conn_timeout = 100000
```
 
ちなみにファイル全体はこんな感じ。

 
```
# 
# NSP_DVEBMGS00_win2008-nw702 
#

# 
# basic parameters 
# 
SAPSYSTEMNAME = NSP 
SAPSYSTEM = 00 
INSTANCE_NAME = DVEBMGS00 
SAPGLOBALHOST = win2008-nw702 
SAPLOCALHOSTFULL = win2008-nw702.sap.local 
DIR_CT_RUN = $(DIR_EXE_ROOT)\$(OS_UNICODE)\NTI386 
DIR_EXECUTABLE = $(DIR_INSTANCE)\exe 
dbs/ada/schema = SAPNSP

ms/server_port_0 = PROT=HTTP,PORT=81$$ 
rdisp/wp_no_dia = 5 
rdisp/wp_no_btc = 2 
rdisp/wp_no_enq = 1 
rdisp/wp_no_vb = 1 
rdisp/wp_no_vb2 = 1 
rdisp/wp_no_spo = 1

# 
# memory management 
# 
PHYS_MEMSIZE = 1536 
em/max_size_MB = 20000 
alert/MONI_SEGM_SIZE = 0 
enque/table_size = 2000

rspo/local_print/method = 2 
rsdb/ntab/entrycount = 5000 
rsdb/ntab/ftabsize = 3000 
rsdb/ntab/sntabsize = 1000 
rsdb/ntab/irbdsize = 1000

abap/buffersize = 100000 
rsdb/cua/buffersize = 2000 
zcsa/presentation_buffer_area = 1000000 
sap/bufdir_entries = 500

zcsa/table_buffer_area = 9000000 
zcsa/db_max_buftab = 500 
rtbb/buffer_length = 500 
rtbb/max_tables = 50

# 
# ICM parameters 
# 
icm/host_name_full = $(SAPLOCALHOSTFULL) 
icm/server_port_0 = PROT=HTTP,PORT=80$$ 
icm/server_port_1 = PROT=SMTP,PORT=2500,TIMEOUT=120,PROCTIMEOUT=120 
icm/min_threads = 5 
icm/max_threads = 10 
icm/max_conn = 20 
icm/keep_alive_timeout = 3600 
icm/conn_timeout = 100000

# 
# additional parameters 
#

mpi/total_size_MB = 10 
```
 
注意点が 1 点あります。SAPLOCALHOSTFULL = win2008-nw702.sap.local のところで指定するホスト名です。奇妙なルールですが、後の手順を実行するためにはこの値は必ずピリオドを 2 つ以上含んだ文字列にしなければなりません。最終的にブラウザーでアクセスするときに使うホスト名になるのですが、クッキーを生成する関係でこのようなルールが生まれてしまいました。

 
ドメインに参加していれば FQDN がありますが、ドメインに参加していなくても、要はクライアント側でピリオドを付けたホスト名で名前解決できればいいので、hosts (%systemroot%\system32\drivers\etc\hosts) のエイリアスでアドホックに対応可能です。このサーバーはワークグループ設定なので正式な FQDN が存在せず、サーバーとクライアントの hosts ファイルに以下のようなエントリを追加する方法で対処しています。NetWeaver は、SAPLOCALHOSTFULL に指定されたホスト名が名前解決できなかった場合は起動に失敗するのでサーバー側にも必ず hosts を設定します。

 
```
192.168.2.10    win2008-nw702    win2008-nw702.sap.local
```
 
再起動が終わったら、SAP GUI でログオンし、トランザクション SMICM を実行して ICM の状況を確認します。トランザクション実行後、メニューから Goto &gt; Services を選択して、こんな感じになってれば OK。 HTTP サービスが有効になっています。SMTP は今回は使いません。SAP からメールを送れるようになってけっこう面白いので、これもいつか紹介します。 <br />
![]({{site.assets_url}}2011-03-06-image17.png)

 
次に利用する SICF サービスを有効します。通常であればトランザクション SICF から1 つずつやっていくところですが、まずは SICF_INST を実行します。 <br />
![]({{site.assets_url}}2011-03-06-image18.png)

 
F4 押すと、選択肢が表示されます。 いわゆる 「F4 ヘルプ」 ですね。 <br />
![]({{site.assets_url}}2011-03-06-image19.png)

 
ここでは以下の 5 つをそれぞれ選択して、有効化します。複数選択はできないので、5 回繰り返します。

 
- BSPBASIS 
- WEB DYNPRO ABAP 
- WEB DYNPRO ABAP DESIGN TIME 
- WEB DYNPRO ABAP TEST APPS 
- WEB DYNPRO DBA COCKPIT 

 
それぞれの Technical Name と ICF サービスは 1:N で結びついています。対応はテーブル ICFINSTACT の内容から見ることができます。 <br />
![]({{site.assets_url}}2011-03-06-image20.png)

 
次に、SICF_INST には含まれない ICF を個別に有効化します。トランザクション SICF を実行し、最初の画面ではそのまま F8 キーを押してください。

 
こんな画面になります。 <br />
![]({{site.assets_url}}2011-03-06-image21.png)

 
ツリー構造になっているのが SICF サービス群です。ツリーを開いて以下のサービスを見つけ、右クリックして &#x5b;Activate Service&#x5d; を選択してください。

 
- default_host/sap/public/bc/its/mimes 
- default_host/sap/bc/gui/sap/its/webgui 
- default_host/sap/bc/webdynpro/sap/APPL_SOAP_MANAGEMENT 

 
こんなダイアログが出てくるので、左から 2 番目の &#x5b;Yes&#x5d; をクリックしてください。左端の &#x5b;Yes&#x5d; との違いは、サブツリーのサービス全てを有効化してくれることです。分かりにくいですね。 <br />
![]({{site.assets_url}}2011-03-06-image22.png)

 
次に、トランザクション SE38 を実行し、ABAP プログラム W3_PUBLISH_SERVICES を実行してください。 <br />
![]({{site.assets_url}}2011-03-06-image23.png)

 
このまま F8 を押します。 <br />
![]({{site.assets_url}}2011-03-06-image24.png)

 
F5 を押して全選択してから、F7 を押して Publish します。 <br />
![]({{site.assets_url}}2011-03-06-image25.png)

 
このプログラム W3_PUBLISH_SERVICES では、ITS コンポーネントのパブリッシュ（デプロイ）を行ないます。GUI for HTML (webgui) を使うための準備です。webgui は、ITS の時代からある技術で、SAP GUI の画面を HTML の画面に 1:1 対応させるなかなか凄い技術です。webgui はまだ ITS サービスとしての一面が残っていて、一部の機能を使うためには、画像ファイルなどを統合 ITS 上にデプロイしなければいけません。先にも述べましたが、統合 ITS はデータベース上の特殊なリポジトリからファイルを読み込みます。それが MIME リポジトリというもので、上で有効化した default_host/sap/public/bc/its/mimes が MIME リポジトリにあたります。これを使うことで、HTTP 経由で MIME リポジトリから画像データなどを読み込めるようになります。

 
統合 ITS については、以下のページも参考になります。 <br />
[http://help.sap.com/saphelp_nw70ehp1/helpdata/en/a6/cf3d4050d89523e10000000a1550b0/frameset.htm](http://help.sap.com/saphelp_nw70ehp1/helpdata/en/a6/cf3d4050d89523e10000000a1550b0/frameset.htm)

 
これで準備は完了です。

 
まずは、WebDynpro for ABAP の標準的な画面として、SOA Manager の画面を見てみます。SAP GUI からトランザクション SOAMANAGER を実行してください。自動的にブラウザが起動してきます。ホスト名が SAPLOCALHOSTFULL で指定したホスト名になっていて、ポート番号は 8000 になっていることを確認して下さい。&#x5b;Log On&#x5d; をクリックします。 <br />
![]({{site.assets_url}}2011-03-06-image26.png)

 
ログオン画面が出てきます。ここでは SAP ユーザー アカウントを入力します。ログオン対象のクライアントは、前のログオンの画面に表示されていた通り、001 です。 <br />
![]({{site.assets_url}}2011-03-06-image27.png)

 
こんな画面が出れば OK です。 <br />
![]({{site.assets_url}}2011-03-06-image28.png)

 
SOAMANAGER というトランザクションは、Web サービスのパブリッシュなどを行なう比較的新しいトランザクションで、SAP GUI からは操作することができず、ブラウザから操作するようになっています。全てというわけではありませんが、新しいトランザクションはウェブベースで、というのがトレンドです。

 
この画面は WebDynpro for ABAP という、SAP 独自のフレームワークで書かれています。画面に表示されるボタンなどのコントロールや、ABAP とのデータの連携などを簡単に作れる技術です。

 
試しに Google Chrome で開いたら、プロパティシートの他のタブにはコントロールが描画されませんでした。ちなみにさっきのブラウザは IE8 です。時代と逆の対応を見せる SAP は素敵です。 

 
![]({{site.assets_url}}2011-03-06-image29.png)

 
話題の IE9 で開いてみました。こちらは問題なし。

 
![]({{site.assets_url}}2011-03-06-image30.png)

 
エンタープライズ ユーザーは、やはり IE なんですかね。

 
WebDynpro for ABAP の標準的な画面の次に、GUI for HTML を見てみます。次の URL に直接アクセスして下さい。 <br />
http://&lt;SAPLOCALHOSTFULL で指定したホスト名&gt;:8000/sap/bc/gui/sap/its/webgui

 
![]({{site.assets_url}}2011-03-06-image31.png)

 
どうでもいい話ですが、このログオン画面に出てくる人が、ジョージ・クルーニーか、髪が生えているときのスタンリー・トゥッチに似ているとしか考えられません。絶対似てる。

 
それはさておき、さきほどと同様に &#x5b;Log On&#x5d; をクリックしてログオンします。

 
これが GUI for HTML です。

 
![]({{site.assets_url}}2011-03-06-image32.png)

 
NetWeaver 7.02 になって、さらに見た目が綺麗になりました。昔は全然使えない代物でしたが、これならけっこうありです。しかしよくもまあ GUI の画面をここまで再現したものです。

 
比較的複雑なトランザクション SE80 を実行して、適当なプログラムを開いてみました。この程度なら普通に動く。

 
![]({{site.assets_url}}2011-03-06-image33.png)

 
SE80 は Chrome でも動きます。プロパティ シート コントロールがダメなのでしょう。

 
![]({{site.assets_url}}2011-03-06-image34.png)

 
もちろん IE9 でも余裕。

 
![]({{site.assets_url}}2011-03-06-image35.png)

