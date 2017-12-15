---
layout: post
title: "Setting up a transparent proxy over SSL #3 – squid again"
date: 2015-01-09 15:11:43.000 +09:00
categories:
- Linux
- Network
tags:
- proxy
- squid
- tcpdump
- vyos
---

前回は非透過プロキシを構築しました。クライアントから送られるパケットの宛先が Web サーバーではなくプロキシ サーバーになっていて、プロキシはペイロードの内容を「解釈して」 宛先を割り出すという動作がポイントでした。

 
### 3. squid による HTTP 透過プロキシ

 
透過プロキシ (ここでは intercepting proxy を意味します) の場合、クライアントにはプロキシが存在することを教えません。したがってクライアントは、ただ単に Web サーバーに向けて HTTP 要求を送信します。何もしなければ HTTP 要求は Client --&gt; VyOS --&gt; 物理ルーター、という経路で外に流れてしまい、Squid には流入しません。つまり、透過プロキシを動作させるためには、ルーティングを少し捻じ曲げる必要があります。

 
![]({{site.assets_url}}2015-01-09-capture1.png)

 
設定で参考にさせていただいたページがこちら。

 
vyattaを使って透過型プロキシ環境を構築する時の設定内容 <br />
[http://www.virment.com/vyatta/vyatta-proxy/12/](http://www.virment.com/vyatta/vyatta-proxy/12/)

 
squidを透過型プロキシとして使う時の設定 <br />
[http://www.virment.com/vyatta/vyatta-proxy/15/](http://www.virment.com/vyatta/vyatta-proxy/15/)

 
ネットワーク構成はほぼ同じ、実行するコマンドもかなり共通しています。VyOS 上で PBR (Policy Based Routing) の設定を行ない、特定の条件に合致するパケットは eth1 に流すのではなく Squid に流すように設定します。さらに、Squid に流入したパケットが透過プロキシ用の待機ポートである 3129/tcp (前回の記事で squid.conf に設定しています) に流れるように、Squid サーバー上で iptables コマンドを使ってポート転送の設定をします。

 
VyOS 側の設定コマンドは以下の通りです。

 
```
$ configure 
# set protocols static table 100 route 0.0.0.0/0 next-hop 10.10.90.11 
# set policy route PROXYROUTE rule 100 protocol tcp 
# set policy route PROXYROUTE rule 100 destination address 0.0.0.0/0 
# set policy route PROXYROUTE rule 100 destination port 80 
# set policy route PROXYROUTE rule 100 source address 10.10.0.0/16 
# set policy route PROXYROUTE rule 100 source mac-address !00:15:5d:01:02:12 
# set policy route PROXYROUTE rule 100 set table 100 
# set interfaces ethernet eth0 policy route PROXYROUTE 
# commit 
# save 
# exit 
$
```
 
ここで設定したルールは以下のようなものです。言い換えると、「VyOS に対して Squid サーバー以外の Internal ネットワーク内アドレスから HTTP パケット (80/tcp) が来たら Squid に流す」 という設定です。

 
- table 100 <br />
- 10.10.90.11 (= Squid サーバー) にルーティング 
- rule 100 (ポリシー名 PROXYROUTE) <br />
- TCP パケットである <br />
- 宛先 TCP ポートが 80 である <br />
- 送信元の IP アドレスが 10.10.0.0/16 ネットワークに所属している <br />
- 送信元の MAC アドレスが 00:15:5d:01:02:12 (=Squid サーバーのもの) ではない <br />
- 上記に該当するパケットはルーティングの table 100 を適用 
- Internal ネットワーク側の eth0 に対して PROXYROUTE を適用 

 
これだけだと、Squid に来たパケットの宛先ポートはまだ 80/tcp になっているので、透過プロキシのターゲットである 3129/tcp に変更する必要があります。Squid サーバー上で以下のコマンドを実行します。

 
```
$ sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 \ 
> -j REDIRECT --to-port 3129 
```
 
設定は以上です。Squid 側は、前回の状態から変更はありません。squid が起動していなければ起動しておいてください。また、クライアントからプロキシの設定を消すのを忘れないように。

 
![]({{site.assets_url}}2015-01-09-image16.png) <br />
透過プロキシなのでプロキシ設定は削除

 
クライアントでブラウザーを開いて HTTP のページにアクセスすると、プロキシの設定をしていないにも関わらず、Squid のアクセス ログにログが記録されます。これが透過プロキシの動作です。この状態で HTTPS にアクセスするとどうなるでしょうか。もちろんアクセスできます。なぜなら何も設定していないため、単純に VyOS を素通りしているだけだからです。

 
ここで Squid の話は終わってもよいのですが、実は設定時に少し違和感がありました。まあ私自身が iptables に明るくないからなんでしょうけど。ふと、「なぜポート転送したパケットを Squid の 3129/tcp が受信することができるのか」 という疑問が浮かびました。

 
クライアントから送られるパケットの旅を考えてみます。今回は非透過プロキシであり、クライアントから送信された時点でパケットは Web サーバーを宛先としています。VyOS で PBR が適用されて、Squid に送られます。このルーティングはどのように実現されているでしょうか。もし、Squid 上でポートが変更されたときに宛先の IP アドレスが Web サーバーのままだったら、そのアドレスはどう考えても Squid サーバーのアドレスである 10.10.90.11 とは似ても似つかないものであるわけで、ただ単に 3129/tcp ポートが一致したからといって Squid が受信できるのはおかしいだろう、という疑問です。

 
上記疑問を調べるため、Squid 上の iptables の設定を削除し、代わりに Squid が 80/tcp ポートで非透過プロキシを処理するように設定します。

 
iptables の削除は、-A を -D に置き換えて実行するだけです。-L オプションで、現在のルールの一覧を確認できます。

 
```
$ sudo iptables -t nat -D PREROUTING -i eth0 -p tcp --dport 80 \ 
> -j REDIRECT --to-port 3129 


$ sudo iptables -t nat -L 
Chain PREROUTING (policy ACCEPT) 
target     prot opt source               destination

Chain INPUT (policy ACCEPT) 
target     prot opt source               destination

Chain OUTPUT (policy ACCEPT) 
target     prot opt source               destination

Chain POSTROUTING (policy ACCEPT) 
target     prot opt source               destination 
```
 
/usr/local/squid/current/etc/squid.conf を開き、ポートの部分を 3129 から 80 に変更します。

 
```
# Squid normally listens to port 3128 
http_port 3128 
http_port 80 transparent
```
 
squid を再起動します。以下のログから、今度は 80/tcp が透過モードでの待機ポートであることが分かります。

 
```
2015/01/08 17:46:10| Accepting HTTP Socket connections at local=[::]:3128 remote=[::] FD 9 flags=9 
2015/01/08 17:46:10| Accepting NAT intercepted HTTP Socket connections at local=[::]:80 remote=[::] FD 10 flags=41
```
 
クライアントから HTTP のページにアクセスします。今度は "This page can’t be displayed" エラーで繋がらないはずです。これが意味することは、ポートが一致しているだけでは Squid はパケットを受信できない、ということです。また、VyOS の PBR は、宛先をアドレスを Squid の 10.10.90.11 には変更していないようです。

 
ということは、iptables によるポート転送は、ポートだけではなく宛先アドレスも自分のものに変更するのでしょうか。ちょっとこれは確かめようがありません。iptables の実装を見るのはさすがにしんどい。

 
とりあえず 3129/tcp ポートを使う設定に戻してから、今度は Client、VyOS、Squid、Web サーバーの 4 点でパケット キャプチャーを行ない、様子を確認することにします。Web サーバーは Azure 上に作った仮想マシン ([http://ubuntu-web.cloudapp.net/](http://ubuntu-web.cloudapp.net/)) を使います。

 
Ubuntu Server 上でのキャプチャーには tcpdump コマンドが使えます。作成されたファイルは Network Monitor や Wireshark で開くことができます。

 
```
$ sudo tcpdump -nn -s0 -i eth0 -w squid.cap
```
 
ここで少し注意。VyOS には eth0 と eth1 の 2 枚の NIC があります。tcpdump コマンドで -i any オプションを使うと、全ての NIC 上でキャプチャーを開始することができます、がしかし、パケットのイーサネット フレームが正確に記録されません。

 
```
For example, the "any" device on Linux will have a link-layer header type of DLT_LINUX_SLL even if all devices on the system at the time the "any" device is opened have some other data link type, such as DLT_EN10MB for Ethernet. 

-- Manpage of PCAP http://www.tcpdump.org/pcap3_man.html
```
 
ここで出てくる DLT_LINUX_SLL とは・・・

 
```
DLT_LINUX_SLL - Linux "cooked" capture encapsulation

-- pcap(3): Packet Capture library - Linux man page http://linux.die.net/man/3/pcap
```
 
実際に any でキャプチャーして Network Monitor で開いた様子を以下に示します。イーサネット フレーム部分が Linuxecookedmode という名前で表示され、MAC アドレスは送信元の情報だけが記録されています。イーサネット部分を見ない場合はこれでよいですが、今回はこれだと不便です。tcpdump では -i any は使わず、VyOS 上では eth0 と eth1 それぞれのために 2 つの tcpdump プロセスを起動することにします。

 
![]({{site.assets_url}}2015-01-09-image17.png)

 
そんなこんなでキャプチャーを取り、HTTP GET メソッドの要求と応答に着目し、送信元及び送信先のアドレスについてまとめました。細かいので Excel のキャプチャー画像で。

 
![]({{site.assets_url}}2015-01-09-image18.png)

 
 <br />
ルーティングによって、MAC アドレスや IP アドレスが変更されている様子が確認できます。ポートについては、宛先は常に 80 を指していますが、クライアント側の動的ポートは 53281 と 33788 の 2 つが見えます。前者が Windows クライアント上のポートであり、後者は Squid サーバー上の動的ポートです。

 
一つ気が付くのは、透過プロキシ用のポートである 3129/tcp ポートが見えないことです。上記テーブルの 3 行目、VyOS から Squid に転送されたパケットの宛先 IP アドレスは依然として ubuntu-web.cloudapp.net を名前解決した結果である 104.42.10.172 を指していますが、ポートも 80 のままです。このことから、tcpdump コマンドは iptables の PREROUTING チェーンが処理される前にパケットを取得していると考えられます。ポート転送された後のパケット内容がどうなっているかを、tcpdump から見ることはできません。

