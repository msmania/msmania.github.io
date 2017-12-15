---
layout: post
title: "Adobe Flash development workbench"
date: 2014-08-16 15:21:50.000 +09:00
categories:
- Debug
- Windows
tags:
- Flash
- FlashDevelop
- Flex
- SWF
---

前回の CVE-2014-0322 を利用した攻撃を理解するためには、SWF ファイルの動作がとても重要なので、Adobe Flash の開発環境を整えることにしました。全部無料で扱えうツールを集めます。Web 系の技術は雨後の竹の子なので、一度勉強を始めると終わりがない。

 
インストールしたもの (バージョンは 2014/8/15 時点での最新版)。 <br />
今回は Windows 7 SP1 64bit 日本語版にインストールしました。

 
- Java SE Runtime Environment 8 update 11 <font color="#ff0000">(64bit だとなぜか Flash のデバッガーが起動しないので必ず 32bit で)</font> <br />
[http://www.oracle.com/technetwork/java/javase/downloads/index.html](http://www.oracle.com/technetwork/java/javase/downloads/index.html)
- FlashDevelop 4.6.3 <br />
[http://www.flashdevelop.org/](http://www.flashdevelop.org/)
- Apache Flex 4.13.0 <br />
[http://flex.apache.org/](http://flex.apache.org/)
- Adobe Flash Player 14 (デバッグ用の Flash Player) <br />
[http://www.adobe.com/support/flashplayer/downloads.html](http://www.adobe.com/support/flashplayer/downloads.html)
- JPEXS Free Flash Decompiler 2.1.2 <br />
[http://www.free-decompiler.com/flash/](http://www.free-decompiler.com/flash/)
- Adobe SWF Investigator (Preview 5; v0.6.5) <br />
[http://labs.adobe.com/downloads/swfinvestigator.html](http://labs.adobe.com/downloads/swfinvestigator.html)
- Yogda 1.0.567 <br />
[http://yogda.2ka.org/](http://yogda.2ka.org/)

 
以下、インストール時にはまりやすいポイントなどを。

 
まずは IDE の選択ですが、FlashDevelop をチョイス。本家の Adobe Flash Builder は有償だし、Eclipse のプラグインもあるようですが、宗教上の理由で Windows マシンには Eclipse を入れたくないため。

 
FlashDevelop は単なる IDE なので、Adobe Flash 用の SDK が必要です。もし SDK がないのにビルドしようとすると、"This project doesn't have a valid SDK defined. Please check the SDK tab in the Project Properties." というポップアップで怒られます。←実際に怒られた

 
![]({{site.assets_url}}2014-08-16-image26.png)

 
その SDK が Apache Flex。昔は Adobe Flex SDK とか言っていたのが Apache になったらしい。

 
Apache Flex には SDK Installer とかいう便利そうなインストーラーがあるようですが、特に理由も無くこのインストーラーは使わないことにして、SDK Binaries を単体でダウンロード。こちらはインストーラーはないので、"C:\Program Files (x86)\FlexSDK\4.13.0" というフォルダーを手動で作ってそこに解凍。

 
![]({{site.assets_url}}2014-08-16-image27.png)

 
FlashDevelop 上で Apache Flex を指定する方法はここを参照。

 
AS3 - FlashDevelop <br />
[http://www.flashdevelop.org/wikidocs/index.php?title=AS3](http://www.flashdevelop.org/wikidocs/index.php?title=AS3) ("Configuring FlashDevelop to use the Flex SDK")

 
メニューから Tools &gt; Program settings... を選択 <br />
![]({{site.assets_url}}2014-08-16-image28.png)

 
AS3Contect &gt; Language &gt; Installed Flex SDKs のプロパティ画面を開いて、Path のところに SDK の解凍先である "C:\Program Files (x86)\FlexSDK\4.13.0" を 入力。他の項目は自動的に認識されるので、OK をクリック。 <br />
![]({{site.assets_url}}2014-08-16-image29.png)

 
ビルド時には Java のプログラムが使われるみたいなので、Java が入っていなければ入れておきましょう。Java 6 以上が必要なようです。JDK を入れなくても JRE だけで十分、、なはず。FlashDevelop はビルドを実行するときに環境変数を使うので、JAVA_HOME と PATH を設定します。なんか以前にもブログで触れたような気がする。

 
```
JAVA_HOME= C:\Program Files (x86)\Java\jre8 
PATH= %JAVA_HOME%\bin;<追加前のPATH>
```
 
上の方にも書きましたが、64bit OS だからといって 64bit の Java しか入れていないと、デバッグ実行するときに BadImageFormatException という例外でデバッガーが起動しません。必ず 32bit の Java をインストールしておきましょう。

 
```
Debugger startup error. For troubleshooting see: http://www.flashdevelop.org/wikidocs/index.php?title=F.A.Q 
Error details: System.BadImageFormatException: 間違ったフォーマットのプログラムを読み込もうとしました。 (HRESULT からの例外: 0x8007000B) 
   場所 net.sf.jni4net.jni.JNI.Dll.JNI_GetDefaultJavaVMInitArgs(JavaVMInitArgs* args) 
   場所 net.sf.jni4net.jni.JNI.Init() 
   場所 net.sf.jni4net.jni.JNI.CreateJavaVM(JavaVM& jvm, JNIEnv& env, Boolean attachIfExists, String[] options) 
   場所 net.sf.jni4net.Bridge.CreateJVM() 
   場所 net.sf.jni4net.Bridge.CreateJVM(BridgeSetup setup) 
   場所 FlashDebugger.DebuggerManager.Start(Boolean alwaysStart) 
[Capturing traces with FDB]
```
 
さらに、デバッグ実行のためには、それ用の Flash Player が必要です。[http://www.adobe.com/support/flashplayer/downloads.html](http://www.adobe.com/support/flashplayer/downloads.html) からダウンロードしてきます。メジャー バージョンが幾つかあるのですが、ここでは最新の 14 だけを使います。しかし 14 の Windows のところだけでも・・

 
- Download the Windows Flash Player 14 ActiveX control content debugger (for IE) (EXE, 18.15MB)
- DownloadDownload the Windows Flash Player 14 Plugin content debugger (for Netscape-compatible browsers) (EXE, 18.11MB)
- DownloadDownload the Windows Flash Player 14 Projector content debugger (for Netscape-compatible browsers) (EXE, 11.40MB)
- DownloadDownload the Windows Flash Player 14 Projector (EXE, 10.60MB)
- DownloadDownload the Flash Player for Windows 8 x86 debugger (KB2777262)
- DownloadDownload the Flash Player for Windows 8 x64 debugger (KB2777262)
- DownloadDownload the Flash Player for Windows 8 RT debugger (KB2777262)
- DownloadDownload the Flash Player for Windows 8.1 x86 debugger (KB2867622)
- DownloadDownload the Flash Player for Windows 8.1 x64 debugger (KB2867622)
- DownloadDownload the Flash Player for Windows 8.1 RT debugger (KB2867622)

 
どれ入れればいいんだよ・・・。下のほうの Windows 8/8.1 用のファイルは adobe.com じゃなくて、Microsoft の KB パッケージへのリンクになっています。おそらく、IE10/11 では Flash Player が IE のバイナリの一部として統合されたからかと予想。Windows 8 は IE10、Windows 8.1 には IE11 が標準で入っているので、そのためのパッケージなのだと思います。何も確認していない単なる推測なので間違っているかもしれませんが。

 
で、今回の環境は IE11/Windows 7 なわけで、順当に考えると一番上の for IE ってやつでしょうが、これはハズレです。iexplore.exe や mshtml.dll のビルド バージョンが winblue_gdr.140724-2228 のようになっていることから確認できるように、Windows 7 上であろうと、IE11 は Windows 8.1 のバイナリと同じものが動いています。つまり、Flash のアドオンは IE と一緒に配布されているため、でしょうか。かといって、Windows 8.1 用の KB2867622 をインストールしようとしても動きませんでした。

 
正解は、3 つ目の Windows Flash Player 14 Projector content debugger です。ここから、flashplayer_14_sa_debug.exe という実行可能ファイルがダウンロードできます。この exe ファイルがスタンドアロンの Flash Player になっていて、swf ファイルを開くことができます。

 
それともう一つ、 [http://www.adobe.com/support/flashplayer/downloads.html](http://www.adobe.com/support/flashplayer/downloads.html) のページから、PlayerGlobal (.swc) というセクションにある playerglobal.swc というファイルが必要です。このファイルがないと、ビルドが以下のようにエラーになります。

 
```
Starting java as: java.exe -Xms64m -Xmx384m -ea -Dapple.awt.UIElement=true -Duser.language=en -Duser.region=US -Dapplication.home="C:\Program Files (x86)\FlexSDK\4.13.0" -Dflexlib="C:\Program Files (x86)\FlexSDK\4.13.0\frameworks" -jar "C:\Program Files (x86)\FlexSDK\4.13.0\lib\fcsh.jar"

INITIALIZING: Apache Flex Compiler SHell (fcsh)

Starting new compile.

Loading configuration file C:\Program Files (x86)\FlexSDK\4.13.0\frameworks\flex-config.xml

Loading configuration file E:\FlashDev\as3test\obj\as3testConfig.xml

C:\Program Files (x86)\FlexSDK\4.13.0\frameworks\flex-config.xml(65): Error: unable to open 'C:\Program Files (x86)\FlexSDK\4.13.0\frameworks/libs/player/10.1/playerglobal.swc'

</external-library-path>

Build halted with errors (fcsh).

(fcsh)

Done(1)
```
 
また、FlashDevelop 4.6.3 で AS3 プロジェクトを作ると、デフォルトの Flash Player のバージョンが 10.1 になるので、ダウンロードした Flash Player (ここでは 14.0) のバージョンに変更する必要があります。

 
![]({{site.assets_url}}2014-08-16-image30.png)

 
上のエラーメッセージによると、playerglobal.swc というファイルを "Apache Flex の解凍先\frameworks\libs\player\player のバージョン" に探しに行っているので、同じところに playerglobal.swc と Flash Player 14 Projector content debugger を置いておくことにします。今回の例だと↓ (青字のフォルダーは自分で作りました.。) 構成ファイルであるflex-config.xml を変更してもいいのですが、こういうのはそのままにしておくに限る。経験上。

 
```
C:\Program Files (x86)\FlexSDK\4.13.0\frameworks\libs\player\14.0
```
 
ダウンロードしてきたファイルは playerglobal14_0.swc となっているので、名前を変えて配置します。こんな感じ。

 
![]({{site.assets_url}}2014-08-16-image31.png)

 
あとは、swf ファイルを flashplayer_14_sa_debug.exe に関連付けで終了です。flashplayer_14_sa_debug.exe を起動して適当な swf ファイルを開くと、勝手に関連付けされるみたいです。いいのかこの仕様。

 
残りの 3 つのツールは、SWF を逆アセンブルするためのツールです。

 
- JPEXS Free Flash Decompiler 2.1.2
- Adobe SWF Investigator (Preview 5; v0.6.5)
- Yogda 1.0.567

 
Adobe Flash は ActionScript 3.0 という言語で記述します。コードをコンパイルしてできたプログラムは、Adobe AIR というランタイムで動くので、AIR さえ動くのであれば OS には依存せずに実行可能。AIR の一部である AVM2 (=ActionScript 仮想マシン) が、コンパイラの生成したバイトコードを解釈して動作する、らしい。その点では、.NET より Java にかなり近いようだ。

 
上記逆アセンブル ツールは、AVM のバイトコードを生成するものです。バイトコードのリファレンスは↓

 
ActionScript Virtual Machine 2 (AVM2) Overview <br />
[http://www.adobe.com/content/dam/Adobe/en/devnet/actionscript/articles/avm2overview.pdf](http://www.adobe.com/content/dam/Adobe/en/devnet/actionscript/articles/avm2overview.pdf)

 
あと、Yogda のサイトに一覧があって、こっちのほうが本家の PDF より見やすい。当たり前だが、Intel CPU のアセンブリ言語とは段違いのシンプルさでよい。

 
Yogda - AVM2 bytecode workbench <br />
[http://yogda.2ka.org/bytecodes](http://yogda.2ka.org/bytecodes)

