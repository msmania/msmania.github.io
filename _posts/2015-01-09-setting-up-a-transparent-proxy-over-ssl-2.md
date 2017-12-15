---
layout: post
title: "Setting up a transparent proxy over SSL #2 – squid"
date: 2015-01-09 07:29:50.000 +09:00
categories:
- Linux
- Network
tags:
- proxy
- squid
---

前回の記事で、VyOS をインストールした Hyper-V 仮想マシンをルーターとして使えるようになりました。次に HTTP プロキシを導入します。

 
### 2. squid による HTTP/HTTPS 非透過プロキシ

 
最終的に作るのは透過プロキシですが、先に非透過プロキシを作ります。ここで透過プロキシという単語の定義は曖昧なので注意が必要です。よく使われる意味としては 2 つあります。

 
1. クライアント側での設定変更を必要としないように構成されたプロキシ <br />
プログラムの種類ではなく、ネットワーク構成で区別されるプロキシの種類です。いろいろと検索した結果、この意味で使われることが多いです。英語でも transparent proxy と言えばこちらの意味が多い気がします。その他に intercepting proxy とも言います。 
1. 要求や応答を一切変更しないプロキシ <br />
HTTP/1.1 についての RFC 2616 ([http://tools.ietf.org/html/rfc2616](http://tools.ietf.org/html/rfc2616)) には、<em>A "non-transparent proxy" is a proxy that modifies the request or response</em> という部分があります。1. の意味とは違い、プログラムの種類につけられた名前です。どちらかというと 1. の意味で使われることの方が多い気がします。intercepting proxy と言ったときには 2. の意味は持ちません。 

 
日本語の wiki には 1. の意味しか載っていませんが、英語の方には両方載っています。

 
Proxy server - Wikipedia, the free encyclopedia <br />
[http://en.wikipedia.org/wiki/Proxy_server](http://en.wikipedia.org/wiki/Proxy_server)

 
プロキシの意味についても確認しておくと、サーバーとクライアントの間に入って通信を中継するプログラムのことです。RFC 2616 には、サーバーとしてもクライアントとしても動作する、と書かれています。通信を中継するためには、まずサーバーとして要求を受け取って、何か処理して、クライアントとして要求を送信することが必要だからです。プロキシとは英語で代理人を意味する単語ですが、これは、受け取った要求をそのまま送るのではなく、内容を変更するかどうかに関わらず、プロキシが自分を差出人として要求を再送信することからつけられた名前と考えられます。この定義にしたがうと、ルーティングのように、アドレス部分だけ書き換えて、ペイロードが同じパケットを受け流すようなプログラムはプロキシとは呼ばないことになります。

 
この記事、及びタイトルにおける transparent proxy は、1. の意味です。つまりクライアント側で設定を変更せずに、パケットを中継させるような環境を作ります。

 
今回は、Squid というオープン ソースのプログラムを選びました。検索して有名そうだったから、という理由だけです。イカのロゴかわいいし。

 
squid : Optimising Web Delivery <br />
[http://www.squid-cache.org/](http://www.squid-cache.org/)

 
インストールは、squid3 というパッケージを apt-get するだけでいいのですが、後々プロキシの動作を書き換えたい意図があったので、ソースからビルドすることにしました。2015/1/8 現在の最新バージョンである 3.4.10 をダウンロードします。

 
予め開発ツールである gcc や gdb をインストールしておきましょう。前に書いた記事が参考になると思います。

 
Apache Live-Debugging on Linux | すなのかたまり <br />
[https://msmania.wordpress.com/2014/12/23/apache-live-debugging-on-linux/](https://msmania.wordpress.com/2014/12/23/apache-live-debugging-on-linux/)

 
今回実行したコマンドはこのような感じです。ビルドされた OpenSSL が /usr/local/openssl/current にインストールされているという前提です。

 
```
$ sudo apt-get install build-essential libtool manpages-dev gdb 
$ wget http://www.squid-cache.org/Versions/v3/3.4/squid-3.4.10.tar.bz2 
$ tar jxvf squid-3.4.10.tar.bz2 
$ cd squid-3.4.10/ 
$ ./configure --prefix=/usr/local/squid/squid-3.4.10 \ 
> --with-openssl=/usr/local/openssl/current \ 
> --enable-ssl 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/squid/squid-3.4.10 /usr/local/squid/current
```
 
インストール後、Squid サーバーの実行可能ファイルは bin ではなく sbin の方の /usr/local/squid/current/sbin/squid になります。

 
```
john@ubuntu-proxy:~$ /usr/local/squid/current/sbin/squid -v 
Squid Cache: Version 3.4.10 
configure options:  '--prefix=/usr/local/squid/squid-3.4.10' '--with-openssl=/usr/local/openssl/current' '--enable-ssl'

john@ubuntu-proxy:~$ /usr/local/squid/current/sbin/squid -h 
Usage: squid [-cdhvzCFNRVYX] [-s | -l facility] [-f config-file] [-[au] port] [-k signal] 
       -a port   Specify HTTP port number (default: 3128). 
       -d level  Write debugging to stderr also. 
       -f file   Use given config-file instead of 
                 /usr/local/squid/squid-3.4.10/etc/squid.conf 
       -h        Print help message. 
       -k reconfigure|rotate|shutdown|restart|interrupt|kill|debug|check|parse 
                 Parse configuration file, then send signal to 
                 running copy (except -k parse) and exit. 
       -s | -l facility 
                 Enable logging to syslog. 
       -u port   Specify ICP port number (default: 3130), disable with 0. 
       -v        Print version. 
       -z        Create missing swap directories and then exit. 
       -C        Do not catch fatal signals. 
       -D        OBSOLETE. Scheduled for removal. 
       -F        Don't serve any requests until store is rebuilt. 
       -N        No daemon mode. 
       -R        Do not set REUSEADDR on port. 
       -S        Double-check swap during rebuild. 
       -X        Force full debugging. 
       -Y        Only return UDP_HIT or UDP_MISS_NOFETCH during fast reload. 
```
 
上記 -h の出力にあるように、何も指定しなければ etc/squid.conf が設定ファイルとして勝手に読み込まれます。

 
設定ファイルを変更する前に、ここで実現したいことを確認しておきます。前回構築した VyOS も含め、下図のようなネットワークができました。

 
![]({{site.assets_url}}2015-01-09-capture.png)

 
Client からインターネットに接続するには、Hyper-V 仮想ネットワークの Internal から External に出るための VyOS によるルーターと、家の LAN からインターネットに出るための物理ルーターの 2 つのルーターを通る必要があります。ただし、今回の記事において Hyper-V の External から先はほとんど意識する必要がありません。

 
Squid を入れたプロキシ サーバーは、Client と同じように Hyper-V 仮想マシンとして作成し、Internal のネットワークだけに接続しています。(正確には、apt-get をするためにインターネット接続が必要なので、External にも繋げていますが、普段は無効化しています。)

 
この状態で Squid をプロキシとして介在させるには、Client --&gt; Internal network --&gt; VyOS --&gt; External network となっている経路のどこかで Squid サーバーを見に行くように設定しないといけません。

 
透過ではないプロキシであれば、ブラウザーの設定でプロキシのアドレスとして 10.10.90.11 を設定すればいいことになります。この場合の経路は、Client --&gt; Squid --&gt; VyOS --&gt; External network になります。クライアントから Internal network にある Squid に直接接続するところがポイントです。

 
冒頭の定義で確認したように、今回はクライアントの設定を変えずにプロキシを通すことが目標です。この場合、Client --&gt; Squid というホットラインが使えないので、何らかの設定を VyOS 側で行わないといけないのが分かると思います。すなわち経路としては、Client --&gt; VyOS --&gt; Squid --&gt; VyOS --&gt; External network としたいのです。Squid も External へのアクセスを持たないので、VyOS を 2 度通らないといけません。

 
いずれの場合も、Squid が VyOS をゲートウェイとして使う必要があるので、忘れずにゲートウェイの設定をしておきます。Squid サーバー上で /etc/network/interfaces を以下のように設定しました。

 
```
auto lo 
iface lo inet loopback

auto eth0 
iface eth0 inet static 
address 10.10.90.11 
netmask 255.255.0.0 
gateway 10.10.90.12 
dns-nameservers 10.10.10.10 


iface eth1 inet dhcp
```
 
DNS サーバー参照の設定が必要な理由は後述します。DNS の設定を /etc/resolv.conf に反映させるため、eth0 を再起動します。

 
```
$ sudo ifdown eth0 
$ sudo ifup eth0 
```
 
OS 側の設定は終了です。次に設定ファイル squid.conf をこのように変更しました。一部の抜粋で、青字が変更部分です。

 
```
# Example rule allowing access from your local networks. 
# Adapt to list your (internal) IP networks from where browsing 
# should be allowed 
# acl localnet src 10.0.0.0/8   # RFC1918 possible internal network 
acl localnet src 10.10.0.0/16   # Hyper-V Internal 
acl localnet src 172.16.0.0/12  # RFC1918 possible internal network 
acl localnet src 192.168.0.0/16 # RFC1918 possible internal network 
acl localnet src fc00::/7       # RFC 4193 local private network range 
acl localnet src fe80::/10      # RFC 4291 link-local (directly plugged) machines

# Squid normally listens to port 3128 
http_port 3128 
http_port 3129 transparent

(..snip..)

# Impersonation for logging to a file 
cache_effective_user john
```
 
定義で確認した通り、プロキシは、サーバーとクライアント両方の役割を持っています。非透過プロキシとして 3128/tcp、透過プロキシとして 3129/tcp のポートを使ってサーバーとして動作するようにしました。3128/tcp は Squid のデフォルト ポートです。設定や動作の違いを見るため、非透過プロキシと透過プロキシの両方を設定してみます。

 
cache_effective_user は、Squid の動作仕様による設定です。Squid を root 権限で起動させると、その後の動作は root ではなく cache_effective_user で設定されたユーザーの UIDを使って動作します。何も設定しないと nobody というユーザーの UID が使われ、ログファイルなどを書き込もうとするときに、書き込み権限がないためのエラーが出ます。Squid 用の専用アカウントを作るのが標準的だとは思いますが、ここでは作業用ユーザーの john を設定しておきます。

 
ログが書き込めるように、var/logs ディレクトリの所有者を john にしておきます。

 
```
john@ubuntu-proxy:~$ ls -la /usr/local/squid/current/var/logs 
total 8 
drwxr-xr-x 2 root root 4096 Jan  8 11:43 . 
drwxr-xr-x 5 root root 4096 Jan  8 11:28 .. 
john@ubuntu-proxy:~$ sudo chown john:john  /usr/local/squid/current/var/logs 
john@ubuntu-proxy:~$ ls -la /usr/local/squid/current/var/logs 
total 8 
drwxr-xr-x 2 john john 4096 Jan  8 11:43 . 
drwxr-xr-x 5 root root 4096 Jan  8 11:28 .. 
john@ubuntu-proxy:~$
```
 
これで準備が整いました。今回はテストなので、デーモンとしてバックグラウンドで動かすのではなく、-N をつけて非デーモン モードで実行します。ログがファイルの var/logs/cache.log だけでなく標準出力にも出るので分かりやすいです。

 
```
john@ubuntu-proxy:~$ sudo /usr/local/squid/current/sbin/squid -Nd1 
2015/01/08 13:04:49| Set Current Directory to /usr/local/squid/squid-3.4.10/var/cache/squid 
2015/01/08 13:04:49| Starting Squid Cache version 3.4.10 for x86_64-unknown-linux-gnu... 
2015/01/08 13:04:49| Process ID 55453 
2015/01/08 13:04:49| Process Roles: master worker 
2015/01/08 13:04:49| With 1024 file descriptors available 
2015/01/08 13:04:49| Initializing IP Cache... 
2015/01/08 13:04:49| DNS Socket created at [::], FD 5 
2015/01/08 13:04:49| DNS Socket created at 0.0.0.0, FD 6 
2015/01/08 13:04:49| Adding nameserver 10.10.10.10 from squid.conf 
2015/01/08 13:04:49| Logfile: opening log daemon:/usr/local/squid/squid-3.4.10/var/logs/access.log 
2015/01/08 13:04:49| Logfile Daemon: opening log /usr/local/squid/squid-3.4.10/var/logs/access.log 
2015/01/08 13:04:49| Store logging disabled 
2015/01/08 13:04:49| Swap maxSize 0 + 262144 KB, estimated 20164 objects 
2015/01/08 13:04:49| Target number of buckets: 1008 
2015/01/08 13:04:49| Using 8192 Store buckets 
2015/01/08 13:04:49| Max Mem  size: 262144 KB 
2015/01/08 13:04:49| Max Swap size: 0 KB 
2015/01/08 13:04:49| Using Least Load store dir selection 
2015/01/08 13:04:49| Set Current Directory to /usr/local/squid/squid-3.4.10/var/cache/squid 
2015/01/08 13:04:49| Finished loading MIME types and icons. 
2015/01/08 13:04:49| HTCP Disabled. 
2015/01/08 13:04:49| Squid plugin modules loaded: 0 
2015/01/08 13:04:49| Accepting HTTP Socket connections at local=[::]:3128 remote=[::] FD 9 flags=9 
2015/01/08 13:04:49| Accepting NAT intercepted HTTP Socket connections at local=[::]:3129 remote=[::] FD 10 flags=41 
2015/01/08 13:04:50| storeLateRelease: released 0 objects
```
 
起動したようです。プロセスと TCP ポートを見てみると、確かに squid は john として動いています。

 
```
john@ubuntu-proxy:~$ ps -ef | grep squid 
root     55452  1115  0 13:04 pts/1    00:00:00 sudo /usr/local/squid/current/sbin/squid -Nd1 
john     55453 55452  0 13:04 pts/1    00:00:00 /usr/local/squid/current/sbin/squid -Nd1 
john     55454 55453  0 13:04 ?        00:00:00 (logfile-daemon) /usr/local/squid/squid-3.4.10/var/logs/access.log 
john     55465 55016  0 13:07 pts/2    00:00:00 grep --color=auto squid 
john@ubuntu-proxy:~$ netstat -aon | grep 31 
tcp6       0      0 :::3128                 :::*                    LISTEN      off (0.00/0/0) 
tcp6       0      0 :::3129                 :::*                    LISTEN      off (0.00/0/0)
```
 
実はこれで非透過プロキシとしての設定は終了です。クライアント側の設定を変更して動作を確認します。

 
inetcpl.cpl --&gt; Connections タブ --&gt; LAN settings でプロキシの設定ができます。全てのプロトコルで 10.10.90.11:3128 を使うように設定しました。

 
![]({{site.assets_url}}2015-01-09-image14.png) <br />
Windows のプロキシ設定

 
これでブラウザーは通常通り動作するはずです。bing.com にアクセスした際の Squid のアクセスログを見てみると、何やらいろいろとログが書き込まれており、プロキシとしてまともに動いている、はずです。Squid の目玉機能であるキャッシュの機能は見ないので、ブラウザーからページが開ければ OK なのです。

 
```
john@ubuntu-proxy:~$ tail /usr/local/squid/current/var/logs/access.log 
1420753075.003    463 10.10.20.71 TCP_MISS/200 73782 GET http://www.bing.com/ - HIER_DIRECT/204.79.197.200 text/html 
1420753075.205    157 10.10.20.71 TCP_MISS/200 710 POST http://www.bing.com/rewardsapp/reportActivity - HIER_DIRECT/204.79.197.200 application/x-javascript 
1420753075.206    106 10.10.20.71 TCP_MISS/200 503 GET http://www.bing.com/fd/ls/l? - HIER_DIRECT/204.79.197.200 image/gif 
1420753075.251    112 10.10.20.71 TCP_MISS/200 2255 GET http://www.bing.com/HPImageArchive.aspx? - HIER_DIRECT/204.79.197.200 application/json 
1420753075.367    171 10.10.20.71 TCP_CLIENT_REFRESH_MISS/200 493 HEAD http://www.bing.com/rms/Framework/jc/9aaeda73/23d0202d.js? - HIER_DIRECT/204.79.197.200 application/x-javascript 
1420753075.391    256 10.10.20.71 TCP_MISS/200 20970 GET http://www.bing.com/hpm? - HIER_DIRECT/204.79.197.200 text/html 
1420753075.397    202 10.10.20.71 TCP_MISS/200 519 GET http://www.bing.com/notifications/render? - HIER_DIRECT/204.79.197.200 text/html 
1420753075.708    100 10.10.20.71 TCP_MISS/200 503 GET http://www.bing.com/fd/ls/l? - HIER_DIRECT/204.79.197.200 image/gif 
1420753075.957    328 10.10.20.71 TCP_MISS/200 7528 CONNECT login.live.com:443 - HIER_DIRECT/131.253.61.66 - 
1420753076.656    110 10.10.20.71 TCP_MISS/200 982 GET http://www.bing.com/Passport.aspx? - HIER_DIRECT/204.79.197.200 t
```
 
では次に、twitter.com にアクセスしてみます。URL を見ると https:// で始まっているように、ツイッターとの通信は SSL で暗号化されています。クライアントの設定で、全プロトコルがプロキシを使うようにしているので、SSL でも Squid が介在するはずであり、結果は問題なくページを開くことができます。アクセス ログを見てみます。ログに出てくる CONNECT というのは HTTP の CONNECT メソッドのことです。

 
```
john@ubuntu-proxy:~$ tail /usr/local/squid/current/var/logs/access.log 
1420753532.051 110352 10.10.20.71 TCP_MISS/200 51273 CONNECT twitter.com:443 - HIER_DIRECT/199.59.150.39 - 
1420753532.051  88048 10.10.20.71 TCP_MISS/200 956439 CONNECT abs.twimg.com:443 - HIER_DIRECT/93.184.216.146 - 
1420753532.052  70182 10.10.20.71 TCP_MISS/200 5350 CONNECT abs.twimg.com:443 - HIER_DIRECT/93.184.216.146 - 
1420753532.052  70181 10.10.20.71 TCP_MISS/200 6320 CONNECT abs.twimg.com:443 - HIER_DIRECT/93.184.216.146 - 
1420753532.052  70182 10.10.20.71 TCP_MISS/200 5318 CONNECT abs.twimg.com:443 - HIER_DIRECT/93.184.216.146 - 
1420753532.052  70182 10.10.20.71 TCP_MISS/200 6320 CONNECT abs.twimg.com:443 - HIER_DIRECT/93.184.216.146 - 
1420753532.113  85991 10.10.20.71 TCP_MISS/200 8153 CONNECT iecvlist.microsoft.com:443 - HIER_DIRECT/93.184.215.200 - 
1420753532.113 109447 10.10.20.71 TCP_MISS/200 4111 CONNECT twitter.com:443 - HIER_DIRECT/199.59.150.39 -
```
 
実は、Squid が HTTPS を HTTP と同じようにプロキシできる、というのはおかしいのです。というか、実際には HTTPS についてはプロキシはしていないので、HTTP と同じようにページのキャッシュなどは行われません。理由は簡単で、Squid は暗号化された通信を解読できないためです。

 
冒頭に書いたように、プロキシはルーティングと異なり、サーバーとしてデータを受け取ってから、新しいリクエストを自分の力で代理人として送信しています。この過程で、パケットの内容を 「解釈」 する必要があるのです。ここで疑問として、「いやいやプロキシがデータを解釈しなくても、HTTPS だろうがなんだろうが、受け取った TCP パケットをまるっとコピーして、新しいパケットとして送信すればいいじゃないか」 と考えるかもしれません。しかしここでのポイントは、プロキシに入ってくるパケットにおいて、宛先 IP アドレス、宛先 TCP ポートは、最終目的地の Web サーバーのものではなく、プロキシのアドレス、ポート番号になっていることです。Windows のプロキシ設定を行なうと、クライアントから要求が送信される時点で、既に宛先はプロキシに設定されているのです。

 
これは同時に、なぜ Squid サーバー側で DNS サーバー参照設定を行わなければならないか、という理由に繋がります。SSL ではなく HTTP をプロキシする場合、Squid は、IP レベル (OSI 参照モデルのネットワーク層) の宛先 IP アドレスではなく、HTTP レベル (OSI 参照モデルのアプリケーション層) の HTTP 要求に必ず含まれている (たぶん HTTP ヘッダーの Host) 宛先情報を読み取って、データを送信しています。多くの場合、HTTP 要求ヘッダーに含まれる宛先情報は IP アドレスではなくホスト名であるため、Squid が名前解決をしないといけません。これは逆に考えると、クライアント側では名前解決が必要ないということになります。実は、クライアント側で DNS サーバー参照の設定を行わなくても、非透過プロキシを経由した通信は問題なく可能です。

 
そこで問題となるのが HTTPS です。Squid は暗号化されたペイロードを読めず、自分に送られてきたパケットをどこに送信すればいいか分かりません。では、上の例だと、なぜクライアントはツイッターにアクセスすることができたのでしょうか。理由は、Squid は 「ズル」 をさせてもらっているからです。どういうズルかというと、Squid は、これから始まる TCP セッションの本当の宛先を、ブラウザーから前もって平文で教えてもらっているのです。これがログに出てくる HTTP CONNECT メソッドです。

 
クライアント側でキャプチャーを取って、HTTP CONNECT の内容を見てみました。どちらが使われているか分かりませんが、URI と Host という二つのフィールドに、本当の宛先である twitter.com:443 という値が設定されています。また、パケットの宛先が全て 10.10.90.11:3128 になっていることも確認できます。

 
![]({{site.assets_url}}2015-01-09-image15.png)

 
HTTP CONNECT で宛先を教えてもらった後は、Squid は何も頭を使わず、送られてくる暗号化データを受け流す簡単なお仕事をするだけです。トンネリングとも呼びます。ブラウザー側はプロキシの設定に基づいて CONNECT メソッドを送り、プロキシから OK が返ってきたら、ClientHello から始まる鍵交換や、その後の暗号化通信を何事もなかったかのように始めます。CONNECT メソッドは Web サーバーには送信されません。

