---
layout: post
title: "[Win32] [C++] convert hexadecimal string into decimal integer"
date: 2011-02-15 03:32:18.000 +09:00
categories:
- C/C++
tags:
- FILETIME
- NtQuerySystemTime
- SYSTEMTIME
---

C++ の標準関数 （というより Visual C++ の C ランタイム ライブラリ ; CRT） には 16 進から 10 進への変換するものが存在しない。10 進から 16 進だったら printf 系や _itoa 系の関数を使えば一発なのに。

 
で、書いてみた。幾つか方法はあるが、速さよりもコード量を短くしたいので wstringstream を使う方法でやってみる。一応このソース ファイルは CRT だけで書いています。速さ優先だと、どんなアルゴリズムがいいんですかね。

 
<font color="#ff0000">[2012/04/07]&nbsp; 文字整数変換の関数を書き直しました。</font> <br />
→ [[C++] convert hexadecimal string into decimal integer (updated)](http://msmania.wordpress.com/2012/04/07/c-convert-hexadecimal-string-into-decimal-integer-updated/) <br />


 
```
// 
// htoi.cpp 
//

#include <sstream>

using namespace std;

unsigned long htoi_32(const wchar_t*); 
unsigned long long htoi_64(const wchar_t*);

struct longlong { 
    long ll; 
    long hl; 
};

unsigned long htoi_32(const wchar_t *hex) { 
    wchar_t safebuf[9]; 
    safebuf[8]= 0; 
    memcpy(safebuf, hex, sizeof(wchar_t)*8); //rough code

    unsigned long ret= 0; 
    wstringstream ss; 
    ss << std::hex << safebuf; 
    ss >> ret; 
    return ret; 
}

unsigned long long htoi_64(const wchar_t *hex) { 
    unsigned long long ret= 0;

    wchar_t safebuf[18]; 
    safebuf[17]= 0; 
    memcpy(safebuf, hex, sizeof(wchar_t)*17); // rough code

    wchar_t *p= safebuf; 
    while ( *p ) { 
        if ( *p==L'`' ) { 
            ((longlong*)&ret)->hl= htoi_32(safebuf); 
            ((longlong*)&ret)->ll= htoi_32(p+1); 
            return ret; 
        } 
        ++p; 
    }

    int len= p-safebuf; 
    if ( len>8 ) { 
        ((longlong*)&ret)->ll= htoi_32(p-8); 
        *(p-8)= 0; 
        ((longlong*)&ret)->hl= htoi_32(safebuf); 
    } 
    else { 
        ((longlong*)&ret)->hl= 0; 
        ((longlong*)&ret)->ll= htoi_32(safebuf); 
    }

    return ret; 
}
```
 
“rough code” とコメントを入れたところは本当にラフ。safebuf のバッファー サイズが固定されているから、危険性は少ないという判断です。時間がないので手抜きです。お決まりですね。

 
バック クォートを使った書式 0x########`######## に対応させているのは、デバッガーのコンソールから数値を直接コピペできるようにしているため。で、何のためにこんな関数が必要かというと、NtQuerySystemTime という関数で取得されるシステム時間に関連するところを解析する必要があったため。

 
[http://msdn.microsoft.com/en-us/library/ms724512(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/ms724512(v=vs.85).aspx)

 
GetSystemTimeAsFileTime を使えって書いてありますけどね。

 
この関数が返す FILETIME は構造体の形をしていますが、定義を見れば明らかなように、実体は単なる 64 bit 整数値で、UTC 西暦 1601 年の元日からのオフセットを 100 nsec 単位で表したものです。いろいろと中途半端。大体 1601 年ってどこから出てきたんだ。ちなみに NTP では基準が 1900 年のオフセット値が使われています。バラバラ。

 
で、その NtQuerySystemTime を呼び出すと、例えば 129,421,807,825,314,855 とかいう巨大な数値が返ってくるわけです。約 13 京。もちろん、パッと見ただけでは何月何日かチンプンカンプンです。

 
人間が使う暦は FILETIME ではなく SYSTEMTIME という構造体で管理されます。もちろん相互変換する API があります。そんな救世主が SystemTimeToFileTime と FileTimeToSystemTime です。

 
[http://msdn.microsoft.com/en-us/library/ms724948(v=VS.85).aspx](http://msdn.microsoft.com/en-us/library/ms724948(v=VS.85).aspx) <br />
[http://msdn.microsoft.com/en-us/library/ms724280(v=VS.85).aspx](http://msdn.microsoft.com/en-us/library/ms724280(v=VS.85).aspx)

 
NtQuerySystemTime のように Nt を接頭辞とする関数のほとんどは Ntdll.dll に実装されていますが、インポート ライブラリがないため、動的リンクを使う必要があるので注意。

 
それなりにエラー処理もしていますが、自分で使うために書いたこともあって、あまり真面目にテストしていません。穴はいっぱいあると思います。

 
```
// 
// main.cpp 
//

#include <Windows.h> 
#include <stdio.h>

unsigned long htoi_32(const wchar_t*); 
unsigned long long htoi_64(const wchar_t*);

typedef NTSTATUS (WINAPI *PFUNC)(PLARGE_INTEGER);

/*

Usage:

  qtime

    Retrieve the current system time with NtQuerySystemTime

  qtime 0x01234567`89abcdef 
  qtime 0x0123456789abcdef 
  qtime 0n9223372036854775807

     Convert specified 100-nanosecond offset since Jan.1,1601 into UTC. 
*/

int wmain(int argc, wchar_t *argv[]) { 
    if ( argc==2 && wcscmp(argv[1],L"/?")==0 ) { 
        wprintf_s(L"\nUsages:\n\n  qtime\n\n"); 
        wprintf_s(L"    Display the current system time with NtQuerySystemTime\n\n"); 
        wprintf_s(L"  qtime 0x01234567`89abcdef\n  qtime 0x0123456789abcdef\n"); 
        wprintf_s(L"  qtime 0n9223372036854775807\n\n     Convert specified 100-nanosecond offset since Jan.1,1601 into UTC.\n\n"); 
        return 0; 
    }

    if ( argc==2 ) { 
        LPCWCHAR p= argv[1]; 
        SYSTEMTIME st; 
        long long ll= 0; 
        if ( p[0]==L'0' && p[1]==L'x' ) 
            ll= htoi_64(p+2); 
        else if ( p[0]==L'0' && p[1]==L'n' ) 
            ll= _wtoi64(p+2); 
        else 
            goto query_currenttime;

        if ( FileTimeToSystemTime((PFILETIME)&ll, &st) ) { 
            wprintf_s(L"specified parameter: %s\n", p); 
            wprintf_s(L"0x%08x`%08x = %4d/%2d/%2d %02d:%02d:%02d.%03d\n", 
                ((PLARGE_INTEGER)&ll)->HighPart, 
                ((PLARGE_INTEGER)&ll)->LowPart, 
                st.wYear, 
                st.wMonth, 
                st.wDay, 
                st.wHour, 
                st.wMinute, 
                st.wSecond, 
                st.wMilliseconds); 
            return 0; 
        } 
    }

query_currenttime: 
    
    HMODULE hNtdll= LoadLibrary(L"Ntdll.dll"); 
    if ( hNtdll ) { 
        PFUNC pNtQuerySystemTime= (PFUNC)GetProcAddress(hNtdll, "NtQuerySystemTime"); 
        if (  pNtQuerySystemTime ) { 
            LARGE_INTEGER currenttime; 
            HRESULT hr= (*pNtQuerySystemTime)(&currenttime); 
            if ( SUCCEEDED(hr) ) { 
                wprintf_s(L"Current   FILETIME: 0x%08x`%08x\n", 
                    currenttime.HighPart, currenttime.LowPart);

                SYSTEMTIME st; 
                if ( FileTimeToSystemTime((PFILETIME)&currenttime, &st) ) { 
                    wprintf_s(L"Current SYSTEMTIME: %4d/%2d/%2d %02d:%02d:%02d.%03d\n", 
                        st.wYear, 
                        st.wMonth, 
                        st.wDay, 
                        st.wHour, 
                        st.wMinute, 
                        st.wSecond, 
                        st.wMilliseconds); 
                } 
            } 
        } 
        FreeLibrary(hNtdll); 
    }

    return 0;

}
```
 
最近、エラー処理のために goto 文を使うことが増えてきた。goto は使うな、と書いてある C/C++ 本が多いけど、使った方がコードが分かりやすくなる場合もあると思うのです。

