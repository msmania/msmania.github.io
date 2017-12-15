---
layout: post
title: "[SAP] [C#] SAP GUI Scripting from .NET"
date: 2011-10-09 12:44:20.000 +09:00
categories:
- C#
- SAP
- Windows
tags:
- IDL
- MIDL
- SAP GUI Scripting
- sapfewse
- TLB
- tlbimp
- TypeLib
---

SAP GUI Scripting という機能があります。eCATT （まともに使ったことはない） のように、SAP GUI を外部から操作できる機能です。テスト シナリオの実行やテスト データ入力などを大量処理する場合に使えそうです。HP Quality Center やら HP Load Runner はこの機能を利用しているんでしょうかね。

 
これはあくまでも SAP GUI を操作する機能ですので、アプリケーション サーバーを直接操作する BAPI や Enterprise Services とは全く別の機能です。

 
この SAP GUI Scripting、実際どのぐらい使われているかどうかは不明です。古くからある機能なので、公開されている情報も古いものが多い気がします。VBScript やネイティブ アプリ、.NET からも操作できるような記述がありますが、SAP Note に添付されているサンプルが VB6 で書かれたとおぼしきものだったり。いいサンプルなんですけど。

 
そんなわけで、.NET で SAP GUI Scripting を操作してみました。

 
まず、SAP GUI Scripting の実体は単なる ActiveX コントロールです。VBA から SAP にアクセスするときに、SAP GUI の ActiveX コントロールを使っている人はそこそこいるような、いないような。ファイルは sapfewse.ocx です。SAP GUI をインストールすると以下のパスに作成されます。

 
C:\Program Files (x86)\SAP\FrontEnd\SAPgui\sapfewse.ocx

 
![]({{site.assets_url}}2011-10-09-image.png)

 
それさえ分かれば、あとは普通に使えます。手順は以下の通り。

 
1. TypeLib を使って OCX ファイルから IDL ファイルを作成 
1. IDL をコンパイルして TLB ファイルを作成 
1. TLBIMP を使って TLB ファイルから .NET アセンブリを作成 
1. .NET アプリを書く 

 
環境はこんな感じ。SDK は新しいの入れておかないと駄目だなー。

 
OS: Windows 7 SP1 <br />
IDE: Visual Studio 2010 SP1 <br />
SDK: Windows SDK v7.0A （まずい 7.1 入れてない・・・） <br />
SAP GUI: 720 PL3

  
### 1. TypeLib を使って OCX ファイルから IDL ファイルを作成

 
Windows SDK に付属している OLE-COM Object Viewer を管理者特権で開いて下さい。Visual Studio をインストールすると勝手にインストールされると思います。

 
![]({{site.assets_url}}2011-10-09-image1.png)

 
メニューから File &gt; View TypeLib を選んで下さい。

 
![]({{site.assets_url}}2011-10-09-image2.png)

 
&#x5b;ファイルを開く&#x5d; ダイアログが表示されるので、前述の sapfewse.ocx を開いて下さい。

 
![]({{site.assets_url}}2011-10-09-image3.png)

 
メニューから File &gt; Save As... を選択し、適当なところに IDL ファイルを保存して下さい。ファイルの末尾が切れる場合は、右ペインのテキストをコピペしてテキスト ファイルとして保存して下さい。

 
![]({{site.assets_url}}2011-10-09-image4.png)

 
ファイルはこんな感じです。以前の記事で RPC サーバー / クライアントを作ったときにも IDL ファイルは出てきました。あのときは手で書きましたが、このように既存のオブジェクトから自動生成することもできます。

 
![]({{site.assets_url}}2011-10-09-image5.png)

 
 

 
### 2. IDL をコンパイルして TLB ファイルを作成

 
ネイティブだったら IDL ファイルを使ってそのまま RPC クライアントを作ればいいのですが、.NET の場合はもう数ステップ必要です。

 
次に IDL ファイルをコンパイルして TLB ファイルを作る必要があります。Windows SDK に含まれている midl.exe を使います。これも RPC のときに使いました。Visual Studio Command Prompt を管理者特権で開き、以下のコマンドを実行します。

 
```
> midl sapfewse.IDL
```
 
![]({{site.assets_url}}2011-10-09-image6.png)

 
が、エラーとなります。おーん。

 
```
.\sapfewse.IDL(601) : error MIDL2025 : syntax error : expecting a type specification near "GuiComponent"

.\sapfewse.IDL(601) : error MIDL2026 : cannot recover from earlier syntax errors; aborting compilation
```
 
syntax error とか・・・自動生成したものをそのまま使ってるんですがね。 <br />
エラーとなっている 601 行付近はこんな感じです。

 
```
    [ 
      uuid(93A37525-9118-4731-92A7-B93DF1E34455) 
    ] 
    dispinterface _Dsapfewse { 
        properties: 
            [id(0x00007d01), readonly            
] 
            BSTR Name; 
            [id(0x00007d0f), readonly            
] 
            BSTR Type; 
            [id(0x00007d20), readonly            
] 
            long TypeAsNumber; 
            [id(0x00007d21), readonly            
] 
            VARIANT_BOOL ContainerType; 
            [id(0x00007d19), readonly            
] 
            BSTR Id; 
            [id(0x00007d26), readonly            
] 
            GuiComponent* Parent; 
            [id(0x00007d13), readonly      ← 601 行目      
]
```
 
インターフェース _Dsapfewse のメンバーを定義しているところです。GuiComponent というキーワードが認識されていないようなので、定義を探してみます。すると、701 行目に定義が見つかります。原因はこれですね。物事には順番ってものがあります。

 
```
[ 
  uuid(ABCC907C-3AB1-45D9-BF20-D3F647377B06), 
  noncreatable 
] 
coclass GuiComponent { 
    [default] dispinterface ISapComponentTarget; 
};
```
 
GuiComponent の定義を _Dsapfewse の定義の上に移動させます。こんな感じ。

 
```
[ 
  uuid(ABCC907C-3AB1-45D9-BF20-D3F647377B06), 
  noncreatable 
] 
coclass GuiComponent { 
    [default] dispinterface ISapComponentTarget; 
};

[ 
  uuid(93A37525-9118-4731-92A7-B93DF1E34455) 
] 
dispinterface _Dsapfewse { 
    properties: 
        [id(0x00007d01), readonly            
```
 
さて、再チャレンジ。またエラーでございます。

 
![]({{site.assets_url}}2011-10-09-image7.png)

 
```
.\sapfewse.IDL(612) : error MIDL2025 : syntax error : expecting a type specification near "GuiComponentCollection" 
.\sapfewse.IDL(612) : error MIDL2026 : cannot recover from earlier syntax errors; aborting compilation
```
 
今度は GuiComponentCollection か。というわけで、今度は GuiComponentCollection の定義を _Dsapfewse の上に移動します。で、また違う箇所でエラ・・・。

 
試行錯誤の上、以下のような修正をしてコンパイル エラーがクリアされました。やれやれ手間のかかる・・・。でもまあ、定義の順番を入れ替えるだけでよかったから幸運なのかも。

 
- GuiComponent の定義を _Dsapfewse の前に移動 
- GuiComponentCollection の定義を _Dsapfewse の前に移動 
- GuiUtils の定義を _Dsapfewse の前に移動 
- GuiCollection の定義を _Dsapfewse の前に移動 
- GuiConnection の定義を _Dsapfewse の前に移動 
- GuiSession の定義を _DsapfewseEvents の前に移動 
- GuiFrameWindow の定義を ISapSessionTarget の前に移動 
- GuiSessionInfo の定義を ISapSessionTarget の前に移動 
- GuiVComponent の定義を ISapWindowTarget の前に移動 
- GuiScrollbar の定義を ISapScreenTarget の前に移動 
- GuiContextMenu の定義を ISapScreenTarget の前に移動 
- GuiComboBoxEntry の定義を ISapComboBoxTarget の前に移動 
- GuiTab の定義を ISapTabbedPane の前に移動 

 
![]({{site.assets_url}}2011-10-09-image8.png)

 
コンパイルが通ると、sapfewse.tlb というファイルが生成されます。これはバイナリ ファイルです。

 
![]({{site.assets_url}}2011-10-09-image9.png)

 
 

 
### 3. TLBIMP を使って TLB ファイルから .NET アセンブリを作成

 
TLB ファイルができたら、同じく Windows SDK に含まれる tlbimp を使うと .NET アセンブリを生成してくれます。

 
以下のコマンドを実行します。ここはノー エラーで通った。

 
```
e:\dropbox\sapfewse> tlbimp sapfewse.tlb  /out:sapfewse.dll 
Microsoft (R) .NET Framework Type Library to Assembly Converter 4.0.30319.1 
Copyright (C) Microsoft Corporation.  All rights reserved.

TlbImp : Type library imported to e:\dropbox\sapfewse\sapfewse.dll

e:\dropbox\sapfewse>
```
 
無事、アセンブリである sapfewse.dll をゲットすることができました。

 
![]({{site.assets_url}}2011-10-09-image10.png)

 
 

 
### 4. .NET アプリを書く

 
ここまでが事前準備です。では Visual Studio を起動して .NET アプリを書きます。例によって言語は C# を使いますが、VB でも F# でも動くはずです。

 
普通に C# の Window Forms Application プロジェクトを作成して下さい。 <br />
ソリューションのフォルダーに、.NET アセンブリを作ったときの作業用フォルダーを丸ごとコピーしておくとよいです。

 
![]({{site.assets_url}}2011-10-09-image11.png)

 
Solution Explorer の References を右クリックし、Add Referene... を選択して下さい。 <br />
Add Reference ダイアログボックスの Browse タブから、先の手順で作った sapfewse.dll を選んで OK をクリックして下さい。をや、TLB ファイルはそのまま使えるのか。これは知らなかった。

 
![]({{site.assets_url}}2011-10-09-image12.png)

 
名前空間 sapfewse が追加されました。Object Explorer で開いてみると、GuiApplication などのクラスが確認できます。

 
![]({{site.assets_url}}2011-10-09-image13.png)

 
ボタンとテキスト ボックスを配置します。

 
![]({{site.assets_url}}2011-10-09-image14.png)

 
ボタンをクリックしたときのイベント ハンドラーに、以下の 2 行を追加します。ええ、2 行だけです。 <br />
GuiApplication のインスタンスを作って、OpenConnection を呼ぶだけです。

 
```
sapfewse.GuiApplication SapGuiApp = new sapfewse.GuiApplication(); 
SapGuiApp.OpenConnection(textBox1.Text);
```
 
ソースはこんな感じになります。上の 2 行以外は何もいじっていません。

 
![]({{site.assets_url}}2011-10-09-image15.png)

 
SAP GUI がインストールされている PC 上でプログラムを起動します。 <br />
テキスト ボックスに SAP GUI の接続エントリの名称を入力し、Logon をクリックすると接続できます。

 
この環境では、下記のように "NetWeaver 7.02" という名前のエントリを作ってあるので、"NetWeaver 7.02" と入力します。

 
![]({{site.assets_url}}2011-10-09-image16.png)

 
![]({{site.assets_url}}2011-10-09-image17.png)

 
Logon をクリックすると、"A script is opening a connection to system NetWeaver 7.02" という確認のポップアップが表示されます。もちろん OK をクリックします。

 
![]({{site.assets_url}}2011-10-09-image18.png)

 
やけにクラシックな SAP GUI の画面が起動してきました。スキンの設定が変えられるかどうかは試していません。

 
![]({{site.assets_url}}2011-10-09-image19.png)

 
何はともあれ、ログオンはできます。ツールバーとか変ですけど。

 
![]({{site.assets_url}}2011-10-09-image20.png)

 
以上が C# から SAP GUI Scripting を操作するサンプルでした。SAP GUI を起動するサンプルでしたが、既存の SAP GUI セッションにアタッチして値の入力やトランザクションの実行を操作することもできます。むしろそういう使われ方をするほうが多いかもしれません。

 
オブジェクトのリファレンスは SDN で公開されています。以下のページから SAP GUI Scripting API をダウンロードして下さい。

 
SAP GUI Scripting <br />
[http://www.sdn.sap.com/irj/sdn/index?rid=/webcontent/uuid/007084d7-41f4-2a10-9695-d6bce1673c2f](http://www.sdn.sap.com/irj/sdn/index?rid=/webcontent/uuid/007084d7-41f4-2a10-9695-d6bce1673c2f)

 
例えば、サンプルで使った GuiApplication::OpenConnection はこんな感じです。

 
![]({{site.assets_url}}2011-10-09-image22.png)

