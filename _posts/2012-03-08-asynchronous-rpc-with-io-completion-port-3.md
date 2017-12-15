---
layout: post
title: "[Win32] [C++] Asynchronous RPC with I/O Completion Port – #3"
date: 2012-03-08 02:26:15.000 +09:00
categories:
- C/C++
- Windows
tags:
- CreateIoCompletionPort
- GetQueuedCompletionStatus
- RPC
---

次に RPC クライアントです。

 
### 4. RPC クライアントを書く

 
同期 RPC のときは、適当なプロトコルを選んでバインドしてから、自動生成されたスタブを呼び出すだけでしたが、非同期 RPC ではもっと面倒です。コールバックの仕組みを自分で用意しなけれななりません。最初に書いたように、今回は I/O 完了ポートを使ってみます。面倒です。

 
ファイルは、RPC クライアントと同じく 3 つ。ですが、クラスは 2 つ用意します。

 
- AsyncClient.h ・・・ AsyncRpcHandler クラス、CAsyncClient クラスの宣言
- AsyncClient.cpp ・・・ AsyncRpcHandler クラス、CAsyncClient クラスの定義
- main.cpp ・・・ WinMain、ウィンドウ処理

 
IDL ファイルのインターフェース定義で書いたように、今回実装する非同期 RPC メソッドは RpcSleepAsync の 1 つだけです。AsyncRpcHandler クラスは、この RpcSleepAsync のスタブを呼び出す処理と、コールバック処理を実装します。

 
CAsyncClient クラスは、I/O 完了ポートを使ったコールバックの処理を実装します。具体的には、I/O 完了ポート用のワーカー スレッドを準備し、RPC サーバーからコールバックが来たら AsyncRpcHandler の街頭メソッドを呼び出すという処理を行ないます。

 
RPC クライアントを C 言語だけで書くのは辛そうです。

 
#### AsyncClient.h

 
上に書いたように、2 つのクラスのプロトタイプ宣言です。 <br />
NUMBER_OF_THREADS で、I/O 完了ポートで使う待機スレッドの最大数を指定します。

 
```
// 
// AsyncClient.h 
//

#pragma once

#include "resource.h" 
#include "..\AsyncCommon.h"

extern HWND g_Dlg;

#define NUMBER_OF_THREADS 5

typedef struct _METHOD_CONTEXT { 
    DWORD SessionID; 
    DWORD Status; 
    OVERLAPPED Overlapped; 
} METHOD_CONTEXT, *PMETHOD_CONTEXT;

class AsyncRpcHandler { 
private: 
    HANDLE mCompletionPort;

    RPC_ASYNC_STATE mAsyncState; 
    METHOD_CONTEXT mContext;

public: 
    AsyncRpcHandler(HANDLE); 
    ~AsyncRpcHandler() {}

    VOID Sleep(DWORD); 
    BOOL ProcessComplete();

};

class CAsyncClient { 
private: 
    HANDLE mCompletionPort; 
    HANDLE mThreads[NUMBER_OF_THREADS]; 
    
    RPC_PROTOCOL_TYPE mProtocol;

    static DWORD CALLBACK WorkerThreadStart(PVOID); 
    DWORD WorkerThread();

public: 
    WCHAR mEndpoint[MAX_ENDPOINT]; 
    WCHAR mServer[MAX_ENDPOINT];

    CAsyncClient(); 
    ~CAsyncClient();

    inline operator HANDLE() const { return mCompletionPort; } 
    
    BOOL InitializeThreadPool(); 
    BOOL Bind(); 
    
    inline VOID SetProtocolType(LRESULT l) { 
        mProtocol= (RPC_PROTOCOL_TYPE)min(l, Rpc_NotSupported); 
    }

}; 
```
 
#### AsyncClient.cpp

 
クラスを実装します。このファイルにエッセンスがいろいろ詰まっています。

 
まず、AsyncRpcHandler::Sleep がスタブを呼び出す処理です。同期 RPC と違うのは RPC_ASYNC_STATE をスタブに渡す必要がある点です。ACF ファイルで指定した &#x5b;async&#x5d; 属性によって、非同期のスタブとしてプロトタイプ宣言が生成されています。 <br />
RpcAsyncInitializeHandle API で RPC_ASYNC_STATE 構造体の Size, Signature, Lock, StubInfo メンバーを埋めてもらいます。その他のメンバーは自分で埋める必要があります。ここで、コールバックの種類や、ユーザー定義データを設定します。今回は I/O 完了ポートを使うので NotificationTypeIoc に RpcNotificationTypeIoc を指定します。 <br />
非同期 RPC なので、RPC サーバーの処理に関係なく AsyncRpcHandler::Sleep の処理は滞りなく終了します。

 
コールバックを受け取った後の処理が AsyncRpcHandler::ProcessComplete です。これは CAsyncServer クラスの処理として、コールバックが来たときに ProcessComplete メンバーを呼び出すように実装しています。ProcessComplete で重要なのは、RpcAsyncCompleteCall API の実行です。この API は RPC サーバーにおける RPC メソッド本体の RpcSleepAsync 関数でも呼び出していました。 <br />
クライアント側で RpcAsyncCompleteCall を実行することで、サーバー側の RpcAsyncCompleteCall に第二引数として渡した戻り値を受け取ることができます。したがって基本的には、クライアントが RpcAsyncCompleteCall を呼び出すのはサーバー側の処理後である必要があります。もし、サーバーが RpcAsyncCompleteCall を呼び出していない段階でクライアントが RpcAsyncCompleteCall を呼ぶと、戻り値が RPC_S_ASYNC_CALL_PENDING となり、判別できます。

 
CAsyncClient クラスは、I/O 完了ポート関連の処理です。InitializeThreadPool で CreateIoCompletionPort API を実行し、ワーカー スレッドを必要なだけ (ここでは NUMBER_OF_THREADS 定数で指定した分だけ) 作ります。 <br />
CAsyncClient::WorkerThread が I/O 完了ポートのワーカースレッドであり、GetQueuedCompletionStatus API で待機に入ります。サーバー側の RPC 処理が完了すると GetQueuedCompletionStatus から制御が返ってくるので、上で説明した完了ルーチンである AsyncRpcHandler::ProcessComplete を実行します。 <br />
ここでのポイントは、AsyncRpcHandler クラス インスタンスへのポインターを Overlapped を使って取得している点です。上の説明では飛ばしましたが、クライアントのコールバック関数で RpcAsyncCompleteCall を呼び出す場合に、第一引数に RPC_SYNC_STATE 構造体を渡す必要があります。このとき、メソッドを呼び出す際に指定した RPC_ASYNC_STATE と Signature などの値が一致していないとおかしな動作になります。つまり、まだ実行中のメソッドや、そもそも呼び出してさえいない Signature である RPC_ASYNC_STATE を使って RpcAsyncCompleteCall を呼び出すと、例外が発生します。そのため、AsyncRpcHandler::Sleep の中でメソッド実行時に mAsyncState.u.IOC.lpOverlapped に this ポインターを渡しています。コールバックが来たときに GetQueuedCompletionStatus によって取得される Overlapped には、メソッド呼び出し時の this ポインターが含まれているため、これを使って ProcessComplete を呼び出すことで、メソッド呼び出し時と同じ AsyncRpcHandler クラス インスタンスを保証することができます。

 
```
// 
// AsyncClient.cpp 
//

#include <Windows.h> 
#include <strsafe.h>

#include "AsyncClient.h" 
#include "..\idl\pipo.h"

#pragma comment(lib, "rpcrt4.lib")

void __RPC_FAR * __RPC_API midl_user_allocate(size_t len) { 
    return(malloc(len)); 
}

void __RPC_API midl_user_free(void __RPC_FAR * ptr) { 
    free(ptr); 
}

AsyncRpcHandler::AsyncRpcHandler(HANDLE Port) 
    : mCompletionPort(Port) 
{}

VOID AsyncRpcHandler::Sleep(DWORD Duration) { 
    RPC_STATUS Status= RPC_S_OK;

    Status = RpcAsyncInitializeHandle(&mAsyncState, sizeof(RPC_ASYNC_STATE)); 
    if (Status) { 
        LOGERROR(L"RpcAsyncInitializeHandle failed - 0x%08x", Status); 
        return; 
    }

    mContext.SessionID= rand();

    mAsyncState.UserInfo = NULL; 
    mAsyncState.NotificationType = RpcNotificationTypeIoc; 
    mAsyncState.u.IOC.hIOPort= mCompletionPort; 
    mAsyncState.u.IOC.lpOverlapped= (LPOVERLAPPED)this; 
    mAsyncState.u.IOC.dwCompletionKey= 1; 
    mAsyncState.u.IOC.dwNumberOfBytesTransferred= sizeof(AsyncRpcHandler);

     RpcTryExcept 
        RpcSleepAsync(&mAsyncState, Duration); 
    RpcExcept( EXCEPTION_EXECUTE_HANDLER ) 
        LOGERROR(L"RPC exception - 0x%08x", RpcExceptionCode()); 
    RpcEndExcept

    LOGINFO(L"(SleepAsync) invoked. sessid:0x%08x", mContext.SessionID); 
}

BOOL AsyncRpcHandler::ProcessComplete() { 
    RPC_STATUS Status; 
    PVOID Reply= NULL;

    Status= RpcAsyncCompleteCall(&mAsyncState, Reply); 
    if ( Status==RPC_S_ASYNC_CALL_PENDING ) 
        return TRUE;

    if ( Status!=RPC_S_OK ) { 
        LOGERROR(L"RpcAsyncCompleteCall failed - 0x%08x", Status); 
        return FALSE; 
    }

    LOGINFO(L"(SleepAsync) done. sessid:0x%08x", mContext.SessionID);

    delete this;

    return TRUE; 
}

CAsyncClient::CAsyncClient() 
    : mCompletionPort(NULL) { 
    ZeroMemory(mThreads, NUMBER_OF_THREADS*sizeof(HANDLE)); 
}

CAsyncClient::~CAsyncClient() { 
    if ( pipo_IfHandle ) 
        RpcBindingFree(&pipo_IfHandle); 
    
    if ( mCompletionPort!=NULL ) 
        CloseHandle(mCompletionPort);

    WaitForMultipleObjects(NUMBER_OF_THREADS, mThreads, TRUE, INFINITE);

    for ( int i=0 ; i<NUMBER_OF_THREADS ; ++i ) { 
        if ( mThreads[i] ) 
            CloseHandle(mThreads[i]); 
    } 
}

DWORD CALLBACK CAsyncClient::WorkerThreadStart(PVOID Param) { 
    if ( Param ) 
        return ((CAsyncClient*)Param)->WorkerThread();

    return 0; 
}

DWORD CAsyncClient::WorkerThread() { 
    BOOL Ret= FALSE; 
    DWORD BytesTransferred= 0; 
    ULONG_PTR CompletionKey= NULL; 
    LPOVERLAPPED Overlapped= NULL;

    do { 
        Ret= GetQueuedCompletionStatus( 
            mCompletionPort, 
            &BytesTransferred, 
            &CompletionKey, 
            &Overlapped, 
            INFINITE); 
        if ( !Ret ) { 
            LOGERROR(L"GetQueuedCompletionStatus failed - 0x%08x\n", 
              GetLastError()); 
            goto cleanup; 
        } 
        
        if ( !((AsyncRpcHandler*)Overlapped)->ProcessComplete() ) 
            break; 
    } while (1);

cleanup: 
    ExitThread(0); 
    return 0; 
}

BOOL CAsyncClient::InitializeThreadPool() { 
    BOOL Ret= FALSE;

    if ( !mCompletionPort ) { 
        mCompletionPort= CreateIoCompletionPort(INVALID_HANDLE_VALUE, 
            NULL, NULL, NUMBER_OF_THREADS); 
        if ( mCompletionPort==NULL ) { 
            LOGERROR(L"CreateIoCompletionPort failed - 0x%08x", 
              GetLastError()); 
            goto cleanup; 
        } 
    }

    for ( int i=0 ; i<NUMBER_OF_THREADS ; ++i ) { 
        if ( mThreads[i]==NULL ) { 
            mThreads[i]= CreateThread(NULL, 0, WorkerThreadStart, 
              this, 0, NULL); 
            if ( mThreads[i]==NULL ) 
                LOGERROR(L"CreateThread failed - 0x%08x", GetLastError()); 
        } 
    } 
    
    LOGERROR(L"Thread Pool initiated. (%d threads)", NUMBER_OF_THREADS);

    Ret= TRUE;

cleanup: 
    return Ret; 
}

BOOL CAsyncClient::Bind() { 
    BOOL Ret= FALSE; 
    RPC_STATUS Status= RPC_S_OK; 
    RPC_PROTOCOL &Protocol= 
      SupportedProtocols[min(mProtocol, Rpc_NotSupported)]; 
    RPC_WSTR BindStr= NULL;

    Status= RpcStringBindingCompose(NULL, 
        (RPC_WSTR)Protocol.Name, 
        (RPC_WSTR)mServer, 
        (RPC_WSTR)mEndpoint, NULL, &BindStr); 
    if (Status!=RPC_S_OK) { 
        LOGERROR(L"RpcStringBindingCompose failed - 0x%08x\n", Status); 
        goto cleanup; 
    }

    if ( pipo_IfHandle ) { 
        Status= RpcBindingFree(&pipo_IfHandle); 
        if ( Status!=RPC_S_OK ) 
            LOGERROR(L"RpcBindingFree failed - 0x%08x\n", Status); 
        pipo_IfHandle= NULL; 
    }

    Status= RpcBindingFromStringBinding(BindStr, &pipo_IfHandle); 
    if (Status!=RPC_S_OK) { 
        LOGERROR(L"RpcBindingFromStringBinding failed - 0x%08x\n", Status); 
        goto cleanup; 
    }

    Ret= TRUE;

cleanup: 
    if ( BindStr ) 
        RpcStringFree(&BindStr);

    return Ret; 
} 
```
 
#### main.cpp

 
最後のファイルです。RPC サーバーとほぼ同じです。

 
RPC の処理とは直接関係ありませんが、WM_INITDIALOG メッセージを受け取った時に CAsyncClient::InitializeThreadPool を呼び出して、I/O 完了ポートのワーカー スレッドを作成します。これは別に WinMain 関数に書いてもいいのですが、ワーカースレッドの初期化がうまくいったというログをダイアログボックスに表示させたいという理由で、ここに書いています。

 
エンドポイントにバインドする処理は CAsyncClient::Bind ですが、これは IDOK ボタンがクリックされたときに呼び出します。RPC クライアントを複数のプロトコルやエンドポイントに対応させるため、ボタンを押すたびに アンバインド→バインド を実行するようにしています。

 
最後にポイントが 1 つあります。IDOK のクリック処理の中で、AsyncRpcHandler を new 演算子で動的確保してから AsyncRpcHandler::Sleep 関数を呼び出しています。上で説明したように、メソッド呼び出し時とコールバック時に同じポインターを Overlapped として使えなければならないため、AsyncRpcHandler をローカル インスタンスとしては使うことができない、というのがその理由です。インスタンスの解放処理は、AsyncRpcHandler::ProcessComplete の中で delete this として実行されます。このデザインが適切かどうかはあまり検証していません。

 
```
// 
// main.cpp 
//

#include <Windows.h> 
#include <strsafe.h>

#include "AsyncClient.h"

CAsyncClient *g_AsyncClient= NULL; 
HWND g_Dlg= NULL;

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

        PostMessage(Control, CB_SETCURSEL, 0, NULL); 
        PostMessage(Dlg, WM_COMMAND, 
          MAKELONG(IDC_COMBO_PROTOCOL, CBN_SELCHANGE), (LPARAM)Control);

        g_AsyncClient->InitializeThreadPool();

        return TRUE;

    case WM_COMMAND: 
        switch ( LOWORD(w) ) { 
        case IDCANCEL: 
            EndDialog(Dlg, IDOK); 
            break; 
        case IDOK: 
            GetDlgItemText(Dlg, IDC_EDIT_ENDPOINT, 
              g_AsyncClient->mEndpoint, MAX_ENDPOINT); 
            GetDlgItemText(Dlg, IDC_EDIT_SERVER, 
              g_AsyncClient->mServer, MAX_ENDPOINT); 
            g_AsyncClient->SetProtocolType(SendMessage( 
              GetDlgItem(Dlg, IDC_COMBO_PROTOCOL), CB_GETCURSEL, 0, 0));

            if ( g_AsyncClient->Bind() ) { 
                AsyncRpcHandler *Rpc= new AsyncRpcHandler(*g_AsyncClient); 
                Rpc->Sleep(1000); 
            } 
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
    g_AsyncClient= new CAsyncClient(); 
    if ( g_AsyncClient ) { 
        DialogBox(hInstance, MAKEINTRESOURCE(IDD_DIALOG1), NULL, DlgProc); 
        delete g_AsyncClient; 
    }

    return 0; 
} 
```
 
#### ダイアログボックスの外観

 
最後に、RPC クライアントの外観です。RPC サーバーとほとんど同じです。コピペが冴えます。

 
![]({{site.assets_url}}2012-03-08-image1.png)

 
ここまでがコードの説明でした。 <br />
次回の記事で、作成したプログラムを使っていろいろ遊んでみます。

