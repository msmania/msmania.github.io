---
layout: post
title: "Boxing and Unboxing in C++/CLI"
date: 2014-07-14 16:05:22.000 +09:00
categories:
- Debug
- Windows
tags:
- Boxing
- C++/CLI
- SOS
---

C++/CLI のボックス化で見えにくい現象に遭遇したのでメモ。大昔に誰かが書いたコードがひどいだけですが。

 
こんなソースがありましたとさ。

 
```
// 
// cppclrtest.cpp 
//

#include <windows.h>

#pragma comment(lib, "ole32.lib")

using namespace System;

ref class BadClass { 
private: 
    UInt32 ^mUint32;

public: 
    BadClass() { 
        mUint32 = gcnew UInt32; 
    }

    UInt32 Run() { 
        // DebugBreak();

        *mUint32 = CoInitialize(NULL); 
        if (mUint32 == (UInt32)0x80010106) { 
            *mUint32 = 42; 
        }

        return *mUint32; 
    } 
};

void RunTest(String ^Str) { 
    if (Str == "HOGEHOGE") { 
        Console::WriteLine(L"Matched."); 
    }

    BadClass ^Class = gcnew BadClass(); 
    Console::WriteLine(L"BadClass.Run returned {0:x8}", Class->Run()); 
}

int main(array<System::String ^> ^args) { 
    RunTest("piyopiyo"); 
    return 0; 
} 
```
 
いろいろと突っ込みどころはありそうですが、少なくともコンパイル エラーも警告も出ません。手元の環境で実行するとこうなります。環境は Windows 8.1 x64 + Update 1 です。

 
```
D:\VSDev\Projects\cppclrtest\x64\Release> cppclrtest 
BadClass.Run returned 80010106
```
 
CoInitialize が 80010106 を返してエラーになるようです。この現象自体は以下の KB に合致しそうなので何でもないのですが、コードをパッと見るとおかしい感じがします。なぜ if 文に引っかかって 42 にならないのでしょう。

 
BUG: "HRESULT - 0x80010106" error occurs when you run a managed Visual C++ application in Visual Studio .NET <br />
[http://support.microsoft.com/kb/824480](http://support.microsoft.com/kb/824480)

 
実は、BadClass.Run にある if 文における左辺は UInt32^ で、右辺は UInt32 となっていて型が違っています。なぜコンパイラーに怒られないかというと、右辺がボックス化されるからでしょう。しかし、2 つの UInt32 オブジェクトの比較になり、ともに同じ値 80010106 を持っているので比較結果が true になってもよさそうなものです。

 
Boxing (C++/CLI) <br />
[http://msdn.microsoft.com/en-us/library/hh875061.aspx](http://msdn.microsoft.com/en-us/library/hh875061.aspx)

 
というわけでコメント アウトしておいた DebugBreak を有効にしてコンパイルされたコードを見てみます。

 
```
0:000> g 
ModLoad: 00007ffb`c69f0000 00007ffb`c6a24000   C:\Windows\system32\IMM32.DLL 
... 
ModLoad: 00007ffb`c4e10000 00007ffb`c4ec7000   C:\Windows\system32\OLEAUT32.dll 
(2494.103c): Break instruction exception - code 80000003 (first chance) 
KERNELBASE!DebugBreak+0x2: 
00007ffb`c46e9e3a cc              int     3 
0:000> .loadby sos clr 
0:000> !clrstack 
c0000005 Exception in C:\Windows\Microsoft.NET\Framework64\v4.0.30319\sos.clrstack debugger extension. 
      PC: 00007ffb`9e42d3f3  VA: 00000000`00000000  R/W: 0  Parameter: 00000000`00000000 
0:000> !clrstack 
OS Thread Id: 0x103c (0) 
        Child SP               IP Call Site 
000000907648e8a8 00007ffbc46e9e3a [InlinedCallFrame: 000000907648e8a8] <Module>.DebugBreak() 
000000907648e8a8 00007ffb5c42253a [InlinedCallFrame: 000000907648e8a8] <Module>.DebugBreak() 
000000907648e880 00007ffb5c42253a DomainBoundILStubClass.IL_STUB_PInvoke() 
000000907648e940 00007ffb5c42242b <Module>.RunTest(System.String) 
000000907648e9a0 00007ffb5c4220d5 <Module>.mainCRTStartupStrArray(System.String[]) 
000000907648ed00 00007ffbbba3a8b3 [GCFrame: 000000907648ed00] 
0:000> gu 
00007ffb`5c42253a 488b4540        mov     rax,qword ptr [rbp+40h] ss:00000090`7648e8e0=0000009076674360 
0:000> gu 
00007ffb`5c42242b 488b17          mov     rdx,qword ptr [rdi] ds:00000090`00003748=0000009000003758 
0:000> !U . 
Normal JIT generated code 
<Module>.RunTest(System.String) 
Begin 00007ffb5c422370, size 148 
00007ffb`5c422370 53              push    rbx 
00007ffb`5c422371 55              push    rbp 
... 
00007ffb`5c422413 e898ee605f      call    clr!JIT_WriteBarrier (00007ffb`bba312b0) 
00007ffb`5c422418 48bd5033001090000000 mov rbp,9010003350h 
00007ffb`5c422422 488b6d00        mov     rbp,qword ptr [rbp] 
00007ffb`5c422426 e855a5ecff      call    00007ffb`5c2ec980 (<Module>.DebugBreak(), mdToken: 0000000006000056) 
>>> 00007ffb`5c42242b 488b17          mov     rdx,qword ptr [rdi] 
00007ffb`5c42242e 488d0dc302015e  lea     rcx,[mscorlib_ni+0x7026f8 (00007ffb`ba4326f8)] 
00007ffb`5c422435 e8a68d615f      call    clr!JIT_Unbox (00007ffb`bba3b1e0) 
00007ffb`5c42243a 488bd8          mov     rbx,rax 
00007ffb`5c42243d 33c9            xor     ecx,ecx 
00007ffb`5c42243f e84ca5ecff      call    00007ffb`5c2ec990 (<Module>.CoInitialize(Void*), mdToken: 0000000006000057) 
00007ffb`5c422444 8903            mov     dword ptr [rbx],eax 
00007ffb`5c422446 488b1f          mov     rbx,qword ptr [rdi] 
00007ffb`5c422449 c744242406010180 mov     dword ptr [rsp+24h],80010106h 
00007ffb`5c422451 488d542424      lea     rdx,[rsp+24h] 
00007ffb`5c422456 488d0d9b02015e  lea     rcx,[mscorlib_ni+0x7026f8 (00007ffb`ba4326f8)] 
00007ffb`5c42245d e8eeff605f      call    clr!JIT_BoxFastMP_InlineGetThread (00007ffb`bba32450) 
00007ffb`5c422462 483bd8          cmp     rbx,rax 
00007ffb`5c422465 7515            jne     00007ffb`5c42247c 
00007ffb`5c422467 488bd3          mov     rdx,rbx 
00007ffb`5c42246a 488d0d8702015e  lea     rcx,[mscorlib_ni+0x7026f8 (00007ffb`ba4326f8)] 
00007ffb`5c422471 e86a8d615f      call    clr!JIT_Unbox (00007ffb`bba3b1e0) 
00007ffb`5c422476 c7002a000000    mov     dword ptr [rax],2Ah 
00007ffb`5c42247c 488b5608        mov     rdx,qword ptr [rsi+8] 
00007ffb`5c422480 488d0d7102015e  lea     rcx,[mscorlib_ni+0x7026f8 (00007ffb`ba4326f8)] 
00007ffb`5c422487 e8548d615f      call    clr!JIT_Unbox (00007ffb`bba3b1e0) 
00007ffb`5c42248c 8b08            mov     ecx,dword ptr [rax] 
00007ffb`5c42248e 894c2420        mov     dword ptr [rsp+20h],ecx 
00007ffb`5c422492 488d542420      lea     rdx,[rsp+20h] 
00007ffb`5c422497 488d0d5a02015e  lea     rcx,[mscorlib_ni+0x7026f8 (00007ffb`ba4326f8)] 
00007ffb`5c42249e e8adff605f      call    clr!JIT_BoxFastMP_InlineGetThread (00007ffb`bba32450) 
00007ffb`5c4224a3 488bd0          mov     rdx,rax 
00007ffb`5c4224a6 488bcd          mov     rcx,rbp 
00007ffb`5c4224a9 e85257e65d      call    mscorlib_ni+0x557c00 (00007ffb`ba287c00) (System.Console.WriteLine(System.String, System.Object), mdToken: 00000000060009a4) 
00007ffb`5c4224ae 90              nop 
00007ffb`5c4224af 4883c438        add     rsp,38h 
00007ffb`5c4224b3 5f              pop     rdi 
00007ffb`5c4224b4 5e              pop     rsi 
00007ffb`5c4224b5 5d              pop     rbp 
00007ffb`5c4224b6 5b              pop     rbx 
00007ffb`5c4224b7 c3              ret 
0:000> g 00007ffb`5c422444 
00007ffb`5c422444 8903            mov     dword ptr [rbx],eax ds:00000090`00003760=00000000 
0:000> r eax 
eax=80010106 
0:000> g 00007ffb`5c422462 
00007ffb`5c422462 483bd8          cmp     rbx,rax 
0:000> !do @rbx 
Name:        System.UInt32 
MethodTable: 00007ffbba4326f8 
EEClass:     00007ffbb9e02488 
Size:        24(0x18) bytes 
File:        C:\Windows\Microsoft.Net\assembly\GAC_64\mscorlib\v4.0_4.0.0.0__b77a5c561934e089\mscorlib.dll 
Fields: 
              MT    Field   Offset                 Type VT     Attr            Value Name 
00007ffbba4326f8  4000634        8        System.UInt32  1 instance       2147549446 m_value 
0:000> !do @rax 
Name:        System.UInt32 
MethodTable: 00007ffbba4326f8 
EEClass:     00007ffbb9e02488 
Size:        24(0x18) bytes 
File:        C:\Windows\Microsoft.Net\assembly\GAC_64\mscorlib\v4.0_4.0.0.0__b77a5c561934e089\mscorlib.dll 
Fields: 
              MT    Field   Offset                 Type VT     Attr            Value Name 
00007ffbba4326f8  4000634        8        System.UInt32  1 instance       2147549446 m_value 
0:000> p 
00007ffb`5c422465 7515            jne     00007ffb`5c42247c              [br=1] 
0:000> 
00007ffb`5c42247c 488b5608        mov     rdx,qword ptr [rsi+8] ds:00000090`00003748=0000009000003758 
0:000> g 
ntdll!NtTerminateProcess+0xa: 
00007ffb`c71bae4a c3              ret 
0:000> q 
quit: 
```
 
どうやら BadClass.Run がインライン展開されたようです。言い古されたネタでしょうが、デバッグする立場からすると厄介なものです。また、C++/CLI の特徴ですが、DebugBreak の呼び出しは &lt;Module&gt;.DebugBreak になっていて、KERNELBASE!DebugBreak にはヒットしないはずです。

 
さて、CoInitialize の後、青字で示した部分は戻り値を BadClass.mUint32 に代入する部分で、赤字がボックス化です。clr!JIT_BoxFastMP_InlineGetThread とかいうそれらしき関数でボックス化が行われるのでしょうかね。00007ffb`5c422462 の cmp で、左辺の mUint32 である rbx と、rax レジスターを比較しているところを見ると、JIT_BoxFastMP_InlineGetThread はボックス化したオブジェクトを戻り値として返すようです。

 
それぞれを !do コマンドで見ると、確かに System.UInt32 のオブジェクトになっていて、m_value の値は 2147549446 (=0x80010106) になっています。しかし、cmp はレジスタの値を比べているだけなので、つまりオブジェクト ハンドルの 64bit 値をそのまま比べているだけです。これでは if の結果は false になって当然ですね。

 
実際に遭遇したコードはもう少し規模が大きいわけですが、何といっても意味が分からないのは UInt32 のハンドルをクラスに持たせているところ。値を直接持たせた方がいいと思うのだが、ハンドル化するメリットが不明。あと、生成されたコードから分かるように、ボックス化/アンボックス化に伴う関数呼び出しが多発するのが無駄。特にボックス化はヒープにメモリを確保するのでコストが高いのは言うまでもないことです。

