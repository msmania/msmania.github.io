---
layout: post
title: "SUDO for Windows"
date: 2016-06-30 10:29:14.000 -07:00
categories:
- C/C++
- Windows
tags:
- sudo
- uac
---

Windows で動く Linux の sudo コマンド的なものを作って GitHub で公開しました。

 
msmania/sudo: SUDO for Windows <br />
[https://github.com/msmania/sudo](https://github.com/msmania/sudo)

 
Windows でコンソールを使った作業をする場合、必要がない限りは、管理者権限のない制限付きトークンのコマンド プロンプト (もしくは PowerShell) で作業すると思います。Windows の困ったところは、管理者権限が必要なコマンドを実行するときには、新しいコンソールを別途起動しないといけないことです。しかし、1 コマンド実行したいだけなのに、わざわざ新しくコンソールを開いて使い終わったら閉じるのは時間がもったいないのです。というわけで、通常のコンソールと管理者権限のコンソールの二窓体制で作業する、というのが日常かと思います。しかし、最近の Windows は無駄にグラフィカルで、ウィンドウを切り替えるときの Alt+Tab やタスクバー アイコンのプレビューがいちいち大袈裟です。今度はこれをレジストリで無効にしておく、というような具合に、理不尽なカスタマイズが次々と必要になります。そこで、sudo を作ることにしました。

 
代替策も探しましたが、意外とありません。例えば、runas.exe を使って built-in の Administrator ユーザーでログオンすれば管理者権限は使えます。しかし次の 2 点において不満があり使えません。

 
- runas.exe で cmd.exe を起動すると、結局新しいコンソールが起動する 
- Build-in の Administrator 以外では管理者権限にならない 

 
SysInternals の psexec.exe を使うと runas みたいなことができますが、こちらはそもそも管理者権限がないと実行できないので本末転倒です。

 
sudo に求めたい要件は以下の通りです。

 
1. 通常のコンソール上でそのまま作業できる (= 新しいコンソールは開かない) 
1. Administrator ではなく、管理者グループに所属している作業ユーザーで管理者権限を使える 
1. .NET やスクリプト経由ではなく、ネイティブの sudo.exe が欲しい 

 
GitHub 上を "sudo windows" などで検索すると、幾つかそれっぽいプロジェクトは見つかりますが、1. の要件を満たしてくれません。

 
maxpat78/Sudo: Executes a command requesting for elevated privileges in Windows Vista and newer OS. <br />
[https://github.com/maxpat78/Sudo](https://github.com/maxpat78/Sudo)

 
jpassing/elevate: elevate -- start elevated processes from the command line <br />
[https://github.com/jpassing/elevate](https://github.com/jpassing/elevate)

 
どちらも動作原理は同じで、ShellExecute API を lpVerb="runas" で実行しています。UAC プロンプトを表示させて管理者権限を得るには一番簡単な方法なのですが、コンソールから cmd.exe を起動すると別のコンソールが開いてしまうのでこれは使えません。

 
ShellExecute function (Windows) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/bb762153(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/bb762153(v=vs.85).aspx)

 
ShellExecute が駄目となると CreateProcess でプロセスを作るしかありません (他に WinExec という化石のような API もありますが)。が、以下のブログに記載があるように、CreateProcess で権限昇格が必要なプロセスを起動することはできません。

 
Dealing with Administrator and standard user’s context | Windows SDK Support Team Blog <br />
[https://blogs.msdn.microsoft.com/winsdk/2010/05/31/dealing-with-administrator-and-standard-users-context/](https://blogs.msdn.microsoft.com/winsdk/2010/05/31/dealing-with-administrator-and-standard-users-context/)

 
```
CreateProcess() and CreateProcessWithLogonW do not have new flags to launch the child process as elevated. Internally, CreateProcess() checks whether the target application requires elevation by looking for a manifest, determining if it is an installer, or if it has an app compat shim. If CreateProcess() determines the target application requires elevation, it simply fails with ERROR_ELEVATION_REQUIRED(740). It will not contact the AIS to perform the elevation prompt or run the app.
```
 
最後の AIS というのは Application Information Service (AppInfo サービス) という UAC を司る憎いやつです。いや、実際はお世話になっているのですが。

 
Understanding and Configuring User Account Control in Windows Vista <br />
[https://technet.microsoft.com/en-us/library/cc709628(v=ws.10).aspx](https://technet.microsoft.com/en-us/library/cc709628(v=ws.10).aspx)

 
となると残された道は 1 つしかなく、sudo.exe を昇格させて実行し、そこから CreateProcess で子プロセスを作る方法です。権限は自動的に継承されるので、子プロセスも昇格されたままになるはずです。

 
さらに要件 1. を満たすためには、もう一捻り必要です。sudo.exe をコンソール アプリケーション、すなわち /SUBSYSTEM:CONSOLE オプションを使ってリンクした場合、そのコンソール プログラムを昇格していないコンソール上から起動すると、UAC プロンプトの後にやはり新たなコンソールが起動して、プログラム終了時にコンソールが破棄される動作になるので、標準出力が見えません。したがって、sudo.exe は /SUBSYSTEM:WINDOWS を使ってリンクしなければなりません。この場合、単純にプログラムから printf などで標準出力に文字を出力しても、データは破棄されるだけでどこにも表示されません。そこで、プログラムの標準出力を親プロセスのコンソールに関連付けて、小プロセスからの標準出力を受け取って親プロセスの標準出力にリダイレクトするようにします。うう面倒くさい・・。

 
小プロセスの標準入出力をパイプとして受け取る部分は、以下のサンプルのコードを流用できます。

 
Creating a Child Process with Redirected Input and Output (Windows) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/ms682499(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/ms682499(v=vs.85).aspx)

 
親プロセスのコンソールを自分の標準出力に関連付ける部分は、AttachConsole API に ATTACH_PARENT_PROCESS を渡すことで簡単に実現できます。

 
AttachConsole function (Windows) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/ms681952(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/ms681952(v=vs.85).aspx)

 
sudo.exe 起動時に UAC プロンプトを表示させるには、マニフェスト XML で requestedExecutionLevel を highestAvailable に設定するだけです。Mt.exe を使うと、exe にマニフェストを埋め込むことが出来るので、Makefile の中でリンカーの後に Mt.exe を実行するように記述します。

 
Mt.exe (Windows) <br />
[https://msdn.microsoft.com/en-us/library/aa375649(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/aa375649(v=vs.85).aspx)

 
これらを組み合わせれば、基本の動きはほぼ達成できますが、最初の MSDN のサンプルには若干問題があります。サンプルをそのままコピーして標準出力に文字を出力するだけの簡単なプロセス (ipconfig.exe など) を実行すると、文字は出力されるのですが、ipconfig.exe が終了しても sudo.exe が終わりません。ReadFromPipe における ReadFile の呼び出しで、子プロセスが終了しているにも関わらず制御が返ってこないためです。原因は、STARTUPINFO 構造体に渡した子プロセス用のパイプへのハンドル、すなわち g_hChildStd_OUT_Wr と g_hChildStd_IN_Rd を閉じていないためと考えられます。ちゃんと確かめていないのですが、STARTUPINFO 構造体に渡したハンドルは、複製されてから小プロセスに渡されるので、子プロセス側で標準入出力のハンドルを破棄しても、複製元の g_hChildStd_OUT_Wr と g_hChildStd_IN_Rd を自分で保持している限りパイプが有効で、ReadFile はそれを待ち続けているのだと思います。じゃあ単純に CreateProcess の後でをさっさとハンドルをクローズしてしまえばよいかというと、大方のシナリオでは動くとは思いますが、微妙だと思います。子プロセスによっては、すぐに標準出力にデータを出力しない動作をするものがあってもおかしくありません。しかし、sudo.exe 側はパイプにデータが残っているかどうかだけで出力を続けるかどうかを判断しているので、子プロセスが動作中にも関わらずループを抜けてしまうかもしれません。

 
現時点のバージョンの sudo.exe では、単純に CreateProcess のあと子プロセスが終了するまで WaitForSingleObject で待って、その後でじっくりとパイプの中を読み出すようにしました。この実装も微妙で、子プロセスの出力量が膨大であったときにパイプが溢れる可能性がありますし、そもそも子プロセスが終わるまで待っているのは美しくありません。そのうち、子プロセスの状態を監視するようなスレッドを作って対応します。

 
WaitForSingleObject は使うものの、INIFINITE を渡して永遠に待ち続けるのはさすがに嫌だったので、タイムアウト値を設けることにしました。初め、このタイムアウト値は環境変数経由で設定しようと思っていました。そうすれば、CreateProcess の第二引数には WinMain の引数の pCmdLine をそのまま渡すだけで済むので、楽ができるのです。しかし、ここでも Windows のコマンド プロンプトの困った仕様が立ちはだかります。コマンドを実行している時だけに有効になる一時的な環境変数が使えないのです。正式に何というのかわかりませんが、つまり以下のようなことができません。make を実行するときによく使いますね。

 
```
$ cat test.sh 
echo $HOGE

$ echo $HOGE 



$ HOGE=1 ./test.sh 
1

$ echo $HOGE 

$
```
 
一応、似たようなことはできます。それが以下のフォーラムで出てきているやり方で、cmd /C を使って子プロセスの中で set コマンドを実行してから目的のコマンドを実行する方法です。

 
Setting environment variable for just one command in Windows cmd.exe - Super User <br />
[http://superuser.com/questions/223104/setting-environment-variable-for-just-one-command-in-windows-cmd-exe](http://superuser.com/questions/223104/setting-environment-variable-for-just-one-command-in-windows-cmd-exe)

 
ちなみにこの中で紹介されている、/V オプションを使った環境変数の遅延評価は、子プロセスでは必要ですが孫プロセスでは不要です。マニアックですが、こんな感じです。

 
```
> cmd /C "set HOGE=1 && echo %HOGE% !HOGE! && cmd /c echo %HOGE% !HOGE!" 
%HOGE% !HOGE! 
1 !HOGE!

> cmd /V /C "set HOGE=1 && echo %HOGE% !HOGE! && cmd /c echo %HOGE% !HOGE!" 
%HOGE% 1 
1 1
```
 
したがって、sudo.exe を使って cmd /c "set TIMEOUT=10 && sudo ipconfig" 的なことをやれば一応は環境変数からタイムアウト値を取れる、と思えますが結局駄目でした。UAC 昇格を要求するコマンドを起動した場合、環境変数が引き継がれません。これは Linux の sudo のデフォルト動作と同じですが、sudo に -E オプションを付加すると環境変数を引き継ぐことができます。

 
```
$ echo $HOGE

$ HOGE=1 sudo ./test.sh 



$ HOGE=1 sudo -E ./test.sh 
1
```
 
上記の理由で、環境変数を使うのは諦めて引数を取ることにしました。空白などの扱いを自分で決めたかったので pCmdLine をパースするステート マシンを 1 から書きました。それが CCommandOptions クラスですが、無駄に長いです。たぶんもっとまともな実装方法があると思います。アルゴリズムは苦手・・。

 
とりあえずこれで要件を満たすコマンドができました。出力例は ↓ の通りです。ここまで書いて言うのもなんですが、UAC ポップアップの表示が遅いので、もっさりした動作にしかなりません。なんだかんだスピードを求めるなら二窓体制が無難かも。

 
```
> sudo /t 10 powershell "get-vm | ?{$_.State -eq 'Running'} | select -ExpandProperty networkadapters | select vmname, macaddress, switchname, ipaddresses | fl *" 
[sudo] START 
Spawning a process (Timeout = 10 sec.)

VMName : VM1 
MacAddress : 00155DFE7A01 
SwitchName : External 
IPAddresses : {10.124.252.117, fe80::8d2d:7dca:4498:82f9, 2001:4898:200:13:fc0e:945e:ffce:2bb5, 
2001:4898:200:13:8d2d:7dca:4498:82f9}

[sudo] END 
Press Enter to exit ...
```
