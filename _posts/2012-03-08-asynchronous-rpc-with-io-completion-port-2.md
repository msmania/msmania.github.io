---
layout: post
title: "[Win32] [C++] Asynchronous RPC with I/O Completion Port - #2"
date: 2012-03-08 01:15:52.000 +09:00
categories:
- C/C++
- Windows
tags:
- RPC
---

続きです。今回は RPC サーバーを書きます。 <br />
が、その前にクライアントとサーバーの共通コードを貼っておきます。RPC とは直接関係ないです。

  
### 2. クライアント/サーバー共通のコード

 
これがヘッダー。 <br />
これだけを見ても意味不明かと思いますが、、、完成までお待ちください。

 
```
// 
// AsyncCommon.h 
//

#pragma once

#define MAX_LOGGING 1000

extern WCHAR ErrorMsg[];

#define LOGINFO(text, code) \ 
if ( g_Dlg ) { \ 
    StringCchPrintf(ErrorMsg, MAX_LOGGING, text, code); \ 
    AppendWindowText(GetDlgItem(g_Dlg, IDC_EDIT1), ErrorMsg); \ 
}

#define LOGERROR LOGINFO 

//#define LOGERROR(text, code) { \ 
//    StringCchPrintf(ErrorMsg, MAX_LOGGING, text, code); \ 
//    MessageBox(g_Dlg, ErrorMsg, L"Error", MB_ICONERROR); }

#define MAX_ENDPOINT 32

enum RPC_PROTOCOL_TYPE : unsigned int  { 
    Rpc_Tcpip, 
    Rpc_NamedPipe, 
    Rpc_Lpc, 
    Rpc_NotSupported 
};

typedef struct _RPC_PROTOCOL { 
    RPC_PROTOCOL_TYPE Protocol; 
    WCHAR Name[MAX_ENDPOINT]; 
    WCHAR FriendlyName[MAX_ENDPOINT]; 
    WCHAR DefaultEndpoint[16]; 
} RPC_PROTOCOL, *PRPC_PROTOCOL;

extern RPC_PROTOCOL SupportedProtocols[];

BOOL AppendWindowText(HWND Textbox, LPCTSTR Message); 
```
 
次にソースファイル。 <br />
テキストボックスへのログ表示用の関数です。あとは RPC プロトコル用の定数。まあ・・・これも完成するまでは意味不明ですね。

 
```
// 
// AsyncCommon.cpp 
//

#include <Windows.h> 
#include <strsafe.h>

#include "AsyncCommon.h"

WCHAR ErrorMsg[MAX_LOGGING]; // used in LOGINFO, LOGERROR

RPC_PROTOCOL SupportedProtocols[]= { 
    {Rpc_Tcpip,        L"ncacn_ip_tcp", L"TCP/IP",     L"50000" }, 
    {Rpc_NamedPipe,    L"ncacn_np",     L"Named Pipe", L"\\pipe\\asyncrpc" }, 
    {Rpc_Lpc,          L"ncalrpc",      L"LPC",        L"asyncrpc_lpc" }, 
    {Rpc_NotSupported, L"N/A",          L"N/A",        L"N/A" } 
};

BOOL AppendWindowText(HWND Textbox, LPCTSTR Message) { 
    if ( Message==NULL || Textbox==NULL ) 
        return FALSE;

    size_t Length= 0; 
    if ( FAILED(StringCbLength(Message, MAX_LOGGING, &Length)) ) 
        Length= 0;

    Length= min(Length, MAX_LOGGING); 
    
    PWSTR Buffer1= new WCHAR[MAX_LOGGING+1]; 
    PWSTR Buffer2= new WCHAR[MAX_LOGGING+1];

    if ( !Buffer1 || !Buffer2 ) 
        return FALSE; 
    
    GetWindowText(Textbox, Buffer1, MAX_LOGGING);

    SYSTEMTIME st; 
    GetLocalTime(&st);

    StringCchPrintf(Buffer2, MAX_LOGGING, 
        L"[%d/%02d/%02d %02d:%02d:%02d.%03d] %s\r\n%s", 
        st.wYear, 
        st.wMonth, 
        st.wDay, 
        st.wHour, 
        st.wMinute, 
        st.wSecond, 
        st.wMilliseconds, 
        Message, 
        Buffer1);

    return SetWindowText(Textbox, Buffer2); 
} 
```
 
 

 
### 3. RPC サーバーを書く

 
いよいよ RPC サーバーです。ファイルは 3 つです。

 
- AsyncServer.h ・・・ CAsyncServer クラスの宣言
- AsyncSercer.cpp ・・・ CAsyncServer クラス、RPC メソッド本体の定義
- main.cpp ・・・ WinMain、ウィンドウ処理

 
今回は真っ当に C++ で書きました。C だけだとけっこう面倒なことになると思います。 <br />
CAsyncServer クラスは、待機スレッドの処理がメインです。GUI なので、クライアントからの要求を待機するスレッドを作らないとウィンドウがフリーズしてしまうのです。

 
#### AsyncServer.h

 
今回は RPC で使うプロトコルを TCP/IP、名前付きパイプ、LPC の 3 つを選べるようにしたので、その情報をメンバー変数として持たせています。それが RPC_PROTOCOL_TYPE 列挙型です。

 
```
// 
// AsyncServer.h 
//

#pragma once

#include "resource.h"

#include "..\AsyncCommon.h"

extern HWND g_Dlg;

class CAsyncServer { 
private: 
    HANDLE mThread; 
    DWORD WINAPI RpcServerThread(); 
    static DWORD WINAPI StartRpcServerThread(LPVOID); 
    
    RPC_PROTOCOL_TYPE mProtocol;

    VOID StopAndDestroyThread();

public: 
    WCHAR mEndpoint[MAX_ENDPOINT]; 
    int mMaxInstances;

    CAsyncServer(); 
    ~CAsyncServer();

    inline VOID SetProtocolType(LRESULT l) { 
        mProtocol= (RPC_PROTOCOL_TYPE)min(l, Rpc_NotSupported); 
    }

    VOID StartStopRpcServer(); 
}; 
```
 
#### AsyncServer.cpp

 
RpcServerThread が待機スレッドです。これは同期でも非同期でも変わりません。

 
RpcSleepAsync が、今回のメインとなる非同期 RPC メソッドの本体です。ほとんどを MSDN からコピペしています。同期 RPC メソッドとは異なり、第一引数に RPC_ASYNC_STATE 構造体へのポインターを受け取ります。ここで重要なのは RpcAsyncCompleteCall API の実行です。この API は、クライアントとサーバーの両方のメソッドから呼び出す必要があるのがミソです。サーバー側で RpcAsyncCompleteCall を呼び出すことで、クライアント側にコールバックが発生します。

 
RpcAsyncCompleteCall function <br />
[http://msdn.microsoft.com/en-us/library/windows/desktop/aa375572(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/windows/desktop/aa375572(v=vs.85).aspx)

 
```
// 
// AsyncServer.cpp 
//

#include <Windows.h> 
#include <strsafe.h>

#include "AsyncServer.h" 
#include "..\idl\pipo.h"

#pragma comment(lib, "rpcrt4.lib")

DWORD CAsyncServer::RpcServerThread() { 
    RPC_STATUS Status= RPC_S_OK; 
    RPC_PROTOCOL &Protocol= 
      SupportedProtocols[min(mProtocol, Rpc_NotSupported)];

    if ( Protocol.Protocol==Rpc_Tcpip ) { 
        RPC_POLICY Policy; 
        Policy.Length= sizeof(RPC_POLICY); 
        Policy.NICFlags= 0; 
        Policy.EndpointFlags= 0; 
        //Policy.EndpointFlags= RPC_C_USE_INTRANET_PORT; 
        //Policy.EndpointFlags= RPC_C_USE_INTERNET_PORT;

        //Status = RpcServerUseProtseqEx((RPC_WSTR)Protocol.Name, mMaxInstances, NULL, &Policy); 
        //if ( Status!=RPC_S_OK ) { 
        //    LOGERROR(L"RpcServerUseProtseqEpEx failed - 0x%08x", Status); 
        //    goto cleanup; 
        //} 
    }

    Status = RpcServerUseProtseqEp((RPC_WSTR)Protocol.Name, 
      mMaxInstances, (RPC_WSTR)mEndpoint, NULL); 
    if ( Status==RPC_S_DUPLICATE_ENDPOINT ) { 
        LOGINFO(L"The endpoint '%s' is already registered.", mEndpoint); 
    } 
    else if ( Status!=RPC_S_OK ) { 
        LOGERROR(L"RpcServerUseProtseqEp failed - 0x%08x", Status); 
        goto cleanup; 
    } 
  
    Status= RpcServerRegisterIf(pipo_v1_0_s_ifspec, NULL, NULL); 
    if (Status!=RPC_S_OK) { 
        LOGERROR(L"RpcServerRegisterIf failed - 0x%08x", Status); 
        goto cleanup; 
    } 
  
    LOGINFO(L"RPC Server listening...", 0);

    Status = RpcServerListen(1, mMaxInstances, 0); 
    if (Status!=RPC_S_OK) { 
        LOGERROR(L"RpcServerListen failed - 0x%08x", Status); 
        
        Status= RpcServerUnregisterIf(NULL, NULL, FALSE); 
        if ( Status!=RPC_S_OK ) 
            LOGERROR(L"RpcServerUnregisterIf failed - 0x%08x", Status);

        goto cleanup; 
    }

cleanup: 
    ExitThread(Status); 
    return Status; 
}

DWORD CAsyncServer::StartRpcServerThread(LPVOID Param) { 
    if ( Param==NULL ) 
        return 0; 
    return ((CAsyncServer*)Param)->RpcServerThread(); 
}

CAsyncServer::CAsyncServer() 
    : mThread(NULL), 
      mProtocol(Rpc_NotSupported), 
      mMaxInstances(1) { 
    mEndpoint[0]= 0; 
}

CAsyncServer::~CAsyncServer() { 
    StopAndDestroyThread(); 
}

VOID CAsyncServer::StopAndDestroyThread() { 
    if ( mThread ) { 
        Shutdown(); 
        WaitForSingleObject(mThread, INFINITE);

        CloseHandle(mThread); 
        mThread= NULL; 
    } 
}

VOID CAsyncServer::StartStopRpcServer() { 
    if ( mThread ) 
        StopAndDestroyThread(); 
    else { 
        mThread= CreateThread(NULL, 0, CAsyncServer::StartRpcServerThread, 
          this, 0, NULL); 
        if ( mThread==NULL ) 
            LOGERROR(L"CreateThread failed - 0x%08x", GetLastError()); 
    } 
}

void __RPC_FAR * __RPC_USER midl_user_allocate(size_t len) { 
    return malloc(len); 
}

void __RPC_USER midl_user_free(void __RPC_FAR * ptr) { 
    free(ptr); 
}

void RpcSleep(int Duration) { 
    LOGINFO(L"(Sleep) start. duration:%umsec...", Duration); 
    Sleep(Duration); 
    LOGINFO(L"(Sleep) done.", 0); 
}

void Shutdown() { 
    RPC_STATUS Status= RPC_S_OK;

    Status= RpcMgmtStopServerListening(NULL); 
    if ( Status!=RPC_S_OK ) 
        LOGERROR(L"(Shutdown) RpcMgmtStopServerListening failed - 0x%08x", 
          Status);

    Status = RpcServerUnregisterIf(NULL, NULL, FALSE); 
    if ( Status!=RPC_S_OK ) 
        LOGINFO(L"(Shutdown) RpcServerUnregisterIf failed - 0x%08x", Status);

    LOGINFO(L"(Shutdown) done.", 0); 
}

// 
// http://msdn.microsoft.com/en-us/library/windows/desktop/aa378667(v=vs.85).aspx 
//

#define ASYNC_CANCEL_CHECK  100 
#define DEFAULT_ASYNC_DELAY 10000

void RpcSleepAsync(IN PRPC_ASYNC_STATE pAsync, IN int Duration) { 
    int nReply = 1; 
    RPC_STATUS Status; 
    unsigned long nTmpAsychDelay; 
  
    LOGINFO(L"(SleepAsync) start. duration:%umsec...", Duration);

    if (Duration < 0) 
        Duration = DEFAULT_ASYNC_DELAY; 
    else if (Duration < 100) 
        Duration = 100;

    // We only call RpcServerTestCancel if the call takes longer than ASYNC_CANCEL_CHECK ms 
    if(Duration > ASYNC_CANCEL_CHECK){ 
        nTmpAsychDelay= Duration/100; 
        for ( int i=0 ; i<100 ; ++i ){ 
            Sleep(nTmpAsychDelay); 
  
            if (i%5 == 0){ 
                //LOGINFO(L"(SleepAsync) %lu ms...", Duration); 
  
                Status=  RpcServerTestCancel(RpcAsyncGetCallHandle(pAsync)); 
                if ( Status==RPC_S_OK ) { 
                    LOGINFO(L"(SleepAsync) canceled.", 0); 
                    break; 
                } 
                else if ( Status!=RPC_S_CALL_IN_PROGRESS ) { 
                    LOGINFO(L"(SleepAsync) RpcAsyncInitializeHandle returned 0x%x", Status); 
                    exit(Status); 
                } 
            } 
        } 
    } 
    else 
        Sleep(Duration); 
  
    Status= RpcAsyncCompleteCall(pAsync, &nReply); 
    LOGINFO(L"(SleepAsync) done.", 0);

    if ( Status!=RPC_S_OK ) { 
        LOGERROR(L"(SleepAsync) RpcAsyncCompleteCall failed - 0x%08x", 
          Status); 
        exit(Status); 
    } 
} 
```
 
#### main.cpp

 
最後のファイル。ほとんど UI 部分の処理です。 <br />
IDOK ボタンがクリックされると CAsyncServer::StartStopRpcServer を実行し、待機スレッドを開始します。他には特に何もしません。

 
```
// 
// main.cpp 
//

#include <Windows.h>

#include "AsyncServer.h"

HWND g_Dlg= NULL; 
CAsyncServer *g_AsyncServer= NULL;

INT_PTR CALLBACK DlgProc(HWND Dlg, UINT Msg, WPARAM w, LPARAM l) { 
    HWND Control= NULL;

    switch ( Msg ) { 
    case WM_INITDIALOG: 
        g_Dlg= Dlg; 
        
        Control= GetDlgItem(Dlg, IDC_COMBO_PROTOCOL);

        for ( PRPC_PROTOCOL p= SupportedProtocols ; 
              p->Protocol!=Rpc_NotSupported ; ++p ) 
            SendMessage(Control, CB_ADDSTRING, NULL, 
               (LPARAM)p->FriendlyName);

        SetDlgItemInt(Dlg, IDC_EDIT_INSTANCES, 10, FALSE); 
        PostMessage(Control, CB_SETCURSEL, 0, NULL); 
        PostMessage(Dlg, WM_COMMAND, 
          MAKELONG(IDC_COMBO_PROTOCOL, CBN_SELCHANGE), (LPARAM)Control); 
        return TRUE;

    case WM_COMMAND: 
        switch ( LOWORD(w) ) { 
        case IDCANCEL: 
            EndDialog(Dlg, IDOK); 
            break; 
        case IDOK: 
            g_AsyncServer->SetProtocolType(SendMessage( 
               GetDlgItem(Dlg, IDC_COMBO_PROTOCOL), CB_GETCURSEL, 0, 0)); 
            g_AsyncServer->mMaxInstances= 
               GetDlgItemInt(Dlg, IDC_EDIT_INSTANCES, NULL, FALSE); 
            GetDlgItemText(Dlg, IDC_EDIT_ENDPOINT, 
               g_AsyncServer->mEndpoint, MAX_ENDPOINT);            
            g_AsyncServer->StartStopRpcServer(); 
            break; 
        case IDC_COMBO_PROTOCOL: 
            if ( HIWORD(w)==CBN_SELCHANGE ) { 
                LRESULT Selected= SendMessage((HWND)l, CB_GETCURSEL, 0, 0); 
                SetWindowText(GetDlgItem(Dlg, IDC_EDIT_ENDPOINT), 
                  SupportedProtocols[ 
                  min(Selected, Rpc_NotSupported)].DefaultEndpoint); 
            } 
            break; 
        } 
        break; 
    } 
    return FALSE; 
}

int WINAPI wWinMain(HINSTANCE hInstance, 
                    HINSTANCE, 
                    PWSTR pCmdLine, 
                    int nCmdShow) { 
    g_AsyncServer= new CAsyncServer(); 
    if ( g_AsyncServer ) { 
        DialogBox(hInstance, MAKEINTRESOURCE(IDD_DIALOG1), NULL, DlgProc); 
        delete g_AsyncServer; 
    } 
    return 0; 
} 
```
 
#### ダイアログボックスの外観

 
すっかり忘れていました。作成したダイアログボックスはこんな外観です。 <br />
起動して、&#x5b;Named Pipe&#x5d; を選択して &#x5b;Start/Stop&#x5d; をクリックするとこんな感じに待機スレッドが開始されたことが表示されます。それぞれのコントロールの ID は、、、main.cpp からお察し下さい。

 ![]({{site.assets_url}}2012-03-08-image.png)