---
layout: post
title: "Setting up a transparent proxy over SSL #4 – netcat/socat"
date: 2015-01-10 07:35:34.000 +09:00
categories:
- Linux
- Network
- Security
tags:
- ncat
- netcat
- nmap
- socat
---

ここまで Squid で透過/非透過プロキシを設定しました。原理的に SSL だとプロキシできないことも分かりました。で、お前は一連の作業で一体何をしたいんだ、ということを白状すると、MITM (= Man-in-the-middle attack; 中間者攻撃) の環境を 1 から用意しようとしていました。クライアントとサーバーの間のネットワークに侵入して、パケットを盗んだり改竄したりする攻撃手法です。MITM を作るためのツールやプラットフォームは多々あるのでしょうが、それらを使わずに実現したいのです。

 
調べていくと、Linux カーネルのネットワーク実装がとても柔軟で、iptables コマンドを使えば NAT や IP マスカレードが自由に行えることが分かりました。この時点で、NIC を 2 枚持つ Linux マシンを立ててカーネルを弄れば、お好みの MITM 環境が完成♪ ということになります。しかし、私自身がまだ Linux カーネルとはよい関係を築けていないので、できればユーザー モードでやりたい、という考えがありました。しかも iptales の実装は魔境だという情報もありましたし。そこで、適当なオープン ソースのプロキシ サーバー (今回は Squid) を使えば、ソケットのやり取りとかの面倒な部分は省いて、純粋にデータだけを弄れるんじゃないかという発想になりました。しかしこれまで説明したように、SSL の場合はプロキシではなくトンネリングになります。でも今回の目的であればトンネリングだとしても、SSL パケットがユーザー モードの Squid を通過するので全く問題がありません。むしろ好都合なぐらいです。

 
Squid のコードを見ると、トンネリングは ClientHttpRequest::processRequest の中で HTTP CONNECT メソッドを検出したときに tunnelStart() を呼ぶところから始まるようです。しかし CONNECT は非透過プロキシでは使われません。MITM をするのにプロキシの設定が必要、なんてのはさすがにかっこ悪いものです。

 
透過プロキシのポートに SSL のパケットを流入させると、Squid はパケットの内容が読めないのでエラーを出力します。このエラーは、parseHttpRequest() から HttpParserParseReqLine() を呼んで、戻り値が -1 になることで発生しています。HTTP メッセージのパースは、HttpParser::parseRequestFirstLine() で行われていますが、この関数は HTTP ペイロードをテキストだと想定して "HTTP/" といった文字列を検索しています。実際にデバッガーで確認すると、SSL パケットが来たときには HttpParser::buf の内容が "16 03 00 00 35 01 00 00 ..." のように SSL Client Hello の内容になっています。したがって、HTTP のパースの時に Client Hello を見つけたらトンネリングを開始するように実装を変えれば、Squid は透過プロキシとして、SSL ではトンネリングを行なうようにできます。

 
しかしここまで考えると、トンネリングなんてデータを受け流すだけの簡単なお仕事であり、わざわざ Squid のような大きなプログラムを変更するのは労力の無駄に思えます。2 つソケットを用意して何も考えずに双方向にデータを転送すればいいのだから、むしろ 1 からプログラムを書いた方が簡単、というか絶対誰かそういうのを作っているはず、ということで見つけました。netcat 及び socat というプログラムです。

  
### 4.socat による TCP リレー

 
netcat には流派があり、使えるオプションがそれぞれ異なります。少なくとも以下の 3 種類見つけました。

 
- GNU Netcat (TCP/IP swiss army knife) <br />
netcat-traditional とも呼ばれる。VyOS には /bin/nc.traditional というファイル名でインストールされている。 
- OpenBSD Netcat <br />
Ubuntu Server に /bin/nc.openbsd というファイル名でインストールされている。nc というエイリアスで実行すると大体これ。 
- NMap Netcat <br />
NMap という素敵なツールと一緒に開発されている。ncat というエイリアスで実行すると大体これ。 

 
netcat の便利なところは、ストリーム ソケットからのデータを標準出力や標準入力などのストリームに転送でき、スクリプトやプログラムに渡せるところです。今回実現させたいのは、ルーティングによってプロキシ サーバーに来た 443/tcp ポート宛てのパケットを、本来の Web サーバーに渡すことです。ただし、前回の記事の後半で試しましたが、VyOS からやってきた 80/tcp ポート宛てのパケットは、そのままだと Squid が受信することはできず、iptables によるポート転送が必要でした。今回も同様と考えられるので、プロキシ サーバー側で 443/tcp ポート宛てのパケットは 3130/tcp に転送することにします。これでプロキシ サーバーが待機するポートは 3 つになります。

 
- 3128/tcp -- Squid 非透過プロキシ用ポート (HTTP だとプロキシ、HTTP CONNECT が来るとトンネリングを開始) 
- 3129/tcp -- Squid HTTP 透過 プロキシ用ポート 
- 3130/tcp -- 443/tcp パケットのトンネリング用 

 
この後行ないたいのは、3130/tcp ポートに来たパケットを Web サーバーにリレーすることです。これは以下のコマンドで実現できます。3130/tcp ポートで待機しておいて、パケットが来たら新たに ncat プロセスを起動して、Web サーバーの 443/tcp ポートに送信するというコマンドです。ここで使っている -e オプションは NMap Netcat 特有のものです。

 
```
$ ncat -e "ncat www.somewhere.com 443" -l 3130 -k
```
 
しかしここで非透過プロキシのときと同じ、「宛先の Web サーバーはどこにすればいいのか」 という問題が出てきます。これについては後で書くことにして、ここでは標的を決め打ちして、とりあえず全部 [https://ubuntu-web.cloudapp.net/](https://ubuntu-web.cloudapp.net/) に転送するようにしておきます。

 
Ubuntu Server に NMap Netcat は入っていないので、インストールから行ないます。後でコードを変更する可能性があるので、ソースからビルドします。本家サイトは以下。2015/1/9 現在の最新版は 6.47 です。

 
Download the Free Nmap Security Scanner for Linux/MAC/UNIX or Windows <br />
[http://nmap.org/download.html](http://nmap.org/download.html)

 
実行したコマンドは以下の通り。ncat だけ使えればいいので、外せるものは外しました。OpenSSL はビルドしたものをリンクさせます。

 
```
$ wget http://nmap.org/dist/nmap-6.47.tar.bz2 
$ tar -jxvf nmap-6.47.tar.bz2 
$ cd nmap-6.47/ 
$ ./configure --prefix=/usr/local/nmap/nmap-6.47 \ 
> --with-openssl=/usr/local/openssl/current \ 
> --without-ndiff \ 
> --without-zenmap \ 
> --without-nping \ 
> --without-liblua \ 
> --without-nmap-update 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/nmap/nmap-6.47 /usr/local/nmap/current 
$ sudo ln -s /usr/local/nmap/current/bin/ncat /bin/ncat
```
 
make install を行なうと、strip コマンドが実行され、シンボル情報が消されてからインストールが行われます。インストールした後のバイナリでデバッグを行う場合には、Makefile を変更する必要があります。

 
```
install: $(TARGET) 
        @echo Installing Ncat; 
        $(SHTOOL) mkdir -f -p -m 755 $(DESTDIR)$(bindir) $(DESTDIR)$(mandir)/man1 
        $(INSTALL) -c -m 755 ncat $(DESTDIR)$(bindir)/ncat 
        # $(STRIP) -x $(DESTDIR)$(bindir)/ncat 
        if [ -n "$(DATAFILES)" ]; then \ 
                $(SHTOOL) mkdir -f -p -m 755 $(DESTDIR)$(pkgdatadir); \ 
                $(INSTALL) -c -m 644 $(DATAFILES) $(DESTDIR)$(pkgdatadir)/; \ 
        fi 
        $(INSTALL) -c -m 644 docs/$(TARGET).1 $(DESTDIR)$(mandir)/man1/$(TARGET).1
```
 
インストールはこれで終わりです。プロキシ サーバー上でポート転送の設定を行います。

 
```
$ sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 443 \ 
> -j REDIRECT --to-port 3130 
john@ubuntu-proxy:~$ sudo iptables -t nat -L 
Chain PREROUTING (policy ACCEPT) 
target     prot opt source               destination 
REDIRECT   tcp  --  anywhere             anywhere             tcp dpt:http redir ports 3129 
REDIRECT   tcp  --  anywhere             anywhere             tcp dpt:https redir ports 3130

Chain INPUT (policy ACCEPT) 
target     prot opt source               destination

Chain OUTPUT (policy ACCEPT) 
target     prot opt source               destination

Chain POSTROUTING (policy ACCEPT) 
target     prot opt source               destination 
john@ubuntu-proxy:~$
```
 
次に、VyOS 上で、80/tcp に加えて 443/tcp もプロキシ サーバーにルーティングされるようにルールを追加します。

 
```
$ configure 
# set policy route PROXYROUTE rule 110 protocol tcp 
# set policy route PROXYROUTE rule 110 destination address 0.0.0.0/0 
# set policy route PROXYROUTE rule 110 destination port 443 
# set policy route PROXYROUTE rule 110 source address 10.10.0.0/16 
# set policy route PROXYROUTE rule 110 source mac-address !00:15:5d:01:02:12 
# set policy route PROXYROUTE rule 110 set table 100 
# commit 
# save 
# exit 
$
```
 
あとは ncat を起動するだけです。とても高機能ではありますが、言ってしまえば Netcat は単なるソケット通信プログラムなので、root 権限は必要ありません。

 
```
$ ncat -version 
Ncat: Version 6.47 ( http://nmap.org/ncat ) 
Ncat: You must specify a host to connect to. QUITTING. 


$ ncat --listen 3130 --keep-open \ 
> --exec "/usr/local/nmap/current/bin/ncat ubuntu-web.cloudapp.net 443"
```
 
外部プログラムを起動するオプションには、--exec (-e) と --sh-exec (-c) の 2 種類があります。前者は実行可能ファイルを直接実行するオプションで、後者はシェル経由でプロセスを実行します。今回はスクリプトを使う予定はないので、シェルを介在することのオーバーヘッドを嫌って --exec を使いました。そのため、相対パスではなく絶対パスが必要です。

 
クライアント側でプロキシの設定がされていないことを確認し、[https://ubuntu-web.cloudapp.net/](https://ubuntu-web.cloudapp.net/) にアクセスできることを確認します。また、ncat を終了するとサイトにアクセスできなくなります。今回はオリジナルの宛先に関わらず、全部のパケットを ubuntu-web に転送するので、それ以外の HTTPS サイトを見ることはできません。本来は VyOS の PBR、もしくはプロキシ サーバーの iptables で、宛先の IP アドレスによるフィルタリングが必要です。

 
これで、MITM の環境はほぼ整いました。ですが、リレーするのにわざわざ新しいプロセスを起動するのがスマートではありません。もっと単純に、2 つのソケットを扱えるプログラムはないのかと探したところ、見つけました。それが socat です。なんと、はてな検索のサイトで見つけました。

 
Linux で、TCP 接続に (というか IP パケットに) 何も手を加えず… - 人力検索はてな <br />
[http://q.hatena.ne.jp/1262698535](http://q.hatena.ne.jp/1262698535)

 
socat の本家サイトはこちらです。nmap や socat に関しては、ペネトレーション テストという名のものとで行われるハッキング ツールとも言えそうです。サイトも玄人志向な感じです。

 
socat <br />
[http://www.dest-unreach.org/socat/](http://www.dest-unreach.org/socat/)

 
ncat が手を一本しか持っていないのに対し、socat は二本持っています。まさに探していたものです。さっそくビルドします。2015/1/9 現在の最新バージョンは 1.7.2.4 です。デフォルトでコンパイル オプションに -g が付かないので、configure のときに明示的につけておきます。

 
```
$ wget http://www.dest-unreach.org/socat/download/socat-1.7.2.4.tar.bz2 
$ tar -jxvf socat-1.7.2.4.tar.bz2 
$ cd socat-1.7.2.4/ 
$ CFLAGS="-g -O2" ./configure --prefix=/usr/local/socat/socat-1.7.2.4 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/socat/socat-1.7.2.4 /usr/local/socat/current 
$ sudo ln -s /usr/local/socat/current/bin/socat /bin/socat 
```
 
TCP リレーを行うためのコマンドは以下の通りです。これはかなり直観的です。素晴らしい。

 
```
$ socat TCP-LISTEN:3130,fork TCP:ubuntu-web.cloudapp.net:443
```
 
socat は、ソケットが閉じられたときにプロセスが終了するように作られています。一回の起動で複数のセッションを処理するためには、fork キーワードが必要です。こうすることで、セッション開始時にプロセスをフォークしてくれるので、次のセッションにも対応できるようになります。この仕様は不便なようにも感じますが、プロセスが処理しているセッションが必ず一つに限られるので、デバッグは楽になりそうです。

 
socat の中で実際にデータを扱っている関数は xiotransfer() です。ここで buff を弄れば、好きなようにパケットを改竄できます。シンプルでいい感じ。

 
これで環境はできました。残る課題は、転送先のアドレスを知る方法です。まだ実装していませんが、実現できそうなアイディアはあります。前回の記事の最後でパケットを採取しました。このとき、PBR によって VyOS から Squid サーバーに送られてきたパケットの先頭の宛先 IP アドレスは、tcpdump がデータを採取した段階ではまだ最終目的地の Web サーバーになっていました。これが iptables のルールを受けて変更され、Squid が受け取った時には宛先アドレスは分からなくなってしまうのです。つまり、プロキシ サーバーの OS 視点から見ればオリジナルのアドレスは分かっているのです。あくまでも、Squid などのユーザー モードから見えない、というだけの話です。

 
ソケット プログラミングでサーバーを書くときの基本の流れは、socket() --&gt; bind() --&gt; listen() --&gt; accept() --&gt; recv() となります。accept() を呼ぶと待ち状態に入って、データを受信すると制御が返ります。bind() のところで、待機する IP アドレスやポートを指定できますが、IP アドレスには INADDR_ANY を指定すると、すべてのインタフェースからのデータを受信できるようになります。マシンが複数の IP アドレスを持っている場合、データを受信した後に、どの IP アドレスでデータを受信したのかを知りたいことがあります。そんなときは、accept() の戻り値に対して getsockname() 関数を呼び出すことができます。

 
getsockname(2): socket name - Linux man page <br />
[http://linux.die.net/man/2/getsockname](http://linux.die.net/man/2/getsockname)

 
試しに、PBR されてきたパケットに対して getsockname() を呼び出してみましたが、返ってきたのはオリジナルの宛先アドレスではなく、やはり自分のアドレスに変更されていました。まだ試していませんが、以下のページに説明がある IP_ORIGDSTADDR メッセージを取得すれば、オリジナルのアドレスを取得できそうなのですが、今のところ上手く動いてくれません。もし駄目だった場合は、Linux カーネルを弄るしかないようです。

 
ip(7): IPv4 protocol implementation - Linux man page <br />
[http://linux.die.net/man/7/ip](http://linux.die.net/man/7/ip)

 
<font color="#0000ff">(2015/1/19 追記)     <br>以下の記事に書きましたが、オリジナルのアドレスは getsockopt に対して SO_ORIGINAL_DST オプションを渡すことで簡単に取得できました。IP_RECVORIGDSTADDR/IP_ORIGDSTADDR に関しては、カーネルのコードを見ると ip_cmsg_recv_dstaddr というそれっぽい関数があるのですが、ip_recv_error 経由でしか呼び出されません。ユーザー モード側からフラグとして MSG_ERRQUEUE を渡して recvmsg を呼ぶと、ip_recv_error にたどり着くところまでは確認しました。あまり深く追いかけていませんが TCP のストリーム ソケットに対して IP_ORIGDSTADDR を使うことは想定されていないようです。</font>

 
How to get the original address after NAT | すなのかたまり <br />
[https://msmania.wordpress.com/2015/01/15/how-to-get-the-original-address-after-nat/](https://msmania.wordpress.com/2015/01/15/how-to-get-the-original-address-after-nat/)

 
最後に補足情報を。SSL の透過プロキシについて調べているときに、以下の OKWave の質問スレッドを見つけました。この中のアイディアが面白かったので紹介します。

 
透過型プロキシのHTTPS通信 【OKWave】 <br />
[http://okwave.jp/qa/q6553861.html?by=datetime&order=ASC#answer](http://okwave.jp/qa/q6553861.html?by=datetime&order=ASC#answer)

 
```
クライアントからCONNECTリクエストを受信したのち，本来のCONNECT先のホスト名のサーバとSSLハンドシェイクを行って，サーバ証明書を取得し，それと同じCNを持つ証明書をつくり，プロキシが署名します．で，それを使ってクライアントとsslハンドシェイクします．クライアントには，プロキシの署名が信頼できるものだとするために，ルート証明書をインストールしておきます．つまり，プロキシはCONNECTが来るまで，どのサーバに接続するかしらないということです．
```
 
同じ CN を持つ証明書を動的に作るというアイディアは、ルート証明書の課題があるとは言え、問題なく実装できそうです。自分の銀行のオンライン バンクのサイトが、どの認証局によって署名されているかなんて誰も知らないでしょうし。もし上記のような MITM 攻撃を受けると、クライアントからは、本来の認証局とは違う認証局の署名を持つ証明書を受け取ることになります。もちろん、OS にもともと入っているような真っ当な認証局であれば、証明書署名要求にある CN 名のドメインのオーナーの身分調査などをしっかり行うはずなので、既に存在する CN 名を持つ証明書には署名を行わないはずです。

 
ただし、多くのユーザーは SSL の仕組みや、サイトにアクセスしたときに出てくる証明書に関する警告メッセージの詳細なんて知りません。オンライン バンクにアクセスしたときに、信頼されていないルート証明書による署名が検出された、という警告が出たとして、構わず OK をクリックするユーザーは一定数いるはずです。万が一、有名な認証局の秘密鍵が盗まれたとすると、この攻撃手法が完全に有効になり、クライアント側からは MITM の有無を区別することは不可能になります。商用 CA やインターネットの世界でなくても、例えば企業の IT 部門に悪意あるものが侵入するということがあり得ます。企業が Active Directory を導入していれば、グループ ポリシーを少し弄って、自分の作ったルート証明書を配布してしまうことは可能です。

 
このように MITM は現在でもとても有効な攻撃手法です。例えば自分がカフェのオーナーだったとして、店舗に WiFi アクセスポイントを設置して、ルーターにちょこちょこっと細工をすれば簡単に MITM は実装できてしまいます。自分がオーナーじゃなくても、例えば企業内のどこかに置かれているルーターのところに行って、LAN ケーブルをささっと繋ぎ直して、おれおれルーターを設置する、ということも可能かもしれません。

 
セキュリティや IT の世界でも、情報の非対称性の存在が顕著だと言えそうです。(結論それか

