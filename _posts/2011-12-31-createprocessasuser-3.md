---
layout: post
title: "[Win32] [C++] CreateProcessAsUser – #3 ソース"
date: 2011-12-31 22:29:15.000 +09:00
categories:
- C/C++
- Debug
- Windows
---

小出しにしてきたプログラムの全貌です。ファイルは 5 つに分けました。 <br />
2 月のプログラムに、幾つかの機能を加えてあります。1000 行近くまで膨らんでしまった・・・。

 
- main.cpp – エントリ ポイント、引数のパース
- logue.cpp – メイン ルーチン 
- priv.cpp - 特権関係 
- dacl.cpp – DACL 関係 
- logue.h - 共通ヘッダー 

 
<font color="#0000ff">(2014/12/29 追記)     <br>HTML として貼り付けているだけと読みづらいので (検索でヒットしやすいというメリットはありますが・・)、ソースを GitHub に置きました。Makefile も作りましたので、Visual Studio のコマンド プロンプトから nmake コマンドをパラメーターなしで実行するだけでビルドできます。</font>

 
[https://github.com/msmania/logue](https://github.com/msmania/logue)

 
main.cpp

 
```
// 
// main.cpp 
//

#include <iostream> 
#include <stdio.h> 
#include <locale.h> 
#include <Windows.h>

#include "logue.h"

using namespace std;

/*

Usage: logue -runas <user> <password> <command> 
       logue -priv Enum 
       logue -priv Add <privilege> 
       logue -priv Check <privilege> 
       logue -priv Enable <privilege> 
       logue -priv Disable <privilege>

Example: 
    logue domain\user password "c:\windows\system32\notepad.exe c:\temp\temp.txt" 
    logue -priv check SeSecurityPrivilege

Privilege: http://msdn.microsoft.com/en-us/library/bb530716.aspx

*/

void ShowUsage() { 
    wcout << L"\nUsage: logue -runas <user> <password> <command>" << endl; 
    wcout << L"       logue -priv All" << endl; 
    wcout << L"       logue -priv Enum" << endl; 
    wcout << L"       logue -priv Add <privilege>" << endl; 
    wcout << L"       logue -priv Check <privilege>" << endl; 
    wcout << L"       logue -priv Enable <privilege>" << endl; 
    wcout << L"       logue -priv Disable <privilege>" << endl << endl; 
    wcout << L"Example:" << endl; 
    wcout << L"    logue -runas domain\\user password \"c:\\windows\\system32\\notepad.exe c:\\temp\\temp.txt\"" << endl; 
    wcout << L"    logue -priv check SeSecurityPrivilege" << endl << endl; 
    wcout << L"Privilege: http://msdn.microsoft.com/en-us/library/bb530716.aspx" << endl << endl; 
}

#define MAX_COMMAND 16

static wchar_t upperstr[MAX_COMMAND+1]; 
const wchar_t *ToUpper(const wchar_t *s) { 
    for ( int i=0 ; i<MAX_COMMAND+1 ; ++i ) { 
        upperstr[i]= toupper(s[i]); 
        if ( s[i]==0 ) 
            return upperstr; 
    } 
    upperstr[MAX_COMMAND]= 0; 
    return upperstr; 
}

int wmain(int argc, wchar_t *argv[]) { 
    _wsetlocale(LC_ALL, L""); 
    
    if ( argc<3 ) { 
        ShowUsage(); 
        return ERROR_INVALID_PARAMETER; 
    }

    LPCWSTR Command= ToUpper(argv[1]); 
    if ( wcscmp(Command, L"-RUNAS")==0 ) { 
        if ( argc<5 ) { 
            ShowUsage(); 
            return ERROR_INVALID_PARAMETER; 
        }

        RunAs(argv[2], argv[3], argv[4]); 
    } 
    else if ( wcscmp(Command, L"-PRIV")==0 ) { 
        HANDLE Token= NULL; 
        if ( !OpenProcessToken(GetCurrentProcess(), 
                               TOKEN_ALL_ACCESS , &Token) ) { 
            wprintf(L"OpenProcessToken failed - 0x%08x\n", GetLastError()); 
            return 0; 
        }

        Command= ToUpper(argv[2]); 
        if ( wcscmp(Command, L"ENUM")==0 ) 
            EnumPrivileges(Token, FALSE); 
        else if ( wcscmp(Command, L"ALL")==0 ) 
            EnumPrivileges(Token, TRUE); 
        else if ( argc>=4 && wcscmp(Command, L"ADD")==0 ) 
            AddPrivilege(Token, argv[3]); 
        else if ( argc>=4 && wcscmp(Command, L"CHECK")==0 ) { 
            LONG Ret= 0; 
            if ( CheckPrivilege(Token, argv[3], &Ret) ) 
                wprintf(L"%s is %s.\n", argv[3], 
                    Ret>0 ? L"ENABLED" : 
                    Ret<0 ? L"NOT ASSIGNED" : L"DISABLED"); 
        } 
        else if ( argc>=4 && wcscmp(Command, L"ENABLE")==0 ) { 
            if ( EnablePrivilege(Token, argv[3], TRUE) ) 
                EnumPrivileges(Token, FALSE); 
        } 
        else if ( argc>=4 && wcscmp(Command, L"DISABLE")==0 ) { 
            if ( EnablePrivilege(Token, argv[3], FALSE) ) 
                EnumPrivileges(Token, FALSE); 
        } 
        else { 
            wprintf(L"Bad command - %s\n", argv[1]); 
            return ERROR_BAD_COMMAND; 
        }

        if ( Token ) CloseHandle(Token); 
    } 
    else { 
        ShowUsage(); 
        wprintf(L"Unknown command - %s\n", argv[1]); 
        return ERROR_INVALID_PARAMETER; 
    }

    return 0; 
} 
```
 
logue.cpp

 
```
// 
// logue.cpp 
// 
// base sample: 
// http://msdn.microsoft.com/en-us/library/aa379608(v=vs.85).aspx 
//

#include <windows.h> 
#include <stdio.h>

#include "logue.h"

VOID RunAs(LPWSTR inUser, LPWSTR inPW, LPWSTR inCommand) { 
    HANDLE CallerToken= NULL; 
    HANDLE CalleeToken= NULL; 
    HWINSTA WinstaOld= NULL; 
    HWINSTA Winsta0= NULL; 
    HDESK Desktop= NULL; 
    PSID LogonSid= NULL; 
    STARTUPINFO si; 
    PROCESS_INFORMATION pi; 
    LONG PrivCheck= 0; 
    
    if ( !OpenProcessToken(GetCurrentProcess(), TOKEN_ALL_ACCESS, 
            &CallerToken) ) { 
        wprintf(L"OpenProcessToken failed - 0x%08x\n", GetLastError()); 
        goto Cleanup; 
    } 
    
    CheckPrivilege(CallerToken, SE_INCREASE_QUOTA_NAME, &PrivCheck); 
    if ( PrivCheck<0 ) 
        wprintf(L"CreateProcessAsUser requires %s.  Check the user's privileges.\n", SE_INCREASE_QUOTA_NAME);

    CheckPrivilege(CallerToken, SE_ASSIGNPRIMARYTOKEN_NAME, &PrivCheck); 
    if ( PrivCheck<0 ) 
        wprintf(L"CreateProcessAsUser requires %s.  Check the user's privileges.\n", SE_ASSIGNPRIMARYTOKEN_NAME); 
    
    if ( !LogonUser(inUser, NULL, inPW, LOGON32_LOGON_INTERACTIVE, 
            LOGON32_PROVIDER_DEFAULT, &CalleeToken) ) { 
        wprintf(L"LogonUser failed - 0x%08x\n", GetLastError()); 
        goto Cleanup; 
    }

#ifdef _GUI 
    Winsta0= OpenWindowStation(L"winsta0", FALSE, READ_CONTROL|WRITE_DAC); 
    if ( !Winsta0 ) { 
        wprintf(L"OpenWindowStation failed - 0x%08x\n", GetLastError()); 
        goto Cleanup; 
    }

    WinstaOld= GetProcessWindowStation(); 
    if ( !SetProcessWindowStation(Winsta0) ) { 
        wprintf(L"SetProcessWindowStation failed - 0x%08x\n", 
                GetLastError()); 
        goto Cleanup; 
    } 
    Desktop= OpenDesktop(L"default", 0, FALSE, 
        READ_CONTROL|WRITE_DAC|DESKTOP_WRITEOBJECTS|DESKTOP_READOBJECTS); 
    SetProcessWindowStation(WinstaOld); 
    if ( !Desktop ) { 
        wprintf(L"OpenDesktop failed - 0x%08x\n", GetLastError()); 
        goto Cleanup; 
    } 
    
    if ( !GetLogonSidFromToken(CalleeToken, &LogonSid) ) 
        goto Cleanup; 
    
#ifdef _TRACING 
    wprintf(L"PID      : 0x%x\n", GetCurrentProcessId()); 
    wprintf(L"HWINSTA  : 0x%x\n", Winsta0); 
    wprintf(L"HDESK    : 0x%x\n", Desktop); 
    wprintf(L"Logon SID: %p\n", LogonSid); 
    wprintf(L"-----\n"); 
    getwchar(); 
#endif

    if ( !AddAceToWindowStation(Winsta0, LogonSid) ) { 
        wprintf(L"AddAceToWindowStation failed - 0x%08x\n", GetLastError()); 
        goto Cleanup; 
    }

    if ( !AddAceToDesktop(Desktop, LogonSid) ) { 
        wprintf(L"AddAceToDesktop failed - 0x%08x\n", GetLastError()); 
        goto Cleanup; 
    } 
#endif 
    
    ZeroMemory(&si, sizeof(STARTUPINFO)); 
    si.cb= sizeof(STARTUPINFO);

#ifdef _GUI 
    si.lpDesktop= L"winsta0\\default"; 
#else 
    si.lpDesktop= L""; 
#endif 
    
    if ( !ImpersonateLoggedOnUser(CalleeToken) ) { 
        wprintf(L"ImpersonateLoggedOnUser failed - 0x%08x\n", 
                GetLastError()); 
        goto Cleanup; 
    }

    if ( !CreateProcessAsUser(CalleeToken, NULL, inCommand, NULL, NULL, 
                              FALSE, 0, NULL, NULL, &si, &pi) ) { 
        wprintf(L"CreateProcessAsUser failed - 0x%08x\n", GetLastError()); 
        goto Cleanup; 
    } 
    
    WaitForSingleObject(pi.hProcess, INFINITE); 
    
    RevertToSelf();

#ifdef _GUI 
    RemoveAccessAllowedAcesBasedSID(Winsta0, LogonSid); 
    RemoveAccessAllowedAcesBasedSID(Desktop, LogonSid); 
#endif 
    
    CloseHandle(pi.hProcess); 
    CloseHandle(pi.hThread);

Cleanup: 
    if ( LogonSid ) HeapFree(GetProcessHeap(), 0, LogonSid); 
    if ( Winsta0 ) CloseWindowStation(Winsta0); 
    if ( Desktop ) CloseDesktop(Desktop); 
    if ( CalleeToken ) CloseHandle(CalleeToken); 
    if ( CallerToken ) CloseHandle(CallerToken); 
}
```
 
priv.cpp

 
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

BOOL LookupPrivilegeName(LPCWSTR SystemName, 
                        CONST PLUID Luid, LPCWSTR *SymbolName, 
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

    Ret= LookupPrivilegeDisplayName(NULL, 
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
                return LookupPrivilegeValue(SystemName, 
                       p->PrivilegeName, Luid); 
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
        if ( !GetTokenInformation(Token, TokenPrivileges, 
                NULL, 0, &TokenLength) && 
                GetLastError()!=ERROR_INSUFFICIENT_BUFFER ) { 
            wprintf(L"GetTokenInformation (size check) failed - 0x%08x\n", 
                    GetLastError()); 
            goto cleanup; 
        }

        TokenPriv= (PTOKEN_PRIVILEGES)HeapAlloc(GetProcessHeap(), 
                    0, TokenLength); 
        if ( !TokenPriv ) { 
            wprintf(L"HeapAlloc failed - 0x%08x\n", GetLastError()); 
            goto cleanup; 
        }

        if ( !GetTokenInformation(Token, TokenPrivileges, TokenPriv, 
                  TokenLength, &TokenLength) ) { 
            wprintf(L"GetTokenInformation failed - 0x%08x\n", 
                    GetLastError()); 
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

            Ret= LookupPrivilegeName(NULL, 
                &TokenPriv->Privileges[i].Luid, &SymbolName, 
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
                Mark= TokenPriv->Privileges[i].Attributes&SE_PRIVILEGE_ENABLED ? L'O' : L'X'; 
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
    if ( !GetTokenInformation(Token, TokenUser, NULL, 0, 
            &CurrentUserSidLength) && 
            GetLastError()!=ERROR_INSUFFICIENT_BUFFER ) { 
        wprintf(L"GetTokenInformation (size check) failed - 0x%08x\n", 
                GetLastError()); 
        goto cleanup; 
    }

    CurrentUserSid= (PTOKEN_USER)HeapAlloc(GetProcessHeap(), 0, 
                    CurrentUserSidLength); 
    if ( !CurrentUserSid ) { 
        wprintf(L"HeapAlloc failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    }

    if ( !GetTokenInformation(Token, TokenUser, CurrentUserSid, 
            CurrentUserSidLength, &CurrentUserSidLength) ) { 
        wprintf(L"GetTokenInformation failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    } 
    
    PrivNameLength= StringCchLength(PrivilegeName, 
        MAX_PRIVNAME, &PrivNameLength); 
    Privilege[0].Buffer= (PWCHAR)PrivilegeName; 
    Privilege[0].Length= PrivNameLength*sizeof(WCHAR); 
    Privilege[0].MaximumLength= (PrivNameLength+1)*sizeof(WCHAR); 
    
    ZeroMemory(&ObjectAttributes, sizeof(ObjectAttributes)); 
    Ret= LsaOpenPolicy(NULL, &ObjectAttributes, POLICY_ALL_ACCESS, 
                       &PolicyHandle); 
    if ( Ret!=STATUS_SUCCESS ) { 
        wprintf(L"LsaOpenPolicy failed - 0x%08x\n", 
                LsaNtStatusToWinError(Ret)); 
        goto cleanup; 
    }

    StringCchLength(PrivilegeName, MAX_PRIVNAME, &PrivNameLength); 
    Privilege[0].Buffer= (PWCHAR)PrivilegeName; 
    Privilege[0].Length= PrivNameLength*sizeof(WCHAR); 
    Privilege[0].MaximumLength= (PrivNameLength+1)*sizeof(WCHAR);

    Ret= LsaAddAccountRights(PolicyHandle, 
        CurrentUserSid->User.Sid, Privilege, 1);; 
    if ( Ret!=STATUS_SUCCESS ) { 
        wprintf(L"LsaAddAccountRights failed - 0x%08x\n", 
            LsaNtStatusToWinError(Ret)); 
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

        if ( !AdjustTokenPrivileges(Token, FALSE, &tp, 
                sizeof(TOKEN_PRIVILEGES), NULL, NULL) ) { 
            wprintf(L"AdjustTokenPrivileges failed - 0x%08x\n", 
                    GetLastError()); 
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
      Enabled ? SE_PRIVILEGE_ENABLED : 0; 
      // not use SE_PRIVILEGE_REMOVED, just disable

    if ( !AdjustTokenPrivileges(Token, FALSE, &tp, 
            sizeof(TOKEN_PRIVILEGES), NULL, NULL) ) { 
        wprintf(L"AdjustTokenPrivileges failed - 0x%08x\n", GetLastError()); 
        return FALSE; 
    } 
    
    if ( GetLastError()==ERROR_NOT_ALL_ASSIGNED ) { 
        wprintf(L"The process token does not have %s (%I64d).\n", 
                Name, luid); 
        return FALSE; 
    }

    wprintf(L"%s (%I64d) is temporarily %s.\n", Name, luid, 
        Enabled ? L"enabled" : L"disabled");

    return TRUE; 
}
```
 
dacl.cpp

 
```
// 
// dacl.cpp 
//

#include <Windows.h> 
#include <Sddl.h> 
#include <stdio.h>

#include "logue.h"

// add ACCESS_ALLOWED_ACEs of the specified SID to the object's DACL 
BOOL AddAccessAllowedAceBasedSID(HANDLE Object, PSID Sid, DWORD AceCount, 
                                CONST DWORD AceFlags[], 
                                CONST DWORD AccessMasks[]) { 
    BOOL Ret= FALSE; 
    SECURITY_INFORMATION DaclInfo= DACL_SECURITY_INFORMATION; 
    PACL Acl= NULL; // no need to free 
    PACL AclNew= NULL; 
    PSECURITY_DESCRIPTOR Sd= NULL; 
    PSECURITY_DESCRIPTOR SdNew= NULL; 
    DWORD SdSize= 0; 
    DWORD SdSizeNeeded= 0; 
    ACL_SIZE_INFORMATION AclSizeInfo; 
    DWORD AclSize= 0; 
    BOOL DaclPresent; 
    BOOL DaclDefaulted;

    // 
    // Obtain DACL from the object. 
    // http://msdn.microsoft.com/en-us/library/aa379573 
    // 
    if ( !GetUserObjectSecurity(Object, &DaclInfo, Sd, 0, &SdSizeNeeded) ) { 
        if ( GetLastError()!=ERROR_INSUFFICIENT_BUFFER ) 
            goto cleanup; 
            
        Sd= (PSECURITY_DESCRIPTOR)HeapAlloc(GetProcessHeap(), 
              HEAP_ZERO_MEMORY, SdSizeNeeded); 
        if ( Sd==NULL ) goto cleanup;

        SdSize= SdSizeNeeded; 
        if ( !GetUserObjectSecurity(Object, &DaclInfo, Sd, SdSize, 
                &SdSizeNeeded) ) 
            goto cleanup; 
    }

    // Obtain the DACL from the security descriptor. 
    if ( !GetSecurityDescriptorDacl(Sd, &DaclPresent, &Acl, &DaclDefaulted) ) 
        goto cleanup;

    // Initialize. 
    ZeroMemory(&AclSizeInfo, sizeof(ACL_SIZE_INFORMATION)); 
    AclSizeInfo.AclBytesInUse = sizeof(ACL); 
    if ( Acl ) { 
        if (!GetAclInformation(Acl, (LPVOID)&AclSizeInfo, 
               sizeof(ACL_SIZE_INFORMATION), AclSizeInformation) ) 
            goto cleanup; 
    }

    // Create a new ACL 
    // (original ACL + new ACCESS_ALLOWED_ACEs) 
    AclSize= AclSizeInfo.AclBytesInUse + 
        AceCount * (sizeof(ACCESS_ALLOWED_ACE) + 
        GetLengthSid(Sid) - sizeof(DWORD)); 
    AclNew= (PACL)HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, AclSize); 
    if ( AclNew==NULL ) goto cleanup;

    if ( !InitializeAcl(AclNew, AclSize, ACL_REVISION) ) 
        goto cleanup;

    // If DACL is present, copy all the ACEs to a new DACL. 
    if ( DaclPresent && AclSizeInfo.AceCount ) { 
        for ( DWORD i=0; i < AclSizeInfo.AceCount; ++i ) { 
            PVOID Ace= NULL; 
            if ( !GetAce(Acl, i, &Ace) ) goto cleanup;

            if (!AddAce(AclNew, ACL_REVISION, MAXDWORD, Ace, 
                  ((PACE_HEADER)Ace)->AceSize) ) 
                goto cleanup; 
        } 
    }

    // Add new ACEs of specified SID to the DACL 
    for ( DWORD i=0 ; i<AceCount ; ++i ) { 
        if (!AddAccessAllowedAceEx(AclNew, ACL_REVISION, AceFlags[i], 
                AccessMasks[i], Sid) ) 
            goto cleanup; 
    }

    // Create a new security descriptor. 
    // SECURITY_DESCRIPTOR_MIN_LENGTH is enough because 
    // SetSecurityDescriptorDacl creates absolute security descriptor 
    SdNew = (PSECURITY_DESCRIPTOR)HeapAlloc(GetProcessHeap(), 
      HEAP_ZERO_MEMORY, SECURITY_DESCRIPTOR_MIN_LENGTH); 
    if ( SdNew==NULL ) goto cleanup;

    if ( !InitializeSecurityDescriptor(SdNew, SECURITY_DESCRIPTOR_REVISION) ) 
        goto cleanup;

    // Set new DACL to the new security descriptor. 
    // (this security descriptor becomes an absolute SD) 
    if ( !SetSecurityDescriptorDacl(SdNew, TRUE, AclNew, FALSE) ) 
        goto cleanup; 
    
#ifdef _TRACING 
    wprintf(L"Original SD: %p\n", Sd); 
    wprintf(L"New SD     : %p\n", SdNew); 
    wprintf(L"-->\n"); 
    getwchar(); 
#endif

    // Set the new security descriptor for the desktop object. 
    if (!SetUserObjectSecurity(Object, &DaclInfo, SdNew)) 
        goto cleanup;

    Ret= TRUE;

cleanup: 
    if ( AclNew ) HeapFree(GetProcessHeap(), 0, AclNew); 
    if ( Sd ) HeapFree(GetProcessHeap(), 0, Sd); 
    if ( SdNew ) HeapFree(GetProcessHeap(), 0, SdNew);

    return Ret; 
}

// add ACCESS_ALLOWED_ACEs of the specified SID to the object's DACL 
BOOL RemoveAccessAllowedAcesBasedSID(HANDLE Object, PSID Sid) { 
    BOOL Ret= FALSE; 
    SECURITY_INFORMATION DaclInfo= DACL_SECURITY_INFORMATION; 
    PACL Acl= NULL; // no need to free 
    PACL AclNew= NULL; 
    PSECURITY_DESCRIPTOR Sd= NULL; 
    PSECURITY_DESCRIPTOR SdNew= NULL; 
    DWORD SdSize= 0; 
    DWORD SdSizeNeeded= 0; 
    ACL_SIZE_INFORMATION AclSizeInfo; 
    DWORD AclSize= 0; 
    BOOL DaclPresent; 
    BOOL DaclDefaulted;

    // 
    // Obtain DACL from the object. 
    // http://msdn.microsoft.com/en-us/library/aa379573 
    // 
    if ( !GetUserObjectSecurity(Object, &DaclInfo, Sd, 0, &SdSizeNeeded) ) { 
        if ( GetLastError()!=ERROR_INSUFFICIENT_BUFFER ) 
            goto cleanup; 
            
        Sd= (PSECURITY_DESCRIPTOR)HeapAlloc(GetProcessHeap(), 
              HEAP_ZERO_MEMORY, SdSizeNeeded); 
        if ( Sd==NULL ) goto cleanup;

        SdSize= SdSizeNeeded; 
        if ( !GetUserObjectSecurity(Object, &DaclInfo, Sd, SdSize, 
               &SdSizeNeeded) ) 
            goto cleanup; 
    }

    // Obtain the DACL from the security descriptor. 
    if ( !GetSecurityDescriptorDacl(Sd, &DaclPresent, &Acl, &DaclDefaulted) ) 
        goto cleanup;

    if ( !DaclPresent || !Acl || Acl->AceCount==0 ) { 
        // nothing to do for Null DACL or Empty DACL 
        // http://technet.microsoft.com/ja-jp/query/aa379286 
        Ret= TRUE; 
        goto cleanup; 
    }

    // Initialize. 
    ZeroMemory(&AclSizeInfo, sizeof(ACL_SIZE_INFORMATION)); 
    if (!GetAclInformation(Acl, (LPVOID)&AclSizeInfo, 
           sizeof(ACL_SIZE_INFORMATION), AclSizeInformation) ) 
        goto cleanup;

    // Create an ACL copy 
    AclSize= AclSizeInfo.AclBytesInUse; 
    AclNew= (PACL)HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, AclSize); 
    if ( AclNew==NULL ) goto cleanup;

    if ( !InitializeAcl(AclNew, AclSize, ACL_REVISION) ) 
        goto cleanup; 
    
    // do not copy ACCESS_ALLOWED_ACEs of the specified SID 
    if ( DaclPresent && AclSizeInfo.AceCount ) { 
        for ( DWORD i=0; i < AclSizeInfo.AceCount; ++i ) { 
            PVOID Ace= NULL; 
            if ( !GetAce(Acl, i, &Ace) ) goto cleanup; 
            
            if ( ((PACE_HEADER)Ace)->AceType==ACCESS_ALLOWED_ACE_TYPE && 
                    EqualSid(Sid, &((ACCESS_ALLOWED_ACE*)Ace)->SidStart) ) 
                continue;

            if (!AddAce(AclNew, ACL_REVISION, MAXDWORD, Ace, 
                  ((PACE_HEADER)Ace)->AceSize) ) 
                goto cleanup; 
        } 
    } 
    
    // Create a new security descriptor. 
    // SECURITY_DESCRIPTOR_MIN_LENGTH is enough because 
    // SetSecurityDescriptorDacl creates absolute security descriptor 
    SdNew = (PSECURITY_DESCRIPTOR)HeapAlloc(GetProcessHeap(), 
      HEAP_ZERO_MEMORY, SECURITY_DESCRIPTOR_MIN_LENGTH); 
    if ( SdNew==NULL ) goto cleanup;

    if ( !InitializeSecurityDescriptor(SdNew, SECURITY_DESCRIPTOR_REVISION) ) 
        goto cleanup;

    // Set new DACL to the new security descriptor. 
    // (this security descriptor becomes an absolute SD) 
    if ( !SetSecurityDescriptorDacl(SdNew, TRUE, AclNew, FALSE) ) 
        goto cleanup; 
    
#ifdef _TRACING 
    wprintf(L"Original SD: %p\n", Sd); 
    wprintf(L"New SD     : %p\n", SdNew); 
    wprintf(L"-->\n"); 
    getwchar(); 
#endif

    // Set the new security descriptor for the desktop object. 
    if (!SetUserObjectSecurity(Object, &DaclInfo, SdNew)) 
        goto cleanup;

    Ret= TRUE;

cleanup: 
    if ( AclNew ) HeapFree(GetProcessHeap(), 0, AclNew); 
    if ( Sd ) HeapFree(GetProcessHeap(), 0, Sd); 
    if ( SdNew ) HeapFree(GetProcessHeap(), 0, SdNew);

    return Ret; 
}

BOOL AddAceToDesktop(HDESK Desktop, PSID Sid) { 
    CONST DWORD AccessMasks[1] = { 
        DESKTOP_READOBJECTS | DESKTOP_CREATEWINDOW | DESKTOP_CREATEMENU | 
        DESKTOP_HOOKCONTROL | DESKTOP_JOURNALRECORD | 
        DESKTOP_JOURNALPLAYBACK | 
        DESKTOP_ENUMERATE | DESKTOP_WRITEOBJECTS | DESKTOP_SWITCHDESKTOP | 
        STANDARD_RIGHTS_REQUIRED 
    };

    DWORD AceFlags[1] = {0};

    return AddAccessAllowedAceBasedSID(Desktop, Sid, 
      1, AceFlags, AccessMasks); 
}

BOOL AddAceToWindowStation(HWINSTA Winsta, PSID Sid) { 
    CONST DWORD AccessMasks[2] = { 
        GENERIC_READ | GENERIC_WRITE | GENERIC_EXECUTE | GENERIC_ALL, 
        WINSTA_ENUMDESKTOPS | WINSTA_READATTRIBUTES | 
        WINSTA_ACCESSCLIPBOARD | 
        WINSTA_CREATEDESKTOP | WINSTA_WRITEATTRIBUTES | 
        WINSTA_ACCESSGLOBALATOMS | 
        WINSTA_EXITWINDOWS | WINSTA_ENUMERATE | WINSTA_READSCREEN | 
        STANDARD_RIGHTS_REQUIRED};

    CONST DWORD AceFlags[2] = { 
        CONTAINER_INHERIT_ACE|INHERIT_ONLY_ACE|OBJECT_INHERIT_ACE, 
        NO_PROPAGATE_INHERIT_ACE 
    };    

    return AddAccessAllowedAceBasedSID(Winsta, Sid, 
       2, AceFlags, AccessMasks); 
}

BOOL GetLogonSidFromToken(HANDLE Token, PSID *outSid) { 
    BOOL Ret= FALSE; 
    DWORD TokenGroupLength= 0; 
    DWORD SidLength= 0; 
    PTOKEN_GROUPS TokenGroup= NULL; 
    LPWSTR SidString= NULL;

    if ( !GetTokenInformation(Token, TokenGroups, (LPVOID)TokenGroup, 
            0, &TokenGroupLength) && 
            GetLastError()!=ERROR_INSUFFICIENT_BUFFER ) { 
        wprintf(L"GetTokenInformation (1st chance) failed - 0x%08x\n", 
                GetLastError()); 
        goto Cleanup; 
    }

    TokenGroup= (PTOKEN_GROUPS)HeapAlloc(GetProcessHeap(), 
                 HEAP_ZERO_MEMORY, TokenGroupLength); 
    if ( !TokenGroup ) { 
        wprintf(L"HeapAlloc failed - 0x%08x\n", GetLastError()); 
        goto Cleanup; 
    }

    if ( !GetTokenInformation(Token, TokenGroups, (LPVOID)TokenGroup, 
            TokenGroupLength, &TokenGroupLength) ) { 
        wprintf(L"GetTokenInformation failed (2nd chance) - 0x%08x\n", 
          GetLastError()); 
        goto Cleanup; 
    }

    // 
    // SE_GROUP_LOGON_ID 
    // The SID is a logon SID that identifies the logon session 
    // associated with an access token. 
    // http://technet.microsoft.com/en-us/library/aa379624 
    // 
    for ( DWORD i=0 ; i<TokenGroup->GroupCount ; ++i ) { 
        if ( SidString ) LocalFree(SidString); 
        ConvertSidToStringSid(TokenGroup->Groups[i].Sid, &SidString); 
        wprintf(L"SID: %s", SidString);

        if ( (TokenGroup->Groups[i].Attributes&SE_GROUP_LOGON_ID) 
                ==SE_GROUP_LOGON_ID ) { 
            SidLength= GetLengthSid(TokenGroup->Groups[i].Sid);

            *outSid= (PSID)HeapAlloc(GetProcessHeap(), 
               HEAP_ZERO_MEMORY, SidLength); 
            if ( *outSid==NULL ) {

                wprintf(L"HeapAlloc failed - 0x%08x\n", GetLastError()); 
                goto Cleanup; 
            }

            if ( !CopySid(SidLength, *outSid, TokenGroup->Groups[i].Sid) ) { 
                wprintf(L"CopySid failed - 0x%08x\n", GetLastError()); 
                HeapFree(GetProcessHeap(), 0, (LPVOID)*outSid); 
                goto Cleanup; 
            }

            wprintf(L" (Logon)\n"); 
            break; 
        } 
        else 
            wprintf(L"\n"); 
    } 
    
    Ret= TRUE;

Cleanup: 
    if ( SidString ) LocalFree(SidString); 
    if ( TokenGroup ) HeapFree(GetProcessHeap(), 0, TokenGroup); 
    return Ret; 
}
```
 
logue.h

 
```
// 
// logue.h 
//

#pragma once

#define _GUI 
#define _TRACING

VOID EnumPrivileges(HANDLE Token, BOOL All); 
BOOL AddPrivilege(HANDLE Token, LPCWSTR PrivilegeName); 
BOOL EnablePrivilege(HANDLE Token, LPWSTR Name, BOOL Enabled); 
BOOL CheckPrivilege(HANDLE Token, LPCWSTR PrivilegeName, LPLONG Privileged);

BOOL GetLogonSidFromToken(HANDLE Token, PSID *outSid); 
BOOL AddAceToWindowStation(HWINSTA Winsta, PSID Sid); 
BOOL AddAceToDesktop(HDESK Desktop, PSID Sid); 
BOOL RemoveAccessAllowedAcesBasedSID(HANDLE Object, PSID Sid);

VOID RunAs(LPWSTR inUser, LPWSTR inPW, LPWSTR inCommand);
```
