---
layout: post
title: "How to get the original address after NAT"
date: 2015-01-15 22:29:34.000 -08:00
categories:
- Linux
- Network
- Security
tags:
- socat
- vyos
---

ポート フォワードの後に受信したソケットから、オリジナルの宛先 IP アドレスをユーザー モード側で取得する方法がようやく分かりました。Linux のカーネル デバッグまで持ち出しましたが、結論はとてもあっさりしたものでした。答えは、getsockopt 関数にオプションとして SO_ORIGINAL_DST を渡すというもので、結果としてオリジナルの宛先情報が入った struct sockaddr が返ってきます。これは超便利！

 
SO_ORIGINAL_DST というオプションは &lt;linux/netfilter_ipv4.h&gt; で定義されているのですが、getsockopt の説明ではなぜか触れられていません。キーワードさえ分かってしまえば検索できるのですが、何も知らないとここまで辿りつくのは難しい、と思います。この前見つけた IP_RECVORIGDSTADDR とか IP_ORIGDSTADDR とは一体なんだったのか、という疑問も残ります。

 
getsockopt(3): socket options - Linux man page <br />
[http://linux.die.net/man/3/getsockopt](http://linux.die.net/man/3/getsockopt)

 
以下簡単に、カーネル デバッグからどうやってたどり着いたかを書いておきます。

 
まず目をつけたのが、nf_nat_ipv4_manip_pkt 関数でした。この関数で iph という iphdr 構造体の変数の中の宛先、または送信元のアドレスを書き換えているように見えます。実際にデバッガーで確かめると、iptables で設定した値でオリジナルのアドレスを書き換えていました。アドレスを書き換えているところの少し前で、l4proto-&gt;manip_pkt() を呼び出しています。プロトコルが TCP の場合は、ここから tcp_manip_pkt が呼ばれ、TCP のポートが書き換えられています。l4proto というのは、Layer 4 プロトコルのことで、TCP や UDP が該当するということです。けっこう分かりやすいです。

 
ユーザーモード側から欲しい情報は、ここで変更されてしまう iph 側に入っている値ですが、nf_nat_ipv4_manip_pkt は一方的に値を上書きしてしまうロジックになっていて、変更前の値をどこかに保存することはありません。最初は iphdr 構造体にオリジナルの値が入っているのかと思いましたが、この構造体はパケット内の IP ヘッダーそのものであり、オリジナルのアドレスは持っていません。したがって、この関数が呼ばれる時点では、既にオリジナルのアドレスはどこかに退避されているはずです。

 
そこで目をつけたのは、オリジナルが入っているけれども上書きされてしまう iph ではなく、転送先の情報を持っている nf_conntrack_tuple 構造体の target という変数です。target がどこから生まれるかを辿れば、その場所には iptables で設定した情報があるわけで、オリジナルの情報も管理されているだろう、という推測です。コール スタックを 1 フレーム遡ると、nf_nat_packet の中で、nf_ct_invert_tuplepr(&target, &ct-&gt;tuplehash&#x5b;!dir&#x5d;.tuple) という呼び出し箇所があり、ここで target が設定されています。nf_ct_invert_tuplepr は destination と source を入れ替えているだけのようなので、NAT で置き換える情報は、ct-&gt;tuplehash に入っていると分かります。ct は nf_conn 構造体で、名前から Netfilter の Connection 情報を保持しているような感じです。これは期待できます。

 
そこで nf_nat_packet において、ct-&gt;tuplehash の値を見てみました。貼り付けてもあまり意味がないのですが、出力はこんな感じでした。

 
<em>(gdb) p ((struct nf_conn*)$rdi)-&gt;tuplehash[0]      <br>$12 = {hnnode = {next = 0x80000001, pprev = 0xffffe8ffffc01158}, tuple = {src = {u3 = {all = {1174513856, 0, 0, 0},       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ip = 1174513856, ip6 = {1174513856, 0, 0, 0}, in = {s_addr = 1174513856}, in6 = {in6_u = {       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; u6_addr8 = "\300\25001F", '00' &lt;repeats 11 times&gt;, u6_addr16 = {43200, 17921, 0, 0, 0, 0, 0, 0},       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; u6_addr32 = {1174513856, 0, 0, 0}}}}, u = {all = 40191, tcp = {port = 40191}, udp = {port = 40191},       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; icmp = {id = 40191}, dccp = {port = 40191}, sctp = {port = 40191}, gre = {key = 40191}}, l3num = 2}, dst = {       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; u3 = {all = {2886347368, 0, 0, 0}, ip = 2886347368, ip6 = {2886347368, 0, 0, 0}, in = {s_addr = 2886347368},       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; in6 = {in6_u = {u6_addr8 = "h*\n\254", '00' &lt;repeats 11 times&gt;, u6_addr16 = {10856, 44042, 0, 0, 0, 0, 0,       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 0}, u6_addr32 = {2886347368, 0, 0, 0}}}}, u = {all = 47873, tcp = {port = 47873}, udp = {port = 47873},       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; icmp = {type = 1 '01', code = 187 '\273'}, dccp = {port = 47873}, sctp = {port = 47873}, gre = {       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; key = 47873}}, protonum = 6 '06', dir = 0 '00'}}}       <br>(gdb) p ((struct nf_conn*)$rdi)-&gt;tuplehash[1]       <br>$13 = {hnnode = {next = 0x33d9 &lt;irq_stack_union+13273&gt;, pprev = 0xdcbddf4e}, tuple = {src = {u3 = {all = {335653056,       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 0, 0, 0}, ip = 335653056, ip6 = {335653056, 0, 0, 0}, in = {s_addr = 335653056}, in6 = {in6_u = {       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; u6_addr8 = "\300\2500124", '00' &lt;repeats 11 times&gt;, u6_addr16 = {43200, 5121, 0, 0, 0, 0, 0, 0},       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; u6_addr32 = {335653056, 0, 0, 0}}}}, u = {all = 14860, tcp = {port = 14860}, udp = {port = 14860}, icmp = {       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; id = 14860}, dccp = {port = 14860}, sctp = {port = 14860}, gre = {key = 14860}}, l3num = 2}, dst = {u3 = {       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; all = {1174513856, 0, 0, 0}, ip = 1174513856, ip6 = {1174513856, 0, 0, 0}, in = {s_addr = 1174513856}, in6 = {       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; in6_u = {u6_addr8 = "\300\25001F", '00' &lt;repeats 11 times&gt;, u6_addr16 = {43200, 17921, 0, 0, 0, 0, 0,       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 0}, u6_addr32 = {1174513856, 0, 0, 0}}}}, u = {all = 40191, tcp = {port = 40191}, udp = {port = 40191},       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; icmp = {type = 255 '\377', code = 156 '\234'}, dccp = {port = 40191}, sctp = {port = 40191}, gre = {       <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; key = 40191}}, protonum = 6 '06', dir = 1 '01'}}}</em>

 
32bit 整数になっていますが、3 種類の IPv4 アドレスの情報があります。このうち、104.42.10.172 が ubuntu-web.cloudapp.net を示すオリジナル アドレスです。192.168.1.70 はクライアントのアドレス、192.168.1.20 は NAT を行っているルーター自身のアドレスです。

 
2886347368 = 104.42.10.172 <br />
1174513856 = 192.168.1.70 <br />
335653056 = 192.168.1.20

 
ということで、欲しい情報は ct-&gt;tuplehash に入っていることが確認できました。ユーザーモード側にはソケットのファイル デスクリプターしかないので、これをもとに nf_conn 情報までたどり着くことができれば、値を取ってくることができます。

 
肝心なその後の記憶があやふやなのですが、何かのきっかけで以下の定義を見つけ、getorigdst 関数の定義を見るとまさに tuplehash の情報を返していました。そこで SO_ORIGINAL_DST で検索し、getsockopt に SO_ORIGINAL_DST を渡すと NAT 前のアドレスが取れると分かりました。流れはそんな感じです。

 
```
static struct nf_sockopt_ops so_getorigdst = { 
    .pf     = PF_INET, 
    .get_optmin = SO_ORIGINAL_DST, 
    .get_optmax = SO_ORIGINAL_DST+1, 
    .get        = getorigdst, 
    .owner      = THIS_MODULE, 
};
```
 
以前の記事で、socat というツールを使って、NAT されたパケットを明示的に指定した宛先にリレーして、透過プロキシの動作を実現させました。socat を少し書き換えて、SO_ORIGINAL_DST で取得した宛先に自動的にパケットをリレーできるようにしたのがこちらです。これで、443/tcp ポートであれば、どのサーバーに対するリクエストもト中継することができるようになりました。

 
[https://github.com/msmania/poodim/tree/poodim-dev](https://github.com/msmania/poodim/tree/poodim-dev)

 
以前は、VyOS を使ったルーターの他に、Squid というプロキシ用のサーバーと合わせて 2 台からなるルーティングの環境を作りました。よりシンプルな構成として、ルーティングとポート フォワードを 1 台のマシンで兼用することももちろん可能です。そこで、VyOS 上にルーティングの機能をまとめた環境を作ってみましたので、その手順を紹介します。VyOS ではなく、Ubuntu Server の iptables の設定だけで同様の環境を作ることもできると思います。

 
最終的には、このような構成になります。

 
![]({{site.assets_url}}2015-01-15-capture2.png)

 
前回の構成では、VyOS 上で Source NAT という機能を使って eth0 から eth1 へのルーティングを実現しました。その名の通り、宛先アドレスはそのままに、送信元のアドレスをルーターの eth1 側のアドレスに変更します。ここで送信元のアドレスを変更しなくても、eth1 からパケットを送信してしまえば、宛先になるサーバーのアドレスにパケットは届くことは届くでしょう。しかし、サーバーからの応答における宛先のアドレスが内部ネットワーク、すなわちルーターの eth0 側にあるクライアントアドレスになるので、サーバーからの応答はおかしなところに送信されてしまいます。サーバーからの応答が、正しくルーターの eth1 に返ってくるようにするため、Source NAT を行ないます。

 
Source NAT に加えて、PBR (= Policy Based Routing) の設定を行ない、443/tcp ポート宛てのパケットは、特例として Source NAT が行なわれる前に Squid サーバーにルーティングされるように設定しました。これはあくまでも MAC アドレス レベルの変更で、イーサネット フレームのレイヤーより上位層は変更されません。Squid サーバー側では、このルーティングされてきた 443/tcp ポート宛のパケットのポートを 3130/tcp に変更しました。このとき同時に、IP アドレスも Squid サーバーのアドレスに書き換わっているため、Squid サーバーで動くプログラムが受信できました。

 
1 台でこれを実現する場合、443/tcp ポート宛のパケットに対しては宛先 IP アドレスを自分、TCP ポートを 3130/tcp に変更するようなルールを作ることができれば OK です。この機能は、宛先を書き換えるので Destination NAT と呼ばれます。

 
User Guide - VyOS <br />
[http://vyos.net/wiki/User_Guide](http://vyos.net/wiki/User_Guide)

 
あとは VyOS のユーザー ガイドに沿って設定するだけです。まずは前回の PBR の設定を消します。全部消してから一気に commit しようとするとエラーになるので、 無難に 1 つずつ commit して save します。

 
```
$ configure 
# delete interfaces ethernet eth0 policy route PROXYROUTE 
# commit 
# delete protocols static table 100 
# commit 
# delete policy route PROXYROUTE 
# commit 
# save 
# exit 
$
```
 
Destination NAT の設定を行ないます。eth0 だけでなく、外から 443/tcp 宛てのパケットが来た場合も、同じように自分自身の 3130/tcp ポートに転送するように設定しておきます。iptables の REDIRECT の設定とは異なり、translation address も明示的に設定する必要があります。最終的には同じようなコマンドが netfilter に届くのだと思いますが。

 
```
$ configure 
# set nat destination rule 100 description 'Port forward of packets from eth0' 
# set nat destination rule 100 inbound-interface 'eth0' 
# set nat destination rule 100 protocol 'tcp' 
# set nat destination rule 100 destination port '443' 
# set nat destination rule 100 translation port '3130' 
# set nat destination rule 100 translation address '10.10.90.12' 
# set nat destination rule 110 description 'Port forward of packets from eth1' 
# set nat destination rule 110 inbound-interface 'eth1' 
# set nat destination rule 110 protocol 'tcp' 
# set nat destination rule 110 destination port '443' 
# set nat destination rule 110 translation port '3130' 
# set nat destination rule 110 translation address '10.10.90.12' 
# commit 
# save 
# exit 
$
```
 
まだ、VyOS 上で 3130/tcp をリッスンするプログラムが無いので、クライアントから HTTPS のサイトへはアクセスできません。次に、SO_ORIGINAL_DST オプションを使うように変更した socat をインストールします。

 
といっても、VyOS にはまだ gcc などの必要なツールが何もインストールされていないので、パッケージのインストールから始めます。VyOS では apt-get コマンドが使えますが、既定のリポジトリにはほとんど何も入っていないので、リポジトリのパスを追加するところからやります。どのリポジトリを使ってもいいのですが、他のマシンが Ubuntu なので Ubuntu のリポジトリを設定しました。

 
```
$ configure 
# set system package repository trusty/main components main 
# set system package repository trusty/main url http://us.archive.ubuntu.com/ubuntu/ 
# set system package repository trusty/main distribution trusty 
# set system package repository trusty/universe components universe 
# set system package repository trusty/universe url http://us.archive.ubuntu.com/ubuntu/ 
# set system package repository trusty/universe distribution trusty 
# commit 
# save 
# exit 
$
```
 
あとは Ubuntu と同じです。まずはリポジトリから最新情報を持ってきます。すると、2 つのパッケージで公開鍵がないというエラーが起きます。

 
```
vyos@vyos:~$ sudo apt-get update 
Get:1 http://us.archive.ubuntu.com trusty Release.gpg [933 B] 
Get:2 http://us.archive.ubuntu.com/ubuntu/ trusty/main Translation-en [943 kB] 
Hit http://packages.vyos.net helium Release.gpg 
Ign http://packages.vyos.net/vyos/ helium/main Translation-en 
Hit http://packages.vyos.net helium Release 
Hit http://packages.vyos.net helium/main amd64 Packages 
Get:3 http://us.archive.ubuntu.com/ubuntu/ trusty/universe Translation-en [5063 kB] 
Get:4 http://us.archive.ubuntu.com trusty Release [58.5 kB] 
Ign http://us.archive.ubuntu.com trusty Release 
Get:5 http://us.archive.ubuntu.com trusty/main amd64 Packages [1743 kB] 
Get:6 http://us.archive.ubuntu.com trusty/universe amd64 Packages [7589 kB] 
Fetched 15.4 MB in 13s (1119 kB/s) 
Reading package lists... Done 
W: GPG error: http://us.archive.ubuntu.com trusty Release: The following signatures couldn't be verified because the public key is not available: NO_PUBKEY 40976EAF437D05B5 NO_PUBKEY 3B4FE6ACC0B21F32 
vyos@vyos:~$ 
```
 
今回使うパッケージではないので無視してもいいですが、気持ち悪いので対応しておきます。

 
```
vyos@vyos:~$ sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 40976EAF437D05B5 
Executing: gpg --ignore-time-conflict --no-options --no-default-keyring --secret-keyring /etc/apt/secring.gpg --trustdb-name /etc/apt/trustdb.gpg --keyring /etc/apt/trusted.gpg --primary-keyring /etc/apt/trusted.gpg --keyserver keyserver.ubuntu.com --recv-keys 40976EAF437D05B5 
gpg: requesting key 437D05B5 from hkp server keyserver.ubuntu.com 
gpg: key 437D05B5: public key "Ubuntu Archive Automatic Signing Key <ftpmaster@ubuntu.com>" imported 
gpg: no ultimately trusted keys found 
gpg: Total number processed: 1 
gpg:               imported: 1 
vyos@vyos:~$ sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 3B4FE6ACC0B21F32 
Executing: gpg --ignore-time-conflict --no-options --no-default-keyring --secret-keyring /etc/apt/secring.gpg --trustdb-name /etc/apt/trustdb.gpg --keyring /etc/apt/trusted.gpg --primary-keyring /etc/apt/trusted.gpg --keyserver keyserver.ubuntu.com --recv-keys 3B4FE6ACC0B21F32 
gpg: requesting key C0B21F32 from hkp server keyserver.ubuntu.com 
gpg: key C0B21F32: public key "Ubuntu Archive Automatic Signing Key (2012) <ftpmaster@ubuntu.com>" imported 
gpg: no ultimately trusted keys found 
gpg: Total number processed: 1 
gpg:               imported: 1  (RSA: 1)
```
 
もう一度 apt-get update します。今度はうまくいきました。

 
```
vyos@vyos:~$ sudo apt-get update 
Get:1 http://us.archive.ubuntu.com trusty Release.gpg [933 B] 
Hit http://us.archive.ubuntu.com/ubuntu/ trusty/main Translation-en 
Hit http://us.archive.ubuntu.com/ubuntu/ trusty/universe Translation-en 
Get:2 http://us.archive.ubuntu.com trusty Release [58.5 kB] 
Get:3 http://us.archive.ubuntu.com trusty/main amd64 Packages [1743 kB] 
Hit http://packages.vyos.net helium Release.gpg 
Ign http://packages.vyos.net/vyos/ helium/main Translation-en 
Hit http://packages.vyos.net helium Release 
Hit http://packages.vyos.net helium/main amd64 Packages 
Get:4 http://us.archive.ubuntu.com trusty/universe amd64 Packages [7589 kB] 
Fetched 9333 kB in 6s (1476 kB/s) 
Reading package lists... Done 
vyos@vyos:~$
```
 
必要なパッケージをインストールします。

 
```
$ sudo apt-get install vim 
$ sudo apt-get install build-essential libtool manpages-dev gdb git 
$ sudo apt-get install autoconf yodl 
```
 
VyOS に既定で入っている Vi は、Tiny VIM という必要最小限の機能しか持たないもので、例えば矢印キーが使えない、ソースコードの色分けをやってくれない、などいろいろ不便なので、Basic VIM を入れます。

 
socat を Ｇit からクローンすると、configure ファイルが含まれていないので、autoconf で作る必要があります。yodl は、socat のビルドに必要でした。マニュアルの HTML 生成に必要なようです。

 
インストールが終わったら、あとはリポジトリをクローンしてビルドします。

 
```
$ git clone -b poodim-dev https://github.com/msmania/poodim.git poodim 
$ cd poodim/ 
$ autoconf 
$ CFLAGS="-g -O2" ./configure --prefix=/usr/local/socat/socat-poodim 
$ make 
```
 
わざわざインストールする必要もないので、そのまま実行します。-d を 3 つ付けると、Info レベルまでのログを出力します。

 
```
vyos@vyos:~/poodim$ ./socat -d -d -d TCP-LISTEN:3130,fork TCP:dummy.com:0 
2015/01/16 05:45:08 socat[7670] I socat by Gerhard Rieger - see www.dest-unreach.org 
2015/01/16 05:45:08 socat[7670] I setting option "fork" to 1 
2015/01/16 05:45:08 socat[7670] I socket(2, 1, 6) -> 3 
2015/01/16 05:45:08 socat[7670] I starting accept loop 
2015/01/16 05:45:08 socat[7670] N listening on AF=2 0.0.0.0:3130
```
 
前回と違うのは、転送先のアドレスとポート番号に適当な値を指定しているところです。3130/tcp 宛てのパケットを受信すると、そのソケットに対して SO_ORIGINAL_DST オプションを使ってオリジナルの宛先情報を取得し、そこにパケットを転送します。これが今回の変更の目玉であり、これによって、任意のアドレスに対する 443/tcp の通信を仲介することができるようになりました。

 
例えばクライアントから google.com に繋ぐと、新たに追加した以下のログが出力され、ダミーの代わりにオリジナルのアドレスに転送されていることが分かります。

 
```
2015/01/16 05:50:24 socat[7691] N forwarding data to TCP:216.58.216.142:443 instead of TCP:dummy.com:0 
```
 
これで、宛先アドレスの問題が解決し、完全な透過プロキシとしての動作が実現できました。

 
実はこの改変版 socat には、もう一点仕掛けがあります。2015/1/15 現在は、Google 検索のページには接続できますが、同じく HTTPS 通信を行う facebook.com や twitter.com には接続できないはずです。

 
かなり雑な実装ですが、TLSv1.x のプロトコルによる Client Hello を検出したら、パケットの内容を適当に改竄してサーバーが Accept しないように細工を行ないました。これによって何が起こるかというと、クライント側から見たときには TLSv1.x のコネクションは常に失敗するので唯一の選択肢である SSLv3.0 の Client Hello を送るしかありません。一方のサーバー側では、SSLv3.0 の Client Hello がいきなり送られてきたようにしか見えません。結果として、クライアント、サーバーがともに TLSv1.x をサポートしているにもかかわらず、MITM 攻撃によって強制的に SSLv3.0 を使わせる、という手法が成り立ちます。

 
昨年末に POODLE Attack という名前の脆弱性が世間を騒がせましたが、これは SSLv3.0 には根本的な脆弱性が存在し、もはや使用するのは危険になったことを意味します。さらに、クライアントとサーバーが TLS に対応しているだけでも不十分である、ということが今回の例から分かると思います。簡単に言えば、クライアントもサーバーも、SSLv3.0 を使えるべきではないのです。

 
現在最新の Chrome、IE、Firefox では、ブラウザーがこのフォールバックを検出した時点で、サイトへのアクセスはブロックされます。

 
Google、「Chrome 40」でSSL 3.0を完全無効化へ - ITmedia エンタープライズ <br />
[http://www.itmedia.co.jp/enterprise/articles/1411/04/news050.html](http://www.itmedia.co.jp/enterprise/articles/1411/04/news050.html)

 
IE 11の保護モード、SSL 3.0へのフォールバックをデフォルトで無効に - ITmedia エンタープライズ <br />
[http://www.itmedia.co.jp/enterprise/articles/1412/11/news048.html](http://www.itmedia.co.jp/enterprise/articles/1412/11/news048.html)

 
サーバー側では、2014 年 10 月半ばにリリースされた Openssl-1.0.1j において、フォールバック検出時に新たなエラー コードを返す実装が追加されています。Apache など、OpenSSL を SSL のモジュールとして使うサーバーは、この機能によって対応がなされると考えられます。この OpenSSL の防御機能は、パケットからアラート コードを見ると判断できます。実際に確かめていませんが、twitter.com と facebook.com は OpenSSL で防御されているはずです。

 
OpenSSL Security Advisory &#x5b;15 Oct 2014&#x5d; <br />
[https://www.openssl.org/news/secadv_20141015.txt](https://www.openssl.org/news/secadv_20141015.txt)

 この次のステップとしては、当然 socat に POODLE を実装することなのですが、もし実装できたとしてもさすがに公開する勇気は・・。