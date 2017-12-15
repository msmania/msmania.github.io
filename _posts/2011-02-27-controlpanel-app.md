---
layout: post
title: "[Win32] [C++] 独自のコントロールパネル アプリケーションを作る"
date: 2011-02-27 11:46:50.000 +09:00
categories:
- C/C++
- Windows
tags:
- CPlApplet、DLL
---

IP アドレスの設定ををするときに、&#x5b;ファイルを名を指定して実行&#x5d; から ncpa.cpl を実行して、ネットワーク接続の一覧を開いている人は多いかと思います。%systemroot%\system32 フォルダには control.exe というプログラムがあり、こいつがコントロールパネルの正体なわけですが、cpl ファイルは control.exe に読み込まれるファイルなんだろう、と適当に考えていました。

 
しかし、偶々 cpl ファイルについて書かれたウェブサイトを見て、これが DLL ということを知りました。独自ダイアログボックスを持つ適当なコントロールパネル アプリケーション （「日付と時刻」など） を実行し、タスク マネージャーからプロセスを見てみると、rundll32.exe が動いています。ncpa.cpl は独自のダイアログボックスを持たず、シェルに統合されているようなので、explorer.exe からロードされます。

 
とりあえず作ってみようということで、簡単なコントロールパネル アプリケーションを作ってみました。MSDN にサンプルがあったので、それをもっとシンプルに書き換えました。これで十分動きます。リソースは、IDI_ICON1 というアイコンと IDD_DIALOG1 というダイアログを追加しただけです。

 
[http://msdn.microsoft.com/en-us/library/ms914264.aspx](http://msdn.microsoft.com/en-us/library/ms914264.aspx)

 
```
// 
// main.cpp 
//

#include <Windows.h> 
#include <Cpl.h> 
#include <strsafe.h>

#include "resource.h"

#define DLLEXPORT __declspec(dllexport) 
#define DLLIMPORT __declspec(dllimport)

HINSTANCE g_hDll= NULL;

const WCHAR g_CplTitle[]= L"MyCPL"; 
const WCHAR g_CplInfo[]= L"Hello";

BOOL APIENTRY DllMain(HMODULE hModule, DWORD  ul_reason_for_call, LPVOID lpReserved) { 
    switch (ul_reason_for_call) { 
    case DLL_PROCESS_ATTACH: 
        g_hDll= hModule; 
    case DLL_THREAD_ATTACH: 
    case DLL_THREAD_DETACH: 
    case DLL_PROCESS_DETACH: 
        break; 
    } 
    return TRUE; 
}

INT_PTR CALLBACK DlgProc(HWND hWnd, UINT msg, WPARAM w, LPARAM l) { 
    switch ( msg ) { 
    case WM_INITDIALOG: 
        return TRUE; 
        break; 
    case WM_COMMAND: 
        if ( w==IDOK || w==IDCANCEL ) { 
            EndDialog(hWnd, w); 
        } 
        break; 
    } 
    return 0; 
}

LONG CALLBACK CPlApplet(HWND hwndCPL, UINT message, LPARAM lParam1, LPARAM lParam2) { 
    switch (message) { 
    case CPL_INIT: 
        // Perform global initializations, especially memory 
        // allocations, here. 
        // Return 1 for success or 0 for failure. 
        // Control Panel does not load if failure is returned. 
        return 1;

    case CPL_GETCOUNT: 
        // The number of actions supported by this Control 
        // Panel application. 
        return 1;

    case CPL_NEWINQUIRE: 
        // This message is sent once for each dialog box, as 
        // determined by the value returned from CPL_GETCOUNT. 
        // lParam1 is the 0-based index of the dialog box. 
        // lParam2 is a pointer to the NEWCPLINFO structure. 
        if ( lParam2 ) { 
            NEWCPLINFO *pNewCpl= (NEWCPLINFO*)lParam2; 
            pNewCpl->dwSize = sizeof(NEWCPLINFO); 
            pNewCpl->dwFlags = 0; 
            pNewCpl->dwHelpContext = 0; 
            pNewCpl->lData = 0; // user-defined

            // The large icon for this application. Do not free this 
            // HICON; it is freed by the Control Panel infrastructure. 
            pNewCpl->hIcon = LoadIcon(g_hDll, MAKEINTRESOURCE(IDI_ICON1)); 
            
            StringCbCopy( 
              pNewCpl->szName, sizeof(pNewCpl->szName), g_CplTitle); 
            StringCbCopy( 
              pNewCpl->szInfo, sizeof(pNewCpl->szInfo), g_CplInfo); 
            pNewCpl->szHelpFile[0]= 0;

            return 0; 
        } 
        return 1;  // Nonzero value means CPlApplet failed.

    case CPL_DBLCLK: 
        // The user has double-clicked the icon for the 
        // dialog box in lParam1 (zero-based). 
        DialogBox(g_hDll, MAKEINTRESOURCE(IDD_DIALOG1), hwndCPL, DlgProc); 
        return 0;

    case CPL_STOP: // Called once for each dialog box. Used for cleanup. 
    case CPL_EXIT: // Called only once for the application. Used for cleanup. 
    default: 
        return 0; 
    }

    return 1;  // CPlApplet failed. (norun) 
} 
```
 
エクスポートする関数は一つだけですが、定義ファイルでエクスポート。序数はつけてもつけなくても OK。

 
```
; 
; mycpl.def 
;

LIBRARY mycpl 
EXPORTS 
    CPlApplet    @100 
```
 
ビルドすると DLL ファイルができるので、拡張子を cpl に変更して system32 フォルダに放り込んでおけば、次回起動時にコントロールパネルに表示されます。

 
![]({{site.assets_url}}2011-02-27-image.png)

 
ダブルクリックするとダイアログが開きます。

