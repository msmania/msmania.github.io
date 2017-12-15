---
layout: post
title: "[windbg] Debugger extension to dump binary tree"
date: 2013-12-01 06:14:59.000 +09:00
categories:
- C/C++
- Debug
- Windows
tags:
- dll
- tree
- windbg
---

先月、ある解析のためにデバッガー拡張 DLL を書いてみたところ、思いのほか簡単だったのでコードを共有します。バイナリ ツリーをダンプするだけのコマンドです。Windows カーネルで多用されているリストについては、dl や !list といった標準コマンドがありますが、ツリーに関してはなさそうだったので作りました。

 
<font color="#0000ff">[2015/2/15 追記]     <br>本記事で紹介しているコードは、ターゲットが 64bit である場合に限定されていました。32bit にも対応するように書き直したコードを GitHub 上で公開しています。コマンドは !dumptree から !dt に変更しました。</font>

 
[https://github.com/msmania/bangon/](https://github.com/msmania/bangon/)

 
実は、Windows には木構造も随所に使われています。今回対象とするのは、Windows カーネルに実装されている RTL_SPLAY_LINKS 構造体です。

 
RTL_SPLAY_LINKS structure (Windows Drivers) <br />
[http://msdn.microsoft.com/en-us/library/windows/hardware/ff553351(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/windows/hardware/ff553351(v=vs.85).aspx)

 
```
typedef struct _RTL_SPLAY_LINKS { 
  struct _RTL_SPLAY_LINKS  *Parent; 
  struct _RTL_SPLAY_LINKS  *LeftChild; 
  struct _RTL_SPLAY_LINKS  *RightChild; 
} RTL_SPLAY_LINKS, *PRTL_SPLAY_LINKS;
```
 
名前の通りスプレー木なので、木の回転が発生しています。データ構造としては、親と左右の子をメンバーに持つごく普通の木です。通常であれば、dt や dq を使ってがりがり値を見ていくところですが、ツリーが大きいと面倒なことこの上ありません。

 
スプレー木 - Wikipedia <br />
[http://ja.wikipedia.org/wiki/%E3%82%B9%E3%83%97%E3%83%AC%E3%83%BC%E6%9C%A8](http://ja.wikipedia.org/wiki/%E3%82%B9%E3%83%97%E3%83%AC%E3%83%BC%E6%9C%A8)

 
デバッガー拡張 DLL の作り方については、ここが本家です。

 
Writing WdbgExts Extensions (Windows Debuggers) <br />
[http://msdn.microsoft.com/en-us/library/windows/hardware/ff561491(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/windows/hardware/ff561491(v=vs.85).aspx)

 
デバッガーをインストールした場所の winext フォルダーに入っている DLL のエクスポート関数を見てみると分かりますが、デバッガーの拡張コマンドのそれぞれがエクスポート関数に対応しています。要は、DLL を作ればいいわけです。

 
![]({{site.assets_url}}2013-12-01-image.png) <br />
uext.dll を dependency walker で開いたところ。!handle コマンドなどが見える。

 
Visual Studio で空の Win32 DLL プロジェクトを作って、以下 3 つのファイル (dllmain.cpp fext.cpp fext.def) を追加します。

 
dllmain.cpp は DllMain だけです。特に意味はありませんが、エクスポート関数とは別に定義しておくのが好きです。使いまわせるし。

 
```
// 
// dllmain.cpp 
//

#include <windows.h>

BOOL WINAPI DllMain( 
  _In_  HINSTANCE hinstDLL, 
  _In_  DWORD fdwReason, 
  _In_  LPVOID lpvReserved 
) { 
    switch (fdwReason) { 
    case DLL_PROCESS_ATTACH: 
    case DLL_THREAD_ATTACH: 
    case DLL_THREAD_DETACH: 
    case DLL_PROCESS_DETACH: 
        break; 
    } 
    return TRUE; 
}
```
 
メインのファイルが fext.cpp です。エクスポート関数とその関連定義を全部書きます。ここでインクルードしている wdbgexts.h は、デバッガーをインストールした場所の sdk\inc フォルダー下に入っています。プロジェクト フォルダーにコピーしておくと楽です。

 
アルゴリズムは・・・Breadth-first search しているだけです。重複ぐらいは確認しています。

 
```
// 
// fext.cpp 
//

#include <Windows.h> 
#include <set> 
#include <queue>

#include "..\dbgsdk\wdbgexts.h"

#define LODWORD(ll) ((DWORD)(ll&0xffffffff)) 
#define HIDWORD(ll) ((DWORD)((ll>>32)&0xffffffff))

// 
// http://msdn.microsoft.com/en-us/library/windows/hardware/ff543968(v=vs.85).aspx 
// 
EXT_API_VERSION ApiVersion = { 
    0,    // MajorVersion 
    0,    // MinorVersion 
    EXT_API_VERSION_NUMBER64,    // Revision 
    0    // Reserved 
};

// 
// http://msdn.microsoft.com/en-us/library/windows/hardware/ff561303(v=vs.85).aspx 
// ExtensionApis is extern defined as WINDBG_EXTENSION_APIS in wdbgexts.h 
// 
WINDBG_EXTENSION_APIS ExtensionApis;

LPEXT_API_VERSION ExtensionApiVersion(void) { 
    return &ApiVersion; 
}

VOID WinDbgExtensionDllInit( 
  PWINDBG_EXTENSION_APIS lpExtensionApis, 
  USHORT MajorVersion, 
  USHORT MinorVersion 
) { 
    ExtensionApis = *lpExtensionApis; 
    return; 
}

DECLARE_API (help) { 
    dprintf("Hello!\n"); 
}

struct TREE_ITEM64 { 
    ULONGLONG Parent; 
    ULONGLONG LeftChild; 
    ULONGLONG RightChild; 
};

struct TREE_ITEM_INFO { 
    DWORD Level; 
    ULONGLONG Myself; 
    TREE_ITEM64 Item; 
};

std::queue<TREE_ITEM_INFO> TraverseQueue; 
std::set<ULONGLONG> CorruptionCheck;

BOOL AddTreeItem(DWORD Level, ULONGLONG Address) { 
    if ( CorruptionCheck.find(Address)!=CorruptionCheck.end() ) { 
        return FALSE; 
    }

    CorruptionCheck.insert(Address);

    DWORD BytesRead = 0; 
    TREE_ITEM_INFO TreeItem; 
    TreeItem.Level = Level; 
    TreeItem.Myself = Address; 
    ReadMemory(Address, &(TreeItem.Item), sizeof(TREE_ITEM64), &BytesRead);

    if ( BytesRead!=sizeof(TREE_ITEM64) ) { 
        return FALSE; 
    }

    TraverseQueue.push(TreeItem); 
    return TRUE; 
}

DECLARE_API (dumptree) { 
    ULONGLONG RootAddress = GetExpression(args);

    if ( !RootAddress ) 
        return; 
    
    while ( TraverseQueue.size() ) { 
        TraverseQueue.pop(); 
    } 
    CorruptionCheck.clear();

    AddTreeItem(0, RootAddress);

    DWORD CurrentLevel = 0; 
    DWORD ItemCount = 0; 
    while ( TraverseQueue.size() ) { 
        const TREE_ITEM_INFO &Item = TraverseQueue.front();

        dprintf("L=%04x#%04x %08x`%08x : P=%08x`%08x L=%08x`%08x R=%08x`%08x\n", 
            CurrentLevel, ItemCount, 
            HIDWORD(Item.Myself), LODWORD(Item.Myself), 
            HIDWORD(Item.Item.Parent), LODWORD(Item.Item.Parent), 
            HIDWORD(Item.Item.LeftChild), LODWORD(Item.Item.LeftChild), 
            HIDWORD(Item.Item.RightChild), LODWORD(Item.Item.RightChild)); 
        
        if ( Item.Level!=CurrentLevel ) { 
            ItemCount = 0; 
            CurrentLevel = Item.Level; 
        } 
        
        if ( Item.Item.LeftChild ) { 
            if ( !AddTreeItem(Item.Level+1, Item.Item.LeftChild) ) { 
                dprintf("Item %08x`%08x was duplicated!\n", 
                    HIDWORD(Item.Item.LeftChild), LODWORD(Item.Item.LeftChild)); 
            } 
        }

        if ( Item.Item.RightChild ) { 
            if ( !AddTreeItem(Item.Level+1, Item.Item.RightChild) ) { 
                dprintf("Item %08x`%08x was duplicated!\n", 
                    HIDWORD(Item.Item.RightChild), LODWORD(Item.Item.RightChild)); 
            } 
        }

        ++ItemCount; 
        TraverseQueue.pop(); 
    } 
}
```
 
最後に定義ファイルです。

 
```
; 
; fext.def 
;

LIBRARY "FEXT.dll" 
EXPORTS 
    WinDbgExtensionDllInit 
    ExtensionApiVersion 
    help 
    dumptree
```
 
デバッガーは拡張 DLL を動的リンクするので、ヘッダーは不要です。

 
これらのファイルをコンパイル/リンクして、x64 ネイティブの DLL を作ります。デバッガーのプロセスが拡張 DLL を直接ロードする以上、デバッガーと DLL の CPU アーキテクチャーの種類は同じでなければなりません。もし、32bit デバッガー用の DLL を作る場合は、fext.cpp の修正も必要です。手元の環境で作成した fext.dll を開いたところです。dumptree という関数が拡張コマンドです。

 
![]({{site.assets_url}}2013-12-01-image1.png)

 
さて、実際に使ってみます。Windows のどこに木構造なんてあるんだ、という話ですが、木のスプレー操作を行うための関数がカーネルに用意されているので、ここでブレークしたパラメーターから木構造を入手できます。RtlSplay という関数の引数がそのまま RTL_SPLAY_LINKS へのポインターになっています。

 
RtlSplay routine (Windows Drivers) <br />
[http://msdn.microsoft.com/en-us/library/windows/hardware/ff553226(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/windows/hardware/ff553226(v=vs.85).aspx)

 
今回は、Windows 8 x64 の Hyper-V 仮想マシンに対してデバッガーを繋ぎました。ゲスト上で特に何の操作もしていないのですが、すぐにブレークしてくれました。NTFS に木構造があるようです。

 
```
kd> x nt!RtlSplay 
fffff801`fe0cdd40 nt!RtlSplay (<no parameter info>) 
kd> bp nt!RtlSplay 
kd> g 
Breakpoint 0 hit 
nt!RtlSplay: 
fffff801`fe0cdd40 483909          cmp     qword ptr [rcx],rcx 
kd> .reload 
Connected to Windows 8 9200 x64 target at (Sat Nov 30 12:58:10.979 2013 (UTC - 8:00)), ptr64 TRUE 
Loading Kernel Symbols 
............................................................... 
................................................................ 
........... 
Loading User Symbols 
................................................................ 
. 
Loading unloaded module list 
........ 
kd> k 
Child-SP          RetAddr           Call Site 
fffff880`04f02bb8 fffff880`0178d25f nt!RtlSplay 
fffff880`04f02bc0 fffff880`01786487 Ntfs!NtfsFindPrefix+0x1df 
fffff880`04f02c70 fffff880`017824a1 Ntfs!NtfsFindStartingNode+0x537 
fffff880`04f02d30 fffff880`01786d0d Ntfs!NtfsCommonCreate+0x401 
fffff880`04f02f50 fffff801`fe089767 Ntfs!NtfsCommonCreateCallout+0x1d 
fffff880`04f02f80 fffff801`fe08972d nt!KxSwitchKernelStackCallout+0x27 
fffff880`044e60e0 fffff801`fe0cff1e nt!KiSwitchKernelStackContinue 
fffff880`044e6100 fffff801`fe0d0d85 nt!KeExpandKernelStackAndCalloutInternal+0x20e 
fffff880`044e6200 fffff880`0177a7f4 nt!KeExpandKernelStackAndCalloutEx+0x25 
fffff880`044e6240 fffff880`015714ee Ntfs!NtfsFsdCreate+0x1d4 
fffff880`044e6420 fffff880`0159b35d fltmgr!FltpLegacyProcessingAfterPreCallbacksCompleted+0x25e 
fffff880`044e64c0 fffff801`fe45f05b fltmgr!FltpCreate+0x34d 
fffff880`044e6570 fffff801`fe45bc5d nt!IopParseDevice+0x77b 
fffff880`044e6760 fffff801`fe4612b8 nt!ObpLookupObjectName+0x7a1 
fffff880`044e6890 fffff801`fe472ebe nt!ObOpenObjectByName+0x258 
fffff880`044e6960 fffff801`fe473609 nt!IopCreateFile+0x37c 
fffff880`044e6a00 fffff801`fe08e053 nt!NtCreateFile+0x79 
fffff880`044e6a90 000007ff`3ab530fa nt!KiSystemServiceCopyEnd+0x13 
000000e7`eed4f128 000007ff`37e952dc ntdll!NtCreateFile+0xa 
000000e7`eed4f130 000007ff`37e95411 KERNELBASE!CreateFileInternal+0x324 
000000e7`eed4f2b0 000007ff`321b60f9 KERNELBASE!CreateFileW+0x6d 
000000e7`eed4f310 000007ff`321b603a sysmain!PfXpGetFileSize+0x39 
000000e7`eed4f360 000007ff`321b2ebe sysmain!PfXpSaveLayout+0x10a 
000000e7`eed4f620 000007ff`321a6460 sysmain!PfXpUpdateOptimalLayout+0x1e4 
000000e7`eed4f790 000007ff`3ab6cd41 sysmain!PfXpTaskCommonCallback+0x40 
000000e7`eed4f7c0 000007ff`3ab58576 ntdll!TppExecuteWaitCallback+0x151 
000000e7`eed4f830 000007ff`38f4167e ntdll!TppWorkerThread+0x388 
000000e7`eed4fad0 000007ff`3ab6c3f1 KERNEL32!BaseThreadInitThunk+0x1a 
000000e7`eed4fb00 00000000`00000000 ntdll!RtlUserThreadStart+0x1d 
kd> !process -1 0 
PROCESS fffffa8002b6d840 
    SessionId: 0  Cid: 03fc    Peb: 7f7ab80e000  ParentCid: 0204 
    DirBase: 186ba000  ObjectTable: fffff8a005ff0f40  HandleCount: <Data Not Accessible> 
    Image: svchost.exe

kd>
```
 
ここで拡張 DLL を実行します。.load して呼び出すだけです。

 
```
kd> .load D:\MSWORK\fext\fext.dll 
kd> !fext.help 
Hello! 
kd> !fext.dumptree @rcx 
L=0000#0000 fffff8a0`00e794c8 : P=fffff8a0`00e794c8 L=fffff8a0`008ee988 R=fffff8a0`00883f28 
L=0000#0001 fffff8a0`008ee988 : P=fffff8a0`00e794c8 L=fffff8a0`0603db38 R=fffff8a0`00901988 
L=0001#0001 fffff8a0`00883f28 : P=fffff8a0`00e794c8 L=00000000`00000000 R=00000000`00000000 
L=0001#0002 fffff8a0`0603db38 : P=fffff8a0`008ee988 L=fffff8a0`020d04c8 R=00000000`00000000 
L=0002#0001 fffff8a0`00901988 : P=fffff8a0`008ee988 L=fffff8a0`00987810 R=00000000`00000000 
L=0002#0002 fffff8a0`020d04c8 : P=fffff8a0`0603db38 L=00000000`00000000 R=fffff8a0`00986060 
L=0003#0001 fffff8a0`00987810 : P=fffff8a0`00901988 L=00000000`00000000 R=00000000`00000000 
L=0003#0002 fffff8a0`00986060 : P=fffff8a0`020d04c8 L=00000000`00000000 R=fffff8a0`06104a38 
L=0004#0001 fffff8a0`06104a38 : P=fffff8a0`00986060 L=00000000`00000000 R=00000000`00000000 
kd> dq @rcx l4 
fffff8a0`00e794c8  fffff8a0`00e794c8 fffff8a0`008ee988 
fffff8a0`00e794d8  fffff8a0`00883f28 00000000`0022000a 
kd>
```
 
別のブレークでも試してみました。今度は win32k のようです。スプレーの途中なので、必ずしも木のルートがパラメーターに来るわけではありません。

 
```
kd> !process -1 0 
PROCESS fffffa80018dd940 
    SessionId: 1  Cid: 09a0    Peb: 7f7daf3f000  ParentCid: 0998 
    DirBase: 214f8000  ObjectTable: fffff8a00740c9c0  HandleCount: <Data Not Accessible> 
    Image: explorer.exe 
kd> k 
Child-SP          RetAddr           Call Site 
fffff880`04fcd518 fffff801`fe0f79eb nt!RtlSplay 
fffff880`04fcd520 fffff960`0028d943 nt!RtlLookupElementGenericTable+0x3b 
fffff880`04fcd550 fffff960`0028d67d win32k!GreUpdateSprite+0x183 
fffff880`04fcd780 fffff960`001e8035 win32k!GreUpdateSpriteDevLockEnd+0x808 
fffff880`04fcdab0 fffff960`001e5b5e win32k!DEVLOCKBLTOBJ::~DEVLOCKBLTOBJ+0x165 
fffff880`04fcdb00 fffff960`001eb4db win32k!NtGdiBitBltInternal+0x9ce 
fffff880`04fcdd60 fffff801`fe08e053 win32k!NtGdiBitBlt+0x5b 
fffff880`04fcddd0 000007ff`38d2322a nt!KiSystemServiceCopyEnd+0x13 
00000000`0257f058 000007ff`38d231f1 GDI32!NtGdiBitBlt+0xa 
00000000`0257f060 000007ff`369273c6 GDI32!BitBlt+0xd1 
(Inline Function) --------`-------- UxTheme!CPaintBuffer::_PaintTargetRect+0x5b 
(Inline Function) --------`-------- UxTheme!CPaintBuffer::_PaintImmediate+0x134 
(Inline Function) --------`-------- UxTheme!CPaintBuffer::EndPaint+0x172 
(Inline Function) --------`-------- UxTheme!CPaintBufferPool::Impl::End+0x1a6 
(Inline Function) --------`-------- UxTheme!CPaintBufferPool::EndBufferedPaint+0x1a9 
00000000`0257f120 000007f7`db5f2637 UxTheme!EndBufferedPaint+0x1f6 
00000000`0257f1b0 000007f7`db5f2023 Explorer!CTaskListWnd::_HandlePaint+0x434 
00000000`0257f2b0 000007f7`db5f1210 Explorer!CTaskListWnd::v_WndProc+0x6f 
00000000`0257f3a0 000007ff`387f3e95 Explorer!CImpWndProc::s_WndProc+0x91 
00000000`0257f3e0 000007ff`387f2a62 USER32!UserCallWinProcCheckWow+0x18d 
00000000`0257f4a0 000007ff`387f294d USER32!DispatchClientMessage+0xf8 
00000000`0257f500 000007ff`3ab54b47 USER32!_fnDWORD+0x2d 
00000000`0257f560 000007ff`387f203a ntdll!KiUserCallbackDispatcherContinue 
00000000`0257f5e8 000007ff`387f204c USER32!NtUserDispatchMessage+0xa 
00000000`0257f5f0 000007f7`db5f1131 USER32!DispatchMessageWorker+0x2af 
00000000`0257f670 000007f7`db61b41e Explorer!CTray::_MessageLoop+0x122 
00000000`0257f700 000007ff`36641d4c Explorer!CTray::MainThreadProc+0x86 
00000000`0257f730 000007ff`38f4167e SHCORE!COplockFileHandle::v_GetHandlerCLSID+0x12c 
00000000`0257f820 000007ff`3ab6c3f1 KERNEL32!BaseThreadInitThunk+0x1a 
00000000`0257f850 00000000`00000000 ntdll!RtlUserThreadStart+0x1d 
kd> !fext.dumptree @rcx 
L=0000#0000 fffff901`007780c0 : P=fffff901`007560b0 L=fffff901`0071f1f0 R=fffff901`03c63d30 
L=0000#0001 fffff901`0071f1f0 : P=fffff901`007780c0 L=00000000`00000000 R=00000000`00000000 
L=0001#0001 fffff901`03c63d30 : P=fffff901`007780c0 L=fffff901`00742230 R=fffff901`03c1f280 
L=0001#0002 fffff901`00742230 : P=fffff901`03c63d30 L=fffff901`03c17280 R=fffff901`03c51590 
L=0002#0001 fffff901`03c1f280 : P=fffff901`03c63d30 L=00000000`00000000 R=fffff901`03c440c0 
L=0002#0002 fffff901`03c17280 : P=fffff901`00742230 L=00000000`00000000 R=fffff901`006e3280 
L=0003#0001 fffff901`03c51590 : P=fffff901`00742230 L=00000000`00000000 R=00000000`00000000 
L=0003#0002 fffff901`03c440c0 : P=fffff901`03c1f280 L=00000000`00000000 R=fffff901`03c252b0 
L=0003#0003 fffff901`006e3280 : P=fffff901`03c17280 L=00000000`00000000 R=00000000`00000000 
L=0004#0001 fffff901`03c252b0 : P=fffff901`03c440c0 L=fffff901`0014b240 R=00000000`00000000 
L=0004#0002 fffff901`0014b240 : P=fffff901`03c252b0 L=00000000`00000000 R=fffff901`03c4b400 
L=0005#0001 fffff901`03c4b400 : P=fffff901`0014b240 L=00000000`00000000 R=00000000`00000000
```
