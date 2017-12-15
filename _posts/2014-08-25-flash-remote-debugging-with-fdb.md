---
layout: post
title: "Flash remote debugging with FDB"
date: 2014-08-25 05:37:29.000 -07:00
categories:
- Other
tags:
- fdb
- filever
- Flash
- Flex
- trace
---

Flash の開発中は、スタンドアロンの Flash Player と IDE でデバッグを行うことが一般的かと思いますが、ブラウザー上での動作もデバッガーから見られると便利です。環境構築の回で紹介したデバッグ用の Flash Player を使うと、ブラウザーで動く Flash をデバッグでき、またリモート デバッグも可能なので、テスト マシンで動作する Flash を開発環境からデバッグできます。デバッガーは、Flex SDK に付属しているコマンド ラインのデバッガー FDB を使います。

 
テスト環境は Windows 8 x64 + Internet Explorer 10 の環境を使います。したがって、以下のページにある "Download the Flash Player for Windows 8 x64 debugger" のリンクからインストーラーをダウンロードします。ファイル名は Windows8-RT-KB2777262-x64.msu となっており、OS への Hotfix としてインストールされます。

 
Adobe Flash Player - Downloads <br />
[http://www.adobe.com/support/flashplayer/downloads.html](http://www.adobe.com/support/flashplayer/downloads.html)

 
インストールすると、Flash.ocx が置き換わります。バージョンを確認するのには、Windows Server 2003 もしくは XP のサポート ツールに含まれている Filever.exe というツールが便利です。PowerShell の Get-ChildItem コマンドレットも使えますが、Get-ChildItem はある条件で誤った結果を返すので filever.exe の方が信用できます。

 
How to use the Filever.exe tool to obtain specific information about a file in Windows <br />
[http://support.microsoft.com/kb/913111/en](http://support.microsoft.com/kb/913111/en)

 
これが Windows 8 のインストール直後の Flash.ocx。

 
```
C:\MSWORK>filever -v C:\windows\syswow64\Macromed\Flash\Flash.ocx 
--a-- W32i   DLL ENU     11.3.372.94 shp 10,648,920 07-19-2012 flash.ocx 
    Language        0x0409 ( 
    CharSet            0x04b0 Unicode 
    OleSelfRegister        Disabled 
    CompanyName        Adobe Systems, Inc. 
    FileDescription        Adobe Flash Player 11.3 r372 
    InternalName        Adobe Flash Player 11.3 
    OriginalFilename    Flash.ocx 
    ProductName        Shockwave Flash 
    ProductVersion        11,3,372,94 
    FileVersion        11,3,372,94 
    LegalCopyright        Adobeｮ Flashｮ Player. Copyright ｩ 1996 Adobe Systems Incorporated. All Rights Reserved. Adobe and Flash are either trademarks or registered trademarks in the United States and/or other countries. 
    LegalTrademarks        Adobe Flash Player

    VS_FIXEDFILEINFO: 
    Signature:        feef04bd 
    Struc Ver:        00010000 
    FileVer:        000b0003:0174005e (11.3:372.94) 
    ProdVer:        000b0003:0174005e (11.3:372.94) 
    FlagMask:        0000003f 
    Flags:            00000000 
    OS:            00000004 Win32 
    FileType:        00000002 Dll 
    SubType:        00000000 
    FileDate:        00000000:00000000
```
 
KB2777262 をインストールすると、こうなります。14.0 になりました。あくまでもデバッグ機能を持つ Flash Player というだけなので、この ocx がデバッグ版というわけではないようです。ここでは syswow64 にある flash.ocx を確認していますが、system32 の方も同様に置き換わっています。

 
```
C:\MSWORK>filever -v C:\windows\syswow64\Macromed\Flash\Flash.ocx 
--a-- W32i   DLL ENU      14.0.0.176 shp 13,932,000 08-02-2014 flash.ocx 
    Language        0x0409 ( 
    CharSet            0x04b0 Unicode 
    OleSelfRegister        Disabled 
    CompanyName        Adobe Systems, Inc. 
    FileDescription        Adobe Flash Player 14.0 r0 
    InternalName        Adobe Flash Player 14.0 
    OriginalFilename    Flash.ocx 
    ProductName        Shockwave Flash 
    ProductVersion        14,0,0,176 
    FileVersion        14,0,0,176 
    LegalCopyright        Adobeｮ Flashｮ Player. Copyright ｩ 1996-2014 Adobe Systems Incorporated. All Rights Reserved. Adobe and Flash are either trademarks or registered trademarks in the United States and/or other countries. 
    LegalTrademarks        Adobe Flash Player

    VS_FIXEDFILEINFO: 
    Signature:        feef04bd 
    Struc Ver:        00010000 
    FileVer:        000e0000:000000b0 (14.0:0.176) 
    ProdVer:        000e0000:000000b0 (14.0:0.176) 
    FlagMask:        0000003f 
    Flags:            00000000 
    OS:            00000004 Win32 
    FileType:        00000002 Dll 
    SubType:        00000000 
    FileDate:        00000000:00000000 
```
 
少しややこしいのが IE のプロセスについて。64bit OS では、IE の実行可能ファイルが 2 つ存在します。それは、Win64 ネイティブの iexplore.exe と WOW64 で動く 32bit の iexplore.exe です。

 
C:\Program Files\Internet Explorer\iexplore.exe <br />
C:\Program Files (x86)\Internet Explorer\iexplore.exe

 
IE9 (IE8 だったかも・・) までは、これらはそれぞれ独立していました。多くの場合、ユーザーはスタート メニューやタスクバーのショートカットから IE を起動しますが、このショートカットは 32bit の IE へのショートカットでした。64bit OS なんだから 64bit の IE の方がメモリ効率とかセキュリティー的にメリットが多いのは確かです。しかし、ブラウザーが読み込む Flash などのプラグインはブラウザーと同じプロセスで動きます。昔は、64bit 版のプラグインが存在しないことも多かったので、互換性を重視して 32bit 版の IE をデフォルトのしたのだと思います。

 
しかし、IE10 から少し状況が変わりました。IE10 では、32bit 版の iexplore.exe を起動しようと、64bit 版の iexplore.exe を起動しようと、32bit の iexplore.exe が動きます。正確には両方のプロセスが動くのですが、実際に HTML を処理するタブ プロセスは 32bit であり、ウィンドウを管理するフレーム プロセスが 64bit です。しかし、タブ プロセスが 64bit になる条件が一つあります。それが、Windows 8 以降存在する Immersive IE (= Modern UI の IE) です。 簡単にまとめると、デスクトップの IE が 32bit で、モダンの方が 64bit になりました。

 
話を戻すと、今回は Modern UI を使う予定はないので syswow64 の方のバージョンを確認したというわけです。

 
次に、適当な ActionScript を書きます。タイマーで 1 秒毎に trace 関数でコンソールに文字を出力します。

 
```
package { 
    import flash.display.Sprite; 
    import flash.events.*; 
    import flash.utils.*; 
   
    public class Main extends Sprite  { 
        public var mTimer:Timer; 
        public var mCounter:uint; 
        
        public function hex(n:uint) : String { 
            var s:String = n.toString(16); 
            while( s.length < 8 ) { 
                s = '0' + s; 
            } 
            return '0x' + s; 
        }

        public function Main():void  { 
            this.mTimer = new Timer(1000, 60); 
            this.mTimer.addEventListener("timer", this.timerHandler); 
            this.mTimer.start(); 
            this.mCounter = 0; 
        } 
        
        public function timerHandler(param1:TimerEvent) : void { 
            trace(hex(++this.mCounter)); 
        } 
    } 
}
```
 
これを debug ビルドして swf ファイルを作ります。release ビルドすると、trace 関数の呼び出しは削除されるので注意。これは、Flex 4 から導入されたコンパイル オプション -omit-trace-statements の初期値が true になっているからです。このオプションについては、こちらのブログでコンパイラのソースコードとともに紹介があります。

 
How -omit-trace-statements Works… Or Does NOT… | Stop Coding! <br />
[http://stopcoding.wordpress.com/2010/04/21/how-omit-trace-statements-works-or-does-not/](http://stopcoding.wordpress.com/2010/04/21/how-omit-trace-statements-works-or-does-not/)

 
次に swf を読み込む html を書きます。embed タグを書くだけ。 <br />
（このブログの設定上、embed タグが弾かれてしまうので、em と bed の間に空白を入れてあります。）

 
```
<!DOCTYTPE HTML> 
<html> 
<head></head> 
<body> 
<em bed src="test.swf" width="25" height="25"></em bed> 
</body> 
</html> 
```
 
swf と html を適当な Web サーバーにデプロイして、まずはページを開きます。当然何も表示されませんが、Flash は動いているはずです。

 
次に、開発環境でデバッガーを起動します。Flex SDK をインストールしたフォルダーの bin の中に fdb.bat というのがあるので、それを実行してください。バッチ ファイルは、単に jar を実行するだけになっています。bin フォルダーに PATH を通しておくと何かと便利です。

 
デバッガーのプロンプトで run と実行すると、Flash Player からの応答を待機します。

 
```
d:\MSWORK> fdb 
Apache fdb (Flash Player Debugger) [build 20140701] 
Copyright 2013 The Apache Software Foundation. All rights reserved. 
(fdb) run 
Waiting for Player to connect
```
 
次に、テスト環境でリモート デバッグの設定を行います。test.html の左上のあたり、Flash が埋め込まれている部分を右クリックすると、コンテキスト メニューに &#x5b;デバッガー&#x5d; というのがあるはずです。これが表示されない場合、デバッグ版の Flash Player が正しくインストールされていません。

 
![]({{site.assets_url}}2014-08-25-image32.png)

 
&#x5b;デバッガー&#x5d; をクリックすると、以下のダイアログが表示されるので、fdb を起動したコンピューターのアドレスを入力し、&#x5b;接続する&#x5d; をクリックして下さい。

 
![]({{site.assets_url}}2014-08-25-image33.png)

 
デバッガーが Flash Player から応答を受け取り、trace の出力がデバッガーのコンソールから確認できます。

 
```
d:\MSWORK>fdb 
Apache fdb (Flash Player Debugger) [build 20140701] 
Copyright 2013 The Apache Software Foundation. All rights reserved. 
(fdb) run[ 
Unknown command 'run[', ignoring it 
(fdb) run 
Waiting for Player to connect 
Player connected; session starting. 
Set breakpoints and then type 'continue' to resume the session. 
[SWF] /test.swf - 1,526 bytes after decompression 
[trace] 0x00000026 
[trace] 0x00000027 
[trace] 0x00000028 
[trace] 0x00000029 
[trace] 0x0000002a 
[trace] 0x0000002b 
[trace] 0x0000002c 
[trace] 0x0000002d 
```
 
リモート デバッグ設定は保存されるので、デバッガーを起動し直して run で待機し、ページを F5 更新すると、Flash 開始時でブレークしてくれます。以下は出力例として、timerHandler で止めて、mCounter の値を書き換えている様子です。

 
分かりにくいのですが、ブレークさせるときはデバッガー上で Enter キーを押してください。そうすると "Do you want to attempt to halt execution?" と聞かれるので y を押すと止まります。ただ、けっこうなラグがあるので、止めたいタイミングがずれそうです。Ctrl+C を押すとデバッガー自体が終了してしまうので注意。

 
```
d:\MSWORK> fdb 
Apache fdb (Flash Player Debugger) [build 20140701] 
Copyright 2013 The Apache Software Foundation. All rights reserved. 
(fdb) run 
Waiting for Player to connect 
Player connected; session starting. 
Set breakpoints and then type 'continue' to resume the session. 
(fdb) c 
[SWF] /test.swf - 1,526 bytes after decompression 
[trace] 0x00000001 
[trace] 0x00000002 
[trace] 0x00000003 
[trace] 0x00000004 
[trace] 0x00000005 
[trace] 0x00000006

(Enter キーを押す)

Do you want to attempt to halt execution? (y or n) y 
Attempting to halt. 
To help out, try nudging the Player (e.g. press a button) 
[trace] 0x00000007 
[trace] 0x00000008 
Execution halted in 'test.swf' at 0xffffffff (-1) 
(fdb) break Main:timerHandler 
Breakpoint 1 at 0x314: file Main.as, line 25 
(fdb) c  
Breakpoint 1, timerHandler() at Main.as:25 
25             public function timerHandler(param1:TimerEvent) : void { 
(fdb) print this.mCounter 
$1 = 8 (0x8) 
(fdb) set this.mCounter = 1234 
(fdb) c 
[trace] 0x000004d3 
Breakpoint 1, timerHandler() at Main.as:25 
25             public function timerHandler(param1:TimerEvent) : void { 
(fdb) info break 
Num Type           Disp Enb Address    What 
1   breakpoint     keep y   0x00000314 in timerHandler() at Main.as:25 (Worker 0) 
        breakpoint already hit 2 time(s) 
(fdb) disable 1 
(fdb) c 
[trace] 0x000004d4 
Execution halted, timerHandler() at Main.as:25 
25             public function timerHandler(param1:TimerEvent) : void { 
[trace] 0x000004d5 
```
 
デバッガーで h コマンドを打つとコマンド一覧や使用例などが表示されます。また、Adobe Flex の頃の古いバージョンですが、以下に説明があります。Apache Flex 側の fdb のヘルプは今のところ見つけられていません。

 
Adobe Flex 4.6 * Command-line debugger <br />
[http://help.adobe.com/en_US/flex/using/WS2db454920e96a9e51e63e3d11c0bf69084-7ffb.html](http://help.adobe.com/en_US/flex/using/WS2db454920e96a9e51e63e3d11c0bf69084-7ffb.html)

