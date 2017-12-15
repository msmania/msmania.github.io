---
layout: post
title: "[COM] [Win32] [C++] IWindowsUpdateAgentInfo::GetInfo を使ってみる"
date: 2010-12-23 22:50:16.000 +09:00
categories:
- C/C++
- Windows
tags:
- COM
- Win32
- windowsupdate
- wuapi.dll
---

Microsoft の更新プログラムで、Windows Update Agent を更新するものがあります。Windows Update そのものを更新する、というやつです。Windows Update にもバージョンがあり、それがインクリメントされるのですが、そのバージョンの確認方法はあまり有名ではありません。検索すると、以下のようなページが出てきたりします。

 
[http://msdn.microsoft.com/en-us/library/bb680319.aspx](http://msdn.microsoft.com/en-us/library/bb680319.aspx) <br />
[http://technet.microsoft.com/en-us/library/bb680319.aspx](http://technet.microsoft.com/en-us/library/bb680319.aspx)

 
なんで SQL が出てくるんだよ、って話です。って、System Center の話なのか。個人ユーザーとは関係なさ過ぎて困る、と。

 
もうちょっと頑張ると、次のページを見つけました。

 
[http://msdn.microsoft.com/ja-jp/library/aa387091.aspx](http://msdn.microsoft.com/ja-jp/library/aa387091.aspx)

 
API 使えってか。というわけで、Windows Update Agent バージョン確認プログラムを書きました。COM クライアントは久々なので忘れすぎ。VARIANT 構造体とか、使い方が特殊なくせに、COM の世界では当り前っぽいので、その使い方にたどり着くのにずいぶんと時間がかかった。サンプルプログラムがすぐに見つからんし。そんなこんなで、以下のルーチンを書いてみた。

 
```
// 
// wuaver.cpp 
//

#include <windows.h> 
#include <tchar.h> 
#include <wuapi.h> 
#include <stdio.h>

static const OLECHAR g_ApiMajorVersion[]= L"ApiMajorVersion"; 
static const OLECHAR g_ApiMinorVersion[]= L"ApiMinorVersion"; 
static const OLECHAR g_ProductVersionString[]= L"ProductVersionString";

void DoMyJob() { 
    if ( SUCCEEDED(CoInitialize(NULL)) ) { 
        IWindowsUpdateAgentInfo *pIWUA= NULL; 
        DWORD err= 0; 
        HRESULT ret= CoCreateInstance( 
            CLSID_WindowsUpdateAgentInfo, 
            NULL, 
            CLSCTX_INPROC_SERVER, 
            IID_IWindowsUpdateAgentInfo, 
            (LPVOID*)&pIWUA);

        if ( SUCCEEDED(ret) ) { 
            VARIANT varin, varout;

            // major version 
            varin.vt= VT_BSTR; 
            varin.bstrVal= SysAllocString(g_ApiMajorVersion); 
            ret= pIWUA->GetInfo(varin, &varout); 
            if ( SUCCEEDED(ret) ) { 
                wprintf_s(L"Major version: %d\r\n", varout.lVal); 
            } 
            SysFreeString(varin.bstrVal);

            // minor version 
            varin.vt= VT_BSTR; 
            varin.bstrVal= SysAllocString(g_ApiMinorVersion); 
            ret= pIWUA->GetInfo(varin, &varout); 
            if ( SUCCEEDED(ret) ) { 
                wprintf_s(L"Minor version: %d\r\n", varout.lVal); 
            } 
            SysFreeString(varin.bstrVal);

            // ProductVersionString 
            varin.vt= VT_BSTR; 
            varin.bstrVal= SysAllocString(g_ProductVersionString); 
            ret= pIWUA->GetInfo(varin, &varout); 
            if ( SUCCEEDED(ret) ) { 
                wprintf_s(L"Product version: %s\r\n", varout.bstrVal); 
            } 
            SysFreeString(varin.bstrVal);

            pIWUA->Release(); 
        }

        CoUninitialize(); 
    } 
}

int _tmain(int argc, _TCHAR* argv[]) { 
    DoMyJob(); 
    return 0; 
}
```
 
雑ですね、ええ。とりあえずは動きます。

 
と、ここまで完成したところで、WUA のバージョンってのは wuapi.dll のバージョンを調べればいいということを知った。おいおいおい！

