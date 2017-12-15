---
layout: post
title: "[Win32] [C++] CreateProcessAsUser – #2 トークン編"
date: 2011-12-31 21:53:02.000 +09:00
categories:
- Debug
- Windows
tags:
- ACE
- CreateProcessAsUser
- DACL
- SecurityDescriptor
- SECURITY_DESCRIPTOR
- SID
---

次に、CreateProcessAsUser で STATUS_DLL_INIT_FAILED (=0xc0000142) エラーが発生する現象についてです。 <br />
こんなダイアログが表示されます。

 
「アプリケーションを正しく起動できませんでした (0xc0000142)。」 <br />
![]({{site.assets_url}}2011-12-31-image.png)

 
STATUS_DLL_INIT_FAILED エラーという名前からして、アクセス許可エラーではなく、何らかの DLL の初期化に失敗したようです。win32k とか、GUI スレッドに関連していそうです。

 
このダイアログを表示させているプロセスは、CreateProcessAsUser を実行したプロセスや、実行しようとしたプロセス (上の例だと notepad.exe) ではなく、csrss.exe です。CSRSS とは、Client Server Run-Time Subsystem の略で、win32 サブシステムのユーザー モード部分です。

 
とりあえず、デバッガーでスタックを見てみます。環境は Windows Server 2008 R2 SP1 です。tasklist で csrss を見ると Services と Console がありますが、ポップアップを表示させているのは Console の方です。

 
ユーザー モードで見ると、以下のスレッドがメッセージボックスを表示させていることが分かります。しかし、CsrApiRequestThread という関数からいきなりハードエラーが発生しているので、ここからは何も分かりません。カーネル モードから見ても、芳しい結果は得られず保留。CsrApiRequestThread の内容をごりごり見るしかないのかもしれない。ちょっとこれは大変そうなのでパス。

 
```
   4  Id: 560.450 Suspend: 1 Teb: 000007ff`fffdd000 Unfrozen 
Child-SP          RetAddr           Call Site 
00000000`00a4f198 00000000`77584bc4 USER32!ZwUserWaitMessage+0xa 
00000000`00a4f1a0 00000000`77584edd USER32!DialogBox2+0x274 
00000000`00a4f230 00000000`775d2920 USER32!InternalDialogBox+0x135 
00000000`00a4f290 00000000`775d1c15 USER32!SoftModalMessageBox+0x9b4 
00000000`00a4f3c0 00000000`775d146b USER32!MessageBoxWorker+0x31d 
00000000`00a4f580 000007fe`fd702de9 USER32!MessageBoxTimeoutW+0xb3 
00000000`00a4f650 000007fe`fd7031e8 winsrv!HardErrorHandler+0x33d 
00000000`00a4f7f0 000007fe`fd703562 winsrv!ProcessHardErrorRequest+0xe8 
00000000`00a4f860 000007fe`fd754a04 winsrv!UserHardErrorEx+0x356 
00000000`00a4f8f0 000007fe`fd7550f4 CSRSRV!QueueHardError+0x138 
00000000`00a4f930 00000000`777e4a00 CSRSRV!CsrApiRequestThread+0x510 
00000000`00a4fc40 00000000`00000000 ntdll!RtlUserThreadStart+0x25
```
 
さて、STATUS_DLL_INIT_FAILED エラーの詳細は不明ですが、解決方法は分かっているわけです。2 月に記事を書いたときには ACL についてよく知らなかったので適当に MSDN のサンプルをコピペしましたが、もう少し真面目に見てみます。

 
サンプルはこれでした。

 
Starting an Interactive Client Process in C++ <br />
[http://msdn.microsoft.com/en-us/library/aa379608(v=VS.85).aspx](http://msdn.microsoft.com/en-us/library/aa379608(v=VS.85).aspx)

 
CreateProcessAsUser を実行する前の主な処理は、こんな感じです。

 
1. LogonUser API でログオン処理を行ない、トークンを生成 
1. GetLogonSID で、1. のトークンからログオン SID を取得 
1. AddAceToWindowStation で、ウィンドウ ステーション オブジェクトの DACL に <br />
2. の SID に対するアクセス許可 ACE を追加 
1. AddAceToDesktop で、デスクトップ オブジェクトの DACL に <br />
2. の SID に対するアクセス許可 ACE を追加 
1. CreateProcessAsUser 実行 

 
まずは、GetLogonSID の処理から見てみます。ここで取得される SID はログオン SID といって、ユーザーやセキュリティ グループに割り当てられた SID とは別のものです。ログオン セッション毎にユニークな値になっています。つまり、CreateProcessAsUser が返すトークンに紐付いたログオン SID は毎回異なっています。

 
logon SID <br />
[http://msdn.microsoft.com/en-us/library/ms721592(v=VS.85).aspx#_security_logon_sid_gly](http://msdn.microsoft.com/en-us/library/ms721592(v=VS.85).aspx#_security_logon_sid_gly)

 
```
A security identifier (SID) that identifies a logon session. You can use the logon SID in a DACL to control access during a logon session. A logon SID is valid until the user logs off. A logon SID is unique while the computer is running; no other logon session will have the same logon SID. However, the set of possible logon SIDs is reset when the computer starts up. To retrieve the logon SID from an access token, call the GetTokenInformation function for TokenGroups.
```
 
ログオン SID は !token コマンドで見ることができます。そして、トークン オブジェクトのアドレスは !process コマンドで出力することができます。しかし、それだと何も面白くないので、もう少し捻ります。

 
プロセスに紐付く情報は、基本的に _EPROCESS 構造体から辿ることができます。トークンも例外ではありません。

 
```
kd> dt _EPROCESS Token 
nt!_EPROCESS 
   +0x208 Token : _EX_FAST_REF 
kd> dt _EX_FAST_REF 
nt!_EX_FAST_REF 
   +0x000 Object           : Ptr64 Void 
   +0x000 RefCnt           : Pos 0, 4 Bits 
   +0x000 Value            : Uint8B
```
 
_EPROCESS::Token は単なるポインターではなく、\_EX_FAST_REF という構造になっています。これは、以下のサイトの情報にあるように下位ビット (32bit なら 3、64bit なら 4 ビット) を RefCnt として保持させている構造体です。よって正しいポインターを得るためには、下位ビットを 0 にクリアする必要があります。

 
[http://www.eggheadcafe.com/microsoft/Windows-Debugging/30558733/kernel-debug-unable-to-get-min-sid-header.aspx](http://www.eggheadcafe.com/microsoft/Windows-Debugging/30558733/kernel-debug-unable-to-get-min-sid-header.aspx)

 
適当にプロセスを 2 つ選んで、トークンを見てみます。_EPROCESS の中で Token のオフセットは 0x208 でした。

 
```
kd> !process 0 0 cmd.exe 
PROCESS fffffa8001ccd060 
    SessionId: 1  Cid: 0910    Peb: 7fffffde000  ParentCid: 0b80 
    DirBase: 0363f000  ObjectTable: fffff8a001c59a30  HandleCount:  92. 
    Image: cmd.exe

PROCESS fffffa8001c81860 
    SessionId: 1  Cid: 0a1c    Peb: 7fffffdf000  ParentCid: 0b80 
    DirBase: 15c1b000  ObjectTable: fffff8a001cebb60  HandleCount:  23. 
    Image: cmd.exe

kd> dq fffffa8001ccd060+208 l1 
fffffa80`01ccd268  fffff8a0`01d1c95b

kd> dq fffffa8001c81860+208 l1 
fffffa80`01c81a68  fffff8a0`022a095f

kd> !token fffff8a0`01d1c950 -n 
_TOKEN fffff8a001d1c950 
TS Session ID: 0x1 
User: S-1-5-21-2857284654-3416964824-2551679015-500 (no name mapped) 
Groups: 
00 S-1-5-21-2857284654-3416964824-2551679015-513 (no name mapped) 
    Attributes - Mandatory Default Enabled 
01 S-1-1-0 (Well Known Group: localhost\Everyone) 
    Attributes - Mandatory Default Enabled 
02 S-1-5-32-545 (Alias: BUILTIN\Users) 
    Attributes - Mandatory Default Enabled 
03 S-1-5-32-544 (Alias: BUILTIN\Administrators) 
    Attributes - Mandatory Default Enabled Owner 
04 S-1-5-4 (Well Known Group: NT AUTHORITY\INTERACTIVE) 
    Attributes - Mandatory Default Enabled 
05 S-1-2-1 (Well Known Group: localhost\CONSOLE LOGON) 
    Attributes - Mandatory Default Enabled 
06 S-1-5-11 (Well Known Group: NT AUTHORITY\Authenticated Users) 
    Attributes - Mandatory Default Enabled 
07 S-1-5-15 (Well Known Group: NT AUTHORITY\This Organization) 
    Attributes - Mandatory Default Enabled 
08 S-1-5-5-0-3706178 (no name mapped) 
    Attributes - Mandatory Default Enabled LogonId 
09 S-1-2-0 (Well Known Group: localhost\LOCAL) 
    Attributes - Mandatory Default Enabled 
10 S-1-5-21-2857284654-3416964824-2551679015-512 (no name mapped) 
    Attributes - Mandatory Default Enabled 
11 S-1-5-21-2857284654-3416964824-2551679015-520 (no name mapped) 
    Attributes - Mandatory Default Enabled 
12 S-1-5-21-2857284654-3416964824-2551679015-519 (no name mapped) 
    Attributes - Mandatory Default Enabled 
13 S-1-5-21-2857284654-3416964824-2551679015-518 (no name mapped) 
    Attributes - Mandatory Default Enabled 
14 S-1-5-21-2857284654-3416964824-2551679015-3683 (no name mapped) 
    Attributes - Mandatory Default Enabled GroupResource 
15 S-1-5-21-2857284654-3416964824-2551679015-572 (no name mapped) 
    Attributes - Mandatory Default Enabled GroupResource 
16 S-1-16-12288 Unrecognized SID 
    Attributes - GroupIntegrity GroupIntegrityEnabled 
Primary Group: S-1-5-21-2857284654-3416964824-2551679015-513 (no name mapped) 
Privs: 
(略) 
Authentication ID:         (0,388d63) 
Impersonation Level:       Anonymous 
TokenType:                 Primary 
Source: User32             TokenFlags: 0x2000 ( Token in use ) 
Token ID: 38f126           ParentToken ID: 0 
Modified ID:               (0, 38d8de) 
RestrictedSidCount: 0      RestrictedSids: 0000000000000000 
OriginatingLogonSession: 3e7

kd> !token fffff8a0`022a0950 -n 
_TOKEN fffff8a0022a0950 
TS Session ID: 0x1 
User: S-1-5-21-2857284654-3416964824-2551679015-500 (no name mapped) 
Groups: 
00 S-1-5-21-2857284654-3416964824-2551679015-513 (no name mapped) 
    Attributes - Mandatory Default Enabled 
01 S-1-1-0 (Well Known Group: localhost\Everyone) 
    Attributes - Mandatory Default Enabled 
02 S-1-5-32-545 (Alias: BUILTIN\Users) 
    Attributes - Mandatory Default Enabled 
03 S-1-5-32-544 (Alias: BUILTIN\Administrators) 
    Attributes - Mandatory Default Enabled Owner 
04 S-1-5-4 (Well Known Group: NT AUTHORITY\INTERACTIVE) 
    Attributes - Mandatory Default Enabled 
05 S-1-2-1 (Well Known Group: localhost\CONSOLE LOGON) 
    Attributes - Mandatory Default Enabled 
06 S-1-5-11 (Well Known Group: NT AUTHORITY\Authenticated Users) 
    Attributes - Mandatory Default Enabled 
07 S-1-5-15 (Well Known Group: NT AUTHORITY\This Organization) 
    Attributes - Mandatory Default Enabled 
08 S-1-5-5-0-3706178 (no name mapped) 
    Attributes - Mandatory Default Enabled LogonId 
09 S-1-2-0 (Well Known Group: localhost\LOCAL) 
    Attributes - Mandatory Default Enabled 
10 S-1-5-21-2857284654-3416964824-2551679015-512 (no name mapped) 
    Attributes - Mandatory Default Enabled 
11 S-1-5-21-2857284654-3416964824-2551679015-520 (no name mapped) 
    Attributes - Mandatory Default Enabled 
12 S-1-5-21-2857284654-3416964824-2551679015-519 (no name mapped) 
    Attributes - Mandatory Default Enabled 
13 S-1-5-21-2857284654-3416964824-2551679015-518 (no name mapped) 
    Attributes - Mandatory Default Enabled 
14 S-1-5-21-2857284654-3416964824-2551679015-3683 (no name mapped) 
    Attributes - Mandatory Default Enabled GroupResource 
15 S-1-5-21-2857284654-3416964824-2551679015-572 (no name mapped) 
    Attributes - Mandatory Default Enabled GroupResource 
16 S-1-16-12288 Unrecognized SID 
    Attributes - GroupIntegrity GroupIntegrityEnabled 
Primary Group: S-1-5-21-2857284654-3416964824-2551679015-513 (no name mapped) 
Privs: 
(略) 
Authentication ID:         (0,388d63) 
Impersonation Level:       Anonymous 
TokenType:                 Primary 
Source: User32             TokenFlags: 0x2000 ( Token in use ) 
Token ID: 3a609d           ParentToken ID: 0 
Modified ID:               (0, 3a5ce1) 
RestrictedSidCount: 0      RestrictedSids: 0000000000000000 
OriginatingLogonSession: 3e7
```
 
どちらのプロセスも、S-1-5-5-0-3706178 というログオン SID をトークンの中に保持していることが分かります。ログオン SID は、S-1-5-5- で始まっていることから判断することができます。

 
Well-known security identifiers in Windows operating systems <br />
[http://support.microsoft.com/kb/243330/en](http://support.microsoft.com/kb/243330/en)

 
以上が GetLogonSID の処理でした。UI を持つプロセスは、デスクトップやウィンドウ ステーション オブジェクトに対してアクセス権を持っていなければならず、そのためにはログオン セッションのログオン SID に対して許可されていなければならないようです。つまり、オブジェクトの DACL に ACE を追加する必要があります。

 
ACL に関しては、半年ほど前に SDDL をパースするプログラムを書きました。

 
&#x5b;Win32&#x5d; &#x5b;C++&#x5d; CUI tool to parse SDDL Strings and account SIDs <br />
[http://msmania.wordpress.com/2011/06/30/win32-c-cui-tool-to-parse-sddl-strings-and-account-sids/](http://msmania.wordpress.com/2011/06/30/win32-c-cui-tool-to-parse-sddl-strings-and-account-sids/)

 
オブジェクトが持つセキュリティ記述子 (Security Descriptor) は、オブジェクト ヘッダー nt!\_OBJECT_HEADER が保持しています。そこで、デスクトップとウィンドウ ステーションのセキュリティ記述子を見てみます。

 
winobj で見ることができるように、ウィンドウ ステーション オブジェクトは \Windows\WindowStations\WinSta0 のような名前を持っていますが、デスクトップ オブジェクトにはオブジェクト マネージャーの名前空間に名前を持っていないため、プロセスのハンドルテーブルから探します。

 
```
kd> !process 0 0 notepad.exe 
PROCESS fffffa8001be6b30 
    SessionId: 1  Cid: 0310    Peb: 7fffffdf000  ParentCid: 0910 
    DirBase: 07a6b000  ObjectTable: fffff8a00192f600  HandleCount:  90. 
    Image: notepad.exe

kd> !handle 0 7 fffffa8001be6b30 
    PROCESS fffffa8001be6b30 
    SessionId: 1  Cid: 0310    Peb: 7fffffdf000  ParentCid: 0910 
    DirBase: 07a6b000  ObjectTable: fffff8a00192f600  HandleCount:  90. 
    Image: notepad.exe

Handle table at fffff8a0019e0000 with 90 entries in use

(略)

0034: Object: fffffa8001a6e7c0  GrantedAccess: 000f037f Entry: fffff8a0019e00d0 
Object: fffffa8001a6e7c0  Type: (fffffa8000ca7b40) WindowStation 
    ObjectHeader: fffffa8001a6e790 (new version) 
        HandleCount: 23  PointerCount: 39 
        Directory Object: fffff8a0021e8720  Name: WinSta0

0038: Object: fffffa8001cfe830  GrantedAccess: 000f01ff Entry: fffff8a0019e00e0 
Object: fffffa8001cfe830  Type: (fffffa8000ca79f0) Desktop 
    ObjectHeader: fffffa8001cfe800 (new version) 
        HandleCount: 11  PointerCount: 494 
        Directory Object: 00000000  Name: Default

(略) 
```
 
オブジェクトのセキュリティ記述子は、オブジェクト ヘッダー nt!\_OBJECT_HEADER に含まれています。

 
```
kd> dt _object_header 
nt!_OBJECT_HEADER 
   +0x000 PointerCount     : Int8B 
   +0x008 HandleCount      : Int8B 
   +0x008 NextToFree       : Ptr64 Void 
   +0x010 Lock             : _EX_PUSH_LOCK 
   +0x018 TypeIndex        : UChar 
   +0x019 TraceFlags       : UChar 
   +0x01a InfoMask         : UChar 
   +0x01b Flags            : UChar 
   +0x020 ObjectCreateInfo : Ptr64 _OBJECT_CREATE_INFORMATION 
   +0x020 QuotaBlockCharged : Ptr64 Void 
   +0x028 SecurityDescriptor : Ptr64 Void 
   +0x030 Body             : _QUAD
```
 
セキュリティ識別子は、!sd でダンプできます。そこで、SecurityDescriptor メンバーに対して !sd を実行すると・・・

 
```
kd> dt _object_header fffffa8001cfe800 
nt!_OBJECT_HEADER 
   +0x000 PointerCount     : 0n494 
   +0x008 HandleCount      : 0n11 
   +0x008 NextToFree       : 0x00000000`0000000b Void 
   +0x010 Lock             : _EX_PUSH_LOCK 
   +0x018 TypeIndex        : 0x15 '' 
   +0x019 TraceFlags       : 0 '' 
   +0x01a InfoMask         : 0xe '' 
   +0x01b Flags            : 0 '' 
   +0x020 ObjectCreateInfo : 0xfffff800`0166ac00 _OBJECT_CREATE_INFORMATION 
   +0x020 QuotaBlockCharged : 0xfffff800`0166ac00 Void 
   +0x028 SecurityDescriptor : 0xfffff8a0`01c133ee Void 
   +0x030 Body             : _QUAD

kd> !sd 0xfffff8a0`01c133ee 
1100000001001c: Unable to get MIN SID header 
1100000001001c: Unable to read in Owner in SD
```
 
エラーになりました。ポインターが間違っているようです。ポインターの値をよくみると、64bit ポインターなのに 64bit 境界になっていないことに気づきます。64bit 境界ということでポインターは下位 4 ビットが必ず 0 か 8 になるはずですが、SecurityDescriptor の値の下位 4 ビットは e になっています。ここで思い出すのは、さっき出てきた \_EX_FAST_REF 構造です。というか、上で引用したページにも書いてありましたが SecurityDescriptor フィールドは \_EX_FAST_REF 構造になっているため、下位 4 ビットを 0 にすることでセキュリティ記述子のアドレスが得られます。SecurityDescriptor はオフセット 0x28 バイトなので・・・

 
```
▼ ウィンドウ ステーション "Winsta0"

kd> !sd poi(fffffa8001a6e790+28)&0xffffffff`fffffff0 
->Revision: 0x1 
->Sbz1    : 0x0 
->Control : 0x8014 
            SE_DACL_PRESENT 
            SE_SACL_PRESENT 
            SE_SELF_RELATIVE 
->Owner   : S-1-5-32-544 
->Group   : S-1-5-18 
->Dacl    : 
->Dacl    : ->AclRevision: 0x2 
->Dacl    : ->Sbz1       : 0x0 
->Dacl    : ->AclSize    : 0xe4 
->Dacl    : ->AceCount   : 0x9 
->Dacl    : ->Sbz2       : 0x0 
->Dacl    : ->Ace[0]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[0]: ->AceFlags: 0x4 
->Dacl    : ->Ace[0]:             NO_PROPAGATE_INHERIT_ACE 
->Dacl    : ->Ace[0]: ->AceSize: 0x24 
->Dacl    : ->Ace[0]: ->Mask : 0x00000024 
->Dacl    : ->Ace[0]: ->SID: S-1-5-21-2857284654-3416964824-2551679015-500

->Dacl    : ->Ace[1]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[1]: ->AceFlags: 0xb 
->Dacl    : ->Ace[1]:             OBJECT_INHERIT_ACE 
->Dacl    : ->Ace[1]:             CONTAINER_INHERIT_ACE 
->Dacl    : ->Ace[1]:             INHERIT_ONLY_ACE 
->Dacl    : ->Ace[1]: ->AceSize: 0x1c 
->Dacl    : ->Ace[1]: ->Mask : 0xf0000000 
->Dacl    : ->Ace[1]: ->SID: S-1-5-5-0-3706178

->Dacl    : ->Ace[2]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[2]: ->AceFlags: 0x4 
->Dacl    : ->Ace[2]:             NO_PROPAGATE_INHERIT_ACE 
->Dacl    : ->Ace[2]: ->AceSize: 0x1c 
->Dacl    : ->Ace[2]: ->Mask : 0x000f037f 
->Dacl    : ->Ace[2]: ->SID: S-1-5-5-0-3706178

(略)

->Sacl    : 
->Sacl    : ->AclRevision: 0x2 
->Sacl    : ->Sbz1       : 0x0 
->Sacl    : ->AclSize    : 0x1c 
->Sacl    : ->AceCount   : 0x1 
->Sacl    : ->Sbz2       : 0x0 
->Sacl    : ->Ace[0]: ->AceType: SYSTEM_MANDATORY_LABEL_ACE_TYPE 
->Sacl    : ->Ace[0]: ->AceFlags: 0x0 
->Sacl    : ->Ace[0]: ->AceSize: 0x14 
->Sacl    : ->Ace[0]: ->Mask : 0x00000001 
->Sacl    : ->Ace[0]: ->SID: S-1-16-4096

▼ デスクトップ "Default"

kd> !sd poi(fffffa8001cfe800+28)&0xffffffff`fffffff0 
->Revision: 0x1 
->Sbz1    : 0x0 
->Control : 0x8014 
            SE_DACL_PRESENT 
            SE_SACL_PRESENT 
            SE_SELF_RELATIVE 
->Owner   : S-1-5-32-544 
->Group   : S-1-5-18 
->Dacl    : 
->Dacl    : ->AclRevision: 0x2 
->Dacl    : ->Sbz1       : 0x0 
->Dacl    : ->AclSize    : 0x64 
->Dacl    : ->AceCount   : 0x4 
->Dacl    : ->Sbz2       : 0x0 
->Dacl    : ->Ace[0]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[0]: ->AceFlags: 0x0 
->Dacl    : ->Ace[0]: ->AceSize: 0x1c 
->Dacl    : ->Ace[0]: ->Mask : 0x000f01ff 
->Dacl    : ->Ace[0]: ->SID: S-1-5-5-0-3706178

(略)

->Sacl    : 
->Sacl    : ->AclRevision: 0x2 
->Sacl    : ->Sbz1       : 0x0 
->Sacl    : ->AclSize    : 0x1c 
->Sacl    : ->AceCount   : 0x1 
->Sacl    : ->Sbz2       : 0x0 
->Sacl    : ->Ace[0]: ->AceType: SYSTEM_MANDATORY_LABEL_ACE_TYPE 
->Sacl    : ->Ace[0]: ->AceFlags: 0x0 
->Sacl    : ->Ace[0]: ->AceSize: 0x14 
->Sacl    : ->Ace[0]: ->Mask : 0x00000001 
->Sacl    : ->Ace[0]: ->SID: S-1-16-4096
```
 
これでセキュリティ記述子をダンプできました。

 
まず注目すべきは紫色で示した SID です。これは S-1-5-5- で始まっているのでログオン SID です。現在のログオン セッションに対して、アクセス許可の設定がされていることが分かります。

 
次に、ログオン SID が割り当てられている ACE に注目します。DACL の中でログオン SID が割り当てられている ACE は全て ACCESS_ALLOWED_ACE_TYPE のアクセス許可 ACE です。そして、ウィンドウ ステーションでは 2 つの ACE があるのに対して、デスクトップは 1 つです。ウィンドウ ステーションに設定された 2 つの ACE では、AceFlags と Mask の値が異なっています。AceFlags の定数を見ると分かりますが、1 つは継承可能で、もう 1 つは継承を止める ACE になっています。つまり、Mask で設定されたアクセス許可の種類に応じて、継承させるものと継承させないものを区別していることが分かります。

 
ACE Inheritance Rules <br />
[http://msdn.microsoft.com/en-us/library/windows/desktop/aa374924(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/windows/desktop/aa374924(v=vs.85).aspx)

 
ACCESS_MASK <br />
[http://msdn.microsoft.com/en-us/library/aa374892(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/aa374892(v=vs.85).aspx)

 
MSDN のサンプルに戻ります。サンプルにおいては、オブジェクトの DACL に ログオン SID の ACE を追加する処理がAddAceToWindowStation と AddAceToDesktop との 2 つの関数に分けてあります。この理由が上記の内容になります。デスクトップは 1 つの ACE を追加すればいいですが、ウィンドウ ステーションには、2 つの ACE を追加しているため、関数を分けているようです。

 
AddAceToWindowStation では、AddAce API を 2 回呼ぶことで 2 つの ACE を ACL に追加しています。一方 AddAceToDesktop では、AddAccessAllowedAce API を 1 回呼んで ACE を追加しています。

 
このサンプルは実はもっと効率よく書けます。まず、AddAceToWindowStation と AddAceToDesktop とでは共通する処理がほとんどです。というのも、いずれの関数も流れは共通で、異なっているのは以下の 5. の部分だけです。

 
1. オブジェクト ハンドルからセキュリティ記述子を取得 (GetUserObjectSecurity API) 
1. 新たなセキュリティ記述子を作成 (InitializeSecurityDescriptor API) 
1. 新たな ACL を作成 (InitializeAcl API) 
1. 1. で取得したセキュリティ記述子の DACL を 3. の ACL に コピー 
1. SID に対するアクセス許可 ACE を 4. の ACL に追加 
1. 2. のセキュリティ記述子に 5. の ACL を設定 (SetSecurityDescriptorDacl API) 
1. オブジェクトに 6. の セキュリティ記述子を設定 (SetUserObjectSecurity API) 

 
AddAceToDesktop で使っている AddAccessAllowedAce API では AceFlags を指定できませんが、AddAccessAllowedAceEx API を使うと AceFlags を指定できるので、AddAceToWindowStation と AddAceToDesktop とのいずれにおいても AddAccessAllowedAceEx を使って ACE を追加すれば、わざわざ ACE のサイズを計算して AddAce を使わなくて済みます。

 
AddAccessAllowedAce function <br />
[http://msdn.microsoft.com/en-us/library/aa374947](http://msdn.microsoft.com/en-us/library/aa374947)

 
AddAccessAllowedAceEx function <br />
[http://msdn.microsoft.com/en-us/library/aa374951(v=VS.85).aspx](http://msdn.microsoft.com/en-us/library/aa374951(v=VS.85).aspx)

 
そこで、AddAceToWindowStation と AddAceToDesktop の ACE を追加する処理以外を AddAccessAllowedAceBasedSID という関数でまとめて、ACE の追加は AddAccessAllowedAceEx を使ってプログラムを書き直してみました。

 
さらに、追加した ACE を削除する関数 RemoveAccessAllowedAcesBasedSID も作りました。これは、指定した SID に対するアクセス許可 ACE のみだけを削除する関数です。

 
AddAceToWindowStation と AddAceToDesktop は ACE のフラグとマスクの配列を渡すだけになりました。 <br />
にも関わらず、エラー処理をするとコードが長くなってしまうのが Win32 の面倒なところ。

 
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
                                CONST DWORD AceFlags[], CONST DWORD AccessMasks[]) { 
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
        if ( !GetUserObjectSecurity(Object, 
                &DaclInfo, Sd, SdSize, &SdSizeNeeded) ) 
            goto cleanup; 
    }

    // Obtain the DACL from the security descriptor. 
    if ( !GetSecurityDescriptorDacl(Sd, &DaclPresent, &Acl, &DaclDefaulted) ) 
        goto cleanup;

    // Initialize. 
    ZeroMemory(&AclSizeInfo, sizeof(ACL_SIZE_INFORMATION)); 
    AclSizeInfo.AclBytesInUse = sizeof(ACL); 
    if ( Acl ) { 
        if (!GetAclInformation(Acl, (LPVOID)&AclSizeInfo, sizeof(ACL_SIZE_INFORMATION), AclSizeInformation) ) 
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

            if (!AddAce(AclNew, ACL_REVISION, MAXDWORD, 
                        Ace, ((PACE_HEADER)Ace)->AceSize) ) 
                goto cleanup; 
        } 
    }

    // Add new ACEs of specified SID to the DACL 
    for ( DWORD i=0 ; i<AceCount ; ++i ) { 
        if (!AddAccessAllowedAceEx(AclNew, ACL_REVISION, 
                                   AceFlags[i], AccessMasks[i], Sid) ) 
            goto cleanup; 
    }

    // Create a new security descriptor. 
    // SECURITY_DESCRIPTOR_MIN_LENGTH is enough 
    // because SetSecurityDescriptorDacl creates absolute security descriptor 
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
        if ( !GetUserObjectSecurity(Object, &DaclInfo, 
                                    Sd, SdSize, &SdSizeNeeded) ) 
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

            if (!AddAce(AclNew, ACL_REVISION, MAXDWORD, 
                        Ace, ((PACE_HEADER)Ace)->AceSize) ) 
                goto cleanup; 
        } 
    } 
    
    // Create a new security descriptor. 
    // SECURITY_DESCRIPTOR_MIN_LENGTH is enough 
    // because SetSecurityDescriptorDacl creates absolute security descriptor 
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

    if ( !GetTokenInformation(Token, TokenGroups, 
                             (LPVOID)TokenGroup, 0, &TokenGroupLength) && 
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

        if ( (TokenGroup->Groups[i].Attributes&SE_GROUP_LOGON_ID)== 
               SE_GROUP_LOGON_ID ) { 
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
