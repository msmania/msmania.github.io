---
layout: post
title: "[Win32] [C++] Asynchronous RPC with I/O Completion Port - #1"
date: 2012-03-08 00:24:52.000 +09:00
categories:
- C/C++
- Windows
tags:
- ACF
- IDL
- RPC
---

以前、同一マシン内での RPC について、名前付きパイプと LPC のそれぞれの方法で通信するクライアントとサーバーを作りました。このときは同期 RPC、すなわちクライアントがメソッドを呼び出すと、サーバー側での処理が終わるまで制御が返ってこない RPC でした。今回は非同期 RPC 通信についてプログラムを書いたので記事にします。

 
&#x5b;Win32&#x5d; &#x5b;C++&#x5d; Local RPC over Named Pipe and LPC <br />
[http://msmania.wordpress.com/2011/07/10/win32-c-local-rpc-over-named-pipe-and-lpc/](http://msmania.wordpress.com/2011/07/10/win32-c-local-rpc-over-named-pipe-and-lpc/)

 
4 回に分けて書くことになりました。今回が #1 のインターフェース定義編です。

 
```
#1 - インターフェース定義編 
http://msmania.wordpress.com/2012/03/08/win32-c-asynchronous-rpc-with-io-completion-port/

#2 - RPC サーバー編 
http://msmania.wordpress.com/2012/03/08/win32-c-asynchronous-rpc-with-io-completion-port-2/

#3 - RPC クライアント編 
http://msmania.wordpress.com/2012/03/08/win32-c-asynchronous-rpc-with-io-completion-port-3/

#4 - ネットワーク キャプチャー編 
http://msmania.wordpress.com/2012/03/08/win32-c-asynchronous-rpc-with-io-completion-port-4/ 
```
 
非同期 RPC では、クライアントがメソッドを呼び出しても、RPC サーバーの処理に関係なく制御がすぐに返ってきます。このため、実際に RPC サーバーでメソッドの処理が終わったときにコールバックを受ける必要が出てきます。このときのコールバック方法には複数の選択肢があり、いずれかをクライアント側が提示することができます。正確には、メソッドを呼び出すときのパラメーターである RPC_ASYNC_STATE 構造体の RPC_NOTIFICATION_TYPES 列挙値で指定します。

 
- コールバックなし 
- イベント オブジェクト 
- APC (Asynchronous Procedure Call) 
- I/O 完了ポート 
- ウィンドウ メッセージ 
- コールバック関数 

 
種類が豊富ですね。APC は使ったことがないのであまり知りませんが、それ以外は何となく想像がつきます。 <br />
さて、この中で比較的実装が複雑になりそうな I/O 完了ポートを使ってサンプルプログラムを作ります。ちなみに、MSDN に載っている非同期 RPC のサンプルはイベント オブジェクトを使うものでした。

 
RPC_ASYNC_STATE structure <br />
[http://msdn.microsoft.com/en-us/library/windows/desktop/aa378490(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/windows/desktop/aa378490(v=vs.85).aspx)

 
RPC_NOTIFICATION_TYPES enumeration <br />
[http://msdn.microsoft.com/en-us/library/windows/desktop/aa378638(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/windows/desktop/aa378638(v=vs.85).aspx)

 
一つの記事で書くにはちょっと複雑なプログラムになってしまったので、まず最初にプログラムの全体像を紹介します。

 
プロジェクトのフォルダー構造は抜粋するとこんな感じです。 <br />
今回は GUI で書きました。64bit ネイティブでビルドしましたが、32bit でも普通にビルドできます。たぶん。

 
```
AsyncRpc 
│  AsyncCommon.cpp … クライアント/サーバー共通コード 
│  AsyncCommon.h 
│  
├─AsyncClient 
│      main.cpp 
│      AsyncClient.h 
│      AsyncClient.cpp 
│      resource.h 
│      AsyncClient.rc 
│              
├─AsyncServer 
│  │  main.cpp 
│  │  AsyncServer.h 
│  │  AsyncServer.cpp 
│  │  resource.h 
│  │  AsyncServer.rc 
│  │  
│  └─x64 
│      └─Debug 
│              AsyncClient.exe 
│              AsyncClient.pdb 
│              AsyncServer.exe 
│              AsyncServer.pdb 
│              
└─idl 
        pipo.idl … インターフェース定義関連 
        pipo.acf 
        pipo.h 
        pipo_c.c 
        pipo_s.c
```
 
### 1. インターフェース定義を作る (IDL, ACF ファイル)

 
まずは短いところから。IDL ファイルと ACF ファイルをテキスト エディターで書きます。ひな型の作成に uuidgen /i コマンドを使うこともできます。（[前回の記事](http://msmania.wordpress.com/2011/07/10/win32-c-local-rpc-over-named-pipe-and-lpc/)参照）

 
```
// 
// pipo.idl 
// 
// generated with ‘uuidgen /i /opipo.idl’ 
// compile with ‘midl pipo.idl’ 
// 
// http://msdn.microsoft.com/en-us/library/aa367088 
//

[ 
uuid(161b9ab8-1a96-40a6-bf8b-aa2d7ec94b6d), 
version(1.0) 
] 
interface pipo 
{ 
    void RpcSleep(int Duration); 
    void RpcSleepAsync(int Duration); 
    void Shutdown(); 
} 
```
 
IDL ファイルは普通ですね。ACF ファイルはこんな感じです。

 
```
// 
// pipo.acf 
// 
// http://msdn.microsoft.com/en-us/library/aa366717(v=VS.85).aspx 
// 
  
[ 
implicit_handle(handle_t pipo_IfHandle) 
] 
interface pipo 
{ 
    [async] RpcSleepAsync(); 
} 
```
 
非同期 RPC にしたい関数には、ACF ファイル内で &#x5b;async&#x5d; 属性を付けておきます。詳細はそれぞれのファイルの先頭に書いた MSDN のページを参考にして下さい。

 
ファイルが書けたら、Windows SDK に含まれる midl.exe で IDL ファイルをコンパイルします。 ACF ファイルは midl が自動的に読み込みます。

 
```
> midl pipo.idl 
Microsoft (R) 32b/64b MIDL Compiler Version 7.00.0555 
Copyright (c) Microsoft Corporation. All rights reserved. 
64 bit Processing .\pipo.idl 
pipo.idl 
64 bit Processing .\pipo.acf 
pipo.acf
```
 
これで、インターフェースについてのヘッダーとソース ファイルが自動生成されました。

 
後で書くプログラムの仕様上、クライアント用ソース ファイルの pipo_c.c に含まれるインターフェース ハンドルのグローバル変数を、NULL で初期化しておきます。

 
これが修正前。

 
```
/* Standard interface: pipo, ver. 1.0, 
   GUID={0x161b9ab8,0x1a96,0x40a6,{0xbf,0x8b,0xaa,0x2d,0x7e,0xc9,0x4b,0x6d}} */

handle_t pipo_IfHandle; 
```
 
修正後。

 
```
/* Standard interface: pipo, ver. 1.0, 
   GUID={0x161b9ab8,0x1a96,0x40a6,{0xbf,0x8b,0xaa,0x2d,0x7e,0xc9,0x4b,0x6d}} */

handle_t pipo_IfHandle= NULL; 
```
 
この記事はここまで。 <br />
次回は RPC サーバーを作ります。

