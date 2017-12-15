---
layout: post
title: "[Win32] [COM] How to read PDB Symbol file using DIA SDK"
date: 2014-01-07 15:02:27.000 +09:00
categories:
- C/C++
- Windows
tags:
- CoCreateInstance
- COM
- GetClassObject
- msdia110.dll
- pdb
- regsvr32
---

デバッグに不可欠なものといえば、デバッガーとデバッグ シンボルです。最近の Windows の世界でシンボルといえば、拡張子が pdb のファイルです。遠い昔の話ですが、SAP カーネルのカーネル パッチである sar ファイルを解凍すると、大抵は pdb ファイルも一緒に入っていた記憶があります。今も同じなんでしょうかね、あの仕組み。

 
linux や OS X におけるデバッグ シンボルは、実行可能ファイルに含まれていたり、含まれていなかったりします。linux カーネルを含め、シンボルが入っていないモジュールをデバッグするときには、シンボルを含むようにビルドし直すという作業が必要なはずです。間違ってたらごめんなさい。

 
開発環境でない限り、実行可能ファイルは free ビルド (release ビルド) と呼ばれる、コンパイラによる最適化を施したものを使っていて、Windows では多くの場合、実行可能ファイルにデバッグ情報は含まれていないはずです。モジュールに合ったシンボル ファイルをうまいこと入手してデバッガーにロードさせれば、モジュールをビルドし直さなくてもシンボルを使ったデバッグが可能です。

 
さて、この pdb ファイルとは一体何ぞや、という話です。pdb ファイルをプログラムで読み出す必要があって、簡単にできたので紹介します。最初に思いついたのは、Windows デバッガーに付属してくる dbghelp.dll に何かあるんじゃね？ということで MSDN を探してこんな関数を見つけました。

 
SymSearch function (Windows) <br />
[http://msdn.microsoft.com/en-us/library/windows/desktop/ms681363(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/windows/desktop/ms681363(v=vs.85).aspx)

 
それっぽいことはできそうですが、第一引数がプロセスのハンドルであるあたりからして、調べたいモジュールのイメージが予めロードされている必要がありそうです。もっと直接的に pdb を開く方法はないんかい、ということで DIA SDK とかいうものを見つけました。Visual Studio と一緒に勝手にインストールされているらしい。手元の環境だと C:\Program Files (x86)\Microsoft Visual Studio 11.0\DIA SDK に入っていました。

 
Debug Interface Access SDK <br />
[http://msdn.microsoft.com/en-us/library/x93ctkx8.aspx](http://msdn.microsoft.com/en-us/library/x93ctkx8.aspx)

 
付属の dia2dump というサンプルを使うと、pdb ファイルの内容を詳細にダンプできます。シンボルって結局こういう情報だったのね、と長年の疑問を解消させることができます。

 
これだけだと話が終わってしまいますが、もう一点。DIA SDK の API は COM インターフェース経由で呼び出すのですが、COM を呼び出すちょっと便利な方法も見つけたので、それもついでに紹介する意味で次のプログラムを。

 
いつも通り、まずは main.cpp から。

 
```
// 
// main.cpp 
//

#include <windows.h> 
#include <stdio.h>

#define LOGERROR(fmt, ...) wprintf(fmt, __VA_ARGS__) 
#define LOGINFO LOGERROR 
#define LOGDEBUG

#define MSDIADLL L"msdia110.dll" // msdia100.dll does not work

BOOL DumpSymbolsFromDll(LPCWSTR DllPath, LPCWSTR PdbFile, LPCWSTR SymbolName); 
BOOL DumpSymbolsViaCOM(LPCWSTR PdbFile, LPCWSTR SymbolName);

void ShowUsage() { 
    LOGINFO(L"\n  USAGE: SYMDUMP <pdb file> <symbol pattern> [path to msdia110.dll]\n\n", 0); 
}

int wmain(int argc, wchar_t *argv[]) { 
    if ( argc<3 ) { 
        ShowUsage(); 
    } 
    else if ( argc>3 ) { 
        DumpSymbolsFromDll(argv[3], argv[1], argv[2]); 
    } 
    else { 
        DumpSymbolsViaCOM(argv[1], argv[2]); 
    }

    return 0; 
} 
```
 
そして symdump.cpp。

 
```
// 
// symdump.cpp 
//

#include <windows.h> 
#include <stdio.h>

#include "..\diasdk\include\dia2.h"

#define LOGERROR(fmt, ...) wprintf(fmt, __VA_ARGS__) 
#define LOGINFO LOGERROR

#define HANDLE_ERROR(fmt, ...) \ 
    if ( FAILED(hr) ) { LOGERROR(fmt, __VA_ARGS__); goto cleanup; }

#define HANDLE_ERROR_CONTINUE(fmt, ...) \ 
    if ( FAILED(hr) ) { LOGERROR(fmt, __VA_ARGS__); continue; }

typedef HRESULT (__stdcall *DLLGETCLASSOBJECT)( 
  _In_   REFCLSID rclsid, 
  _In_   REFIID riid, 
  _Out_  LPVOID *ppv 
);

VOID DumpSymbols(IDiaEnumSymbols *EnumSymbols) { 
    HRESULT hr = 0; 
    BOOL Ret = FALSE; 
    ULONG Retrieved = 0;

    for (;;) { 
        IDiaSymbol *Symbol = NULL; 
        BSTR Name = NULL; 
        BSTR Undecorated = NULL; 
        DWORD Rva = 0; 
        DWORD SymTag = 0;

        hr = EnumSymbols->Next(1, &Symbol, &Retrieved); 
        HANDLE_ERROR_CONTINUE(L"IDiaEnumSymbols::Next failed - 0x%08x\n", hr); 
        
        if ( Retrieved==0 ) break;

        hr = Symbol->get_relativeVirtualAddress(&Rva); 
        hr = Symbol->get_name(&Name); 
        hr = Symbol->get_undecoratedName(&Undecorated); 
        hr = Symbol->get_symTag(&SymTag);

        LOGINFO(L"%4d RVA=%08x %-30s %-30s\n", SymTag, Rva, Name, Undecorated); 
        
        if ( Name ) SysFreeString(Name); 
        if ( Undecorated ) SysFreeString(Undecorated); 
        if ( Symbol ) Symbol->Release(); 
    } 
}

BOOL DumpSymbolsInternal(IDiaDataSource *MsdiaInstance, LPCWSTR PdbFile, LPCWSTR SymbolName) { 
    HRESULT hr = 0; 
    BOOL Ret = FALSE; 
    IDiaSession *Session = NULL; 
    IDiaSymbol  *Global = NULL; 
    IDiaEnumSymbols *EnumSymbols = NULL;

    hr = MsdiaInstance->loadDataFromPdb(PdbFile); 
    HANDLE_ERROR(L"IDiaDataSource::loadDataFromPdb failed - 0x%08x\n", hr);

    hr = MsdiaInstance->openSession(&Session); 
    HANDLE_ERROR(L"IDiaDataSource::openSession failed - 0x%08x\n", hr); 
    
    hr = Session->get_globalScope(&Global); 
    HANDLE_ERROR(L"IDiaSession::get_globalScope failed - 0x%08x\n", hr); 
    
    hr = Global->findChildren(SymTagNull, SymbolName, nsfRegularExpression, &EnumSymbols); 
    HANDLE_ERROR(L"IDiaSymbol::findChildren failed - 0x%08x\n", hr);

    DumpSymbols(EnumSymbols);

cleanup: 
    if ( EnumSymbols ) EnumSymbols->Release(); 
    if ( Global ) Global->Release(); 
    if ( Session ) Session->Release();

    return Ret; 
}

BOOL DumpSymbolsFromDll(LPCWSTR DllPath, LPCWSTR PdbFile, LPCWSTR SymbolName) { 
    HRESULT hr = 0; 
    BOOL Ret = FALSE; 
    HMODULE MsDiaDll = NULL; 
    DLLGETCLASSOBJECT MsDiaDllGetClassObject = NULL; 
    IClassFactory *Factory = NULL; 
    IDiaDataSource *Source = NULL;

    MsDiaDll = LoadLibrary(DllPath); 
    if ( !MsDiaDll ) { 
        LOGERROR(L"LoadLibrary failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    } 
    
    MsDiaDllGetClassObject = (DLLGETCLASSOBJECT)GetProcAddress(MsDiaDll, "DllGetClassObject"); 
    if ( !MsDiaDllGetClassObject ) { 
        LOGERROR(L"LoadLibrary failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    }

    hr = MsDiaDllGetClassObject(__uuidof(DiaSource), __uuidof(IClassFactory), (void**)&Factory); 
    HANDLE_ERROR(L"DllGetClassObject failed - 0x%08x\n", hr);

    hr = Factory->CreateInstance(NULL, __uuidof(IDiaDataSource), (void**)&Source); 
    HANDLE_ERROR(L"IClassFactory::CreateInstance failed - 0x%08x\n", hr); 
    
    Ret = DumpSymbolsInternal(Source, PdbFile, SymbolName);

cleanup: 
    if ( Source ) Source->Release(); 
    if ( Factory ) Factory->Release(); 
    if ( MsDiaDll ) FreeLibrary(MsDiaDll);

    return Ret; 
}

BOOL DumpSymbolsViaCOM(LPCWSTR PdbFile, LPCWSTR SymbolName) { 
    HRESULT hr = 0; 
    BOOL Ret = FALSE; 
    IDiaDataSource *Source = NULL;

    CoInitialize(NULL);

    hr = CoCreateInstance(__uuidof(DiaSource), 
        NULL, 
        CLSCTX_INPROC_SERVER, 
        __uuidof(IDiaDataSource), 
        (void**)&Source); 
    HANDLE_ERROR(L"CoCreateInstance failed - 0x%08x\n", hr); 
    
    Ret = DumpSymbolsInternal(Source, PdbFile, SymbolName);

cleanup: 
    if ( Source ) Source->Release();

    CoUninitialize();

    return Ret; 
} 
```
 
やっていることはとても単純で、IDiaSymbol::findChildren で検索して、各シンボルの IDiaSymbol インスタンスを引っ張ってくるだけです。

 
IDiaSymbol::findChildren <br />
[http://msdn.microsoft.com/en-us/library/yfx1573w.aspx](http://msdn.microsoft.com/en-us/library/yfx1573w.aspx)

 
出力例はこんな感じ。自分自身である symdump のシンボルを読ませてみました。

 
```
E:\VSDev\Projects\symdump\Release>symdump

  USAGE: SYMDUMP <pdb file> <symbol pattern> [path to msdia110.dll]


E:\VSDev\Projects\symdump\Release>symdump symdump.pdb *main* 
   2 RVA=00000000 E:\VSDev\Projects\symdump\Release\main.obj (null) 
   7 RVA=00003014 __native_dllmain_reason        (null) 
   7 RVA=00003018 mainret                        (null) 
   5 RVA=00001000 wmain                          _wmain 
   5 RVA=000014d8 __tmainCRTStartup              (null) 
   5 RVA=0000163d wmainCRTStartup                _wmainCRTStartup 
  10 RVA=00001000 _wmain                         _wmain 
  10 RVA=00003014 ___native_dllmain_reason       ___native_dllmain_reason 
  10 RVA=0000163d _wmainCRTStartup               _wmainCRTStartup 
  10 RVA=00002038 __imp____wgetmainargs          __imp____wgetmainargs

E:\VSDev\Projects\symdump\Release>
```
 
findChildren に渡している nsfRegularExpression ですが、名前からすると、「シンボルの検索に正規表現使えるのか、やるじゃん」 と思いますが、以下のページに "Applies a case-sensitive name match using asterisks (*) and question marks (?) as wildcards." と書いてあり、どうやら * と ? しか使えないようです。いかにも Windows らしいところ。

 
NameSearchOptions <br />
[http://msdn.microsoft.com/en-us/library/yat28ads.aspx](http://msdn.microsoft.com/en-us/library/yat28ads.aspx)

 
RVA というのは、Relative Virtual Address の略で、そのシンボルが示すデータのモジュール ベースからのオフセットを示しています。この値が分かることで、モジュールのベース アドレスが分かれば、関数の先頭にブレークポイントを設定できるわけです。例えば wmainCRTStartup のオフセットは 163d なので、以下のようにして確かめられます。

 
IDiaSymbol::get_relativeVirtualAddress <br />
[http://msdn.microsoft.com/en-us/library/vstudio/xf7wwak5(v=vs.100).aspx](http://msdn.microsoft.com/en-us/library/vstudio/xf7wwak5(v=vs.100).aspx)

 
```
E:\VSDev\Projects\symdump\Release>C:\debuggers\x86\cdb -y . symdump.exe

Microsoft (R) Windows Debugger Version 6.12.0002.633 X86 
Copyright (c) Microsoft Corporation. All rights reserved.

CommandLine: symdump.exe 
Symbol search path is: .;srv*c:\websymbols*http://msdl.microsoft.com/download/symbols 
Executable search path is: 
ModLoad: 012c0000 012c6000   symdump.exe 
ModLoad: 77570000 776f0000   ntdll.dll 
ModLoad: 76fa0000 770b0000   C:\Windows\syswow64\kernel32.dll 
ModLoad: 76930000 76977000   C:\Windows\syswow64\KERNELBASE.dll 
ModLoad: 75850000 759ac000   C:\Windows\syswow64\ole32.dll 
ModLoad: 75750000 757fc000   C:\Windows\syswow64\msvcrt.dll 
ModLoad: 76ac0000 76b50000   C:\Windows\syswow64\GDI32.dll 
ModLoad: 74ff0000 750f0000   C:\Windows\syswow64\USER32.dll 
ModLoad: 76ea0000 76f40000   C:\Windows\syswow64\ADVAPI32.dll 
ModLoad: 770b0000 770c9000   C:\Windows\SysWOW64\sechost.dll 
ModLoad: 75a20000 75b10000   C:\Windows\syswow64\RPCRT4.dll 
ModLoad: 74f90000 74ff0000   C:\Windows\syswow64\SspiCli.dll 
ModLoad: 74f80000 74f8c000   C:\Windows\syswow64\CRYPTBASE.dll 
ModLoad: 76e90000 76e9a000   C:\Windows\syswow64\LPK.dll 
ModLoad: 75480000 7551d000   C:\Windows\syswow64\USP10.dll 
ModLoad: 75280000 7530f000   C:\Windows\syswow64\OLEAUT32.dll 
ModLoad: 65610000 656e6000   C:\Windows\SysWOW64\MSVCR110.dll 
(3fa0.4054): Break instruction exception - code 80000003 (first chance) 
eax=00000000 ebx=00000000 ecx=e5cb0000 edx=0024dde8 esi=fffffffe edi=00000000 
eip=7761103b esp=003ff580 ebp=003ff5ac iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000246 
ntdll!LdrpDoDebuggerBreak+0x2c: 
7761103b cc              int     3 
0:000> ln 012c0000+0000163d 
*** WARNING: Unable to verify checksum for symdump.exe 
(012c163d)   symdump!wmainCRTStartup   |  (012c1647)   symdump!__raise_securityfailure 
Exact matches: 
    symdump!wmainCRTStartup (void) 
0:000>
```
 
逆に言えば、シンボルが間違っていると、変なところにブレークポイントを貼ってしまう可能性があるということです。

 
DIA SDK の話はここまでですが、symdump.cpp のもう一つのポイントは DumpSymbolsFromDll と DumpSymbolsViaCOM です。通常、COM インターフェースを使うときは、実体となるクラスが実装された COM サーバーを予め regsvr32 でレジストリに登録しておき、COM クライアントが CoCreateInstance を呼び出すと、GUID による検索でどこからともなくインスタンスが表れるという仕組みになっています。つまり GUID さえ分かっていれば、COM サーバーが誰なのかを知る必要がありません。ただし、regsvr32 による登録が行われていないと動きません。

 
regsvr32 による登録を行わずに、COM オブジェクトのインスタンスを取得する方法が DumpSymbolsFromDll です。DIA SDK の COIM サーバーは、DIA SDK\bin フォルダーにある msdia110.dll で、この中のエクスポート関数である DllGetClassObject を直接呼び出すことで、必要なオブジェクトのファクトリー オブジェクトを取得できます。というか以下のページにまんま書いてありました。これは便利。

 
Windows/C++: how to use a COM dll which is not registered - Stack Overflow <br />
[http://stackoverflow.com/questions/2466138/windows-c-how-to-use-a-com-dll-which-is-not-registered](http://stackoverflow.com/questions/2466138/windows-c-how-to-use-a-com-dll-which-is-not-registered)

 
便利な反面、DLL のパスを自分で指定しないといけないところが不便です。例えば、32bit と 64bit では当然 DLL が別になるので、それぞれ別の DLL を指定する必要があります。いずれにしても、覚えておくといつか役に立ちそうな方法ですね。

