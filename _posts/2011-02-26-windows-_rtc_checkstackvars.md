---
layout: post
title: "[x86 Assembler] [Windows] _RTC_CheckStackVars とは"
date: 2011-02-26 16:45:32.000 +09:00
categories:
- Debug
- Windows
tags:
- _RTC_CheckStackVars
---

前回の記事で、\__security_check_cookie 周りのアセンブラを調べていたら、\_RTC_CheckStackVars という、コンパイラが差し込む他のセキュリティ コードを発見してしまいました。\__security_check_cookie に比べて、\_RTC_CheckStackVars については、日本語の解説が全然ない。コンパイル エラーで \_RTC_CheckStackVars のシンボルが出てくることは多いらしいけど。

 
このセキュリティ コードは、コンパイル オプション /RTC1 や /RTCs をつけたときに差し込まれます。Visual Studio でいうところの &#x5b;C/C++ &gt; Code Generation &gt; Basic Runtime Checks&#x5d; です。ちなみに前回の /GS オプションは &#x5b;C/C++ &gt; Code Generation &gt; Buffer Security Check &#x5d; でした。それぞれ独立した機構となっているようです。

 
前置きは以上で、アセンブラを読みましょう。たったこれだけのコードを解読するのに半日かかりました。「今、このレジスタには何が入っているか」 を覚えるのが大変。メモリ構造もまた然り。マシンスタックなどの絵を書きながらじゃないと頭に入らない。

 
まずはプログラムの準備。関数は 2 つにしました。中途半端な処理をさせているのは、処理が単純過ぎると \_RTC_CheckStackVars が差し込まれないためです。

 
```
// 
// main.cpp 
//

void bor2() { 
    char buf[8]; 
    int *p= (int*)(buf+0); 
    int *q= (int*)(buf+4); 
    *p= 0x12345678; 
    *q= 0x87654321; 
}

void bor1() { 
    char buf[64]; 
    buf[0]= 0; 
}

int wmain(int argc, wchar_t *argv[]) { 
    bor1(); 
    bor2(); 
    return 0; 
}
```
 
環境は前と同じで。WOW64 や AMD64 の仕組みをちゃんと把握できていないので、念のため x86 で実行します。

 
コンパイラ: Visual Studio 2010 <br />
コンパイル環境: Windows 7 x64 <br />
実行環境: WIndows 7 x86

 
前回と同じ bor1 から見ていきます。

 
```
BOR!bor1: 
00071430 55              push    ebp 
00071431 8bec            mov     ebp,esp 
00071433 81ec0c010000    sub     esp,10Ch 
00071439 53              push    ebx 
0007143a 56              push    esi 
0007143b 57              push    edi 
0007143c 8dbdf4feffff    lea     edi,[ebp-10Ch] 
00071442 b943000000      mov     ecx,43h 
00071447 b8cccccccc      mov     eax,0CCCCCCCCh 
0007144c f3ab            rep stos dword ptr es:[edi] 
0007144e a100700700      mov     eax,dword ptr [BOR!__security_cookie (00077000)] 
00071453 33c5            xor     eax,ebp 
00071455 8945fc          mov     dword ptr [ebp-4],eax 
00071458 c645b800        mov     byte ptr [ebp-48h],0 
0007145c 52              push    edx 
0007145d 8bcd            mov     ecx,ebp 
0007145f 50              push    eax 
00071460 8d1580140700    lea     edx,[BOR!bor1+0x50 (00071480)] 
00071466 e817fcffff      call    BOR!ILT+125(_RTC_CheckStackVars (00071082) 
0007146b 58              pop     eax 
0007146c 5a              pop     edx 
0007146d 5f              pop     edi 
0007146e 5e              pop     esi 
0007146f 5b              pop     ebx 
00071470 8b4dfc          mov     ecx,dword ptr [ebp-4] 
00071473 33cd            xor     ecx,ebp 
00071475 e89afbffff      call    BOR!ILT+15(__security_check_cookie (00071014) 
0007147a 8be5            mov     esp,ebp 
0007147c 5d              pop     ebp 
0007147d c3              ret
```
 
青字が呼び出し部分です。ここで重要なのは 2 点です。「ecx レジスタには bor!bor1 の ebp が入っている」 ことと、「edx レジスタに bor!bor1+0x50 のアドレスが入っている」 ということです。bor!bor1+0x50 って何よ、って話ですよね。当然気になります。bor!bor1 関数のリターン コードはアドレス 0007147d にある ret 命令です。0007147d = bor!bor1 (00071430) + 0x4D なので、+0x50 は、bor!bor1 がロードされている直後の DWORD 境界の位置を示しているらしいことが分かります。

 
確認のため bor!bor2 についても調べてみると、やはり bor!bor2 関数の直後の DWORD 位置を edx にストアしています。bor2 の場合は偶然 DWORD 境界で関数が終わっていますが、bor!bor1 の場合は 0007147e と 0007147e の 2 バイトはのりしろになります。

 
```
BOR!bor2: 
00071390 55              push    ebp 
00071391 8bec            mov     ebp,esp

中略

000713d6 52              push    edx 
000713d7 8bcd            mov     ecx,ebp 
000713d9 50              push    eax 
000713da 8d15f8130700    lea     edx,[BOR!bor2+0x68 (000713f8)] 
000713e0 e89dfcffff      call    BOR!ILT+125(_RTC_CheckStackVars (00071082) 
000713e5 58              pop     eax 
000713e6 5a              pop     edx

中略

000713f4 8be5            mov     esp,ebp 
000713f6 5d              pop     ebp 
000713f7 c3              ret
```
 
で、ここには何が入っているのだろうか、ということで見てみます。bor!bor1 の直後の部分です。プロセスが起動してメモリ上にマップされるときに Windows 側が行う処理と思われるので、実際にどういう数値がセットされるのかは不明です。

 
```
; 00071460 8d1580140700    lea     edx,[BOR!bor1+0x50 (00071480)]

0:000> dd 00071470 
00071470  33fc4d8b fb9ae8cd e58bffff ff8bc35d 
00071480  00000001 00071488 ffffffb8 00000040 
00071490  00071494 00667562 cccccccc cccccccc 
000714a0  cccccccc cccccccc cccccccc cccccccc
```
 
赤字の C3 が bor!bor1 の ret 命令。00071498 から cccccccc が続いているところを見ると、意味を持つ値は 24 バイト分あるようです。便宜上、この 24 バイト分を 6 つの DWORD 値に分け、それぞれ A B C D E F という名前で呼ぶことにします。値はこんな感じ。

 
<font color="#000000">A= 00000001 B= 00071488 C= ffffffb8 D= 00000040 E= 00071494 F= 00667562 </font>

 
さて、ecx, と edx レジスタをセットしたところで、いよいよ \_RTC_CheckStackVars の処理です。適宜注釈を加えたアセンブラがこれ。

 
```
BOR!ILT+125(_RTC_CheckStackVars: 
00071082 e9d9040000      jmp     BOR!_RTC_CheckStackVars (00071560)

BOR!_RTC_CheckStackVars: 
; プロローグ 
00071560 8bff            mov     edi,edi 
00071562 55              push    ebp 
00071563 8bec            mov     ebp,esp 
00071565 51              push    ecx 
00071566 53              push    ebx 
00071567 56              push    esi 
00071568 57              push    edi

; レジスタ初期化 
00071569 33ff            xor     edi,edi 
0007156b 8bf2            mov     esi,edx  --> esi stores BOR!bor+0x50 
0007156d 8bd9            mov     ebx,ecx  --> ebx stores parent's EBP 
0007156f 897dfc          mov     dword ptr [ebp-4],edi --> loop counter 
00071572 393e            cmp     dword ptr [esi],edi 
00071574 7e48            jle     BOR!_RTC_CheckStackVars+0x5e (000715be) 
                                           -> passed 
00071576 eb08            jmp     BOR!_RTC_CheckStackVars+0x20 (00071580)

; ループ開始 
BOR!_RTC_CheckStackVars+0x20: 
00071580 8b4604          mov     eax,dword ptr [esi+4] 
00071583 8b0c38          mov     ecx,dword ptr [eax+edi] 
00071586 817c19fccccccccc cmp     dword ptr [ecx+ebx-4],0CCCCCCCCh  <比較1> 
0007158e 750f            jne     BOR!_RTC_CheckStackVars+0x3f (0007159f) 
                                            -> error

BOR!_RTC_CheckStackVars+0x30: 
00071590 8b543804        mov     edx,dword ptr [eax+edi+4] 
00071594 03d1            add     edx,ecx 
00071596 813c1acccccccc  cmp     dword ptr [edx+ebx],0CCCCCCCCh  <比較2> 
0007159d 7411            je      BOR!_RTC_CheckStackVars+0x50 (000715b0)

; エラールーチン呼び出し 
BOR!_RTC_CheckStackVars+0x3f: 
0007159f 8b4c3808        mov     ecx,dword ptr [eax+edi+8] 
000715a3 8b5504          mov     edx,dword ptr [ebp+4] 
000715a6 51              push    ecx 
000715a7 52              push    edx 
000715a8 e81bfbffff      call    BOR!ILT+195(?_RTC_StackFailureYAXPAXPBDZ) (000710c8) 
000715ad 83c408          add     esp,8

BOR!_RTC_CheckStackVars+0x50: 
000715b0 8b45fc          mov     eax,dword ptr [ebp-4] 
000715b3 40              inc     eax 
000715b4 83c70c          add     edi,0Ch 
000715b7 8945fc          mov     dword ptr [ebp-4],eax 
000715ba 3b06            cmp     eax,dword ptr [esi] 
000715bc 7cc2            jl      BOR!_RTC_CheckStackVars+0x20 (00071580) 
                                           -> loop

; エピローグ 
BOR!_RTC_CheckStackVars+0x5e: 
000715be 5f              pop     edi 
000715bf 5e              pop     esi 
000715c0 5b              pop     ebx 
000715c1 8be5            mov     esp,ebp 
000715c3 5d              pop     ebp 
000715c4 c3              ret 
```
 
数分間見つめていると分かりますが、for 文です。ループ カウンタは ebp-4 の DWORD を使います。ループ回数は、例の bor!bor1+0x50 から始まるメモリ ブロックにある最初の DWORD 値、すなわち &lt;A&gt; です。これは 000715ba の cmp 命令を見ると分かります。esi レジスタには、終始 &lt;A&gt; の値が入っていて、その値とループカウンタを比較しています。&lt;A&gt; は何だったでしょうか。0x00000001 でした。ここがどういうときに 2 以上になるのかは不明です。bor!bor2 でも &lt;A&gt; の値は 1 でした。

 
この関数がスタックの異常を検出している部分は 2 ヶ所あり、それぞれ &lt;比較1&gt; &lt;比較2&gt; と呼ぶことにします。

 
さて、比較1 です。ここからレジスタ地獄・・・。

 
```
00071580 8b4604          mov     eax,dword ptr [esi+4] 
00071583 8b0c38          mov     ecx,dword ptr [eax+edi] 
00071586 817c19fccccccccc cmp     dword ptr [ecx+ebx-4],0CCCCCCCCh  <比較1> 
```
 
まずは ebx レジスタから見ます。これは元を辿ると、bor!bor1 で ecx に保存しておいた ebp レジスタの値です。\_RTC_CheckStackVars の中では ebx レジスタは終始 bor!bor1 における ebp レジスタの値を保持しています。

 
ecx は、00071580 の mov 命令から順番に見ていったほうが分かりやすいです。まず &#x5b;esi+4&#x5d; です。esi はさっき出てきたように &lt;A&gt; です。ということは &#x5b;esi+4&#x5d; は &lt;B&gt; の値です。

 
ここでメモリの値を再掲します。

 
```
; 00071460 8d1580140700    lea     edx,[BOR!bor1+0x50 (00071480)]

0:000> dd 00071470 
00071470  33fc4d8b fb9ae8cd e58bffff ff8bc35d 
00071480  00000001 00071488 ffffffb8 00000040 
00071490  00071494 00667562 cccccccc cccccccc 
000714a0  cccccccc cccccccc cccccccc cccccccc
```
 
赤字で示した &lt;B&gt; の値は、自分の次の DWORD である &lt;C&gt; のアドレスを指しています。ついでに見てみると、青字で示した &lt;E&gt; は &lt;F&gt; のアドレスを指しています。どうしてこういう実装になっているかは不明です。&lt;B&gt; の値が B+4 のアドレス以外を指す場合があるのかどうかも不明です。いずれにしろ、00071580 の mov 命令の実行によって eax レジスタには &lt;C&gt; の「アドレス」が入ります。そして、00071583 にある mov 命令で、eax に入った &lt;C&gt; のアドレスに edi を加えたアドレスの値を ecx レジスタにストアします。edi は初登場です。上のアセンブラにあるように、00071569 で 0 が設定されます。後のほうを見ると、000715b4 で 12 が加算されます。ループカウンタに連動している値で、i*12 の値を示していることが分かります。初回なので edi は 0 です。というか先にも書きましたが、ループ回数は 1 なので、これが最後の実行です。何はともあれ、ecx には &lt;C&gt; の値がセットされました。まとめるとレジスタの値は次のようになります。

 
ebx = bor!bor のスタックベースポインタ <br />
eax = &lt;B&gt; の値 = &lt;C&gt; のアドレス <br />
ecx = &lt;C&gt; + i*12 の値 = i=0 なので &lt;C&gt; の値 <br />
ecx+ebx-4 = bor!bor のスタックベースポインタ + &lt;C&gt; の値 - 4

 
今回の場合、&lt;C&gt; の値は 0xffffffb8 = –72 なので bor!bor のスタックベースから 76 バイト上流にある値が 0xCCCCCCCC 以外の値だとエラーになります。これが &lt;比較1&gt; の処理です。

 
bor!bor のスタックベースから 76 バイト上流にある値とは何でしょうか。ここでヒントになるのが、bor1 関数の C++ における唯一の処理 buf&#x5b;0&#x5d;=0; です。これはアセンブラでも一行です。

 
```
00071458 c645b800        mov     byte ptr [ebp-48h],0
```
 
buf&#x5b;0&#x5d; は ebp-0x48 にあることが分かります。そして 0x48 = 72 です。つまり、&lt;比較1&gt; では ebp-72-4 の値をチェックすることで、マシンスタックの上流側が初期化された 0xCCCCCCCC のままであるかどうかを確認していることが分かります。

 
次に &lt;比較2&gt; についてもレジスタの内容を順番に調べてみます。

 
```
00071590 8b543804        mov     edx,dword ptr [eax+edi+4] 
00071594 03d1            add     edx,ecx 
00071596 813c1acccccccc  cmp     dword ptr [edx+ebx],0CCCCCCCCh  <比較2> 
```
 
ebx = bor!bor のスタックベースポインタ <br />
edx = &#x5b;eax+edi+4&#x5d; + ecx <br />
eax = &lt;C&gt; のアドレス <br />
edi = i*12 <br />
ecx = &lt;C&gt; + i*12 の値

 
edi は 0 なので、&#x5b;eax+edi+4&#x5d; は &lt;D&gt; の値を示していることになります。メモリを調べると、ここは 0x00000040 です。この &lt;D&gt; 値に &lt;C&gt; の値を加算します。すると、0xffffffb8 + 0x00000040 = –8 となります。ということは、&lt;比較2&gt; は、bor1 における ebp-8 の値を調べていることになります。今回の場合、ebp-4 にはクッキーが入っているので、ebp-8 は、クッキーのちょうど上にある DWORD のアドレスです。今回のプログラムで buf&#x5b;0&#x5d; は ebp-48h でした。つまり、buf&#x5b;63&#x5d; は ebp-9 に保存されることになります。ちょうどクッキーと buf&#x5b;63&#x5d; の間の ebp-8 にある DWORD 分が残されるわけです。ここが壊されないようにチェックしているのですね。

 
念のため bor!bor2 も見てみると、確かに &lt;C&gt; + &lt;D&gt; = 0xfffffff8 = –8 になります。

 
```
bor!bor2 
000713da 8d15f8130700    lea     edx,[BOR!bor2+0x68 (000713f8)]

0:000> dd 000713f0 
000713f0  fffffc20 c35de58b 00000001 00071400 
00071400  fffffff0 00000008 0007140c 00667562 
00071410  cccccccc cccccccc cccccccc cccccccc 
```
 
ようやく \_RTC_CheckStackVars の全貌が見えてきました。ローカル変数用に確保されているマシンスタック内のメモリ領域のうち、上流部分を &lt;比較1&gt; 、下流部分を &lt;比較2&gt; でチェックし、初期化状態の 0xCCCCCCCC 以外であればエラーだと判断しているようです。こんなところに CC で埋める意味が隠されていたとは驚きです。

 
ここまで分かると、アセンブラを見るのも楽になってきます。今回、キーとなっていたのは、&lt;C&gt; と &lt;D&gt; にストアされている値でした。これらはともにスタックベースポインタからのオフセット値であり、ローカル変数領域のうち上流側のオフセットが &lt;C&gt; で、下流側のオフセットは &lt;C&gt;+&lt;D&gt; に保存されているわけです。つまり、&lt;D&gt; の値は、ローカル変数の合計サイズを表していることになります。確かに bor!bor1 では &lt;D&gt; = 64 で、bor!bor2 では &lt;D&gt; = 8 です。

 
今回はループが 1 回のみでしたが、仮に 2 回以上ループする場合は、マシンスタックのどの部分を確認することになるでしょうか。もはや簡単ですね。今回は、&lt;C&gt; と &lt;D&gt; を使ってスタックの両端を確認しましたが、ループが 2 順目に入った場合、これらに 12 を加算した値を使います。つまり、A B C D E F の後に G H I という 24 バイトが続くとして、&lt;F&gt; と &lt;G&gt; を使うことになります。複数のスタック領域を同時に調べられるようになっているようです。

 
もしかして、この 24 バイト領域って常識？

