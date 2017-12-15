---
layout: post
title: "Microsoft Research Detours Express 3.0"
date: 2014-11-29 04:55:15.000 +09:00
categories:
- C/C++
- Debug
- Windows
tags:
- detours
- nmake
---

前から使ってみようと思っていて実際に手をつけていなかった Detours をちょっと触ってみました。と言いつつ、実際は 2 ヶ月ほど前に少し書き溜めていたものを、Thanksgiving の連休でようやく手を付ける時間ができてバックログを減らしている、という状況です。

 
Detours とは、ユーザーモードの任意の関数呼び出しをフックするための static library です。現在の最新バージョンは 3.0 ですが、Microsoft Research から論文が出たのが 1999 年なので、Windows NT の頃から存在していたのでしょうか。古い。

 
Detours - Microsoft Research <br />
[http://research.microsoft.com/en-us/projects/detours/](http://research.microsoft.com/en-us/projects/detours/)

 
Download Detours - Microsoft Research <br />
[http://research.microsoft.com/en-us/downloads/d36340fb-4d3c-4ddd-bf5b-1db25d03713d/](http://research.microsoft.com/en-us/downloads/d36340fb-4d3c-4ddd-bf5b-1db25d03713d/)

 
Detours は Express と Professional の 2 種類あり、Professional だと、製品に組み込んでそれを販売することも可能なようです。あと、ネイティブの 64bit をサポートしている。なんとお値段、$9,999.95！たけー。SQL Server の Standard ですら $3,000 ぐらいなのに。

 
Microsoft Detours v3 Professional Download, instrumenting Win32 functions - Microsoft Store <br />
[http://www.microsoftstore.com/store/msusa/en_US/pdp/Microsoft-Research-Detours-v3-Professional/productID.253663300](http://www.microsoftstore.com/store/msusa/en_US/pdp/Microsoft-Research-Detours-v3-Professional/productID.253663300)

 
Express は安心の 0 円です。

 
ダウンロードしたファイルは msi 形式ですが、中身を解凍しているだけなので、 msiexec を直接実行して、ファイルを解凍してしまいます。

 
```
C:\MSWORK>start /wait msiexec /a DetoursExpress30.msi targetdir=C:\MSWORK\DetoursExpress30 /q
```
 
![]({{site.assets_url}}2014-11-29-image.png)

 
とりあえず README.txt を読むと、"4. CHANGES IN VERSION 3.0:" のところに "* Support for mixing 32-bit and 64-bit processes." と書いてあります。これは意味不明。32bit と 64bit なんてミックスできないじゃん。WOW64 のことでしょうかね。確かに結果的には WOW64 で動きました。

 
今回は以下の環境を使います。

 
- OS: Windows 8.1 SP1 x64 
- IDE: Visual Studio 2013 

 
README.txt によると、そのまま nmake できるらしいので実行してみます。"VS2013 x86 Native Tools Command Prompt" のプロンプトを開いて nmake を実行するだけです。

 
```
C:\Program Files (x86)\Microsoft Visual Studio 12.0\VC>cd /d C:\MSWORK\DetoursExpress30  
  
C:\MSWORK\DetoursExpress30>nmake  
  
Microsoft (R) Program Maintenance Utility Version 12.00.21005.1  
Copyright (C) Microsoft Corporation.  All rights reserved.  
  
        cd "C:\MSWORK\DetoursExpress30\src"  
Created ..\include  
Created ..\lib.X86  
Created ..\bin.X86  
Created obj.X86  
        cl /W4 /WX /Zi /MTd /Gy /Gm- /Zl /Od /DDETOURS_BITS=32 /DWIN32_LEAN_AND_MEAN /D_WIN32_WINNT=0x403 /Gs /DDETOURS_X86=1 /DDETOURS_32BIT=1 /D_X86_ /DDETOURS_OPTION_BITS=64 /Fd..\lib.X86\detours.pdb /Foobj.X86\detours.obj /c .\detours.cpp  
Microsoft (R) C/C++ Optimizing Compiler Version 18.00.21005.1 for x86  
Copyright (C) Microsoft Corporation.  All rights reserved.  
  
detours.cpp  
  
<...snip...>  
  
        cl /nologo /Zi /MT /Gm- /W4 /WX /Od /DDETOURS_BITS=32 /I..\..\include /Gs /DDETOURS_X86=1 /DDETOURS_32BIT=1 /D_X86_ /DDETOURS_OPTION_BITS=64 /Fe..\..\bin.X86\symtest.exe /Fd..\..\bin.X86\symtest.pdb obj.X86\symtest.obj  /link /release /incremental:no /machine:x86 ..\..\lib.X86\syelog.lib ..\..\lib.X86\detours.lib  kernel32.lib gdi32.lib user32.lib shell32.lib  /subsystem:console /incremental:no /fixed:no ..\..\bin.X86\target32.lib  
        copy "C:\Program Files (x86)\Microsoft Visual Studio 12.0\Common7\IDE\dbghelp.dll" ..\..\bin.X86\dbghelp.dll  
        1 file(s) copied.  
        cd "C:\MSWORK\DetoursExpress30\samples\member"  
Created obj.X86  
        cl /nologo /nologo /Zi /MT /Gm- /W4 /WX /Od /DDETOURS_BITS=32 /I..\..\include /Gs /DDETOURS_X86=1 /DDETOURS_32BIT=1 /D_X86_ /DDETOURS_OPTION_BITS=64 /Fdobj.X86\vc.pdb /Foobj.X86\member.obj /c  
member.cpp  
member.cpp  
member.cpp(88) : error C2440: 'type cast' : cannot convert from 'void (__thiscall CMember::* )(void)' to 'PBYTE &'  
        Reason: cannot convert from 'overloaded-function' to 'PBYTE *'  
        There is no context in which this conversion is possible  
member.cpp(88) : error C2660: 'Verify' : function does not take 1 arguments  
member.cpp(90) : error C2440: 'type cast' : cannot convert from 'void (__thiscall CDetour::* )(void)' to 'PBYTE &'  
        Reason: cannot convert from 'overloaded-function' to 'PBYTE *'  
        There is no context in which this conversion is possible  
member.cpp(90) : error C2660: 'Verify' : function does not take 1 arguments  
member.cpp(105) : error C2440: 'type cast' : cannot convert from 'void (__thiscall CDetour::* )(void)' to 'PVOID &'  
        Reason: cannot convert from 'overloaded-function' to 'PVOID *'  
        There is no context in which this conversion is possible  
member.cpp(105) : error C2660: 'DetourAttach' : function does not take 1 arguments  
member.cpp(120) : error C2440: 'type cast' : cannot convert from 'void (__thiscall CMember::* )(void)' to 'PBYTE &'  
        Reason: cannot convert from 'overloaded-function' to 'PBYTE *'  
        There is no context in which this conversion is possible  
member.cpp(120) : error C2660: 'Verify' : function does not take 1 arguments  
member.cpp(122) : error C2440: 'type cast' : cannot convert from 'void (__thiscall CDetour::* )(void)' to 'PBYTE &'  
        Reason: cannot convert from 'overloaded-function' to 'PBYTE *'  
        There is no context in which this conversion is possible  
member.cpp(122) : error C2660: 'Verify' : function does not take 1 arguments  
NMAKE : fatal error U1077: '"C:\Program Files (x86)\Microsoft Visual Studio 12.0\VC\BIN\cl.EXE"' : return code '0x2'  
Stop.  
NMAKE : fatal error U1077: '"C:\Program Files (x86)\Microsoft Visual Studio 12.0\VC\BIN\nmake.exe"': return code '0x2'  
Stop.  
NMAKE : fatal error U1077: '"C:\Program Files (x86)\Microsoft Visual Studio 12.0\VC\BIN\nmake.exe"': return code '0x2'  
Stop.  
  
C:\MSWORK\DetoursExpress30>  
```
 
おーん、コンパイル エラー C2440。samples\member\member.cpp の該当箇所はこうなっています。

 
```
#if (_MSC_VER < 1310)  
    pfTarget = CMember::Target;  
    pfMine = CDetour::Mine_Target;  
  
    Verify("CMember::Target", *(PBYTE*)&pfTarget);  
    Verify("*CDetour::Real_Target", *(&(PBYTE&)CDetour::Real_Target));  
    Verify("CDetour::Mine_Target", *(PBYTE*)&pfMine);  
#else  
    Verify("CMember::Target", (PBYTE)(&(PBYTE&)CMember::Target));  
    Verify("*CDetour::Real_Target", *(&(PBYTE&)CDetour::Real_Target));  
    Verify("CDetour::Mine_Target", (PBYTE)(&(PBYTE&)CDetour::Mine_Target));  
#endif  
```
 
Visual Studio 2013 なので \_MSC_VER は 1800 ですが、\_MSC_VER&lt;1310 のときのコードも含めて何か奇妙です。Verify の第二引数は PVOID なので、メンバー関数へのポインターを void* に変換するのが目的ですが、いずれの条件でも参照型が出てきているのが不思議なところです。それ以前に、リテラルの CMember::Target って頭に & つけなくても動いたっけ、という疑問も。

 
C++ について新たに覚えたこともあったので、詳細は別記事にまとめるとして、結果的には Detours のコードが間違っていました。古い Visual Studio だと動くのかもしれません。今回は、以下のように \_MSC_VER &gt;=1700 のときの条件を members.cpp に追加 (青字部分) することにしました。\_MSC_VER=1700 である Visual Studio 2010 でも同様のコンパイル エラーが出ます。2008 や 2005 でも同じだと思いますが、確認していないので 1700 以上にしました。

 
```
#if (_MSC_VER < 1310)  
    void (CMember::* pfTarget)(void) = CMember::Target;  
    void (CDetour::* pfMine)(void) = CDetour::Mine_Target;  
  
    Verify("CMember::Target", *(PBYTE*)&pfTarget);  
    Verify("*CDetour::Real_Target", *(PBYTE*)&CDetour::Real_Target);  
    Verify("CDetour::Mine_Target", *(PBYTE*)&pfMine);  
#elif (_MSC_VER >= 1700)  
    void (CMember::* pfTarget)(void) = &CMember::Target;  
    void (CDetour::* pfMine)(void) = &CDetour::Mine_Target;  
  
    Verify("CMember::Target", (PBYTE*&)pfTarget);  
    Verify("*CDetour::Real_Target", (PBYTE*&)CDetour::Real_Target);  
    Verify("CDetour::Mine_Target", (PBYTE*&)pfMine);  
#else  
    Verify("CMember::Target", (PBYTE)(&(PBYTE&)CMember::Target));  
    Verify("*CDetour::Real_Target", *(&(PBYTE&)CDetour::Real_Target));  
    Verify("CDetour::Mine_Target", (PBYTE)(&(PBYTE&)CDetour::Mine_Target));  
#endif  
  
    printf("\n");  
  
    DetourTransactionBegin();  
    DetourUpdateThread(GetCurrentThread());  
  
#if (_MSC_VER < 1310)  
    pfMine = CDetour::Mine_Target;  
  
    DetourAttach(&(PVOID&)CDetour::Real_Target,  
                 *(PBYTE*)&pfMine);  
#elif (_MSC_VER >= 1700)  
    pfMine = &CDetour::Mine_Target;  
  
    DetourAttach(&(PVOID&)CDetour::Real_Target,  
                 (PBYTE&)pfMine);  
#else  
    DetourAttach(&(PVOID&)CDetour::Real_Target,  
                 (PVOID)(&(PVOID&)CDetour::Mine_Target));  
#endif  
  
    LONG l = DetourTransactionCommit();  
    printf("DetourTransactionCommit = %d\n", l);  
    printf("\n");  
  
#if (_MSC_VER < 1310)  
    pfTarget = CMember::Target;  
    pfMine = CDetour::Mine_Target;  
  
    Verify("CMember::Target", *(PBYTE*)&pfTarget);  
    Verify("*CDetour::Real_Target", *(&(PBYTE&)CDetour::Real_Target));  
    Verify("CDetour::Mine_Target", *(PBYTE*)&pfMine);  
#elif (_MSC_VER >= 1700)  
    pfTarget = &CMember::Target;  
    pfMine = &CDetour::Mine_Target;  
  
    Verify("CMember::Target", (PBYTE*&)pfTarget);  
    Verify("*CDetour::Real_Target", (PBYTE*&)CDetour::Real_Target);  
    Verify("CDetour::Mine_Target", (PBYTE*&)pfMine);  
#else  
    Verify("CMember::Target", (PBYTE)(&(PBYTE&)CMember::Target));  
    Verify("*CDetour::Real_Target", *(&(PBYTE&)CDetour::Real_Target));  
    Verify("CDetour::Mine_Target", (PBYTE)(&(PBYTE&)CDetour::Mine_Target));  
#endif  
```
 
Visual Studio 2010/Windows 7 はこれでビルドが通ります。Windows 8 以降の場合は、GetVersion API が古いということで、traceapi\_win32.cpp において C4996 の警告が出ます。

 
```
        cl /nologo /nologo /Zi /MT /Gm- /W4 /WX /Od /DDETOURS_BITS=32 /I..\..\include /Gs /DDETOURS_X86=1 /DDETOURS_32BIT=1 /D_X86_ /DDETOURS_OPTION_BITS=64 /Fdobj.X86\vc.pdb /Foobj.X86\trcapi.obj /ctrcapi.cpp trcapi.cpp  
c:\mswork\detoursexpress30\samples\traceapi\_win32.cpp(4415) : error C2220: warning treated as error - no 'object' file generated  
c:\mswork\detoursexpress30\samples\traceapi\_win32.cpp(4415) : warning C4996: 'GetVersion': was declared deprecated  
        C:\Program Files (x86)\Windows Kits\8.1\include\um\sysinfoapi.h(110) : see declaration of 'GetVersion'  
c:\mswork\detoursexpress30\samples\traceapi\_win32.cpp(4418) : warning C4996: 'GetVersionExA': was declared deprecated  
        C:\Program Files (x86)\Windows Kits\8.1\include\um\sysinfoapi.h(433) : see declaration of 'GetVersionExA'  
c:\mswork\detoursexpress30\samples\traceapi\_win32.cpp(4421) : warning C4996: 'GetVersionExW': was declared deprecated  
        C:\Program Files (x86)\Windows Kits\8.1\include\um\sysinfoapi.h(442) : see declaration of 'GetVersionExW'  
NMAKE : fatal error U1077: '"C:\Program Files (x86)\Microsoft Visual Studio 12.0\VC\BIN\cl.EXE"' : return code '0x2'  
Stop.  
NMAKE : fatal error U1077: '"C:\Program Files (x86)\Microsoft Visual Studio 12.0\VC\BIN\nmake.exe"' : return code '0x2'  
Stop.  
NMAKE : fatal error U1077: '"C:\Program Files (x86)\Microsoft Visual Studio 12.0\VC\BIN\nmake.exe"' : return code '0x2'  
Stop. 
```
 
これに対しては、samples\traceapi\_win32.cpp の先頭に次の #pragma を書いて単純に回避できました。

 
```
//////////////////////////////////////////////////////////////////////////////  
//  
//  Detours Test Program (_win32.cpp of traceapi.dll)  
//  
//  Microsoft Research Detours Package, Version 3.0.  
//  
//  Copyright (c) Microsoft Corporation.  All rights reserved.  
//  
  
///////////////////////////////////////////////////////////////// Trampolines.  
//  
  
#pragma warning( disable : 4996 )  
  
int (__stdcall * Real_AbortDoc)(HDC a0)  
    = AbortDoc;  
 
```
 
では Simple というサンプルを選んで、動きを見てみます。

 
Detours のサンプルは、フォルダー毎に独立しているのではなく、別フォルダーにあるファイルをインクルードしているなどの依存関係があり、分かりにくいです。samples\simple フォルダーには 2 つのソース ファイル sleep5.cpp と simple.cpp があります。simple5.cpp をビルドすると sleep5.exe ができますが、これは単に Sleep 関数を呼ぶだけで、Detours は関係ありません。しかし Detours を使うことで、main 関数からの Sleep 呼び出しをフックすることができるようになります。

 
Sleep の呼び出し時にフックの処理が記述されているのが simple.cpp です。DllMain があることからも分かるように、このファイルをビルドすると simple32.dll という DLL ができます。

 
ヘルプにも readme にもこの後どうやって実行すればいいのか書かれていませんが、simple の Makefile を見て、test セクションで実行されるコマンドで使い方が分かります。どうやら setdll.exe と withdll.exe というのを使うようです。

 
setdll.exe を使うと、sleep5.exe ファイルの内容が書き換えられ、sleep5.exe 実行時にsimple32.dll をロードしてフックが実行されるようになります。withdll.exe は、パラメーターとして指定した sleep5.exe を別プロセスとして実行し、このプロセスが simple32.dll をロードしてフックが行われます。しかし setdll.exe とは違って sleep5.exe を書き換えることはありません。

 
以下が出力結果です。setdll.exe を実行すると sleep5.exe が書き換わっていることをハッシュから確認しています。また、setdll は、変更前のファイルを sleep.exe~ という名前でバックアップしています。

 
```
C:\MSWORK\DetoursExpress30\bin.X86>sleep5.exe 
sleep5.exe: Starting. 
sleep5.exe: Done sleeping.

C:\MSWORK\DetoursExpress30\bin.X86>sigcheck -h sleep5.exe

Sigcheck v2.1 - File version and signature viewer 
Copyright (C) 2004-2014 Mark Russinovich 
Sysinternals - www.sysinternals.com

C:\MSWORK\DetoursExpress30\bin.X86\sleep5.exe: 
        Verified:       Unsigned 
        Link date:      10:03 11/28/2014 
        Publisher:      n/a 
        Description:    n/a 
        Product:        n/a 
        Prod version:   n/a 
        File version:   n/a 
        MachineType:    32-bit 
        MD5:    9F8F697CCE6CE4A4F4F985BD895133C2 
        SHA1:   EF53ED6254428B38BE81C367181D2B9375B1EC0F 
        PESHA1: 82BC2B3B2E6C587CDE627AC08E1B1659159AAA47 
        PE256:  3F8EC4B687F4CC711496DCFBCB79F1443DC844D086758E5FAA25E6167EE4A31E 
        SHA256: 815D61B50A9C18A3EF15A2E7AC47251FD005FF0BC4146184ABDD06C6CF865C86

C:\MSWORK\DetoursExpress30\bin.X86>setdll.exe -d:simple32.dll sleep5.exe 
Adding simple32.dll to binary files. 
  sleep5.exe: 
    simple32.dll 
    KERNEL32.dll -> KERNEL32.dll

C:\MSWORK\DetoursExpress30\bin.X86>sigcheck -h sleep5.exe

Sigcheck v2.1 - File version and signature viewer 
Copyright (C) 2004-2014 Mark Russinovich 
Sysinternals - www.sysinternals.com

C:\MSWORK\DetoursExpress30\bin.X86\sleep5.exe: 
        Verified:       Unsigned 
        Link date:      10:03 11/28/2014 
        Publisher:      n/a 
        Description:    n/a 
        Product:        n/a 
        Prod version:   n/a 
        File version:   n/a 
        MachineType:    32-bit 
        MD5:    E2ED75D0C57A30FBE4737B3F6A0865EB 
        SHA1:   C6FC17922F623B18AAEA939B3E8B593A7877E512 
        PESHA1: E59C41CB5BB55AC85B3956B10934F34DEDD71AE9 
        PE256:  BDCF7BEA1BEAA03C5C83138BB67DA16F22A1C2E3A8A592A319DDCF37DB20CF49 
        SHA256: 80B8A7F7114836829397EC433E8E287D28355C0485B8AFAAAF16A1940686942F

C:\MSWORK\DetoursExpress30\bin.X86>sigcheck -h "sleep5.exe~"

Sigcheck v2.1 - File version and signature viewer 
Copyright (C) 2004-2014 Mark Russinovich 
Sysinternals - www.sysinternals.com

C:\MSWORK\DetoursExpress30\bin.X86\sleep5.exe~: 
        Verified:       Unsigned 
        Link date:      10:03 11/28/2014 
        Publisher:      n/a 
        Description:    n/a 
        Product:        n/a 
        Prod version:   n/a 
        File version:   n/a 
        MachineType:    32-bit 
        MD5:    9F8F697CCE6CE4A4F4F985BD895133C2 
        SHA1:   EF53ED6254428B38BE81C367181D2B9375B1EC0F 
        PESHA1: 82BC2B3B2E6C587CDE627AC08E1B1659159AAA47 
        PE256:  3F8EC4B687F4CC711496DCFBCB79F1443DC844D086758E5FAA25E6167EE4A31E 
        SHA256: 815D61B50A9C18A3EF15A2E7AC47251FD005FF0BC4146184ABDD06C6CF865C86

C:\MSWORK\DetoursExpress30\bin.X86>sleep5.exe 
simple32.dll: Starting. 
simple32.dll: Detoured SleepEx(). 
sleep5.exe: Starting. 
sleep5.exe: Done sleeping. 
simple32.dll: Removed SleepEx() (result=0), slept 5031 ticks.

C:\MSWORK\DetoursExpress30\bin.X86>setdll -r sleep5.exe 
Removing extra DLLs from binary files. 
  sleep5.exe: 
    KERNEL32.dll -> KERNEL32.dll

C:\MSWORK\DetoursExpress30\bin.X86>sleep5.exe 
sleep5.exe: Starting. 
sleep5.exe: Done sleeping.

C:\MSWORK\DetoursExpress30\bin.X86>withdll.exe -d:simple32.dll sleep5.exe 
withdll.exe: Starting: `sleep5.exe' 
withdll.exe:   with `C:\MSWORK\DetoursExpress30\bin.X86\simple32.dll' 
simple32.dll: Starting. 
simple32.dll: Detoured SleepEx(). 
sleep5.exe: Starting. 
sleep5.exe: Done sleeping. 
simple32.dll: Removed SleepEx() (result=0), slept 5016 ticks.

C:\MSWORK\DetoursExpress30\bin.X86> 
```
 
simple32.dll がロードされたことを示すログと、"slept 5016 ticks" というメッセージから、実際に API がフックされていることが分かります。

 
どのような仕組みでフックが行われるのか、という点に関しては、ヘルプの "Interception of Binary Functions" のページに書かれています。簡単に言えば、ターゲットとなる関数の先頭部分に jmp 命令をインジェクトしています。フックを元に戻せるようにして、フック中も元の関数へのアドレスを利用できようにしておくなどの細かい処理はたくさんあるようですが。

 
デバッグのログを貼ります。

 
```
C:\MSWORK\DetoursExpress30\bin.X86>E:\debuggers\pub.x86\cdb sleep5.exe 1

Microsoft (R) Windows Debugger Version 6.3.9600.16384 X86 
Copyright (c) Microsoft Corporation. All rights reserved.

CommandLine: sleep5.exe 1

************* Symbol Path validation summary ************** 
Response                         Time (ms)     Location 
Deferred                                       cache*E:\symbols.pub 
Deferred                                       srv*http://msdl.microsoft.com/download/symbols 
Symbol search path is: cache*E:\symbols.pub;srv*http://msdl.microsoft.com/download/symbols 
Executable search path is: 
ModLoad: 00d40000 00d68000   sleep5.exe 
ModLoad: 771b0000 7731e000   ntdll.dll 
ModLoad: 76b10000 76c50000   C:\WINDOWS\SysWOW64\KERNEL32.DLL 
ModLoad: 76330000 76407000   C:\WINDOWS\SysWOW64\KERNELBASE.dll 
ModLoad: 0faf0000 0fb2d000   C:\MSWORK\DetoursExpress30\bin.X86\simple32.dll 
(e80.34dc): Break instruction exception - code 80000003 (first chance) 
eax=00000000 ebx=00000000 ecx=c34b0000 edx=00000000 esi=7e629000 edi=00000000 
eip=7726415d esp=001ff9bc ebp=001ff9e8 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000246 
ntdll!LdrpDoDebuggerBreak+0x2b: 
7726415d cc              int     3 
0:000> uf sleep5!main 
*** WARNING: Unable to verify checksum for sleep5.exe 
sleep5!main: 
00d41000 55              push    ebp 
00d41001 8bec            mov     ebp,esp 
00d41003 837d0802        cmp     dword ptr [ebp+8],2 
00d41007 7526            jne     sleep5!main+0x2f (00d4102f)

sleep5!main+0x9: 
00d41009 b804000000      mov     eax,4 
00d4100e c1e000          shl     eax,0 
00d41011 8b4d0c          mov     ecx,dword ptr [ebp+0Ch] 
00d41014 8b1401          mov     edx,dword ptr [ecx+eax] 
00d41017 52              push    edx 
00d41018 e8a3000000      call    sleep5!atoi (00d410c0) 
00d4101d 83c404          add     esp,4 
00d41020 69c0e8030000    imul    eax,eax,3E8h 
00d41026 50              push    eax 
00d41027 ff1500c0d500    call    dword ptr [sleep5!_imp__Sleep (00d5c000)] 
00d4102d eb25            jmp     sleep5!main+0x54 (00d41054)

sleep5!main+0x2f: 
00d4102f 68a8c1d500      push    offset sleep5!__xt_z+0x3c (00d5c1a8) 
00d41034 e850010000      call    sleep5!printf (00d41189) 
00d41039 83c404          add     esp,4 
00d4103c 6888130000      push    1388h 
00d41041 ff1500c0d500    call    dword ptr [sleep5!_imp__Sleep (00d5c000)] 
00d41047 68c0c1d500      push    offset sleep5!__xt_z+0x54 (00d5c1c0) 
00d4104c e838010000      call    sleep5!printf (00d41189) 
00d41051 83c404          add     esp,4

sleep5!main+0x54: 
00d41054 33c0            xor     eax,eax 
00d41056 5d              pop     ebp 
00d41057 c3              ret 
0:000> dds 00d5c000 l1 
00d5c000  76b282d0 KERNEL32!SleepStub 
0:000> u 76b282d0 
KERNEL32!SleepStub: 
76b282d0 ff259c00b976    jmp     dword ptr [KERNEL32!_imp__Sleep (76b9009c)] 
76b282d6 cc              int     3 
76b282d7 cc              int     3 
76b282d8 cc              int     3 
76b282d9 cc              int     3 
76b282da cc              int     3 
76b282db cc              int     3 
76b282dc cc              int     3 
0:000> dds 76b9009c l1 
76b9009c  76331040 KERNELBASE!Sleep 
0:000> u 76331040 
KERNELBASE!Sleep: 
76331040 8bff            mov     edi,edi 
76331042 55              push    ebp 
76331043 8bec            mov     ebp,esp 
76331045 6a00            push    0 
76331047 ff7508          push    dword ptr [ebp+8] 
7633104a e8e11a0000      call    KERNELBASE!SleepEx (76332b30) 
7633104f 5d              pop     ebp 
76331050 c20400          ret     4 
0:000> u 76332b30 
KERNELBASE!SleepEx: 
76332b30 6a38            push    38h 
76332b32 68b02b3376      push    offset KERNELBASE!ValStateReleaseValues+0x58c (76332bb0) 
76332b37 e855e5ffff      call    KERNELBASE!_SEH_prolog4 (76331091) 
76332b3c c745b824000000  mov     dword ptr [ebp-48h],24h 
76332b43 c745bc01000000  mov     dword ptr [ebp-44h],1 
76332b4a 6a07            push    7 
76332b4c 59              pop     ecx 
76332b4d 33c0            xor     eax,eax 
0:000> bp 00d41027 
0:000> g 
simple32.dll: Starting. 
simple32.dll: Detoured SleepEx(). 
Breakpoint 0 hit 
eax=000003e8 ebx=00000000 ecx=00000000 edx=00000008 esi=00d4140f edi=00d4140f 
eip=00d41027 esp=001ffe04 ebp=001ffe08 iopl=0         nv up ei pl nz na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000206 
sleep5!main+0x27: 
00d41027 ff1500c0d500    call    dword ptr [sleep5!_imp__Sleep (00d5c000)] ds:002b:00d5c000={KERNEL32!SleepStub (76b282d0)} 
0:000> dds 00d5c000 l1 
00d5c000  76b282d0 KERNEL32!SleepStub 
0:000> u 76b282d0 
KERNEL32!SleepStub: 
76b282d0 ff259c00b976    jmp     dword ptr [KERNEL32!_imp__Sleep (76b9009c)] 
76b282d6 cc              int     3 
76b282d7 cc              int     3 
76b282d8 cc              int     3 
76b282d9 cc              int     3 
76b282da cc              int     3 
76b282db cc              int     3 
76b282dc cc              int     3 
0:000> dds 76b9009c l1 
76b9009c  76331040 KERNELBASE!Sleep 
0:000> u 76331040 
KERNELBASE!Sleep: 
76331040 8bff            mov     edi,edi 
76331042 55              push    ebp 
76331043 8bec            mov     ebp,esp 
76331045 6a00            push    0 
76331047 ff7508          push    dword ptr [ebp+8] 
7633104a e8e11a0000      call    KERNELBASE!SleepEx (76332b30) 
7633104f 5d              pop     ebp 
76331050 c20400          ret     4 
0:000> u (76332b30) 
KERNELBASE!SleepEx: 
76332b30 e9dbe47b99      jmp     simple32!TimedSleepEx (0faf1010) 
76332b35 cc              int     3 
76332b36 cc              int     3 
76332b37 e855e5ffff      call    KERNELBASE!_SEH_prolog4 (76331091) 
76332b3c c745b824000000  mov     dword ptr [ebp-48h],24h 
76332b43 c745bc01000000  mov     dword ptr [ebp-44h],1 
76332b4a 6a07            push    7 
76332b4c 59              pop     ecx 
0:000> u (0faf1010) l10 
simple32!TimedSleepEx: 
0faf1010 55              push    ebp 
0faf1011 8bec            mov     ebp,esp 
0faf1013 83ec0c          sub     esp,0Ch 
0faf1016 ff1508c0b10f    call    dword ptr [simple32!_imp__GetTickCount (0fb1c008)] 
0faf101c 8945f8          mov     dword ptr [ebp-8],eax 
0faf101f 8b450c          mov     eax,dword ptr [ebp+0Ch] 
0faf1022 50              push    eax 
0faf1023 8b4d08          mov     ecx,dword ptr [ebp+8] 
0faf1026 51              push    ecx 
0faf1027 ff152462b20f    call    dword ptr [simple32!TrueSleepEx (0fb26224)] 
0faf102d 8945f4          mov     dword ptr [ebp-0Ch],eax 
0faf1030 ff1508c0b10f    call    dword ptr [simple32!_imp__GetTickCount (0fb1c008)] 
0faf1036 8945fc          mov     dword ptr [ebp-4],eax 
0faf1039 8b55fc          mov     edx,dword ptr [ebp-4] 
0faf103c 2b55f8          sub     edx,dword ptr [ebp-8] 
0faf103f b82062b20f      mov     eax,offset simple32!dwSlept (0fb26220) 
0:000> dds (0fb26224) l1 
0fb26224  363200d8 
0:000> u 363200d8 
363200d8 6a38            push    38h 
363200da 68b02b3376      push    offset KERNELBASE!ValStateReleaseValues+0x58c (76332bb0) 
363200df e9532a0140      jmp     KERNELBASE!SleepEx+0x7 (76332b37) 
363200e4 cc              int     3 
363200e5 cc              int     3 
363200e6 cc              int     3 
363200e7 cc              int     3 
363200e8 cc              int     3

0:000> !address 363200d8

Mapping file section regions... 
Mapping module regions... 
Mapping PEB regions... 
Mapping TEB and stack regions... 
Mapping heap regions... 
Mapping page heap regions... 
Mapping other regions... 
Mapping stack trace database regions... 
Mapping activation context regions...

Usage:                  <unknown> 
Base Address:           36320000 
End Address:            36330000 
Region Size:            00010000 
State:                  00001000        MEM_COMMIT 
Protect:                00000020        PAGE_EXECUTE_READ 
Type:                   00020000        MEM_PRIVATE 
Allocation Base:        36320000 
Allocation Protect:     00000040        PAGE_EXECUTE_READWRITE 
```
 
sleep5!main は Sleep を呼んでいて、フックするのは SleepEx なので少し面倒なことになっています。なお、Visual Studio 2010/Windows 7 の環境で試すと、SleepEx のフックで Sleep の呼び出しはフックされませんでした。詳しく見ていませんが、コンパイラの動作に依存しそうです。

 
実行時の流れはこのようになっていることが分かります。また、デバッガーの初回アタッチでは、まだフックが行われていません。

 
```
sleep5!main 
--> call    dword ptr [sleep5!_imp__Sleep (00d5c000)] = KERNEL32!SleepStub 
--> jmp     dword ptr [KERNEL32!_imp__Sleep (76b9009c)] = KERNELBASE!Sleep 
--> call    KERNELBASE!SleepEx (76332b30) 
```
 
sleep5!main の call 命令でブレークさせると、今度はフックの処理が確認できました。大きく異なっているのは、KERNELBASE!SleepEx の先頭部分です。

 
```
0:000> u (76332b30) 
KERNELBASE!SleepEx: 
76332b30 e9dbe47b99      jmp     simple32!TimedSleepEx (0faf1010) 
76332b35 cc              int     3 
76332b36 cc              int     3 
76332b37 e855e5ffff      call    KERNELBASE!_SEH_prolog4 (76331091) 
76332b3c c745b824000000  mov     dword ptr [ebp-48h],24h 
76332b43 c745bc01000000  mov     dword ptr [ebp-44h],1 
76332b4a 6a07            push    7 
76332b4c 59              pop     ecx 
```
 
オリジナルでは、先頭は 2 つの push 命令でしたが、jmp と int 3 に変わっています。ジャンプ先は simple32 の関数であり、これがヘルプの "Interception of Binary Functions" に記載されている Detour Function です。

 
simple32!TimedSleepEx の中から、元の SleepEx を呼ぶため、simple32!TrueSleepEx というグローバル変数に保存してある関数アドレスを call します。この変数は、Detours の API である DetourAttach を呼び出したときに値が更新されているはずです。

 
simple32!TrueSleepEx には 363200d8 という、どのモジュールにも属さないアドレスが保存されています。これの中を見ると、KERNELBASE!SleepEx から消えた push が見つかりました。この小さなコード領域が、ヘルプで言うところの Trampoline Function です。

 
次に、ヘルプの "Payloads and DLL Import Editing" にある動作を見てみます。

 
```
0:000> !dh sleep5

File Type: EXECUTABLE IMAGE 
FILE HEADER VALUES 
     14C machine (i386) 
       5 number of sections 
5478B90A time date stamp Fri Nov 28 10:03:54 2014

       0 file pointer to symbol table 
       0 number of symbols 
      E0 size of optional header 
     102 characteristics 
            Executable 
            32 bit word machine

OPTIONAL HEADER VALUES 
     10B magic # 
   12.00 linker version 
   1A800 size of code 
    9E00 size of initialized data 
       0 size of uninitialized data 
    140F address of entry point 
    1000 base of code 
         ----- new ----- 
00d40000 image base 
    1000 section alignment 
     200 file alignment 
       3 subsystem (Windows CUI) 
    6.00 operating system version 
    0.00 image version 
    6.00 subsystem version 
   28000 size of image 
     400 size of headers 
       0 checksum

<snip>

SECTION HEADER #5 
.detour name 
     950 virtual size 
   27000 virtual address 
     A00 size of raw data 
   22C00 file pointer to raw data 
       0 file pointer to relocation table 
       0 file pointer to line numbers 
       0 number of relocations 
       0 number of line numbers 
C0000040 flags 
         Initialized Data 
         (no align specified) 
         Read Write 
0:000> lm m sleep5 
start    end        module name 
00d40000 00d68000   sleep5   C (private pdb symbols)  e:\symbols.pub\sleep5.pdb\19BC9C78629D43B1B5698CEE4A8354691\sleep5.pdb

0:000> db sleep5+27000 l100 
00d67000  40 00 00 00 44 74 72 00-10 09 00 00 10 09 00 00  @...Dtr......... 
00d67010  84 12 02 00 28 00 00 00-00 00 00 00 00 00 00 00  ....(........... 
00d67020  00 c0 01 00 30 01 00 00-00 70 02 00 d8 00 00 00  ....0....p...... 
00d67030  00 00 00 00 00 00 00 00-00 00 00 00 00 00 00 00  ................ 
00d67040  4d 5a 90 00 03 00 00 00-04 00 00 00 ff ff 00 00  MZ.............. 
00d67050  b8 00 00 00 00 00 00 00-40 00 00 00 00 00 00 00  ........@....... 
00d67060  00 00 00 00 00 00 00 00-00 00 00 00 00 00 00 00  ................ 
00d67070  00 00 00 00 00 00 00 00-00 00 00 00 d8 00 00 00  ................ 
00d67080  0e 1f ba 0e 00 b4 09 cd-21 b8 01 4c cd 21 54 68  ........!..L.!Th 
00d67090  69 73 20 70 72 6f 67 72-61 6d 20 63 61 6e 6e 6f  is program canno 
00d670a0  74 20 62 65 20 72 75 6e-20 69 6e 20 44 4f 53 20  t be run in DOS 
00d670b0  6d 6f 64 65 2e 0d 0d 0a-24 00 00 00 00 00 00 00  mode....$....... 
00d670c0  bd 9d 52 15 f9 fc 3c 46-f9 fc 3c 46 f9 fc 3c 46  ..R...<F..<F..<F 
00d670d0  bf ad dd 46 d9 fc 3c 46-bf ad e3 46 f6 fc 3c 46  ...F..<F...F..<F 
00d670e0  bf ad dc 46 92 fc 3c 46-24 03 f7 46 fa fc 3c 46  ...F..<F$..F..<F 
00d670f0  f9 fc 3d 46 b2 fc 3c 46-f4 ae dd 46 f8 fc 3c 46  ..=F..<F...F..<F 
```
 
ヘルプに書かれている .detour セクションが見つかります。この sleep5.exe は setdll.exe で加工済みのものであり、実行時に simple32.dll をロードするように、インポート テーブルが書き換えられています。インポート テーブルを書き換えつつ、後で変更を元に戻せるようにオリジナルの PE ヘッダーやインポート テーブルを保存する、という目的のために .detours セクションが作られています。セクションの内容をダンプしてみると、00d67040 から PE ヘッダーが始まっていることが分かります。

 
こんなの何に使えるの、という話は今後書くということで、とりあえずここまで。

