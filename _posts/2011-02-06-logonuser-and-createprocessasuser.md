---
layout: post
title: "[Win32] [C++] LogonUser と CreateProcessAsUser"
date: 2011-02-06 14:35:58.000 +09:00
categories:
- Windows
tags:
- CreateProcessAsUser
---

<font color="#ff0000">2011/12/31~2012/1/1 にかけて、続きの記事を書きました。      <br></font><font color="#ff0000">-----</font> <br />
[[Win32] [C++] CreateProcessAsUser – #4 セキュリティ記述子](http://msmania.wordpress.com/2012/01/01/win32-c-createprocessasuser-4-%e3%82%bb%e3%82%ad%e3%83%a5%e3%83%aa%e3%83%86%e3%82%a3%e8%a8%98%e8%bf%b0%e5%ad%90/) <br />
[[Win32] [C++] CreateProcessAsUser – #3 ソース](http://msmania.wordpress.com/2011/12/31/win32-c-createprocessasuser-3-%e3%82%bd%e3%83%bc%e3%82%b9/) <br />
[[Win32] [C++] CreateProcessAsUser – #2 トークン編](http://msmania.wordpress.com/2011/12/31/win32-c-createprocessasuser-2-%e3%83%88%e3%83%bc%e3%82%af%e3%83%b3%e7%b7%a8/) <br />
[[Win32] [C++] CreateProcessAsUser – #1 特権編](http://msmania.wordpress.com/2011/12/31/win32-c-createprocessasuser-1-%e7%89%b9%e6%a8%a9%e7%b7%a8/) <br />
<font color="#ff0000">-----</font>

 
コマンド プロンプトから runas すると、他のユーザー アカウントでプロセスを起動することができます。ただしパスワードは手入力しないといけないので、これを自動化するための苦肉の策がいろいろと考案されています。VB スクリプトを使って SendKey する方法など。試してみましたが、確かに動きます。

 
SendKey ではあまりにも芸がないということで、プログラム的にやってみます。というか数千のプロセスを作る必要があったので、プログラムでやらないとしょうがない。

 
API としては LogonUser で取得したトークンを CreateProcessAsUser に渡すだけのようです。簡単ですね。が、それだと動かない。余裕で 1314 エラーです。

 
エラー 1314 <br />
「クライアントは要求された特権を保有していません。 」

 
なんですと、管理者ですぞ!? さて、真面目に MSDN を読まなければいけません。と、すぐ書いてあるし。

 
CreateProcessAsUser <br />
[http://msdn.microsoft.com/en-us/library/ms682429(VS.85).aspx](http://msdn.microsoft.com/en-us/library/ms682429(VS.85).aspx)

 
> Typically, the process that calls the CreateProcessAsUser function must have the SE_INCREASE_QUOTA_NAME privilege and may require the SE_ASSIGNPRIMARYTOKEN_NAME privilege if the token is not assignable. If this function fails with ERROR_PRIVILEGE_NOT_HELD (1314), use theCreateProcessWithLogonW function instead. CreateProcessWithLogonW requires no special privileges
 
そこで SE_INCREASE_QUOTA_NAME と SE_ASSIGNPRIMARYTOKEN_NAME 特権を自分のユーザーに割り当てます。ローカル セキュリティ ポリシーの設定から、それぞれ以下の特権を割り当てます。

 
```
セキュリティの設定 > ローカル ポリシー > ユーザー権利の割り当て 
プロセスのメモリ クォータの増加: SE_INCREASE_QUOTA_NAME  
プロセス レベル トークンの置き換え: SE_ASSIGNPRIMARYTOKEN_NAME
```
 
ちなみにクライアントは Windows 7 x86 ですが、クォータの方はすでに Administrators が入っているのに、トークンの置き換えの方にはLOCAL SERVICE と NETWORK SERVICE の 2 つしか入っていなかった。管理者なんて大したことないですね。やはりサービス起動ユーザーは強い。

 
ポリシーを反映させるために、一度ログオフしてから、再度ログオンして実行。すると CreateProcessAsUser は成功。別ユーザーで実行したかったプログラムは、ユーザー入力を必要としないプログラムだったので、要件としてはとりあえずこれで OK。

 
さて、ここでユーザー入力を必要とするプログラムを起動したい場合はかなり面倒です。もう一度 MSDN に戻り、該当部分を見てみるとこんな感じ。

 
> By default, CreateProcessAsUser creates the new process on a noninteractive window station with a desktop that is not visible and cannot receive user input. To enable user interaction with the new process, you must specify the name of the default interactive window station and desktop, "winsta0\default", in the lpDesktop member of the STARTUPINFO structure. In addition, before calling CreateProcessAsUser, you must change the discretionary access control list (DACL) of both the default interactive window station and the default desktop. The DACLs for the window station and desktop must grant access to the user or the logon session represented by the hToken parameter.
 
1. STARTUPINFO::lpDesktop 
1. ウィンドウ ステーションの DACL に実行ユーザーを追加 
1. デスクトップの DACL に実行ユーザーを追加 

 
簡単そうじゃん、と思ってしまったが、これが超めんどくさい。ちなみにこれをやらずに CreateProcessAsUser を実行すると、次のようなエラーが出てダメです。

 
「アプリケーションを正しく起動できませんでした (0xc0000142)。」 <br />
![]({{site.assets_url}}2011-02-06-ws0002.png)

 
ウィンドウステーションを持たないプログラムがウィンドウを表示しようとして落ちたのでしょうかね。これは今度デバッグしてみても面白いかも。

 
それはさておき、DACL への追加をしなければならないわけですが、これが実に実にめんどくさいです。サンプルは MSDN にありますが。

 
Starting an Interactive Client Process in C++ <br />
[http://msdn.microsoft.com/en-us/library/aa379608(v=VS.85).aspx](http://msdn.microsoft.com/en-us/library/aa379608(v=VS.85).aspx)

 
Getting the Logon SID in C++ <br />
[http://msdn.microsoft.com/en-us/library/aa446670(v=VS.85).aspx](http://msdn.microsoft.com/en-us/library/aa446670(v=VS.85).aspx)

 
<font color="#0000ff">(2014/12/29 修正) 2011 年末に作成したテスト プログラムのソースを GitHub 上で公開しています。このプログラムに関する記事については、本記事の冒頭にあるリンクをご参照ください。m(_ _)m</font>

 
[https://github.com/msmania/logue](https://github.com/msmania/logue)

 
~~ウィンドウ ステーションとデスクトップで、DACL を変更するときの処理が微妙に違う。サンプルでは関数を分けていたので、そのままだけど、一緒にしたほうがプログラムは短くなるかも。もともとオブジェクトが持っていた DACL をコピーするところまでは全く同じで、そのあと、トークンから取得した SID を pNewACL にコピーするときに、ウィンドウ ステーションでは 2 回に分けて AddAce する必要があるのです。だから、dwNewAclSize のサイズも微妙に異なる。このサイズについては、以下の KB に説明あり。~~

 
INFO: Computing the Size of a New ACL <br />
[http://support.microsoft.com/kb/102103/en](http://support.microsoft.com/kb/102103/en)

