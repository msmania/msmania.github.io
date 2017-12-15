---
layout: post
title: "[Win32] [Asm] Race condition between bit fields"
date: 2013-11-30 10:53:42.000 +09:00
categories:
- Asm
- C/C++
- Debug
- Windows
tags:
- bit field
- race condition
---

久々にプログラミング ネタを投稿します。

 
サーバー系のソフトウェアが何らかのトラブルを引き起こした際、その原因がスレッド間の処理の競合で、現象の再現に苦労することがよくあります。race condition や timing issue と呼ばれる現象には非常に苦労させられます。最近の仕事で race condition に遭遇したのですが、ユーザーモードの単純なプログラムを書いて同じ現象を観察することができたので、まとめてみます。

 
まず、プログラムを書きます。ファイル 1 つです。

 
```
// 
// bitfield.cpp 
//

#include <windows.h> 
#include <stdio.h>

#define NTDLL_DLL L"ntdll.dll"

#define BETWEEN(n, a, b) ((n)>=(a) && (n)<=(b)) 
#define LOGERROR(fmt, ...) wprintf(fmt, __VA_ARGS__) 
#define LOGINFO LOGERROR 
#define LOGDEBUG

typedef ULONG (WINAPI *RTLRANDOM)( 
  _Inout_  PULONG Seed 
);

HMODULE NtDllDll = NULL; 
RTLRANDOM RtlRandom = NULL;

BOOL g_FlipFlop = TRUE; 
BOOL g_Field1 = TRUE; 
BOOL g_Field2 = TRUE;

struct TARGET { 
    INT Int1; 
    WORD Field1:1; 
    WORD Field2:1; 
    INT Int2; 
} g_Target;

typedef struct _CONTEXT_CHURN { 
    ULONG   DynamicSeed; 
    INT     Iteration; 
    INT     ThreadIndex; 
    INT     LoopCounter; 
} CONTEXT_CHURN, *PCONTEXT_CHURN;

DWORD WINAPI ChurningThread( 
  _In_  LPVOID lpParameter 
) { 
    PCONTEXT_CHURN Context = (PCONTEXT_CHURN)lpParameter;

    for ( int i=0 ; i<Context->Iteration ; ++i, ++Context->LoopCounter ) { 
        switch (Context->ThreadIndex) 
        { 
        case 0: 
            g_FlipFlop = !g_FlipFlop; 
            break; 
        case 1: 
            if ( g_Target.Field1!=g_Field1 ) { 
                LOGINFO(L"[ChurningThread.%04x] %d: g_Target.Field1=%d g_Field1=%d \n", 
                    GetCurrentThreadId(), 
                    Context->LoopCounter, 
                    g_Target.Field1, g_Field1); 
            } 
            g_Target.Field1 = g_FlipFlop; 
            g_Field1 = g_Target.Field1; 
            break; 
        case 2: 
            if ( g_Target.Field2!=g_Field2) { 
                LOGINFO(L"[ChurningThread.%04x] %d: g_Target.Field2=%d g_Field2=%d \n", 
                    GetCurrentThreadId(), 
                    Context->LoopCounter, 
                    g_Target.Field2, g_Field2); 
            } 
            g_Target.Field2= g_FlipFlop; 
            g_Field2 = g_Target.Field2; 
            break; 
        }

        int RandomWait = int(double(RtlRandom(&Context->DynamicSeed))/MAXLONG*10); 
        Sleep(RandomWait); 
    }

    return 0; 
}

void Test_Bitfield(int NumOfThreads, int Iteration) { 
    HANDLE *ThreadPool = new HANDLE[NumOfThreads]; 
    CONTEXT_CHURN *ThreadContexts = new CONTEXT_CHURN[NumOfThreads];

    if ( ThreadPool && ThreadContexts ) { 
        ULONG DynamicSeed = GetTickCount();

        for ( int i=0 ; i<NumOfThreads  ; ++i ) { 
            ThreadContexts[i].DynamicSeed = RtlRandom(&DynamicSeed); 
            ThreadContexts[i].Iteration = Iteration; 
            ThreadContexts[i].ThreadIndex= i; 
            ThreadContexts[i].LoopCounter= 0; 
            ThreadPool[i] = CreateThread(NULL, 0, ChurningThread, &ThreadContexts[i], CREATE_SUSPENDED, NULL); 
        } 
    
        g_Target.Field1 = g_Field1; 
        g_Target.Field2 = g_Field2;

        for ( int i=0 ; i<NumOfThreads  ; ++i ) { 
            ResumeThread(ThreadPool[i]); 
        }

        WaitForMultipleObjects(NumOfThreads, ThreadPool, TRUE, INFINITE); 
       
        for ( int i=0 ; i<NumOfThreads  ; ++i ) { 
            CloseHandle(ThreadPool[i]); 
        }

        delete [] ThreadPool; 
        delete [] ThreadContexts; 
    } 
}

int wmain(int argc, wchar_t *argv[]) { 
    NtDllDll = LoadLibrary(NTDLL_DLL); 
    RtlRandom = (RTLRANDOM)GetProcAddress(NtDllDll, "RtlRandom");

    if ( argc>=3 ) { 
        Test_Bitfield(_wtoi(argv[1]), _wtoi(argv[2])); 
    }

    return 0; 
}
```
 
簡単なマルチスレッド プログラムです。ChurningThread がメイン スレッドから実行されるワーカー スレッドで、ThreadIndex の値によって以下 3 種類の振る舞いを行なうことができます。

 
- グローバル変数 g_FlipFlop をひたすら反転 
- g_Target.Field1 と g_Field1 に g_FlipFlop を代入 
- g_Target.Field2 と g_Field2 に g_FlipFlop を代入 

 
これを x64 ネイティブのプログラムにして実行します。手元の環境で 4 回ほど実行した結果を貼ります。

 
- OS: Windows 8.1 x64 
- IDE: Visual Studio 2012 
- CPU: Intel Core i5-2520M (2 Cores, 4 Logical Processors) 
- Build: x64 Release 

 
```
D:\VSDev\Projects\win32c>x64\Release\win32c 3 1000 
[ChurningThread.29d4] 98: g_Target.Field2=0 g_Field2=1 
[ChurningThread.29d4] 845: g_Target.Field2=0 g_Field2=1

D:\VSDev\Projects\win32c>x64\Release\win32c 3 1000 
[ChurningThread.2ab0] 543: g_Target.Field2=0 g_Field2=1 
[ChurningThread.2ab0] 581: g_Target.Field2=0 g_Field2=1 
[ChurningThread.0154] 933: g_Target.Field1=0 g_Field1=1

D:\VSDev\Projects\win32c>x64\Release\win32c 3 1000

D:\VSDev\Projects\win32c>x64\Release\win32c 3 1000 
[ChurningThread.0460] 83: g_Target.Field1=0 g_Field1=1 
[ChurningThread.2088] 714: g_Target.Field2=1 g_Field2=0 
[ChurningThread.0460] 803: g_Target.Field1=0 g_Field1=1 
```
 
C 言語的にはこれはおかしな結果です。ChurningThread の処理を見る限りでは、g_Target.Field1 と g_Field1、g_Target.Field2 と g_Field2 の値が異なることはあり得ないはずです。というのも、ログを表示した後の処理で、どちらの値にも g_FlipFlop が代入されるはずだからです。ThreadIndex の値は途中で変更されないので、各スレッドは同じ処理をひたすら繰り返しているだけです。なぜ値が異なるのでしょう。g_FlipFlop の値も同時に反転し続けています。しかし、各スレッドは g_FlipFlop の値は一回読み取るだけで、g_Field1 には g_Target.Field1 の値を代入しているので、仮にこの 2 行の間に g_FlipFlop が反転したとしても、影響はないはずです。

 
この記事のタイトルや関数名からして、ビット フィールドが怪しいとお気づきになる方は多いと思います。正解です。TARGET::Field1 か TARGET::Field2 の片方を独立したメンバーにするだけでこの現象は解消します。では、なぜこのようなことが起こっていたのかをアセンブラで見てみます。

 
ChurningThread 関数全体のアセンブラは以下の通りです。ビットフィールドに関連するところは、g_Target.Field1 と g_Target.Field2 に値を代入しているところなので、該当箇所を青字にしました。

 
```
win32c!ChurningThread [d:\vsdev\projects\win32c\src\main.cpp @ 42]: 
   42 00007ff6`d0471000 4889742410      mov     qword ptr [rsp+10h],rsi 
   42 00007ff6`d0471005 57              push    rdi 
   42 00007ff6`d0471006 4883ec50        sub     rsp,50h 
   45 00007ff6`d047100a 33f6            xor     esi,esi 
   45 00007ff6`d047100c 488bf9          mov     rdi,rcx 
   45 00007ff6`d047100f 397104          cmp     dword ptr [rcx+4],esi 
   45 00007ff6`d0471012 0f8e67010000    jle     win32c!ChurningThread+0x17f (00007ff6`d047117f)

win32c!ChurningThread+0x18 [d:\vsdev\projects\win32c\src\main.cpp @ 45]: 
   45 00007ff6`d0471018 0f29742440      movaps  xmmword ptr [rsp+40h],xmm6 
   45 00007ff6`d047101d f20f103513130000 movsd   xmm6,mmword ptr [win32c!_real (00007ff6`d0472338)] 
   45 00007ff6`d0471025 0f297c2430      movaps  xmmword ptr [rsp+30h],xmm7 
   45 00007ff6`d047102a f20f103dfe120000 movsd   xmm7,mmword ptr [win32c!_real (00007ff6`d0472330)] 
   45 00007ff6`d0471032 48895c2460      mov     qword ptr [rsp+60h],rbx 
   45 00007ff6`d0471037 660f1f840000000000 nop   word ptr [rax+rax]

win32c!ChurningThread+0x40 [d:\vsdev\projects\win32c\src\main.cpp @ 46]: 
   46 00007ff6`d0471040 8b4f08          mov     ecx,dword ptr [rdi+8] 
   46 00007ff6`d0471043 85c9            test    ecx,ecx 
   46 00007ff6`d0471045 0f84e1000000    je      win32c!ChurningThread+0x12c (00007ff6`d047112c)

win32c!ChurningThread+0x4b [d:\vsdev\projects\win32c\src\main.cpp @ 46]: 
   46 00007ff6`d047104b ffc9            dec     ecx 
   46 00007ff6`d047104d 7476            je      win32c!ChurningThread+0xc5 (00007ff6`d04710c5)

win32c!ChurningThread+0x4f [d:\vsdev\projects\win32c\src\main.cpp @ 46]: 
   46 00007ff6`d047104f ffc9            dec     ecx 
   46 00007ff6`d0471051 0f85e6000000    jne     win32c!ChurningThread+0x13d (00007ff6`d047113d)

win32c!ChurningThread+0x57 [d:\vsdev\projects\win32c\src\main.cpp @ 62]: 
   62 00007ff6`d0471057 8b1d8f250000    mov     ebx,dword ptr [win32c!g_Target+0x4 (00007ff6`d04735ec)] 
   62 00007ff6`d047105d d1eb            shr     ebx,1 
   62 00007ff6`d047105f 83e301          and     ebx,1 
   62 00007ff6`d0471062 3b1db41f0000    cmp     ebx,dword ptr [win32c!g_Field2 (00007ff6`d047301c)] 
   62 00007ff6`d0471068 7426            je      win32c!ChurningThread+0x90 (00007ff6`d0471090)

win32c!ChurningThread+0x6a [d:\vsdev\projects\win32c\src\main.cpp @ 66]: 
   66 00007ff6`d047106a ff15b80f0000    call    qword ptr [win32c!_imp_GetCurrentThreadId (00007ff6`d0472028)] 
   66 00007ff6`d0471070 448b470c        mov     r8d,dword ptr [rdi+0Ch] 
   66 00007ff6`d0471074 488d0d15120000  lea     rcx,[win32c!`string' (00007ff6`d0472290)] 
   66 00007ff6`d047107b 8bd0            mov     edx,eax 
   66 00007ff6`d047107d 8b05991f0000    mov     eax,dword ptr [win32c!g_Field2 (00007ff6`d047301c)] 
   66 00007ff6`d0471083 448bcb          mov     r9d,ebx 
   66 00007ff6`d0471086 89442420        mov     dword ptr [rsp+20h],eax 
   66 00007ff6`d047108a ff15d0100000    call    qword ptr [win32c!_imp_wprintf (00007ff6`d0472160)]

win32c!ChurningThread+0x90 [d:\vsdev\projects\win32c\src\main.cpp @ 68]: 
   68 00007ff6`d0471090 0fb70555250000  movzx   eax,word ptr [win32c!g_Target+0x4 (00007ff6`d04735ec)] 
   68 00007ff6`d0471097 0fb70d861f0000  movzx   ecx,word ptr [win32c!g_FlipFlop (00007ff6`d0473024)] 
   68 00007ff6`d047109e 6603c9          add     cx,cx 
   68 00007ff6`d04710a1 6633c8          xor     cx,ax 
   68 00007ff6`d04710a4 6683e102        and     cx,2 
   68 00007ff6`d04710a8 6633c1          xor     ax,cx 
   68 00007ff6`d04710ab 6689053a250000  mov     word ptr [win32c!g_Target+0x4 (00007ff6`d04735ec)],ax 
   69 00007ff6`d04710b2 8b0534250000    mov     eax,dword ptr [win32c!g_Target+0x4 (00007ff6`d04735ec)] 
   69 00007ff6`d04710b8 d1e8            shr     eax,1 
   69 00007ff6`d04710ba 83e001          and     eax,1 
   69 00007ff6`d04710bd 8905591f0000    mov     dword ptr [win32c!g_Field2 (00007ff6`d047301c)],eax 
   70 00007ff6`d04710c3 eb78            jmp     win32c!ChurningThread+0x13d (00007ff6`d047113d)

win32c!ChurningThread+0xc5 [d:\vsdev\projects\win32c\src\main.cpp @ 52]: 
   52 00007ff6`d04710c5 8b1d21250000    mov     ebx,dword ptr [win32c!g_Target+0x4 (00007ff6`d04735ec)] 
   52 00007ff6`d04710cb 83e301          and     ebx,1 
   52 00007ff6`d04710ce 3b1d4c1f0000    cmp     ebx,dword ptr [win32c!g_Field1 (00007ff6`d0473020)] 
   52 00007ff6`d04710d4 7426            je      win32c!ChurningThread+0xfc (00007ff6`d04710fc)

win32c!ChurningThread+0xd6 [d:\vsdev\projects\win32c\src\main.cpp @ 56]: 
   56 00007ff6`d04710d6 ff154c0f0000    call    qword ptr [win32c!_imp_GetCurrentThreadId (00007ff6`d0472028)] 
   56 00007ff6`d04710dc 448b470c        mov     r8d,dword ptr [rdi+0Ch] 
   56 00007ff6`d04710e0 488d0d29110000  lea     rcx,[win32c!`string' (00007ff6`d0472210)] 
   56 00007ff6`d04710e7 8bd0            mov     edx,eax 
   56 00007ff6`d04710e9 8b05311f0000    mov     eax,dword ptr [win32c!g_Field1 (00007ff6`d0473020)] 
   56 00007ff6`d04710ef 448bcb          mov     r9d,ebx 
   56 00007ff6`d04710f2 89442420        mov     dword ptr [rsp+20h],eax 
   56 00007ff6`d04710f6 ff1564100000    call    qword ptr [win32c!_imp_wprintf (00007ff6`d0472160)]

win32c!ChurningThread+0xfc [d:\vsdev\projects\win32c\src\main.cpp @ 58]: 
   58 00007ff6`d04710fc 0fb705e9240000  movzx   eax,word ptr [win32c!g_Target+0x4 (00007ff6`d04735ec)] 
   58 00007ff6`d0471103 0fb70d1a1f0000  movzx   ecx,word ptr [win32c!g_FlipFlop (00007ff6`d0473024)] 
   58 00007ff6`d047110a 6633c8          xor     cx,ax 
   58 00007ff6`d047110d 6683e101        and     cx,1 
   58 00007ff6`d0471111 6633c1          xor     ax,cx 
   58 00007ff6`d0471114 668905d1240000  mov     word ptr [win32c!g_Target+0x4 (00007ff6`d04735ec)],ax 
   59 00007ff6`d047111b 8b05cb240000    mov     eax,dword ptr [win32c!g_Target+0x4 (00007ff6`d04735ec)] 
   59 00007ff6`d0471121 83e001          and     eax,1 
   59 00007ff6`d0471124 8905f61e0000    mov     dword ptr [win32c!g_Field1 (00007ff6`d0473020)],eax 
   60 00007ff6`d047112a eb11            jmp     win32c!ChurningThread+0x13d (00007ff6`d047113d)

win32c!ChurningThread+0x12c [d:\vsdev\projects\win32c\src\main.cpp @ 49]: 
   49 00007ff6`d047112c 33c0            xor     eax,eax 
   49 00007ff6`d047112e 3905f01e0000    cmp     dword ptr [win32c!g_FlipFlop (00007ff6`d0473024)],eax 
   49 00007ff6`d0471134 0f94c0          sete    al 
   49 00007ff6`d0471137 8905e71e0000    mov     dword ptr [win32c!g_FlipFlop (00007ff6`d0473024)],eax

win32c!ChurningThread+0x13d [d:\vsdev\projects\win32c\src\main.cpp @ 73]: 
   73 00007ff6`d047113d 488bcf          mov     rcx,rdi 
   73 00007ff6`d0471140 ff15b2240000    call    qword ptr [win32c!RtlRandom (00007ff6`d04735f8)] 
   73 00007ff6`d0471146 0f57c0          xorps   xmm0,xmm0 
   73 00007ff6`d0471149 8bc0            mov     eax,eax 
   73 00007ff6`d047114b f2480f2ac0      cvtsi2sd xmm0,rax 
   73 00007ff6`d0471150 f20f5ec6        divsd   xmm0,xmm6 
   73 00007ff6`d0471154 f20f59c7        mulsd   xmm0,xmm7 
   73 00007ff6`d0471158 f20f2cc8        cvttsd2si ecx,xmm0 
   74 00007ff6`d047115c ff15ae0e0000    call    qword ptr [win32c!_imp_Sleep (00007ff6`d0472010)] 
   74 00007ff6`d0471162 ff470c          inc     dword ptr [rdi+0Ch] 
   74 00007ff6`d0471165 ffc6            inc     esi 
   74 00007ff6`d0471167 3b7704          cmp     esi,dword ptr [rdi+4] 
   74 00007ff6`d047116a 0f8cd0feffff    jl      win32c!ChurningThread+0x40 (00007ff6`d0471040)

win32c!ChurningThread+0x170 [d:\vsdev\projects\win32c\src\main.cpp @ 74]: 
   74 00007ff6`d0471170 0f287c2430      movaps  xmm7,xmmword ptr [rsp+30h] 
   74 00007ff6`d0471175 0f28742440      movaps  xmm6,xmmword ptr [rsp+40h] 
   74 00007ff6`d047117a 488b5c2460      mov     rbx,qword ptr [rsp+60h]

win32c!ChurningThread+0x17f [d:\vsdev\projects\win32c\src\main.cpp @ 77]: 
   77 00007ff6`d047117f 33c0            xor     eax,eax 
   78 00007ff6`d0471181 488b742468      mov     rsi,qword ptr [rsp+68h] 
   78 00007ff6`d0471186 4883c450        add     rsp,50h 
   78 00007ff6`d047118a 5f              pop     rdi 
   78 00007ff6`d047118b c3              ret
```
 
よくある現象ですが、case ブロックの順番が逆転していますね。switch 文のコンパイル結果は気持ち悪いものです。それはさておき、C 言語では 1 行の処理である "g_Target.Field2 = g_FlipFlop" が、アセンブラだと 7 命令になっています。ビットフィールドの使用はパフォーマンス悪化の原因にもなりそうですね。

 
```
00007ff6`d0471090 0fb70555250000  movzx   eax,word ptr [win32c!g_Target+0x4 (00007ff6`d04735ec)] 
00007ff6`d0471097 0fb70d861f0000  movzx   ecx,word ptr [win32c!g_FlipFlop (00007ff6`d0473024)] 
00007ff6`d047109e 6603c9          add     cx,cx 
00007ff6`d04710a1 6633c8          xor     cx,ax 
00007ff6`d04710a4 6683e102        and     cx,2 
00007ff6`d04710a8 6633c1          xor     ax,cx 
00007ff6`d04710ab 6689053a250000  mov     word ptr [win32c!g_Target+0x4 (00007ff6`d04735ec)],ax 
```
 
特定のビットへの代入 (A=B) は、XOR を二回実行して

 
A = A^(B^A)

 
のように行われるようです。add と and は、効果を特定のビットに限定させている部分です。

 
この処理で問題なのは、赤字で示した xor と mov のところです。演算結果を ax レジスタに入れてから g_Target.Field2 に mov しています。この処理だと、代入したいビット以外のビットもメモリに送られてしまうことになります。00007ff6`d0471090 の処理の時は Field1 が 1 だったとして、00007ff6`d04710ab を実行するまでの間に別スレッドが Field1 を 0 に設定していたとしても、こっちのスレッドが Field2 を設定するときには ax レジスタに保存されていた古い Field1 も一緒に mov されるので、予期せずして Field1 が変更されることがありそうです。

 
これだけだと、コンパイラがお粗末でした、というだけで話が終わってしまいそうですが、実は続きがあります。今度は 32bit の x86 ネイティブでコンパイルして同じ 64bit Windows で実行してみます。

 
```
D:\VSDev\Projects\win32c>Release\win32c.exe 3 1000 
[ChurningThread.275c] 851: g_Target.Field2=0 g_Field2=1

D:\VSDev\Projects\win32c>Release\win32c.exe 3 1000 
[ChurningThread.2034] 40: g_Target.Field1=1 g_Field1=0 
[ChurningThread.2034] 894: g_Target.Field1=0 g_Field1=1

D:\VSDev\Projects\win32c>Release\win32c.exe 3 1000

D:\VSDev\Projects\win32c>Release\win32c.exe 3 1000 
[ChurningThread.2a28] 23: g_Target.Field2=1 g_Field2=0 
[ChurningThread.2bd4] 874: g_Target.Field1=0 g_Field1=1
```
 
同じように競合が発生するようです。同じコードをコンパイルしているだけなので当たり前のように見えます。ここでもアセンブラを見てみます。全部貼ると長いので、抜粋します。

 
##### g_Target.Field2 = g_FlipFlop;

 
```
win32c!ChurningThread+0x36 [d:\vsdev\projects\win32c\src\main.cpp @ 62]: 
   62 00161036 8b0d84331600    mov     ecx,dword ptr [win32c!g_Target+0x4 (00163384)]  
   62 0016103c 8b1518301600    mov     edx,dword ptr [win32c!g_Field2 (00163018)] 
   62 00161042 8bc1            mov     eax,ecx 
   62 00161044 d1e8            shr     eax,1 
   62 00161046 83e001          and     eax,1 
   62 00161049 3bc2            cmp     eax,edx 
   62 0016104b 741c            je      win32c!ChurningThread+0x69 (00161069)

win32c!ChurningThread+0x4d [d:\vsdev\projects\win32c\src\main.cpp @ 66]: 
   66 0016104d 52              push    edx 
   66 0016104e 50              push    eax 
   66 0016104f ff760c          push    dword ptr [esi+0Ch] 
   66 00161052 ff1514201600    call    dword ptr [win32c!_imp__GetCurrentThreadId (00162014)] 
   66 00161058 50              push    eax 
   66 00161059 68a8211600      push    offset win32c!`string' (001621a8) 
   66 0016105e ffd3            call    ebx 
   66 00161060 8b0d84331600    mov     ecx,dword ptr [win32c!g_Target+0x4 (00163384)]  
   66 00161066 83c414          add     esp,14h

win32c!ChurningThread+0x69 [d:\vsdev\projects\win32c\src\main.cpp @ 68]: 
   68 00161069 a120301600      mov     eax,dword ptr [win32c!g_FlipFlop (00163020)] 
   68 0016106e 03c0            add     eax,eax 
   68 00161070 33c1            xor     eax,ecx 
   68 00161072 83e002          and     eax,2 
   68 00161075 66310584331600  xor     word ptr [win32c!g_Target+0x4 (00163384)],ax 
   69 0016107c a184331600      mov     eax,dword ptr [win32c!g_Target+0x4 (00163384)] 
   69 00161081 d1e8            shr     eax,1 
   69 00161083 83e001          and     eax,1 
   69 00161086 a318301600      mov     dword ptr [win32c!g_Field2 (00163018)],eax 
   70 0016108b eb61            jmp     win32c!ChurningThread+0xee (001610ee) 
```
 
##### g_Target.Field1 = g_FlipFlop;

 
```
win32c!ChurningThread+0x8d [d:\vsdev\projects\win32c\src\main.cpp @ 52]: 
   52 0016108d 8b0d84331600    mov     ecx,dword ptr [win32c!g_Target+0x4 (00163384)] 
   52 00161093 8b151c301600    mov     edx,dword ptr [win32c!g_Field1 (0016301c)] 
   52 00161099 8bc1            mov     eax,ecx 
   52 0016109b 83e001          and     eax,1 
   52 0016109e 3bc2            cmp     eax,edx 
   52 001610a0 741c            je      win32c!ChurningThread+0xbe (001610be)

win32c!ChurningThread+0xa2 [d:\vsdev\projects\win32c\src\main.cpp @ 56]: 
   56 001610a2 52              push    edx 
   56 001610a3 50              push    eax 
   56 001610a4 ff760c          push    dword ptr [esi+0Ch] 
   56 001610a7 ff1514201600    call    dword ptr [win32c!_imp__GetCurrentThreadId (00162014)] 
   56 001610ad 50              push    eax 
   56 001610ae 6830211600      push    offset win32c!`string' (00162130) 
   56 001610b3 ffd3            call    ebx 
   56 001610b5 8b0d84331600    mov     ecx,dword ptr [win32c!g_Target+0x4 (00163384)] 
   56 001610bb 83c414          add     esp,14h

win32c!ChurningThread+0xbe [d:\vsdev\projects\win32c\src\main.cpp @ 58]: 
   58 001610be a120301600      mov     eax,dword ptr [win32c!g_FlipFlop (00163020)] 
   58 001610c3 33c1            xor     eax,ecx 
   58 001610c5 83e001          and     eax,1 
   58 001610c8 66310584331600  xor     word ptr [win32c!g_Target+0x4 (00163384)],ax 
   59 001610cf a184331600      mov     eax,dword ptr [win32c!g_Target+0x4 (00163384)] 
   59 001610d4 83e001          and     eax,1 
   59 001610d7 a31c301600      mov     dword ptr [win32c!g_Field1 (0016301c)],eax 
   60 001610dc eb10            jmp     win32c!ChurningThread+0xee (001610ee) 
```
 
2 回の XOR でビットの代入を行っているところは x64 と同じです。しかし、x64 で問題となっていた win32c!g_Target への mov による代入がありません。代わりに何をやっているかというと、win32c!g_Target に対して直接 XOR を実行しています。つまり、最初に win32c!g_Target の値を ecx に保存してから、最後に XOR でビットをセットするまでの間に g_Target が別スレッドによって変更されたとしても、g_Target に対して変更したい 1 ビットだけを XOR するので、他のビットへの影響はないと考えられます。より具体的に説明すると、xor の第二オペランドである ax レジスタは、その前に実行している and によって、設定対象外のビットが 0 になっているため、XOR しても変化しないはずなのです。理論的には。

 
実際に実行すると、x64 と同じく競合が発生します。そして、ビットフィールドではなく独立したメンバーにすると、競合は発生しません。まだ確証は持てていませんが、おそらく CPU キャッシュによるものと考えられます。CPU コア毎に存在している L1 キャッシュあたりに win32c!g_Target の値がキャッシュされていて、mov で取ってくるとき、もしくは xor で変更するときに、別コアで実行されているスレッドが変更した値がまだこちら側に来ていない、ということが起こっている可能性があります。さて、どうやって確かめたものか・・・。

 
シングル コアの CPU 上であれば、64bit プログラムだけで競合が発生し、32bit では競合が発生しないはずです。しかし、普通にプログラムを動かしただけでは、ちょうどいい場所でコンテキスト スイッチが起こらず、64bit プログラムでも競合は発生しません。デバッガーで無理やり競合させられるかどうかを試してみたいところです。

 
&#x5b;2013/12/01&#x5d; 続きを書きました。

 
&#x5b;Win32&#x5d; &#x5b;Asm&#x5d; Race condition between bit fields #2 | すなのかたまり <br />
[http://msmania.wordpress.com/2013/12/01/win32-asm-race-condition-between-bit-fields-2/](http://msmania.wordpress.com/2013/12/01/win32-asm-race-condition-between-bit-fields-2/)

