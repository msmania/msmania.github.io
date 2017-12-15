---
layout: post
title: "[C++] convert hexadecimal string into decimal integer (updated)"
date: 2012-04-07 16:47:54.000 +09:00
categories:
- C/C++
tags:
- htoi
- htoi64
- wtoi64
- _wtoi64
---

一年ほど前に、16 進数の文字列を 10 進数に変換するコードを紹介しました。

 
<em>[Win32] [C++] convert hexadecimal string into decimal integer</em> <br />
[<em>http://msmania.wordpress.com/2011/02/15/win32-c-convert-hexadecimal-string-into-decimal-integer/</em>](http://msmania.wordpress.com/2011/02/15/win32-c-convert-hexadecimal-string-into-decimal-integer/)

 
このときのコードは wstringstream を使ういい加減な処理で応用範囲が狭いため、もっと汎用的なコードを書いてみました。数ヶ月前から使っていて実用にも耐えているので、前回より遥かにマシです。

 
メインの関数は wtoi64 で、文字列を 64bit 整数に変換します。デバッガーと併用することが多いので、以下のフォーマットに対応しています。

 
&#x5b;16 進表記&#x5d; <br />
0xFFFFFFFF`FFFFFFFF <br />
0xFFFFFFFF <br />
FFFFFFFF <br />
FFFFFFFF`FFFFFFFF <br />
FFFFFFFFFFFFFFFF <br />
 <br />
&#x5b;10 進表記&#x5d; <br />
0n12345678901234 <br />
12345678901234

 
デバッガーと異なって、0x や 0n の接頭辞を付けない場合の既定は 10 進数にしています。16 進を既定にするには、Category==cUnknown の場合の Category を cDec ではなく cHex に変更して下さい。(青字部分)

 
ソースはこれです。

 
```
// 
// convert.cpp 
//

#include <ctype.h> 
#include <stdlib.h>

#define GET_HIDWORD(ll) (*(((int*)(&ll))+1)) 
#define GET_LODWORD(ll) (*((int*)(&ll)))

bool wtoi64(wchar_t *String, unsigned long long *ll);

int htoi(wchar_t c) { 
    if ( iswdigit(c) ) return c-L'0'; 
    if ( c>=L'a' && c<=L'f' ) return c-L'a'+10; 
    if ( c>=L'A' && c<=L'F' ) return c-L'A'+10; 
    return 0; 
}

int htoi(const wchar_t *s) { 
    int Ret= 0; 
    const wchar_t *p= s;

    if ( s==0 || s[0]==0 ) 
        return 0; 
    
    for ( int i=0 ; *p && i<8 ; ++i, ++p ) { 
        if ( !iswxdigit(*p) ) 
            return 0; 
    }

    while ( s<p ) { 
        Ret<<=4; 
        Ret+= htoi(*(s++)); 
    }

    return Ret; 
}

bool wtoi64(wchar_t  *String, unsigned long long *ll) { 
    const int BUFSIZE= 32; // 64*log(2)<20 
    wchar_t Buffer[BUFSIZE]; 
    int i; 
    enum { cHex, cDec, cUnknown } Category= cUnknown;

    if ( String==0 || String[0]==0 ) 
        return false;

    if ( String[0]==L'0' && (String[1]==L'x' || String[1]==L'X') ) { 
        Category= cHex; 
        String+= 2; 
    } 
    else if ( String[0]==L'0' && (String[1]==L'n' || String[1]==L'N') ) { 
        Category= cDec; 
        String+= 2; 
    } 
    
    const wchar_t *cp= String; 
    wchar_t *p= Buffer;

    for ( i=0 ; *cp && i<BUFSIZE ; ++i ) { 
        if ( iswdigit(*cp) ) 
            *(p++)= *(cp++); 
        else if ( iswxdigit(*cp) ) { 
            if ( Category==cDec ) return false; 
            Category= cHex; 
            *(p++)= *(cp++); 
        } 
        else if ( *cp==L'`' ) { 
            if ( Category==cDec ) return false; 
            ++cp; 
        } 
        else 
            return false; 
    } 
    
    if ( i==BUFSIZE ) return false;

    if ( Category==cUnknown ) Category= cDec; ← ここで既定値が決まる。 
    *p= 0;

    if ( ll ) { 
        if ( Category==cDec ) 
            *ll= _wtoi64(Buffer); 
        else { 
            if ( p-Buffer>=8 ) { 
                GET_LODWORD(*ll)= htoi(p-8); *(p-8)= 0; 
                GET_HIDWORD(*ll)= htoi(Buffer); 
            } 
            else { 
                GET_LODWORD(*ll)= htoi(Buffer); 
                GET_HIDWORD(*ll)= 0; 
            } 
        } 
    }

    return true; 
}
```
