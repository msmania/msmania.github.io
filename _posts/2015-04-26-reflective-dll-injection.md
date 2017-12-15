---
layout: post
title: "Reflective DLL Injection"
date: 2015-04-26 23:39:21.000 -07:00
categories:
- Asm
- C/C++
- Security
- Windows
tags:
- CreateRemoteThread
- WriteProcessMemory
---

社内のツールで、任意のプロセスに対して DLL のコードを埋め込んでそれを呼び出すツールがありました。そのソースを見ると、VirtualAllocEx、WriteProessMemory、そして CreateRemoteThread を使ってけっこう簡単に他プロセスへのコードの埋め込みを実現していました。

 
VirtualAllocEx function (Windows) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/aa366890(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/aa366890(v=vs.85).aspx)

 
CreateRemoteThread function (Windows) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/ms682437(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/ms682437(v=vs.85).aspx)

 
何これ超便利・・・と感動しつつこの方法についてググると、かなり古くから知られた手法の一つのようで、"createremotethread virtualallocex コード" などのキーワードで日本語のサイトもたくさんヒットします。検索上位に来て分かりやすいのが↓あたり。CreateRemoteThread 以外にも、ウィンドウのサブクラス化を使う方法がメジャーなようです。

 
ドリーム工房 - デスクトップを乗っ取る <br />
[http://www18.atpages.jp/skydreamer/maniax/desktop.php](http://www18.atpages.jp/skydreamer/maniax/desktop.php)

 
別のプロセスにコードを割り込ませる3つの方法 - インターネットコム <br />
[http://internetcom.jp/developer/20050830/26.html](http://internetcom.jp/developer/20050830/26.html)

 
上記の一つ目のサイトで紹介されている方法は、事前にアセンブリ言語で書いておいたペイロードを WriteProcessMemory でターゲットに埋め込んでおいて、そのアドレスを開始アドレスとしてCreateRemoteThreaad を呼び出しています。ペイロードの中に LoadLibrary する DLL のファイル名をハードコードして、LoadLibrary を直接アドレス指定で call しています。

 
二つ目のサイトの方法はもっと単純で、開始アドレスを LoadLibrary のアドレスにし、リモートスレッドのパラメーターとして、予めターゲットに埋め込んておいた DLL のファイル名となる文字列のアドレスを渡すというものです。

 
これらの方法は、Kernel32.dll に実装された LoadLibrary() のエントリポイント (実体は kernelbase.dll) がプロセス間で共有であるという前提に基づいています。この前提については、上記 internetcom.jp の 「付録 A）なぜKERNEL32.DLLとUSER32.DLLは常に同じアドレスにマッピングされるのか」 で説明されています。

 
これだけでも十分に実用に値するのですが、個人的にはちょっとエレガントさに欠ける気がします。そもそも、kernel32.dll が同じところにマップされるという前提に依存するのがあまり美しくないのですが、もう一つ問題点があります。インジェクターとターゲットのビット数が違うときに、LoadLibrary のアドレスをインジェクター側で取得できないという点です。インジェクターが 64bit プロセスのときは、64bit kernel32.dll 上の LoadLibrary のアドレスが取得できますが、ターゲットが 32bit のときにこれは使えません。逆の場合も同じです。とはいっても些細な問題であり、32bit と 64bit それぞれのインジェクターを用意すればいいだけの話ですが、ターゲットによってインジェクターを変えるのはやはり美しくないのです。

 
後始末の問題もあります。ターゲットの中で LoadLibrary を実行することができれば、ロードした DLL の DllMain が呼ばれるので、そこからまた新たに新しいスレッドを作るなどして任意のコードを実行させることができます（ローダーロックの問題があるので、DllMain 関数自体はさっさと終わらせないとおかしなことになる、はず。）。また、立つ鳥跡を濁さず、という諺もあるように、全てが終わった後は DLL は FreeLibrary され、さらに VirtualAllocEx しておいたメモリ領域も解放されている、というのが日本的美的センスから見た美しいコード インジェクションではないでしょうか。

 
簡単そうなのは、ターゲットプロセスではなくインジェクターで後処理を行う方法です。これは上記のinternetcom.jp で紹介されています。メモリ領域の解放は単純に VirtualFreeEx を呼ぶだけですが、FreeLibrary には少しトリックが必要です。というのも、FreeLibrary を呼ぶためには、LoadLibrary からの戻り値である HMODULE、すなわちロードされた DLL のベース アドレスが必要だからです。紹介されている例では、CreateRemoteThread で起動したリモートスレッドが終了するまで待機してから、ベース アドレスをスレッドの終了コードとして GetExitCodeThread を使って取得しています。これはなかなか面白い方法ですが、64bit だと使えないはずです。なぜなら、スレッドの開始関数である LPTHREAD_START_ROUTINE は、本来 DWORD を返すことが想定されており、GetExitCodeThread で取得できるのも DWORD の 32bit 整数だけです。64bit では当然 HMODULE も 64bit アドレスなので、GetExitCodeThread だと、イメージベースの 上位 32bit を取得できません。そのほかの方法として、インジェクトしたコードの中でイメージベースをバッファー内に書き込んでおいて、それをインジェクター側から参照する方法が考えられます。これなら任意のサイズのデータをターゲットからインジェクターに返すことができるので、64bit でも問題はありません。ただ、そもそものデザインとして、インジェクター側でリモート スレッドの終了を待機するのは不満です。

 
というわけで、後処理をターゲット内で行う方法を考えます。ターゲット内で後処理を行う場合、単純な関数呼び出しで FreeLibrary や VirtualFree を実行して後処理を行うと、制御が戻ってきたときのリターン アドレスが解放済みになってしまうため、アクセス違反が起こります。これもいわゆる use-after-free でしょうか。

 
そこでまず、FreeLibrary は DLL 外部から実行する必要があります。これは上述の 1 つ目のサイト (ドリーム工房) で紹介されている方法のように、アセンブリで書いたシェルコードを用意してそこから LoadLibrary/FreeLibrary を呼べば解決です。

 
シェルコードがあるのであれば、メモリ解放についても、VirtualFree をそのまま call するのではなく、スタックを自分で積んでから jmp で VirtualFree を実行することで、VirtualFree 実行後のコード位置を指定して use-after-free 問題を解決できそうです。

 
アセンブリでシェルコードを書く場合でも、ドリーム工房の方法のように、インジェクター側で取得したアドレスをシェルコードに動的に埋め込むことは可能です、が、何とかしてシェルコード内でイメージベースのアドレスを取得したいところです。そんな方法はないものかと探したところ、けっこう簡単に見つかりました。それがこれ、今回の記事のタイトルにした Reflective DLL Injection。

 
GitHub - stephenfewer/ReflectiveDLLInjection <br />
[https://github.com/stephenfewer/ReflectiveDLLInjection/](https://github.com/stephenfewer/ReflectiveDLLInjection/)

 
ポイントは dll/src/ReflectiveLoader.c に実装された ReflectiveLoader という関数です。そういえば昔覚えたことをすっかり忘れていましたが、Windows では、セグメント レジスタ fs または gs が指すセグメントに PEB や TEB を保存しています。覚えておくとけっこう使えます。

 
Wikipedia にも情報があります。

 
Win32 Thread Information Block - Wikipedia, the free encyclopedia <br />
[http://en.wikipedia.org/wiki/Win32_Thread_Information_Block](http://en.wikipedia.org/wiki/Win32_Thread_Information_Block)

 
このセグメントレジスタはけっこう身近なところでも使われています。最たる例は、GetLastError() や GetCurrentProcessId() で、x86/x64 それぞれのアセンブリを示すとこんな感じです。また、ちゃんと確かめていませんが、metasploit で遊んでいた時に meterpreter の先頭のコードでもセグメント レジスタを見ていた記憶があります。

 
```
0:000> uf kernelbase!GetLastError 
KERNELBASE!GetLastError: 
775cecd0 64a118000000    mov     eax,dword ptr fs:[00000018h] 
775cecd6 8b4034          mov     eax,dword ptr [eax+34h] 
775cecd9 c3              ret 
0:000> uf kernelbase!GetCurrentProcessId 
KERNELBASE!GetCurrentProcessId: 
7767cf60 64a118000000    mov     eax,dword ptr fs:[00000018h] 
7767cf66 8b4020          mov     eax,dword ptr [eax+20h] 
7767cf69 c3              ret

0:000> uf kernelbase!GetLastError 
KERNELBASE!GetLastError: 
00007ffe`d4f21470 65488b042530000000 mov   rax,qword ptr gs:[30h] 
00007ffe`d4f21479 8b4068          mov     eax,dword ptr [rax+68h] 
00007ffe`d4f2147c c3              ret 
0:000> uf kernelbase!GetCurrentProcessId 
KERNELBASE!GetCurrentProcessId: 
00007ffe`d4f98b60 65488b042530000000 mov   rax,qword ptr gs:[30h] 
00007ffe`d4f98b69 8b4040          mov     eax,dword ptr [rax+40h] 
00007ffe`d4f98b6c c3              ret
```
 
上記関数は、TEB にある情報を使うので、x86 では fs:18h、x64 では gs:30h のアドレスが TEB であると分かります。

 
Reflective DLL Injection は、PEB にあるロード済みモジュールのリストからイメージ ベースを取得しています。以下の MSDN に書かれているように、PEB::Ldr-&gt;InMemoryOrderModuleList が示すデータには、ロード済みモジュールの名前とベースアドレスの双方向リンクト リストが入っています。

 
PEB structure (Windows) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/aa813706(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/aa813706(v=vs.85).aspx)

 
PEB_LDR_DATA structure (Windows) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/aa813708(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/aa813708(v=vs.85).aspx)

 
というわけで、以下のロジックをアセンブリで書いて CreateRemoteThread で埋め込めば、まさに実現したい動作が可能です。

 
1. セグメント レジスタから PEB を取得 
1. PEB からロード済モジュール リストを取得 
1. リストから Kernel32.dll のベースアドレスを取得 <br />
(ユーザーモード プロセスに kernel32.dll は必ずロードされていると考えてよい) 
1. ベースアドレスから PE イメージの構造を解析し、エクスポート テーブルを取得 
1. エクスポート テーブルを検索して LoadLibrary の開始アドレスを取得 

 
少々めんどくさそうですが、一旦 C で書いて、コンパイルされたアセンブリを整形すればそれほど難しくはないはずです。

 
この方法を使えば、LoadLibrary だけでなく、シェルコードの中で実行したい API のアドレスを全部取得することができます。また、本記事とは関係ありませんが、コード領域内をパターン検索すれば、エクスポートされていない関数のアドレスも探せるはずです。とにかく、これで後片付けの問題は解決しました。すなわち、シェルコードを以下のようなロジックにします。

 
1. LoadLibrary で好きな DLL をロード (ファイル パスは予めバッファーに入れておく) 
1. GetProcAddress でエクスポート関数のアドレスをゲット (DllMain には何も書かなくてよい) 
1. 関数を単純に call で実行 
1. FreeLibrary で DLL をアンロード 
1. ExitThread のアドレスを push して VirtualFree に jmp

 
というわけで書いたコードがこれ↓

 
[https://github.com/msmania/procjack/tree/1.0](https://github.com/msmania/procjack/tree/1.0)

 
メインのインジェクターは、pj.exe で、これに ターゲットの PID とインジェクトしたい DLL、そして実行したいエクスポート関数の序数を指定すると、ターゲットの中でコードが実行されます。実行の様子はこんな感じ。

 
![]({{site.assets_url}}2015-04-26-capture.png)

 
シェルコードをデバッグしたい場合は、ターゲット側でスレッド作成時に例外を捕捉するようにしておくと、CreateRemoteThread が実行された時点でブレークしてくれて便利です。こんな感じ。

 
![]({{site.assets_url}}2015-04-26-02.png)

 
前述の通り、シェルコードは予め C で書いて expeb.exe としてコンパイルしてからアセンブリを整形しました。したがって、expeb のロジック自体は windows.h をインクルードしなくても動きます。Visual C++ だけでなく clang と gcc でもコンパイルして、もっとも効率の良いアセンブリを使おうと考えたのですが、結局 VC++ のアセンブリに落ち着きました。clang あたりがトリッキーなアセンブリを生成してくれるかと期待したのですが、どれも大差のないもので、最後は呼び出し規約の関係で VC++ に軍配が上がった感じです。長さは 1000 バイト前後です。手で頑張ればもう少し短くできそうな気はします。

 
試していませんが、Windows XP や 2000 でも動くはずです。少なくとも expeb.exe を Windows XP で動かして関数アドレスをとってくるところは問題ありませんでした。

 
ターゲットが AppContainer プロセスの時にも対応させるため、インジェクトする DLL のアクセス権をチェックして、"APPLICATION PACKAGE AUTHORITY\ALL APPLICATION PACKAGES" (SID=S-1-15-2-1) に対して読み取りと実行権限を割り当てています。実はこっちのコードを書く方が面倒だった・・・。Low プロセス用の権限を追加し忘れたので、Low だと動かないかも・・そのうち追加して更新します。

 
これで当初の目的は達成できた、と思いきや、実は一点だけ実現できていないことがあります。というのも、Wow64 のプロセスから Win64 のプロセスに対して CreateRemoteThread を実行すると、ERROR_ACCESS_DENIED で失敗してスレッドを作れないのです。VirtualAllocEx や WriteProcessMemory は問題ないのですが。逆の、Win64 から Wow64 への CreateRemoteThread は問題ありません。次のブログでいろいろ考察しているのですが、ちょっと時間がなくちゃんと読めていません。何かうまい方法があると思っているのですが。

 
DLL Injection and WoW64 <br />
[http://www.corsix.org/content/dll-injection-and-wow64](http://www.corsix.org/content/dll-injection-and-wow64)

 
最後にふと思い出したのが、知る人ぞ知るやねうらお氏の不真面目なほうのプロフィール。Reflective programming というより、やっていることはこっちに近いような。

 
やねうらおプロフィール <br />
[http://bm98.yaneu.com/bickle/profile.html](http://bm98.yaneu.com/bickle/profile.html)

 
_メインルーチンをオールアセンブラで組んだ、縦スクロールシューティングゲームを作成。創刊当時のマイコンＢＡＳＩＣマガジンに投稿。ＢＡＳＩＣの部分は、__16進ダンプをreadしてpokeしたのち、それを実行しているだけというＢＡＳＩＣマガジンをナメ切った自慢の作品。当然のごとく、ボツにされる。_

 
これでようやく小学校五年生の頃のやねうらお氏に追いついた！かもしれない。

