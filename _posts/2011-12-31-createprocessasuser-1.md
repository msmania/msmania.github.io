---
layout: post
title: "[Win32] [C++] CreateProcessAsUser - #1 特権編"
date: 2011-12-31 16:22:37.000 +09:00
categories:
- Debug
- Windows
tags:
- CreateProcessAsUser
---

以前、LogonUser と CreateProcessAsUser を使って、別ユーザーとしてプログラムを実行する方法について書きました。あれから 1 年近くたって、背景がそれなりに理解できるようになってきたので、新たに書き直します。

 
&#x5b;Win32&#x5d; &#x5b;C++&#x5d; LogonUser と CreateProcessAsUser <br />
[http://msmania.wordpress.com/2011/02/06/win32-c-logonuser-%e3%81%a8-createprocessasuser/](http://msmania.wordpress.com/2011/02/06/win32-c-logonuser-%e3%81%a8-createprocessasuser/)

 
長くなりそうなので、幾つかの記事に分けます。

 
まずは昔の記事のおさらいから。

 
LogonUser API でトークンを取得して、それを CreateProcessAsUser に渡すと ERROR_PRIVILEGE_NOT_HELD (0n1314) エラーが発生します。これは簡単で、呼び出し側プロセスが SE_INCREASE_QUOTA_NAME と SE_ASSIGNPRIMARYTOKEN_NAME を持っていないから。Administrator といえど、既定で前者は持っていても後者の特権を持っていないので、secpol.msc などから 「プロセス レベル トークンの置き換え」 特権を割り当てることでクリア。ちなみにこのエラー、Windows Server 2008 R2 に SAP NetWeaver の試用版をインストールするときにも sapinst で発生します。回避方法は同じです。

 
ERROR_PRIVILEGE_NOT_HELD エラーはクリアできても、UI (GUI or CUI) を持つプロセスは依然として起動できず、STATUS_DLL_INIT_FAILED (=0xc0000142) エラーが発生してしまう。これを解消するためには、MSDN のサンプルを参照して、ウィンドウ ステーションとデスクトップ オブジェクトの DACL にアクセス許可 ACE を追加する必要がある。

 
ポイントは上記 2 つでした。

 
まず、前者の特権について。 <br />
ユーザーがログオンすると、セキュリティ トークンというデータが LSA (=Local Security Authority) によって作成され、ログオン セッションに紐付けられます。このセッションの中で作成されたプロセスには、基本的にはログオン セッションのトークンが継承されて保持されます。

 
現在のログオン セッションの特権一覧を取得する方法で、最も簡単なのは whoami /priv コマンドを使う方法です。通常のコマンド プロンプトと、管理者として実行したコマンド プロンプトとで実行結果を比較すると、持っている特権が異なります。これが UAC の機能のキモで、前者が 「制限付きトークン」 というやつです。

 
```
> whoami /priv

PRIVILEGES INFORMATION 
----------------------

特権名                        説明                                            状態 
============================= =============================================== ==== 
SeShutdownPrivilege           システムのシャットダウン                        無効 
SeChangeNotifyPrivilege       走査チェックのバイパス                          有効 
SeUndockPrivilege             ドッキング ステーションからコンピューターを削除 無効 
SeIncreaseWorkingSetPrivilege プロセス ワーキング セットの増加                無効 
SeTimeZonePrivilege           タイム ゾーンの変更                             無効 
```
 
デバッガーでは !token というコマンドがあります。例えば、実行中のメモ帳のトークンを出力した例です。

 
```
kd> !process 0 0 notepad.exe 
PROCESS fffffa8001b51570 
    SessionId: 1  Cid: 05f8    Peb: 7fffffde000  ParentCid: 0910 
    DirBase: 15090000  ObjectTable: fffff8a00228a300  HandleCount:  93. 
    Image: notepad.exe

kd> !process fffffa8001b51570 
PROCESS fffffa8001b51570 
    SessionId: 1  Cid: 05f8    Peb: 7fffffde000  ParentCid: 0910 
    DirBase: 15090000  ObjectTable: fffff8a00228a300  HandleCount:  93. 
    Image: notepad.exe 
    VadRoot fffffa8001b18cb0 Vads 86 Clone 0 Private 385. Modified 0. Locked 0. 
    DeviceMap fffff8a001842670 
    Token                             fffff8a0021c6950 
    ElapsedTime                       00:00:02.846 
    UserTime                          00:00:00.000 
    KernelTime                        00:00:00.000 
(略)

kd> !token fffff8a0021c6950 
_TOKEN fffff8a0021c6950 
TS Session ID: 0x1 
User: S-1-5-21-2857284654-3416964824-2551679015-500 
Groups: 
00 S-1-5-21-2857284654-3416964824-2551679015-513 
    Attributes - Mandatory Default Enabled 
01 S-1-1-0 
    Attributes - Mandatory Default Enabled 
02 S-1-5-32-545 
    Attributes - Mandatory Default Enabled 
(略) 
Primary Group: S-1-5-21-2857284654-3416964824-2551679015-513 
Privs: 
03 0x000000003 SeAssignPrimaryTokenPrivilege     Attributes - 
05 0x000000005 SeIncreaseQuotaPrivilege          Attributes - 
(略) 
28 0x00000001c SeManageVolumePrivilege           Attributes - 
29 0x00000001d SeImpersonatePrivilege            Attributes - Enabled Default 
30 0x00000001e SeCreateGlobalPrivilege           Attributes - Enabled Default 
33 0x000000021 SeIncreaseWorkingSetPrivilege     Attributes - 
34 0x000000022 SeTimeZonePrivilege               Attributes - 
35 0x000000023 SeCreateSymbolicLinkPrivilege     Attributes - 
Authentication ID:         (0,388d63) 
Impersonation Level:       Anonymous 
TokenType:                 Primary 
Source: User32             TokenFlags: 0x2000 ( Token in use ) 
Token ID: 396a44           ParentToken ID: 0 
Modified ID:               (0, 38d8de) 
RestrictedSidCount: 0      RestrictedSids: 0000000000000000 
OriginatingLogonSession: 3e7 
kd>
```
 
トークンは nt!_TOKEN という構造体で、そこに特権のリストが設定されているだけの話です。しかし whoami や !token で分かりにくいのが、トークンに含まれている特権しかダンプしてくれない点です。リストに含まれるトークンには無効と有効というスイッチがありますが、これ自体は AdjustTokenPrivileges API でプロセス自身が簡単に動的変更できるものです。

 
AdjustTokenPrivileges function <br />
[http://msdn.microsoft.com/en-us/library/aa375202(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/aa375202(v=vs.85).aspx)

 
上の MSDN に書いてありますが、リストに含まれていない特権を有効にしようとしても、戻り値こそ TRUE になるものの、GetLastError は ERROR_NOT_ALL_ASSIGNED に設定されます。

 
CreateProcessAsUser を実行するには SE_INCREASE_QUOTA_NAME と SE_ASSIGNPRIMARYTOKEN_NAME とが必要になりますが、ここで重要なのはこれらの特権がリストに含まれているかどうかであって、無効か有効かどうかは関係ありません。無効になっていても、リストに含まれていれば CreateProcessAsUser は成功します。CreateProcessAsUser を実行する前に、わざわざ自分で AdjustTokenPrivileges を実行する必要はないわけです。

 
トークンに特権を追加するには、ローカル セキュリティ ポリシー (secpol.msc) を使います。以下のグループ ポリシーでも可能で、secpol.msc と同じことです。このポリシーはコンピューターに割り当てることに注意して下さい。

 
```
Computer Configuration > Policies > Windows Settings > 
  Security Settings > Local Policies > User Rights Assignment
```
 
トークンはログオン時に作られるので、ローカル セキュリティ ポリシーを変更しても現在のログオン セッションに反映されることはなく、ログオフして再ログオンする必要があります。グループ ポリシー経由で設定した場合は、コンピューターアカウントにグループ ポリシーを反映 (gpupdate /force /target:computer) させた後、再ログオンして下さい。

 
プログラム的に特権を追加するには、LsaAddAccountRights API を使います。GUI の操作と同じで、指定した特権に指定した SID を追加するという機能を持っています。この API を実行した後も再ログオンが必要です。

 
LsaAddAccountRights function <br />
[http://msdn.microsoft.com/en-us/library/ms721786(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/ms721786(v=vs.85).aspx)

 
特権は SE_ASSIGNPRIMARYTOKEN_NAME というような定数で扱いますが、実体は “SeAssignPrimaryTokenPrivilege” というような文字列です。また、システム内では LUID という 64bit 整数値も割り振られています。GUID ではないので、異なるシステムでは同じ値であることが保証されません。whoami コマンドでは LUID を出力できませんが、!token では出力されます。上の出力例では、SE_ASSIGNPRIMARYTOKEN_NAME は LUID=3 でした。

 
```
03 0x000000003 SeAssignPrimaryTokenPrivilege Attributes - 
```
 
whoami や !token では、トークンが保持している特権のリストしか得られませんでした。せっかくなら、トークンが保持していない特権もまとめて表示できると便利です。そんなわけで、まずは以下のような関数を書いてみました。

 
全ての特権を取得する方法がすぐに分からなかったので、0 から MAX_PRIVSCAN (256) までの LUID を全て舐めるといういい加減な動きにしています。本当は、システムで定義されている全ての特権を取得する方法があるはずです。

 
```
// 
// priv.cpp 
//

#include <windows.h> 
#include <NTSecAPI.h> 
#include <stdio.h> 
#include <strsafe.h>

#include "logue.h"

#define MAX_PRIVNAME 32 
#define MAX_PRIVSCAN 256

#define STATUS_SUCCESS ((NTSTATUS)0x00000000L) // ntsubauth

struct PRIVILAGENAME_MAPPING { 
    WCHAR SymbolName[MAX_PRIVNAME]; 
    WCHAR PrivilegeName[MAX_PRIVNAME]; 
};

const PRIVILAGENAME_MAPPING PrivilegeNameMapping[]= { 
    { L"SE_CREATE_TOKEN_NAME", SE_CREATE_TOKEN_NAME }, 
    { L"SE_ASSIGNPRIMARYTOKEN_NAME", SE_ASSIGNPRIMARYTOKEN_NAME }, 
    { L"SE_LOCK_MEMORY_NAME", SE_LOCK_MEMORY_NAME }, 
    { L"SE_INCREASE_QUOTA_NAME", SE_INCREASE_QUOTA_NAME }, 
    { L"SE_UNSOLICITED_INPUT_NAME", SE_UNSOLICITED_INPUT_NAME }, // no LUID? 
    { L"SE_MACHINE_ACCOUNT_NAME", SE_MACHINE_ACCOUNT_NAME }, 
    { L"SE_TCB_NAME", SE_TCB_NAME }, 
    { L"SE_SECURITY_NAME", SE_SECURITY_NAME }, 
    { L"SE_TAKE_OWNERSHIP_NAME", SE_TAKE_OWNERSHIP_NAME }, 
    { L"SE_LOAD_DRIVER_NAME", SE_LOAD_DRIVER_NAME }, 
    { L"SE_SYSTEM_PROFILE_NAME", SE_SYSTEM_PROFILE_NAME }, 
    { L"SE_SYSTEMTIME_NAME", SE_SYSTEMTIME_NAME }, 
    { L"SE_PROF_SINGLE_PROCESS_NAME", SE_PROF_SINGLE_PROCESS_NAME }, 
    { L"SE_INC_BASE_PRIORITY_NAME", SE_INC_BASE_PRIORITY_NAME }, 
    { L"SE_CREATE_PAGEFILE_NAME", SE_CREATE_PAGEFILE_NAME }, 
    { L"SE_CREATE_PERMANENT_NAME", SE_CREATE_PERMANENT_NAME }, 
    { L"SE_BACKUP_NAME", SE_BACKUP_NAME }, 
    { L"SE_RESTORE_NAME", SE_RESTORE_NAME }, 
    { L"SE_SHUTDOWN_NAME", SE_SHUTDOWN_NAME }, 
    { L"SE_DEBUG_NAME", SE_DEBUG_NAME }, 
    { L"SE_AUDIT_NAME", SE_AUDIT_NAME }, 
    { L"SE_SYSTEM_ENVIRONMENT_NAME", SE_SYSTEM_ENVIRONMENT_NAME }, 
    { L"SE_CHANGE_NOTIFY_NAME", SE_CHANGE_NOTIFY_NAME }, 
    { L"SE_REMOTE_SHUTDOWN_NAME", SE_REMOTE_SHUTDOWN_NAME }, 
    { L"SE_UNDOCK_NAME", SE_UNDOCK_NAME }, 
    { L"SE_SYNC_AGENT_NAME", SE_SYNC_AGENT_NAME }, 
    { L"SE_ENABLE_DELEGATION_NAME", SE_ENABLE_DELEGATION_NAME }, 
    { L"SE_MANAGE_VOLUME_NAME", SE_MANAGE_VOLUME_NAME }, 
    { L"SE_IMPERSONATE_NAME", SE_IMPERSONATE_NAME }, 
    { L"SE_CREATE_GLOBAL_NAME", SE_CREATE_GLOBAL_NAME }, 
    { L"SE_TRUSTED_CREDMAN_ACCESS_NAME", SE_TRUSTED_CREDMAN_ACCESS_NAME }, 
    { L"SE_RELABEL_NAME", SE_RELABEL_NAME }, 
    { L"SE_INC_WORKING_SET_NAME", SE_INC_WORKING_SET_NAME }, 
    { L"SE_TIME_ZONE_NAME", SE_TIME_ZONE_NAME }, 
    { L"SE_CREATE_SYMBOLIC_LINK_NAME", SE_CREATE_SYMBOLIC_LINK_NAME }, 
    { L"", L"" } 
};

BOOL LookupPrivilegeName(LPCWSTR SystemName, CONST PLUID Luid, 
                         LPCWSTR *SymbolName, 
                         LPWSTR PrivilegeName, LPDWORD PrivilegeNameLength, 
                         LPWSTR DisplayName, LPDWORD DisplayNameLength, 
                         BOOL NoErrMsg) { 
    BOOL Ret= FALSE; 
    DWORD LanguageId; 
    int Index= -1;

    Ret= LookupPrivilegeName(NULL, Luid, PrivilegeName, PrivilegeNameLength); 
    if ( !Ret ) { 
        if ( GetLastError()!=ERROR_INSUFFICIENT_BUFFER && !NoErrMsg ) 
            wprintf(L"LookupPrivilegeName failed - 0x%08x\n", 
                    GetLastError()); 
        goto cleanup; 
    }

    Ret= LookupPrivilegeDisplayName(NULL,} 
      PrivilegeName, DisplayName, DisplayNameLength, &LanguageId); 
    if ( !Ret ) { 
        if ( GetLastError()!=ERROR_INSUFFICIENT_BUFFER && !NoErrMsg ) 
            wprintf(L"LookupPrivilegeDisplayName failed - 0x%08x\n", 
              GetLastError()); 
        goto cleanup; 
    }

    Ret= FALSE; 
    const PRIVILAGENAME_MAPPING *p=PrivilegeNameMapping; 
    for ( Index=0 ; p->SymbolName[0]!=0 ; ++p, ++Index ) { 
        if ( wcscmp(PrivilegeName, p->PrivilegeName)==0 ) { 
            Ret= TRUE; 
            break; 
        } 
    }

    if ( Ret ) 
        *SymbolName= PrivilegeNameMapping[Index].SymbolName; 
    else if ( NoErrMsg ) 
        wprintf(L"%s not found\n", PrivilegeName);

cleanup: 
    return Ret; 
}

BOOL LookupPrivilegeValueEx(LPCWSTR SystemName, LPCWSTR Name, PLUID Luid) { 
    BOOL Ret= LookupPrivilegeValue(SystemName, Name, Luid); 
    if ( !Ret && GetLastError()==ERROR_NO_SUCH_PRIVILEGE ) { 
        const PRIVILAGENAME_MAPPING *p; 
        for ( p=PrivilegeNameMapping ; p->SymbolName[0]!=0 ; ++p ) { 
            if ( wcscmp(Name, p->SymbolName)==0 ) 
                return LookupPrivilegeValue( 
                  SystemName, p->PrivilegeName, Luid); 
        } 
        SetLastError(ERROR_NO_SUCH_PRIVILEGE); 
        Ret= FALSE; 
    } 
    return Ret; 
}

VOID EnumPrivileges(HANDLE Token, BOOL All) { 
    BOOL Ret= FALSE; 
    DWORD TokenLength= 0; 
    PTOKEN_PRIVILEGES TokenPriv= NULL; 
    DWORD PrivilegeNameLength= 256; 
    DWORD DisplayNameLength= 256; 
    PWCHAR PrivilegeName= NULL; 
    PWCHAR DisplayName= NULL; 
    LPCWCHAR SymbolName= NULL; 
    
    // LUID = Locally Unique Identifier 
    wprintf(L"-------------------------------------------------------------------------------------------------------\n"); 
    wprintf(L"   LUID                Symbol                           PrivilegeName                    DisplayName\n"); 
    wprintf(L"-------------------------------------------------------------------------------------------------------\n");

    if ( !All ) { 
        if ( !GetTokenInformation(Token, TokenPrivileges, NULL, 0, &TokenLength) && 
                GetLastError()!=ERROR_INSUFFICIENT_BUFFER ) { 
            wprintf(L"GetTokenInformation (size check) failed - 0x%08x\n", 
                    GetLastError()); 
            goto cleanup; 
        }

        TokenPriv= (PTOKEN_PRIVILEGES)HeapAlloc(GetProcessHeap(), 0, TokenLength); 
        if ( !TokenPriv ) { 
            wprintf(L"HeapAlloc failed - 0x%08x\n", GetLastError()); 
            goto cleanup; 
        }

        if ( !GetTokenInformation(Token, 
                TokenPrivileges, TokenPriv, TokenLength, &TokenLength) ) { 
            wprintf(L"GetTokenInformation failed - 0x%08x\n", GetLastError()); 
            goto cleanup; 
        }

    } 
    else { 
        TokenPriv= (PTOKEN_PRIVILEGES)HeapAlloc(GetProcessHeap(), 0, 
            sizeof(DWORD)+sizeof(LUID_AND_ATTRIBUTES)*MAX_PRIVSCAN); 
        if ( !TokenPriv ) { 
            wprintf(L"HeapAlloc failed - 0x%08x\n", GetLastError()); 
            goto cleanup; 
        } 
        
        TokenPriv->PrivilegeCount= MAX_PRIVSCAN; 
        for (  LONGLONG i=0 ; i<MAX_PRIVSCAN ; ++i ) { 
            TokenPriv->Privileges[i].Luid= *(PLUID)&i; 
            TokenPriv->Privileges[i].Attributes= 0; 
        } 
    } 
    
    for ( DWORD i=0 ; i<TokenPriv->PrivilegeCount ; ++i ) { 
        do { 
            if ( PrivilegeName ) delete [] PrivilegeName; 
            if ( DisplayName ) delete [] DisplayName;

            PrivilegeName= new WCHAR[PrivilegeNameLength]; 
            DisplayName= new WCHAR[DisplayNameLength];

            Ret= LookupPrivilegeName(NULL, &TokenPriv->Privileges[i].Luid, &SymbolName, 
                    PrivilegeName, &PrivilegeNameLength, 
                    DisplayName, &DisplayNameLength, 
                    All); 
        } while( !Ret && GetLastError()==ERROR_INSUFFICIENT_BUFFER );

        if ( Ret ) { 
            WCHAR Mark= 0; 
            if ( All ) { 
                LONG l= 0; 
                CheckPrivilege(Token, PrivilegeName, &l); 
                Mark= l==0 ? Mark= 'X' : 
                    l>0 ? Mark= 'O' : '-'; 
            } 
            else { 
                Mark= TokenPriv->Privileges[i].Attributes&SE_PRIVILEGE_ENABLED ? 
                       L'O' : L'X'; 
            }

            wprintf(L" %c 0x%08x`%08x %-32s %-32s %s\n", Mark, 
                TokenPriv->Privileges[i].Luid.HighPart, 
                TokenPriv->Privileges[i].Luid.LowPart, 
                SymbolName, 
                PrivilegeName, 
                DisplayName); 
        } 
    }

cleanup: 
    if ( PrivilegeName ) delete [] PrivilegeName; 
    if ( DisplayName ) delete [] DisplayName; 
    if ( TokenPriv ) HeapFree(GetProcessHeap(), 0, TokenPriv); 
}

// http://msdn.microsoft.com/en-us/library/ms722492(v=VS.85) InitLsaString 
// http://msdn.microsoft.com/en-us/library/ms721874(v=vs.85).aspx 
// http://msdn.microsoft.com/en-us/library/ms721863(v=vs.85).aspx 
BOOL AddPrivilege(HANDLE Token, LPCWSTR PrivilegeName) { 
    NTSTATUS Ret= 0; 
    LSA_OBJECT_ATTRIBUTES ObjectAttributes; 
    LSA_HANDLE PolicyHandle= NULL; 
    PSID Sid= NULL; 
    LSA_UNICODE_STRING Privilege[1]; 
    size_t PrivNameLength= 0; 
    PTOKEN_USER CurrentUserSid= NULL; 
    DWORD CurrentUserSidLength= 0;

    // get current user SID from the token 
    if ( !GetTokenInformation(Token, TokenUser, NULL, 0, &CurrentUserSidLength) && 
            GetLastError()!=ERROR_INSUFFICIENT_BUFFER ) { 
        wprintf(L"GetTokenInformation (size check) failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    }

    CurrentUserSid= (PTOKEN_USER)HeapAlloc(GetProcessHeap(), 0, CurrentUserSidLength); 
    if ( !CurrentUserSid ) { 
        wprintf(L"HeapAlloc failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    }

    if ( !GetTokenInformation(Token, TokenUser, CurrentUserSid, 
            CurrentUserSidLength, &CurrentUserSidLength) ) { 
        wprintf(L"GetTokenInformation failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    } 
    
    PrivNameLength= StringCchLength(PrivilegeName, MAX_PRIVNAME, &PrivNameLength); 
    Privilege[0].Buffer= (PWCHAR)PrivilegeName; 
    Privilege[0].Length= PrivNameLength*sizeof(WCHAR); 
    Privilege[0].MaximumLength= (PrivNameLength+1)*sizeof(WCHAR); 
    
    ZeroMemory(&ObjectAttributes, sizeof(ObjectAttributes)); 
    Ret= LsaOpenPolicy(NULL, &ObjectAttributes, POLICY_ALL_ACCESS, &PolicyHandle); 
    if ( Ret!=STATUS_SUCCESS ) { 
        wprintf(L"LsaOpenPolicy failed - 0x%08x\n", LsaNtStatusToWinError(Ret)); 
        goto cleanup; 
    }

    StringCchLength(PrivilegeName, MAX_PRIVNAME, &PrivNameLength); 
    Privilege[0].Buffer= (PWCHAR)PrivilegeName; 
    Privilege[0].Length= PrivNameLength*sizeof(WCHAR); 
    Privilege[0].MaximumLength= (PrivNameLength+1)*sizeof(WCHAR);

    Ret= LsaAddAccountRights(PolicyHandle, CurrentUserSid->User.Sid, Privilege, 1);; 
    if ( Ret!=STATUS_SUCCESS ) { 
        wprintf(L"LsaAddAccountRights failed - 0x%08x\n", LsaNtStatusToWinError(Ret)); 
        goto cleanup; 
    }

    wprintf(L"Privilege '%s' was assigned successfully.\n", PrivilegeName); 
    wprintf(L"To apply it to the token, re-log on the system.\n");

cleanup: 
    if ( PolicyHandle ) LsaClose(PolicyHandle);    
    if ( CurrentUserSid ) HeapFree(GetProcessHeap(), 0, CurrentUserSid);

    return Ret==STATUS_SUCCESS; 
}

// >0 Enabled 
// =0 Disabled 
// <0 Not assigned 
BOOL CheckPrivilege(HANDLE Token, LPCWSTR PrivilegeName, LPLONG Privileged) { 
    LUID luid; 
    if ( !LookupPrivilegeValueEx(NULL, PrivilegeName, &luid) ){ 
        wprintf(L"LookupPrivilegeValue failed - 0x%08x\n", GetLastError()); 
        return FALSE; 
    }

    PRIVILEGE_SET PrivilegeSet; 
    PrivilegeSet.Control= 0; 
    PrivilegeSet.PrivilegeCount= 1; 
    PrivilegeSet.Privilege[0].Luid= luid; 
    PrivilegeSet.Privilege[0].Attributes= 0; // not used

    BOOL Check; 
    if ( !PrivilegeCheck(Token, &PrivilegeSet, &Check) ) { 
        wprintf(L"PrivilegeCheck failed - 0x%08x\n", GetLastError()); 
        return FALSE; 
    } 
    
    if ( Check ) 
        *Privileged= 1; 
    else { 
        TOKEN_PRIVILEGES tp; 
        tp.PrivilegeCount= 1; 
        tp.Privileges[0].Luid= luid; 
        tp.Privileges[0].Attributes= 0;

        if ( !AdjustTokenPrivileges(Token, 
                FALSE, &tp, sizeof(TOKEN_PRIVILEGES), NULL, NULL) ) { 
            wprintf(L"AdjustTokenPrivileges failed - 0x%08x\n", GetLastError()); 
            return FALSE; 
        }

        *Privileged= (GetLastError()==ERROR_NOT_ALL_ASSIGNED) ? -1 : 0; 
    }

    return TRUE; 
} 
  
BOOL EnablePrivilege(HANDLE Token, LPWSTR Name, BOOL Enabled) { 
    LUID luid; 
    if ( !LookupPrivilegeValueEx(NULL, Name, &luid) ) { 
        wprintf(L"LookupPrivilegeValue failed - 0x%08x\n", GetLastError()); 
        return FALSE; 
    } 
    
    TOKEN_PRIVILEGES tp; 
    tp.PrivilegeCount= 1; 
    tp.Privileges[0].Luid= luid; 
    tp.Privileges[0].Attributes= 
      Enabled ? SE_PRIVILEGE_ENABLED : 0; // not use SE_PRIVILEGE_REMOVED, just disable

    if ( !AdjustTokenPrivileges(Token, 
            FALSE, &tp, sizeof(TOKEN_PRIVILEGES), NULL, NULL) ) { 
        wprintf(L"AdjustTokenPrivileges failed - 0x%08x\n", GetLastError()); 
        return FALSE; 
    } 
    
    if ( GetLastError()==ERROR_NOT_ALL_ASSIGNED ) { 
        wprintf(L"The process token does not have %s (%I64d).\n", Name, luid); 
        return FALSE; 
    }

    wprintf(L"%s (%I64d) is temporarily %s.\n", Name, luid, 
        Enabled ? L"enabled" : L"disabled");

    return TRUE; 
} 
```
 
ここで定義した関数 EnumPrivileges を使って、特権の一覧を出力させると、こんな感じです。 <br />
（出力が横に広い・・・）

 
```
------------------------------------------------------------------------------------------------------- 
   LUID                Symbol                           PrivilegeName                    DisplayName 
------------------------------------------------------------------------------------------------------- 
- 0x00000000`00000002 SE_CREATE_TOKEN_NAME             SeCreateTokenPrivilege           トークン オブジェクトの作成 
X 0x00000000`00000003 SE_ASSIGNPRIMARYTOKEN_NAME       SeAssignPrimaryTokenPrivilege    プロセス レベル トークンの置き換え 
- 0x00000000`00000004 SE_LOCK_MEMORY_NAME              SeLockMemoryPrivilege            メモリ内のページのロック 
X 0x00000000`00000005 SE_INCREASE_QUOTA_NAME           SeIncreaseQuotaPrivilege         プロセスのメモリ クォータの増加 
- 0x00000000`00000006 SE_MACHINE_ACCOUNT_NAME          SeMachineAccountPrivilege        ドメインにワークステーションを追加 
- 0x00000000`00000007 SE_TCB_NAME                      SeTcbPrivilege                   オペレーティング システムの一部として機能 
X 0x00000000`00000008 SE_SECURITY_NAME                 SeSecurityPrivilege              監査とセキュリティ ログの管理 
X 0x00000000`00000009 SE_TAKE_OWNERSHIP_NAME           SeTakeOwnershipPrivilege         ファイルとその他のオブジェクトの所有権の取得 
X 0x00000000`0000000a SE_LOAD_DRIVER_NAME              SeLoadDriverPrivilege            デバイス ドライバーのロードとアンロード 
X 0x00000000`0000000b SE_SYSTEM_PROFILE_NAME           SeSystemProfilePrivilege         システム パフォーマンスのプロファイル 
X 0x00000000`0000000c SE_SYSTEMTIME_NAME               SeSystemtimePrivilege            システム時刻の変更 
X 0x00000000`0000000d SE_PROF_SINGLE_PROCESS_NAME      SeProfileSingleProcessPrivilege  単一プロセスのプロファイル 
X 0x00000000`0000000e SE_INC_BASE_PRIORITY_NAME        SeIncreaseBasePriorityPrivilege  スケジューリング優先順位の繰り上げ 
X 0x00000000`0000000f SE_CREATE_PAGEFILE_NAME          SeCreatePagefilePrivilege        ページ ファイルの作成 
- 0x00000000`00000010 SE_CREATE_PERMANENT_NAME         SeCreatePermanentPrivilege       永続的共有オブジェクトの作成 
X 0x00000000`00000011 SE_BACKUP_NAME                   SeBackupPrivilege                ファイルとディレクトリのバックアップ 
X 0x00000000`00000012 SE_RESTORE_NAME                  SeRestorePrivilege               ファイルとディレクトリの復元 
X 0x00000000`00000013 SE_SHUTDOWN_NAME                 SeShutdownPrivilege              システムのシャットダウン 
X 0x00000000`00000014 SE_DEBUG_NAME                    SeDebugPrivilege                 プログラムのデバッグ 
- 0x00000000`00000015 SE_AUDIT_NAME                    SeAuditPrivilege                 セキュリティ監査の生成 
X 0x00000000`00000016 SE_SYSTEM_ENVIRONMENT_NAME       SeSystemEnvironmentPrivilege     ファームウェア環境値の修正 
O 0x00000000`00000017 SE_CHANGE_NOTIFY_NAME            SeChangeNotifyPrivilege          走査チェックのバイパス 
X 0x00000000`00000018 SE_REMOTE_SHUTDOWN_NAME          SeRemoteShutdownPrivilege        リモート コンピューターからの強制シャットダウン 
X 0x00000000`00000019 SE_UNDOCK_NAME                   SeUndockPrivilege                ドッキング ステーションからコンピューターを削除 
- 0x00000000`0000001a SE_SYNC_AGENT_NAME               SeSyncAgentPrivilege             ディレクトリ サービス データの同期化 
- 0x00000000`0000001b SE_ENABLE_DELEGATION_NAME        SeEnableDelegationPrivilege      コンピューターとユーザー アカウントに委任時の信頼を付与 
X 0x00000000`0000001c SE_MANAGE_VOLUME_NAME            SeManageVolumePrivilege          ボリュームの保守タスクを実行 
O 0x00000000`0000001d SE_IMPERSONATE_NAME              SeImpersonatePrivilege           認証後にクライアントを偽装 
O 0x00000000`0000001e SE_CREATE_GLOBAL_NAME            SeCreateGlobalPrivilege          グローバル オブジェクトの作成 
- 0x00000000`0000001f SE_TRUSTED_CREDMAN_ACCESS_NAME   SeTrustedCredManAccessPrivilege  資格情報マネージャーに信頼された呼び出し側としてアクセス 
- 0x00000000`00000020 SE_RELABEL_NAME                  SeRelabelPrivilege               オブジェクト ラベルの変更 
X 0x00000000`00000021 SE_INC_WORKING_SET_NAME          SeIncreaseWorkingSetPrivilege    プロセス ワーキング セットの増加 
X 0x00000000`00000022 SE_TIME_ZONE_NAME                SeTimeZonePrivilege              タイム ゾーンの変更 
X 0x00000000`00000023 SE_CREATE_SYMBOLIC_LINK_NAME     SeCreateSymbolicLinkPrivilege    シンボリック リンクの作成 
```
