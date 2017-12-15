---
layout: post
title: "How Pointer-to-Member Function works"
date: 2014-12-01 16:03:15.000 +09:00
categories:
- C/C++
- Debug
- Linux
- Windows
tags:
- gdb
- ILT
- lldb
- makefile
- nmake
---

前回の記事で Detours のサンプル コードを Visual Studio 2010/2013 でビルドするとでコンパイル エラー C2440 になることを紹介しました。該当箇所は、member というサンプルの member.cpp に実装された main 関数です。

 
```
class CDetour /* add ": public CMember" to enable access to member variables... */  
{  
  public:  
    void Mine_Target(void);  
    static void (CDetour::* Real_Target)(void);  
  
    // Class shouldn't have any member variables or virtual functions.  
};  
  
void (CDetour::* CDetour::Real_Target)(void) = (void (CDetour::*)(void))&CMember::Target;  
  
/* ----snip---- */  
  
#if (_MSC_VER < 1310)  
    void (CMember::* pfTarget)(void) = CMember::Target;  
    void (CDetour::* pfMine)(void) = CDetour::Mine_Target;  
  
    Verify("CMember::Target", *(PBYTE*)&pfTarget);  
    Verify("*CDetour::Real_Target", *(PBYTE*)&CDetour::Real_Target);  
    Verify("CDetour::Mine_Target", *(PBYTE*)&pfMine);  
#else  
    Verify("CMember::Target", (PBYTE)(&(PBYTE&)CMember::Target));  
      <<<< member.cpp(88) : error C2440: 'type cast' : cannot convert from 'void (__thiscall CMember::* )(void)' to 'PBYTE &'  
             Reason: cannot convert from 'overloaded-function' to 'PBYTE *'  
             There is no context in which this conversion is possible  
  
    Verify("*CDetour::Real_Target", *(&(PBYTE&)CDetour::Real_Target));  
  
    Verify("CDetour::Mine_Target", (PBYTE)(&(PBYTE&)CDetour::Mine_Target));  
      <<<< member.cpp(90) : error C2440: 'type cast' : cannot convert from 'void (__thiscall CDetour::* )(void)' to 'PBYTE &'  
             Reason: cannot convert from 'overloaded-function' to 'PBYTE *'  
             There is no context in which this conversion is possible  
#endif  
```
 
確か \_MSC_VER = 1310 は、Visual Studio .NET 2003 のコンパイラーのバージョンだった気がします。2003、2005 あたりだとコンパイルが通るのでしょうか。メンバ関数であるCMember::Target や CDetour::Mine_Target をリテラルとしてポインターに変換して Verify に渡そうとしていますが、キャストできないというエラーです。エラーになっていない CDetour::Real_Target は、メンバ関数の名前ではなく、クラス内の static メンバ変数であり、値は &CMember::Target で初期化されています。この初期化のように、メンバ関数へのポインターは関数名の先頭に & を付けるという理解でしたが・・・。

 
このコードの意図は、メンバ関数へのポインターを汎用ポインターにキャストすることですが、そもそもそんなことできたっけ、ということで調べると MSDN のフォーラムで次のような議論を見つけました。この中で出てくる "p2 = &(void*&)A::memfun" という構文はまさに Detours で使われているものと同じです。というか回答者も Detours で見たことがあるとか言ってるし。

 
why casting member function pointer to void *& works? <br />
[http://social.msdn.microsoft.com/Forums/vstudio/en-US/11d7e717-f1c2-4909-857d-2346f5a11c7e/why-casting-member-function-pointer-to-void-works?forum=vclanguage](http://social.msdn.microsoft.com/Forums/vstudio/en-US/11d7e717-f1c2-4909-857d-2346f5a11c7e/why-casting-member-function-pointer-to-void-works?forum=vclanguage)

 
とりあえずフォーラムにあったプログラムに似たものを書いて試してみます。こんなコード。個人的な慣習でファイルを main.cpp とtest.cpp に分けていますが、一つのファイルにまとめても問題ありません。

 
```
//  
// main.cpp  
//  
  
void RunTest();  
  
int main(int argc, char **argv) {  
    RunTest();  
    return 0;  
}  
  
//  
// test.cpp  
//  
  
#include <stdio.h>  
  
class ClassA {  
public:  
    void Func1() {  
        printf("+ClassA::Func1()\n");  
    }  
};  
  
void RunTest() {  
    void (ClassA::*p1)() = &ClassA::Func1;  
    void *p2 = (void*)p1;  
    void *p3 = (void*&)p1;  
    void *p4 = &(void*&)ClassA::Func1;  
  
    printf("size= %d\n", sizeof(void (ClassA::*)()));  
    printf("p1= %p, size= %d\n", p1, sizeof(p1));  
    printf("p2= %p, size= %d\n", p2, sizeof(p2));  
    printf("p3= %p, size= %d\n", p3, sizeof(p3));  
    printf("p4= %p, size= %d\n", p4, sizeof(p4));  
  
    ClassA a;  
    (a.*p1)();  
}  
```
 
Class::Func1 を 4 通りの方法で汎用ポインターにキャストするコードです。p4 への代入が Detours のサンプルと同じです。さて、これを Visual Studio 2013 でコンパイルしてみます。今回は Detours に倣って、Visual Studio を使わずに Makefile を作って nmake でビルドする方法をとります。

 
・・・。とかいって汎用的な Makefile を作るのに 1 時間以上かかるっていう・・・。何とかできたのがこれ。GNU Make と違って、タブ文字の代わりに半角スペースを使っても怒られません。この点は素晴らしい。ただし、wildcard とか使えないし、文法がけっこう違う。さすが MS。

 
```
#  
# http://msdn.microsoft.com/en-us/library/x6bt6xe7.aspx  
# http://keicode.com/winprimer/wp04-2.php  
#  
  
CC=cl  
LINKER=link  
RM=del /q  
  
TARGET=test.exe  
OUTDIR=.\bin  
OBJS=\  
$(OUTDIR)\main.obj\  
$(OUTDIR)\member.obj  
  
CFLAGS=\  
/nologo\  
/Zi\  
/c\  
/Fo"$(OUTDIR)\\"\  
/Fd"$(OUTDIR)\\"\  
/D_UNICODE\  
/DUNICODE\  
# /O2\  
/W4  
  
LFLAGS=\  
/NOLOGO\  
/DEBUG\  
/SUBSYSTEM:CONSOLE  
  
all: clean $(OUTDIR)\$(TARGET)  
  
clean:  
-@if not exist $(OUTDIR) md $(OUTDIR)  
@$(RM) /Q $(OUTDIR)\* 2>nul  
  
$(OUTDIR)\$(TARGET): $(OBJS)  
$(LINKER) $(LFLAGS) /PDB:"$(@R).pdb" /OUT:"$(OUTDIR)\$(TARGET)" $**  
  
.cpp{$(OUTDIR)}.obj:  
$(CC) $(CFLAGS) $<  
```
 
コード最適化は無効、警告レベルは 4 に留めています。-Wall にすると標準ヘッダーの stdio.h や Windows.h から大量の警告が出るので使えません。終わってますね。

 
メイクの仕方は GNU とほぼ同じで、ファイル名を Makefile にして、Visual Studio のプロンプトから nmake コマンドを実行するだけです。make ではなく **n**make となることに注意して下さい。で、結果はこちら。

 
```
G:4_VSDev\Projects\box>nmake  
  
Microsoft (R) Program Maintenance Utility Version 12.00.21005.1  
Copyright (C) Microsoft Corporation.  All rights reserved.  
  
        cl  /nologo /Zi /c /Fo".\bin\\" /Fd".\bin\\" /D_UNICODE /DUNICODE       /W4 main.cpp  
main.cpp  
main.cpp(3) : warning C4100: 'argv' : unreferenced formal parameter  
main.cpp(3) : warning C4100: 'argc' : unreferenced formal parameter  
        cl  /nologo /Zi /c /Fo".\bin\\" /Fd".\bin\\" /D_UNICODE /DUNICODE       /W4 member.cpp  
member.cpp  
member.cpp(12) : error C2440: 'type cast' : cannot convert from 'void (__cdecl ClassA::* )(void)' to 'void *'  
        There is no context in which this conversion is possible  
member.cpp(14) : error C2440: 'type cast' : cannot convert from 'void (__cdecl ClassA::* )(void)' to 'void *&'  
        Reason: cannot convert from 'overloaded-function' to 'void **'  
        There is no context in which this conversion is possible  
NMAKE : fatal error U1077: '"C:\Program Files (x86)\Microsoft Visual Studio 12.0\VC\BIN\amd64\cl.EXE"' : return code '0x2'  
Stop.  
```
 
Detours のサンプルと同じ C2440 エラーが p2 と p4 の代入のところで発生しました。ここで面白いのは、p3 の代入が通る点です。p2 との違いは、参照型の有無です。void* へはキャストできなくても、参照型の void*& にするとキャストが可能になるようです。

 
ということで、エラーになっていた p2 と p4 に関する処理はコメントにしてビルドし、実行結果を見るとこのようになります。

 
```
G:4_VSDev\Projects\box>nmake  
  
Microsoft (R) Program Maintenance Utility Version 12.00.21005.1  
Copyright (C) Microsoft Corporation.  All rights reserved.  
  
        cl  /nologo /Zi /c /Fo".\bin\\" /Fd".\bin\\" /D_UNICODE /DUNICODE       /W4 main.cpp  
main.cpp  
main.cpp(3) : warning C4100: 'argv' : unreferenced formal parameter  
main.cpp(3) : warning C4100: 'argc' : unreferenced formal parameter  
        cl  /nologo /Zi /c /Fo".\bin\\" /Fd".\bin\\" /D_UNICODE /DUNICODE       /W4 member.cpp  
member.cpp  
        link  /NOLOGO /DEBUG /SUBSYSTEM:CONSOLE /PDB:".\bin\test.pdb" /OUT:".\bin\test.exe" .\bin\main.obj .\bin\member.obj  
  
G:4_VSDev\Projects\box>bin\test.exe  
size= 8  
p1= 00007FF7F40D100A, size= 8  
p3= 00007FF7F40D100A, size= 8  
+ClassA::Func1()  
```
 
何の問題もなさそうです。念のためデバッガーを使って、どのようなコードが生成されたのかを確認します。

 
```
G:4_VSDev\Projects\box>E:\debuggers\pub.x64\cdb bin\test.exe  
  
Microsoft (R) Windows Debugger Version 6.3.9600.16384 AMD64  
Copyright (c) Microsoft Corporation. All rights reserved.  
  
CommandLine: bin\test.exe  
  
************* Symbol Path validation summary **************  
Response                         Time (ms)     Location  
Deferred                                       cache*E:\symbols.pub  
Deferred                                       srv*http://msdl.microsoft.com/download/symbols  
Symbol search path is: cache*E:\symbols.pub;srv*http://msdl.microsoft.com/download/symbols  
Executable search path is:  
ModLoad: 00007ff7`f40d0000 00007ff7`f4106000   test.exe  
ModLoad: 00007ffe`850e0000 00007ffe`8528c000   ntdll.dll  
ModLoad: 00007ffe`84570000 00007ffe`846ae000   C:\WINDOWS\system32\KERNEL32.DLL  
ModLoad: 00007ffe`82360000 00007ffe`82475000   C:\WINDOWS\system32\KERNELBASE.dll  
(3668.366c): Break instruction exception - code 80000003 (first chance)  
ntdll!LdrpDoDebuggerBreak+0x30:  
00007ffe`851a1dd0 cc              int     3  
0:000> uf test!RunTest  
*** WARNING: Unable to verify checksum for test.exe  
test!RunTest:  
00007ff7`f40d1050 4883ec48        sub     rsp,48h  
00007ff7`f40d1054 488d05afffffff  lea     rax,[test!ILT+5(?Func1ClassAQEAAXXZ) (00007ff7`f40d100a)]  
00007ff7`f40d105b 4889442428      mov     qword ptr [rsp+28h],rax  
00007ff7`f40d1060 488b442428      mov     rax,qword ptr [rsp+28h]  
00007ff7`f40d1065 4889442430      mov     qword ptr [rsp+30h],rax  
00007ff7`f40d106a ba08000000      mov     edx,8  
00007ff7`f40d106f 488d0da21c0200  lea     rcx,[test!__xt_z+0x148 (00007ff7`f40f2d18)]  
00007ff7`f40d1076 e849010000      call    test!printf (00007ff7`f40d11c4)  
00007ff7`f40d107b 41b808000000    mov     r8d,8  
00007ff7`f40d1081 488b542428      mov     rdx,qword ptr [rsp+28h]  
00007ff7`f40d1086 488d0d9b1c0200  lea     rcx,[test!__xt_z+0x158 (00007ff7`f40f2d28)]  
00007ff7`f40d108d e832010000      call    test!printf (00007ff7`f40d11c4)  
00007ff7`f40d1092 41b808000000    mov     r8d,8  
00007ff7`f40d1098 488b542430      mov     rdx,qword ptr [rsp+30h]  
00007ff7`f40d109d 488d0d9c1c0200  lea     rcx,[test!__xt_z+0x170 (00007ff7`f40f2d40)]  
00007ff7`f40d10a4 e81b010000      call    test!printf (00007ff7`f40d11c4)  
00007ff7`f40d10a9 488d4c2420      lea     rcx,[rsp+20h]  
00007ff7`f40d10ae ff542428        call    qword ptr [rsp+28h]  
00007ff7`f40d10b2 4883c448        add     rsp,48h  
00007ff7`f40d10b6 c3              ret  
0:000> bp 00007ff7`f40d10ae  
0:000> g  
size= 8  
p1= 00007FF7F40D100A, size= 8  
p3= 00007FF7F40D100A, size= 8  
Breakpoint 0 hit  
test!RunTest+0x5e:  
00007ff7`f40d10ae ff542428        call    qword ptr [rsp+28h] ss:000000d0`199ffaa8={test!ILT+5(?Func1ClassAQEAAXXZ) (000  
07ff7`f40d100a)}  
0:000> t  
test!ILT+5(?Func1ClassAQEAAXXZ):  
00007ff7`f40d100a e9c1000000      jmp     test!ClassA::Func1 (00007ff7`f40d10d0)  
0:000> g  
+ClassA::Func1()  
ntdll!NtTerminateProcess+0xa:  
00007ffe`85170f0a c3              ret  
0:000> q  
quit:  
```
 
C++ 上での &ClassA::Func1 には win32c!ILT+5(?Func1ClassAQEAAXXZ) というシンボルが割り当てられており、lea 命令でローカル変数領域の rsp+28 に代入されています。シンボルが指す00007ff7`f40d100a という数値が printf で出力される値であり、ポインターそのものの値と言えそうです。

 
変数の p1 経由でメンバ関数を呼び出すコードは、rsp+28h に保存したアドレスを call するようになっています。ただし 00007ff7`f40d100a は、Func1 の先頭ではなく、jmp 命令があるだけです。win32c!ILT+5 というシンボル名から分かるように、ポインターに代入されたアドレスは、ルックアップテーブル (ILT = Import Lookup Table) のアドレスになっています。

 
他のコンパイラーも試してみることにします。まずは gcc (Ubuntu 4.8.2-19ubuntu1) 4.8.2。GNU Make 用の Makefile はこんな感じ。これも作るのにけっこう時間がかかったのは内緒。

 
```
CC=gcc  
RM=rm -f  
TARGET=test  
SRCS=$(wildcard *.cpp)  
OBJS=$(SRCS:.cpp=.o)  
CFLAGS=-Wall 

all: clean $(TARGET) 
  
clean: 
        $(RM) $(OBJS) $(TARGET)  

$(TARGET): $(OBJS) 
        $(CC) -o $@ $^ $(LIBDIRS) $(LIBS)  

$(OBJS): $(SRC)  
        $(CC) $(INCLUDES) -c $(SRCS) 
```
 
そしてコンパイル結果がこれ。

 
```
john@ubuntu14041c:~/box$ make 
rm -f main.o member.o test 
gcc  -c main.cpp member.cpp 
member.cpp: In function evoid RunTest()f: 
member.cpp:12:23: warning: converting from evoid (ClassA::*)()f to evoid*f [-Wpmf-conversions] 
     void *p2 = (void*)p1; 
                       ^ 
member.cpp:14:33: error: invalid use of non-static member function evoid ClassA::Func1()f 
     void *p4 = &(void*&)ClassA::Func1; 
                                 ^ 
member.cpp:16:52: warning: format e%df expects argument of type eintf, but argument 2 has type  elong unsigned intf [-Wformat=] 
     printf("size= %d\n", sizeof(void (ClassA::*)())); 
                                                    ^ 
member.cpp:17:48: warning: format e%pf expects argument of type evoid*f, but argument 2 has type evoid (ClassA::*)()f [-Wformat=] 
     printf("p1= %p, size= %d\n", p1, sizeof(p1)); 
                                                ^ 
member.cpp:17:48: warning: format e%df expects argument of type eintf, but argument 3 has type  elong unsigned intf [-Wformat=] 
member.cpp:18:48: warning: format e%df expects argument of type eintf, but argument 3 has type  elong unsigned intf [-Wformat=] 
     printf("p2= %p, size= %d\n", p2, sizeof(p2)); 
                                                ^ 
member.cpp:19:48: warning: format e%df expects argument of type eintf, but argument 3 has type  elong unsigned intf [-Wformat=] 
     printf("p3= %p, size= %d\n", p3, sizeof(p3)); 
                                                ^ 
member.cpp:20:48: warning: format e%df expects argument of type eintf, but argument 3 has type  elong unsigned intf [-Wformat=] 
     printf("p4= %p, size= %d\n", p4, sizeof(p4)); 
                                                ^ 
make: *** [main.o] Error 1
```
 
警告は無視するとして、エラーは p4 の代入時の 1 つだけです。なんと p2 の代入は通りました。p4 関連の処理をコメントにして実行すると、結果は次のようになります。

 
```
john@ubuntu14041c:~/box$ ./test 
size= 16 
p1= 0x400670, size= 0 
p2= 0x400670, size= 8 
p3= 0x400670, size= 8 
+ClassA::Func1()
```
 
なんとなんと、メンバ関数へのポインターのサイズが、普通の 64bit ポインターの倍、16 バイトになっていました。でかい。ローカル変数 p1 のサイズが 16 バイトになるため、p1 の printf の結果が正しく出力されていません。一方、p2 と p3 は 8 バイトの汎用ポインターであるため、そもそも代入という操作は成立してはいけないことになります。p2 への代入については警告が出ていますが、参照型を付加した p3 への代入については警告は出ていません。コードがおかしいのは間違いないですが、警告は出て欲しいものです。gdb でデバッグしてみます。うーん使い慣れない・・。

 
```
john@ubuntu14041c:~/box$ gdb  ./test  
GNU gdb (Ubuntu 7.7-0ubuntu3.1) 7.7  
Copyright (C) 2014 Free Software Foundation, Inc.  
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>  
This is free software: you are free to change and redistribute it.  
There is NO WARRANTY, to the extent permitted by law.  Type "show copying"  
and "show warranty" for details.  
This GDB was configured as "x86_64-linux-gnu".  
Type "show configuration" for configuration details.  
For bug reporting instructions, please see:  
<http://www.gnu.org/software/gdb/bugs/>.  
Find the GDB manual and other documentation resources online at:  
<http://www.gnu.org/software/gdb/documentation/>.  
For help, type "help".  
Type "apropos word" to search for commands related to "word"...  
Reading symbols from ./test...(no debugging symbols found)...done.  
(gdb) disassemble /r RunTest  
Dump of assembler code for function _Z7RunTestv:  
   0x0000000000400598 <+0>:     55      push   %rbp  
   0x0000000000400599 <+1>:     48 89 e5        mov    %rsp,%rbp  
   0x000000000040059c <+4>:     48 83 ec 30     sub    $0x30,%rsp  
   0x00000000004005a0 <+8>:     48 c7 45 f0 70 06 40 00 movq   $0x400670,-0x10(%rbp)  
   0x00000000004005a8 <+16>:    48 c7 45 f8 00 00 00 00 movq   $0x0,-0x8(%rbp)  
   0x00000000004005b0 <+24>:    48 8b 45 f0     mov    -0x10(%rbp),%rax  
   0x00000000004005b4 <+28>:    83 e0 01        and    $0x1,%eax  
   0x00000000004005b7 <+31>:    48 85 c0        test   %rax,%rax  
   0x00000000004005ba <+34>:    75 06   jne    0x4005c2 <_Z7RunTestv+42>  
   0x00000000004005bc <+36>:    48 8b 45 f0     mov    -0x10(%rbp),%rax  
   0x00000000004005c0 <+40>:    eb 1d   jmp    0x4005df <_Z7RunTestv+71>  
   0x00000000004005c2 <+42>:    ba 00 00 00 00  mov    $0x0,%edx  
   0x00000000004005c7 <+47>:    48 8b 45 f8     mov    -0x8(%rbp),%rax  
   0x00000000004005cb <+51>:    48 01 d0        add    %rdx,%rax  
   0x00000000004005ce <+54>:    48 8b 10        mov    (%rax),%rdx  
   0x00000000004005d1 <+57>:    48 8b 45 f0     mov    -0x10(%rbp),%rax  
   0x00000000004005d5 <+61>:    48 83 e8 01     sub    $0x1,%rax  
   0x00000000004005d9 <+65>:    48 01 d0        add    %rdx,%rax  
   0x00000000004005dc <+68>:    48 8b 00        mov    (%rax),%rax  
   0x00000000004005df <+71>:    48 89 45 e0     mov    %rax,-0x20(%rbp)  
   0x00000000004005e3 <+75>:    48 8d 45 f0     lea    -0x10(%rbp),%rax  
   0x00000000004005e7 <+79>:    48 8b 00        mov    (%rax),%rax  
   0x00000000004005ea <+82>:    48 89 45 e8     mov    %rax,-0x18(%rbp)  
   0x00000000004005ee <+86>:    be 10 00 00 00  mov    $0x10,%esi  
   0x00000000004005f3 <+91>:    bf 25 07 40 00  mov    $0x400725,%edi  
   0x00000000004005f8 <+96>:    b8 00 00 00 00  mov    $0x0,%eax  
   0x00000000004005fd <+101>:   e8 5e fe ff ff  callq  0x400460 <printf@plt>  
   0x0000000000400602 <+106>:   48 8b 55 f0     mov    -0x10(%rbp),%rdx  
   0x0000000000400606 <+110>:   48 8b 45 f8     mov    -0x8(%rbp),%rax  
   0x000000000040060a <+114>:   b9 10 00 00 00  mov    $0x10,%ecx  
   0x000000000040060f <+119>:   48 89 d6        mov    %rdx,%rsi  
   0x0000000000400612 <+122>:   48 89 c2        mov    %rax,%rdx  
   0x0000000000400615 <+125>:   bf 2f 07 40 00  mov    $0x40072f,%edi  
   0x000000000040061a <+130>:   b8 00 00 00 00  mov    $0x0,%eax  
   0x000000000040061f <+135>:   e8 3c fe ff ff  callq  0x400460 <printf@plt>  
   0x0000000000400624 <+140>:   48 8b 45 e0     mov    -0x20(%rbp),%rax  
   0x0000000000400628 <+144>:   ba 08 00 00 00  mov    $0x8,%edx  
   0x000000000040062d <+149>:   48 89 c6        mov    %rax,%rsi  
   0x0000000000400630 <+152>:   bf 41 07 40 00  mov    $0x400741,%edi  
   0x0000000000400635 <+157>:   b8 00 00 00 00  mov    $0x0,%eax  
   0x000000000040063a <+162>:   e8 21 fe ff ff  callq  0x400460 <printf@plt>  
   0x000000000040063f <+167>:   48 8b 45 e8     mov    -0x18(%rbp),%rax  
   0x0000000000400643 <+171>:   ba 08 00 00 00  mov    $0x8,%edx  
   0x0000000000400648 <+176>:   48 89 c6        mov    %rax,%rsi  
   0x000000000040064b <+179>:   bf 53 07 40 00  mov    $0x400753,%edi  
---Type <return> to continue, or q <return> to quit---  
   0x0000000000400650 <+184>:   b8 00 00 00 00  mov    $0x0,%eax  
   0x0000000000400655 <+189>:   e8 06 fe ff ff  callq  0x400460 <printf@plt>  
   0x000000000040065a <+194>:   48 8b 45 f0     mov    -0x10(%rbp),%rax  
   0x000000000040065e <+198>:   48 8b 55 f8     mov    -0x8(%rbp),%rdx  
   0x0000000000400662 <+202>:   48 8d 4d df     lea    -0x21(%rbp),%rcx  
   0x0000000000400666 <+206>:   48 01 ca        add    %rcx,%rdx  
   0x0000000000400669 <+209>:   48 89 d7        mov    %rdx,%rdi  
   0x000000000040066c <+212>:   ff d0   callq  *%rax  
   0x000000000040066e <+214>:   c9      leaveq  
   0x000000000040066f <+215>:   c3      retq  
End of assembler dump.  
(gdb) break *0x000000000040066c  
Breakpoint 1 at 0x40066c  
(gdb) r  
Starting program: /home/john/box/test  
size= 16  
p1= 0x400670, size= 0  
p2= 0x400670, size= 8  
p3= 0x400670, size= 8  
  
Breakpoint 1, 0x000000000040066c in RunTest() ()  
(gdb) info registers  
rax            0x400670 4195952  
rbx            0x0      0  
rcx            0x7fffffffe59f   140737488348575  
rdx            0x7fffffffe59f   140737488348575  
rsi            0x7fffffea       2147483626  
rdi            0x7fffffffe59f   140737488348575  
rbp            0x7fffffffe5c0   0x7fffffffe5c0  
rsp            0x7fffffffe590   0x7fffffffe590  
r8             0x7ffff7b8b900   140737349466368  
r9             0x0      0  
r10            0x7ffff7dd26a0   140737351853728  
r11            0x246    582  
r12            0x400490 4195472  
r13            0x7fffffffe6c0   140737488348864  
r14            0x0      0  
r15            0x0      0  
rip            0x40066c 0x40066c <RunTest()+212>  
eflags         0x206    [ PF IF ]  
cs             0x33     51  
ss             0x2b     43  
ds             0x0      0  
es             0x0      0  
fs             0x0      0  
gs             0x0      0  
(gdb) x/16bx $rbp-0x21  
0x7fffffffe59f: 0x00    0x70    0x06    0x40    0x00    0x00    0x00    0x00  
0x7fffffffe5a7: 0x00    0x70    0x06    0x40    0x00    0x00    0x00    0x00  
(gdb) si  
0x0000000000400670 in ClassA::Func1() ()  
(gdb) disassemble /r $rip  
Dump of assembler code for function _ZN6ClassA5Func1Ev:  
=> 0x0000000000400670 <+0>:     55      push   %rbp  
   0x0000000000400671 <+1>:     48 89 e5        mov    %rsp,%rbp  
   0x0000000000400674 <+4>:     48 83 ec 10     sub    $0x10,%rsp  
   0x0000000000400678 <+8>:     48 89 7d f8     mov    %rdi,-0x8(%rbp)  
   0x000000000040067c <+12>:    bf 14 07 40 00  mov    $0x400714,%edi  
   0x0000000000400681 <+17>:    e8 ca fd ff ff  callq  0x400450 <puts@plt>  
   0x0000000000400686 <+22>:    c9      leaveq  
   0x0000000000400687 <+23>:    c3      retq  
End of assembler dump.  
(gdb) x/s "0x400714  
Unterminated string in expression.  
(gdb) x/s 0x400714  
0x400714:       "+ClassA::Func1()"  
(gdb)  
```
 
何これ。Windows とは全然違う内容が広がっている・・。

 
まず、気になる 16 バイトの変数の正体ですが、mov を 2 回実行して 0x0, 0x400670 という即値をローカル変数領域に保存しています。これがメンバ関数ポインターの正体です。面白いのは (a.*p1)(); `を実行するところです。変数は 16 バイトですが、メンバ関数のアドレスは 8 バイトです。これは 16 バイトのうち下位 8 バイトが関数アドレスになっているようで、rbp-10 に保存したアドレスを rax に入れて call しています。では、上位 8 バイトは何に使われるのでしょうか。今回の例では、値は 0 です。

 
この 4 つの命令がそれです。

 
```
0x000000000040065e <+198>:   48 8b 55 f8     mov    -0x8(%rbp),%rdx 
0x0000000000400662 <+202>:   48 8d 4d df     lea    -0x21(%rbp),%rcx 
0x0000000000400666 <+206>:   48 01 ca        add    %rcx,%rdx 
0x0000000000400669 <+209>:   48 89 d7        mov    %rdx,%rdi
```
 
上位 8 バイトを取り出して、rbp-21 に加算してから rdi に入れています。gcc の x64 における thiscall はよく分かりませんが、this ポインターは rdi として渡すようです。この動作は printf 関数の第一引数を edi に入れていることからも裏付けられます。this ポインター、すなわち RunTest におけるオブジェクト a はローカル変数なので、おそらく rbp-21 です。デバッグの例だと値は 0x7fffffffe59f です。ポインターの癖にアラインされていませんね。実に奇妙です。

 
rbp-21 の中身をダンプすると、オフセット+1 のところに ClassA::Func1 のアドレスと一致する 00400670 という数値が見つかりました。Windows 的に考えると先頭の 1 バイトがかなり邪魔です。フラグとして使われるなど、何か意味があるのでしょうか。

 
メンバ関数ポインターの上位 8 バイトは、rbp-21 からのオフセットとして使われています。gcc が作るバイナリにおいて、this ポインターの値はオブジェクトの先頭という意味ではなく、オフセットを使って適当な位置を指し示す際の起点、という意味合いなのかもしれません。コードをいろいろ変えてみて、オフセットが 0 以外になるのがどんな場合なのかを調べてみたいものです。

 
最後に OS X で試してみます。コンパイラーは gcc ではなく clang です。バージョンはこれ↓

 
```
proline:box $ clang --version 
Apple LLVM version 6.0 (clang-600.0.54) (based on LLVM 3.5svn) 
Target: x86_64-apple-darwin14.0.0 
Thread model: posix
```
 
make は GNU Make を使うので、Makefile は ubuntu と同じのをそのまま使えます、が、一行目を CC=clang をに変えておきます。gcc を実行しても、clang が実行されるだけです。

 
```
$ make  
rm -f main.o member.o test  
clang  -c main.cpp member.cpp  
member.cpp:12:16: error: cannot cast from type 'void (ClassA::*)()' to pointer type 'void *'  
    void *p2 = (void*)p1;  
               ^~~~~~~~~  
member.cpp:14:33: error: call to non-static member function without an object argument  
    void *p4 = &(void*&)ClassA::Func1;  
                        ~~~~~~~~^~~~~  
member.cpp:16:26: warning: format specifies type 'int' but the argument has type 'unsigned long'  
      [-Wformat]  
    printf("size= %d\n", sizeof(void (ClassA::*)()));  
                  ~~     ^~~~~~~~~~~~~~~~~~~~~~~~~~  
                  %lu  
member.cpp:17:34: warning: format specifies type 'void *' but the argument has type  
      'void (ClassA::*)()' [-Wformat]  
    printf("p1= %p, size= %d\n", p1, sizeof(p1));  
                ~~               ^~  
member.cpp:17:38: warning: format specifies type 'int' but the argument has type 'unsigned long'  
      [-Wformat]  
    printf("p1= %p, size= %d\n", p1, sizeof(p1));  
                          ~~         ^~~~~~~~~~  
                          %lu  
member.cpp:18:38: warning: format specifies type 'int' but the argument has type 'unsigned long'  
      [-Wformat]  
    printf("p2= %p, size= %d\n", p2, sizeof(p2));  
                          ~~         ^~~~~~~~~~  
                          %lu  
member.cpp:19:38: warning: format specifies type 'int' but the argument has type 'unsigned long'  
      [-Wformat]  
    printf("p3= %p, size= %d\n", p3, sizeof(p3));  
                          ~~         ^~~~~~~~~~  
                          %lu  
member.cpp:20:38: warning: format specifies type 'int' but the argument has type 'unsigned long'  
      [-Wformat]  
    printf("p4= %p, size= %d\n", p4, sizeof(p4));  
                          ~~         ^~~~~~~~~~  
                          %lu  
6 warnings and 2 errors generated.  
make: *** [main.o] Error 1  
$  
```
 
gcc と同じ結果になるんだろうと予想していましたが、意外なことに Visual Studio と同じです。p4 はもちろん、p2 の代入についても怒られました。こちらも同じく p3 の代入は警告も出ず、スルーです。これは参照型の裏技だなぁ・・。

 
p2 と p4 をコメントにして、実行結果はこうなりました。今度は gcc と同じで、16 バイトの変数が使われています。

 
```
proline:box $ ./test 
size= 16 
p1= 0x101037f00, size= 0 
p3= 0x101037f00, size= 8 
+ClassA::Func1()
```
 
次に lldb でデバッグします。gdb とはコマンドが似ているようで違うので困ります。好みの問題かもしれませんが、オプションの指定方法や出力結果は lldb の方が洗練されている気がします。

 
ポインター周りの動作は gcc とほぼ同じです。16 バイトのうち、下位 8 バイトが実際の関数アドレス 0x0000000100000f00 になっています。

 
```
proline:box $ sudo lldb ./test  
(lldb) target create "./test"  
Current executable set to './test' (x86_64).  
(lldb) disassemble -b -n RunTest  
test`RunTest():  
test[0x100000de0]:  55                       pushq  %rbp  
test[0x100000de1]:  48 89 e5                 movq   %rsp, %rbp  
test[0x100000de4]:  48 83 ec 70              subq   $0x70, %rsp  
test[0x100000de8]:  48 8d 45 d0              leaq   -0x30(%rbp), %rax  
test[0x100000dec]:  48 8b 0d 1d 02 00 00     movq   0x21d(%rip), %rcx         ; (void *)0x0000000100000f00: ClassA::Func1()  
test[0x100000df3]:  48 89 4d f0              movq   %rcx, -0x10(%rbp)  
test[0x100000df7]:  48 c7 45 f8 00 00 00 00  movq   $0x0, -0x8(%rbp)  
test[0x100000dff]:  48 8b 4d f0              movq   -0x10(%rbp), %rcx  
test[0x100000e03]:  48 89 4d e8              movq   %rcx, -0x18(%rbp)  
test[0x100000e07]:  48 8d 3d 38 01 00 00     leaq   0x138(%rip), %rdi         ; "size= %d\n"  
test[0x100000e0e]:  ba 10 00 00 00           movl   $0x10, %edx  
test[0x100000e13]:  89 d1                    movl   %edx, %ecx  
test[0x100000e15]:  31 d2                    xorl   %edx, %edx  
test[0x100000e17]:  40 88 d6                 movb   %dl, %sil  
test[0x100000e1a]:  40 88 75 cf              movb   %sil, -0x31(%rbp)  
test[0x100000e1e]:  48 89 ce                 movq   %rcx, %rsi  
test[0x100000e21]:  44 8a 45 cf              movb   -0x31(%rbp), %r8b  
test[0x100000e25]:  48 89 45 c0              movq   %rax, -0x40(%rbp)  
test[0x100000e29]:  44 88 c0                 movb   %r8b, %al  
test[0x100000e2c]:  48 89 4d b8              movq   %rcx, -0x48(%rbp)  
test[0x100000e30]:  e8 f1 00 00 00           callq  0x100000f26               ; symbol stub for: printf  
test[0x100000e35]:  48 8b 4d f0              movq   -0x10(%rbp), %rcx  
test[0x100000e39]:  48 8b 75 f8              movq   -0x8(%rbp), %rsi  
test[0x100000e3d]:  48 89 75 e0              movq   %rsi, -0x20(%rbp)  
test[0x100000e41]:  48 89 4d d8              movq   %rcx, -0x28(%rbp)  
test[0x100000e45]:  48 8b 75 d8              movq   -0x28(%rbp), %rsi  
test[0x100000e49]:  48 8b 55 e0              movq   -0x20(%rbp), %rdx  
test[0x100000e4d]:  48 8d 3d fc 00 00 00     leaq   0xfc(%rip), %rdi          ; "p1= %p, size= %d\n"  
test[0x100000e54]:  48 8b 4d b8              movq   -0x48(%rbp), %rcx  
test[0x100000e58]:  44 8a 45 cf              movb   -0x31(%rbp), %r8b  
test[0x100000e5c]:  89 45 b4                 movl   %eax, -0x4c(%rbp)  
test[0x100000e5f]:  44 88 c0                 movb   %r8b, %al  
test[0x100000e62]:  e8 bf 00 00 00           callq  0x100000f26               ; symbol stub for: printf  
test[0x100000e67]:  48 8b 75 e8              movq   -0x18(%rbp), %rsi  
test[0x100000e6b]:  48 8d 3d f0 00 00 00     leaq   0xf0(%rip), %rdi          ; "p3= %p, size= %d\n"  
test[0x100000e72]:  41 b9 08 00 00 00        movl   $0x8, %r9d  
test[0x100000e78]:  44 89 ca                 movl   %r9d, %edx  
test[0x100000e7b]:  44 8a 45 cf              movb   -0x31(%rbp), %r8b  
test[0x100000e7f]:  89 45 b0                 movl   %eax, -0x50(%rbp)  
test[0x100000e82]:  44 88 c0                 movb   %r8b, %al  
test[0x100000e85]:  e8 9c 00 00 00           callq  0x100000f26               ; symbol stub for: printf  
test[0x100000e8a]:  48 8b 4d f0              movq   -0x10(%rbp), %rcx  
test[0x100000e8e]:  48 8b 55 f8              movq   -0x8(%rbp), %rdx  
test[0x100000e92]:  48 8b 75 c0              movq   -0x40(%rbp), %rsi  
test[0x100000e96]:  48 01 d6                 addq   %rdx, %rsi  
test[0x100000e99]:  48 89 ca                 movq   %rcx, %rdx  
test[0x100000e9c]:  48 81 e2 01 00 00 00     andq   $0x1, %rdx  
test[0x100000ea3]:  48 81 fa 00 00 00 00     cmpq   $0x0, %rdx  
test[0x100000eaa]:  89 45 ac                 movl   %eax, -0x54(%rbp)  
test[0x100000ead]:  48 89 4d a0              movq   %rcx, -0x60(%rbp)  
test[0x100000eb1]:  48 89 75 98              movq   %rsi, -0x68(%rbp)  
test[0x100000eb5]:  0f 84 1f 00 00 00        je     0x100000eda               ; RunTest() + 250  
test[0x100000ebb]:  48 8b 45 98              movq   -0x68(%rbp), %rax  
test[0x100000ebf]:  48 8b 08                 movq   (%rax), %rcx  
test[0x100000ec2]:  48 8b 55 a0              movq   -0x60(%rbp), %rdx  
test[0x100000ec6]:  48 81 ea 01 00 00 00     subq   $0x1, %rdx  
test[0x100000ecd]:  48 8b 0c 11              movq   (%rcx,%rdx), %rcx  
test[0x100000ed1]:  48 89 4d 90              movq   %rcx, -0x70(%rbp)  
test[0x100000ed5]:  e9 08 00 00 00           jmp    0x100000ee2               ; RunTest() + 258  
test[0x100000eda]:  48 8b 45 a0              movq   -0x60(%rbp), %rax  
test[0x100000ede]:  48 89 45 90              movq   %rax, -0x70(%rbp)  
test[0x100000ee2]:  48 8b 45 90              movq   -0x70(%rbp), %rax  
test[0x100000ee6]:  48 8b 7d 98              movq   -0x68(%rbp), %rdi  
test[0x100000eea]:  ff d0                    callq  *%rax  
test[0x100000eec]:  48 83 c4 70              addq   $0x70, %rsp  
test[0x100000ef0]:  5d                       popq   %rbp  
test[0x100000ef1]:  c3                       retq  
test[0x100000ef2]:  90                       nop  
test[0x100000ef3]:  90                       nop  
test[0x100000ef4]:  90                       nop  
test[0x100000ef5]:  90                       nop  
test[0x100000ef6]:  90                       nop  
test[0x100000ef7]:  90                       nop  
test[0x100000ef8]:  90                       nop  
test[0x100000ef9]:  90                       nop  
test[0x100000efa]:  90                       nop  
test[0x100000efb]:  90                       nop  
test[0x100000efc]:  90                       nop  
test[0x100000efd]:  90                       nop  
test[0x100000efe]:  90                       nop  
test[0x100000eff]:  90                       nop  
  
(lldb) break set -a 0x100000eea  
Breakpoint 1: address = 0x0000000100000eea  
(lldb) r  
Process 626 launched: './test' (x86_64)  
size= 16  
p1= 0x100000f00, size= 0  
p3= 0x100000f00, size= 8  
Process 626 stopped  
* thread #1: tid = 0x20d7, 0x0000000100000eea test`RunTest() + 266, queue = 'com.apple.main-thread', stop reason = breakpoint 1.1  
    frame #0: 0x0000000100000eea test`RunTest() + 266  
test`RunTest() + 266:  
-> 0x100000eea:  callq  *%rax  
   0x100000eec:  addq   $0x70, %rsp  
   0x100000ef0:  popq   %rbp  
   0x100000ef1:  retq  
(lldb) reg read  
General Purpose Registers:  
       rax = 0x0000000100000f00  test`ClassA::Func1()  
       rbx = 0x0000000000000000  
       rcx = 0x0000000100000f00  test`ClassA::Func1()  
       rdx = 0x0000000000000000  
       rdi = 0x00007fff5fbffc90  
       rsi = 0x00007fff5fbffc90  
       rbp = 0x00007fff5fbffcc0  
       rsp = 0x00007fff5fbffc50  
        r8 = 0x00007fff5fbffaf0  
        r9 = 0x00007fff75a3b300  libsystem_pthread.dylib`_thread  
       r10 = 0x000000000000000a  
       r11 = 0x0000000000000246  
       r12 = 0x0000000000000000  
       r13 = 0x0000000000000000  
       r14 = 0x0000000000000000  
       r15 = 0x0000000000000000  
       rip = 0x0000000100000eea  test`RunTest() + 266  
    rflags = 0x0000000000000246  
        cs = 0x000000000000002b  
        fs = 0x0000000000000000  
        gs = 0x0000000000000000  
  
(lldb) disassemble -b -a 0x0000000100000f00  
test`ClassA::Func1():  
   0x100000f00:  55                    pushq  %rbp  
   0x100000f01:  48 89 e5              movq   %rsp, %rbp  
   0x100000f04:  48 83 ec 10           subq   $0x10, %rsp  
   0x100000f08:  48 8d 05 65 00 00 00  leaq   0x65(%rip), %rax          ; "+ClassA::Func1()\n"  
   0x100000f0f:  48 89 7d f8           movq   %rdi, -0x8(%rbp)  
   0x100000f13:  48 89 c7              movq   %rax, %rdi  
   0x100000f16:  b0 00                 movb   $0x0, %al  
   0x100000f18:  e8 09 00 00 00        callq  0x100000f26               ; symbol stub for: printf  
   0x100000f1d:  89 45 f4              movl   %eax, -0xc(%rbp)  
   0x100000f20:  48 83 c4 10           addq   $0x10, %rsp  
   0x100000f24:  5d                    popq   %rbp  
   0x100000f25:  c3                    retq  
```
 
上位 8 バイトには 0 が代入されるところまでは gcc と同じですが、メンバ関数を呼び出す処理が複雑怪奇なことになっています。何か上位 8 バイトの値に応じて条件分岐とか出てきているし・・・何だこれは。最終的には rdi レジスターの値を作るオフセットとして使われ、this ポインターになるところは同じようです。

 
```
test[0x100000e8a]:  48 8b 4d f0              movq   -0x10(%rbp), %rcx 
test[0x100000e8e]:  48 8b 55 f8              movq   -0x8(%rbp), %rdx 
test[0x100000e92]:  48 8b 75 c0              movq   -0x40(%rbp), %rsi 
test[0x100000e96]:  48 01 d6                 addq   %rdx, %rsi 
test[0x100000e99]:  48 89 ca                 movq   %rcx, %rdx 
test[0x100000e9c]:  48 81 e2 01 00 00 00     andq   $0x1, %rdx 
test[0x100000ea3]:  48 81 fa 00 00 00 00     cmpq   $0x0, %rdx 
test[0x100000eaa]:  89 45 ac                 movl   %eax, -0x54(%rbp) 
test[0x100000ead]:  48 89 4d a0              movq   %rcx, -0x60(%rbp) 
test[0x100000eb1]:  48 89 75 98              movq   %rsi, -0x68(%rbp) 
test[0x100000eb5]:  0f 84 1f 00 00 00        je     0x100000eda               ; RunTest() + 250

test[0x100000ebb]:  48 8b 45 98              movq   -0x68(%rbp), %rax 
test[0x100000ebf]:  48 8b 08                 movq   (%rax), %rcx 
test[0x100000ec2]:  48 8b 55 a0              movq   -0x60(%rbp), %rdx 
test[0x100000ec6]:  48 81 ea 01 00 00 00     subq   $0x1, %rdx 
test[0x100000ecd]:  48 8b 0c 11              movq   (%rcx,%rdx), %rcx 
test[0x100000ed1]:  48 89 4d 90              movq   %rcx, -0x70(%rbp) 
test[0x100000ed5]:  e9 08 00 00 00           jmp    0x100000ee2               ; RunTest() + 258

test[0x100000eda]:  48 8b 45 a0              movq   -0x60(%rbp), %rax 
test[0x100000ede]:  48 89 45 90              movq   %rax, -0x70(%rbp)

test[0x100000ee2]:  48 8b 45 90              movq   -0x70(%rbp), %rax 
test[0x100000ee6]:  48 8b 7d 98              movq   -0x68(%rbp), %rdi 
test[0x100000eea]:  ff d0                    callq  *%rax
```
 
今回は力尽きたのであまり深入りせずにここまで。メンバー関数ポインター、及びコンパイラ依存コードは深い。

