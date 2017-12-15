---
layout: post
title: "[C++/CLI] Debugging C++/CLI code"
date: 2014-04-13 14:42:23.000 +09:00
categories:
- Debug
- Windows
tags:
- C++/CLI
- SOS
---

C++/CLI についてちょっと動作をみてみたので、その内容をまとめます。

 
そもそも、この言語の正しい呼び方は C++/CLI でいいんでしょうかね。個人的に Managed C++ と呼んでいた時期もありましたが、間違いだったのだろうか。MSDN によると、あくまでも C++ の拡張という位置づけのようです。いつの間にか C++/CX なんてのもあるみたいですが、そんなのは知らない。

 
Component Extensions for Runtime Platforms <br />
[http://msdn.microsoft.com/en-us/library/xey702bw.aspx](http://msdn.microsoft.com/en-us/library/xey702bw.aspx)

 
その名の通り、CLI で動く C++ であり、C++ のコードはそのままに、.NET Framework も使えてしまう素晴らしい環境です。そのわりにマイナーですが。そもそも存在すら知らない人が多そう。私自身は、SAP をやっていた時代に SAP MDM のタプル検索のパフォーマンスを測定するため、.NET API 経由で MDM を操作するテスト プログラムをなぜか言語として C++/CLI を選んで書いた記憶があります。確か別の製品のほうが速くて、結局 MDM 採用には至らなかったんですが。MDM .NET API というのは ↓ です。たぶん Java API のほうが広く使われています。当時は、そもそも SAP MDM なんて・・・という話もありましたが、今はどうなんでしょうかね。

 
MDM Java and .NET API Guide <br />
[http://help.sap.com/saphelp_nwmdm71/helpdata/en/loio30bf76947bb64c48a2e835fda42c5183_30bf76947bb64c48a2e835fda42c5183/13/041975d8ce4d4287d5205816ea955a/frameset.htm](http://help.sap.com/saphelp_nwmdm71/helpdata/en/loio30bf76947bb64c48a2e835fda42c5183_30bf76947bb64c48a2e835fda42c5183/13/041975d8ce4d4287d5205816ea955a/frameset.htm)

 
それはさておき C++/CLI ですが、デバッグして見てみたかったのは以下の関数呼び出しのパターンです。気になりますよね。

 
- C++/CLI –&gt; Win32 Native DLL 
- C++/CLI –&gt; C# Library 
- C# –&gt; C++/CLI Library 

 
というわけで、以下 5 つのプロジェクトからなるソリューションを Visual Studio で作ります。カッコ内は使ったテンプレートです。

 
- cppclrapp (Visual C++ &gt; CLR &gt; CLR Console Application) 
- cppclrlib (Visual C++ &gt; CLR &gt; Class Library) 
- cslib (Visual C# &gt; Windows &gt; Class Library) 
- sublib(Visual C++ &gt; CLR &gt; Class Library) 
- NativeDll (Visual C++ &gt; Win32 &gt; Win32 Project) 

 
ソリューション エクスプローラーはこんな感じ。

 
![]({{site.assets_url}}2014-04-13-image.png)

 
開発環境は以下の通りです。

 
- OS: Windows 8.1 x64 
- IDE: Visual Studio 2013 Update 1 
- .NET Framework: 4.5 
- Windows Debugger: SDK 8.1 に入っているもの

 
以下のコードを書きました。デバッグしやすいように DebugBreak() を入れてあるのと、インライン展開されてシンボルが見えなくなる部分があったので、関数呼び出しを二段階にした部分があります。

 
#### cppclrapp - cppclrapp.cpp

 
```
// cppclrapp.cpp : main project file.

#include <windows.h>

#ifdef _WIN64 
#ifdef _DEBUG 
#using "..\x64\debug\cppclrlib.dll" 
#else 
#using "..\x64\release\cppclrlib.dll" 
#endif 
#else 
#ifdef _DEBUG 
#using "..\debug\cppclrlib.dll" 
#else 
#using "..\release\cppclrlib.dll" 
#endif 
#endif

int main(array<System::String ^> ^args) 
{ 
    System::Console::WriteLine("Program Start with {0} parameters", args->Length); 
    DebugBreak();

    cppclrlib::Class1 ^Class = gcnew cppclrlib::Class1(); 
    Class->Run(); 
    return 42; 
} 
```
 
#### cppclrlib – cppclrlib.cpp

 
```
// This is the main DLL file.

#include <Windows.h>

#ifdef _DEBUG 
#using "..\debug\cslib.dll" 
#else 
#using "..\release\cslib.dll" 
#endif

using namespace System;

typedef DWORD(WINAPI *NATIVEDLLFUNCTION)(int, LPWSTR);

bool DoNative(String^% Param) { 
    bool Ret = false; 
    HMODULE NativeDll = NULL; 
    NATIVEDLLFUNCTION NativeDllFunction = NULL; 
    const int BufferLength = 20; 
    WCHAR Buffer[BufferLength];

    NativeDll = LoadLibrary(L"NativeDll.dll"); 
    if (!NativeDll) { 
        Console::WriteLine("LoadLibrary failed - 0x{0:x8}\n", GetLastError()); 
        goto cleanup; 
    }

    NativeDllFunction = (NATIVEDLLFUNCTION)GetProcAddress(NativeDll, "NativeDllFunction"); 
    if (!NativeDllFunction) { 
        Console::WriteLine("GetProcAddress failed - 0x{0:x8}\n", GetLastError()); 
        goto cleanup; 
    }

    Console::WriteLine("NativeDll!NativeDllFunction: {0}", NativeDllFunction(BufferLength, Buffer));

    Param = gcnew String(Buffer); 
    Ret = true;

cleanup: 
    if (NativeDll) 
        FreeLibrary(NativeDll);

    return Ret; 
}

namespace cppclrlib { 
    public ref class Class1 
    { 
    private: 
        // RunInternal is jit-compiled. 
        void RunInternal() { 
            DebugBreak(); 
            String^ Param = "Hello."; 
            Console::WriteLine("cppclrlib.Class1.Run: {0}", DoNative(Param)); 
            Console::WriteLine("cslib.Class1.Run: {0}", cslib::Class1::Run(Param)); 
            Console::WriteLine("Final parameter: {0}", Param); 
        } 
    public: 
        // Run is never jit-compiled. Inline? 
        void Run() { 
            RunInternal(); 
        } 
    }; 
}
```
 
#### cslib – Class1.cs

 
```
using System;

namespace cslib 
{ 
    public class Class1 
    { 
        [System.Runtime.InteropServices.DllImport("kernel32.dll")] static extern void DebugBreak();

        public static int Run(ref string OutParam) { 
            DebugBreak();

            var sub = new sublib.Class1(); 
            Console.WriteLine("sublib.Class1: {0}", sub.Run(ref OutParam));

            OutParam += " +cslib.Class1.Run"; 
            return 42; 
        } 
    } 
} 
```
 
#### nativedll – dllmain.cpp

 
```
// dllmain.cpp : Defines the entry point for the DLL application. 
#include <windows.h>

BOOL APIENTRY DllMain( HMODULE hModule, 
                       DWORD  ul_reason_for_call, 
                       LPVOID lpReserved 
                     ) 
{ 
    switch (ul_reason_for_call) 
    { 
    case DLL_PROCESS_ATTACH: 
    case DLL_THREAD_ATTACH: 
    case DLL_THREAD_DETACH: 
    case DLL_PROCESS_DETACH: 
        break; 
    } 
    return TRUE; 
}
```
 
#### nativedll – nativedll.cpp

 
```
// nativedll.cpp : Defines the exported functions for the DLL application. 
//

#include <windows.h>

DWORD WINAPI NativeDllFunction(int BufferLength, LPWSTR Buffer) { 
    DebugBreak(); 
    if (Buffer && BufferLength > 0) { 
        for (int i = 0; i < BufferLength - 1; ++i) { 
            Buffer[i] = L'A' + i; 
        } 
        Buffer[BufferLength-1] = 0; 
    } 
    return 42; 
} 
```
 
#### nativedll – nativedll.def

 
```
EXPORTS 
    NativeDllFunction @100 
```
 
#### sublib – sublib.cpp

 
```
// This is the main DLL file.

using namespace System;

namespace sublib { 
    public ref class Class1 
    { 
    private: 
        String ^Name;

    public: 
        Class1() { 
            Name = " +sublib.Class1.Run"; 
        }

        int Run(String^% Param) { 
            DebugBreak(); 
            Param += Name; 
            return 42; 
        } 
    }; 
} 
```
 
Debug ビルドは無視して、Release ビルドを使います。プラットフォームは、x86 と x64 を両方で。C# の cslib.dll については、どちらも Any CPU が使えます。Configuration Manager はこんな感じです。既定だと、C# のビルドの出力は bin フォルダーにできるので、そのへんは C++ の出力フォルダーに合わせるか、ビルド後にファイルをコピーする感じで対応します。

 
![]({{site.assets_url}}2014-04-13-image1.png)

 
![]({{site.assets_url}}2014-04-13-image2.png)

 
### &nbsp;

 
### 1. とりあえず実行してみる

 
デバッガーを使って一通り実行します。SOS のコマンドは以下のページをご参照ください。

 
SOS.dll (SOS Debugging Extension) <br />
[http://msdn.microsoft.com/en-us/library/bb190764(v=vs.110).aspx](http://msdn.microsoft.com/en-us/library/bb190764(v=vs.110).aspx)

 
```
D:\VSDev\Projects\cppclr>cdb x64\Release\cppclrapp

Microsoft (R) Windows Debugger Version 6.3.9600.16384 AMD64 
Copyright (c) Microsoft Corporation. All rights reserved.

CommandLine: x64\Release\cppclrapp

************* Symbol Path validation summary ************** 
Response                         Time (ms)     Location 
Deferred                                       cache*D:\symbols.pub*http://msdl.microsoft.com/download/symbols 
Symbol search path is: cache*D:\symbols.pub*http://msdl.microsoft.com/download/symbols 
Executable search path is: 
ModLoad: 00007ff7`ea0b0000 00007ff7`ea0c6000   cppclrapp.exe 
(省略) 
ModLoad: 00007ff8`a0720000 00007ff8`a080f000   C:\Windows\SYSTEM32\MSVCR120.dll 
(1ed8.af4): Break instruction exception - code 80000003 (first chance) 
ntdll!LdrpDoDebuggerBreak+0x30: 
00007ff8`c7797710 cc              int     3 
0:000> g 
ModLoad: 00007ff8`c6ac0000 00007ff8`c6b65000   C:\Windows\system32\ADVAPI32.dll 
(省略) 
ModLoad: 00007ff8`bbd60000 00007ff8`bc6f8000   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\clr.dll 
ModLoad: 00007ff8`bbc80000 00007ff8`bbd56000   C:\Windows\SYSTEM32\MSVCR120_CLR0400.dll 
(1ed8.af4): Unknown exception - code 04242420 (first chance) 
ModLoad: 00007ff8`ba550000 00007ff8`bbad5000   C:\Windows\assembly\NativeImages_v4.0.30319_64\mscorlib\1c4f23e80bd4b68fb3f56bdb16dbb647\mscorlib.ni.dll 
ModLoad: 00007ff8`b97b0000 00007ff8`b98df000   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\clrjit.dll 
ModLoad: 00007ff8`beeb0000 00007ff8`beec5000   cppclrlib.dll 
ModLoad: 000000f1`8e1c0000 000000f1`8e1d5000   cppclrlib.dll 
ModLoad: 00007ff8`beeb0000 00007ff8`beec5000   D:\VSDev\Projects\cppclr\x64\Release\cppclrlib.dll 
ModLoad: 000000f1`8c7e0000 000000f1`8c7e8000   cslib.dll 
ModLoad: 000000f1`8e220000 000000f1`8e228000   cslib.dll 
ModLoad: 000000f1`8c7e0000 000000f1`8c7e8000   D:\VSDev\Projects\cppclr\x64\Release\cslib.dll 
ModLoad: 00007ff8`bed90000 00007ff8`beda5000   sublib.dll 
ModLoad: 000000f1`8e190000 000000f1`8e1a5000   sublib.dll 
ModLoad: 00007ff8`bed90000 00007ff8`beda5000   D:\VSDev\Projects\cppclr\x64\Release\sublib.dll 
Program Start with 0 parameters 
(1ed8.af4): Break instruction exception - code 80000003 (first chance) 
KERNELBASE!DebugBreak+0x2: 
00007ff8`c4ca8886 cc              int     3 
0:000> lm 
start             end                 module name 
00007ff7`ea0b0000 00007ff7`ea0c6000   cppclrapp   (deferred) 
00007ff8`beeb0000 00007ff8`beec5000   cppclrlib   (deferred) 
000000f1`8e1c0000 000000f1`8e1d5000   cppclrlib_f18e1c0000   (deferred) 
000000f1`8c7e0000 000000f1`8c7e8000   cslib      (deferred) 
000000f1`8e220000 000000f1`8e228000   cslib_f18e220000   (deferred) 
00007ff8`bed90000 00007ff8`beda5000   sublib     (deferred) 
000000f1`8e190000 000000f1`8e1a5000   sublib_f18e190000   (deferred) 
00007ff8`b97b0000 00007ff8`b98df000   clrjit     (deferred) 
00007ff8`ba550000 00007ff8`bbad5000   mscorlib_ni   (deferred) 
00007ff8`a0720000 00007ff8`a080f000   MSVCR120   (deferred) 
00007ff8`bbc80000 00007ff8`bbd56000   MSVCR120_CLR0400   (deferred) 
00007ff8`bbd60000 00007ff8`bc6f8000   clr        (deferred) 
00007ff8`bc790000 00007ff8`bc82c000   mscoreei   (deferred) 
(省略) 
00007ff8`c4bd0000 00007ff8`c4cde000   KERNELBASE   (pdb symbols)          d:\symbols.pub\kernelbase.pdb\9CF6BE36C1A844C5BDADA48367CC148D2\kernelbase.pdb 
00007ff8`c76d0000 00007ff8`c7879000   ntdll      (pdb symbols)          d:\symbols.pub\ntdll.pdb\6332539D05E347DDA41DCBA242578BC31\ntdll.pdb 
0:000> .loadby sos clr 
0:000> !clrstack 
c0000005 Exception in C:\Windows\Microsoft.NET\Framework64\v4.0.30319\sos.clrstack debugger extension. 
      PC: 00007ff8`9f22c7e3  VA: 00000000`00000000  R/W: 0  Parameter: 00000000`00000000 
0:000> !clrstack 
OS Thread Id: 0xaf4 (0) 
        Child SP               IP Call Site 
000000f18c5ae7b8 00007ff8c4ca8886 [InlinedCallFrame: 000000f18c5ae7b8] <Module>.DebugBreak() 
000000f18c5ae7b8 00007ff85c7556ea [InlinedCallFrame: 000000f18c5ae7b8] <Module>.DebugBreak() 
000000f18c5ae790 00007ff85c7556ea DomainBoundILStubClass.IL_STUB_PInvoke() 
000000f18c5ae850 00007ff85c75564e <Module>.main(System.String[]) 
000000f18c5ae8a0 00007ff85c753a1e <Module>.mainCRTStartupStrArray(System.String[]) 
000000f18c5aec00 00007ff8bbd6d173 [GCFrame: 000000f18c5aec00] 
0:000> g 
(1ed8.af4): Break instruction exception - code 80000003 (first chance) 
KERNELBASE!DebugBreak+0x2: 
00007ff8`c4ca8886 cc              int     3 
0:000> !clrstack 
OS Thread Id: 0xaf4 (0) 
        Child SP               IP Call Site 
000000f18c5ae768 00007ff8c4ca8886 [InlinedCallFrame: 000000f18c5ae768] <Module>.DebugBreak() 
000000f18c5ae768 00007ff85c7556ea [InlinedCallFrame: 000000f18c5ae768] <Module>.DebugBreak() 
000000f18c5ae740 00007ff85c7556ea DomainBoundILStubClass.IL_STUB_PInvoke() 
000000f18c5ae800 00007ff85c75577b cppclrlib.Class1.RunInternal() 
000000f18c5ae850 00007ff85c755662 <Module>.main(System.String[]) 
000000f18c5ae8a0 00007ff85c753a1e <Module>.mainCRTStartupStrArray(System.String[]) 
000000f18c5aec00 00007ff8bbd6d173 [GCFrame: 000000f18c5aec00] 
0:000> g 
ModLoad: 00007ff8`c15a0000 00007ff8`c15a7000   D:\VSDev\Projects\cppclr\x64\Release\NativeDll.dll 
(1ed8.af4): Break instruction exception - code 80000003 (first chance) 
*** WARNING: Unable to verify checksum for D:\VSDev\Projects\cppclr\x64\Release\NativeDll.dll 
KERNELBASE!DebugBreak+0x2: 
00007ff8`c4ca8886 cc              int     3 
0:000> !clrstack 
OS Thread Id: 0xaf4 (0) 
        Child SP               IP Call Site 
000000f18c5ae720 00007ff8c4ca8886 [InlinedCallFrame: 000000f18c5ae720] 
000000f18c5ae720 00007ff85c75598e [InlinedCallFrame: 000000f18c5ae720] 
000000f18c5ae6d0 00007ff85c75598e <Module>.DoNative(System.String ByRef) 
000000f18c5ae800 00007ff85c7557a4 cppclrlib.Class1.RunInternal() 
000000f18c5ae850 00007ff85c755662 <Module>.main(System.String[]) 
000000f18c5ae8a0 00007ff85c753a1e <Module>.mainCRTStartupStrArray(System.String[]) 
000000f18c5aec00 00007ff8bbd6d173 [GCFrame: 000000f18c5aec00] 
0:000> k7 
Child-SP          RetAddr           Call Site 
000000f1`8c5ae698 00007ff8`c15a1026 KERNELBASE!DebugBreak+0x2 
000000f1`8c5ae6a0 00007ff8`5c75598e NativeDll!NativeDllFunction+0x16 
000000f1`8c5ae6d0 00007ff8`5c7557a4 0x00007ff8`5c75598e 
000000f1`8c5ae800 00007ff8`5c755662 0x00007ff8`5c7557a4 
000000f1`8c5ae850 00007ff8`5c753a1e 0x00007ff8`5c755662 
000000f1`8c5ae8a0 00007ff8`bbd6d173 0x00007ff8`5c753a1e 
000000f1`8c5ae920 00007ff8`bbd6d02e clr!CallDescrWorkerInternal+0x83 
0:000> g 
NativeDll!NativeDllFunction: 42 
cppclrlib.Class1.Run: True 
(1ed8.af4): Break instruction exception - code 80000003 (first chance) 
KERNELBASE!DebugBreak+0x2: 
00007ff8`c4ca8886 cc              int     3 
0:000> !clrstack 
OS Thread Id: 0xaf4 (0) 
        Child SP               IP Call Site 
000000f18c5ae708 00007ff8c4ca8886 [InlinedCallFrame: 000000f18c5ae708] <Module>.DebugBreak() 
000000f18c5ae708 00007ff85c7556ea [InlinedCallFrame: 000000f18c5ae708] <Module>.DebugBreak() 
000000f18c5ae6e0 00007ff85c7556ea DomainBoundILStubClass.IL_STUB_PInvoke() 
000000f18c5ae7a0 00007ff85c755e06 cslib.Class1.Run(System.String ByRef) 
000000f18c5ae800 00007ff85c755815 cppclrlib.Class1.RunInternal() 
000000f18c5ae850 00007ff85c755662 <Module>.main(System.String[]) 
000000f18c5ae8a0 00007ff85c753a1e <Module>.mainCRTStartupStrArray(System.String[]) 
000000f18c5aec00 00007ff8bbd6d173 [GCFrame: 000000f18c5aec00] 
0:000> g 
sublib.Class1: 42 
cslib.Class1.Run: 42 
Final parameter: ABCDEFGHIJKLMNOPQRS +sublib.Class1.Run +cslib.Class1.Run 
ntdll!NtTerminateProcess+0xa: 
00007ff8`c776683a c3              ret 
0:000> q 
quit:

D:\VSDev\Projects\cppclr>
```
 
最初に幾つかのモジュールが読み込まれますが、.NET の特徴として、イメージが複数箇所に分かれてメモリにマップされるようです。cppclrlib.dll は、00007ff8`beeb0000 と 000000f1`8e1c0000 に分かれました。スタック トレースにおける SP (Stack Pointer) と IP (Instruction Pointer) のアドレスを見る限り、それぞれコード セグメントとデータ セグメントのようなので、単純に推測すると、データ領域とコード領域が明確に分かれているようですね。詳しくは知りませんが、まあそういうものなのでしょう。

 
初回ブレークはそのまま実行して、最初の DebugBreak() 呼び出しのところで SOS をロードします。そのあと !clrstack を実行しましたが、なぜか初回は必ず c0000005 例外でコマンドが失敗します。再実行するとうまくいきます。謎の仕様ですが、これも深追いはしません。

 
初回の DebugBreak は、cppclrapp の main 関数です。!clrstack は、もちろんスタックを見るために実行しているわけですが、k コマンドだと main 関数のシンボル名は表示されません。一方 !clrstack の出力では "&lt;Module&gt;.main(System.String&#x5b;&#x5d;)" という名前が表示されています。つまり、C++/CLI のモジュールも基本的には .NET アセンブリと考えられそうです。しかし、普通に考えれば cppclrapp!main となりそうなところが、&lt;Module&gt; という意味不明なモジュール名で置き換えられています。ブレークから再開すると、cppclrlib のコードが実行されます。このときの !clrstack では cppclrlib.Class1.RunInternal と表示されていて、&lt;Module&gt; とは表示されてません。このことから、どうやら名前空間が存在しないシンボルは、&lt;Module&gt;. という接頭辞がついてしまうようです。

 
次の DebugBreak は、NativeDll のコードです。ここでは !clrstack と k を両方実行していますが、それぞれマネージドとネイティブのシンボルしか表示できていません。仕様でしょうが、まあ不便ですね。さらに、この 2 つのコマンドでは表示フォーマットが微妙に異なっていて、!clrstack の 2 列目は、リターンアドレスではなく IP です。このため、Call Site として表示されるシンボル名は 1 行ずれます。見間違いやすいので注意です。

 
さて、ここでのスタック トレースがまさに C++/CLI がネイティブ コードを呼び出しているところですが、他の DebugBreak() でのブレーク時と異なり、DomainBoundILStubClass.IL_STUB_PInvoke というフレームがありません。NativeDll!NativeDllFunction と KERNELBASE!DebugBreak の間にないのは当然ですが、NativeDll!NativeDllFunction と &lt;Module&gt;.DoNative の間にもありません。コードが短くなるだけでなく、内部的に PInvoke は使っていないのでしょう。ただしパフォーマンスが速いのかどうかは実際に測定してみないと判断できません。

 
最後の DebugBreak は C# のコードである cslib です。上述のように、C++/CLI のモジュールはマネージドの世界に住んでいると考えてよさそうなので、この部分は当然直接的な呼び出しになってます。もちろん !clrstack できれいに表示されます。

 
今回のデバッグを始める前は、C++/CLI ってのはネイティブとマネージドの混合になっていて、例えば cppclrapp であれば、cppclrapp!main というネイティブの関数が、マネージドの部分とは独立して存在するのではないかと推測していましたが、違っているようです。

 
### 2. &lt;Module&gt;. とは何なのか

 
 <br />
名前空間に所属しないシンボルは、デバッガー内では &lt;Module&gt;. という接頭辞がついてしまうことが推測されるわけですが、ではそういった関数にブレーク ポイントを貼るにはどうすればいいのでしょうか。普通のマネージドの関数であれば !name2ee を使って MD (Method Descriptor) を取得してから !bpmd なんかを実行します。では main 関数でブレークしているところで !name2ee を使ってみましょう。

 
```
0:000> !clrstack 
OS Thread Id: 0xe30 (0) 
        Child SP               IP Call Site 
000000be0c5eee18 00007ff8c4ca8886 [InlinedCallFrame: 000000be0c5eee18] <Module>.DebugBreak() 
000000be0c5eee18 00007ff85c7456ea [InlinedCallFrame: 000000be0c5eee18] <Module>.DebugBreak() 
000000be0c5eedf0 00007ff85c7456ea DomainBoundILStubClass.IL_STUB_PInvoke() 
000000be0c5eeeb0 00007ff85c74564e <Module>.main(System.String[]) 
000000be0c5eef00 00007ff85c743a1e <Module>.mainCRTStartupStrArray(System.String[]) 
000000be0c5ef260 00007ff8bbd6d173 [GCFrame: 000000be0c5ef260] 
0:000> !name2ee cppclrapp!<Module>.main 
Module:      00007ff85c602fb8 
Assembly:    cppclrapp.exe 
Token:       0000000006000001 
MethodDesc:  00007ff85c604e70 
Name:        <Module>.main(System.String[]) 
JITTED Code Address: 00007ff85c745600
```
 
なんと、&lt;Module&gt;. を含めて立派にシンボル名として機能するようです。少し気持ち悪いですが、必須テクニックでしょう。

 
次に、!dumpdomain から網羅的に展開してみます。今度は cppclrlib をターゲットにします。

 
```
0:000> !dumpdomain 
(省略) 
Assembly:           000000be0c78b910 [D:\VSDev\Projects\cppclr\x64\Release\cppclrlib.dll] 
ClassLoader:        000000be0c78ba50 
SecurityDescriptor: 000000be0c78ce60 
  Module Name 
00007ff85c6073d8            D:\VSDev\Projects\cppclr\x64\Release\cppclrlib.dll 
(省略) 
0:000> !dumpmodule -mt 00007ff85c6073d8 
Name:       D:\VSDev\Projects\cppclr\x64\Release\cppclrlib.dll 
Attributes: PEFile SupportsUpdateableMethods 
Assembly:   000000be0c78b910 
LoaderHeap:              0000000000000000 
TypeDefToMethodTableMap: 00007ff85c718800 
TypeRefToMethodTableMap: 00007ff85c719220 
MethodDefToDescMap:      00007ff85c719468 
FieldDefToDescMap:       00007ff85c7197f0 
MemberRefToDescMap:      0000000000000000 
FileReferencesMap:       00007ff85c71a588 
AssemblyReferencesMap:   00007ff85c71a590 
MetaData start address:  00007ff8c0384340 (41712 bytes)

Types defined in this module

              MT          TypeDef Name 
------------------------------------------------------------------------------ 
00007ff85c7801e8 0x02000001 <Module> 
00007ff85c780280 0x02000002 cppclrlib.Class1 
00007ff85c609ae0 0x020000e6 <CppImplementationDetails>.$ArrayType$$$BY0O@$$CB_W 
00007ff85c609b58 0x020000e7 <CppImplementationDetails>.$ArrayType$$$BY0BC@$$CBD 
00007ff85c780470 0x02000100 <CrtImplementationDetails>.ModuleLoadException 
00007ff85c780620 0x02000101 <CrtImplementationDetails>.ModuleLoadExceptionHandlerException 
00007ff85c7807a8 0x02000102 <CrtImplementationDetails>.ModuleUninitializer 
00007ff85c780308 0x0200012a <CrtImplementationDetails>.LanguageSupport 
00007ff85c780390 0x0200012b gcroot<System::String ^> 
00007ff85c609be0 0x0200012c __s_GUID 
00007ff85c609c58 0x0200012d <CppImplementationDetails>.$ArrayType$$$BY00Q6MPEBXXZ 
00007ff85c609ce0 0x02000131 <CrtImplementationDetails>.Progress+State 
00007ff85c609f70 0x02000132 <CppImplementationDetails>.$ArrayType$$$BY0A@P6AXXZ 
00007ff85c780020 0x0200013a <CppImplementationDetails>.$ArrayType$$$BY0A@P6AHXZ 
00007ff85c7800a8 0x0200013b __enative_startup_state 
00007ff85c609e30 0x0200013e <CrtImplementationDetails>.TriBool+State 
00007ff85c7808b8 0x02000142 <CrtImplementationDetails>.ThisModule
```
 
おお！&lt;Module&gt; とかいう名前のメソッド テーブルが出てきましたね！ということは !dumpmt で一網打尽にできそうです。

 
```
EEClass:         00007ff85c71f398 
Module:          00007ff85c6073d8 
Name:            <Module> 
mdToken:         0000000002000001 
File:            D:\VSDev\Projects\cppclr\x64\Release\cppclrlib.dll 
BaseSize:        0x18 
ComponentSize:   0x0 
Slots in VTable: 91 
Number of IFaces in IFaceMap: 0 
-------------------------------------- 
MethodDesc Table 
           Entry       MethodDesc    JIT Name 
00007ff85c742060 00007ff85c609410    JIT <Module>..cctor() 
00007ff85c60c9f8 00007ff85c609170   NONE <Module>.DoNative(System.String ByRef) 
00007ff85c60ca00 00007ff85c609180   NONE <Module>.<CrtImplementationDetails>.NativeDll.IsInDllMain() 
00007ff85c7438d0 00007ff85c6093c0    JIT <Module>.<CrtImplementationDetails>.LanguageSupport.DomainUnload(System.Object, System.EventArgs) 
00007ff85c742230 00007ff85c6093d0    JIT <Module>.<CrtImplementationDetails>.LanguageSupport.Cleanup(<CrtImplementationDetails>.LanguageSupport*, System.Exception) 
00007ff85c7420f0 00007ff85c6093e0    JIT <Module>.<CrtImplementationDetails>.LanguageSupport.{ctor}(<CrtImplementationDetails>.LanguageSupport*) 
00007ff85c743930 00007ff85c6093f0    JIT <Module>.<CrtImplementationDetails>.LanguageSupport.{dtor}(<CrtImplementationDetails>.LanguageSupport*) 
00007ff85c742320 00007ff85c609400    JIT <Module>.<CrtImplementationDetails>.LanguageSupport.Initialize(<CrtImplementationDetails>.LanguageSupport*) 
00007ff85c60cb50 00007ff85c609418   NONE <Module>.gcroot<System::String ^>.{ctor}(gcroot<System::String ^>*) 
00007ff85c743950 00007ff85c609428    JIT <Module>.gcroot<System::String ^>.{dtor}(gcroot<System::String ^>*) 
00007ff85c742650 00007ff85c609438    JIT <Module>.gcroot<System::String ^>.=(gcroot<System::String ^>*, System.String) 
00007ff85c60cb68 00007ff85c609448   NONE <Module>.gcroot<System::String ^>..PE$AAVString@System@@(gcroot<System::String ^>*) 
00007ff85c743010 00007ff85c609458    JIT <Module>.<CrtImplementationDetails>.AtExitLock._handle() 
(いろいろ省略) 
00007ff85c60cc00 00007ff85c609578   NONE <Module>._atexit_m(Void ()) 
00007ff85c60cc08 00007ff85c609588   NONE <Module>._initatexit_app_domain() 
00007ff85c60cc10 00007ff85c609598   NONE <Module>._app_exit_callback() 
00007ff85c60cc18 00007ff85c6095a8   NONE <Module>._onexit_m_appdomain() _onexit_m_appdomain(Int32 ()) 
00007ff85c60cc20 00007ff85c6095b8   NONE <Module>._atexit_m_appdomain(Void ()) 
00007ff85c60cc28 00007ff85c6095c8   NONE <Module>.DecodePointer(Void*) 
00007ff85c60d0f0 00007ff85c609610   NONE <Module>.EncodePointer(Void*) 
00007ff85c60cc38 00007ff85c609658   NONE <Module>._initterm_e(Int32 ()*, Int32 ()*) 
00007ff85c60cc40 00007ff85c609668   NONE <Module>._initterm(Void ()*, Void ()*) 
00007ff85c742ae0 00007ff85c609688    JIT <Module>._initterm_m(Void* ()*, Void* ()*) 
00007ff85c60cc78 00007ff85c6096d8   NONE <Module>.DebugBreak() 
00007ff85c60cc80 00007ff85c609720   NONE <Module>.GetProcAddress() GetProcAddress(HINSTANCE__*, SByte*) 
00007ff85c60cc88 00007ff85c609768   NONE <Module>.GetLastError() 
00007ff85c60cc90 00007ff85c6097b0   NONE <Module>.LoadLibraryW(Char*) 
00007ff85c60cc98 00007ff85c6097f8   NONE <Module>.FreeLibrary(HINSTANCE__*) 
00007ff85c60d0b0 00007ff85c609840   NONE <Module>._getFiberPtrId() 
00007ff85c60d0e0 00007ff85c609888   NONE <Module>._amsg_exit(Int32) 
00007ff85c60d0d0 00007ff85c6098d0   NONE <Module>.__security_init_cookie() 
00007ff85c60d0c0 00007ff85c609918   NONE <Module>.Sleep(UInt32) 
00007ff85c60c9d8 00007ff85c609a30   NONE <Module>._cexit() 
00007ff85c60c9e8 00007ff85c609a78   NONE <Module>.__FrameUnwindFilter(_EXCEPTION_POINTERS*) 
```
 
DoNative 関数が出てきました。表示は抜粋していますが、内部で使われている関数の一覧が全部出てくるので興味深いですね。驚きなのは、 &lt;Module&gt;..cctor() というコンストラクターが存在することです。どうやら、&lt;Module&gt; というのはデバッガーが表示の便宜上適当に処理しているのではなく、本当にクラスとして存在しているようです。

 
### 3. call 命令はどうなっているか

 
C++/CLI といえど結局は全部マネージド コードとして扱えばよく、名前空間に所属しないシンボルも、&lt;Modules&gt; クラスの static メソッドとして扱えるのであれば、C# などと同じようにデバッグできそうです。最後に、もう少しマニアックに call 命令がどうなっているのかを見てみます。実用的な意味はないです。

 
```
0:000> k5 
Child-SP          RetAddr           Call Site 
000000be`0c5eecf8 00007ff8`c23d1026 KERNELBASE!DebugBreak+0x2 
000000be`0c5eed00 00007ff8`5c74598e NativeDll!NativeDllFunction+0x16 
000000be`0c5eed30 00007ff8`5c7457a4 0x00007ff8`5c74598e 
000000be`0c5eee60 00007ff8`5c745662 0x00007ff8`5c7457a4 
000000be`0c5eeeb0 00007ff8`5c743a1e 0x00007ff8`5c745662 
0:000> !name2ee cppclrlib!<Module>.DoNative 
Module:      00007ff85c6073d8 
Assembly:    cppclrlib.dll 
Token:       0000000006000001 
MethodDesc:  00007ff85c609170 
Name:        <Module>.DoNative(System.String ByRef) 
JITTED Code Address: 00007ff85c7458a0

0:000> !U 00007ff85c7458a0 
Normal JIT generated code 
<Module>.DoNative(System.String ByRef) 
Begin 00007ff85c7458a0, size 231 
>>> 00007ff8`5c7458a0 55              push    rbp 
00007ff8`5c7458a1 53              push    rbx 
00007ff8`5c7458a2 56              push    rsi 
00007ff8`5c7458a3 57              push    rdi 
00007ff8`5c7458a4 4154            push    r12 
00007ff8`5c7458a6 4155            push    r13 
00007ff8`5c7458a8 4156            push    r14 
00007ff8`5c7458aa 4157            push    r15 
00007ff8`5c7458ac 4881ece8000000  sub     rsp,0E8h 
00007ff8`5c7458b3 488d6c2420      lea     rbp,[rsp+20h] 
00007ff8`5c7458b8 488bc1          mov     rax,rcx 
(省略) 
00007ff8`5c7458da e81980ecff      call    00007ff8`5c60d8f8 (<Module>.LoadLibraryW(Char*), mdToken: 0000000006000054) 
00007ff8`5c7458df 48894500        mov     qword ptr [rbp],rax 
00007ff8`5c7458e3 4885c0          test    rax,rax 
00007ff8`5c7458e6 0f8454010000    je      00007ff8`5c745a40 
00007ff8`5c7458ec 488d154de9c363  lea     rdx,[cppclrlib!`string' (00007ff8`c0384240)] 
00007ff8`5c7458f3 488bc8          mov     rcx,rax 
00007ff8`5c7458f6 e81d80ecff      call    00007ff8`5c60d918 (<Module>.GetProcAddress() GetProcAddress(HINSTANCE__*, SByte*), mdToken: 0000000006000052) 
00007ff8`5c7458fb 48894508        mov     qword ptr [rbp+8],rax 
00007ff8`5c7458ff 4885c0          test    rax,rax 
00007ff8`5c745902 7535            jne     00007ff8`5c745939 
(省略) 
00007ff8`5c745939 488d4d30        lea     rcx,[rbp+30h] 
00007ff8`5c74593d e8a6f1615f      call    clr!JIT_InitPInvokeFrame (00007ff8`bbd64ae8) 
00007ff8`5c745942 48894570        mov     qword ptr [rbp+70h],rax 
00007ff8`5c745946 48896550        mov     qword ptr [rbp+50h],rsp 
00007ff8`5c74594a 48896d60        mov     qword ptr [rbp+60h],rbp 
00007ff8`5c74594e 48b97033261ebe000000 mov rcx,0BE1E263370h 
00007ff8`5c745958 488b09          mov     rcx,qword ptr [rcx] 
00007ff8`5c74595b 48894d10        mov     qword ptr [rbp+10h],rcx 
00007ff8`5c74595f 488d4d30        lea     rcx,[rbp+30h] 
00007ff8`5c745963 48894810        mov     qword ptr [rax+10h],rcx 
00007ff8`5c745967 488d0d20000000  lea     rcx,[00007ff8`5c74598e] 
00007ff8`5c74596e 48894d58        mov     qword ptr [rbp+58h],rcx 
00007ff8`5c745972 c7400c00000000  mov     dword ptr [rax+0Ch],0 
00007ff8`5c745979 488d9580000000  lea     rdx,[rbp+80h] 
00007ff8`5c745980 b914000000      mov     ecx,14h 
00007ff8`5c745985 4533db          xor     r11d,r11d 
00007ff8`5c745988 488b4508        mov     rax,qword ptr [rbp+8] 
00007ff8`5c74598c ffd0            call    rax 
00007ff8`5c74598e 894578          mov     dword ptr [rbp+78h],eax 
00007ff8`5c745991 488b4570        mov     rax,qword ptr [rbp+70h] 
00007ff8`5c745995 c7400c01000000  mov     dword ptr [rax+0Ch],1

0:000> x kernelbase!getprocaddress 
00007ff8`c4bd52ac KERNELBASE!GetProcAddress (<no parameter info>)

0:000> !name2ee cppclrlib!<Module>.GetProcAddress 
Module:      00007ff85c6073d8 
Assembly:    cppclrlib.dll 
Token:       0000000006000052 
MethodDesc:  00007ff85c609720 
Name:        <Module>.GetProcAddress() GetProcAddress(HINSTANCE__*, SByte*) 
Not JITTED yet. Use !bpmd -md 00007ff85c609720 to break on run.
```
 
NativeDll のブレークでいろいろ実行します。まずは DoNative のアセンブリ言語を見ます。uf だとうまく表示できないので、!U を使います。全部だと長いので、GetProcAddress で NativeDllFunction へのアドレスを取得して、それを実行するところを中心に抜粋しました。

 
マネージド関数であろうとネイティブであろうと、call は普通に near ジャンプです。GetProcAddress の部分は &lt;Module&gt;.GetProcAddress という関数へ飛ぶようなので、ネイティブと同じように、ジャンプ テーブル的なものを作って、ワンクッション置いてから目的のコードに辿り着くようです。

 
最後のコマンドで、&lt;Module&gt;.GetProcAddress はまだ JIT されていないと表示されました。既に NativeDllFunction まで辿り着いているのに、おかしな話です。これは cppclrlib.Class1.Run でも起きた現象ですが、インライン展開のようなことが起きているようです。

 
追いかけだすとキリがないので、今回はこの辺までで。

