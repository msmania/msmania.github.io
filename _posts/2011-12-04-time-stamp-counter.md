---
layout: post
title: "[Win32] [x86 Assembler] Time Stamp Counter"
date: 2011-12-04 23:05:47.000 +09:00
categories:
- Asm
- Debug
- Windows
tags:
- livekd
- QueryPerformanceCounter
- RDTSC
- windbg
---

久々にアセンブラ関連の記事を書きます。需要はあるのだろうか・・・

 
プログラムの中で、実行時間を計測したくなる場面は多々あります。そんなときはどんな API を使うでしょうか。パッと思いつくのは timeGetTime とか GetTickCount ですかね。GetSystemTime を使う人はあまりいないでしょう。QueryPerformanceCounter というのもあります。

 
timeGetTime 関数 <br />
[http://msdn.microsoft.com/ja-jp/library/cc428795.aspx](http://msdn.microsoft.com/ja-jp/library/cc428795.aspx)

 
GetTickCount 関数 <br />
[http://msdn.microsoft.com/ja-jp/library/cc429827.aspx](http://msdn.microsoft.com/ja-jp/library/cc429827.aspx)

 
GetSystemTime function <br />
[http://msdn.microsoft.com/en-us/library/ms724390(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/ms724390(v=vs.85).aspx)

 
QueryPerformanceCounter function <br />
[http://msdn.microsoft.com/en-us/library/ms644904(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/ms644904(v=vs.85).aspx)

 
どれを使ってもいいわけですが、とにかく厳密に測りたい場合や、一瞬で終わる処理を計測したい場合には、これらの API を使うと関数呼び出し時の時間のロスが無視できなくなります。もちろん、その分のロスを計算して結果から引くというのが普通ですが、アセンブラを使うという手も一応あります。

 
それが、RDTSC (=Read Time Stamp Counter) 命令です。詳細は IA-32 の仕様書に書いてありますが、RDTSC を実行すると、1 命令で Tick 値を取得することができます。しかも単位はクロック単位です。Pentium 以降の IA-32 アーキテクチャーでは、プロセッサーごとに TSC (=Time Stamp Counter) という 64bit カウンターが MSR (マシン固有レジスタ) に含まれており、RDTSC はこれを EDX:EAX レジスターにロードする命令です。

 
こんなプログラムを書いてみました。後でいろいろ遊ぶ伏線として、幾つかの関数を読んでいます。

 
なお、開発環境、実行環境は同じで、こんな感じです。

 
- OS: Windows 7 SP1 (x64)
- IDE: Visual Studio 2010 SP1
- CPU: Core i3 530 2.93GHz （予算がないのだ）

 
```
// 
// main.cpp 
//

#include <Windows.h> 
#include <stdio.h>


__int64 __fastcall rdtsc() { 
    __asm { 
        rdtsc 
    } 
}

__inline __int64 rdtsc_inline() { 
    __asm { 
        rdtsc 
    } 
}

void rdtsc_x86(long long int *ll) { 
    __asm { 
        rdtsc 
        mov ecx, [ll] 
        mov [ecx], eax 
        mov [ecx+4], edx 
    } 
}

int wmain(int argc, wchar_t *argv[]) { 
    if ( argc<2 ) 
        return ERROR_INVALID_PARAMETER; 
    
    LARGE_INTEGER ll, ll1, ll2, ll3;

    wprintf(L"-----\n");

    DWORD wait= _wtoi(argv[1]); 
    while (1) { 
        QueryPerformanceCounter(&ll); 
        ll1.QuadPart= rdtsc(); 
        ll2.QuadPart= rdtsc_inline(); 
        rdtsc_x86((long long*)&ll3);

        wprintf(L"QPC:  0x%08x`%08x\n", ll.HighPart, ll.LowPart); 
        wprintf(L"ASM1: 0x%08x`%08x\n", ll1.HighPart, ll1.LowPart); 
        wprintf(L"ASM2: 0x%08x`%08x\n", ll2.HighPart, ll2.LowPart); 
        wprintf(L"ASM3: 0x%08x`%08x\n", ll3.HighPart, ll3.LowPart); 
    
        wprintf(L"--\n"); 
        Sleep(wait); 
    }

    return 0; 
} 
```
 
実行すると、こんな感じです。

 
```
E:\Visual Studio 2010\Projects\asmtest\Release> asmtest 1000 
----- 
QPC:  0x0000000a`cdfd9d44 
ASM1: 0x00002b37`f6751321 
ASM2: 0x00002b37`f675135e 
ASM3: 0x00002b37`f6751394 
-- 
QPC:  0x0000000a`ce28d20e 
ASM1: 0x00002b38`a3483a0d 
ASM2: 0x00002b38`a3483a4a 
ASM3: 0x00002b38`a3483a80 
-- 
QPC:  0x0000000a`ce54577b 
ASM1: 0x00002b39`515df112 
ASM2: 0x00002b39`515df142 
ASM3: 0x00002b39`515df172 
-- 
QPC:  0x0000000a`ce802c82 
ASM1: 0x00002b3a`00b20afe 
ASM2: 0x00002b3a`00b20b2e 
ASM3: 0x00002b3a`00b20b5e 
--
```
 
ASM1 の結果に絞って間隔を計算すると、ACD326EC, AE15B705, AF5419EC となり、平均値は AE14529F = 2,920,567,455 となります。プロセッサーのクロックが 2.93GHz なので、RDTSC は確かにクロック単位の値を取得しています。

 
サンプルでは 3 つの関数を書きました。

 
- rdtsc ・・・ \__fastcall 呼び出し規約
- rdtsc_inline ・・・ \__inline でインライン展開
- rdtsc_x86 ・・・ パラメーター渡し

 
ソースコードを既定の Release ビルド設定でビルドすると、rdtsc_inline だけでなく rdtsc_x86 もインライン展開されます。rdtsc に \__fastcall をつけたのはインライン展開を防ぐためで、\__stdcall や \__cdecl では展開されてしまいます。

 
コンパイルされた関数のアセンブラを見てみます。

 
```
0:000> uf asmtest!rdtsc 
asmtest!rdtsc [e:\visual studio 2010\projects\asmtest\main.cpp @ 9]: 
    9 011e1000 0f31            rdtsc 
   13 011e1002 c3              ret


0:000> uf asmtest!wmain 
asmtest!wmain [e:\visual studio 2010\projects\asmtest\main.cpp @ 30]: 
   30 011e1010 55              push    ebp 
   30 011e1011 8bec            mov     ebp,esp 
   30 011e1013 83e4f8          and     esp,0FFFFFFF8h 
   30 011e1016 83ec2c          sub     esp,2Ch 
   31 011e1019 837d0802        cmp     dword ptr [ebp+8],2 
   31 011e101d 53              push    ebx 
   31 011e101e 56              push    esi 
   31 011e101f 57              push    edi 
   31 011e1020 7d0c            jge     asmtest!wmain+0x1e (011e102e)

asmtest!wmain+0x12 [e:\visual studio 2010\projects\asmtest\main.cpp @ 55]: 
   55 011e1022 5f              pop     edi 
   55 011e1023 5e              pop     esi 
   55 011e1024 b857000000      mov     eax,57h 
   55 011e1029 5b              pop     ebx 
   55 011e102a 8be5            mov     esp,ebp 
   55 011e102c 5d              pop     ebp 
   55 011e102d c3              ret

asmtest!wmain+0x1e [e:\visual studio 2010\projects\asmtest\main.cpp @ 36]: 
   36 011e102e 8b359c201e01    mov     esi,dword ptr [asmtest!_imp__wprintf (011e209c)] 
   36 011e1034 68f4201e01      push    offset asmtest!`string' (011e20f4) 
   36 011e1039 ffd6            call    esi 
   38 011e103b 8b450c          mov     eax,dword ptr [ebp+0Ch] 
   38 011e103e 8b4804          mov     ecx,dword ptr [eax+4] 
   38 011e1041 51              push    ecx 
   38 011e1042 ff15a0201e01    call    dword ptr [asmtest!_imp___wtoi (011e20a0)] 
   38 011e1048 83c408          add     esp,8 
   38 011e104b 89442414        mov     dword ptr [esp+14h],eax 
   38 011e104f 90              nop

asmtest!wmain+0x40 [e:\visual studio 2010\projects\asmtest\main.cpp @ 40]: 
   40 011e1050 8d542418        lea     edx,[esp+18h] 
   40 011e1054 52              push    edx 
   40 011e1055 ff1500201e01    call    dword ptr [asmtest!_imp__QueryPerformanceCounter (011e2000)] 
   41 011e105b e8a0ffffff      call    asmtest!rdtsc (011e1000) 
   41 011e1060 8bd8            mov     ebx,eax 
   41 011e1062 8954242c        mov     dword ptr [esp+2Ch],edx 
   42 011e1066 0f31            rdtsc 
   42 011e1068 8bf8            mov     edi,eax 
   43 011e106a 8d442420        lea     eax,[esp+20h] 
   43 011e106e 89542434        mov     dword ptr [esp+34h],edx 
   43 011e1072 89442410        mov     dword ptr [esp+10h],eax 
   43 011e1076 0f31            rdtsc 
   43 011e1078 8b4c2410        mov     ecx,dword ptr [esp+10h] 
   43 011e107c 8901            mov     dword ptr [ecx],eax 
   43 011e107e 895104          mov     dword ptr [ecx+4],edx 
   45 011e1081 8b4c2418        mov     ecx,dword ptr [esp+18h] 
   45 011e1085 8b54241c        mov     edx,dword ptr [esp+1Ch] 
   45 011e1089 51              push    ecx 
   45 011e108a 52              push    edx 
   45 011e108b 6804211e01      push    offset asmtest!`string' (011e2104) 
   45 011e1090 ffd6            call    esi 
   46 011e1092 8b442438        mov     eax,dword ptr [esp+38h] 
   46 011e1096 53              push    ebx 
   46 011e1097 50              push    eax 
   46 011e1098 682c211e01      push    offset asmtest!`string' (011e212c) 
   46 011e109d ffd6            call    esi 
   47 011e109f 8b4c244c        mov     ecx,dword ptr [esp+4Ch] 
   47 011e10a3 57              push    edi 
   47 011e10a4 51              push    ecx 
   47 011e10a5 6854211e01      push    offset asmtest!`string' (011e2154) 
   47 011e10aa ffd6            call    esi 
   48 011e10ac 8b542444        mov     edx,dword ptr [esp+44h] 
   48 011e10b0 8b442448        mov     eax,dword ptr [esp+48h] 
   48 011e10b4 52              push    edx 
   48 011e10b5 50              push    eax 
   48 011e10b6 687c211e01      push    offset asmtest!`string' (011e217c) 
   48 011e10bb ffd6            call    esi 
   50 011e10bd 68a4211e01      push    offset asmtest!`string' (011e21a4) 
   50 011e10c2 ffd6            call    esi 
   51 011e10c4 8b4c2448        mov     ecx,dword ptr [esp+48h] 
   51 011e10c8 83c434          add     esp,34h 
   51 011e10cb 51              push    ecx 
   51 011e10cc ff1504201e01    call    dword ptr [asmtest!_imp__Sleep (011e2004)] 
   52 011e10d2 e979ffffff      jmp     asmtest!wmain+0x40 (011e1050) 
```
 
関数 rdtsc は、RDTSC を実行するだけの関数になっています。インライン展開された関数は茶色と紫色で示しています。戻り値が EDX:EAX であることが考慮されて、うまく動くようになっています。edx レジスタが考慮されないのかと予想していましたが、インライン展開されても 64bit の戻り値に影響はないようです。

 
さて、次に QueryPerformanceCounter に注目してみます。上述の MSDN の説明を見ると、こんな注意書きがあります。

 
```
On a multiprocessor computer, it should not matter which processor is called. However, you can get different results on different processors due to bugs in the basic input/output system (BIOS) or the hardware abstraction layer (HAL). To specify processor affinity for a thread, use the SetThreadAffinityMask function.
```
 
「マルチ プロセッサーでも使えますよ。でも BIOS や HAL にバグがあるとプロセッサー毎に異なる結果が返ってくることがありますよ。」 ということです。BIOS や HAL のバグって言われても・・・既知のバグなら直しとけよ、としか言いようがありません。QueryPerformanceCounter を使うときは SetThreadAffinityMask を必ず使えってことなのでしょうか。微妙です。

 
少なくとも、QueryPerformanceCounter にはマルチプロセッサーを考慮した実装がなされていることが分かります。TSC カウンターはプロセッサー毎なので、先ほどの RDTSC 命令を呼び出す関数は、プロセッサー毎に異なる値を返します。よって、途中で割り込みが入って実行 CPU が変わることが予想される場合には使えません。

 
デバッグしていて気づきましたが、実は QueryPerformanceCounter は内部的に RDTSC を呼び出しています。これを確かめてみます。

 
```
0:000> x kernel32!QueryPerformanceCounter 
76921732 kernel32!QueryPerformanceCounter = <no type information> 
0:000> u 76921732 
kernel32!QueryPerformanceCounter: 
76921732 ff25d40d9276    jmp     dword ptr [kernel32!_imp__QueryPerformanceCounter (76920dd4)] 
76921738 90              nop 
76921739 90              nop 
7692173a 90              nop 
7692173b 90              nop 
7692173c 90              nop 
kernel32!IsDBCSLeadByte: 
7692173d ff2568079276    jmp     dword ptr [kernel32!_imp__IsDBCSLeadByte (76920768)] 
76921743 90              nop 
0:000> dd 76920dd4 l1 
76920dd4  775e8884 
0:000> ln 775e8884 
(775e8884)   ntdll!RtlQueryPerformanceCounter   |  (775e88e2)   ntdll!EtwEventEnabled 
Exact matches: 
    ntdll!RtlQueryPerformanceCounter = <no type information>
```
 
QueryPerformanceCounter は Kernel32.dll の関数ですが、これは単なるラッパーで、実体は ntdll.dll に実装されている RtlQueryPerformanceCounter であることが分かります。この関数のアセンブラを見てみます。

 
```
0:000> uf ntdll!RtlQueryPerformanceCounter 
ntdll!RtlQueryPerformanceCounter: 
775e8884 8bff            mov     edi,edi 
775e8886 55              push    ebp 
775e8887 8bec            mov     ebp,esp 
775e8889 51              push    ecx 
775e888a 51              push    ecx 
775e888b f605ed02fe7f01  test    byte ptr [SharedUserData+0x2ed (7ffe02ed)],1 
775e8892 0f840bf50400    je      ntdll!RtlQueryPerformanceCounter+0x55 (77637da3)

ntdll!RtlQueryPerformanceCounter+0x10: 
775e8898 56              push    esi

ntdll!RtlQueryPerformanceCounter+0x11: 
775e8899 8b0db803fe7f    mov     ecx,dword ptr [SharedUserData+0x3b8 (7ffe03b8)] 
775e889f 8b35bc03fe7f    mov     esi,dword ptr [SharedUserData+0x3bc (7ffe03bc)] 
775e88a5 a1b803fe7f      mov     eax,dword ptr [SharedUserData+0x3b8 (7ffe03b8)] 
775e88aa 8b15bc03fe7f    mov     edx,dword ptr [SharedUserData+0x3bc (7ffe03bc)] 
775e88b0 3bc8            cmp     ecx,eax 
775e88b2 75e5            jne     ntdll!RtlQueryPerformanceCounter+0x11 (775e8899)

ntdll!RtlQueryPerformanceCounter+0x2c: 
775e88b4 3bf2            cmp     esi,edx 
775e88b6 75e1            jne     ntdll!RtlQueryPerformanceCounter+0x11 (775e8899)

ntdll!RtlQueryPerformanceCounter+0x30: 
775e88b8 0f31            rdtsc 
775e88ba 03c1            add     eax,ecx 
775e88bc 0fb60ded02fe7f  movzx   ecx,byte ptr [SharedUserData+0x2ed (7ffe02ed)] 
775e88c3 13d6            adc     edx,esi 
775e88c5 c1e902          shr     ecx,2 
775e88c8 e893ffffff      call    ntdll!_aullshr (775e8860) 
775e88cd 8b4d08          mov     ecx,dword ptr [ebp+8] 
775e88d0 8901            mov     dword ptr [ecx],eax 
775e88d2 895104          mov     dword ptr [ecx+4],edx 
775e88d5 5e              pop     esi

ntdll!RtlQueryPerformanceCounter+0x4e: 
775e88d6 33c0            xor     eax,eax 
775e88d8 40              inc     eax

ntdll!RtlQueryPerformanceCounter+0x51: 
775e88d9 c9              leave 
775e88da c20400          ret     4

ntdll!RtlQueryPerformanceCounter+0x55: 
77637da3 8d45f8          lea     eax,[ebp-8] 
77637da6 50              push    eax 
77637da7 ff7508          push    dword ptr [ebp+8] 
77637daa e8717ff9ff      call    ntdll!ZwQueryPerformanceCounter (775cfd20) 
77637daf 85c0            test    eax,eax 
77637db1 7d0d            jge     ntdll!RtlQueryPerformanceCounter+0x6f (77637dc0)

ntdll!RtlQueryPerformanceCounter+0x65: 
77637db3 50              push    eax 
77637db4 e89549fdff      call    ntdll!RtlSetLastWin32ErrorAndNtStatusFromNtStatus (7760c74e)

ntdll!RtlQueryPerformanceCounter+0x6b: 
77637db9 33c0            xor     eax,eax 
77637dbb e9190bfbff      jmp     ntdll!RtlQueryPerformanceCounter+0x51 (775e88d9)

ntdll!RtlQueryPerformanceCounter+0x6f: 
77637dc0 837df800        cmp     dword ptr [ebp-8],0 
77637dc4 0f850c0bfbff    jne     ntdll!RtlQueryPerformanceCounter+0x4e (775e88d6)

ntdll!RtlQueryPerformanceCounter+0x75: 
77637dca 837dfc00        cmp     dword ptr [ebp-4],0 
77637dce 0f85020bfbff    jne     ntdll!RtlQueryPerformanceCounter+0x4e (775e88d6)

ntdll!RtlQueryPerformanceCounter+0x7b: 
77637dd4 6a78            push    78h 
77637dd6 e814a5f9ff      call    ntdll!RtlSetLastWin32Error (775d22ef) 
77637ddb ebdc            jmp     ntdll!RtlQueryPerformanceCounter+0x6b (77637db9) 
```
 
RDTSC 命令がありました。さっきのサンプルプログラムでこの部分にブレークポイントを貼ると、確かに RDTSC が実行されていることが分かります。

 
```
0:002> bp 775e88b8 
0:002> g 
Breakpoint 0 hit 
eax=00000000 ebx=14c34d78 ecx=00000000 edx=00000000 esi=00000000 edi=14c34da8 
eip=775e88b8 esp=0045fe80 ebp=0045fe8c iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00000246 
ntdll!RtlQueryPerformanceCounter+0x30: 
775e88b8 0f31            rdtsc 
0:000> k 
ChildEBP RetAddr 
0045fe8c 00bb105b ntdll!RtlQueryPerformanceCounter+0x30 
0045fecc 6a19263d asmtest!wmain+0x4b 
0045ff18 7692339a MSVCR100!_initterm+0x13 
0045ff24 775e9ed2 kernel32!BaseThreadInitThunk+0xe 
0045ff64 775e9ea5 ntdll!__RtlUserThreadStart+0x70 
0045ff7c 00000000 ntdll!_RtlUserThreadStart+0x1b
```
 
プログラムの実行結果を見ると分かりますが、QueryPerformanceCounter (以下 QPC と表記) と RDTSC の戻り値は全然違います。単位も異なっているようです。QPC の周波数は QueryPerformanceFrequency API で取得することができます。この環境で調べてみると、0x2BD8E6 = 2,852,116 となりました。クロックの 1/1000 ぐらいです。

 
QPC が RDTSC の値を元にしていることは確認できているので、何らかの計算をして周波数を調整していることになります。それが RtlQueryPerformanceCounter のアセンブラに隠されています。RDTSC の後のアセンブラをもう一度よく見てみます。

 
```
ntdll!RtlQueryPerformanceCounter+0x30: 
775e88b8 0f31            rdtsc 
775e88ba 03c1            add     eax,ecx 
775e88bc 0fb60ded02fe7f  movzx   ecx,byte ptr [SharedUserData+0x2ed (7ffe02ed)] 
775e88c3 13d6            adc     edx,esi 
775e88c5 c1e902          shr     ecx,2 
775e88c8 e893ffffff      call    ntdll!_aullshr (775e8860) 
775e88cd 8b4d08          mov     ecx,dword ptr [ebp+8] 
775e88d0 8901            mov     dword ptr [ecx],eax 
775e88d2 895104          mov     dword ptr [ecx+4],edx 
775e88d5 5e              pop     esi

ntdll!RtlQueryPerformanceCounter+0x4e: 
775e88d6 33c0            xor     eax,eax 
775e88d8 40              inc     eax

ntdll!RtlQueryPerformanceCounter+0x51: 
775e88d9 c9              leave 
775e88da c20400          ret     4
```
 
_anullshr という関数が怪しいですね。これを見てみます。

 
```
0:000> uf ntdll!_aullshr 
ntdll!_aullshr: 
775e8860 80f940          cmp     cl,40h 
775e8863 7315            jae     ntdll!_aullshr+0x1a (775e887a)

ntdll!_aullshr+0x5: 
775e8865 80f920          cmp     cl,20h 
775e8868 7306            jae     ntdll!_aullshr+0x10 (775e8870)

ntdll!_aullshr+0xa: 
775e886a 0fadd0          shrd    eax,edx,cl 
775e886d d3ea            shr     edx,cl 
775e886f c3              ret

ntdll!_aullshr+0x10: 
775e8870 8bc2            mov     eax,edx 
775e8872 33d2            xor     edx,edx 
775e8874 80e11f          and     cl,1Fh 
775e8877 d3e8            shr     eax,cl 
775e8879 c3              ret

ntdll!_aullshr+0x1a: 
775e887a 33c0            xor     eax,eax 
775e887c 33d2            xor     edx,edx 
775e887e c3              ret
```
 
eax と edx をcl だけ右シフトしています。これで QPC の結果が小さくなるわけです。 <br />
では ECX レジスタはどこから来ていたでしょうか。

 
```
775e88bc 0fb60ded02fe7f  movzx   ecx,byte ptr [SharedUserData+0x2ed (7ffe02ed)] 
775e88c3 13d6            adc     edx,esi 
775e88c5 c1e902          shr     ecx,2 
775e88c8 e893ffffff      call    ntdll!_aullshr (775e8860) 
```
 
SharedUserData から来ています。これは共有ユーザーモードページと呼ばれるデータで、デバッガー コマンドの !kuser で概要を表示できます。詳しくはデバッガーのヘルプを参照して下さい。

 
```
0:000> !kuser 
_KUSER_SHARED_DATA at 7ffe0000 
TickCount:    fa00000 * 000000000011d55a (0:05:04:21.406) 
TimeZone Id: 0 
ImageNumber Range: [8664 .. 8664] 
Crypto Exponent: 0 
SystemRoot: 'C:\Windows'
```
 
ここでちょっとしたトリックが必要になります。 <br />
実はユーザーモード側から \_KUSER_SHARED_DATA 構造体を見ても、全メンバーを見ることができません。そこで、カーネル モードから見る必要があります。同じ環境で livekd を使った出力がこれです。

 
```
Microsoft Windows [Version 6.1.7601] 
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.

E:\Visual Studio 2010\Projects\asmtest\Release>livekd

LiveKd v5.0 - Execute kd/windbg on a live system 
Sysinternals - www.sysinternals.com 
Copyright (C) 2000-2010 Mark Russinovich and Ken Johnson

Launching c:\debuggers\amd64\kd.exe:

Microsoft (R) Windows Debugger Version 6.12.0002.633 AMD64 
Copyright (c) Microsoft Corporation. All rights reserved.


Loading Dump File [C:\Windows\livekd.dmp] 
Kernel Complete Dump File: Full address space is available

Comment: 'LiveKD live system view' 
Symbol search path is: srv*c:\websymbols*http://msdl.microsoft.com/download/symbols 
Executable search path is: 
Windows 7 Kernel Version 7601 (Service Pack 1) MP (4 procs) Free x64 
Product: WinNt, suite: TerminalServer SingleUserTS 
Built by: 7601.17640.amd64fre.win7sp1_gdr.110622-1506 
Machine Name: 
Kernel base = 0xfffff800`03a63000 PsLoadedModuleList = 0xfffff800`03ca8670 
Debug session time: Sun Feb 13 11:34:57.897 17420 (UTC + 9:00) 
System Uptime: 0 days 5:44:06.294 
Loading Kernel Symbols 
............................................................... 
................................................................ 
.......................................... 
Loading User Symbols 
............ 
Loading unloaded module list 
........Unable to enumerate user-mode unloaded modules, NTSTATUS 0xC0000147 
0: kd> !kuser 
*** ERROR: Module load completed but symbols could not be loaded for LiveKdD.SYS 
_KUSER_SHARED_DATA at fffff78000000000 
TickCount:    fa00000 * 0000000000142992 (0:05:44:06.281) 
TimeZone Id: 0 
ImageNumber Range: [8664 .. 8664] 
Crypto Exponent: 0 
SystemRoot: 'C:\Windows' 
0: kd> dt _KUSER_SHARED_DATA fffff78000000000 
ntdll!_KUSER_SHARED_DATA 
   +0x000 TickCountLowDeprecated : 0 
（省略） 
   +0x2ed TscQpcData       : 0x29 ')' 
   +0x2ed TscQpcEnabled    : 0y1 
   +0x2ed TscQpcSpareFlag  : 0y0 
   +0x2ed TscQpcShift      : 0y001010 (0xa) 
   +0x2ee TscQpcPad        : [2]  "" 
（省略） 
```
 
ntdll!_aullshr に渡されていたデータは SharedUserData+0x2ed でした。+2ed のところには、TscQpc*** という、まさに TSC と QPC に関連した値が保存されていることが分かります。

 
\_KUSER_SHARED_DATA は公開されている構造体なので、Windows Driver Kit に含まれる ntddk.h で定義を確認することができます。それがこれです。

 
```
// 
// The following byte is consumed by the user-mode performance counter 
// routines to improve latency when the source is the processor's cycle 
// counter. 
//

union { 
    UCHAR TscQpcData; 
    struct { 
        UCHAR TscQpcEnabled   : 1; 
        UCHAR TscQpcSpareFlag : 1; 
        UCHAR TscQpcShift     : 6; 
    } DUMMYSTRUCTNAME; 
} DUMMYUNIONNAME;
```
 
ビットフィールドになっていて、3 つのフィールドがあります。名前から推測できてしまいますが、一応アセンブラで確認していきましょう。ntdll!RtlQueryPerformanceCounter において、ntdll!_aullshr を呼び出す前に shr ecx,2 という命令で 2 ビット右シフトさせます。これは何かというと、TscQpcData を 2 ビット右シフト、つまり、ビットフィールドの TscQpcShift を取得していることになります。で、カーネル デバッガーの出力結果を見るとこの値は TscQpcShift : 0y001010 (0xa) 、つまり 10 です。これで謎が解けました。

 
RDTSC の結果と QPC の結果が 1000 倍ぐらい違っていましたが、これは TscQpcShift の値だけ右シフトした値、つまり 1024 倍異なっていたことになります。これで QPC の仕組みは大体分かりました。

 
もう一度 ntdll!RtlQueryPerformanceCounter のアセンブラに戻ります。ntdll!RtlQueryPerformanceCounter+0x51 の後に ret 命令があって、ここで RDTSC を右シフトした値を返して終わるわけですが、関数自体は続いています。これはいつ呼ばれるでしょうか。それが関数のアタマにある、この部分です。

 
```
775e888b f605ed02fe7f01  test    byte ptr [SharedUserData+0x2ed (7ffe02ed)],1 
775e8892 0f840bf50400    je      ntdll!RtlQueryPerformanceCounter+0x55 (77637da3) 
```
 
また SharedUserData の値を使っています。+2ed なので TscQpcData の値ですが、今度は最下位ビットを test 命令で調べています。つまり TscQpcEnabled です。これが 0 の場合は、RDTSC が使われずに、ntdll!ZwQueryPerformanceCounter が呼ばれることになります。つまりカーネル モードの関数が呼ばれます。この関数が何を使っているのかについては、ここでは触れません。

