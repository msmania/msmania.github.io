---
layout: post
title: "16bit programming in Windows 95"
date: 2015-10-25 23:14:17.000 -07:00
categories:
- Asm
- Windows
tags:
- MASM
---

前回 MS-DOS で QuickAssembler を動かしてみたのはいいものの、32bit のアセンブリ言語をコンパイルできないことに気づいてしまったので、結局 Windows を入れることに。

 
しかし Hyper-V で Windows 95 のインストーラーを実行すると、仮想マシンがハングしてしまう現象に遭遇。Windows 95 のインストーラーはマウスに対応しているため、このハングの原因はおそらく MS-DOS の MOUSE コマンドを実行するとハングしてしまう現象と同じ気がします。Hyper-V 使えないじゃん、ということで ESXi 5.1 で試してみたら、こちらは問題なし。やっぱり開発用途には VMware に軍配が上がります。

 
OS のインストール後、開発環境として最初は何も考えずに Visual C++ 6.0 を入れてみたのですが、Visual C++ 6.0 は 16bit アプリケーションの開発に対応していなかった、ということに初めて気づき、以下の 2 つを入れ直しました。何とも世話の焼ける・・

 
- VIsual C++ 1.52
- MASM 6.11

 
セットアップ中の画面の一部を紹介します。まずは Windows 95。実に懐かしい。

 
![]({{site.assets_url}}2015-10-25-image31.png) ![]({{site.assets_url}}2015-10-25-image32.png)

 
![]({{site.assets_url}}2015-10-25-image33.png)

 
十数年ぶりに触ってみると、今では当然のように使っている機能がまだ実装されていなくて驚きます。例えば・・

 
- コマンド プロンプトが cmd.exe じゃなくて command.com
- コマンド プロンプトで矢印キー、 Tab キーが使えない
- コマンド プロンプトで、右クリックを使ってクリップボードからの貼り付けができない
- メモ帳で Ctrl+A、Ctrl+S が使えない
- エクスプローラーにアドレスバーがない

 
以下は Visual C++ と MASM のインストール画面を抜粋したもの。

 
![]({{site.assets_url}}2015-10-25-image34.png) ![]({{site.assets_url}}2015-10-25-image35.png)

 
MASM 6.11 のインストーラーは CUI。

 
![]({{site.assets_url}}2015-10-25-image36.png)

 
DOS, Windows, WIndows NT の全部に対応しているらしい。

 
![]({{site.assets_url}}2015-10-25-image37.png)

 
MASM はいろいろと注意事項が多い。

 
![]({{site.assets_url}}2015-10-25-image38.png) ![]({{site.assets_url}}2015-10-25-image39.png)

 
![]({{site.assets_url}}2015-10-25-image40.png)

 
インストールが完了したら、環境変数の設定を行なうためのバッチ ファイルを作ります。サンプルのスクリプトがインストールされているので、それを組み合わせるだけです。

 
```
@echo off 
set PATH=C:\MSVC\BIN;C:\MASM611\BIN;C:\MASM611\BINR;%PATH% 
set INCLUDE=C:\MSVC\INCLUDE;C:\MSVC\MFC\INCLUDE;C:\MASM611\INCLUDE;%INCLUDE% 
set LIB=C:\MSVC\LIB;C:\MSVC\MFC\LIB;C:\MASM611\LIB;%LIB% 
set INIT=C:\MSVC;C:\MASM611\INIT;%INIT% 
```
 
MASM、VC++ ともに NMAKE を持っていますが、VC++ 1.52 に入っている NMAKE のバージョンが新しかったので、VC++ を先頭にしました。

 
環境ができたところで、今回は 「はじめて読む 486」 の例題を試してみます。本文に掲載されている例題は、Borland C++ 3.1/Turbo Assembler 3.2 用の文法になっているため、細かいところは VC++/MASM 用に書き換えないといけません。というわけでこんな感じ。

 
まずは C ソースファイル main.c。

 
```
#include <stdlib.h> 
#include <stdio.h>

extern short GetVer(); 
extern void RealToProto(); 
extern void ProtoToReal();

void main(int argc, char **argv) { 
    printf("Hello, MS-DOS%d!\n", GetVer()); 
    RealToProto(); 
    ProtoToReal(); 
    printf("Successfully returned from Protected mode.\n"); 
    exit(0); 
} 
```
 
次がアセンブリ utils.asm。

 
```
.386 
.MODEL small 
.code

;* GetVer - Gets DOS version. 
;* 
;* Shows:   DOS Function - 30h (Get MS-DOS Version Number) 
;* 
;* Params:  None 
;* 
;* Return:  Short integer of form (M*100)+m, where M is major 
;*          version number and m is minor version, or integer 
;*          is 0 if DOS version earlier than 2.0

_GetVer  PROC

        mov     ah, 30h                 ; DOS Function 30h 
        int     21h                     ; Get MS-DOS version number 
        .IF     al == 0                 ; If version, version 1 
        sub     ax, ax                  ; Set AX to 0 
        .ELSE                           ; Version 2.0 or higher 
        sub     ch, ch                  ; Zero CH and move minor 
        mov     cl, ah                  ;   version number into CX 
        mov     bl, 100 
        mul     bl                      ; Multiply major by 10 
        add     ax, cx                  ; Add minor to major*10 
        .ENDIF 
        ret                             ; Return result in AX

_GetVer  ENDP

public _RealToProto 
_RealToProto    proc    near 
                push bp 
                mov bp, sp 
                ; 
                mov eax, cr0 
                or eax, 1 
                mov cr0, eax 
                ; 
                jmp flush_q1 
flush_q1: 
                pop bp 
                ret 
_RealToProto    endp

public _ProtoToReal 
_ProtoToReal    proc    near 
                push bp 
                mov bp, sp 
                ; 
                mov eax, cr0 
                and eax, 0fffffffeh 
                mov cr0, eax 
                ; 
                jmp flush_q2 
flush_q2: 
                pop bp 
                ret 
_ProtoToReal    endp

        END 
```
  
最後に Makefile。QuickC のときよりは現在の書式に近づきましたが、相変わらずリンカへの入力の渡し方がおかしい。

 
```
PROJ = TEST 
USEMFC = 0 
CC = cl 
ML = ml 
CFLAGS =/nologo /W3 /O /G3 
LFLAGS =/NOLOGO /ONERROR:NOEXE 
AFLAGS = 
LIBS = 
MAPFILE =nul 
DEFFILE =nul

all: $(PROJ).EXE

clean: 
    @del *.obj 
    @del *.exe 
    @del *.bnd 
    @del *.pdb

UTILS.OBJ: UTILS.ASM 
    $(ML) $(AFLAGS) /c UTILS.ASM $@

MAIN.OBJ: MAIN.C 
    $(CC) $(CFLAGS) /c MAIN.C $@

$(PROJ).EXE:: MAIN.OBJ UTILS.OBJ 
    echo >NUL @<<$(PROJ).CRF 
MAIN.OBJ + 
UTILS.OBJ 
$(PROJ).EXE 
$(MAPFILE) 
$(LIBS) 
$(DEFFILE) 
; 
<< 
    link $(LFLAGS) @$(PROJ).CRF 
    @copy $(PROJ).CRF $(PROJ).BND 
```
 
プログラムはとても単純で、前回と同様に int 21 で DOS のバージョンを表示してから、コントロール レジスタ 0 の PE ビットを変更して特権レベルを変更し、また戻ってくる、というものです。ただし上記のコードでは、C、アセンブリのコンパイルは通るものの、以下のリンクエラーが出てうまくいきません。

 
```
UTILS.OBJ(UTILS.ASM) : fatal error L1123: _TEXT : segment defined both 16- and 32-bit
```

![]({{site.assets_url}}2015-10-25-image41.png)

ここで 2 時間ぐらいハマりました。リンクエラーの原因は単純で、VC++ 1.52 のコンパイラは 16bit コードを生成しているのに対し、MASM は 32bit コードを生成しているためです。エラー メッセージの通り、16bit と 32bit の 2 つのコード セグメントを含む実行可能ファイルを生成できないためのエラーです。

 
このプログラムで確かめたいのは、16bit リアル モードから PE ビットを変更してプロテクト モードに移行し、再び 16bit リアル モードに戻ってくる動作です。したがって生成されるべき EXE は 16bit アプリケーションであり、VC++ の生成する main.obj は問題なく、MASM が 16bit コードを生成するように指定したいところです。

 
MASM が 32bit コードを生成する理由は、utils.asm の先頭の .386 で CPU のアーキテクチャを指定しているためです。これがないと、32bit レジスタの eax などが使えません。CPU のアーキテクチャを指定したことで、その後の .code セグメント指定が自動的に 32bit コード セグメントになってしまっています。

 
32bit 命令を有効にしつつ、セグメントは 16bit で指定する方法が見つかればよいわけです。NASM や GNU Assembler だと簡単に指定できるようですが・・いろいろと探して、以下のフォーラムを見つけました。10 年前に同じ悩みを抱えている人がいた！

 
Link Fatal Error 1123 <br />
[http://www.masmforum.com/board/index.php?PHPSESSID=786dd40408172108b65a5a36b09c88c0&topic=1382.0](http://www.masmforum.com/board/index.php?PHPSESSID=786dd40408172108b65a5a36b09c88c0&topic=1382.0)

 
ファイルの先頭で .MODEL と CPU 指定を入れ替えればいいらしい。こんなん知らんて。

 
```
.MODEL small 
.386 
.code

;* GetVer - Gets DOS version. 
;* 
;* Shows:   DOS Function - 30h (Get MS-DOS Version Number) 
;* 
;* Params:  None 
;* 
;* Return:  Short integer of form (M*100)+m, where M is major 
;*          version number and m is minor version, or integer 
;*          is 0 if DOS version earlier than 2.0

_GetVer  PROC

以下、ずっと同じなので省略 
```
 
これで無事ビルドが成功し、実行できました。文字が出力されているだけなので、本当にプロテクト モードに変わったかどうか疑わしくはありますが、まあ大丈夫でしょう。16bit の道は険しい。

 
![]({{site.assets_url}}2015-10-25-image42.png)

