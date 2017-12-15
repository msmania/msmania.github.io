---
layout: post
title: "[Win32] [C++] CreateProcessAsUser – #4 セキュリティ記述子"
date: 2012-01-01 02:28:32.000 +09:00
categories:
- Debug
- Windows
tags:
- absolute
- ACE
- ACL
- CreateProcessAsUser
- DACL
- SACL
- self-relative
---

年内に書ききろうと思っていたのに、結局年を跨いでしまった。不吉だ。 <br />
皆さま明けましておめでとうございます。

 
たぶん CreateProcessAsUser シリーズはこれで最後です。

 
ソースファイル中に、_GUI と _TRACING という定数を定義しています。

 
- _GUI ・・・ DACL への ACE 追加を行なうかどうか 
- _TRACING ・・・ デバッグ用の情報を出力するかどうか 

 
_TRACING で出力される情報を使って、セキュリティ記述子に関する補足です。

 
-runas オプションを付けてメモ帳を別ユーザーで実行します。

 
```
>logue -runas kimaber@contoso password c:\windows\syswow64\notepad

SID: S-1-5-21-2857284654-3416964824-2551679015-513 
SID: S-1-1-0 
SID: S-1-5-32-545 
SID: S-1-5-4 
SID: S-1-2-1 
SID: S-1-5-11 
SID: S-1-5-15 
SID: S-1-5-5-0-4408862 (Logon) 
PID      : 0x948 
HWINSTA  : 0xd8 
HDESK    : 0xd4 
Logon SID: 0079ACE8 
-----
```
 
青字で示した部分は、CreateProcessUser が返すプロセス トークンに含まれる SID の一覧です。 <br />
ログオン SID が S-1-5-5-0-4408862 であることが分かります。

 
エンターキーを押し、先に進みます。

 
```
Original SD: 0079A8B8 
New SD     : 0079ACC8 
--> 
```
 
AddAceToWindowStation の中で、ウィンドウ ステーション オブジェクトのセキュリティ記述子を変更する直前のタイミングで止まります。Original SD は GetUserObjectSecurity API で取得されるポインタで、New SD は SetSecurityDescriptorDacl で 新しい DACL を設定した後のセキュリティ記述子を示すポインタです。

 
ユーザー モード デバッガーで、!sd を使ってみます。

 
```
0:002> !sd 79a8b8 
->Revision: 0x1 
->Sbz1    : 0x0 
->Control : 0x8004 
            SE_DACL_PRESENT 
            SE_SELF_RELATIVE 
->Owner   :  is NULL 
->Group   :  is NULL 
->Dacl    :  is NULL 
->Sacl    :  is NULL

0:002> !sd 79acc8 
->Revision: 0x1 
->Sbz1    : 0x0 
->Control : 0x4 
            SE_DACL_PRESENT 
->Owner   :  is NULL 
->Group   :  is NULL 
->Dacl    : 
->Dacl    : ->AclRevision: 0x2 
->Dacl    : ->Sbz1       : 0x0 
->Dacl    : ->AclSize    : 0x11c 
->Dacl    : ->AceCount   : 0xb 
->Dacl    : ->Sbz2       : 0x0 
->Dacl    : ->Ace[0]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[0]: ->AceFlags: 0x4 
->Dacl    : ->Ace[0]:             NO_PROPAGATE_INHERIT_ACE 
->Dacl    : ->Ace[0]: ->AceSize: 0x24 
->Dacl    : ->Ace[0]: ->Mask : 0x00000024 
->Dacl    : ->Ace[0]: ->SID: S-1-5-21-2857284654-3416964824-2551679015-500

(略)

->Sacl    :  is NULL 
```
 
おかしいですね。Original SD の ACL が NULL です。 <br />
セキュリティ記述子は \_SECURITY_DESCRIPTOR という構造体なので、!sd ではなく dt コマンドで見てみます。

 
```
0:002> dt _security_descriptor 79a8b8 
ntdll!_SECURITY_DESCRIPTOR 
   +0x000 Revision         : 0x1 '' 
   +0x001 Sbz1             : 0 '' 
   +0x002 Control          : 0x8004 
   +0x004 Owner            : (null) 
   +0x008 Group            : (null) 
   +0x00c Sacl             : (null) 
   +0x010 Dacl             : 0x00000014 _ACL 
0:002> dt _security_descriptor 79acc8 
ntdll!_SECURITY_DESCRIPTOR 
   +0x000 Revision         : 0x1 '' 
   +0x001 Sbz1             : 0 '' 
   +0x002 Control          : 4 
   +0x004 Owner            : (null) 
   +0x008 Group            : (null) 
   +0x00c Sacl             : (null) 
   +0x010 Dacl             : 0x0079a9f0 _ACL 
```
 
Original SD の方は、DACL が 0x14 という値です。ポインタではないみたいです。 ここで重要になってくるのが Control の値で、見てみると、0x8000 のビットが違います。これは !sd の結果に出ていますが、SE_SELF_RELATIVE というフラグです。

 
セキュリティ記述子には、absolute と self-relative という 2 種類のフォーマットがあり、実はユーザーモードの !sd コマンドは self-relative フォーマットを正しく解釈できないようです。 

 
Absolute and Self-Relative Security Descriptors <br />
[http://technet.microsoft.com/library/aa374807](http://technet.microsoft.com/library/aa374807)

 
上のページに記載がある通り、absolute フォーマットは各種情報をポインターとして保持しますが、self-relative はオフセットとして保持しています。self-relative は、セキュリティ記述子が 1 まとまりのメモリ ブロック (a contiguous block of memory) としてバッファー上に確保されています。

 
!sd コマンドが使えないので、!acl コマンドを使って DACL を見る必要があります。

 
```
0:002> !acl 79a8b8+14  
ACL is: 
ACL is: ->AclRevision: 0x2 
ACL is: ->Sbz1       : 0x0 
ACL is: ->AclSize    : 0x11c 
ACL is: ->AceCount   : 0x9 
ACL is: ->Sbz2       : 0x0 
ACL is: ->Ace[0]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
ACL is: ->Ace[0]: ->AceFlags: 0x4 
ACL is: ->Ace[0]:             NO_PROPAGATE_INHERIT_ACE 
ACL is: ->Ace[0]: ->AceSize: 0x24 
ACL is: ->Ace[0]: ->Mask : 0x00000024 
ACL is: ->Ace[0]: ->SID: S-1-5-21-2857284654-3416964824-2551679015-500

(略)

ACL is: ->Ace[7]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
ACL is: ->Ace[7]: ->AceFlags: 0xb 
ACL is: ->Ace[7]:             OBJECT_INHERIT_ACE 
ACL is: ->Ace[7]:             CONTAINER_INHERIT_ACE 
ACL is: ->Ace[7]:             INHERIT_ONLY_ACE 
ACL is: ->Ace[7]: ->AceSize: 0x14 
ACL is: ->Ace[7]: ->Mask : 0xf0000000 
ACL is: ->Ace[7]: ->SID: S-1-5-18

ACL is: ->Ace[8]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
ACL is: ->Ace[8]: ->AceFlags: 0x4 
ACL is: ->Ace[8]:             NO_PROPAGATE_INHERIT_ACE 
ACL is: ->Ace[8]: ->AceSize: 0x14 
ACL is: ->Ace[8]: ->Mask : 0x000f037f 
ACL is: ->Ace[8]: ->SID: S-1-5-18

0:002> !acl 0x0079a9f0 
ACL is: 
ACL is: ->AclRevision: 0x2 
ACL is: ->Sbz1       : 0x0 
ACL is: ->AclSize    : 0x11c 
ACL is: ->AceCount   : 0xb 
ACL is: ->Sbz2       : 0x0 
ACL is: ->Ace[0]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
ACL is: ->Ace[0]: ->AceFlags: 0x4 
ACL is: ->Ace[0]:             NO_PROPAGATE_INHERIT_ACE 
ACL is: ->Ace[0]: ->AceSize: 0x24 
ACL is: ->Ace[0]: ->Mask : 0x00000024 
ACL is: ->Ace[0]: ->SID: S-1-5-21-2857284654-3416964824-2551679015-500

(略)

ACL is: ->Ace[7]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
ACL is: ->Ace[7]: ->AceFlags: 0xb 
ACL is: ->Ace[7]:             OBJECT_INHERIT_ACE 
ACL is: ->Ace[7]:             CONTAINER_INHERIT_ACE 
ACL is: ->Ace[7]:             INHERIT_ONLY_ACE 
ACL is: ->Ace[7]: ->AceSize: 0x14 
ACL is: ->Ace[7]: ->Mask : 0xf0000000 
ACL is: ->Ace[7]: ->SID: S-1-5-18

ACL is: ->Ace[8]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
ACL is: ->Ace[8]: ->AceFlags: 0x4 
ACL is: ->Ace[8]:             NO_PROPAGATE_INHERIT_ACE 
ACL is: ->Ace[8]: ->AceSize: 0x14 
ACL is: ->Ace[8]: ->Mask : 0x000f037f 
ACL is: ->Ace[8]: ->SID: S-1-5-18

ACL is: ->Ace[9]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
ACL is: ->Ace[9]: ->AceFlags: 0xb 
ACL is: ->Ace[9]:             OBJECT_INHERIT_ACE 
ACL is: ->Ace[9]:             CONTAINER_INHERIT_ACE 
ACL is: ->Ace[9]:             INHERIT_ONLY_ACE 
ACL is: ->Ace[9]: ->AceSize: 0x1c 
ACL is: ->Ace[9]: ->Mask : 0xf0000000 
ACL is: ->Ace[9]: ->SID: S-1-5-5-0-4408862

ACL is: ->Ace[10]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
ACL is: ->Ace[10]: ->AceFlags: 0x4 
ACL is: ->Ace[10]:             NO_PROPAGATE_INHERIT_ACE 
ACL is: ->Ace[10]: ->AceSize: 0x1c 
ACL is: ->Ace[10]: ->Mask : 0x000f037f 
ACL is: ->Ace[10]: ->SID: S-1-5-5-0-4408862
```
 
CreateProcessAsUser が作ったログオン SID である S-1-5-5-0-4408862 に対する ACE が、正しく 2 つ追加されていることが確認できました。

 
エンターキーを押して、プログラムを進めます。今度はデスクトップ オブジェクトの DACL です。

 
```
Original SD: 00796140 
New SD     : 0079ACC8 
-->  
```
 
デスクトップ オブジェクトもウィンドウ ステーションと同様なので省略し、さらにエンターを押すと、メモ帳が起動します。プログラムは WaitForSingleObject で、プロセスが終了するまで待機します。

 
ここでカーネル デバッガーを使って、実際のカーネル オブジェクト上の DACL が変わっているかどうかを確認します。 <br />
最初の出力から、プロセス ID が 0x948、ウィンドウ ステーションのハンドルが d8 、デスクトップは d4 と分かっているので・・・

 
```
kd> !handle d8 7 0x948

Searching for Process with Cid == 948 
PROCESS fffffa8001caa060 
    SessionId: 1  Cid: 0948    Peb: 7efdf000  ParentCid: 0910 
    DirBase: 19c90000  ObjectTable: fffff8a001efa9b0  HandleCount:  58. 
    Image: Logue.exe

Handle table at fffff8a00170c000 with 58 entries in use

00d8: Object: fffffa8001a6e7c0  GrantedAccess: 00060000 Entry: fffff8a00170c360 
Object: fffffa8001a6e7c0  Type: (fffffa8000ca7b40) WindowStation 
    ObjectHeader: fffffa8001a6e790 (new version) 
        HandleCount: 26  PointerCount: 43 
        Directory Object: fffff8a0021e8720  Name: WinSta0

kd> !handle d4 7 0x948

Searching for Process with Cid == 948 
PROCESS fffffa8001caa060 
    SessionId: 1  Cid: 0948    Peb: 7efdf000  ParentCid: 0910 
    DirBase: 19c90000  ObjectTable: fffff8a001efa9b0  HandleCount:  58. 
    Image: Logue.exe

Handle table at fffff8a00170c000 with 58 entries in use

00d4: Object: fffffa8001cfe830  GrantedAccess: 00060081 Entry: fffff8a00170c350 
Object: fffffa8001cfe830  Type: (fffffa8000ca79f0) Desktop 
    ObjectHeader: fffffa8001cfe800 (new version) 
        HandleCount: 13  PointerCount: 495 
        Directory Object: 00000000  Name: Default
```
 
前の記事から、SecurityDescriptor はオブジェクト ヘッダーから 0x28 バイト目にあり、かつ \_EX_FAST_REF 構造なので・・・

 
```
kd> dt _security_descriptor poi(fffffa8001a6e790+28)&0xffffffff`fffffff0 
nt!_SECURITY_DESCRIPTOR 
   +0x000 Revision         : 0x1 '' 
   +0x001 Sbz1             : 0 '' 
   +0x002 Control          : 0x8014 
   +0x008 Owner            : 0x00000014`0000015c Void 
   +0x010 Group            : 0x001c0002`00000030 Void 
   +0x018 Sacl             : 0x00140011`00000001 _ACL 
   +0x020 Dacl             : 0x00000101`00000001 _ACL 
kd> dt _security_descriptor poi(fffffa8001cfe800+28)&0xffffffff`fffffff0 
nt!_SECURITY_DESCRIPTOR 
   +0x000 Revision         : 0x1 '' 
   +0x001 Sbz1             : 0 '' 
   +0x002 Control          : 0x8014 
   +0x008 Owner            : 0x00000014`000000c0 Void 
   +0x010 Group            : 0x001c0002`00000030 Void 
   +0x018 Sacl             : 0x00140011`00000001 _ACL 
   +0x020 Dacl             : 0x00000101`00000001 _ACL
```
 
おや、New SD は absolute フォーマットだったのに自動的に self-relative フォーマットに変換されています。まあ、そういうものなのでしょう。それに SACL も勝手に追加されています。おそらく継承によるものです。

 
カーネル デバッガーの !sd コマンドでは、self-relative フォーマットのセキュリティ記述子もダンプすることができます。 <br />
ログオン SID である S-1-5-5-0-4408862 に対する ACE が無事追加されていることが確認できました。

 
```
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
->Dacl    : ->AclSize    : 0x11c 
->Dacl    : ->AceCount   : 0xb 
->Dacl    : ->Sbz2       : 0x0 
->Dacl    : ->Ace[0]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[0]: ->AceFlags: 0x4 
->Dacl    : ->Ace[0]:             NO_PROPAGATE_INHERIT_ACE 
->Dacl    : ->Ace[0]: ->AceSize: 0x24 
->Dacl    : ->Ace[0]: ->Mask : 0x00000024 
->Dacl    : ->Ace[0]: ->SID: S-1-5-21-2857284654-3416964824-2551679015-500

(略)

->Dacl    : ->Ace[9]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[9]: ->AceFlags: 0xb 
->Dacl    : ->Ace[9]:             OBJECT_INHERIT_ACE 
->Dacl    : ->Ace[9]:             CONTAINER_INHERIT_ACE 
->Dacl    : ->Ace[9]:             INHERIT_ONLY_ACE 
->Dacl    : ->Ace[9]: ->AceSize: 0x1c 
->Dacl    : ->Ace[9]: ->Mask : 0xf0000000 
->Dacl    : ->Ace[9]: ->SID: S-1-5-5-0-4408862

->Dacl    : ->Ace[10]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[10]: ->AceFlags: 0x4 
->Dacl    : ->Ace[10]:             NO_PROPAGATE_INHERIT_ACE 
->Dacl    : ->Ace[10]: ->AceSize: 0x1c 
->Dacl    : ->Ace[10]: ->Mask : 0x000f037f 
->Dacl    : ->Ace[10]: ->SID: S-1-5-5-0-4408862

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
->Dacl    : ->AclSize    : 0x80 
->Dacl    : ->AceCount   : 0x5 
->Dacl    : ->Sbz2       : 0x0 
->Dacl    : ->Ace[0]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[0]: ->AceFlags: 0x0 
->Dacl    : ->Ace[0]: ->AceSize: 0x1c 
->Dacl    : ->Ace[0]: ->Mask : 0x000f01ff 
->Dacl    : ->Ace[0]: ->SID: S-1-5-5-0-3706178

(略)

->Dacl    : ->Ace[4]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[4]: ->AceFlags: 0x0 
->Dacl    : ->Ace[4]: ->AceSize: 0x1c 
->Dacl    : ->Ace[4]: ->Mask : 0x000f01ff 
->Dacl    : ->Ace[4]: ->SID: S-1-5-5-0-4408862

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
 
メモ帳を閉じ、エンターキーを 2 回押すとプログラムが終了します。

 
```
Original SD: 0079C2A8 
New SD     : 0079AD08 
--> エンターを押す

Original SD: 007961B8 
New SD     : 0079AD08 
--> エンターを押す 
```
 
このタイミングで、DACL が元に戻っているかどうかを確認します。ウィンドウ ステーションとデスクトップ オブジェクトのアドレスは変わらないので、さっきと同じコマンドで確認します。

 
```
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
->Dacl    : ->AclSize    : 0x11c 
->Dacl    : ->AceCount   : 0x9 
->Dacl    : ->Sbz2       : 0x0 
->Dacl    : ->Ace[0]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[0]: ->AceFlags: 0x4 
->Dacl    : ->Ace[0]:             NO_PROPAGATE_INHERIT_ACE 
->Dacl    : ->Ace[0]: ->AceSize: 0x24 
->Dacl    : ->Ace[0]: ->Mask : 0x00000024 
->Dacl    : ->Ace[0]: ->SID: S-1-5-21-2857284654-3416964824-2551679015-500

(略)

->Dacl    : ->Ace[7]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[7]: ->AceFlags: 0xb 
->Dacl    : ->Ace[7]:             OBJECT_INHERIT_ACE 
->Dacl    : ->Ace[7]:             CONTAINER_INHERIT_ACE 
->Dacl    : ->Ace[7]:             INHERIT_ONLY_ACE 
->Dacl    : ->Ace[7]: ->AceSize: 0x14 
->Dacl    : ->Ace[7]: ->Mask : 0xf0000000 
->Dacl    : ->Ace[7]: ->SID: S-1-5-18

->Dacl    : ->Ace[8]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[8]: ->AceFlags: 0x4 
->Dacl    : ->Ace[8]:             NO_PROPAGATE_INHERIT_ACE 
->Dacl    : ->Ace[8]: ->AceSize: 0x14 
->Dacl    : ->Ace[8]: ->Mask : 0x000f037f 
->Dacl    : ->Ace[8]: ->SID: S-1-5-18

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
->Dacl    : ->AclSize    : 0x80 
->Dacl    : ->AceCount   : 0x4 
->Dacl    : ->Sbz2       : 0x0 
->Dacl    : ->Ace[0]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[0]: ->AceFlags: 0x0 
->Dacl    : ->Ace[0]: ->AceSize: 0x1c 
->Dacl    : ->Ace[0]: ->Mask : 0x000f01ff 
->Dacl    : ->Ace[0]: ->SID: S-1-5-5-0-3706178

(略)

->Dacl    : ->Ace[3]: ->AceType: ACCESS_ALLOWED_ACE_TYPE 
->Dacl    : ->Ace[3]: ->AceFlags: 0x0 
->Dacl    : ->Ace[3]: ->AceSize: 0x14 
->Dacl    : ->Ace[3]: ->Mask : 0x000f01ff 
->Dacl    : ->Ace[3]: ->SID: S-1-5-18

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
 
S-1-5-5-0-4408862 に対する ACE だけが消えていることが確認できました。

 
最後に、セキュリティ記述子のサイズについての補足です。 <br />
セキュリティ記述子に関連する構造は、大体こんな風になっています。

 
- SecurityDescriptor = \_SECURITY_DESCRIPTOR strucutre + DACLs + m*SACLs 
- ACL = _ACL structure + ACEs 
- ACE = \_ACE_HEADER structure + SID 

 
将来の拡張を含めた汎用性の維持という観点から、SID のサイズは可変です。このため、SID を連続したメモリ上に並べた ACL や Security Descriptor は可変にならざるを得ません。

 
ここで、2 月の記事で引用したこの KB。

 
INFO: Computing the Size of a New ACL <br />
[http://support.microsoft.com/kb/102103/en](http://support.microsoft.com/kb/102103/en)

 
これは、既存の ACL に ACCESS_ALLOWED_ACE (アクセス許可 ACE) を 1 つ加えたときのサイズを計算する式です。

 
```
dwNewACLSize = AclInfo.AclBytesInUse 
               + sizeof(ACCESS_ALLOWED_ACE) 
               + GetLengthSid(UserSID) 
               - sizeof(DWORD); 
```
 
ACCESS_ALLOWED_ACE のサイズと、GetLengthSid で計算した SID のサイズを足すのは直感的に分かりますが、DWORD を引くのはなんなんだ、と。KB の本文を見ると、こう書いてあります。

 
```
Subtracting out the size of a DWORD is the final adjustment needed to obtain the exact size. This adjust is to compensate for a place holder member in the ACCESS_ALLOWED_ACE structure which is used in variable length ACEs.
```
 
ACCESS_ALLOWED_ACE のプレースホルダーらしいです。そんなわけで WinNT.h で定義されている構造を見ます。

 
```
typedef struct _ACCESS_ALLOWED_ACE { 
    ACE_HEADER Header; 
    ACCESS_MASK Mask; 
    DWORD SidStart; 
} ACCESS_ALLOWED_ACE; 
```
 
プレース ホルダーは SidStart ですね。SID は、\_ACCESS_ALLOWED_ACE 構造体の直後に始まるのではなく、SidStart のアドレスから始まるので、構造体のサイズと SID のサイズを足した後、重複する SidStart 分の DWORD を引く必要があるのです。

 
ACCESS_ALLOWED_ACE 以外にも ACE の種類はたくさんあり、一覧が以下のページにあります。 <br />
ちなみに、Object specifig ACE は、ACE の中に GUID を 2 つ含んでいるため、サイズが大きいです。

 
ACE <br />
[http://msdn.microsoft.com/en-us/library/aa374912(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/aa374912(v=vs.85).aspx)

 
もう 1 つ重要なのは _ACL 構造体です。

 
```
typedef struct _ACL { 
    BYTE  AclRevision; 
    BYTE  Sbz1; 
    WORD   AclSize; 
    WORD   AceCount; 
    WORD   Sbz2; 
} ACL; 
typedef ACL *PACL; 
```
 
まあ普通の構造体ですが、AclSize が WORD 型であるところがポイントです。つまり、ACL のサイズが 64KB を超えることは構造上不可能なのです。これは比較的有名な 64K 問題で、KB も出ています。

 
Maximum number of ACEs in an ACL <br />
[http://support.microsoft.com/kb/166348/en](http://support.microsoft.com/kb/166348/en)

 
さて、セキュリティ記述子のサイズが分かったところでプログラムに戻ります。サンプルを再掲。

 
Starting an Interactive Client Process in C++ <br />
[http://msdn.microsoft.com/en-us/library/aa379608(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/aa379608(v=vs.85).aspx)

 
MSDN のサンプルでは、新たなセキュリティ記述子である psdNew という変数に対して、既存のセキュリティ記述子 psd のサイズである dwSdSizeNeeded の値をそのまま使ってヒープ メモリを確保しています。

 
```
psd = (PSECURITY_DESCRIPTOR)HeapAlloc( 
      GetProcessHeap(), 
      HEAP_ZERO_MEMORY, 
      dwSdSizeNeeded);

if (psd == NULL) 
   __leave;

psdNew = (PSECURITY_DESCRIPTOR)HeapAlloc( 
      GetProcessHeap(), 
      HEAP_ZERO_MEMORY, 
      dwSdSizeNeeded);

if (psdNew == NULL) 
   __leave;
```
 
これはおかしな話です。なぜなら、ACE を追加すると ACL のサイズは増え、それに伴ってセキュリティ記述子のサイズは大きくなるはずだからです。なぜバッファー オーバー ラン (BOR) を引き起こさないのでしょうか。その秘密が SetSecurityDescriptorDacl の動きにあります。それをデバッガーで確認します。たまには Release ビルド版をデバッグしてみます。

 
advapi32!SetSecurityDescriptorDacl は、あちこち飛んだ挙句、ntdll!RtlSetDaclSecurityDescriptor に行きつきます。結局 ntdll.dll に実装されているのです。プログラムを実行して、ntdll!RtlSetDaclSecurityDescriptor が AddAccessAllowedAceBasedSID から呼ばれたときに止めます。

 
```
0:000> bl 
0 e 779a2cc2     0001 (0001)  0:**** ntdll!RtlSetDaclSecurityDescriptor 
0:000> k 
ChildEBP RetAddr 
0044f93c 76b6c6b3 ntdll!RtlSetDaclSecurityDescriptor 
WARNING: Stack unwind information not available. Following frames may be wrong. 
0044f954 012711ee KERNELBASE!SetSecurityDescriptorDacl+0x17 
0044f9bc 012718a9 Logue!AddAccessAllowedAceBasedSID+0x1ee 
0044fa5c 01271c9d Logue!RunAs+0x1e9 
0044fa7c 74cd263d Logue!wmain+0x8d 
*** ERROR: Symbol file could not be found.  Defaulted to export symbols for C:\Windows\syswow64\kernel32.dll - 
0044fac8 76bb33ca MSVCR100!initterm+0x16 
0044fad4 77999ed2 kernel32!BaseThreadInitThunk+0x12 
0044fb14 77999ea5 ntdll!__RtlUserThreadStart+0x70 
0044fb2c 00000000 ntdll!_RtlUserThreadStart+0x1b

0:000> bp 012711ee 
0:000> g 
Breakpoint 1 hit 
eax=00000001 ebx=00000002 ecx=00000004 edx=007bdef0 esi=0044fa44 edi=007bdef0 
eip=012711ee esp=0044f96c ebp=0044f9bc iopl=0         nv up ei pl nz na po nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000202 
Logue!AddAccessAllowedAceBasedSID+0x1ee: 
012711ee 85c0            test    eax,eax 
0:000> ub 
Logue!AddAccessAllowedAceBasedSID+0x1db: 
012711db 85c0            test    eax,eax 
012711dd 7459            je      Logue!AddAccessAllowedAceBasedSID+0x238 (01271238) 
012711df 8b45e8          mov     eax,dword ptr [ebp-18h] 
012711e2 6a00            push    0 
012711e4 57              push    edi 
012711e5 6a01            push    1 
012711e7 50              push    eax 
012711e8 ff1564402701    call    dword ptr [Logue!_imp__SetSecurityDescriptorDacl (01274064)] 


0:000> dt _security_descriptor poi(@ebp-18h) 
ntdll!_SECURITY_DESCRIPTOR 
   +0x000 Revision         : 0x1 '' 
   +0x001 Sbz1             : 0 '' 
   +0x002 Control          : 4 
   +0x004 Owner            : (null) 
   +0x008 Group            : (null) 
   +0x00c Sacl             : (null) 
   +0x010 Dacl             : 0x007bdef0 _ACL 
0:000> r @edi 
edi=007bdef0
```
 
SetSecurityDescriptorDacl が終わった直後の AddAccessAllowedAceBasedSID で止めます。それが 012711ee です。

 
SetSecurityDescriptorDacl に渡している引数を確認すると、第一引数の PSECURITY_DESCRIPTOR が eax レジスタで、DACL である第三引数の PACL は edi レジスタです。関数実行後に eax レジスタは変わってしまうので、その元を辿ると、ebp-18 から mov しているので、このローカル変数領域がセキュリティ記述子です。

 
ebp-18 のセキュリティ記述子内の DACL と、edi レジスタの DACL のポインタは同じ値 (0x007bdef0) になっています。つまり、SetSecurityDescriptorDacl は渡した DACL を別のバッファーにコピーすることなく、そのまま代入しているのです。当然、このセキュリティ記述子は absolute フォーマットになります。

 
MSDN のサンプルで、新規作成したセキュリティ記述子をオリジナルのセキュリティ記述子のバッファー サイズにしても問題ない理由が分かりました。この記事の最初で確かめたように、オリジナルのセキュリティ記述子は Self-relative でした。すなわち、セキュリティ記述子のバッファー サイズである dwSdSizeNeeded には ACL のサイズも含まれています。しかし、新規作成されるセキュリティ記述子は absolute フォーマットになるため、ACL のサイズは不要です。BOR になるどころか、ヒープの無駄遣いです。（といっても KB オーダーですが）

 
そこで、作り直したプログラムの AddAccessAllowedAceBasedSID 関数では、新しいセキュリティ記述子のバッファー サイズは SECURITY_DESCRIPTOR_MIN_LENGTH 定数を使っています。定義は以下のようになっており、各種フィールドはポインターの分のサイズが確保されます。absolute フォーマットならこれで十分です。

 
```
#define SECURITY_DESCRIPTOR_MIN_LENGTH   (sizeof(SECURITY_DESCRIPTOR))

typedef struct _SECURITY_DESCRIPTOR { 
   BYTE  Revision; 
   BYTE  Sbz1; 
   SECURITY_DESCRIPTOR_CONTROL Control; 
   PSID Owner; 
   PSID Group; 
   PACL Sacl; 
   PACL Dacl;

   } SECURITY_DESCRIPTOR, *PISECURITY_DESCRIPTOR;
```
