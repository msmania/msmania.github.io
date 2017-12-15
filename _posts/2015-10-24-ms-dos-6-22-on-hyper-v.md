---
layout: post
title: "MS-DOS 6.22 on Hyper-V"
date: 2015-10-24 19:56:42.000 -07:00
categories:
- Asm
- C/C++
tags:
- MS-DOS
- VFD
---

CPU の仕組みについて書かれた本の中でも、「はじめて読む 486」 はかなり有名な名著と言えるはずです。

 
はじめて読む486―32ビットコンピュータをやさしく語る <br />
[http://www.amazon.co.jp/%E3%81%AF%E3%81%98%E3%82%81%E3%81%A6%E8%AA%AD%E3%82%80486%E2%80%9532%E3%83%93%E3%83%83%E3%83%88%E3%82%B3%E3%83%B3%E3%83%94%E3%83%A5%E3%83%BC%E3%82%BF%E3%82%92%E3%82%84%E3%81%95%E3%81%97%E3%81%8F%E8%AA%9E%E3%82%8B-%E8%92%B2%E5%9C%B0-%E8%BC%9D%E5%B0%9A/dp/4756102131](http://www.amazon.co.jp/%E3%81%AF%E3%81%98%E3%82%81%E3%81%A6%E8%AA%AD%E3%82%80486%E2%80%9532%E3%83%93%E3%83%83%E3%83%88%E3%82%B3%E3%83%B3%E3%83%94%E3%83%A5%E3%83%BC%E3%82%BF%E3%82%92%E3%82%84%E3%81%95%E3%81%97%E3%81%8F%E8%AA%9E%E3%82%8B-%E8%92%B2%E5%9C%B0-%E8%BC%9D%E5%B0%9A/dp/4756102131)

 
途中で挫折していたので、最初からちゃんと読んでいたところ、やっぱり実機でサンプル コードを試したくなります。ちょっと前にブート コードの勉強をしていたときは、仮想ディスク (VHD) のマスター ブート レコード (MBR) をエディタで書き換えて、 Hyper-V の仮想マシンをその VHD から起動して動かすというけっこう面倒な方法を取っていました。

 
もっと楽に 16 ビット リアルモードで遊べる環境を作っておこう、ということで、MS-DOS を Hyper-V 仮想マシンにインストールしてみました。何も MS-DOS まで遡らなくても、Windows 9x や ME の DOS モードを使えばいいのですが、まあそこは好奇心ということで。どうでもいい昔話をすると、初めてプログラミングというものに触れたのが中一のときに学校にあった PC-9801 の N88-BASIC で、その後すぐに Windows 95 (年から考えると 98 だったかも) が導入されて Visual Basic/Visual C++ で遊び始めたので、Windows 以前の MS-DOS は全然触ったことがありません。そういえば当時の起動フロッピー ディスクはまだ手元にあるかも・・。

 
閑話休題、MS-DOS ですが、インストーラーは MSDN サブスクリプションに MS-DOS 6.0 と 6.22 が含まれていたのでそれを使います。MSDN を持っていない人は、"MS-DOS 6.22 download" とかのキーワードでググると、見つかるはずなので自己責任でどうぞ。

 
手順は以下の通り。6.22 はアップグレード用で、新規インストールはできないので、6.0 を入れてから 6.22 にアップグレードします。

 
1. 適当な Windows マシンで MS-DOS 起動ディスクを作る
1. MSDN からインストールしたファイルを仮想フロッピー、もしくは VHD にコピー
1. 起動ディスクから DOS を起動
1. MS-DOS 6.0 をフロッピーにインストール
1. MS-DOS 6.0 を起動
1. MS-DOS 6.22 を VHD にインストール

 
MSDN でダウンロードできるインストーラー en_msdos60.exe や en_msdos622.exe は自己解凍書庫で、解凍すると MS-DOS アプリの setup.exe が出てきます。これを使うためにはそもそも DOS を起動しないといけません。ということで、まずは DOS の起動ディスクを作らないといけません。

 
まずは空の仮想フロッピー ファイル (.vfd) を作ります。普通は PowerShell の New-Vfd コマンドレットを使うところですが、このコマンドレットは規定サイズの空ファイルを作っているだけなので、fsutil でも代用できます。サイズの 1474560 = 1440 * 1024 は、2HD フロッピーのバイト数です。

 
```
D:\MSWORK\dos> fsutil file createnew floppy.vfd 1474560 
File D:\MSWORK\dos\floppy.vfd is created
```
 
これを仮想マシンにマウントし、エクスプローラーからフォーマットの画面を起動すると、なんと Windows 8.1 でも "Create an MS-DOS startup disk" のチェックボックスが使えます。よく廃止されないものです。ちなみに FORMAT コマンドにはそれに該当するようなオプションは見当たりません。GUI でしかできないんでしょうかね。

 
![]({{site.assets_url}}2015-10-24-01.png)

 
次に仮想マシンを作ります。RAM は 32MB、HDD は 1GB にしておきます。仮想 BIOS の設定で、Floppy を一番上に移動させます。こんな感じです。

 
![]({{site.assets_url}}2015-10-24-image.png)

 
先ほど作った起動ディスクをマウントして起動すると、無事 DOS が起動します。バージョンは Windows Millenium &#x5b;Version 4.90.3000&#x5d; だそうです。すぐには使わないので、仮想マシンはシャットダウンします。shutdown コマンドなんておものは存在せず、いきなり Turn off で問題ありません。

 
![]({{site.assets_url}}2015-10-24-image1.png)

 
さて次に、DOS インストーラーの準備ですが、MS-DOS 6.0、6.22 共にインストール ファイルの合計サイズが 1.44MB を超えるので、VFD ではなく VHD で作ります。MS-DOS 6.22 の方は、親切にも複数のディスク イメージ ファイル (.img) をそれぞれフロッピーに書き込むためのスクリプトが用意されていますが、ディスクの入れ替えが面倒なだけなので使いません。

 
New-VHD コマンドレットなどで VHD を作って、MBR ディスクとして初期化し、FAT でフォーマットします。NTFS だと読めないので注意です。インストーラーのファイルは、おそらくドライブのルート ディレクトリ直下に入れておかないと動かないはずなので、それぞれのインストール用 VHD を作らないといけません。

 
作った VHD を仮想マシンにマウントし、再度起動ディスクから DOS を起動します。構成はこんな感じ。

 
![]({{site.assets_url}}2015-10-24-image2.png)

 
1GB の VHDX はまだフォーマットされていないので認識されず、C: がインストーラーのドライブになります。したがって、C:\SETUP と実行します。

 
![]({{site.assets_url}}2015-10-24-image3.png)

 
なぜか認識できないパーティションがあるとか言われます。よく分からないのでそのまま続行します。

 
![]({{site.assets_url}}2015-10-24-image4.png)

 
MS-DOS 6.0 のインストーラーにはハード ディスクをフォーマットする機能が含まれず、空のハードディスクが見つからなかったため、フロッピーにインストールすることになります。仮にフォーマット済みの VHD をマウントして VHD にインストールしようとしても、有効な DOS が見つかりませんでした、というエラーが出てインストールできないので、最初の MS-DOS はフロッピーにインストールする必要があります。とりあえずこの画面ではそのまま Enter キーを押します。

 
![]({{site.assets_url}}2015-10-24-image5.png)

 
この画面も Enter で続行します。

 
![]({{site.assets_url}}2015-10-24-image6.png)

 
フロッピーを入れろと言われるので、ここで新たに VFD ファイルを作ってマウントしてから Enter キーを押します。

 
![]({{site.assets_url}}2015-10-24-image7.png)

 
フロッピーの種類を聞かれるので、1.44MB を選びます。

 
![]({{site.assets_url}}2015-10-24-image8.png)

 
無事終わりました。Enter キーを押してインストーラーを終了します。

 
![]({{site.assets_url}}2015-10-24-image9.png)

 
元の DOS 画面でエラーが出ますが、おそらく起動ディスクを抜いてしまったためなので、気にせず仮想マシンを再起動します。

 
![]({{site.assets_url}}2015-10-24-image10.png)

 
無事、MS-DOS 6.00 が起動しました。

 
![]({{site.assets_url}}2015-10-24-image11.png)

 
次に MS-DOS 6.22 のインストールに移ります。手順はほとんど同じです。今度はハードディスクにインストールしたいので、インストール先の VHD を予め FAT でフォーマットしておきます。

 
今度は C: が空ディスク、D: がインストーラーなので D:\SETUP と実行します。

 
![]({{site.assets_url}}2015-10-24-image12.png)

 
また未フォーマットのパーティションが検出されます。そんなのどこにあるんだ・・・気にせず続行します。

 
![]({{site.assets_url}}2015-10-24-image13.png)

 
今度は最小構成ではなく、通常の構成でハードディスクにインストールしてくれそうです。ここも Enter を押します。

 
![]({{site.assets_url}}2015-10-24-image14.png)

 
アンインストール ディスクというものを作る必要があるようです。今でいうリカバリ ディスクでしょうか。ここではそのまま Enter を押します。いちいちラベルを貼る猶予を与えてくれる親切設計。

 
![]({{site.assets_url}}2015-10-24-image15.png)

 
インストール設定の確認です。C:\DOS にインストールされるようです。これぞ C:\WINDOWS の前身！

 
![]({{site.assets_url}}2015-10-24-image16.png)

 
オプションのソフトウェアについて聞かれます。この当時のアンチ ウィルスって一体。Undelete ってのも謎。ごみ箱的な機能・・？とりあえず全部インストールしておきます。

 
![]({{site.assets_url}}2015-10-24-image17.png)

 
いよいよ開始です。

 
![]({{site.assets_url}}2015-10-24-image18.png)

 
フロッピーを入れ替える時間です。

 
![]({{site.assets_url}}2015-10-24-image19.png)

 
サイズは 1.44MB です。

 
![]({{site.assets_url}}2015-10-24-image20.png)

 
まさかのインストール エラー。ISK って何のことか分からず、わりと為す術がない。最初からのステップを 2 回繰り返しましたが、このエラーは変わらず。同じファイルを別の Windows 8.1 上の Hyper-V で試したら特にエラーは出ないので、Windows Server 2012 の Hyper-V との相性が悪いとかだったりして。詳細は不明です。

 
![]({{site.assets_url}}2015-10-24-image21.png)

 
一応インストールは終わりました。フロッピーを抜いて Enter を押します。

 
![]({{site.assets_url}}2015-10-24-image22.png)

 
Enter を押して再起動します。

 
![]({{site.assets_url}}2015-10-24-image23.png)

 
起動には問題ないようです。HIMEM ってやつが結構遅い。

 
![]({{site.assets_url}}2015-10-24-image24.png)

 
次に、どこからともなく入手してきた QuickC with Quick Assembler 2.51 をインストールします。ディスクが 10 枚もあって面倒くさい・・。

 
![]({{site.assets_url}}2015-10-24-image25.png)

 
インストール後、何やら重要そうなことが書かれている画面が出てくるのでキャプチャーしておく。

 
![]({{site.assets_url}}2015-10-24-image26.png)

 
インストールが終わったら、先ほどキャプチャーした画面の記述にしたがって環境変数の設定。現在の C:\AUTOEXEC.BAT はこんな感じ。

 
```
@ECHO OFF 
PROMPT $p$g 
PATH C:\DOS 
SET TEMP=C:\DOS
```
 
これを、C:\QC25\BIN\NEW-VARS.BAT を参考にして、以下のように変更。MOUSE コマンドを実行してマウス ドライバーを有効にすると、高確率で OS がハングするので、マウスは諦めます。

 
```
@ECHO OFF 
PROMPT $p$g 
SET PATH=C:\QC25\BIN;C:\QC25\TUTORIAL;C:\DOS 
 
SET LIB=C:\QC25\LIB 
SET INCLUDE=C:\QC25\INCLUDE 
SET TEMP=C:\DOS 
```
 
あと config.sys。懐かしすぎる。C:\QC25\BIN\NEW-CONF.SYS には FILES=20, BUFFERS=10 と書かれていましたが、FILES は既に 30 になっていたので、BUFFERS を多めの 20 にしておくことに。

 
```
DEVICE=C:\DOS\SETVER.EXE 
DEVICE=C:\DOS\HIMEM.SYS 
DOS=HIGH 
FILES=30 
SHELL=C:\DOS\COMMAND.COM C:\DOS\  /p 
BUFFERS=20 
```
 
再起動して、早速 QuickC を起動。

 
![]({{site.assets_url}}2015-10-24-image27.png)

 
これが 20 年前の IDE 。。というか画面ちっさ。Hyper-V のせいだけど。

 
![]({{site.assets_url}}2015-10-24-image28.png)

 
ただ普通に Hello World を書いても面白くないので、以下のような 3 つのファイルを書いて NMAKE でビルド。

 
まずは C のソース。これは普通です。

 
```
// 
// 00.C 
//

#include <stdio.h>

extern int GetVer();

void main(int argc, char **argv) 
{ 
    printf("Hello, MS-DOS %d!", GetVer()); 
    exit(0); 
}
```
 
次にアセンブリ言語。サンプルからコピペしただけです。int 21 でバージョンが返ってくるみたいです。

 
```
; 
; UTILS.ASM 
;

    .MODEL    small, c 
    .CODE

;* GetVer - Gets DOS version. 
;* 
;* Shows:   DOS Function - 30h (Get MS-DOS Version Number) 
;* 
;* Params:  None 
;* 
;* Return:  Short integer of form (M*100)+m, where M is major 
;*        version number and m is minor version, or 0 if 
;*        DOS version earlier than 2.0

GetVer    PROC

    mov    ah, 30h       ; DOS Function 30h 
    int    21h           ; Get MS-DOS Version Number 
    cmp    al, 0         ; DOS version 2.0 or later? 
    jne    @F            ; Yes?    Continue 
    sub    ax, ax        ; No?  Set AX = 0 
    jmp    SHORT exit    ;   and exit 
@@:    sub    ch, ch     ; Zero CH and move minor 
    mov    cl, ah        ;   version number into CX 
    mov    bl, 100 
    mul    bl            ; Multiply major by 10 
    add    ax, cx        ; Add minor to major*10 
exit:    ret             ; Return result in AX

GetVer    ENDP

    END
```
 
最後が MAKEFILE。サンプルのファイルを元にいろいろと修正しましたが、リンカの設定のところが意味不明・・。

 
```
PROJ    =TEST 
CC      =qcl 
AS      =qcl 
CFLAGS=/Od /Gi$(PROJ).mdt /DNDEBUG /Zi /Zr 
AFLAGS=/Zi /Cx /P1 
LFLAGS  =/NOI /INCR /CO

.asm.obj: ; $(AS) $(AFLAGS) -c $*.asm

all:    $(PROJ).EXE

utils.obj:        utils.asm

00.obj: 00.c

$(PROJ).EXE:    utils.obj 00.obj 
    echo >NUL @<<$(PROJ).crf 
utils.obj + 
00.obj 
$(PROJ).EXE 
NUL.MAP

<< 
    ilink -a -e "qlink $(LFLAGS) @$(PROJ).crf" $(PROJ)
```
 
ファイルを作ったら NMAKE するだけです。

 
![]({{site.assets_url}}2015-10-24-image29.png)

 
おお、MS-DOS のバージョンが出た！これでリアルモードと仲良くできそう。

 
![]({{site.assets_url}}2015-10-24-image30.png)

 
しかしファイルの編集がやりにくすぎる・・・SSH みたいなリモート接続はできないのだろうか。そもそも Hyper-V の仮想 NIC に対応している TCP/IP のドライバーなんてなさそう。

