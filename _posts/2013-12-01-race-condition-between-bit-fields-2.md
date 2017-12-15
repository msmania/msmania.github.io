---
layout: post
title: "[Win32] [Asm] Race condition between bit fields #2"
date: 2013-12-01 16:53:56.000 -08:00
categories:
- Asm
- C/C++
- Debug
- Windows
tags:
- MASM
- ml
- ml64
---

前回の記事の続きです。

 
&#x5b;Win32&#x5d; &#x5b;Asm&#x5d; Race condition between bit fields | すなのかたまり <br />
[http://msmania.wordpress.com/2013/11/30/win32-asm-race-condition-between-bit-fields/](http://msmania.wordpress.com/2013/11/30/win32-asm-race-condition-between-bit-fields/)

 
ビットフィールドに値をセットするコードで、x86 と x64 のコンパイル結果が微妙に異なっていました。そして、x86 ではメモリに対して直接 xor しているのに対し、x64 では、xor した結果をレジスタに保存してから、それをメモリに mov するという方法を取っていました。つまり x64 の処理では、セットしたいビット以外のビットも mov によって上書きされてしまう可能性があるということです。しかし実際には、アセンブラ上は競合しないように見える x86 も競合が発生し、CPU キャッシュを原因の一つとして考えています。

 
CPU キャッシュの話はさておいて、何とかして x64 のコンパイル結果を咎める検証を行いたいものです。理論的には、シングル プロセッサーの環境であっても、コンテキスト スイッチの発生するタイミングによっては競合が発生するはずです。

 
アセンブラを再掲します。

 
##### x64 (競合するはず)

 
```
win32c!ChurningThread+0x90: 
00007ff7`50b11090 0fb70555250000  movzx   eax,word ptr [win32c!g_Target+0x4 (00007ff7`50b135ec)] 
00007ff7`50b11097 0fb70d861f0000  movzx   ecx,word ptr [win32c!g_FlipFlop (00007ff7`50b13024)] 
00007ff7`50b1109e 6603c9          add     cx,cx 
00007ff7`50b110a1 6633c8          xor     cx,ax 
00007ff7`50b110a4 6683e102        and     cx,2 
00007ff7`50b110a8 6633c1          xor     ax,cx 
00007ff7`50b110ab 6689053a250000  mov     word ptr [win32c!g_Target+0x4 (00007ff7`50b135ec)],ax

win32c!ChurningThread+0xfc: 
00007ff7`50b110fc 0fb705e9240000  movzx   eax,word ptr [win32c!g_Target+0x4 (00007ff7`50b135ec)] 
00007ff7`50b11103 0fb70d1a1f0000  movzx   ecx,word ptr [win32c!g_FlipFlop (00007ff7`50b13024)] 
00007ff7`50b1110a 6633c8          xor     cx,ax 
00007ff7`50b1110d 6683e101        and     cx,1 
00007ff7`50b11111 6633c1          xor     ax,cx 
00007ff7`50b11114 668905d1240000  mov     word ptr [win32c!g_Target+0x4 (00007ff7`50b135ec)],ax 
```
 
##### x86 (競合は発生しないはず)

 
```
00bd1060 8b0d8433bd00    mov     ecx,dword ptr [win32c!g_Target+0x4 (00bd3384)]

win32c!ChurningThread+0x69: 
00bd1069 a12030bd00      mov     eax,dword ptr [win32c!g_FlipFlop (00bd3020)] 
00bd106e 03c0            add     eax,eax 
00bd1070 33c1            xor     eax,ecx 
00bd1072 83e002          and     eax,2 
00bd1075 6631058433bd00  xor     word ptr [win32c!g_Target+0x4 (00bd3384)],ax

00bd10b5 8b0d8433bd00    mov     ecx,dword ptr [win32c!g_Target+0x4 (00bd3384)]

win32c!ChurningThread+0xbe: 
00bd10be a12030bd00      mov     eax,dword ptr [win32c!g_FlipFlop (00bd3020)] 
00bd10c3 33c1            xor     eax,ecx 
00bd10c5 83e001          and     eax,1 
00bd10c8 6631058433bd00  xor     word ptr [win32c!g_Target+0x4 (00bd3384)],ax 
```
 
コンパイル結果がおかしいといえど、コンテキスト スイッチが発生すると困る (検証のためにはもちろん発生して欲しい) 箇所はかなり狭く、上の紫で示した 4 または 5 命令の部分です。この数クロックのタイミングでコンテキスト スイッチが発生するまでプログラムを動かし続けるのは現実的ではありません。そこで一般的な方法は、コンテキスト スイッチを発生させたいところが遅くなるようにコードを書き換えることです。といっても、C 言語だとビットフィールドへの代入という 1 行で済んでしまうコードなので、途中に Sleep を入れるわけにはいきません。インライン アセンブラを使いたいところですが、残念ながら x64 ではインライン アセンブラも使えません。デバッガーでコード領域をがりがり書き換える方法もありますが、今回は勉強もかねて MASM でアセンブラを書いてみることにしました。

 
書いたコードを以下に示します。x64 と x86 の両方を実装しており、x64 用の関数は 4 つです。

 
- SetBit0 - 最上位ビットに値をセット (コンパイラに忠実なコード) 
- SetBit1 - 2 つ目ののビットに値をセット (コンパイラに忠実なコード) 
- SetBit0Safe - 最上位ビットに値をセット (メモリに直接 xor する安全なコード) 
- SetBit1Safe - 2 つ目のビットに値をセット (メモリに直接 xor する安全なコード) 

 
まずは setbit.asm。パラメーターを明記せずにいきなり rcx や rdx を弄っているのでとっても危険です。

  
```
; 
; setbit.asm 
; 
; http://msdn.microsoft.com/en-us/library/vstudio/ss9fh0d6.aspx 
;

ifndef X64

.model flat, C

endif

.data 
; something

.code

ifdef X64

SetBit0 proc 
  mov r8d, [rcx] 
  xor dx, r8w 
  and dx, 1 
  xor r8w, dx 
  INCLUDE nop50.asm 
  mov [rcx], r8w 
  ret 
SetBit0 endp

SetBit1 proc 
  mov r8d, [rcx] 
  add dx, dx 
  xor dx, r8w 
  and dx, 2 
  xor r8w, dx 
  mov [rcx], r8w 
  ret 
SetBit1 endp

SetBit0Safe proc 
  mov r8w, [rcx] 
  xor r8w, dx 
  and r8w, 1 
  INCLUDE nop50.asm 
  xor [rcx], r8w 
  ret 
SetBit0Safe endp

SetBit1Safe proc 
  mov r8w, [rcx] 
  shl dx, 1 
  xor r8w, dx 
  and r8w, 2 
  xor [rcx], r8w 
  ret 
SetBit1Safe endp

else

SetBit0 proc var1:DWORD, var2:DWORD 
  mov eax, [var1] 
  mov ecx, [eax] 
  mov eax, [var2] 
  xor eax, ecx 
  and eax, 1 
  INCLUDE nop50.asm 
  mov ecx, [var1] 
  xor word ptr [ecx], ax 
  ret 
SetBit0 endp

SetBit1 proc var1:DWORD, var2:DWORD 
  mov eax, [var1] 
  mov ecx, [eax] 
  mov eax, [var2] 
  add eax, eax 
  xor eax, ecx 
  and eax, 2 
  mov ecx, [var1] 
  xor word ptr [ecx], ax 
  ret 
SetBit1 endp

endif

END
```
 
INCLUDE nop50.asm という箇所がありますが、nop50.asm は nop を 50 行書いているだけです。これで、コンテキスト スイッチを誘う処理の遅延を発生させます。Bit0 の関数だけに入れました。この nop を実行している間に、別スレッド経由でg_FlipFlop の反転が発生すればよいわけです。

 
nop50.asm の内容。

 
```
nop 
nop 
nop 
(中略。50 行 nop が続きます。) 
nop 
nop 
nop 
nop
```
 
MASM のアセンブラーは Visual Studio 2012 に含まれていて、手元の環境では以下の場所にありました。Microsoft Macro Assembler (MASM) というものです。

 
```
C:\Program Files (x86)\Microsoft Visual Studio 11.0\VC\bin\amd64\ml64.exe 
C:\Program Files (x86)\Microsoft Visual Studio 11.0\VC\bin\ml.exe
```
 
なお、ARM のアセンブラーは以下の場所にありました。MASM とは呼ばれないようです。

 
```
C:\Program Files (x86)\Microsoft Visual Studio 11.0\VC\bin\x86_arm\armasm.exe
```
 
ARM Assembler Command-Line Reference <br />
[http://msdn.microsoft.com/en-us/library/vstudio/hh873189.aspx](http://msdn.microsoft.com/en-us/library/vstudio/hh873189.aspx)

 
上手いことやれば MASM を Visual Studio のプロジェクトに完全に統合できそうですが、調べるのが面倒だったので、アセンブルするバッチ ファイルを書いて、Pre-Build Event から呼び出すという方法を取りました。これも相当に面倒でしたが。

 
書いたバッチ ファイルはこちら。goasm.bat です。第一引数で x86 と x64 を区別させます。

 
```
SET ML64=C:\Program Files (x86)\Microsoft Visual Studio 11.0\VC\bin\amd64\ml64.exe 
SET ML32=C:\Program Files (x86)\Microsoft Visual Studio 11.0\VC\bin\ml.exe

IF /I "%1"=="X86" ( 
"%ml32%" /nologo /Fo asm\setbit32.obj /c /safeseh /Zi asm\setbit.asm 
)

IF /I "%1"=="X64" ( 
"%ml64%" /nologo /Fo asm\setbit64.obj /c /Zi /DX64 asm\setbit.asm 
) 
```
 
次に Visual Studio 側でごにょごにょ設定します。うーん、GUI めんどくさい・・・。

 
![]({{site.assets_url}}2013-12-01-image2.png) すべての環境で goasm.bat を実行

 
![]({{site.assets_url}}2013-12-01-image3.png) Win32 では setbit32.obj をリンク

 
![]({{site.assets_url}}2013-12-01-image4.png) x64 では setbit64.obj をリンク

 
さて、あとはソースコードをちょっと修正するだけです。

 
- ビットの代入の代わりに SetBit0/SetBit1 を使用
- 共用体を追加 
- 一つのプロセッサー上で動かすため、各スレッドに対して SetThreadAffinityMask API を実行 
- とにかく回数をこなさないといけないので、ループ内の Sleep を削除 

 
こんな感じになりました。

 
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

extern "C" void SetBit0(PWORD, BOOL); 
extern "C" void SetBit1(PWORD, BOOL);

#ifdef _WIN64 
extern "C" void SetBit0Safe(PWORD, BOOL); 
extern "C" void SetBit1Safe(PWORD, BOOL); 
#else 
#define SetBit0Safe SetBit0 
#define SetBit1Safe SetBit1 
#endif

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
    union { 
        struct { 
            WORD Field1:1; 
            WORD Field2:1; 
        }; 
        WORD Word; 
    }; 
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
            //g_Target.Field1 = g_FlipFlop; 
            SetBit0(&g_Target.Word, g_FlipFlop); 
            g_Field1 = g_Target.Field1; 
            break; 
        case 2: 
            if ( g_Target.Field2!=g_Field2) { 
                LOGINFO(L"[ChurningThread.%04x] %d: g_Target.Field2=%d g_Field2=%d \n", 
                    GetCurrentThreadId(), 
                    Context->LoopCounter, 
                    g_Target.Field2, g_Field2); 
            } 
            //g_Target.Field2 = g_FlipFlop; 
            SetBit1(&g_Target.Word, g_FlipFlop); 
            g_Field2 = g_Target.Field2; 
            break; 
        }

        //int RandomWait = int(double(RtlRandom(&Context->DynamicSeed))/MAXLONG*10); 
        //Sleep(RandomWait); 
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
            if ( ThreadPool[i] ) { 
                SetThreadAffinityMask(ThreadPool[i], 2); 
                ResumeThread(ThreadPool[i]); 
            } 
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
 
ビルドが通ったら、MASM のアセンブルが意図した通りになっているか、念のためアセンブラを確認します。uf コマンドだけだと nop がずらーっと表示されてしまうので、find コマンドで nop の行を除外して表示します。

 
```
0:000> !! -ci "uf win32c!SetBit0" find /V "nop" 
win32c!SetBit0: 
00007ff7`0ec51360 448b01          mov     r8d,dword ptr [rcx] 
00007ff7`0ec51363 664133d0        xor     dx,r8w 
00007ff7`0ec51367 6683e201        and     dx,1 
00007ff7`0ec5136b 664433c2        xor     r8w,dx 
00007ff7`0ec513a1 66448901        mov     word ptr [rcx],r8w 
00007ff7`0ec513a5 c3              ret 
.shell: Process exited 
0:000> !! -ci "uf win32c!SetBit1" find /V "nop" 
win32c!SetBit1: 
00007ff7`0ec513a6 448b01          mov     r8d,dword ptr [rcx] 
00007ff7`0ec513a9 6603d2          add     dx,dx 
00007ff7`0ec513ac 664133d0        xor     dx,r8w 
00007ff7`0ec513b0 6683e202        and     dx,2 
00007ff7`0ec513b4 664433c2        xor     r8w,dx 
00007ff7`0ec513b8 66448901        mov     word ptr [rcx],r8w 
00007ff7`0ec513bc c3              ret 
.shell: Process exited 
0:000> !! -ci "uf win32c!SetBit0Safe" find /V "nop" 
win32c!SetBit0Safe: 
00007ff7`0ec513bd 66448b01        mov     r8w,word ptr [rcx] 
00007ff7`0ec513c1 664433c2        xor     r8w,dx 
00007ff7`0ec513c5 664183e001      and     r8w,1 
00007ff7`0ec513fc 66443101        xor     word ptr [rcx],r8w 
00007ff7`0ec51400 c3              ret 
.shell: Process exited 
0:000> !! -ci "uf win32c!SetBit1Safe" find /V "nop" 
win32c!SetBit1Safe: 
00007ff7`0ec51401 66448b01        mov     r8w,word ptr [rcx] 
00007ff7`0ec51405 66d1e2          shl     dx,1 
00007ff7`0ec51408 664433c2        xor     r8w,dx 
00007ff7`0ec5140c 664183e002      and     r8w,2 
00007ff7`0ec51411 66443101        xor     word ptr [rcx],r8w 
00007ff7`0ec51415 c3              ret 
.shell: Process exited 
0:000>
```
 
そして、以下が手元の環境で実行した結果です。2 億回に数回は起こすことができました。

 
```
D:\VSDev\Projects\win32c>x64\Release\win32c.exe 3 200000000 
[ChurningThread.03d0] 7238814: g_Target.Field2=1 g_Field2=0 
[ChurningThread.03d0] 32023047: g_Target.Field2=1 g_Field2=0 
[ChurningThread.03d0] 39249682: g_Target.Field2=1 g_Field2=0

D:\VSDev\Projects\win32c>x64\Release\win32c.exe 3 200000000 
[ChurningThread.2558] 30084234: g_Target.Field1=1 g_Field1=0

D:\VSDev\Projects\win32c>x64\Release\win32c.exe 3 200000000 
[ChurningThread.1e90] 8601808: g_Target.Field2=0 g_Field2=1 
[ChurningThread.1e90] 15811427: g_Target.Field2=1 g_Field2=0 
[ChurningThread.1e90] 22964666: g_Target.Field2=1 g_Field2=0 
[ChurningThread.1e90] 33260005: g_Target.Field2=0 g_Field2=1
```
 
次に SetBit0 と SetBit1 を、それぞれ SetBit0Safe と SetBit1Safe に変更してコンパイルして再度実行します。すると、今度は何回実行しようと競合は発生しませんでした。

 
というわけで、やはり x64 のコンパイル結果はよろしくないことが分かりました。といっても、Sleep を取っ払って nop を 50 個入れて、その上で 2 億回に数回なので、かなり低い確率ですが。逆に言えば、通常環境で万が一発生した時には極めて再現頻度の低い timing issue ということになります。

 
最後に、呼び出す関数は SetBit0Safe と SetBit1Safe のままにして、SetThreadAffinityMask の行をコメントアウトしてビルドしたものを実行してみます。つまり、アセンブラ的に OK なものを念のためマルチ プロセッサーで実行してみる検証です。

 
```
D:\VSDev\Projects\win32c>x64\Release\win32c.exe 3 50000 
[ChurningThread.1650] 7: g_Target.Field1=1 g_Field1=0 
[ChurningThread.1f68] 2570: g_Target.Field2=0 g_Field2=1

D:\VSDev\Projects\win32c>x64\Release\win32c.exe 3 50000 
[ChurningThread.2308] 1: g_Target.Field1=1 g_Field1=0

D:\VSDev\Projects\win32c>x64\Release\win32c.exe 3 50000 
[ChurningThread.0440] 330: g_Target.Field1=0 g_Field1=1 
[ChurningThread.1720] 4045: g_Target.Field2=0 g_Field2=1

D:\VSDev\Projects\win32c>x64\Release\win32c.exe 3 50000 
[ChurningThread.2504] 54: g_Target.Field1=1 g_Field1=0 
[ChurningThread.0464] 1528: g_Target.Field2=0 g_Field2=1 
[ChurningThread.0464] 1529: g_Target.Field2=0 g_Field2=1 
```
 
50000 回に数回の頻度で競合が発生しました。競合の発生頻度に特徴があるように感じます。CPU キャッシュの動作の仕組みを調べてみないと。。。

