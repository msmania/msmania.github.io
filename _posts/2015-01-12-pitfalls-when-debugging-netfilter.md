---
layout: post
title: "Pitfalls when debugging Netfilter"
date: 2015-01-12 23:45:47.000 -08:00
categories:
- Debug
- Linux
tags:
- gdb
- iptables
- kgdb
- netfilter
---

Linux カーネル デバッグ実践の第一弾、ということで iptables、すなわち netfilter に手を出しています。思っていたほど魔境ではありませんでした。1 つ 1 つの関数は短いですし、言語が C++ じゃなく C ですし。仕事で読んでいるコードのほうが魔境であることが再確認できました。ただ、コードそのものよりも、vi や bash などのツールに慣れていないので時間がかかります。

 
デバッグを進めるうちに、Linux カーネル デバッグ特有の罠に嵌ったので、解決方法とともに紹介したいと思います。今後もこのシリーズが続きそうです。

 
開発環境 (debugger) とテスト環境 (debuggee) は前回の記事の環境をそのまま使います。VMware ESXi 上の Ubuntu Server 14.04.1 に Linux 3.18.2 をインストールした環境です。

 
### 1. iptables コマンドで nat テーブルが存在しないと怒られる

 
今回のデバッグで目指しているのは、iptables でポート フォワードしたときの、オリジナルの宛先 IP アドレスを求める方法を探ることです。背景などの詳細はこちらの記事をご参照下さい。

 
Setting up a transparent proxy over SSL #4 – netcat/socat | すなのかたまり <br />
[https://msmania.wordpress.com/2015/01/10/setting-up-a-transparent-proxy-over-ssl-4-netcatsocat/](https://msmania.wordpress.com/2015/01/10/setting-up-a-transparent-proxy-over-ssl-4-netcatsocat/)

 
何はともあれ、まずは新しい Linux カーネルで上記記事と同じ環境を作るので、iptables コマンドを実行してみました。

 
```
$ sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 443 -j REDIRECT --to-port 3130 
iptables v1.4.21: can't initialize iptables table `nat': Table does not exist (do you need to insmod?) 
Perhaps iptables or your kernel needs to be upgraded.
```
 
いきなり iptables コマンドがエラーになります。悪い冗談はやめて欲しいですね。

 
ここでけっこう詰まったのですが、結論から言うと、ビルドしたときの config パラメーターが不足していました。.config ファイルを直接開いて、それっぽい項目を探すと、CONFIG_IP_NF_NAT という設定がコメントになっています。

 
```
# CONFIG_IP_NF_NAT is not set
```
 
でも make oldconfig したのになぜ・・という話ですが、カーネルが 3.16 から 3.17 になったときに設定の名前が変わったという情報を見つけました。Ubuntu Server 14.04.1 のオリジナルは Linux 3.13.0 だったので、見事に引っかかりました。デフォルトが無効になったのが解せぬ。

 
```
> Between linux version 3.16 and 3.17 the option 
> CONFIG_NF_NAT_IPV4 changed the name to 
> CONFIG_IP_NF_NAT. This option is not enabled in linux-image-3.17-rc5-amd64

-- https://lists.debian.org/debian-kernel/2014/09/msg00298.html
```
 
make oldconfig のログを読み返すと、確かに新しい設定として検出されていました。ええ、Enter キーを長押しにしていたので気づきませんでしたとも。こんなの気付かないよなぁ・・。

 
```
* 
* IP: Netfilter Configuration 
* 
IPv4 connection tracking support (required for NAT) (NF_CONNTRACK_IPV4) [M/n/?] m 
ARP packet logging (NF_LOG_ARP) [N/m/y] (NEW) 
IPv4 packet logging (NF_LOG_IPV4) [M/y] (NEW) 
IPv4 nf_tables support (NF_TABLES_IPV4) [M/n/?] m 
  IPv4 nf_tables route chain support (NFT_CHAIN_ROUTE_IPV4) [M/n/?] m 
IPv4 packet rejection (NF_REJECT_IPV4) [M/y] (NEW) 
ARP nf_tables support (NF_TABLES_ARP) [M/n/?] m 
IPv4 NAT (NF_NAT_IPV4) [M/n/?] m 
  IPv4 nf_tables nat chain support (NFT_CHAIN_NAT_IPV4) [M/n/?] m 
  IPv4 masquerade support (NF_NAT_MASQUERADE_IPV4) [N/m/?] (NEW) 
  Basic SNMP-ALG support (NF_NAT_SNMP_BASIC) [M/n/?] m 
IP tables support (required for filtering/masq/NAT) (IP_NF_IPTABLES) [M/n/y/?] m 
  "ah" match support (IP_NF_MATCH_AH) [M/n/?] m 
  "ecn" match support (IP_NF_MATCH_ECN) [M/n/?] m 
  "rpfilter" reverse path filter match support (IP_NF_MATCH_RPFILTER) [M/n/?] m 
  "ttl" match support (IP_NF_MATCH_TTL) [M/n/?] m 
  Packet filtering (IP_NF_FILTER) [M/n/?] m 
    REJECT target support (IP_NF_TARGET_REJECT) [M/n/?] m 
  SYNPROXY target support (IP_NF_TARGET_SYNPROXY) [M/n/?] m 
  iptables NAT support (IP_NF_NAT) [N/m/?] (NEW) 
  Packet mangling (IP_NF_MANGLE) [M/n/?] m 
    CLUSTERIP target support (IP_NF_TARGET_CLUSTERIP) [M/n/?] m 
    ECN target support (IP_NF_TARGET_ECN) [M/n/?] m 
    "TTL" target support (IP_NF_TARGET_TTL) [M/n/?] m 
  raw table support (required for NOTRACK/TRACE) (IP_NF_RAW) [M/n/?] m 
  Security table (IP_NF_SECURITY) [M/n/?] m
```
 
make menuconfig の位置は ↓ です。

 
```
Prompt: iptables NAT support 
Location: 
  -> Networking support (NET [=y]) 
    -> Networking options 
      -> Network packet filtering framework (Netfilter) (NETFILTER [=y]) 
        -> IP: Netfilter Configuration 
          -> IP tables support (required for filtering/masq/NAT) (IP_NF_IPTABLES [=m])
```
 
二度とこのようなことがないように、よく分からない項目も含めて netfilter に関する項目を menuconfig から有効にしておきます。追加で有効にした項目はこちら。

 
```
> CONFIG_NETFILTER_DEBUG=y 
> CONFIG_NF_TABLES_INET=m 
> CONFIG_NFT_MASQ=m 
> CONFIG_NFT_QUEUE=m 
> CONFIG_NFT_REJECT=m 
> CONFIG_NFT_REJECT_INET=m 
> CONFIG_NETFILTER_XT_NAT=m 
> CONFIG_NFT_REJECT_IPV4=m 
> CONFIG_NF_NAT_MASQUERADE_IPV4=m 
> CONFIG_NFT_MASQ_IPV4=m 
> CONFIG_IP_NF_NAT=m 
> CONFIG_IP_NF_TARGET_MASQUERADE=m 
> CONFIG_IP_NF_TARGET_NETMAP=m 
> CONFIG_IP_NF_TARGET_REDIRECT=m 
> CONFIG_NFT_REJECT_IPV6=m 
> CONFIG_NF_NAT_MASQUERADE_IPV6=m 
> CONFIG_NFT_MASQ_IPV6=m 
> CONFIG_IP6_NF_NAT=m 
> CONFIG_IP6_NF_TARGET_MASQUERADE=m 
> CONFIG_IP6_NF_TARGET_NPT=m
```
 
で、ビルドしたら無事に iptables コマンドはうまくいきました。検索すると、同じように困っている人が世界中にいるようでした。oldconfig で Enter キーを長押しした人たちでしょう。

 
### 2. Kernel Loadable Modules のシンボルが解決できない

 
iptables によるポート フォワードの設定はうまくいきました。次は、フォワードされたパケットを補足する簡単なソケット通信のプログラムを書き、ポート フォワードを簡単に引き起こせるようにしておきます。

 
netfilter のコードを見渡して、IPv4 を NAT するときに実行されそうな処理の一つとして、net/ipv4/netfilter/nf_nat_l3proto_ipv4.c にある nf_nat_ipv4_manip_pkt という関数に目をつけました。そこで、SysRq-g でブレークさせて関数を探すと・・・。ハイ、見つかりません。

 
```
(gdb) i functions nf_nat_ipv4_manip_pkt 
All functions matching regular expression "nf_nat_ipv4_manip_pkt":
```
 
どうせインライン展開でもされているんでしょう、と思って呼び出し元を探そうとすると、関数アドレスがグローバル変数の nf_nat_l3proto_ipv4.manip_pkt に代入されているのを発見しました。というわけで、この関数がインライン展開されるとは思えません。おかしいですね。

 
nf_ で始まるシンボルを全部表示してみます。

 
```
(gdb) i functions ^nf_ 
All functions matching regular expression "^nf_":

File net/ipv4/netfilter.c: 
__sum16 nf_ip_checksum(struct sk_buff *, unsigned int, unsigned int, u_int8_t); 
static __sum16 nf_ip_checksum_partial(struct sk_buff *, unsigned int, unsigned int, unsigned int,

(snip)
```
 
net/ipv4/netfilter ディレクトリのファイルが全滅しています。ますますおかしい。そこで net/ipv4/netfilter/Makefile の内容を見てみると、以下の行を発見。むむっ、これはもしかして。

 
```
nf_nat_ipv4-y       := nf_nat_l3proto_ipv4.o nf_nat_proto_icmp.o 
obj-$(CONFIG_NF_NAT_IPV4) += nf_nat_ipv4.o
```
 
ふと思いついて lsmod コマンドを実行しました。どうやらモジュール ファイルが別になっているのが理由のようです。つまり、kdb セッションに繋ぐ前に、開発機にある vmlinux をターゲットとして gdb を起動しているので、vmlinux (すなわち /boot/vmlinuz-**** の中身) のシンボルしか解決できないのでしょう。

 
```
john@linux-test:~$ sudo lsmod | grep nf 
[sudo] password for john: 
nf_conntrack_ipv4      14806  1 
nf_defrag_ipv4         12758  1 nf_conntrack_ipv4 
nf_nat_ipv4            14115  1 iptable_nat 
nf_nat                 22050  2 nf_nat_ipv4,xt_REDIRECT 
nf_conntrack          100933  3 nf_nat,nf_nat_ipv4,nf_conntrack_ipv4
```
 
Kernel Loaded Module をデバッグするときはどうするのかを調べると、gdb 上で add-symbol-file コマンドを実行して、手動でシンボル ファイルを追加しないといけないらしいです。しかも、モジュール イメージのコード セクションがロードされているアドレスも指定しないといけないとか。何これ。超めんどくさいんですけど。Windows Debugger なら全部自動でやってくれるのに！

 
幸いなことに、カーネル モジュールのコード セクションは sysfs 仮想ファイル システム経由でで簡単に見つけられます。そこで、以下のスクリプトを書いて、全カーネル モジュールのコード セクションのアドレスを一気にダンプできるようにしました。こういうことはデバッガーのコマンド経由でできるといいのですが。

 
```
#!/bin/bash 
for file in $(find /sys/module -name .text) ; do 
    addr=`cat ${file}` 
    echo $addr " : " ${file} 
done
```
 
とにかく無事アドレスをゲット。

 
```
john@linux-test:~$ sudo ./lm.sh  | sort -k1 
0xffffffffa0000000  :  /sys/module/floppy/sections/.text 
0xffffffffa0012000  :  /sys/module/mac_hid/sections/.text 
0xffffffffa0019000  :  /sys/module/mptbase/sections/.text 
0xffffffffa0033000  :  /sys/module/mptspi/sections/.text 
0xffffffffa003a000  :  /sys/module/mptscsih/sections/.text 
0xffffffffa0049000  :  /sys/module/e1000/sections/.text 
0xffffffffa006c000  :  /sys/module/parport/sections/.text 
0xffffffffa0078000  :  /sys/module/lp/sections/.text 
0xffffffffa007e000  :  /sys/module/parport_pc/sections/.text 
0xffffffffa0087000  :  /sys/module/shpchp/sections/.text 
0xffffffffa0092000  :  /sys/module/serio_raw/sections/.text 
0xffffffffa0097000  :  /sys/module/coretemp/sections/.text 
0xffffffffa009c000  :  /sys/module/crc_ccitt/sections/.text 
0xffffffffa00a1000  :  /sys/module/psmouse/sections/.text 
0xffffffffa00be000  :  /sys/module/i2c_piix4/sections/.text 
0xffffffffa00c5000  :  /sys/module/vmw_vmci/sections/.text 
0xffffffffa00db000  :  /sys/module/vmw_balloon/sections/.text 
0xffffffffa00e0000  :  /sys/module/ppdev/sections/.text 
0xffffffffa00e6000  :  /sys/module/nf_nat_ipv4/sections/.text 
0xffffffffa00eb000  :  /sys/module/irda/sections/.text 
0xffffffffa010c000  :  /sys/module/drm/sections/.text 
0xffffffffa015b000  :  /sys/module/ttm/sections/.text 
0xffffffffa0171000  :  /sys/module/nf_nat/sections/.text 
0xffffffffa0178000  :  /sys/module/drm_kms_helper/sections/.text 
0xffffffffa0191000  :  /sys/module/vmwgfx/sections/.text 
0xffffffffa01bd000  :  /sys/module/x_tables/sections/.text 
0xffffffffa01c7000  :  /sys/module/ip_tables/sections/.text 
0xffffffffa01cf000  :  /sys/module/nf_conntrack/sections/.text 
0xffffffffa01e9000  :  /sys/module/nf_defrag_ipv4/sections/.text 
0xffffffffa01ee000  :  /sys/module/nf_conntrack_ipv4/sections/.text 
0xffffffffa01f3000  :  /sys/module/iptable_nat/sections/.text 
0xffffffffa01f8000  :  /sys/module/xt_tcpudp/sections/.text 
0xffffffffa01fd000  :  /sys/module/xt_REDIRECT/sections/.text
```
 
ターゲットにする関数は nf_nat_ipv4_manip_pkt で、nf_nat_ipv4 に実装されているはずですが、念のため事前に objdump でオブジェクト ファイルのシンボル テーブルを確認しておきます。

 
```
john@linux-dev:/usr/src/linux-3.18.2$ find . -name nf_nat_ipv4.o 
./net/ipv4/netfilter/nf_nat_ipv4.o 
john@linux-dev:/usr/src/linux-3.18.2$ objdump --syms ./net/ipv4/netfilter/nf_nat_ipv4.o | grep nf_nat_ipv4_manip_pkt 
0000000000000330 l     F .text  000000000000011b nf_nat_ipv4_manip_pkt
```
 
無事見つかりました。これで一安心です。では実際にデバッガーにシンボル追加して、ブレークポイントを設定します。

 
```
(gdb) add-symbol-file ./net/ipv4/netfilter/nf_nat_ipv4.o 0xffffffffa00e6000 
add symbol table from file "./net/ipv4/netfilter/nf_nat_ipv4.o" at 
        .text_addr = 0xffffffffa00e6000 
(y or n) y 
Reading symbols from ./net/ipv4/netfilter/nf_nat_ipv4.o...done.

(gdb) i functions nf_nat_ipv4_manip_pkt 
All functions matching regular expression "nf_nat_ipv4_manip_pkt":

File net/ipv4/netfilter/nf_nat_l3proto_ipv4.c: 
static bool nf_nat_ipv4_manip_pkt(struct sk_buff *, unsigned int, const struct nf_nat_l4proto *, 
    const struct nf_conntrack_tuple *, enum nf_nat_manip_type);

(gdb) break nf_nat_ipv4_manip_pkt 
Breakpoint 1 at 0xffffffffa00e6330: file net/ipv4/netfilter/nf_nat_l3proto_ipv4.c, line 83.

(gdb)i break 
Num     Type           Disp Enb Address            What 
1       breakpoint     keep y   0xffffffffa00e6330 in nf_nat_ipv4_manip_pkt 
                                                   at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:83 
(gdb) c 
Continuing.
```
 
ようやくブレークポイントを設定できました。クライアントからパケットを送って、ポート フォワードを引き起こしてみます。

 
```
(gdb) c 
Continuing.

Breakpoint 1, nf_nat_ipv4_manip_pkt (skb=0xffff88003d1d9600, iphdroff=2685874880, 
    l4proto=0xffffffffa01732c0, target=0xffff88003fc03a20, maniptype=NF_NAT_MANIP_DST) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:83 
83      { 
(gdb) bt 
#0  nf_nat_ipv4_manip_pkt (skb=0xffff88003d1d9600, iphdroff=2685874880, 
    l4proto=0xffffffffa01732c0, target=0xffff88003fc03a20, maniptype=NF_NAT_MANIP_DST) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:83 
#1  0xffffffffa0171126 in ?? () 
#2  0xffffffff81ce3ca8 in init_net () 
#3  0x000000003000000a in ?? () 
#4  0x0000000000000000 in ?? () 
(gdb) c 
Continuing.

Breakpoint 1, nf_nat_ipv4_manip_pkt (skb=0xffff88003d1d9e00, iphdroff=2685874880, 
    l4proto=0xffffffffa01732c0, target=0xffff88003fc03640, maniptype=NF_NAT_MANIP_SRC) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:83 
83      { 
(gdb) bt 
#0  nf_nat_ipv4_manip_pkt (skb=0xffff88003d1d9e00, iphdroff=2685874880, 
    l4proto=0xffffffffa01732c0, target=0xffff88003fc03640, maniptype=NF_NAT_MANIP_SRC) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:83 
#1  0xffffffffa0171126 in ?? () 
#2  0xffffffff81ce3ca8 in init_net () 
#3  0x00000000ac0a2a68 in ?? () 
#4  0x0000000000000000 in ?? ()
```
 
読み通り、ポート フォワードのときに nf_nat_ipv4_manip_pkt は実行されました。これを取っ掛かりとしてコードを追いかけていけば何とかなるでしょう。途中のフレームにあるモジュールのシンボルが無いため、コール スタックはおかしなことになっているのが気になります。もう少しシンボルを追加することにします。

 
上述したコード セクションのアドレスをダンプするスクリプトの出力結果は、アドレス順にソートしてあります。アドレス一覧と nf_nat_ipv4_manip_pkt のリターン アドレス 0xffffffffa0171126 とを比べると、このアドレスは nf_nat のモジュール内であることが分かります。そこで今度は nf_nat のシンボルを追加して、もう一度コール スタックを確認します。

 
```
(gdb) add-symbol-file ./net/netfilter/nf_nat.o 0xffffffffa0171000 
add symbol table from file "./net/netfilter/nf_nat.o" at 
        .text_addr = 0xffffffffa0171000 
(y or n) y 
Reading symbols from ./net/netfilter/nf_nat.o...done. 
(gdb) c 
Continuing.

(gdb) bt 
#0  nf_nat_ipv4_manip_pkt (skb=0xffff880036799700, iphdroff=2685874880, 
    l4proto=0xffffffffa01732c0, target=0xffff88003fc03a20, maniptype=NF_NAT_MANIP_DST) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:83 
#1  0xffffffffa0171126 in nf_nat_packet (ct=<optimized out>, ctinfo=<optimized out>, 
    hooknum=<optimized out>, skb=0xffff880036799700) at net/netfilter/nf_nat_core.c:501 
#2  0xffffffffa00e6896 in nf_nat_ipv4_fn (ops=0xffffffffa01f5040, skb=0xffff880036799700, 
    in=<optimized out>, out=0x0 <irq_stack_union>, do_chain=<optimized out>) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:339 
#3  0xffffffffa00e695e in nf_nat_ipv4_in (ops=<optimized out>, skb=0xffff880036799700, 
    in=<optimized out>, out=<optimized out>, do_chain=<optimized out>) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:359 
#4  0xffffffffa01f30a5 in ?? () 
#5  0xffff88003fc03b58 in ?? () 
#6  0xffffffff81694e5e in nf_iterate (head=<optimized out>, skb=0xffff880036799700, 
    hook=<optimized out>, indev=0xffff88003651c000, outdev=0x0 <irq_stack_union>, 
    elemp=0xffff88003fc03ba0, okfn=0xffffffff8169b650 <ip_rcv_finish>, hook_thresh=-2116913248) 
    at net/netfilter/core.c:142 
Backtrace stopped: frame did not save the PC

(gdb) c 
Continuing.

Breakpoint 1, nf_nat_ipv4_manip_pkt (skb=0xffff880036799800, iphdroff=2685874880, 
    l4proto=0xffffffffa01732c0, target=0xffff88003fc03640, maniptype=NF_NAT_MANIP_SRC) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:83 
83      { 
(gdb) bt 
#0  nf_nat_ipv4_manip_pkt (skb=0xffff880036799800, iphdroff=2685874880, 
    l4proto=0xffffffffa01732c0, target=0xffff88003fc03640, maniptype=NF_NAT_MANIP_SRC) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:83 
#1  0xffffffffa0171126 in nf_nat_packet (ct=<optimized out>, ctinfo=<optimized out>, 
    hooknum=<optimized out>, skb=0xffff880036799800) at net/netfilter/nf_nat_core.c:501 
#2  0xffffffffa00e6896 in nf_nat_ipv4_fn (ops=0xffffffffa01f5078, skb=0xffff880036799800, 
    in=<optimized out>, out=0xffff88003651c000, do_chain=<optimized out>) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:339 
#3  0xffffffffa00e6a08 in nf_nat_ipv4_out (ops=<optimized out>, skb=0xffff880036799800, 
    in=<optimized out>, out=<optimized out>, do_chain=<optimized out>) 
    at net/ipv4/netfilter/nf_nat_l3proto_ipv4.c:389 
#4  0xffffffffa01f3085 in ?? () 
#5  0xffff88003fc03768 in ?? () 
#6  0xffffffff81694e5e in nf_iterate (head=<optimized out>, skb=0xffff880036799800, 
    hook=<optimized out>, indev=0x0 <irq_stack_union>, outdev=0xffff88003651c000, 
    elemp=0xffff88003fc037b0, okfn=0xffffffff8169ff80 <ip_finish_output>, hook_thresh=-2116913184) 
    at net/netfilter/core.c:142 
Backtrace stopped: frame did not save the PC
```
 
まだ完全ではないようですが、先ほどよりは多くの情報が出てきました。

 
シンボルが解決できないときにコール スタックをうまく辿れなくなるということは、ビルドでは FPO (=Frame Pointer Omission) が有効になっているように見えます。それっぽい設定は以下の 3 箇所ありました。有効になっている SCHED_OMIT_FRAME_POINTER が他の設定を上書きしているのかもしれません。これ以上追いかけていないので、確証はありませんが。

 
```
Symbol: FRAME_POINTER [=y] 
Type  : boolean 
Prompt: Compile the kernel with frame pointers 
  Location: 
    -> Kernel hacking 
(1)   -> Compile-time checks and compiler options 
  Defined at lib/Kconfig.debug:296 
  Depends on: DEBUG_KERNEL [=y] && (CRIS || M68K || FRV || UML || AVR32 || SUPERH || BLACKF 
  Selected by: FAULT_INJECTION_STACKTRACE_FILTER [=n] && FAULT_INJECTION_DEBUG_FS [=n] && S

Symbol: ARCH_WANT_FRAME_POINTERS [=y] 
Type  : boolean 
  Defined at lib/Kconfig.debug:292 
  Selected by: X86 [=y]

Symbol: SCHED_OMIT_FRAME_POINTER [=y] 
Type  : boolean 
Prompt: Single-depth WCHAN output 
  Location: 
(2) -> Processor type and features 
  Defined at arch/x86/Kconfig:589 
  Depends on: X86 [=y]
```
 
とりあえずはこの設定でデバッグを続けるか、netfilter をビルトインしてしまうかは迷うところです。

