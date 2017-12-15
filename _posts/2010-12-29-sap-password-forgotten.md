---
layout: post
title: "[SAP on Windows] パスワードを忘れたときは"
date: 2010-12-29 14:08:18.000 +09:00
categories:
- SAP
tags:
- MaxDB
- NetWeaver
---

日々のパスワード管理は大変です。NetWeaver に至っては、OS, RDBMS, SAP ユーザーと、ユーザーアカウントも多様なので、覚えるのが大変です。”sap password forgot” で検索をかけると、国を問わず、人々はパスワードを忘れているようです。忘れる以外にありがちなのは、インストール時に想定外の文字列を入力してしまった場合など。SAPinst のパスワード入力欄はコピー アンド ペーストが可能なので、ひたすらコピーでインストールを進めると、コピー元の文字列が違っていたらアウト、一発退場です。

 
運用環境であれば、パスワードはきっちり管理されているので問題ないとは思いますが、NSP のように軽い気持ちでインストールする場合は要注意です。大昔にインストールして、久々に使おうとしたらパスワードを忘れていた、ということも多いでしょう。さて、パスワードを忘れてしまった場合は一体どこまで復旧可能なのでしょうか。

 
実は、Windows の Administrator のパスワードさえ分かれば、以下全てのユーザーの復旧が可能です。といっても、パスワードをリセットすることができるだけで、元のパスワードは神のみぞ知る、です。

 
- Windows ユーザー (&lt;sid&gt;adm, SAPService&lt;SID&gt;)
- 全クライアントの SAP ユーザー
- MaxDB ユーザー (DBM Operator, Database User)

 

 
### Windows ユーザーのパスワードを忘れた！！

 
Windows パスワードは単純です。NetWeaver 側で管理されているわけではないので、Administrator などでログオンして Windows ユーザーのパスワードを再設定し、サービス起動アカウントを再入力するだけです。お馴染みの以下のダイアログにパスワードを入れ直して終了です。 <br />
![]({{site.assets_url}}2010-12-29-ws0021.png)

 
### SAP ユーザーのパスワードを忘れた！！

 
他の管理者アカウントが生きていれば、SU01 からリセットするだけで済む話ですが、クライアントの全ユーザーのパスワードが分からなくなった場合は、そもそもログオンできません。こんなときは、SAP* ユーザーのパスワードをリセットしてログオンすることができます。クライアント コピーを実行したことがある人にはお馴染みの方法です。

 
まずは、以下のプロファイル パラメーターをデフォルト プロファイルかインスタンス プロファイルに設定します。デフォルト値は 1 なので、明示的に設定しましょう。このプロファイルを有効にするためにはインスタンス再起動が必要なので、再起動して下さい。

 
```
login/no_automatic_user_sapstar = 0
```
 
次に、以下の SQL クエリを実行して下さい。MaxDB には SQL Studio という GUI 形式の SQL クライアントがあり、NSP にも付属しているので、それを使うと便利です。Database Studio でもよいです。

 
```
update usr02 set bname=’SAPSTAR’ where bname=’SAP*’ and mandt=’<該当するクライアント>’
```
 
例えば、クライアント 000 と 001 で同コマンドを実行した場合です。SAP* という行が SAPSTAR に変わっています。 <br />
![]({{site.assets_url}}2010-12-29-ws000.png)

 
これにより SAP* のパスワードがリセットされ、パスワードは pass になります。クライアント 000 や 001 でも pass になります。SAP* でログオンできれば、SU01 が使えます。DDIC などの管理者アカウントでログオンできるようになったら、上記の UPDATE 文で退避しておいた SAP* の行を元に戻し、SU01 でパスワードを再設定すれば完了です。インターネット検索でも、USR02 を編集する方法は数多く紹介されていますが、DELETE 文で SAP* の行を消してしまう荒業が紹介されていたりします。もちろん同じ結果にはなりますが、SAP* アカウントを新規作成するのは微妙です。UPDATE で退避する方法をお勧めします。

 
テーブル USR02 には、SAP ユーザー パスワードのハッシュキーが記録されています。SAP ユーザーは、このテーブルのハッシュを照合することで認証されます。しかし、プロファイル login/no_automatic_user_sapstar が 0 に設定されている場合は、 キーが存在しないときの SAP* ユーザーにはデフォルトの pass というパスワードが設定されます。クライアント コピーではお馴染みの知識ですが、実はクライアント 000 でも同様のことが可能です。ただしこれは、NetWeaver 7.0 EhP1 で、バージョンによって仕様が変化する可能性が高い部分です。なお、USR01 などの他のテーブルは一切変更しません。

 
### MaxDB のアカウントを忘れた！！

 
一番厄介なケースです。そもそも MaxDB の知名度が低いですね。まあ私も大して知りません。そもそも MaxDB にはどんなユーザーがいるかご存知でしょうか。アカウントは 2 種類あり、NSP インストール直後は以下のようになっています。

 


- DBM Operator: SUPERDBA, CONTROL

 
 - Database User: SUPERDBA, SAPNSP
 
 

 
MaxDB には xuser という仕組みがあり、インストールしたときのアカウント情報がレジストリに保存され、パスワードを入力しなくても管理コンソールにログオンすることができます。Oracle の conn / as SYSDBA と同じような仕組みです。&lt;sid&gt;adm ユーザーでログオンして、コマンド xuser list を入力すると以下のような出力を得ます。

 
```
> xuser list

----------------------------------------------------------------- 
XUSER Entry  1 
-------------- 
Key         : DEFAULT           
Username    :SAPNSP 
UsernameUCS2:S.A.P.N.S.P. . . . . . . . . . . . . . . . . . . . . . . . . . . 
Password    : ????????? 
PasswordUCS2:????????? 
Dbname      :NSP  
Nodename    :win2008-nw701                     
Sqlmode     :SAPR3   
Cachelimit  :-1 
Timeout     :0 
Isolation   :0 
Charset     :<unspecified>     
----------------------------------------------------------------- 
XUSER Entry  2 
-------------- 
Key         :c     
Username    :CONTROL   
UsernameUCS2:C.O.N.T.R.O.L. . . . . . . . . . . . . . . . . . . . . . . . . . 
Password    : ????????? 
PasswordUCS2:????????? 
Dbname      :NSP  
Nodename    :win2008-nw701         
Sqlmode     :SAPR3   
Cachelimit  :-1 
Timeout     :0 
Isolation   :0 
Charset     :<unspecified>     
----------------------------------------------------------------- 
XUSER Entry  3 
-------------- 
Key         :c_J2EE     
Username    :CONTROL     
UsernameUCS2:C.O.N.T.R.O.L. . . . . . . . . . . . . . . . . . . . . . . . . . 
Password    : ????????? 
PasswordUCS2:????????? 
Dbname      :NSP    
Nodename    :win2008-nw701     
Sqlmode     :SAPR3   
Cachelimit  :-1 
Timeout     :0 
Isolation   :0 
Charset     :<unspecified>     
----------------------------------------------------------------- 
XUSER Entry  4 
-------------- 
Key         :w   
Username    :SUPERDBA           
UsernameUCS2:S.U.P.E.R.D.B.A. . . . . . . . . . . . . . . . . . . . . . . . . 
Password    : ????????? 
PasswordUCS2:????????? 
Dbname      :NSP    
Nodename    :win2008-nw701   
Sqlmode     :SAPR3   
Cachelimit  :-1 
Timeout     :0 
Isolation   :0 
Charset     :<unspecified>     
```
 
これがレジストリに保存されているアカウント情報です。SAPNSP, CONTROL, SUPERDBA という 3 つのアカウントが全て保存されていることが分かります。これらのアカウントは key という文字列で管理/識別されます。DEFAULT, c, c_J2EE, w という値です。アカウントのパスワードを忘れても、これらの xuser エントリを使って CUI の管理ツールにログオンし、パスワードを変更することができます。

 
CONTROL アカウントは純粋な DBM Operator なので、データベースが起動していなくてもパスワードの変更が可能です。しかし、SUPERDBA や SAPNSP は、Database User なので、データベースが起動していないとパスワードを変更することができません。しかし Windows の場合は、MaxDB インスタンスはサービスとして 起動できるので、起動停止時に MaxDB アカウントは不要です。

 
![]({{site.assets_url}}2010-12-29-ws009.png)

 
パスワードを忘れてしまった場合は、サービス起動によりデータベースを起動してから、以下のようにコマンドを実行します。

 
```
>dbmcli -U c -n localhost 
dbmcli on localhost : NSP>user_getall 
OK 
CONTROL 
SUPERDBA

--- 
dbmcli on localhost : NSP>user_put control set password=新パスワード 
OK

--- 
dbmcli on localhost : NSP>user_put superdba set password=新パスワード 
OK

--- 
dbmcli on localhost : NSP>exit 
OK

---

>
```
 
dbmcli というのが MaxDB の CUI 管理ツールです。MaxDB をインストールすると、自動的にインストールされます。これで superdba と control ユーザーのパスワードがリセットできました。SAPNSP ユーザーは、この方法では変更できないので、今回は Database Manager の GUI で変更します。コマンドもありそうですが、方法を知りません。

 
Database Manager を起動し、&#x5b;Configuration&#x5d; &gt; &#x5b;Database User...&#x5d; をクリックします。 <br />
![]({{site.assets_url}}2010-12-29-ws005.png)

 
データベース管理者アカウントを聞かれるので、SUPERDBA アカウントを入力して &#x5b;Next&#x5d; をクリックします。CONTROL アカウントは、管理者ではないのでここでは使えません。 <br />
![]({{site.assets_url}}2010-12-29-ws006.png)

 
SAPNSP をダブルクリックします。 <br />
![]({{site.assets_url}}2010-12-29-ws007.png)

 
&#x5b;Change&#x5d; ボタンをクリックすると、パスワード変更画面が表示されます。 <br />
![]({{site.assets_url}}2010-12-29-ws008.png)

 
これで MaxDB アカウントのパスワードは全てリセットできました。が、これだけだとダメです。先にちらっと書きましたが、パスワード情報が xuser エントリとしてレジストリに保存されていて、それも変更しないと後々困ります。特に、SAPNSP に該当する xuser エントリは NetWeaver が MaxDB に接続するときに使っているので、SAPNSP のパスワードを変更しただけだと NetWeaver が起動しなくなります。NetWeaver が MaxDB に接続するときはワーク プロセスの実体である disp+work.exe が SAPNSP アカウントを使ってアクセスしに行きます。xuser エントリが間違っている場合は、メッセージ サーバーの起動の後、disp+work の起動でコけます。

 
![]({{site.assets_url}}2010-12-29-ws0031.png)

 
ワーク プロセスの開発者トレースに以下のようなログが出力されます。dev_disp ではなく dev_w0 などに出力されるので注意。

 
```
C  Loading SQLDBC client runtime ... 
C  SQLDBC SDK Version : SQLDBC.H  7.6.0    BUILD 002-121-083-965 
C  SQLDBC Library Version : libSQLDBC 7.6.5    BUILD 011-123-196-300 
C  SQLDBC client runtime is MaxDB 7.6.5.011 CL 196300 
C  SQLDBC supports new DECIMAL interface : 0 
C  SQLDBC supports VARIABLE INPUT data   : 1 
C  SQLDBC supports keepAlive indicator   : 0 
C  INFO : SQLOPT= -I 0 -t 0 -S SAPR3 
C  Try to connect (DEFAULT) on connection 0 ... 
C  
C Wed Dec 29 13:36:40 2010 
C  *** ERROR => Connect to database failed, rc = -4008 (POS(1) Unknown user name/password combination) 
[dbsdbsql.cpp 137] 
B  ***LOG BY2=> sql error -4008  performing CON [dbsh#2 @ 1208] [dbsh    1208 ] 
B  ***LOG BY0=> POS(1) Unknown user name/password combination [dbsh#2 @ 1208] [dbsh    1208 ] 
B  ***LOG BY2=> sql error -4008  performing CON [dblink#2 @ 431] [dblink  0431 ] 
B  ***LOG BY0=> POS(1) Unknown user name/password combination [dblink#2 @ 431] [dblink  0431 ] 
M  ***LOG R19=> ThInit, db_connect ( DB-Connect 000256) [thxxhead.c   1449] 
M  in_ThErrHandle: 1 
M  *** ERROR => ThInit: db_connect (step 1, th_errno 13, action 3, level 1) [thxxhead.c   10563] 
M  
```
 
NetWeaver の起動に関連するのは SAP&lt;SID&gt; だけなので、SUPERDBA, CONTROL のパスワードをリセットするだけであれば、xuser エントリを更新しなくても NetWeaver の起動には問題ありません。が、そのままにしておくと、次回パスワードを忘れたときに手も足も出なくなります。

 
xuser エントリの一覧コマンドは xuser list でした。そして、xuser キーと MaxDB アカウントとの対比は以下のようになっていました。

 
- DEFAULT –&gt; SAPNSP
- c –&gt; CONTROL
- c_J2EE –&gt; CONTROL
- w –&gt; SUPERDBA

 

 

 
```
xuser -U DEFAULT clear 
xuser -U c clear 
xuser -U c_J2EE clear 
xuser -U w clear

xuser -u SAPNSP,パスワード -U DEFAULT -d NSP -n ホスト名 -S SAPR3 -t 0 -I 0 set 
xuser -u CONTROL,パスワード -U c -d NSP -n ホスト名 -S SAPR3 -t 0 -I 0 set 
xuser -u CONTROL,パスワード -U c_J2EE -d NSP -n ホスト名 -S SAPR3 -t 0 -I 0 set 
xuser -u SUPERDBA,パスワード -U w -d NSP -n ホスト名 -S SAPR3 -t 0 -I 0 set 
```
 

 

 
最後に、パスワードのリセット方法を表にまとめました。

 <table width="570" border="0" cellspacing="0" cellpadding="2"><tbody>     <tr>       <td width="132" valign="top">Windows ユーザー</td>        <td width="481" valign="top">Administrator でパスワードを変更         <br>サービス起動アカウントを変更</td>     </tr>      <tr>       <td width="132" valign="top">SAP ユーザー</td>        <td width="481" valign="top">プロファイル パラメータを設定         <br>インスタンス再起動          <br>UPDATE 文を実行して SAP* のパスワードを pass にリセット</td>     </tr>      <tr>       <td width="132" valign="top">MaxDB ユーザー</td>        <td width="481" valign="top">Windows サービスから MaxDB インスタンスを起動         <br>xuser エントリを利用して、CUI 管理コンソールでログオン (dbmcli -U c)          <br>user_put コマンドでパスワードを変更          <br>xuser エントリを更新</td>     </tr>   </tbody></table>