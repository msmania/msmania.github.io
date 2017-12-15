---
layout: post
title: "[.NET] [Asm] Managed Code Debugging with SOS extension"
date: 2012-10-31 01:16:19.000 +09:00
categories:
- C#
- Debug
- Windows
tags:
- .NET
- SOS
- windbg
---

久々の更新です。ようやく .NET デバッグが実戦でも通用するレベルになってきたので、初歩を紹介します。もちろん .NET デバッグといっても Visual Studio を使うのではなく、ntsd やら windbg といった Windows デバッガーを使います。Windows デバッガーの利点としては、稼働環境へファイルをコピーするだけでいい、リモート デバッグが可能、Visual Studio より細かいことができる、などが挙げられます。コンピューターの動作を理解するのにも役立ちますし、慣れてくると Visual Studio より速くデバッグできるようになります。それと、デバッガーの黒い画面を開いて仕事をしていると、周りから見ても 「仕事をしている感」 が醸し出されて便利です。（なんだそれは

 
ただし、まだ .NET Framework の動きはほとんど理解しきれていないので、細かい説明は端折ります。そのうち覚えます。

 
.NET のデバッグを行うためには、SOS と呼ばれるデバッガー エクステンション DLL が必要になります。ただし、これは .NET Framework に含まれているので、別途ダウンロードする必要はありません。

 
%windir%\Microsoft.NET\Framework\&lt;.NET バージョン&gt;\SOS.dll <br />
%windir%\Microsoft.NET\Framework64\&lt;.NET バージョン&gt;\SOS.dll

 
SOS とは、"Son Of Strike" の略です。じゃあ Strike って何ぞ、という話ですが、これは以下のブログにそのエピソードが詳細に書かれています。もともと CLR 開発チームが "Lightning" という名前で作っていたものを、デバッガー エクステンションにしたときに "Strike" という名前に変えて、そこから一部のコードを取り除いたものだから "Son Of Strike" だそうです。

 
この記事には、そんな小話だけでなく SOS に関する非常に詳細な説明が書かれています。

 
SOS Debugging of the CLR, Part 1 - Jason Zander's blog - Site Home - MSDN Blogs <br />
[http://blogs.msdn.com/b/jasonz/archive/2003/10/21/53581.aspx](http://blogs.msdn.com/b/jasonz/archive/2003/10/21/53581.aspx)

 
MSDN だとこんなページもあります。

 
SOS.dll (SOS Debugging Extension) <br />
[http://msdn.microsoft.com/en-us/library/bb190764.aspx](http://msdn.microsoft.com/en-us/library/bb190764.aspx)

 
このブログでは、細かいことは抜きにして早速デバッグしてみましょう。シンボルの設定は必ず行って下さい。順番が逆ですが、デバッグ環境の作り方をそのうち記事にするかもしれません。

 
Use the Microsoft Symbol Server to obtain debug symbol files <br />
[http://support.microsoft.com/kb/311503/en](http://support.microsoft.com/kb/311503/en)

 
今回の検証環境はこんな感じです。 <br />
現時点で最新の環境を使っていますが、Windows 7 でも XP でも同じことができるはずです。

 
- OS: Windows Server 2012 
- CLR: 4.0.30319.18010 (.NET Framework 4.5) 
- IDE: Visual Studio 2012 
- Debugger: 6.2.9200.16384 (Windows Kit 8.0) 

 
まずは、適当なプログラムを書きます。C# です、お決まりですね。もちろん F# でもいいです。

 
```
using System; 
using System.IO;

namespace cssandbox { 
    class Program { 
        static void Main(string[] args) { 
            var Prog = new Program(); 
            Prog.Print(Console.Out); 
        }

        string mMessage1; 
        string mMessage2;

        Program() { 
            mMessage1 = "Hello!"; 
            Sub(); 
        }

        Program(string s) { 
            mMessage1 = s; 
            Sub(); 
        }

        void Sub() { 
            mMessage2 = DateTime.Now.ToString(); 
        }

        void Print(TextWriter Writer) { 
            Writer.WriteLine(mMessage1); 
            Writer.WriteLine(mMessage2); 
        }

    } 
} 
```
 
これを Debug 構成でビルドして、デバッガーから起動します。私は ntsd 派なのでこんな感じです。ntdll!LdrpDoDebuggerBreak で止まるはずで、これはネイティブ コードのデバッグと同じです。というか、まだこのタイミングでは CLR がロードされていないので、マネージド コードは存在しません。

 
![]({{site.assets_url}}2012-10-31-image.png)

 
```
Microsoft (R) Windows Debugger Version 6.2.9200.16384 X86 
Copyright (c) Microsoft Corporation. All rights reserved.

CommandLine: cssandbox.exe 
Symbol search path is: srv*d:\websymbols*http://msdl.microsoft.com/download/symbols 
Executable search path is: 
ModLoad: 005e0000 005e8000   cssandbox.exe 
ModLoad: 77820000 77977000   ntdll.dll 
ModLoad: 6f2f0000 6f33a000   C:\Windows\SysWOW64\MSCOREE.DLL 
ModLoad: 77630000 77760000   C:\Windows\SysWOW64\KERNEL32.dll 
ModLoad: 76f20000 76fc6000   C:\Windows\SysWOW64\KERNELBASE.dll 
(9a4.b10): Break instruction exception - code 80000003 (first chance) 
eax=00000000 ebx=00000003 ecx=be050000 edx=00000000 esi=00000000 edi=00000000 
eip=778c054d esp=0076f864 ebp=0076f890 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000246 
ntdll!LdrpDoDebuggerBreak+0x2b: 
778c054d cc              int     3 
0:000>
```
 
 

 
ここで重要なのが、CLR が動作するプラットフォームと、利用するデバッガーのプラットフォームを一致させておくことです。OS が 64 bit だったとしても、デバッグするアプリが 32bit で動作する場合は、32bit のデバッガーを使わないといけません。SOS.dll はデバッグ対象の CLR とバージョンとプラットフォームが一致していないと動かないのですが、当然 64bit のデバッガー プロセスから 32bit の SOS.dll をロードできないため、このような制限が生まれます。デバッガーを起動する前にデバッグ対象の動作プラットフォームを調べておきましょう。

 
## SOS のロード

 
SOS のロードで一番単純な方法は、以下のように SOS.dll のパスを直接指定する方法です。

 
```
0:000> .load C:\Windows\Microsoft.NET\Framework\v4.0.30319\SOS.dll
```
 
32bit デバッガーから 64bit の SOS を読もうとすると、以下のように怒られます。

 
```
0:000> .load C:\Windows\Microsoft.NET\Framework64\v4.0.30319\SOS.dll 
The call to LoadLibrary(C:\Windows\Microsoft.NET\Framework64\v4.0.30319\SOS.dll) failed, Win32 error 0n193 
    "%1 is not a valid Win32 application." 
Please check your debugger configuration and/or network access.
```
 
以上のようにプラットフォームの違いは判別されますが、.NET Framework バージョンの違いは判別されないので、以下のように .NET 2.0 の SOS はロードできてしまいます。これだと後々の SOS のコマンドが正しく動きません。

 
```
0:000> .load C:\Windows\Microsoft.NET\Framework\v2.0.50727\SOS.dll
```
 
いちいち .NET Framework のバージョンを調べるのが面倒くさい、という人のために .loadby というコマンドが存在します。こんな感じに使います。

 
```
0:000> sxe ld:clr 
0:000> g 
ModLoad: 6d500000 6db92000   C:\Windows\Microsoft.NET\Framework\v4.0.30319\clr.dll 
eax=00000000 ebx=00800000 ecx=00000000 edx=00000000 esi=00000000 edi=7e60d000 
eip=77860fe8 esp=0076f4e4 ebp=0076f53c iopl=0         nv up ei pl nz na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000206 
ntdll!NtMapViewOfSection+0xc: 
77860fe8 c22800          ret     28h 
0:000> .loadby sos clr
```
 
.loadby を使うと、指定したモジュールと同じところにある拡張 DLL をロードさせることができます。したがって、CLR.dll がロードされた後のタイミングで、clr.dll と同じところの SOS をロードすることで、適切なバージョンの SOS をロードすることができます。

 
デバッグするプログラムによっては clr で .loadby できず、代わりに mscoreei や mscorwks を使うことがあります。実現したいことは、CLR と同じ SOS をロードするだけなので、困ったら CLR のバージョンを調べて絶対パス指定で .load すれば OK です。

 
## ブレーク ポイント

 
デバッグは、ブレークポイントを設定するところから始まります。そんなわけで、前述のサンプル プログラムの Main 関数で止めてみましょう。ネイティブ コードと違って、x コマンドは使えません。

 
単純な方法は、SOS の !name2ee コマンドを使う方法です。一気にやるとこんな感じです。

 
```
0:000> sxe ld:clrjit 
0:000> g 
(9a4.b10): Unknown exception - code 04242420 (first chance) 
ModLoad: 6ee60000 6eece000   C:\Windows\Microsoft.NET\Framework\v4.0.30319\clrjit.dll 
eax=00000000 ebx=00800000 ecx=00000000 edx=00000000 esi=00000000 edi=7e60d000 
eip=77860fe8 esp=0076e5dc ebp=0076e634 iopl=0         nv up ei pl nz na po nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000202 
ntdll!NtMapViewOfSection+0xc: 
77860fe8 c22800          ret     28h 
0:000> !name2ee cssandbox!cssandbox.Program.Main 
Module:      008e2e94 
Assembly:    cssandbox.exe 
Token:       06000001 
MethodDesc:  008e37ac 
Name:        cssandbox.Program.Main(System.String[]) 
Not JITTED yet. Use !bpmd -md 008e37ac to break on run. 
0:000> !bpmd -md 008e37ac 
MethodDesc = 008e37ac 
Adding pending breakpoints... 
0:000> g 
(9a4.b10): CLR notification exception - code e0444143 (first chance) 
JITTED cssandbox!cssandbox.Program.Main(System.String[]) 
Setting breakpoint: bp 00AA0077 [cssandbox.Program.Main(System.String[])] 
Breakpoint 0 hit 
eax=00000000 ebx=0076f31c ecx=024a22cc edx=00000000 esi=00000000 edi=0076f290 
eip=00aa0077 esp=0076f264 ebp=0076f278 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000246 
00aa0077 90              nop 
0:000>  
```
 
ブレークポイントを設定するのに使いたいコマンドは !bpmd です。bp コマンドは、メモリにロードされているコードのアドレスを直接指定しますが、上記の例では、!name2ee コマンドを使って取得した Method Descriptor という値を使ってブレーク ポイントを設定しています。

 
コマンドの出力にもありますが、.NET の大きな特徴として、実行時 (JIT) コンパイルが行われることが挙げられます。当然、まだコンパイルされていないメソッドに対して bp コマンドは使えません。そこで、Method Descriptor を間接的に使ってブレークポイントを設定するわけです。Method Descriptor や EEClass といった CLR の内部構造については、以下の記事などを参考にして下さい。まだよく知らないのですわ・・・スミマセン。

 
JIT and Run: .NET Framework の内部: CLR がランタイム オブジェクトを作成するしくみ -- MSDN Magazine, 2005 年 5 月 <br />
 [http://msdn.microsoft.com/ja-jp/magazine/ee216336.aspx](http://msdn.microsoft.com/ja-jp/magazine/ee216336.aspx)

 
アプリケーションを起動して clr.dll がロード直後のタイミングでは、CLR の内部構造がほとんど何もできていないので、!name2ee すら実行することができず、以下のようなエラーが出ます。

 
```
0:000> !name2ee cssandbox!cssandbox.Program.Main 
Failed to obtain AppDomain data. 
Failed to request module list.
```
 
そこで今回は、clrjit.dll がロードされるタイミングを sxe で止めて、そのときに !name2ee を実行しました。

 
!bpmd した後の出力結果を見ると、JIT されたタイミングで bp コマンドが実行されているのが分かります（紫字部分）。JIT されてしまえば、ネイティブ コードと同じように扱うことができます。ただし、コンパイルされたコードはネイティブのものとは微妙に印象が異なるのが面白いところです。

 
ブレークポイントで止まっている状態で、以下のコマンドを実行してみます。

 
```
0:000> bl 
0 e 00aa0077     0001 (0001)  0:**** 
0:000> !name2ee cssandbox!cssandbox.Program.Main 
Module:      008e2e94 
Assembly:    cssandbox.exe 
Token:       06000001 
MethodDesc:  008e37ac 
Name:        cssandbox.Program.Main(System.String[]) 
JITTED Code Address: 00aa0050 
0:000> r 
eax=00000000 ebx=0076f31c ecx=024a22cc edx=00000000 esi=00000000 edi=0076f290 
eip=00aa0077 esp=0076f264 ebp=0076f278 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000246 
00aa0077 90              nop 
0:000> k 
ChildEBP RetAddr 
WARNING: Frame IP not in any known module. Following frames may be wrong. 
0076f278 6d502652 0xaa0077 
0076f284 6d51264f clr!CallDescrWorkerInternal+0x34 
0076f2d8 6d512e95 clr!CallDescrWorkerWithHandler+0x6b 
0076f350 6d5c74ec clr!MethodDescCallSite::CallTargetWorker+0x152 
0076f47c 6d5c7610 clr!RunMain+0x1aa 
0076f6f0 6d651dc4 clr!Assembly::ExecuteMainMethod+0x124 
0076fbf4 6d651e67 clr!SystemDomain::ExecuteMainMethod+0x614 
0076fc50 6d651f7a clr!ExecuteEXE+0x4c 
0076fc90 6d65416a clr!_CorExeMainInternal+0xdc 
0076fccc 6f27f5a3 clr!_CorExeMain+0x4d 
0076fd04 6f2f7efd mscoreei!_CorExeMain+0x10a 
0076fd1c 6f2f4de3 MSCOREE!ShellShim__CorExeMain+0x7d 
0076fd24 77658543 MSCOREE!_CorExeMain_Exported+0x8 
0076fd30 7787ac69 KERNEL32!BaseThreadInitThunk+0xe 
0076fd74 7787ac3c ntdll!__RtlUserThreadStart+0x72 
0076fd8c 00000000 ntdll!_RtlUserThreadStart+0x1b 
```
 
まず、!bpmd によって自動的に bp コマンドが実行されたので、bl で確認できます。!name2ee コマンドを実行すると、JIT されたコードが 00aa0050 にロードされていることが分かります。bp された場所と若干ずれていますね。本当は 00aa0077 ではなく 00aa0050 で止まってほしいところです。止めたいところを !name2ee で調べて、JIT されていれば、bp コマンドを手動で打つこともできます。

 
また、r や k といったいつものコマンドも使うことができます。ただし、0xaa0077 のアドレスなどはシンボル名で解決されていません。スタックを見ると、clr.dll から cssandbox.exe が呼ばれていることが分かります。ステップ実行もできます。

 
## 変数を見る

 
目的の所で止めたら、変数の値を見たくなります。頑張れば dd コマンドを使えないこともないですが、.NET オブジェクトについては、SOS のエクステンションに頼ることになります。

 
cssandbox.exe に適当なパラメーターを指定して起動し、args の値を見る場合の例を示します。

 
```
Microsoft (R) Windows Debugger Version 6.2.9200.16384 X86 
Copyright (c) Microsoft Corporation. All rights reserved.

CommandLine: cssandbox.exe ABCD 漢字 
Symbol search path is: srv*d:\websymbols*http://msdl.microsoft.com/download/symbols 
Executable search path is: 
ModLoad: 00af0000 00af8000   cssandbox.exe 
ModLoad: 77820000 77977000   ntdll.dll 
ModLoad: 6f2f0000 6f33a000   C:\Windows\SysWOW64\MSCOREE.DLL 
ModLoad: 77630000 77760000   C:\Windows\SysWOW64\KERNEL32.dll 
ModLoad: 76f20000 76fc6000   C:\Windows\SysWOW64\KERNELBASE.dll 
(11a4.cf0): Break instruction exception - code 80000003 (first chance) 
eax=00000000 ebx=00000003 ecx=18f00000 edx=00000000 esi=00000000 edi=00000000 
eip=778c054d esp=00c7f76c ebp=00c7f798 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000246 
ntdll!LdrpDoDebuggerBreak+0x2b: 
778c054d cc              int     3 
0:000> sxe ld:clrjit 
0:000> g 
(11a4.cf0): Unknown exception - code 04242420 (first chance) 
ModLoad: 6ee60000 6eece000   C:\Windows\Microsoft.NET\Framework\v4.0.30319\clrjit.dll 
eax=00000000 ebx=00800000 ecx=00000000 edx=00000000 esi=00000000 edi=7ef7d000 
eip=77860fe8 esp=00c7e4ec ebp=00c7e544 iopl=0         nv up ei pl nz na po nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000202 
ntdll!NtMapViewOfSection+0xc: 
77860fe8 c22800          ret     28h 
0:000> .loadby sos clr 
0:000> !bpmd cssandbox.exe cssandbox.Program.Main 
Found 1 methods in module 00d72e94... 
MethodDesc = 00d737ac 
Adding pending breakpoints... 
0:000> g 
(11a4.cf0): CLR notification exception - code e0444143 (first chance) 
JITTED cssandbox!cssandbox.Program.Main(System.String[]) 
Setting breakpoint: bp 01220077 [cssandbox.Program.Main(System.String[])] 
Breakpoint 0 hit 
eax=00000000 ebx=00c7f22c ecx=02d122cc edx=00000000 esi=00000000 edi=00c7f1a0 
eip=01220077 esp=00c7f174 ebp=00c7f188 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000246 
01220077 90              nop 
0:000> !dso 
OS Thread Id: 0xcf0 (0) 
ESP/REG  Object   Name 
ecx      02d122cc System.Object[]    (System.String[]) 
00C7F184 02d122cc System.Object[]    (System.String[]) 
00C7F200 02d122cc System.Object[]    (System.String[]) 
00C7F35C 02d122cc System.Object[]    (System.String[]) 
00C7F394 02d122cc System.Object[]    (System.String[]) 
0:000> !da 02d122cc 
Name:        System.String[] 
MethodTable: 6c8eae88 
EEClass:     6c5abb70 
Size:        24(0x18) bytes 
Array:       Rank 1, Number of elements 2, Type CLASS 
Element Methodtable: 6c93afb0 
[0] 02d122e4 
[1] 02d122fc 
0:000> !do 02d122e4 
Name:        System.String 
MethodTable: 6c93afb0 
EEClass:     6c54486c 
Size:        22(0x16) bytes 
File:        C:\Windows\Microsoft.Net\assembly\GAC_32\mscorlib\v4.0_4.0.0.0__b77a5c561934e089\mscorl 
ib.dll 
String:      ABCD 
Fields: 
      MT    Field   Offset                 Type VT     Attr    Value Name 
6c93c770  40000aa        4         System.Int32  1 instance        4 m_stringLength 
6c93b9a8  40000ab        8          System.Char  1 instance       41 m_firstChar 
6c93afb0  40000ac        c        System.String  0   shared   static Empty 
    >> Domain:Value  010234f0:NotInit  << 
0:000> !do -nofields 02d122fc 
Name:        System.String 
MethodTable: 6c93afb0 
EEClass:     6c54486c 
Size:        18(0x12) bytes 
File:        C:\Windows\Microsoft.Net\assembly\GAC_32\mscorlib\v4.0_4.0.0.0__b77a5c561934e089\mscorl 
ib.dll 
String:      漢字 
0:000> 
```
 
Main 関数で止めた後、!dso と !do コマンドを呼び出しています。!dso は、スタックに積まれているオブジェクトの一覧を表示するもので、!do はオブジェクトを表示するコマンドです。.オブジェクトが型情報を持っているので、dt と違って型を明示する必要がなくて便利です。dynamic 型でやるとどうなるんですかね。配列の場合は !do ではなく !da を使います。

 
!dso の結果を見ると args の値が ecx レジスターに入っています。実際、.NET のメソッドは fastcall で呼ばれるようです。

 
## アセンブラを見る

 
!bpmd を使えばメソッドの先頭で止めることができますが、メソッドの途中で止める場合には、JIT されたコードのアセンブラを見ないといけません。ネイティブと同じように u や uf コマンドを使うことができます。例えば Main メソッドのアセンブラを uf で見るとこんな感じです。

 
```
0:000> !name2ee cssandbox cssandbox.Program.Main 
Module:      00d72e94 
Assembly:    cssandbox.exe 
Token:       06000001 
MethodDesc:  00d737ac 
Name:        cssandbox.Program.Main(System.String[]) 
JITTED Code Address: 01220050 
0:000> uf 01220050 
01220050 55              push    ebp 
01220051 8bec            mov     ebp,esp 
01220053 83ec14          sub     esp,14h 
01220056 33c0            xor     eax,eax 
01220058 8945f4          mov     dword ptr [ebp-0Ch],eax 
0122005b 8945f0          mov     dword ptr [ebp-10h],eax 
0122005e 8945ec          mov     dword ptr [ebp-14h],eax 
01220061 894dfc          mov     dword ptr [ebp-4],ecx 
01220064 833d6031d70000  cmp     dword ptr ds:[0D73160h],0 
0122006b 7405            je      01220072

0122006d e84270576c      call    clr!JIT_DbgIsJustMyCode (6d7970b4)

01220072 33d2            xor     edx,edx 
01220074 8955f8          mov     dword ptr [ebp-8],edx 
01220077 90              nop 
01220078 b9f037d700      mov     ecx,0D737F0h 
0122007d e87e20b4ff      call    00d62100 
01220082 8945f4          mov     dword ptr [ebp-0Ch],eax 
01220085 8b4df4          mov     ecx,dword ptr [ebp-0Ch] 
01220088 ff151038d700    call    dword ptr ds:[0D73810h] 
0122008e 8b45f4          mov     eax,dword ptr [ebp-0Ch] 
01220091 8945f8          mov     dword ptr [ebp-8],eax 
01220094 8b45f8          mov     eax,dword ptr [ebp-8] 
01220097 8945f0          mov     dword ptr [ebp-10h],eax 
0122009a e875d3686b      call    mscorlib_ni+0x36d414 (6c8ad414) 
0122009f 8945ec          mov     dword ptr [ebp-14h],eax 
012200a2 8b4df0          mov     ecx,dword ptr [ebp-10h] 
012200a5 8b55ec          mov     edx,dword ptr [ebp-14h] 
012200a8 3909            cmp     dword ptr [ecx],ecx 
012200aa ff15e037d700    call    dword ptr ds:[0D737E0h] 
012200b0 90              nop 
012200b1 90              nop 
012200b2 8be5            mov     esp,ebp 
012200b4 5d              pop     ebp 
012200b5 c3              ret 
0:000> 
```
 
いやー、硬派ですね。というのも、ほとんどの call 命令のオペランドが生アドレスだからでしょうか。

 
実は、アセンブラを見る時も SOS に頼ることができます。それが !U です。また、プライベート シンボルがある場合には、.lines を使うことでネイティブ コードと同じように行番号を表示させることができます。こんな感じです。

 
```
0:000> .lines 
Line number information will be loaded 
0:000> !U . 
Normal JIT generated code 
cssandbox.Program.Main(System.String[]) 
Begin 01220050, size 66

d:\VSDev\Projects\cssandbox\Program.cs @ 11: 
01220050 55              push    ebp 
01220051 8bec            mov     ebp,esp 
01220053 83ec14          sub     esp,14h 
01220056 33c0            xor     eax,eax 
01220058 8945f4          mov     dword ptr [ebp-0Ch],eax 
0122005b 8945f0          mov     dword ptr [ebp-10h],eax 
0122005e 8945ec          mov     dword ptr [ebp-14h],eax 
01220061 894dfc          mov     dword ptr [ebp-4],ecx 
01220064 833d6031d70000  cmp     dword ptr ds:[0D73160h],0 
0122006b 7405            je      01220072 
0122006d e84270576c      call    clr!JIT_DbgIsJustMyCode (6d7970b4) 
01220072 33d2            xor     edx,edx 
01220074 8955f8          mov     dword ptr [ebp-8],edx 
>>> 01220077 90              nop

d:\VSDev\Projects\cssandbox\Program.cs @ 12: 
01220078 b9f037d700      mov     ecx,0D737F0h (MT: cssandbox.Program) 
0122007d e87e20b4ff      call    00d62100 (JitHelp: CORINFO_HELP_NEWSFAST) 
01220082 8945f4          mov     dword ptr [ebp-0Ch],eax 
01220085 8b4df4          mov     ecx,dword ptr [ebp-0Ch] 
01220088 ff151038d700    call    dword ptr ds:[0D73810h] (cssandbox.Program..ctor(), mdToken: 06000002) 
0122008e 8b45f4          mov     eax,dword ptr [ebp-0Ch] 
01220091 8945f8          mov     dword ptr [ebp-8],eax

d:\VSDev\Projects\cssandbox\Program.cs @ 13: 
01220094 8b45f8          mov     eax,dword ptr [ebp-8] 
01220097 8945f0          mov     dword ptr [ebp-10h],eax 
0122009a e875d3686b      call    mscorlib_ni+0x36d414 (6c8ad414) (System.Console.get_Out(), mdToken: 06000945) 
0122009f 8945ec          mov     dword ptr [ebp-14h],eax 
012200a2 8b4df0          mov     ecx,dword ptr [ebp-10h] 
012200a5 8b55ec          mov     edx,dword ptr [ebp-14h] 
012200a8 3909            cmp     dword ptr [ecx],ecx 
012200aa ff15e037d700    call    dword ptr ds:[0D737E0h] (cssandbox.Program.Print(System.IO.TextWriter), mdToken: 06000005) 
012200b0 90              nop

d:\VSDev\Projects\cssandbox\Program.cs @ 14: 
012200b1 90              nop 
012200b2 8be5            mov     esp,ebp 
012200b4 5d              pop     ebp 
012200b5 c3              ret 
0:000> 
```
 
かなり読みやすくなりました。

 
## コンストラクターについて

 
上のアセンブラで call 命令の部分を見ると、cssandbox.Program..ctor() というメソッドを呼び出す箇所があることに気づきます。コードを見ればすぐに分かりますが、これはコンストラクターです。コンストラクターは、内部的に .ctor というメソッドとして扱われるようです。ctor の先頭のドットも含めてメソッド名なので、完全修飾名にするとドットが連続する不思議な名前になります。

 
当然、!name2ee で Method Descriptor を見つけることもできます。Program.Program や Program.new のような名前では検索できないことを確認して下さい。今回は 2 つのコンストラクターをオーバーロードしていますので、両方とも検出され、パラメーターの種類も出してくれます。

 
```
0:000> !name2ee cssandbox cssandbox.Program.Program 
Module:      00d72e94 
Assembly:    cssandbox.exe 
0:000> !name2ee cssandbox cssandbox.Program.new 
Module:      00d72e94 
Assembly:    cssandbox.exe 
0:000> !name2ee cssandbox cssandbox.Program..ctor 
Module:      00d72e94 
Assembly:    cssandbox.exe 
Token:       06000002 
MethodDesc:  00d737b8 
Name:        cssandbox.Program..ctor() 
Not JITTED yet. Use !bpmd -md 00d737b8 to break on run. 
----------------------- 
Token:       06000003 
MethodDesc:  00d737c0 
Name:        cssandbox.Program..ctor(System.String) 
Not JITTED yet. Use !bpmd -md 00d737c0 to break on run. 
0:000>
```
