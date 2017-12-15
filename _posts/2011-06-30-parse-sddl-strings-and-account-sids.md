---
layout: post
title: "[Win32] [C++] CUI tool to parse SDDL Strings and account SIDs"
date: 2011-06-30 23:30:57.000 +09:00
categories:
- C/C++
- Windows
tags:
- ACE
- ACL
- DACL
- SACL
- SDDL
- SECURITY_DESCRIPTOR
---

Windows のアクセス許可設定の要と言えば、ACL (= Access Control List) です。これについては、@IT で特集が組まれていて、詳しく、かつ分かりやすい記事になっています。

 
[http://www.atmarkit.co.jp/fwin2k/win2ktips/700whatisacl/whatisacl.html](http://www.atmarkit.co.jp/fwin2k/win2ktips/700whatisacl/whatisacl.html)

 
この ACL に実際に出会うときというのは、レジストリに書かれたバイナリだったり、SDDL 文字列だったりするわけですが、プログラム上では、SECURITY_DESCRIPTOR 構造体として出会うことが多いです。

 
```
typedef struct _SECURITY_DESCRIPTOR { 
   BYTE  Revision; 
   BYTE  Sbz1; 
   SECURITY_DESCRIPTOR_CONTROL Control; 
   PSID Owner; 
   PSID Group; 
   PACL Sacl; 
   PACL Dacl;

} SECURITY_DESCRIPTOR, *PISECURITY_DESCRIPTOR; 


typedef PVOID PSECURITY_DESCRIPTOR;
```
 
ポインタの定義が PVOID になっているところがミソです。ポインタから構造体のメンバーに直接アクセスすることはなく、GetSecurityDescriptor 何ちゃらという API を使って値を取り出します。おそらく、SECURITY_DESCRIPTOR 構造体がバージョンによって大きく仕様変更される可能性があるからでしょう。

 
多くのアプリケーションは、AccessCheckAndAuditAlarm 関数を使って、この SECURITY_DESCRIPTOR とアクセス権限を照合しています。ここにブレークポイントを置いてデバッグすると幸せになれるときがあるかも。 <br />
[http://msdn.microsoft.com/en-us/library/aa374823(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/aa374823(v=vs.85).aspx)

 
SECURITY_DESCRIPTOR に含まれる SID や ACL は、以下のような微妙な定義のポインタがあるだけで、直接値を見ることはできません。これはバージョン間の互換性というよりは、SID や ACL の長さが可変であることが理由かと思います。

 
```
typedef PVOID PSID;

typedef struct _ACL { 
    BYTE  AclRevision; 
    BYTE  Sbz1;// パディング 
    WORD   AclSize; 
    WORD   AceCount; 
    WORD   Sbz2; // パディング 
    // ヘッダーのみで ACE は含まれていない 
} ACL; 
typedef ACL *PACL; 
```
 
そんなこんなで、SECURITY_DESRIPTOR, ACL (SACL | DACL), ACE などの登場人物は扱いにくいというイメージが定着しています。この得体の知れない SECURITY_DESRIPTOR を人間が読めるようにしたのが SDDL 文字列だったりするわけですが、フラグを全部暗記するのは大変です。大体の構造は覚えておいたほうがいいと思いますけどね。

 
SDDL 文字列は、身近なところでは cacls コマンドで見ることができます。

 
```
c:\Windows\System32>cacls advapi32.dll /s 
c:\Windows\System32\advapi32.dll "D:PAI(A;;FA;;;S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464)(A;;0x1200a9;;;BA)(A;;0x1200a9;;;SY)(A;;0x1200a9;;;BU)"
```
 
SDDL フォーマットは実際単純で、ここに全部書いてあります。 <br />
[http://msdn.microsoft.com/en-us/library/aa379570.aspx](http://msdn.microsoft.com/en-us/library/aa379570.aspx)

 
今回作ったツールは、日々の業務で利用頻度が高いわりに、調べると意外と簡単にできない以下の操作が可能です。

 
- 任意のユーザー (グループ) アカウントと SID の相互変換 
- SDDL の解析 

 
前者のツールは数多くあるようですが、SDDL の解析ツールは出回っていないような気がします。要するにデバッガーの !sd コマンドです。

 
基本的には API を呼ぶだけなので、アルゴリズム的にトリッキーなところはありません。アカウントと SID の変換は LookupAccountSid と LookupAccountName を使うだけですし、SDDL 関連は、ConvertStringSecurityDescriptorToSecurityDescriptor を呼んで SECURITY_DESCRIPTOR を取得してから、GetSecurityDescriptor~ を呼ぶだけです。ただ、ACE が種類によって異なる構造になっているので厄介です。

 
ソースを貼る前に、出力結果を載せておきます。SDDL に関しては、以下の MSDN のサンプルと基本的に同じになるように作ってあります。 <br />
[http://msdn.microsoft.com/en-us/library/aa379570.aspx](http://msdn.microsoft.com/en-us/library/aa379570.aspx)

 
```
> acehack -sddl O:BAG:BAD:(A;;RPWPCCDCLCRCWOWDSDSW;;;SY)(OA;;CCDC;bf967aa8-0de6-11d0-a285-00aa003049e2;;PO)(A;;RPLCRC;;;AU)S:(AU;SAFA;WDWOSDWPCCDCSW;;;WD)

O:BAG:BAD:(A;;RPWPCCDCLCRCWOWDSDSW;;;SY)(OA;;CCDC;bf967aa8-0de6-11d0-a285-00aa003049e2;;PO)(A;;RPLCRC;;;AU)S:(AU;SAFA;WDWOSDWPCCDCSW;;;WD) 
Revision:     0x00000001 
Control:      0x8014 
                  SE_DACL_PRESENT 
                  SE_SACL_PRESENT 
                  SE_SELF_RELATIVE 
RMControl:    0x00 
Owner:        S-1-5-32-544 
PrimaryGroup: S-1-5-32-544

DACL 
    Revision: 0x04 
    Size:     0x005c 
    AceCount: 0x0003 
    Ace[0] 
        AceType:       0x00 (ACCESS_ALLOWED_ACE_TYPE) 
        AceFlags:      0x00 
        AceSize:       0x0014 
        Access Mask:   0x000f003f 
                            DELETE 
                            READ_CONTROL 
                            WRITE_DAC 
                            WRITE_OWNER 
                            Others(0x0000003f) 
        Ace Sid:       S-1-5-18 
    Ace[1] 
        AceType:       0x05 (ACCESS_ALLOWED_OBJECT_ACE_TYPE) 
        AceFlags:      0x00 
        AceSize:       0x002c 
        Access Mask:   0x00000003 
                            ADS_RIGHT_DS_CREATE_CHILD 
                            ADS_RIGHT_DS_DELETE_CHILD 
        Access Flags:  0x00000001 (ACE_OBJECT_TYPE_PRESENT) 
        ObjectType:    {bf967aa8-0de6-11d0-a285-00aa003049e2} 
        InhObjectType: Not defined 
        Ace Sid:       S-1-5-32-550 
    Ace[2] 
        AceType:       0x00 (ACCESS_ALLOWED_ACE_TYPE) 
        AceFlags:      0x00 
        AceSize:       0x0014 
        Access Mask:   0x00020014 
                            READ_CONTROL 
                            Others(0x00000014) 
        Ace Sid:       S-1-5-11

SACL 
    Revision: 0x02 
    Size:     0x001c 
    AceCount: 0x0001 
    Ace[0] 
        AceType:       0x02 (SYSTEM_AUDIT_ACE_TYPE) 
        AceFlags:      0xc0 
                           SUCCESSFUL_ACCESS_ACE_FLAG 
                           FAILED_ACCESS_ACE_FLAG 
        AceSize:       0x0014 
        Access Mask:   0x000d002b 
                            DELETE 
                            WRITE_DAC 
                            WRITE_OWNER 
                            Others(0x0000002b) 
        Ace Sid:       S-1-1-0 


 
```
 
アカウント系は以下のような出力となります。

 
```
> acehack -account "network service" 
Account: network service 
Domain:  NT AUTHORITY 
SID:     S-1-5-20 
Type:    SidTypeWellKnownGroup

>acehack -sid S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464 
SID:     S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464 
Type:    SidTypeWellKnownGroup 
Account: NT SERVICE\TrustedInstaller 
```
 
 <br />
ソースファイルは以下の 2 つです。参考にした URL をところどころにコメントとして入れてあります。 ビルドする場合は、rpcrt4.lib もリンクさせる必要があります。これは GUID 構造体→ 文字列 の返還に UuidToString を使っているためです。

 
まずは main.cpp <br />
引数をパースしているだけです。

 
```
// 
// main.cpp 
//

#include <Windows.h> 
#include <stdio.h> 
#include <ctype.h> 
#include <string.h>

#define MAXLEN_OPMODE 16

BOOL OpmodeSid(LPCWSTR StringSid); 
BOOL OpmodeAccount(LPCWSTR Account); 
// BOOL OpmodeAccount(); not used 
BOOL OpmodeSddl(LPCWSTR Sddl);

/*

#### Usage

  acehack opmode <Option>

#### Opmode

  SID ( http://msdn.microsoft.com/en-us/library/aa379597 )

    acehack -SID S-1-5-64-21 
    acehack -SID BA 
      shows user or group name from specified SID 

  SDDL ( http://msdn.microsoft.com/en-us/library/aa379567(v=VS.85).aspx )

    acehack -SDDL D:(A;ID;FA;;;BA)(A;ID;FA;;;SY)(A;ID;0x1301bf;;;AU)(A;ID;0x1200a9;;;BU) 
      parses specified SDDL string

  Account

    acehack -Account System 
      shows account SID

*/

void ShowUsage() { 
    wprintf(L"\n#### Usage\n\n  acehack opmode <Option>\n\n#### Opmode\n\n"); 
    wprintf(L"  SID  ( http://msdn.microsoft.com/en-us/library/aa379597 )\n\n"); 
    wprintf(L"    acehack -SID S-1-5-64-21\n"); 
    wprintf(L"    acehack -SID BA\n      shows user or group name from specified SID \n\n"); 
    wprintf(L"  SDDL ( http://msdn.microsoft.com/en-us/library/aa379567(v=VS.85).aspx )\n\n"); 
    wprintf(L"    acehack -SDDL D:(A;ID;FA;;;BA)(A;ID;FA;;;SY)(A;ID;0x1301bf;;;AU)(A;ID;0x1200a9;;;BU)\n"); 
    wprintf(L"      parses specified SDDL string\n\n  Account\n\n"); 
    wprintf(L"    acehack -Account System\n      shows account SID\n"); 
}

static wchar_t upperstr[MAXLEN_OPMODE+1]; 
const wchar_t *ToUpper(const wchar_t *s) { 
    for ( int i=0 ; i<MAXLEN_OPMODE+1 ; ++i ) { 
        upperstr[i]= toupper(s[i]); 
        if ( s[i]==0 ) 
            return upperstr; 
    } 
    upperstr[MAXLEN_OPMODE]= 0; 
    return upperstr; 
}

int wmain(int argc, wchar_t *argv[]) { 
    if ( argc<3 ) { 
        ShowUsage(); 
        return 1; 
    }

    const wchar_t *UpperOpmode= ToUpper(argv[1]); 
    if ( wcscmp(UpperOpmode, L"-SID")==0 ) { 
        OpmodeSid(argv[2]); 
    } 
    else if ( wcscmp(UpperOpmode, L"-SDDL")==0 ) { 
        OpmodeSddl(argv[2]); 
    } 
    else if ( wcscmp(UpperOpmode, L"-ACCOUNT")==0 ) { 
        OpmodeAccount(argv[2]); 
    } 
    else { 
        wprintf(L"%s  =>  bad command.\n", argv[1]); 
        return 1; 
    }

    return 0; 
}
```
 
次にメインルーチンの acehack.cpp <br />
定数定義に行数を消費しまくりです。

 
```
// 
// acehack.cpp 
//

#include <Windows.h> 
#include <Sddl.h> 
#include <strsafe.h> 
#include <stdio.h> 
#include <Iads.h>

BOOL OpmodeAccount(); 
BOOL OpmodeAccount(LPCWSTR Account); 
BOOL OpmodeSid(LPCWSTR StringSid); 
BOOL OpmodeSddl(LPCWSTR Sddl);

/* 
http://msdn.microsoft.com/en-us/library/aa379601(VS.85).aspx

typedef enum _SID_NAME_USE { 
    SidTypeUser = 1, 
    SidTypeGroup, 
    SidTypeDomain, 
    SidTypeAlias, 
    SidTypeWellKnownGroup, 
    SidTypeDeletedAccount, 
    SidTypeInvalid, 
    SidTypeUnknown, 
    SidTypeComputer, 
    SidTypeLabel 
} SID_NAME_USE, *PSID_NAME_USE; 
*/ 
#define MAX_SIDTYPE 32 
const wchar_t SidTypeMapping[][MAX_SIDTYPE]= { 
    L"", 
    L"SidTypeUser", 
    L"SidTypeGroup", 
    L"SidTypeDomain", 
    L"SidTypeAlias", 
    L"SidTypeWellKnownGroup", 
    L"SidTypeDeletedAccount", 
    L"SidTypeInvalid", 
    L"SidTypeUnknown", 
    L"SidTypeComputer", 
    L"SidTypeLabel" 
};

/* 
http://msdn.microsoft.com/en-us/library/aa379566(v=VS.85).aspx

#define SE_OWNER_DEFAULTED               (0x0001) 
#define SE_GROUP_DEFAULTED               (0x0002) 
#define SE_DACL_PRESENT                  (0x0004) 
#define SE_DACL_DEFAULTED                (0x0008) 
#define SE_SACL_PRESENT                  (0x0010) 
#define SE_SACL_DEFAULTED                (0x0020) 
#define SE_DACL_AUTO_INHERIT_REQ         (0x0100) 
#define SE_SACL_AUTO_INHERIT_REQ         (0x0200) 
#define SE_DACL_AUTO_INHERITED           (0x0400) 
#define SE_SACL_AUTO_INHERITED           (0x0800) 
#define SE_DACL_PROTECTED                (0x1000) 
#define SE_SACL_PROTECTED                (0x2000) 
#define SE_RM_CONTROL_VALID              (0x4000) 
#define SE_SELF_RELATIVE                 (0x8000) 
*/

#define MAX_SDCONTROL 32

struct SDCONTROL_MAPPING { 
    SECURITY_DESCRIPTOR_CONTROL Flag; 
    WCHAR ControlName[MAX_SDCONTROL]; 
}; 
const SDCONTROL_MAPPING SdControlMapping[]= { 
    {SE_OWNER_DEFAULTED, L"SE_OWNER_DEFAULTED"}, 
    {SE_GROUP_DEFAULTED, L"SE_GROUP_DEFAULTED"}, 
    {SE_DACL_PRESENT, L"SE_DACL_PRESENT"}, 
    {SE_DACL_DEFAULTED, L"SE_DACL_DEFAULTED"}, 
    {SE_SACL_PRESENT, L"SE_SACL_PRESENT"}, 
    {SE_SACL_DEFAULTED, L"SE_SACL_DEFAULTED"}, 
    {SE_DACL_AUTO_INHERIT_REQ, L"SE_DACL_AUTO_INHERIT_REQ"}, 
    {SE_SACL_AUTO_INHERIT_REQ, L"SE_SACL_AUTO_INHERIT_REQ"}, 
    {SE_DACL_AUTO_INHERITED, L"SE_DACL_AUTO_INHERITED"}, 
    {SE_SACL_AUTO_INHERITED, L"SE_SACL_AUTO_INHERITED"}, 
    {SE_DACL_PROTECTED, L"SE_DACL_PROTECTED"}, 
    {SE_SACL_PROTECTED, L"SE_SACL_PROTECTED"}, 
    {SE_RM_CONTROL_VALID, L"SE_RM_CONTROL_VALID"}, 
    {SE_SELF_RELATIVE, L"SE_SELF_RELATIVE"}, 
    {0, L""}, 
};

/* 
http://msdn.microsoft.com/en-us/library/aa374919

#define ACCESS_MIN_MS_ACE_TYPE                  (0x0)- 
#define ACCESS_ALLOWED_ACE_TYPE                 (0x0) 
#define ACCESS_DENIED_ACE_TYPE                  (0x1) 
#define SYSTEM_AUDIT_ACE_TYPE                   (0x2) 
#define SYSTEM_ALARM_ACE_TYPE                   (0x3) 
#define ACCESS_MAX_MS_V2_ACE_TYPE               (0x3)- 
#define ACCESS_ALLOWED_COMPOUND_ACE_TYPE        (0x4) 
#define ACCESS_MAX_MS_V3_ACE_TYPE               (0x4)- 
#define ACCESS_MIN_MS_OBJECT_ACE_TYPE           (0x5)- 
#define ACCESS_ALLOWED_OBJECT_ACE_TYPE          (0x5) 
#define ACCESS_DENIED_OBJECT_ACE_TYPE           (0x6) 
#define SYSTEM_AUDIT_OBJECT_ACE_TYPE            (0x7) 
#define SYSTEM_ALARM_OBJECT_ACE_TYPE            (0x8) 
#define ACCESS_MAX_MS_OBJECT_ACE_TYPE           (0x8)- 
#define ACCESS_MAX_MS_V4_ACE_TYPE               (0x8)- 
#define ACCESS_MAX_MS_ACE_TYPE                  (0x8)- 
#define ACCESS_ALLOWED_CALLBACK_ACE_TYPE        (0x9) 
#define ACCESS_DENIED_CALLBACK_ACE_TYPE         (0xA) 
#define ACCESS_ALLOWED_CALLBACK_OBJECT_ACE_TYPE (0xB) 
#define ACCESS_DENIED_CALLBACK_OBJECT_ACE_TYPE  (0xC) 
#define SYSTEM_AUDIT_CALLBACK_ACE_TYPE          (0xD) 
#define SYSTEM_ALARM_CALLBACK_ACE_TYPE          (0xE) 
#define SYSTEM_AUDIT_CALLBACK_OBJECT_ACE_TYPE   (0xF) 
#define SYSTEM_ALARM_CALLBACK_OBJECT_ACE_TYPE   (0x10) 
#define SYSTEM_MANDATORY_LABEL_ACE_TYPE         (0x11) 
#define ACCESS_MAX_MS_V5_ACE_TYPE               (0x11)- 
*/

#define MAX_ACETYPE 41 
const WCHAR AceTypeMapping[][MAX_ACETYPE]= { 
    L"ACCESS_ALLOWED_ACE_TYPE", 
    L"ACCESS_DENIED_ACE_TYPE", 
    L"SYSTEM_AUDIT_ACE_TYPE", 
    L"SYSTEM_ALARM_ACE_TYPE", 
    L"ACCESS_ALLOWED_COMPOUND_ACE_TYPE", 
    L"ACCESS_ALLOWED_OBJECT_ACE_TYPE", 
    L"ACCESS_DENIED_OBJECT_ACE_TYPE", 
    L"SYSTEM_AUDIT_OBJECT_ACE_TYPE", 
    L"SYSTEM_ALARM_OBJECT_ACE_TYPE", 
    L"ACCESS_ALLOWED_CALLBACK_ACE_TYPE", 
    L"ACCESS_DENIED_CALLBACK_ACE_TYPE", 
    L"ACCESS_ALLOWED_CALLBACK_OBJECT_ACE_TYPE", 
    L"ACCESS_DENIED_CALLBACK_OBJECT_ACE_TYPE", 
    L"SYSTEM_AUDIT_CALLBACK_ACE_TYPE", 
    L"SYSTEM_ALARM_CALLBACK_ACE_TYPE", 
    L"SYSTEM_AUDIT_CALLBACK_OBJECT_ACE_TYPE", 
    L"SYSTEM_ALARM_CALLBACK_OBJECT_ACE_TYPE", 
    L"SYSTEM_MANDATORY_LABEL_ACE_TYPE",

    L"Unknown Type", 
};

/* 
#define OBJECT_INHERIT_ACE               (0x1) 
#define CONTAINER_INHERIT_ACE            (0x2) 
#define NO_PROPAGATE_INHERIT_ACE         (0x4) 
#define INHERIT_ONLY_ACE                 (0x8) 
#define INHERITED_ACE                    (0x10) 
#define SUCCESSFUL_ACCESS_ACE_FLAG       (0x40) 
#define FAILED_ACCESS_ACE_FLAG           (0x80) 
*/

#define MAX_ACEFLAG 32

struct ACEFLAG_MAPPING { 
    BYTE Flag; 
    WCHAR Name[MAX_ACEFLAG]; 
}; 
const ACEFLAG_MAPPING AceFlagMapping[]= { 
    {OBJECT_INHERIT_ACE, L"OBJECT_INHERIT_ACE"}, 
    {CONTAINER_INHERIT_ACE, L"CONTAINER_INHERIT_ACE"}, 
    {NO_PROPAGATE_INHERIT_ACE, L"NO_PROPAGATE_INHERIT_ACE"}, 
    {INHERIT_ONLY_ACE, L"INHERIT_ONLY_ACE"}, 
    {INHERITED_ACE, L"INHERITED_ACE"}, 
    {SUCCESSFUL_ACCESS_ACE_FLAG, L"SUCCESSFUL_ACCESS_ACE_FLAG"}, 
    {FAILED_ACCESS_ACE_FLAG, L"FAILED_ACCESS_ACE_FLAG"}, 
    {0, L""} 
};

/* 
http://msdn.microsoft.com/en-us/library/aa374892

#define DELETE                           (0x00010000L) 
#define READ_CONTROL                     (0x00020000L) 
#define WRITE_DAC                        (0x00040000L) 
#define WRITE_OWNER                      (0x00080000L) 
#define SYNCHRONIZE                      (0x00100000L) 
#define ACCESS_SYSTEM_SECURITY           (0x01000000L) 
#define MAXIMUM_ALLOWED                  (0x02000000L) 
#define GENERIC_ALL                      (0x10000000L) 
#define GENERIC_EXECUTE                  (0x20000000L) 
#define GENERIC_WRITE                    (0x40000000L) 
#define GENERIC_READ                     (0x80000000L) 
*/

#define MAX_ACESSMASK 40

struct ACCESSMASK_MAPPING { 
    ACCESS_MASK Flag; 
    WCHAR Name[MAX_ACESSMASK]; 
};

ACCESSMASK_MAPPING AccessMaskMaping[]= { 
    {DELETE, L"DELETE"}, 
    {READ_CONTROL, L"READ_CONTROL"}, 
    {WRITE_DAC, L"WRITE_DAC"}, 
    {WRITE_OWNER, L"WRITE_OWNER"}, 
    {SYNCHRONIZE, L"SYNCHRONIZE"}, 
    {ACCESS_SYSTEM_SECURITY, L"ACCESS_SYSTEM_SECURITY"}, 
    {MAXIMUM_ALLOWED, L"MAXIMUM_ALLOWED"}, 
    {GENERIC_ALL, L"GENERIC_ALL"}, 
    {GENERIC_EXECUTE, L"GENERIC_EXECUTE"}, 
    {GENERIC_WRITE, L"GENERIC_WRITE"}, 
    {GENERIC_READ, L"GENERIC_READ"}, 
    {0, L""} 
};

/* 
http://msdn.microsoft.com/en-us/library/aa965848

#define SYSTEM_MANDATORY_LABEL_NO_WRITE_UP         0x1 
#define SYSTEM_MANDATORY_LABEL_NO_READ_UP          0x2 
#define SYSTEM_MANDATORY_LABEL_NO_EXECUTE_UP       0x4 
*/ 
ACCESSMASK_MAPPING SysMandatoryMapping[]= { 
    {SYSTEM_MANDATORY_LABEL_NO_WRITE_UP, L"SYSTEM_MANDATORY_LABEL_NO_WRITE_UP"}, 
    {SYSTEM_MANDATORY_LABEL_NO_READ_UP, L"SYSTEM_MANDATORY_LABEL_NO_READ_UP"}, 
    {SYSTEM_MANDATORY_LABEL_NO_EXECUTE_UP, L"SYSTEM_MANDATORY_LABEL_NO_EXECUTE_UP"}, 
    {0, L""} 
};

/* 
http://msdn.microsoft.com/en-us/library/aa772285(v=vs.85).aspx

  ADS_RIGHT_DS_CREATE_CHILD          = 0x1, 
  ADS_RIGHT_DS_DELETE_CHILD          = 0x2, 
  ADS_RIGHT_ACTRL_DS_LIST            = 0x4, 
  ADS_RIGHT_DS_SELF                  = 0x8, 
  ADS_RIGHT_DS_READ_PROP             = 0x10, 
  ADS_RIGHT_DS_WRITE_PROP            = 0x20, 
  ADS_RIGHT_DS_DELETE_TREE           = 0x40, 
  ADS_RIGHT_DS_LIST_OBJECT           = 0x80, 
  ADS_RIGHT_DS_CONTROL_ACCESS        = 0x100 
*/

ACCESSMASK_MAPPING AdsRightMapping[]= { 
    {ADS_RIGHT_DS_CREATE_CHILD, L"ADS_RIGHT_DS_CREATE_CHILD"}, 
    {ADS_RIGHT_DS_DELETE_CHILD, L"ADS_RIGHT_DS_DELETE_CHILD"}, 
    {ADS_RIGHT_ACTRL_DS_LIST, L"ADS_RIGHT_ACTRL_DS_LIST"}, 
    {ADS_RIGHT_DS_SELF, L"ADS_RIGHT_DS_SELF"}, 
    {ADS_RIGHT_DS_READ_PROP, L"ADS_RIGHT_DS_READ_PROP"}, 
    {ADS_RIGHT_DS_WRITE_PROP, L"ADS_RIGHT_DS_WRITE_PROP"}, 
    {ADS_RIGHT_DS_LIST_OBJECT, L"ADS_RIGHT_DS_LIST_OBJECT"}, 
    {ADS_RIGHT_DS_CONTROL_ACCESS, L"ADS_RIGHT_DS_CONTROL_ACCESS"}, 
    {0, L""} 
};


/* 
http://msdn.microsoft.com/en-us/library/aa374857.aspx 
#define ACE_OBJECT_TYPE_PRESENT           0x1 
#define ACE_INHERITED_OBJECT_TYPE_PRESENT 0x2 
*/

#define MAX_OBJECTTYPE 64 
#define OBJECTTYPE_SUPPORTED_MAX ACE_OBJECT_TYPE_PRESENT|ACE_INHERITED_OBJECT_TYPE_PRESENT

const WCHAR ObjectTypeMapping[][MAX_OBJECTTYPE]= { 
    L"", 
    L"ACE_OBJECT_TYPE_PRESENT", 
    L"ACE_INHERITED_OBJECT_TYPE_PRESENT", 
    L"ACE_OBJECT_TYPE_PRESENT|ACE_INHERITED_OBJECT_TYPE_PRESENT", 
    
    L"Unknown" 
};


#define GOTO_CLEANUP(ERRMSG) \ 
    if ( !ret ) { \ 
        wprintf(ERRMSG, GetLastError()); \ 
        ret= FALSE; \ 
        goto cleanup; \ 
    }

BOOL OpmodeSid(LPCWSTR StringSid) { 
    BOOL ret= FALSE; 
    PSID Sid= NULL; 
    DWORD NameLength= 0; 
    DWORD DomainLength= 0; 
    SID_NAME_USE SidType; 
    LPWSTR Account= NULL; 
    LPWSTR Name= NULL;

    ret= ConvertStringSidToSid(StringSid, &Sid); 
    GOTO_CLEANUP(L"ConvertStringSidToSid failed (%d)\n");

    ret= LookupAccountSid(NULL, Sid, 
        NULL, &NameLength, 
        NULL, &DomainLength, 
        &SidType); 
    
    int LenTotal= DomainLength+NameLength+1; 
    Account= new WCHAR[NameLength]; 
    Name= new WCHAR[LenTotal]; 
    ret= LookupAccountSid(NULL, Sid, 
        Account, &NameLength, 
        Name, &DomainLength, 
        &SidType); 
    GOTO_CLEANUP(L"LookupAccountSid failed (%d)\n"); 
    
    StringCchCat(Name, LenTotal, L"\\"); 
    StringCchCat(Name, LenTotal, Account);

    // result 
    wprintf(L"SID:     %s\n", StringSid); 
    wprintf(L"Type:    %s\n", SidTypeMapping[SidType]); 
    wprintf(L"Account: %s\n", Name);

    ret= TRUE;

cleanup: 
    if ( Account ) delete [] Account; 
    if ( Name ) delete [] Name; 
    if ( Sid ) LocalFree(Sid);

    return ret; 
}

BOOL OpmodeAccount() { 
    BOOL ret= FALSE; 
    LPWSTR User= NULL; 
    DWORD UserLength= 0;

    ret= GetUserName(NULL, &UserLength); 
    if ( !ret && GetLastError()!=ERROR_INSUFFICIENT_BUFFER ) { 
        wprintf(L"GetUserName failed (%d)\n", GetLastError()); 
        ret= FALSE; 
        goto cleanup; 
    }

    User= new WCHAR[UserLength]; 
    ret= GetUserName(User, &UserLength); 
    GOTO_CLEANUP(L"GetUserName failed (%d)\n");

    OpmodeAccount(User);

    return TRUE;

cleanup: 
    if ( User ) delete [] User; 
    return ret; 
}

BOOL OpmodeAccount(LPCWSTR Account) { 
    BOOL ret= FALSE; 
    PSID Sid= NULL; 
    DWORD SidLength= 0; 
    LPWSTR Domain= NULL; 
    DWORD DomainLength= 0; 
    SID_NAME_USE SidType; 
    LPWSTR StringSid= NULL;

    ret= LookupAccountName(NULL, Account, 
        NULL, &SidLength, 
        NULL, &DomainLength, 
        &SidType);

    Sid= new BYTE[SidLength]; 
    Domain= new WCHAR[DomainLength];

    ret= LookupAccountName(NULL, Account, 
        Sid, &SidLength, 
        Domain, &DomainLength, 
        &SidType); 
    GOTO_CLEANUP(L"LookupAccountName failed (%d)\n");

    ret= ConvertSidToStringSid(Sid, &StringSid); 
    GOTO_CLEANUP(L"ConvertSidToStringSid failed (%d)\n");

    // result 
    wprintf(L"Account: %s\n", Account); 
    wprintf(L"Domain:  %s\n", Domain); 
    wprintf(L"SID:     %s\n", StringSid); 
    wprintf(L"Type:    %s\n", SidTypeMapping[SidType]);

    ret= TRUE;

cleanup: 
    if ( StringSid ) LocalFree(StringSid); 
    if ( Sid ) delete [] Sid; 
    if ( Domain ) delete [] Domain; 
    return ret; 
}

// http://msdn.microsoft.com/en-us/library/aa374912(v=VS.85).aspx 
// http://msdn.microsoft.com/en-us/library/aa374919 
void ShowAce(BYTE AceType, PVOID RawAce) { 
    BOOL ret= FALSE; 
    int i= 0;

    switch ( AceType ) { 
    case ACCESS_ALLOWED_ACE_TYPE: 
    case ACCESS_ALLOWED_CALLBACK_ACE_TYPE: 
    case ACCESS_DENIED_ACE_TYPE: 
    case ACCESS_DENIED_CALLBACK_ACE_TYPE: 
    case SYSTEM_ALARM_ACE_TYPE: 
    case SYSTEM_ALARM_CALLBACK_ACE_TYPE: 
    case SYSTEM_AUDIT_ACE_TYPE: 
    case SYSTEM_AUDIT_CALLBACK_ACE_TYPE: 
    case SYSTEM_MANDATORY_LABEL_ACE_TYPE: 
        { 
            PACCESS_ALLOWED_ACE Ace= (PACCESS_ALLOWED_ACE)RawAce; 
            LPWSTR Sid= NULL; LPCWSTR SidUnknown= L"Unknown"; 
            ret= ConvertSidToStringSid((PSID)&Ace->SidStart, &Sid); 
            if ( !ret ) 
                wprintf(L"ConvertSidToStringSid failed (%d)\n", 
                  GetLastError());

            ACCESS_MASK Mask= Ace->Mask; 
            wprintf(L"        Access Mask:   0x%08x\n", Mask); 
            for ( i=0 ; AccessMaskMaping[i].Flag!=0 ; ++i ) { 
                if ( AccessMaskMaping[i].Flag&Mask ) { 
                    wprintf(L"                            %s\n", 
                      AccessMaskMaping[i].Name); 
                    Mask&= ~AccessMaskMaping[i].Flag; 
                } 
            } 
            if ( Mask ) { 
                if ( AceType==SYSTEM_MANDATORY_LABEL_ACE_TYPE ) { 
                    for ( i=0 ; SysMandatoryMapping[i].Flag!=0 ; ++i ) { 
                        if ( SysMandatoryMapping[i].Flag&Mask ) { 
                            wprintf(L"                            %s\n", 
                              SysMandatoryMapping[i].Name); 
                            Mask&= ~SysMandatoryMapping[i].Flag; 
                        } 
                    } 
                }

                if ( Mask ) 
                    wprintf(L"                            Others(0x%08x)\n", 
                      Mask); 
            }

            wprintf(L"        Ace Sid:       %s\n", Sid ? Sid : SidUnknown);

            if ( Sid) LocalFree(Sid); 
        } 
        break; 
        
    case ACCESS_ALLOWED_OBJECT_ACE_TYPE: 
    case ACCESS_ALLOWED_CALLBACK_OBJECT_ACE_TYPE: 
    case ACCESS_DENIED_OBJECT_ACE_TYPE: 
    case ACCESS_DENIED_CALLBACK_OBJECT_ACE_TYPE: 
    case SYSTEM_ALARM_OBJECT_ACE_TYPE: 
    case SYSTEM_ALARM_CALLBACK_OBJECT_ACE_TYPE: 
    case SYSTEM_AUDIT_OBJECT_ACE_TYPE: 
    case SYSTEM_AUDIT_CALLBACK_OBJECT_ACE_TYPE: 
        { 
            PACCESS_ALLOWED_OBJECT_ACE Ace= 
              (PACCESS_ALLOWED_OBJECT_ACE)RawAce; 
            LPWSTR Sid= NULL; LPCWSTR SidUnknown= L"Unknown"; 
            LPGUID GuidObj= NULL; 
            LPGUID GuidInheritedObj= NULL; 
            PSID SidOffset= NULL; 
            RPC_WSTR GuidString= NULL; 
            RPC_STATUS RpcRet= RPC_S_OK;

            ACCESS_MASK Mask= Ace->Mask; 
            wprintf(L"        Access Mask:   0x%08x\n", Mask); 
            for ( i=0 ; AccessMaskMaping[i].Flag!=0 ; ++i ) { 
                if ( AccessMaskMaping[i].Flag&Mask ) { 
                    wprintf(L"                            %s\n", 
                      AccessMaskMaping[i].Name); 
                    Mask&= ~AccessMaskMaping[i].Flag; 
                } 
            } 
            if ( Mask ) { 
                if ( Ace->Flags&ACE_OBJECT_TYPE_PRESENT ) { 
                    for ( i=0 ; AdsRightMapping[i].Flag!=0 ; ++i ) { 
                        if ( AdsRightMapping[i].Flag&Mask ) { 
                            wprintf(L"                            %s\n", 
                              AdsRightMapping[i].Name); 
                            Mask&= ~AdsRightMapping[i].Flag; 
                        } 
                    } 
                }

                if ( Mask ) 
                    wprintf(L"                            Others(0x%08x)\n", 
                      Mask); 
            } 
            
            wprintf(L"        Access Flags:  0x%08x (%s)\n", Ace->Flags, 
                ObjectTypeMapping[min( 
                  Ace->Flags, OBJECTTYPE_SUPPORTED_MAX+1)]); 
            switch ( Ace->Flags ) { 
            case 0: 
                GuidObj= GuidInheritedObj= NULL; 
                SidOffset= (PSID)&Ace->ObjectType; 
                break; 
            case ACE_OBJECT_TYPE_PRESENT: 
                GuidObj= &Ace->ObjectType; 
                GuidInheritedObj= NULL; 
                SidOffset= (PSID)&Ace->InheritedObjectType; 
                break; 
            case ACE_INHERITED_OBJECT_TYPE_PRESENT: 
                GuidObj= NULL; 
                GuidInheritedObj= &Ace->ObjectType; 
                SidOffset= (PSID)&Ace->InheritedObjectType; 
                break; 
            case ACE_OBJECT_TYPE_PRESENT|ACE_INHERITED_OBJECT_TYPE_PRESENT: 
                GuidObj= &Ace->ObjectType; 
                GuidInheritedObj= &Ace->InheritedObjectType; 
                SidOffset= (PSID)&Ace->SidStart; 
                break; 
            default: 
                GuidObj= GuidInheritedObj= NULL; 
                SidOffset= NULL; 
                break; 
            } 
            
            if ( GuidObj ) { 
                RpcRet= UuidToString(GuidObj, &GuidString); 
                if ( RpcRet==RPC_S_OK ) 
                    wprintf(L"        ObjectType:    {%s}\n", GuidString); 
                else 
                    wprintf(L"UuidToString failed (%d)\n", RpcRet);

                if ( GuidString ) RpcStringFree(&GuidString); 
            } 
            else 
                wprintf(L"        ObjectType:    Not defined\n");

            if ( GuidInheritedObj ) { 
                RpcRet= UuidToString(GuidObj, &GuidString); 
                
                if ( RpcRet==RPC_S_OK ) 
                    wprintf(L"        InhObjectType: {%s}\n", GuidString); 
                else 
                    wprintf(L"UuidToString failed (%d)\n", RpcRet);

                if ( GuidString ) RpcStringFree(&GuidString); 
            } 
            else 
                wprintf(L"        InhObjectType: Not defined\n"); 
            
            ret= ConvertSidToStringSid(SidOffset, &Sid); 
            if ( !ret ) 
                wprintf(L"ConvertSidToStringSid failed (%d)\n", 
                  GetLastError()); 
            wprintf(L"        Ace Sid:       %s\n", Sid ? Sid : SidUnknown);

            if ( Sid) LocalFree(Sid); 
        } 
        break; 
         
        
    case ACCESS_ALLOWED_COMPOUND_ACE_TYPE: // reserved 
    default: 
        break; 
    } 
}

// http://msdn.microsoft.com/en-us/library/aa374912(v=VS.85).aspx 
void ShowAcl(PACL Acl) { 
    if ( Acl==NULL || Acl->AceCount==0 ) 
        return;

    BOOL ret= FALSE; 
    PACE_HEADER AceHeader= NULL;

    for ( int i=0 ; i<Acl->AceCount ; ++i ) { 
        AceHeader= NULL; 
        ret= GetAce(Acl, i, (LPVOID*)&AceHeader); 
        if ( !ret ) { 
            wprintf(L"    Ace[%d] -> GetAce failed (%d)\n", 
              i, GetLastError()); 
            continue; 
        }

        wprintf(L"    Ace[%d]\n", i); 
        wprintf(L"        AceType:       0x%02x (%s)\n", AceHeader->AceType, 
            AceTypeMapping[min(AceHeader->AceType, 
              ACCESS_MAX_MS_V5_ACE_TYPE+1)]); 
        wprintf(L"        AceFlags:      0x%02x\n", AceHeader->AceFlags); 
        for ( int i=0 ; AceFlagMapping[i].Flag!=0 ; ++i ) { 
            if ( AceHeader->AceFlags&AceFlagMapping[i].Flag ) 
                wprintf(L"                           %s\n", 
                  AceFlagMapping[i].Name); 
        } 
        wprintf(L"        AceSize:       0x%04x\n", AceHeader->AceSize);

        ShowAce(AceHeader->AceType, AceHeader); 
    } 
}

BOOL OpmodeSddl(LPCWSTR Sddl) { 
    BOOL ret= FALSE; 
    PSECURITY_DESCRIPTOR Sd= NULL; 
    ULONG SdLength= 0; 
    SECURITY_DESCRIPTOR_CONTROL SdCtrl= 0; 
    DWORD SdRevision= 0; 
    UCHAR RmControl= 0; 
    BOOL Default= FALSE; 
    PSID Owner= NULL; 
    LPWSTR OwnerString= NULL; 
    PSID Group= NULL; 
    LPWSTR GroupString= NULL; 
    BOOL DaclPresent= FALSE; 
    PACL Dacl= NULL; 
    BOOL SaclPresent= FALSE; 
    PACL Sacl= NULL;

    ret= ConvertStringSecurityDescriptorToSecurityDescriptor( 
        Sddl, SDDL_REVISION_1, &Sd, &SdLength); 
    GOTO_CLEANUP( 
      L"ConvertStringSecurityDescriptorToSecurityDescriptor failed (%d)\n");

    // Control & Revision 
    ret= GetSecurityDescriptorControl(Sd, &SdCtrl, &SdRevision); 
    GOTO_CLEANUP(L"GetSecurityDescriptorControl failed (%d)\n");

    // RMControl 
    ret= GetSecurityDescriptorRMControl(Sd, &RmControl); 
    GOTO_CLEANUP(L"GetSecurityDescriptorRMControl failed (%d)\n");

    // Owner 
    ret= GetSecurityDescriptorOwner(Sd, &Owner, &Default); 
    GOTO_CLEANUP(L"GetSecurityDescriptorOwner failed (%d)\n"); 
    if ( Owner ) { 
        ret= ConvertSidToStringSid(Owner, &OwnerString); 
        GOTO_CLEANUP(L"ConvertSidToStringSid failed (%d)\n"); 
    }

    // PrimaryGroup 
    ret= GetSecurityDescriptorGroup(Sd, &Group, &Default); 
    GOTO_CLEANUP(L"GetSecurityDescriptorGroup failed (%d)\n"); 
    if ( Group ) { 
        ret= ConvertSidToStringSid(Group, &GroupString); 
        GOTO_CLEANUP(L"ConvertSidToStringSid failed (%d)\n"); 
    }

    // Dacl 
    ret= GetSecurityDescriptorDacl(Sd, &DaclPresent, &Dacl, &Default); 
    GOTO_CLEANUP(L"GetSecurityDescriptorDacl failed (%d)\n");

    // Sacl 
    ret= GetSecurityDescriptorSacl(Sd, &SaclPresent, &Sacl, &Default); 
    GOTO_CLEANUP(L"GetSecurityDescriptorSacl failed (%d)\n");

    // result 
    wprintf(L"%s\n", Sddl); 
    wprintf(L"Revision:     0x%08x\n", SdRevision);

    SECURITY_DESCRIPTOR_CONTROL SdCtrlCopy= SdCtrl; 
    wprintf(L"Control:      0x%04x\n", SdCtrl); 
    for ( int i=0 ; SdControlMapping[i].Flag!=0 ; ++i ) { 
        if ( SdControlMapping[i].Flag&SdCtrl ) { 
            wprintf(L"                  %s\n", 
              SdControlMapping[i].ControlName); 
            SdCtrlCopy&= ~SdControlMapping[i].Flag; 
        } 
    } 
    if ( SdCtrlCopy ) 
        wprintf(L"                  Others(0x%04x)\n", SdCtrlCopy);

    wprintf(L"RMControl:    0x%02x\n", RmControl); 
    
    if ( Owner ) 
        wprintf(L"Owner:        %s\n", OwnerString); 
    else 
        wprintf(L"Owner:        No owner\n");

    if ( Group ) 
        wprintf(L"PrimaryGroup: %s\n", GroupString); 
    else 
        wprintf(L"PrimaryGroup: No group\n");

    wprintf(L"\n");

    if ( !DaclPresent ) 
        wprintf(L"No DACL\n"); 
    else if ( Dacl==NULL ) 
        // NULL ACLs are not supported in SDDL, but just in case... 
        wprintf(L"NULL DACL\n"); 
    else { 
        wprintf(L"DACL\n"); 
        wprintf(L"    Revision: 0x%02x\n", Dacl->AclRevision); 
        wprintf(L"    Size:     0x%04x\n", Dacl->AclSize); 
        wprintf(L"    AceCount: 0x%04x\n", Dacl->AceCount); 
        ShowAcl(Dacl); 
    } 
    
    wprintf(L"\n"); 
    
    if ( !SaclPresent ) 
        wprintf(L"No SACL\n"); 
    else if ( Sacl==NULL ) 
        wprintf(L"NULL SACL\n"); 
    else { 
        wprintf(L"SACL\n"); 
        wprintf(L"    Revision: 0x%02x\n", Sacl->AclRevision); 
        wprintf(L"    Size:     0x%04x\n", Sacl->AclSize); 
        wprintf(L"    AceCount: 0x%04x\n", Sacl->AceCount); 
        ShowAcl(Sacl); 
    }

    ret= TRUE; 
    
cleanup: 
    if ( OwnerString ) LocalFree(OwnerString); 
    if ( Sd ) LocalFree(Sd); 
    return ret; 
}
```
