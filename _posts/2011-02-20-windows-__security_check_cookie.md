---
layout: post
title: "[x86 Assembler] [Windows] __security_check_cookie とは"
date: 2011-02-20 18:19:02.000 +09:00
categories:
- Debug
- Windows
tags:
- __security_check_cookie
---

最近のコンパイラは、かなり頭の使う処理を行ってくれています。VIsual Studio でも、普通に書いたプログラムなのに、いろいろなセキュリティー関連のチェック機構を埋め込んでいくれています。動作させる環境を守ってくれるのでとても有難いのですが、何も知らずにプログラムを使っていると、思わぬところで悩まされることがあります。

 
Visual Studio で /GS オプションを付けて C/C++ プログラムをコンパイルすると、関数呼び出しの際にバッファー オーバー ラン (BOR) を自動的に検出してくれるコードが埋め込まれます。異なるバージョンのコンパイラで作ったライブラリをリンクさせようとすると、たまに 「\__security_check_cookie なんちゃらのシンボルがない」 というリンク エラーが出ることがあります。自分で書いたプログラムを見てもそんな関数は使ってないわけですが、コンパイラが勝手に埋め込んでるわけです。

 
このセキュリティ チェック機構に関しては、次のMSDN の ページが詳しいです。

 
[http://msdn.microsoft.com/ja-jp/library/aa290051(v=vs.71).aspx](http://msdn.microsoft.com/ja-jp/library/aa290051(v=vs.71).aspx)

 
IT Pro でも解説がなされていました。次のページの第 4~6 回ですが、なかなかひどい文章です。作者は身元を明かせよ、と。

 
[http://itpro.nikkeibp.co.jp/article/COLUMN/20060119/227538/?ST=develop](http://itpro.nikkeibp.co.jp/article/COLUMN/20060119/227538/?ST=develop)

 
アセンブラ関連の投稿一発目ということで、自分でこの辺を見てみることにした。アセンブラに関してはまだまだ勉強中なので、変なことを言っているかもしれません。

 
環境は以下。 <br />
コンパイラ: Visual Studio 2010 <br />
コンパイル環境: Windows 7 x64 <br />
実行環境: WIndows 7 x86

 
とりあえずプログラムを書く。なんでもいい。

 
```
// 
// main.cpp 
//

void bor() { 
    char buf[64]; 
    buf[0]= 0; 
}

int wmain(int argc, wchar_t *argv[]) { 
    bor(); 
    return 0; 
} 
```
 
これを /GS オプションをつけて （デフォルトでオンになっているけど） コンパイル。bor 関数のアセンブラは以下のようになっている。適当にコメント入れました。

 
ちなみに、表記フォーマットはこんな風になっています。 <br />
<em>&lt;ソースコードの行番号&gt; &lt;プログラムのメモリ上の位 置&gt; &lt;機械語&gt; &lt;アセンブラ&gt;</em>

 
```
BOR!bor [e:\visual studio 2010\projects\bor\main.cpp @ 6]:

; プロローグ（関数が呼ばれた時のおまじない） 
    6 00181380 55              push    ebp 
    6 00181381 8bec            mov     ebp,esp 
    6 00181383 81ec0c010000    sub     esp,10Ch 
    6 00181389 53              push    ebx 
    6 0018138a 56              push    esi 
    6 0018138b 57              push    edi

; ローカル変数用のスタックを CC で埋める 
    6 0018138c 8dbdf4feffff    lea     edi,[ebp-10Ch] 
    6 00181392 b943000000      mov     ecx,43h 
    6 00181397 b8cccccccc      mov     eax,0CCCCCCCCh 
    6 0018139c f3ab            rep stos dword ptr es:[edi]

; BOR 検出用のクッキーを保存 
    6 0018139e a100701800      mov     eax,dword ptr [BOR!__security_cookie (00187000)] 
    6 001813a3 33c5            xor     eax,ebp 
    6 001813a5 8945fc          mov     dword ptr [ebp-4],eax

; buf[0]= 0; の処理 
    8 001813a8 c645b800        mov     byte ptr [ebp-48h],0

; なんだこいつは… 
    9 001813ac 52              push    edx 
    9 001813ad 8bcd            mov     ecx,ebp 
    9 001813af 50              push    eax 
    9 001813b0 8d15d0131800    lea     edx,[BOR!bor+0x50 (001813d0)] 
    9 001813b6 e8c7fcffff      call    BOR!ILT+125(_RTC_CheckStackVars (00181082) 
    9 001813bb 58              pop     eax 
    9 001813bc 5a              pop     edx

; エピローグ１（関数が終わる時のおまじない） 
    9 001813bd 5f              pop     edi 
    9 001813be 5e              pop     esi 
    9 001813bf 5b              pop     ebx

; ここで BOR を検出させる 
    9 001813c0 8b4dfc          mov     ecx,dword ptr [ebp-4] 
    9 001813c3 33cd            xor     ecx,ebp 
    9 001813c5 e84afcffff      call    BOR!ILT+15(__security_check_cookie (00181014)

; エピローグ２（関数が終わる時のおまじない） 
    9 001813ca 8be5            mov     esp,ebp 
    9 001813cc 5d              pop     ebp 
    9 001813cd c3              ret 
```
 
C++ で二行書いただけなのに、これだけの長さになってしまうところがアセンブラの面白いところ。VCでデバッグしているときに、変数が CC で埋められているのを疑問に思っていたけど、関数が呼ばれるたびにこんな風に明確にリセットされているとは思わなかった。あと、ローカル変数は 64 バイトなのに、268 (=0x10C) バイトもリセットしている。そんなに使うのだろうか。

 
肝心の BOR 検出処理は 2ヶ所に分かれています。まず、関数が呼ばれた段階（プロローグと、ローカル変数の初期化処理の後）で、BOR!\__security_cookiee という DWORD 値（クッキー）とレジスタ esp を XOR 演算した値を ebp-4、すなわち、この関数スコープにおけるスタック領域の一番下に代入します。先の MSDN のページによると、クッキーの値は単なる乱数値で、\__security_init_cookie の中で起動時に生成されるようです。

 
関数の最初にクッキーを保存しておいて、次に、関数の処理が終わったあとに \__security_check_cookie 関数を呼び出して照合します。関数をコールする前に、ebp-4 に保存しておいたクッキーに再度 esp レジスタの値を XOR し、元々のクッキーの値を ecx レジスタに入れておきます。

 
\__security_check_cookie のアセンブラは以下のようになっています。

 
```
BOR!__security_check_cookie [f:\dd\vctools\crt_bld\self_x86\crt\src\intel\secchk.c @ 52]: 
   52 00181460 3b0d00701800    cmp     ecx,dword ptr [BOR!__security_cookie (00187000)] 
   56 00181466 7502            jne     BOR!__security_check_cookie+0xa (0018146a)

BOR!__security_check_cookie+0x8 [f:\dd\vctools\crt_bld\self_x86\crt\src\intel\secchk.c @ 57]: 
   57 00181468 f3c3            rep ret

BOR!__security_check_cookie+0xa [f:\dd\vctools\crt_bld\self_x86\crt\src\intel\secchk.c @ 59]: 
   59 0018146a e918fcffff      jmp     BOR!ILT+130(___report_gsfailure) (00181087) 
```
 
処理はかなり単純で、赤字で示した処理で、ecx レジスタの値とクッキーの値を比較するだけです。値が異なっていれば、関数の処理中に ebp-4 に保存されていたクッキーが変更された、つまり、ローカル変数用に確保されていたバッファー領域を超過して BOR が発生したか、途中で esp レジスタが変更されてしまったということで、\___report_gsfailure という関数を呼びに行きます。

 
値が一致すれば BOR チェックとしては成功で、関数は終わります。が、単純に ret で終わるのではなく、rep ret で終わるのです。これについて調べたところ、はっきりとした理由は不明ですが、パフォーマンス向上のために rep ret を使う慣習があるらしい。

 
この人のブログに言及があります。 <br />
[http://mikedimmick.blogspot.com/2008/03/what-heck-does-ret-mean.html](http://mikedimmick.blogspot.com/2008/03/what-heck-does-ret-mean.html)

 
以下の怪しいページに、AMD が推奨している、と書いてある。怪しいけど、とりあえず深追いは避ける。 <br />
[http://sourceware.org/ml/libc-alpha/2004-12/msg00022.html](http://sourceware.org/ml/libc-alpha/2004-12/msg00022.html)

 
関数 bor に戻って、BOR!ILT+125(\_RTC_CheckStackVars を呼び出す処理。これはなんだろう。名前からして、マシンスタックの正常性を確認してくれる処理だろうか。

 
BOR!ILT+125 では、jmp 命令で BOR!\_RTC_CheckStackVars に飛ばされます。で、その関数がこれ。

 
```
BOR!_RTC_CheckStackVars: 
00fc14b0 8bff            mov     edi,edi 
00fc14b2 55              push    ebp 
00fc14b3 8bec            mov     ebp,esp 
00fc14b5 51              push    ecx 
00fc14b6 53              push    ebx 
00fc14b7 56              push    esi 
00fc14b8 57              push    edi 
00fc14b9 33ff            xor     edi,edi 
00fc14bb 8bf2            mov     esi,edx 
00fc14bd 8bd9            mov     ebx,ecx 
00fc14bf 897dfc          mov     dword ptr [ebp-4],edi 
00fc14c2 393e            cmp     dword ptr [esi],edi 
00fc14c4 7e48            jle     BOR!_RTC_CheckStackVars+0x5e (00fc150e)

BOR!_RTC_CheckStackVars+0x16: 
00fc14c6 eb08            jmp     BOR!_RTC_CheckStackVars+0x20 (00fc14d0)

BOR!_RTC_CheckStackVars+0x20: 
00fc14d0 8b4604          mov     eax,dword ptr [esi+4] 
00fc14d3 8b0c38          mov     ecx,dword ptr [eax+edi] 
00fc14d6 817c19fccccccccc cmp     dword ptr [ecx+ebx-4],0CCCCCCCCh 
00fc14de 750f            jne     BOR!_RTC_CheckStackVars+0x3f (00fc14ef)

BOR!_RTC_CheckStackVars+0x30: 
00fc14e0 8b543804        mov     edx,dword ptr [eax+edi+4] 
00fc14e4 03d1            add     edx,ecx 
00fc14e6 813c1acccccccc  cmp     dword ptr [edx+ebx],0CCCCCCCCh 
00fc14ed 7411            je      BOR!_RTC_CheckStackVars+0x50 (00fc1500)

BOR!_RTC_CheckStackVars+0x3f: 
00fc14ef 8b4c3808        mov     ecx,dword ptr [eax+edi+8] 
00fc14f3 8b5504          mov     edx,dword ptr [ebp+4] 
00fc14f6 51              push    ecx 
00fc14f7 52              push    edx 
00fc14f8 e8cbfbffff      call    BOR!ILT+195(?_RTC_StackFailureYAXPAXPBDZ) (00fc10c8) 
00fc14fd 83c408          add     esp,8

BOR!_RTC_CheckStackVars+0x50: 
00fc1500 8b45fc          mov     eax,dword ptr [ebp-4] 
00fc1503 40              inc     eax 
00fc1504 83c70c          add     edi,0Ch 
00fc1507 8945fc          mov     dword ptr [ebp-4],eax 
00fc150a 3b06            cmp     eax,dword ptr [esi] 
00fc150c 7cc2            jl      BOR!_RTC_CheckStackVars+0x20 (00fc14d0)

BOR!_RTC_CheckStackVars+0x5e: 
00fc150e 5f              pop     edi 
00fc150f 5e              pop     esi 
00fc1510 5b              pop     ebx 
00fc1511 8be5            mov     esp,ebp 
00fc1513 5d              pop     ebp 
00fc1514 c3              ret 
```
 
クッキーのチェックより長い。初心者にはソースコードがないとキツい・・・、というわけでこれはまた今度。

