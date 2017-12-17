---
layout: post
title: "[Win32] [C++] Asynchronous RPC with I/O Completion Port – #4"
date: 2012-03-09 00:55:49.000 +09:00
categories:
- C/C++
- Windows
tags:
- IPC$
- Network Monitor
- RPC
- SMB
---

これまでの記事で、RPC サーバーと RPC クライアントができました。 <br />
サーバー間で RPC 通信ができるようになったので、とりあえず Network Monitor でパケット キャプチャーを取って見てみます。

 
まずは名前付きパイプによる通信から。

 
![]({{site.assets_url}}2012-03-09-image2.png)

 
ごちゃごちゃしていますが、よく見れば内容は単純です。

 
サーバー間の名前付きパイプは、SMB による通信が行われます。上のパケットは Windows Server 2008 R2 の環境で取ったので、SMB 2.0 による通信が行われています。したがって、サーバー側のポート番号は 445/tcp です。

 
ファイル共有にアクセスするときと同様に、Negotiate → Session Setup → Tree Connect → Create というように SMB コマンドが実行されていきます。

 
一つ目のポイントは、Tree Connect コマンドでの接続先エンド ポイントが \\サーバー名\IPC$ となることです。ファイル共有の時は \\サーバー名\共有名 がエンドポイントになりますが、名前付きパイプの時は必ず IPC$ を見に行きます。ちなみに IPC は Interprocess Communications の略です。

 
Create するときのファイル名がパイプ名になります。\pipe\test というパイプを使った通信では、test というファイルを開きます。イメージとしては、\\サーバー名\IPC$ という共有フォルダーの中に test というファイルがあって、それを CreateFile するイメージです。

 
SMB Create の後に、RPC のバインド処理が行われます。プロトコルの階層を見ると、これは SMB Write コマンドによって行われていることがわかります。ようは WriteFile です。後の通信も、SMB の Write やら Read やらで行われます。これが名前付きパイプによる RPC 通信です。

 
![]({{site.assets_url}}2012-03-09-image3.png)

 
それともう一つ、これは SMB 通信なので、Session Setup ではユーザー認証が行われます。今回の検証は Active Directory ドメイン環境で行っていて、AsyncClient の接続先には FQDN を入力したので Kerberos 認証が行われます。IP アドレスの場合は NTLM 認証が行われます。Session Setup の要求パケットを見ていくと分かりますが、通常の SMB 通信と同様に cifs のサービス チケットを提示しています。

 
では次に、TCP/IP による RPC を見てみます。 <br />
もちろん名前付きパイプの通信も TCP/IP なので、ネイティブ TCP/IP とでも言いましょうか。

 
![]({{site.assets_url}}2012-03-09-image4.png)

 
表示の上では余計にごちゃごちゃしていますが、短くてシンプルなのが分かると思います。 <br />
このキャプチャーは、メソッドを続けて 2 回呼び出したときのものなので、要求1 → 要求2 → 応答1 → 応答2 という順番になっています。1 回のメソッド実行の流れは非常に単純です。TCP セッション確立 → RPC Bind → Request → Response という 4 段階だけです。

 
Network Monitor のサマリーにおいて、名前付きパイプのときもプロトコル名が MSRPC になっていましたが、今回の場合とはプロトコル階層が異なります。もちろん今回は SMB 通信は一切関係ありません。ポート番号はアプリケーションが指定しています。RPC の動的ポート割り当ても使うことができます。そのときは RPC サーバーでポートをバインドするときに RpcServerUseProtseqEx API を使います。

 
![]({{site.assets_url}}2012-03-09-image5.png)

 
名前付きパイプでもネイティブ TCP/IP でもいいのですが、RPC Bind メッセージを見ると、3 種類の GUID がクライアントからの要求に含まれているのが分かります。下の抜粋がそうです。

 
```
- PContElem [0] 
  - AbstractSyntax 
    + IfUuid: {161B9AB8-1A96-40A6-BF8B-AA2D7EC94B6D} 
      IfVersion: 1 (0x1) 
  - TransferSyntaxes 
    + IfUuid: {8A885D04-1CEB-11C9-9FE8-08002B104860} 
      IfVersion: 2 (0x2)

- PContElem [1] 
    PContId: 1 (0x1) 
    NTransferSyn: 1 (0x1) 
    Reserved: 0 (0x0) 
  - AbstractSyntax 
    + IfUuid: {161B9AB8-1A96-40A6-BF8B-AA2D7EC94B6D} 
      IfVersion: 1 (0x1) 
  - TransferSyntaxes 
    + BTFNUuid: {6CB71C2C-9812-4540-0300000000000000} 
      IfVersion: 1 (0x1)
```

![]({{site.assets_url}}2012-03-09-image6.png)

既にお気づきと思いますが、この中の 2 つは、インターフェース定義に登場しています。プログラムを書く最初に uuidgen で idl ファイルのひな型を作成しましたが、AbstractSyntax の IfUuid は、この時の IDL に埋め込まれていた UUID に一致します。

 
```
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
 
midl でコンパイルして生成されたクライアント用ソース ファイル pipo_c.cpp には以下のような定数がありました。

 
```
static const RPC_CLIENT_INTERFACE pipo___RpcClientInterface = { 
  sizeof(RPC_CLIENT_INTERFACE), 
  {%raw%}{{0x161b9ab8,0x1a96,0x40a6,{0xbf,0x8b,0xaa,0x2d,0x7e,0xc9,0x4b,0x6d}}{%endraw%}, 
    {1,0}}, 
  {%raw%}{{0x8A885D04,0x1CEB,0x11C9,{0x9F,0xE8,0x08,0x00,0x2B,0x10,0x48,0x60}}{%endraw%}, 
    {2,0}}, 
  0, 
  0, 
  0, 
  0, 
  0, 
  0x00000000 
}; 
RPC_IF_HANDLE pipo_v1_0_c_ifspec = (RPC_IF_HANDLE)& pipo___RpcClientInterface; 
```
 
AbstractSyntax と TransferSyntaxes の IfUuid に加え、バージョン番号もここで定義されています。 <br />
「Transfer Syntax って何よ」って話ですが、それはここに書いてあります。

 
```
RPC transfer syntax: A method for encoding messages defined in an Interface Definition Language (IDL) file. Remote procedure call (RPC) can support different encoding methods or transfer syntaxes. 
http://msdn.microsoft.com/en-us/library/cc232140(v=prot.10).aspx#rpc_transfer_syntax
```
 
ということで、エンコードの方法を示しているようです。ということは、インターフェース UUID と違って、ランダムに生成されているものではないということです。

 
今回使われている {8A885D04-1CEB-11C9-9FE8-08002B104860} は NDR (Network Data Representation) 2.0 という形式であることを示しています。まあ、これ以上深追いするのは止めておきましょう。すべて [[MS-RPCE]](http://msdn.microsoft.com/en-us/library/cc243560(v=prot.13).aspx) の仕様書に書いてあるので、時間があるときにお読み下さい。残念ながら私は一部しか読んでいません・・。

 
2.2.4.12 NDR Transfer Syntax Identifier <br />
[http://msdn.microsoft.com/en-us/library/cc243843(v=PROT.13).aspx](http://msdn.microsoft.com/en-us/library/cc243843(v=PROT.13).aspx)

 
[http://msdn.microsoft.com/en-us/library/33b94545-9ae1-4cc8-9ce5-4be893b7bec3(v=prot.13)#NDR](http://msdn.microsoft.com/en-us/library/33b94545-9ae1-4cc8-9ce5-4be893b7bec3(v=prot.13)#NDR)

 
最後に残った {6CB71C2C-9812-4540-0300000000000000} についても、仕様書に書いてあります。これも固定値のようですね。

 
3.3.1.5.3 Bind Time Feature Negotiation <br />
[http://msdn.microsoft.com/en-us/library/cc243715(v=PROT.13).aspx](http://msdn.microsoft.com/en-us/library/cc243715(v=PROT.13).aspx)

 
以上が RPC Bind に含まれる GUID でした。

 
名前付きパイプのときとは異なり、今回のようなシンプルなメソッドでは認証 (+認可) 動作が発生しません。

 
わりと後半はぐだぐだになってしまいました (力尽きた・・・) が、サーバー間の非同期 RPC のシリーズはこのへんにしておきます。 <br />
他に遊ぶとすれば、デバッガーをアタッチして RPC メソッド呼び出し時のモジュールの動きを、カーネル/ユーザー モード、サーバー/クライアントのそれぞれで見てみると面白いと思います。

 
例えば、RPC サーバーのメソッドは以下のようなスタックで呼び出されています。

 
```
0:007> k 
Child-SP          RetAddr           Call Site 
00000000`02bcf1c8 000007fe`fe5b23d5 AsyncServer!RpcSleepAsync 
00000000`02bcf1d0 000007fe`fe65f695 RPCRT4!Invoke+0x65 
00000000`02bcf220 000007fe`fe5a50f4 RPCRT4!NdrAsyncServerCall+0x29c 
00000000`02bcf300 000007fe`fe5a4f56 RPCRT4!DispatchToStubInCNoAvrf+0x14 
00000000`02bcf330 000007fe`fe59d879 RPCRT4!RPC_INTERFACE::DispatchToStubWorker+0x146 
00000000`02bcf450 000007fe`fe59d6de RPCRT4!OSF_SCALL::DispatchHelper+0x159 
00000000`02bcf570 000007fe`fe6527b4 RPCRT4!OSF_SCALL::ProcessReceivedPDU+0x18e 
00000000`02bcf5e0 000007fe`fe5ec725 RPCRT4!OSF_SCALL::BeginRpcCall+0x134 
00000000`02bcf610 000007fe`fe59d023 RPCRT4!Invoke+0x2adf9 
00000000`02bcf6c0 000007fe`fe59d103 RPCRT4!CO_ConnectionThreadPoolCallback+0x123 
00000000`02bcf770 000007fe`fe15898f RPCRT4!CO_NmpThreadPoolCallback+0x3f 
00000000`02bcf7b0 00000000`77c5098a KERNELBASE!BasepTpIoCallback+0x4b 
00000000`02bcf7f0 00000000`77c5feff ntdll!TppIopExecuteCallback+0x1ff 
00000000`02bcf8a0 00000000`779e652d ntdll!TppWorkerThread+0x3f8 
00000000`02bcfba0 00000000`77c6c521 kernel32!BaseThreadInitThunk+0xd 
00000000`02bcfbd0 00000000`00000000 ntdll!RtlUserThreadStart+0x1d
```
