---
layout: post
title: "[linux] serial console login to Ubuntu 12.04 LTS from Windows 8 RP"
date: 2012-07-09 02:11:01.000 +09:00
categories:
- Linux
tags:
- grub
- rs-232c
- serial
- teraterm
---

Linux のマシンを立てたら、やはりシリアル コンソールを使ってみないといけません。そんなわけで、Windows 8 から Ubuntu 12.04 LTS の物理マシンに RS-232C 経由で接続してみます。

 
<font color="#0000ff">(2015/1/11 修正)      <br>2015 年に Linux のカーネル デバッグ環境を作りました。途中までの手順はシリアル コンソール ログインとほとんど同じなので、それに合わせてこちらの手順も更新しました。なお、この記事では物理マシンのシリアル ポートを使っていますが、VMware ESXi や Hyper-V 仮想マシンの仮想シリアル ポートを使うこともできます。</font>

 
How to Live Debug a Linux Kernel in Ubuntu Server | すなのかたまり <br />
[https://msmania.wordpress.com/2015/01/11/how-to-live-debug-a-linux-kernel-in-ubuntu-server/](https://msmania.wordpress.com/2015/01/11/how-to-live-debug-a-linux-kernel-in-ubuntu-server/)

 
まず、シリアル ケーブルを用意します。時代錯誤な、と言われそうですが、きっとハードウェア屋の業界ではまだまだ RS-232C は現役です。でもセントロニクスはちょっと・・・いやなんでもないです。

 
ネットで買えばいいんですが、あえて秋葉原で買ってきました。ヒロセテクニカルの地下でゲット。

 
![]({{site.assets_url}}2012-07-09-cimg2780.jpg)

 
- ELECOM C232R-930 シリアル リバース ケーブル 3m : 1,680 円 <br />
[http://www2.elecom.co.jp/cable/rs232c/c232r-9/](http://www2.elecom.co.jp/cable/rs232c/c232r-9/) 
- ELECOM UC-SGT USB to シリアル ケーブル 0.5m : 3,314 円 <br />
[http://www2.elecom.co.jp/cable/usb/uc-s/gt/](http://www2.elecom.co.jp/cable/usb/uc-s/gt/) 

 
計 5,000 円弱。今見たら Amazon の方が安い。ちっ。 <br />
Windows クライアント側のノート PC には外出しの COM ポートがないので、USB 変換ケーブルを使います。高い。

 
## Windows 側の設定

 
せっかくなので、Windows 8 Release Preview で試します。

 
買ってきた ELECOM の USB to シリアル ケーブルに付属のドライバー インストール CD には Windows 98/Me/2000/XP/Vista と書いてありますが、Windows 7 と Windows 8 も 32bit 版であれば動作します。64bit のドライバーは付属されていないので動作しません。

 
付属 CD を使ってドライバーをインストールし、ケーブルを接続すると、ドライバーが正常にロードされて COM ポートが追加されました。

 
![]({{site.assets_url}}2012-07-09-image.png)

 
ドライバーは、ser2el.sys というファイルで、チップメーカーの Prolific 製です。

 
![]({{site.assets_url}}2012-07-09-image1.png) ![]({{site.assets_url}}2012-07-09-image2.png)

 
デバイス マネージャーから、ボーレートなどの設定が可能です。&#x5b;詳細設定&#x5d; 画面では、COM ポート番号の指定も可能です。

 
![]({{site.assets_url}}2012-07-09-image3.png)

 
64bit でも動作するドライバーないんかい、と探してみると、なんか見つけましたよ。あれ？

 
[http://www.prolific.com.tw/US/ShowProduct.aspx?p_id=225&pcid=41](http://www.prolific.com.tw/US/ShowProduct.aspx?p_id=225&pcid=41)

 
そんなわけで、これを 64bit の Windows 7 SP1 にて入れてみましたが、動作せず・・・。

 
![]({{site.assets_url}}2012-07-09-01.png)

 
![]({{site.assets_url}}2012-07-09-04.png) 

 
![]({{site.assets_url}}2012-07-09-02.png) ![]({{site.assets_url}}2012-07-09-03.png)

 
チップの種類が違うんですかねー、とヘルプを見ていると！

 
![]({{site.assets_url}}2012-07-09-05.png)

 
```
Please be warned that counterfeit/fake PL-2303HX Rev A (or PL-2303HXA) USB-to-Serial Controller ICs using Prolific's trademark logo, brandname, and drivers, are being sold in the China market. Counterfeit IC products show exactly the same outside chip markings but generally are of poor quality and causes Windows driver compatibility issues (Yellow Mark Error Code 10 in Device Manager under WinXP, Vista, and 7). This warning is issued to all customers and consumers to avoid confusion and false purchase. Please purchase only from stores or vendors providing technical and RMA support.
```
 
<strike>なんと偽物！！エレコム！！！ </strike><font color="#0000ff">まだ未確認ですが、一概に偽物というわけでもないようです。そのうち確認したい。(2014/8/13 追記)</font>

 
どうせなら 64bit ドライバーもビルドしておいて欲しかった・・・。そんなわけで皆様、デバイス代はケチらないようにしましょう。

 
## Ubuntu 側の設定

 
気を取り直して、次に Ubuntu 側の設定に移ります。

 
本家のここが参考になります。あとは Google 先生なり Bing 先生に頼る感じで。

 
SerialConsoleHowto - Community Ubuntu Documentation <br />
[https://help.ubuntu.com/community/SerialConsoleHowto](https://help.ubuntu.com/community/SerialConsoleHowto)

 
まずは init デーモンである upstart の設定を行ないます。以下の内容で /etc/init/ttyS0.conf を新規作成します。

 
```
# ttyS0 - getty 
# 
# This service maintains a getty on ttyS0 from the point the system is 
# started until it is shut down again.

start on stopped rc or RUNLEVEL=[12345] 
stop on runlevel [!12345]

respawn 
exec /sbin/getty -L 115200 ttyS0 vt102
```
 
作った設定で getty を起動します。

 
```
$ sudo start ttyS0 
ttyS0 start/running, process 1147
```
 
この瞬間から、getty がシリアル ポートからのシグナルを待機し始めるので、既にシリアル ログインが可能です。

 
物理マシンではなく、Hyper-V 仮想マシンで動作する Linux にシリアル コンソール ログインする場合、ホスト側の名前付きパイプに対してログインすることになります。Teraterm の 4.74 以降から、名前付きパイプへの直接ログインがサポートされたので、以下のように接続先の設定を [\\.\pipe\name](about://\\.\pipe\name/) にすることでログインができます。

 
![]({{site.assets_url}}2012-07-09-image27.png) <br />
Hyper-V 仮想マシンの COM ポート設定で Named pipe を選び、好きなパイプ名を付けておく

 
![]({{site.assets_url}}2012-07-09-image28.png) <br />
接続ホスト名をパイプ名にする

 
Hyper-V を使うときの注意は、Hyper-V がホスト上に作成する名前付きパイプのアクセス権です。管理者権限じゃないとアクセスできないので、Teraterm を管理者として起動する必要があります。制限付きトークンのままだと、"Cannot open pipe\linux-dev" のようなエラーがでて繋ぐことができません。 <br />
![]({{site.assets_url}}2012-07-09-image29.png)

 
Hyper-V 仮想マシンのシリアル コンソールにログインした様子をキャプチャしてみました。SSH のセッションと同じです。ログイン後、Teraterm の画面が真っ黒のまま何も表示されない場合は、Enter キーを押してみてください。

 
![]({{site.assets_url}}2012-07-09-image30.png)

 
これでログインは可能になりました。ここから先はオプションですが、ブート メニューやブート ログもシリアル ケーブル経由で見たいときは、追加の設定が必要になります。それが、ブートローダーである GRUB 2 の設定です。/etc/default/grub を以下のように編集します。青字が修正箇所です。 必須ではありませんが、ブート メニューのタイムアウト時間を 30 秒にしておきました。後述しますが、Hyper-V を使っている環境において、ブート メニューが表示されているタイミングで Teraterm を再接続する猶予を得るためです。

 
```
# If you change this file, run 'update-grub' afterwards to update 
# /boot/grub/grub.cfg. 
# For full documentation of the options in this file, see: 
#   info -f grub -n 'Simple configuration'

GRUB_DEFAULT=0 
#GRUB_HIDDEN_TIMEOUT=0 
GRUB_HIDDEN_TIMEOUT_QUIET=false 
GRUB_TIMEOUT=30 
GRUB_DISTRIBUTOR=`lsb_release -i -s 2> /dev/null || echo Debian` 
GRUB_CMDLINE_LINUX_DEFAULT="vga=normal console=tty0 console=ttyS0,115200n8" 
GRUB_CMDLINE_LINUX=""

# Uncomment to enable BadRAM filtering, modify to suit your needs 
# This works with Linux (no patch required) and with any kernel that obtains 
# the memory map information from GRUB (GNU Mach, kernel of FreeBSD ...) 
#GRUB_BADRAM="0x01234567,0xfefefefe,0x89abcdef,0xefefefef"

# Uncomment to disable graphical terminal (grub-pc only) 
GRUB_TERMINAL="console serial" 
GRUB_SERIAL_COMMAND="serial --speed=115200 --unit=0 --word=8 --parity=no --stop=1"

# The resolution used on graphical terminal 
# note that you can use only modes which your graphic card supports via VBE 
# you can see them in real GRUB with the command `vbeinfo' 
#GRUB_GFXMODE=640x480

# Uncomment if you don't want GRUB to pass "root=UUID=xxx" parameter to Linux 
#GRUB_DISABLE_LINUX_UUID=true

# Uncomment to disable generation of recovery mode menu entries 
#GRUB_DISABLE_RECOVERY="true"

# Uncomment to get a beep at grub start 
#GRUB_INIT_TUNE="480 440 1"
```
 
GRUB_CMDLINE_LINUX_DEFAULT が、カーネル起動時に渡されるパラメーターになります。この設定で、ブート時のカーネルのログがシリアル コンソールに出力されるようになります。GRUB_SERIAL_COMMAND は、GRUB の出力設定です。

 
上で紹介した Ubuntu のページでは、/boot/grub/menu.lst を編集してカーネルの起動パラメーターを追加していますが、これは古い GRUB の設定です。現在の Ubuntu に入っている GRUB 2 は menu.lst を使いませんので、ここでは代わりに GRUB_CMDLINE_LINUX_DEFAULT を使っています。

 
変更内容を反映させます。update-grub2 は、update-grub のシンボリック リンクなので、どちらを使っても同じです。

 
```
$ ls -la /usr/sbin/update-grub 
-rwxr-xr-x 1 root root 64 May  8  2014 /usr/sbin/update-grub 
$ ls -la /usr/sbin/update-grub2 
lrwxrwxrwx 1 root root 11 May 15  2014 /usr/sbin/update-grub2 -> update-grub

$ sudo update-grub 
Generating grub configuration file ... 
Found linux image: /boot/vmlinuz-3.13.0-32-generic 
Found initrd image: /boot/initrd.img-3.13.0-32-generic 
Found memtest86+ image: /boot/memtest86+.elf 
Found memtest86+ image: /boot/memtest86+.bin 
done 
```
 
ubuntu 側はこれで OK。

 
## 接続してみる

 
いよいよ接続です。接続ソフトは teraterm を使います。定番ですね。

 
以下のページからダウンロードできます。 <br />
[http://sourceforge.jp/projects/ttssh2/](http://sourceforge.jp/projects/ttssh2/)

 
起動して、新しいセッションのダイアログで Serial を選択。

 
![]({{site.assets_url}}2012-07-09-image4.png)

 
teraterm 側にもシリアル ポートの設定があるので、必ず ubuntu 側と揃えておきましょう。 <br />
今後のためにも、デバイス マネージャーのポートの設定も揃えた方がよいです。（たぶん）

 
![]({{site.assets_url}}2012-07-09-image5.png)

 
あとは待機。

 
![]({{site.assets_url}}2012-07-09-image6.png)

 
上の状態で、Ubuntu 側を再起動します。

 
お、なんか出てきた。

 
![]({{site.assets_url}}2012-07-09-image7.png)

 
アカウントを入力して、無事 ttyS0 でログオンに成功。

 
![]({{site.assets_url}}2012-07-09-image8.png)

 
Hyper-V 仮想マシンを使っている場合の補足です。予めシリアル コンソールにログインしている状態でマシンを再起動すると、Hyper-V によって名前付きパイプが一度削除されるので、そのまま放置しておくと Teraterm から繋いでいたセッションは一方的に切断され、自動的に繋がることはありません。これだと、せっかく GRUB を設定したのに、ブート ログなどを見ることができません。

 
![]({{site.assets_url}}2012-07-09-image211.png) <br />
再起動すると、セッションが &#x5b;disconnected&#x5d; になる

 
GRUB の設定ファイルで、GRUB_TIMEOUT = 30 のように、少々長めの時間を設定しました。これは、ブート メニューが表示されている 30 秒の間に、Teraterm の新しいセッションを作るためです。デフォルトの 2 秒だとさすがに厳しいので。

 
disconnected されてからすぐに Teraterm 上で Alt+N を押し、パイプへの新規セッションを繋ぐと、ブート メニューの表示に間に合って、メニューを Teraterm から操作することができます。

 
![]({{site.assets_url}}2012-07-09-image32.png) <br />
Boot menu on teraterm

 
このときの出力は、コンソール出力と連動しています。例えば矢印キーを押すと、選択アイテムが両方の画面で動きます。

 
![]({{site.assets_url}}2012-07-09-image33.png) <br />
Boot menu on console

 
メニューを選択すると、あとはブート ログがごちゃっと表示された後、おなじみのログイン プロンプトの画面になります。

 
![]({{site.assets_url}}2012-07-09-image34.png)

 
最後に、Teraterm の画面と、vi など全画面表示になるプログラムの出力で、表示幅と高さが一致しないことがあります。設定方法はいろいろあるのでしょうが、以下のコマンドを実行すると、表示幅と高さを teraterm 側と一致させることができます。

 
![]({{site.assets_url}}2012-07-09-image35.png) <br />
サイズが合っていない例。右と下の余白がもったいない。

 
stty コマンドで、teraterm の設定と同じにします。

 
```
$ stty cols 100 
$ stty rows 40
```
 
これでフィットするようになりました。セッションが終わると設定は消えますが、とりあえずはこれで十分でしょう。

 
![]({{site.assets_url}}2012-07-09-image36.png)

