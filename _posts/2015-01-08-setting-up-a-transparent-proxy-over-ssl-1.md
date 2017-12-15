---
layout: post
title: "Setting up a transparent proxy over SSL #1 - vyos"
date: 2015-01-08 16:21:24.000 +09:00
categories:
- Linux
- Network
tags:
- vyos
---

とあるテストのため、ルーターやらプロキシをごにょごにょ導入して環境を作りました。長くなりそうなので、先に作業内容を書いておきます (何せ書き溜めていないものでして・・)。参考 URL などは、都度掲載します。

 
1. vyos によるソフトウェア ルーティング 
1. squid による HTTP/HTTPS 非透過プロキシ 
1. squid による HTTP 透過プロキシ 
1. socat による TCP リレー 

 
### 1. vyos によるソフトウェア ルーティング

 
今の時代、多くの人は自宅にインターネット環境を持っていて、ルーターと呼ばれる小さな機械をプロバイダーからレンタルしていると思います。ルーターは、インターネット (英語だと、"the Internet" のように、固有名詞として先頭が大文字になり、the が付く) という地球規模の単一のネットワークと、自宅内の小規模なネットワーク (ルーターとパソコンが 1 台あれば、それはもうネットワークと呼べる) を繋ぐもので、ただ単にパケットを右から左へ受け流しているだけでなく、パケット内のアドレス情報を変更するというとても大事な仕事を行っています。最近のルーターは、IP マスカレードやファイアウォールなど、多くの機能が付随してきますが、ルーターの基本の機能は、宛先や差出人のアドレスをうまいこと調整することです。

 
ただし、自宅からプロバイダーを経由してインターネットにつなぐ場合、普通はユーザー アカウントの認証が必要です。認証は、PPPoE (Point to Point Protocol over Ethernet) というプロトコルで行われます。インターネットに繋ぐときのルーターは、IP レベルのルーティングを行なう単純なルーターに加え、PPPoE クライアントとしての機能を持つ、ブロードバンド ルーターという種別になります。

 
と、断言したものの、あまり自信がない。詳細は wiki を見てください。

 
<br />
[](http://ja.wikipedia.org/wiki/%E3%83%AB%E3%83%BC%E3%82%BF%E3%83%BC)
 

 
今回は、ルーティング ソフトとして VyOS という Linux ディストリビューションを使うことにしました。以前は Vyatta というルーター OS があったらしいですが、買収されて有償化されてしまい、無償版が VyOS としてフォークされた、ということが wiki に書いてありました。

 
VyOS <br />
[http://vyos.net/wiki/Main_Page](http://vyos.net/wiki/Main_Page)

 
本家のサイトから、ISO をダウンロードします。2015/1/7 現在の最新版は 1.1.1 のようです。amd64 用の ISO をダウンロードします。ダウンロード後は、本家の User Guide がとても親切なので、それにしたがって実行するだけです。

 
[http://vyos.net/wiki/User_Guide](http://vyos.net/wiki/User_Guide)

 
インストール先は、Hyper-V の仮想マシンにします。User Guide に、512MB RAM、2GB ストレージが推奨と書いてあるので、その通りに仮想マシンを作ります。NIC を 2 枚にするのを忘れないように。

 
![]({{site.assets_url}}2015-01-08-image4.png)

 
ISO をセットして起動すると、ISO から vyos が起動してログインを求められるので、ユーザー名 vyos、パスワード vyos を入力します。ログイン後、シェルが起動するので、install image コマンドを実行します。ここまで User Guide 通りです。

 
![]({{site.assets_url}}2015-01-08-image5.png) <br />
ログインして install image まで実行したところ

 
ここからも User Guide 通りです。

 
このあといろいろと聞かれますが、User Guide 通りに進めます。単なるルーターですし。唯一、イメージ名だけデフォルトの 1.1.1 ではなく vyos-1.1.1 に変えました。

 
![]({{site.assets_url}}2015-01-08-image6.png) <br />
インストールが終わったところ

 
インストールが終わったら、User Guide では reboot になっていますが、再起動するとまたすぐに ISO から vyos が起動してしまうので、シャットダウンして ISO を抜いてから再起動することにします。シャットダウンは poweroff コマンドです。shutdown コマンドは存在しません。

 
起動してログインしたら、ネットワーク設定と SSH サーバーの設定を行います。

 
仮想マシンに刺してある 2 枚の NIC は、1 枚目が Internal、2 枚目が External の Hyper-V 仮想スイッチに繋がるようにしたので、VyOS から見ると eth0 が Internal、eth1 が External になります。Internal ネットワークは 10.10.0.0/16、External は 10.0.0.0/24 のアドレス空間が割り当てられています。VyOS の eth0 には 10.10.90.12 のアドレスを割り当て、External の eth1 には、自宅の物理ルーター (10.0.0.1) をサーバーとする DHCP を利用することにします。

 
設定と言っても、以下のコマンドを実行するだけです。Ubuntu よりも簡単ですね。

 
```
$ configure

# set interfaces ethernet eth0 address '10.10.90.12/16' 
# set interfaces ethernet eth0 description 'Internal' 
# set interfaces ethernet eth1 address dhcp 
# set interfaces ethernet eth1 description 'External'

# set service ssh port '22' 
# set service ssh listen-address 10.10.90.12

# commit 
# save 
# exit
```
 
これで SSH が使えるようになったので、10.10.90.12 に対して Teratern で繋ぎにいきます。なお VyOS には ifconfig コマンドもありません。IP アドレスや MAC アドレスは show interfaces system コマンドで見ることができます。

 
```
vyos@vyos:~$ show interfaces system 
eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000 
    link/ether 00:15:5d:01:02:10 brd ff:ff:ff:ff:ff:ff 
    inet 10.10.90.12/16 brd 10.10.255.255 scope global eth0 
       valid_lft forever preferred_lft forever 
    inet6 fe80::215:5dff:fe01:210/64 scope link 
       valid_lft forever preferred_lft forever

    RX:  bytes    packets     errors    dropped    overrun      mcast 
         73227        834          0          0          0          0 
    TX:  bytes    packets     errors    dropped    carrier collisions 
         79657        566          0          0          0          0

eth1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000 
    link/ether 00:15:5d:01:02:11 brd ff:ff:ff:ff:ff:ff 
    inet 10.0.0.42/24 brd 10.0.0.255 scope global eth1 
       valid_lft forever preferred_lft forever 
    inet6 fe80::215:5dff:fe01:211/64 scope link 
       valid_lft forever preferred_lft forever

    RX:  bytes    packets     errors    dropped    overrun      mcast 
         59125        422          0          0          0          0 
    TX:  bytes    packets     errors    dropped    carrier collisions 
          5522         58          0          0          0          0

lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default 
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00 
    inet 127.0.0.1/8 scope host lo 
       valid_lft forever preferred_lft forever 
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever

    RX:  bytes    packets     errors    dropped    overrun      mcast 
         78208       1274          0          0          0          0 
    TX:  bytes    packets     errors    dropped    carrier collisions 
         78208       1274          0          0          0          0
```
 
では、いよいよルーティングの設定に移ります。コマンドを実行する前に、ここで実現したいことを確認します。

 
今 VyOS をインストールした仮想マシンに加え、もう一台 Windows が入った仮想マシンがあり、こちらには Internal の NIC が一枚だけ刺さっているとします。

 
- Hyper-V ゲスト #1 (今 VyOS をインストールした) <br />
- Network Adapter#1 (Internal) <br />
- Network Adapter#2 (External) 
- Hyper-V ゲスト #2 (単なる Windows マシン) <br />
- Network Adapter (Internal) 

 
このままだと、この Windows マシンからはインターネットにアクセスできません。Internal は Hyper-V 仮想マシン同士、及び仮想マシンと Hyper-V ホストとを通信可能にする閉じたネットワークであるためです。(下記の "内部仮想ネットワーク" 参照)

 
仮想ネットワークを構成する <br />
[http://technet.microsoft.com/ja-jp/library/cc816585(v=WS.10).aspx](http://technet.microsoft.com/ja-jp/library/cc816585(v=WS.10).aspx)

 
インターネットに接続しているのは自宅にある物理ルーターであり、その物理ルーターに接続している物理ネットワーク、すなわち Hyper-V の外部仮想ネットワークです。ここで、Internal とExternal との両方へのアクセスを持つ VyOS をルーターとして経由することで、Internal としか接点を持たない Windows もインターネットに接続させることができます。

 
実は、ルーティングの設定はとても簡単です。さすが特化型 OS です。configure モードでコマンドを 3 つ実行するだけです。

 
```
$ configure

# set nat source rule 100 outbound-interface 'eth1' 
# set nat source rule 100 source address '10.10.0.0/16' 
# set nat source rule 100 translation address 'masquerade' 
# commit 
# save 
# exit 
$
```
 
VyOS 側の設定はこれだけです。再起動も不要です。

 
ただし、これだけでは目的は達成できず、Windows 側にも設定が必要です。なぜなら、この時点で Windows はルーターの位置を知らないからです。ルーターの位置を教えるためには、NIC の設定にあるデフォルト ゲートウェイのところに VyOS の内部ネットワーク側の IP アドレスである 10.10.90.12 を指定します。

 
![]({{site.assets_url}}2015-01-08-image7.png)

 
これで、Windows が 10.10.0.0/16 のネットワークの外にあるアドレスにアクセスしようとすると、パケットは VyOS に転送されて、うまいことルーティングしてくれるはずです。

 
が、ブラウザーからインターネット (ここでは bing.com) に接続しようとすると、"This page can’t be displayed" エラーで怒られます。これの理由は、インターネットに接続する以前に bing.com を名前解決できなかったためです。ルーティングの設定が正しくても、そもそもアクセスしようとする場所のアドレスが分からないので、ルーティングが起こる前にエラーになっています。

 
ということは、IP を直打ちすれば外部にアクセスできるはずです。例えば、Google が持つ DNS サーバーの IP アドレスが 8.8.8.8 であることは比較的有名です。そこで、nslookup を使って名前解決を試します。

 
```
C:\MSWORK> nslookup bing.com. 8.8.8.8 
Server:  google-public-dns-a.google.com 
Address:  8.8.8.8

Non-authoritative answer: 
Name:    bing.com 
Address:  204.79.197.200
```
 
無事動きました。ゲートウェイの設定とルーティングは問題ないようです。

 
そこで、解決策の一つとしては、ゲートウェイの設定に加えて DNS サーバー参照の設定に 8.8.8.8 などの外部 DNS サーバーを追加する方法が考えられます。これでブラウザーから bing.com にアクセスできるようになります。

 
![]({{site.assets_url}}2015-01-08-image8.png) <br />
とりあえず Google に頼っておく場合の設定

 
今回の環境は、クライアントが Active Directory ドメイン contoso.nttest.microsoft.com に所属しており、そのドメイン コントローラー (IP=10.10.10.10) に DNS サーバーの役割もインストールしてあります。クライアントがドメイン所属のコンピューターとして正しく動作するためには、内部の DNS サーバーにアクセスできなければいけません。そこで、ドメイン コントローラー兼 DNS サーバーのマシンにデフォルト ゲートウェイの設定を行ない、外部ホスト名の名前解決に関しては、内部 DNS サーバー経由で名前解決ができるようにします。

 
クライアント側の優先 DNS サーバーを 10.10.10.10 に設定します。

 
![]({{site.assets_url}}2015-01-08-image9.png) <br />
内部 DNS サーバー 10.10.10.10 を見に行くように設定

 
次に、DNS サーバーが外部にアクセスできるように、ドメイン コントローラー兼 DNS サーバーのマシン上でもデフォルト ゲートウェイの設定を追加します。OS は Windows Server 2012 です。

 
![]({{site.assets_url}}2015-01-08-image10.png)

 
DNS サーバー サービス上の設定は不要です。内部 DNS サーバーから見て、もし自分の知らないレコードの解決を求められた場合、まずは DNS フォワーダーを見に行きます。フォワーダーが設定されていれば、クエリを丸投げします。フォワーダーが使えない場合、ルート ヒントが使われます。ルート ヒントには、予めインターネットのルート ネーム サーバーの IP アドレスが設定されています。その他、Windows Server の DNS には条件付きフォワーダーというのもあります。

 
フォワーダーとは <br />
[http://technet.microsoft.com/ja-jp/library/cc730756.aspx](http://technet.microsoft.com/ja-jp/library/cc730756.aspx)

 
フォワーダーを使用する <br />
[http://technet.microsoft.com/ja-jp/library/cc754931.aspx](http://technet.microsoft.com/ja-jp/library/cc754931.aspx)

 
ルートサーバ - Wikipedia <br />
[http://ja.wikipedia.org/wiki/%E3%83%AB%E3%83%BC%E3%83%88%E3%82%B5%E3%83%BC%E3%83%90](http://ja.wikipedia.org/wiki/%E3%83%AB%E3%83%BC%E3%83%88%E3%82%B5%E3%83%BC%E3%83%90)

 
今回の環境において、内部 DNS サーバーにフォワーダーの設定はしていません。

 
![]({{site.assets_url}}2015-01-08-image11.png)

 
しかるべき順序にしたがって、クライアントから来た DNS クエリはルートヒントに転送されることになります。この内部 DNS サーバーも Internal のネットワークにしか繋がっていないので、ルートヒントへの転送は VyOS を経由して送られます。

 
![]({{site.assets_url}}2015-01-08-image12.png) <br />
デフォルトのルート ヒント設定

 
試しに DNS 名前解決の様子をキャプチャーしてみました。以下の例では、ルート ヒントの一つである 192.203.230.10 (e.root-servers.net) が使われていることが確認できます。パケットの宛先 IP アドレスはゲートウェイの 10.10.90.12 ではなく、最終目的地であるルート サーバーになっているところがポイントでは。ではなぜこのパケットがゲートウェイに届くかというと、パケットの宛先 MAC アドレスが VyOS の eth0 である 00:15:5d:01:02:10 になっているためです。

 
![]({{site.assets_url}}2015-01-08-image13.png)

 
ここでは試しませんが、ルート ヒントの代わりに、フォワーダーとして 8.8.8.8 を設定してもよいです。

