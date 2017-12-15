---
layout: post
title: "[Win32] Encryption via Data Protection API (DPAPI)"
date: 2011-11-06 03:46:17.000 +09:00
categories:
- C/C++
- Windows
tags:
- CryptProtectData
- DPAPI
- sigcheck
---

わりとマイナーな機能かもしれませんが、Windows (crypt32.dll) には DPAPI という機能があり、汎用的な暗号化のための API が用意されています。適当なバイナリを渡すと、それが暗号化されて返ってくるというものです。自作アプリなどで、ちょっとしたデータを保存するときに便利です。WIn32 API だと、以下の 2 つが主な関数です。

 
CryptProtectData function (サンプルあり) <br />
[http://msdn.microsoft.com/en-us/library/aa380261](http://msdn.microsoft.com/en-us/library/aa380261)

 
CryptUnprotectData function (サンプルあり) <br />
[http://msdn.microsoft.com/en-us/library/aa380882](http://msdn.microsoft.com/en-us/library/aa380882)

 
CryptProtectMemory というメモリ上のデータを暗号化する関数もありますが、こっちはまだ試していません。

 
CryptProtectMemory function (サンプルあり) <br />
[http://msdn.microsoft.com/en-us/library/aa380262](http://msdn.microsoft.com/en-us/library/aa380262)

 
例として、個人証明書の秘密鍵を保管するときに使われています。

 
DPAPI (データ保護 API) のトラブルシューティング <br />
[http://support.microsoft.com/kb/309408/ja](http://support.microsoft.com/kb/309408/ja)

 
暗号化、復号化の処理は全て OS 側で行なわれ、細かいことは隠蔽されているので、開発者は意識する必要はありません。 <br />
鍵には、ユーザー アカウントの鍵とコンピューター アカウントの鍵の 2 種類がありますが、ちょっと癖があるので注意です。

 
- ユーザー アカウントの鍵・・・同じユーザー プロファイルを共有する同じユーザー アカウントであれば複号化可能
- コンピューター アカウントの鍵・・・同一コンピューターであれば、どのユーザーでも復号化可能

 
コンピューター アカウントの方は単純です。暗号化を行なったコンピューターと同じコンピューター上であれば、どのユーザーでも復号化可能です。

 
ユーザー アカウントの場合、ユーザー プロファイルに保存されている鍵を元に暗号化を行なうため、異なるコンピューター間で暗号化と復号化を行なうためには、移動ユーザー プロファイルでユーザー プロファイルを共有していなければなりません。ローカル ユーザー プロファイルの場合、同じコンピューターの同じユーザーでしか暗号化、復号化ができません。理由は後で説明します。

 
DPAPI を使った簡単なツールを作ってみました。 <br />
まずは main.cpp。これは UI だけです。

 
```
// 
// main.cpp 
//

#include <Windows.h> 
#include <stdio.h>

void DPAPIEncrypt(LPCWSTR, LPCWSTR, LPCWSTR, BOOL); 
void DPAPIDecrypt(LPCWSTR, LPCWSTR);

void ShowUsage() { 
    wprintf(L"  Encrypt with User's key:\n    DPAPIUTIL + [InputFile] [OutputFile] [DataID]\n\n"); 
    wprintf(L"  Encrypt with Computer's key:\n    DPAPIUTIL # [InputFile] [OutputFile] [DataID]\n\n"); 
    wprintf(L"  Decrypt:\n    DPAPIUTIL - [InputFile] [OutputFile]\n\n"); 
}

int wmain(int argc, wchar_t *argv[]) { 
    if ( argc<2 )  { 
        ShowUsage(); 
        return ERROR_INVALID_PARAMETER; 
    }

    if ( argv[1][0]==L'+' || argv[1][0]==L'#') { 
        if ( argc<5 ) { 
            ShowUsage(); 
            return ERROR_INVALID_PARAMETER; 
        }

        DPAPIEncrypt(argv[2], argv[3], argv[4], argv[1][0]==L'#'); 
    } 
    else if ( argv[1][0]==L'-' ) { 
        DPAPIDecrypt(argv[2], argv[3]); 
    } 
    else { 
        wprintf(L"Unsupported operation: %s\n\n", argv[1]); 
        return ERROR_INVALID_PARAMETER; 
    }

    return 0; 
} 
```
 
実際の動作を dpapi.cpp に書きます。

 
```
// 
// dpapi.cpp 
//

#include <windows.h> 
#include <stdio.h>

#include <Wincrypt.h>

#pragma comment(lib, "Crypt32.lib")

void DPAPIEncrypt(LPCWSTR, LPCWSTR, LPCWSTR, BOOL); 
void DPAPIDecrypt(LPCWSTR, LPCWSTR);

void DPAPICryptHelper(BOOL Encrypt, LPCWSTR InputFileName, LPCWSTR OutputFileName, LPCWSTR DataID, DWORD Flags) { 
    BOOL Ret= FALSE; 
    DWORD FileSize= 0; 
    HANDLE InputFileHandle= NULL; 
    HANDLE OutputFileHandle= NULL; 
    LPBYTE InputFileData= NULL; 
    DWORD BytesRead= 0; 
    CRYPT_INTEGER_BLOB BlobIn, BlobOut; 
    ZeroMemory(&BlobIn, sizeof(CRYPT_INTEGER_BLOB)); 
    ZeroMemory(&BlobOut, sizeof(CRYPT_INTEGER_BLOB));

    InputFileHandle= CreateFile(InputFileName, 
        GENERIC_READ, FILE_SHARE_READ, NULL, 
        OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL); 
    if ( InputFileHandle==INVALID_HANDLE_VALUE ) { 
        wprintf(L"CreateFile (%s) failed - 0x%08x\n", 
                InputFileName, GetLastError()); 
        goto cleanup; 
    }

    FileSize= GetFileSize(InputFileHandle, NULL); 
    if ( FileSize<0 ) { 
        wprintf(L"GetFileSize failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    }

    InputFileData= (LPBYTE)HeapAlloc(GetProcessHeap(), 0, FileSize); 
    if ( !InputFileData ) { 
        wprintf(L"HeapAlloc failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    }

    Ret= ReadFile(InputFileHandle, InputFileData, 
                  FileSize, &BytesRead, NULL); 
    if ( !Ret ) { 
        wprintf(L"ReadFile failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    }

    CloseHandle(InputFileHandle); 
    InputFileHandle= NULL; 
    
    BlobIn.cbData= FileSize; 
    BlobIn.pbData= InputFileData;

    if ( Encrypt ) { 
        Ret= CryptProtectData(&BlobIn, DataID, 
            NULL, NULL, NULL, Flags, &BlobOut); 
        if ( !Ret ) { 
            wprintf(L"CryptProtectData failed - 0x%08x\n", GetLastError()); 
            goto cleanup; 
        } 
        
        wprintf(L"CryptProtectData succeeded.\n"); 
    } 
    else { 
        LPWSTR RetrievedDataID= NULL; 
        Ret= CryptUnprotectData(&BlobIn, &RetrievedDataID, 
            NULL, NULL, NULL, Flags, &BlobOut); 
        if ( !Ret ) { 
            wprintf(L"CryptUnprotectData failed - 0x%08x\n", GetLastError()); 
            goto cleanup; 
        } 
        
        wprintf(L"CryptUnprotectData succeeded.\n"); 
        wprintf(L"Data Description: %s\n", RetrievedDataID);

        LocalFree(RetrievedDataID); 
    }

    OutputFileHandle= CreateFile(OutputFileName, 
        GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL); 
    if ( OutputFileHandle==INVALID_HANDLE_VALUE ) { 
        wprintf(L"CreateFile (%s) failed - 0x%08x\n", 
                OutputFileName, GetLastError()); 
        goto cleanup; 
    }

    Ret= WriteFile(OutputFileHandle, BlobOut.pbData, BlobOut.cbData, 
                   &BytesRead, NULL); 
    if ( !Ret ) { 
        wprintf(L"WriteFile failed - 0x%08x\n", GetLastError()); 
        goto cleanup; 
    }

    wprintf(L"-----\nSuccessfully generated: \n%s\n-----\n\n", 
            OutputFileName );

cleanup: 
    if ( OutputFileHandle ) 
        CloseHandle(OutputFileHandle);

    if ( BlobOut.pbData ) 
        LocalFree(BlobOut.pbData);

    if ( InputFileData ) 
        HeapFree(GetProcessHeap(), 0, InputFileData);

    if ( InputFileHandle ) 
        CloseHandle(InputFileHandle); 
}

void DPAPIEncrypt(LPCWSTR InputFileName, LPCWSTR OutputFileName, 
                  LPCWSTR DataID, BOOL LocalMachine) { 
    DWORD Flags= CRYPTPROTECT_AUDIT|CRYPTPROTECT_UI_FORBIDDEN; 
    if ( LocalMachine ) 
        Flags|= CRYPTPROTECT_LOCAL_MACHINE; 
    DPAPICryptHelper(TRUE, InputFileName, OutputFileName, DataID, Flags); 
}

void DPAPIDecrypt(LPCWSTR InputFileName, LPCWSTR OutputFileName) { 
    DPAPICryptHelper(FALSE, InputFileName, OutputFileName, 
                     NULL, CRYPTPROTECT_UI_FORBIDDEN); 
}
```
 
実際にツールを使ってみます。 <br />
test.txt というファイルを、ユーザーとコンピューターの鍵で 2 回ずつ暗号化します。

 
```
> dpapiutil.exe

Encrypt with User's key: 
DPAPIUTIL + [InputFile] [OutputFile] [DataID]

Encrypt with Computer's key: 
DPAPIUTIL # [InputFile] [OutputFile] [DataID]

Decrypt: 
DPAPIUTIL - [InputFile] [OutputFile]

> dpapiutil.exe + test.txt test.txt.user.1 01

CryptProtectData succeeded. 
----- 
Successfully generated: 
test.txt.user.1 
-----

> dpapiutil.exe + test.txt test.txt.user.2 01

CryptProtectData succeeded. 
----- 
Successfully generated: 
test.txt.user.2 
-----

> dpapiutil.exe # test.txt test.txt.machine.1 01

CryptProtectData succeeded. 
----- 
Successfully generated: 
test.txt.machine.1 
-----

> dpapiutil.exe # test.txt test.txt.machine.2 01

CryptProtectData succeeded. 
----- 
Successfully generated: 
test.txt.machine.2 
-----
```
 
暗号化したファイルのハッシュを調べてみます。ここでは、Sysinternals の sigcheck というツールを使います。

 
Sigcheck <br />
[http://technet.microsoft.com/ja-jp/sysinternals/bb897441.aspx](http://technet.microsoft.com/ja-jp/sysinternals/bb897441.aspx)

 
長いので、出力は抜粋します。

 
```
> sigcheck -h test.txt.user.1

MD5: b9ed0203690e789dc6949e9a437dce20 
SHA1: c5617272e9a2b40c47ac7f61a12b8cca9472dddd 
SHA256: a555c020ad6bdc766317f69d19c26ba216b2b78844403e1f46061162c24bb690

> sigcheck -h test.txt.user.2

MD5: eef7015b0615b58019d56eac5cfd4ba4 
SHA1: 83718f3dd699404ee84319aa538643c49972f45a 
SHA256: f51fee28917c02865fac282e8bf7001d5e9702e8e936d050badca2ec06cff171

> sigcheck -h test.txt.machine.1

MD5: 0551a1a3c1f8fa9eb072ebb7281002a2 
SHA1: ad5cec77c10c11e0044b2d86ac1fbb59ee3f1365 
SHA256: 2132906d2395ddc1a7fa1a59262a1439ccb64ee35045800611235eb86de5a582

> sigcheck -h test.txt.machine.2

MD5: 276fc75a825d8d346e57b59832c917e0 
SHA1: 94289022e4dea9a1cc515c11cf210c85c5fbd66c 
SHA256: 59e70f699d7f0b888b84c5472da1e8b75784aa4e82308cba9755266964cf1076
```
 
ユーザーとコンピューター アカウントの鍵では、当然ファイルの内容は異なります。それだけでなく、同じユーザーの鍵でも、test.txt.user.1 と test.txt.user.2 ではファイルの内容が異なることがわかります。つまり DPAPI は、呼び出す毎に毎回異なるデータが得られます。

 
もちろん、全部復号化できます。

 
```
> dpapiutil.exe - test.txt.machine.1 test.txt.machine.1.txt

CryptUnprotectData succeeded. 
Data Description: 01 
----- 
Successfully generated: 
test.txt.machine.1.txt 
-----

> dpapiutil.exe - test.txt.machine.2 test.txt.machine.2.txt

CryptUnprotectData succeeded. 
Data Description: 01 
----- 
Successfully generated: 
test.txt.machine.2.txt 
-----

> dpapiutil.exe - test.txt.user.1 test.txt.user.1.txt

CryptUnprotectData succeeded. 
Data Description: 01 
----- 
Successfully generated: 
test.txt.user.1.txt 
-----

> dpapiutil.exe - test.txt.user.2 test.txt.user.2.txt

CryptUnprotectData succeeded. 
Data Description: 01 
----- 
Successfully generated: 
test.txt.user.2.txt 
-----

> type test.txt.user.1.txt 
てすと

> type test.txt.user.2.txt 
てすと

> type test.txt.machine.1.txt 
てすと

> type test.txt.machine.2.txt 
てすと
```
 
DPAPI の仕組みは以下のページに全て書かれています。 <br />
ページが面白く、暗号の奥深さの初歩に触れることができます。

 
Windows Data Protection <br />
[http://msdn.microsoft.com/en-us/library/ms995355](http://msdn.microsoft.com/en-us/library/ms995355)

 
DPAPI の暗号化は、単純に一つの鍵を使って暗号化が行われるわけではなく、複数の鍵が連携することで実現されます。

 
- Password-Derived Key
- Master Key
- Session Key

 
### Password-Derived Key

 
ユーザー、またはコンピューター アカウントのパスワードから生成される鍵。 <br />
生成過程がなかなか徹底しています。ここまでしてようやく最低限の実用に耐えられるのでしょう。暗号化すごい。

 
変換 1: パスワード文字列 → (SHA-1 ハッシュ) → Logon Credential <br />
変換 2: Logon Credential + 塩 + N → (PBKDF2 を N 回実行) → Master Key

 
*塩: 16 バイトの乱数 (=sixteen random bytes for a salt ) ← ネーミング センスがいい <br />
*N ≧ 4000 <br />
(<code>HKLM\Software\Microsoft\Cryptography\Protect\Providers\GUID\<code>MasterKeyIterationCount</code></code>)

 
### Master Key

 
アカウント毎に生成される 512 ビット乱数。鍵として使われるのではなく、Session Key を生成する種として使う。

 
とはいっても、これを奪われないことが DPAPI のセキュリティの肝なので、Master Key を Password-Derived Key で守ります。

 
保管手順 1: Master Key の HMAC-SHA1 値を算出 (たぶん秘密鍵はアカウント パスワード) <br />
保管手順 2: Master Key と HMAC 値を 3DES で暗号化 (鍵は Password-Derived Key) <br />
保管手順 3: 手順 2. で暗号化したデータ、塩、N をユーザー プロファイルに保存 (塩と N は暗号化されません)

 
Master Key の保管場所は不明です。%APPDATA%\Microsoft のどこかだと思うのですが・・。

 
### Session Key

 
実際にバイナリ データを暗号化するに使われる共通鍵です。

 
変換 1: Master Key + 16 バイト乱数データ の SHA-1 ハッシュ値を算出 <br />
このときの乱数をコショウとでも呼んでいれば面白かったのですが、"16 bytes of random data" と書いてあるだけでした。

 
変換 2: Secondary Entropy と Optional Password を加えて、もう一度ハッシュ値を算出 <br />
これらは、CryptProtectData などの暗号化 API の引数として渡す追加の認証情報です。塩コショウというよりは、〆のラーメンみたいなもんですかね。

 
これでキーが得られ、暗号化が行われるわけですが、さらなるポイントは暗号化後です。暗号化データには、Session Key ではなく、上でコショウと呼んだ乱数だけが埋めこまれます。なぜなら、同じ Master Key さえ持っていれば、コショウだけで復号化は可能だからです。そしてコショウは暗号化されません。Master Key が厳重に守られていれば、コショウがばれても復号化は不可能です。

 
以上が DPAPI の基本の仕組みです。ここまで分かれば、前述の 2 つの疑問は解けます。

 
1. 同一ドメイン アカウントであっても、ユーザー プロファイルが異なると復号化できない理由 <br />
→ プロファイル間で異なる塩が加えられており、Master Key が異なるため。
1. 同じパラメーターを渡しても、暗号化データは毎回異なる理由 <br />
→ API 実行時に加えられるコショウが異なるため。

 
その他の DPAPI の仕様として、Master Key を失くした時のために Master Key のバックアップが取られる仕組み、アカウント パスワードが変更されても復号化できるようにうする仕組みなどがあります。上で紹介した MSDN のページに書いてあるので、興味がある方は是非ご覧ください。

 
ユーザー プロファイルってのは以外に重要ですね。単にデスクトップやマイ ドキュメント、レジストリを持っているだけではないのです。

