---
layout: post
title: "Debugging Apache installed with apt-get"
date: 2015-01-02 12:10:04.000 +09:00
categories:
- Apache
- C/C++
- Debug
- Linux
tags:
- apache
- gdb
---

以前の記事では、ソースからビルドした Apache を gdb でライブ デバッグする方法について触れました。apt-get でダウンロードした Apache では、ディレクトリ構成や構成ファイル名などが異なっているので、デバッグの方法も少し異なります。その方法を紹介します。

 
Ubuntu では、"apt-get install apache2" コマンドで Apache 2.x をダウンロード/インストールできます。ダウンロードされるバイナリにデバッグ情報は含まれていないので、Apache のコアモジュールをデバッグするのはあまり現実的ではありませんが、自分で作ったモジュールをデバッグするには十分です。

 
まずは環境を用意します。apt-get install したパッケージは以下の通り。

 
- build-essential 
- libtool 
- manpages-dev 
- gdb 
- apache2 
- apache2-dev 
- git 

 
使うバージョンは以下の通り。

 
- Ubuntu Server 14.04.1 LTS x64 
- Linux Kernel 3.13.0-32-generic 
- gcc (Ubuntu 4.8.2-19ubuntu1) 4.8.2 
- GNU gdb (Ubuntu 7.7.1-0ubuntu5~14.04.2) 7.7.1 
- Apache/2.4.7 (Ubuntu) 
- git version 1.9.1 

 
新しくサイトを作るのも面倒くさいので、既存の /etc/apache2/sites-available/000-default.conf を以下のように編集します。この段階では、ServerName を追加するだけです。

 
```
ServerName www.example.com 
<VirtualHost *:80> 
    ServerAdmin webmaster@localhost 
    DocumentRoot /var/www/html

    LogLevel info ssl:warn

    ErrorLog ${APACHE_LOG_DIR}/error.log 
    CustomLog ${APACHE_LOG_DIR}/access.log combined 
</VirtualHost>
```
 
Apache を再起動します。

 
```
john@ubuntu14041:~$ sudo service apache2 restart 
* Restarting web server apache2         [ OK ] 
john@ubuntu14041:~$
```
 
ブラウザーからアクセスします。今回は IE11+KB3008923 を使います。

 
![]({{site.assets_url}}2015-01-02-image.png)

 
これで準備は完了です。では、デバッグ対象となるモジュールを用意します。今回はこれで。

 
[https://github.com/msmania/mod_clover](https://github.com/msmania/mod_clover)

 
クローンします。

 
```
john@ubuntu14041:~$ git clone https://github.com/msmania/mod_clover.git 
Cloning into 'mod_clover'... 
remote: Counting objects: 22, done. 
remote: Compressing objects: 100% (15/15), done. 
remote: Total 22 (delta 7), reused 20 (delta 5) 
Unpacking objects: 100% (22/22), done. 
Checking connectivity... done.
```
 
ダウンロードされた ./build.sh と ./install.sh はパスが異なっていて使えないので、ビルドとインストールは直に apxs を実行します。

 
```
john@ubuntu14041:~/mod_clover$ apxs -c mod_clover.c 
/usr/share/apr-1.0/build/libtool --silent --mode=compile --tag=disable-static x86_64-linux-gnu-gcc -std=gnu99 -prefer-pic -pipe -g -O2 -fstack-protector --param=ssp-buffer-size=4 -Wformat -Werror=format-security  -D_FORTIFY_SOURCE=2   -DLINUX -D_REENTRANT -D_GNU_SOURCE  -pthread  -I/usr/include/apache2  -I/usr/include/apr-1.0   -I/usr/include/apr-1.0 -I/usr/include  -c -o mod_clover.lo mod_clover.c && touch mod_clover.slo 
/usr/share/apr-1.0/build/libtool --silent --mode=link --tag=disable-static x86_64-linux-gnu-gcc -std=gnu99 -Wl,--as-needed -Wl,-Bsymbolic-functions -Wl,-z,relro -Wl,-z,now    -o mod_clover.la  -rpath /usr/lib/apache2/modules -module -avoid-version    mod_clover.lo

john@ubuntu14041:~/mod_clover$ sudo apxs -i mod_clover.la 
/usr/share/apache2/build/instdso.sh SH_LIBTOOL='/usr/share/apr-1.0/build/libtool' mod_clover.la /usr/lib/apache2/modules 
/usr/share/apr-1.0/build/libtool --mode=install install mod_clover.la /usr/lib/apache2/modules/ 
libtool: install: install .libs/mod_clover.so /usr/lib/apache2/modules/mod_clover.so 
libtool: install: install .libs/mod_clover.lai /usr/lib/apache2/modules/mod_clover.la 
libtool: finish: PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/sbin" ldconfig -n /usr/lib/apache2/modules 
---------------------------------------------------------------------- 
Libraries have been installed in: 
   /usr/lib/apache2/modules

If you ever happen to want to link against installed libraries 
in a given directory, LIBDIR, you must either use libtool, and 
specify the full pathname of the library, or use the `-LLIBDIR' 
flag during linking and do at least one of the following: 
   - add LIBDIR to the `LD_LIBRARY_PATH' environment variable 
     during execution 
   - add LIBDIR to the `LD_RUN_PATH' environment variable 
     during linking 
   - use the `-Wl,-rpath -Wl,LIBDIR' linker flag 
   - have your system administrator add LIBDIR to `/etc/ld.so.conf'

See any operating system documentation about shared libraries for 
more information, such as the ld(1) and ld.so(8) manual pages. 
---------------------------------------------------------------------- 
chmod 644 /usr/lib/apache2/modules/mod_clover.so
```
 
設定は apxs に任せず、手動でやることにします。さっきも編集した /etc/apache2/sites-available/000-default.conf に以下の行 (青字) を追加。

 
```
ServerName www.example.com

LoadModule clover_module /usr/lib/apache2/modules/mod_clover.so 
AddOutputFilterByType CLOVER text/html

<VirtualHost *:80> 
    ServerAdmin webmaster@localhost 
    DocumentRoot /var/www/html

    LogLevel info ssl:warn

    ErrorLog ${APACHE_LOG_DIR}/error.log 
    CustomLog ${APACHE_LOG_DIR}/access.log combined

    Clover_Dynamic 1 
</VirtualHost>
```
 
apache 再起動。エラーが出なければモジュールは読み込みは成功です。

 
```
john@ubuntu14041:~/mod_clover$ sudo service apache2 restart 
* Restarting web server apache2                    [ OK ]
```
 
この mod_clover とかいうモジュールの正体ですが、URL に渡すクエリ文字列によって、サーバーが返す HTML の DOCTYPE と IE の Document Mode を変更できる、というものです。といってもフィルター内で HTML の構造を完全にパースしているのではなく、行単位で置換するだけです。あまり融通が利きません。

 
フィルターが正しく動作できるように、/var/www/html/index.html を少し手直しして、ファイルの出だしを以下のようにします。変更は、1 行目の空行の削除と、x-ua-compatible メタ情報の追加の二ヶ所です。

 
```
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"> 
<html xmlns="http://www.w3.org/1999/xhtml"> 
  <!-- 
    Modified from the Debian original for Ubuntu 
    Last updated: 2014-03-19 
    See: https://launchpad.net/bugs/1288690 
  --> 
  <head> 
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /> 
    <meta http-equiv="x-ua-compatible" content="IE=edge" /> 
    <title>Apache2 Ubuntu Default Page: It works</title> 
    <style type="text/css" media="screen"> 
  * { 
    margin: 0px 0px 0px 0px;
```
 
例えばオリジナルの URL が [http://11.10.90.10/](http://11.10.90.10/) だったときに、[http://11.10.90.10/?t=1&m=9](http://11.10.90.10/?t=1&m=9) という URL でアクセスすると、DOCTYPE が HTML5、Document Mode が IE9 になる、はずです。

 
実際に開いてみると、DOCTYPE は XHTML1.0 のまま、DocMode も edge のままでフィルターが動いてくれません。ではデバッガーをアタッチして見てみます。

 
![]({{site.assets_url}}2015-01-02-image1.png)

 
アタッチすべきプロセスを ps で確かめると、/usr/sbin/apache2 だと分かります。ワーカー プロセスが複数起動されているので、デバッグのためには –X オプションを付けてシングル プロセス モードで起動したいところです。

 
```
john@ubuntu14041:~$ ps -ef | grep apache 
root     18052     1  0 17:16 ?        00:00:00 /usr/sbin/apache2 -k start 
www-data 18055 18052  0 17:16 ?        00:00:00 /usr/sbin/apache2 -k start 
www-data 18056 18052  0 17:16 ?        00:00:00 /usr/sbin/apache2 -k start 
www-data 18057 18052  0 17:16 ?        00:00:00 /usr/sbin/apache2 -k start 
www-data 18058 18052  0 17:16 ?        00:00:00 /usr/sbin/apache2 -k start 
www-data 18059 18052  0 17:16 ?        00:00:00 /usr/sbin/apache2 -k start 
www-data 18068 18052  0 17:17 ?        00:00:00 /usr/sbin/apache2 -k start 
john     18090  1376  0 17:30 pts/0    00:00:00 grep --color=auto apache
```
 
ソースからビルドした httpd のときのように、apache2 を gdb 下で直接実行しようとしてもうまくいきません。

 
```
john@ubuntu14041:~$ sudo service apache2 stop 
[sudo] password for john: 
* Stopping web server apache2 *

john@ubuntu14041:~$ sudo gdb /usr/sbin/apache2 
GNU gdb (Ubuntu 7.7.1-0ubuntu5~14.04.2) 7.7.1 
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
Reading symbols from /usr/sbin/apache2...(no debugging symbols found)...done. 
(gdb) r -X 
Starting program: /usr/sbin/apache2 -X 
[Thread debugging using libthread_db enabled] 
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1". 
[Thu Jan 01 17:32:59.261766 2015] [core:warn] [pid 18128] AH00111: Config variable ${APACHE_LOCK_DIR} is not defined 
[Thu Jan 01 17:32:59.261944 2015] [core:warn] [pid 18128] AH00111: Config variable ${APACHE_PID_FILE} is not defined 
[Thu Jan 01 17:32:59.262003 2015] [core:warn] [pid 18128] AH00111: Config variable ${APACHE_RUN_USER} is not defined 
[Thu Jan 01 17:32:59.262065 2015] [core:warn] [pid 18128] AH00111: Config variable ${APACHE_RUN_GROUP} is not defined 
[Thu Jan 01 17:32:59.262127 2015] [core:warn] [pid 18128] AH00111: Config variable ${APACHE_LOG_DIR} is not defined 
[Thu Jan 01 17:32:59.370505 2015] [core:warn] [pid 18128] AH00111: Config variable ${APACHE_RUN_DIR} is not defined 
[Thu Jan 01 17:32:59.370823 2015] [core:warn] [pid 18128] AH00111: Config variable ${APACHE_LOG_DIR} is not defined 
[Thu Jan 01 17:32:59.374724 2015] [core:warn] [pid 18128] AH00111: Config variable ${APACHE_LOG_DIR} is not defined 
[Thu Jan 01 17:32:59.374848 2015] [core:warn] [pid 18128] AH00111: Config variable ${APACHE_LOG_DIR} is not defined 
AH00526: Syntax error on line 74 of /etc/apache2/apache2.conf: 
Invalid Mutex directory in argument file:${APACHE_LOCK_DIR} 
[Inferior 1 (process 18128) exited with code 01] 
(gdb)
```
 
赤字で示したエラー メッセージから、環境変数が足りないことが分かります。試行錯誤したところ、起動スクリプトである apache2ctl を編集するのが最も簡単だったので、その方法を紹介します。なお apachectl は、apache2ctl へのシンボリック リンクです。

 
```
john@ubuntu14041:~$ ls -l /usr/sbin/ap* 
-rwxr-xr-x 1 root root 637496 Jul 22 07:38 /usr/sbin/apache2 
-rwxr-xr-x 1 root root   6402 Jan  3  2014 /usr/sbin/apache2ctl 
lrwxrwxrwx 1 root root     10 Jul 22 07:37 /usr/sbin/apachectl -> apache2ctl 
lrwxrwxrwx 1 root root      9 Apr  3  2014 /usr/sbin/apparmor_status -> aa-status
```
 
apache2ctl は、start や stop といったパラメーターを取ることができますが、そこにデバッグ用のオプションを追加します。追加するのは以下の青字で示した 3 行です。

 
```
case $ARGV in 
start) 
    # ssl_scache shouldn't be here if we're just starting up. 
    # (this is bad if there are several apache2 instances running) 
    rm -f ${APACHE_RUN_DIR:-/var/run/apache2}/*ssl_scache* 
    $HTTPD ${APACHE_ARGUMENTS} -k $ARGV 
    ERROR=$? 
    ;; 
stop|graceful-stop) 
    $HTTPD ${APACHE_ARGUMENTS} -k $ARGV 
    ERROR=$? 
    ;; 
debug) 
    gdb $HTTPD 
    ;; 
restart|graceful) 
(..snip..)
```
 
起動します。今度はうまくいきました。r -X した後にワーカー スレッドが作られたことを示すログが出力されないことから、apt-get するパッケージの Apache はマルチスレッド モデルではないようです。

 
```
john@ubuntu14041:~$ sudo apachectl debug 
GNU gdb (Ubuntu 7.7.1-0ubuntu5~14.04.2) 7.7.1 
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
Reading symbols from /usr/sbin/apache2...(no debugging symbols found)...done. 
(gdb) r -X 
Starting program: /usr/sbin/apache2 -X 
[Thread debugging using libthread_db enabled] 
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1".
```
 
念のため別コンソールからシングル プロセス モードになっているかを確認します。

 
```
john@ubuntu14041:~/mod_clover$ ps -ef | grep apache 
root     18173  1376  0 17:41 pts/0    00:00:00 sudo apachectl debug 
root     18174 18173  0 17:41 pts/0    00:00:00 /bin/sh /usr/sbin/apachectl debug 
root     18176 18174  1 17:41 pts/0    00:00:00 gdb /usr/sbin/apache2 
www-data 18178 18176  0 17:41 pts/0    00:00:00 /usr/sbin/apache2 -X 
john     18183  3010  0 17:42 pts/2    00:00:00 grep --color=auto apache
```
 
プロセス名は apache2 なので、任意のタイミングでブレークさせるときは以下のコマンドを実行します。

 
```
john@ubuntu14041:~/mod_clover$ sudo killall -SIGTRAP apache2 
```
 
マルチスレッド モデルではないため、ソースからビルドした Apache と異なり、デバッガーのコンソール上で Ctrl-C を押してもブレーク/再開させることができます。

 
```
^C 
Program received signal SIGINT, Interrupt. 
0x00007ffff725b573 in __epoll_wait_nocancel () at ../sysdeps/unix/syscall-template.S:81 
81      in ../sysdeps/unix/syscall-template.S 
(gdb) c 
Continuing.
```
 
デバッガーの準備ができたところで、mod_clover のハンドラーでブレークさせます。

 
```
(gdb) i functions clover 
All functions matching regular expression "clover":

File mod_clover.c: 
static apr_status_t clover_handler(ap_filter_t *, apr_bucket_brigade *); 
static void clover_register_hooks(apr_pool_t *); 
(gdb) break clover_handler 
Breakpoint 1 at 0x7ffff1827030: file mod_clover.c, line 220. 
(gdb) c 
Continuing.

(ブラウザーから http://11.10.90.10/?t=1&m=9 にアクセス)

Breakpoint 1, clover_handler (f=0x7fffec22d308, bb=0x7fffec22d9f0) at mod_clover.c:220 
220     static apr_status_t clover_handler(ap_filter_t *f, apr_bucket_brigade *bb) { 
(gdb) bt 
#0  clover_handler (f=0x7fffec22d308, bb=0x7fffec22d9f0) at mod_clover.c:220 
#1  0x00007ffff4ca2194 in ?? () from /usr/lib/apache2/modules/mod_filter.so 
#2  0x00007ffff54c7841 in ?? () from /usr/lib/apache2/modules/mod_deflate.so 
#3  0x00007ffff4ca2194 in ?? () from /usr/lib/apache2/modules/mod_filter.so 
#4  0x000055555559a0af in ?? () 
#5  0x00005555555aa680 in ap_run_handler () 
#6  0x00005555555aabc9 in ap_invoke_handler () 
#7  0x00005555555c016a in ap_process_async_request () 
#8  0x00005555555c0444 in ap_process_request () 
#9  0x00005555555bcf02 in ?? () 
#10 0x00005555555b3cc0 in ap_run_process_connection () 
#11 0x00007ffff4896767 in ?? () from /usr/lib/apache2/modules/mod_mpm_prefork.so 
#12 0x00007ffff489696c in ?? () from /usr/lib/apache2/modules/mod_mpm_prefork.so 
#13 0x00007ffff48976b1 in ?? () from /usr/lib/apache2/modules/mod_mpm_prefork.so 
#14 0x000055555559169e in ap_run_mpm () 
#15 0x000055555558ae36 in main ()
```
 
ハンドラーは呼ばれているようです。デバッグ情報がないのでシンボル名は ?? になっていますが、mod_clover が呼ばれる前に、mod_deflate フィルターの処理が実行されているのが見えます。mod_deflate は圧縮を行うフィルターなので、mod_clover に流れてくるデータがテキストではなく圧縮されたデータになっていて、正しく処理できていない、ということが予想できます。

 
フィルターの順番を入れ替える前に、実際にどのようなデータが来ているのかをデバッガーから確認します。

 
mod_clover の処理は、流れてくる bucket brigade を行単位に再構成し、正規表現にマッチした行を置き換えるという動作になっています。apr_brigade_pflatten 関数によって 1 行分の文字列を作成しているので、この関数が返す文字列を見てみます。

 
gdb の操作に慣れるため、あえて最適化されたコードのままデバッグを行ない、アセンブリ言語をベースにコードを追いかけることにします。行番号があまり当てにならないので、disassemble で clover_handler をダンプしてどこでブレークさせるかを考えます。以下は apr_brigade_pflatten 呼び出しのあたりを抜き出したものです。

 
```
0x00007ffff1827134 <+260>:   e9 dc 00 00 00  jmpq   0x7ffff1827215 <clover_handler+485> 
0x00007ffff1827139 <+265>:   0f 1f 80 00 00 00 00    nopl   0x0(%rax) 
0x00007ffff1827140 <+272>:   48 8b 45 08     mov    0x8(%rbp),%rax 
0x00007ffff1827144 <+276>:   48 8b 55 00     mov    0x0(%rbp),%rdx 
0x00007ffff1827148 <+280>:   48 8b 7b 08     mov    0x8(%rbx),%rdi 
0x00007ffff182714c <+284>:   48 89 10        mov    %rdx,(%rax) 
0x00007ffff182714f <+287>:   48 8b 45 00     mov    0x0(%rbp),%rax 
0x00007ffff1827153 <+291>:   48 8b 55 08     mov    0x8(%rbp),%rdx 
0x00007ffff1827157 <+295>:   48 89 50 08     mov    %rdx,0x8(%rax) 
0x00007ffff182715b <+299>:   48 8d 47 08     lea    0x8(%rdi),%rax 
0x00007ffff182715f <+303>:   48 89 45 00     mov    %rax,0x0(%rbp) 
0x00007ffff1827163 <+307>:   48 8b 47 10     mov    0x10(%rdi),%rax 
0x00007ffff1827167 <+311>:   48 89 45 08     mov    %rax,0x8(%rbp) 
0x00007ffff182716b <+315>:   48 8b 47 10     mov    0x10(%rdi),%rax 
0x00007ffff182716f <+319>:   48 89 28        mov    %rbp,(%rax) 
0x00007ffff1827172 <+322>:   48 89 6f 10     mov    %rbp,0x10(%rdi) 
0x00007ffff1827176 <+326>:   48 c7 44 24 50 00 00 00 00      movq   $0x0,0x50(%rsp) 
0x00007ffff182717f <+335>:   48 8b 4b 10     mov    0x10(%rbx),%rcx 
0x00007ffff1827183 <+339>:   48 8b 54 24 10  mov    0x10(%rsp),%rdx 
0x00007ffff1827188 <+344>:   4c 89 f6        mov    %r14,%rsi 
0x00007ffff182718b <+347>:   e8 10 fb ff ff  callq  0x7ffff1826ca0 <apr_brigade_pflatten@plt> 
0x00007ffff1827190 <+352>:   85 c0   test   %eax,%eax 
0x00007ffff1827192 <+354>:   0f 85 78 02 00 00       jne    0x7ffff1827410 <clover_handler+992> 
0x00007ffff1827198 <+360>:   8b 53 38        mov    0x38(%rbx),%edx 
0x00007ffff182719b <+363>:   45 31 ff        xor    %r15d,%r15d 
0x00007ffff182719e <+366>:   85 d2   test   %edx,%edx 
0x00007ffff18271a0 <+368>:   0f 84 ea 01 00 00       je     0x7ffff1827390 <clover_handler+864> 
0x00007ffff18271a6 <+374>:   8b 43 3c        mov    0x3c(%rbx),%eax 
0x00007ffff18271a9 <+377>:   c7 43 38 01 00 00 00    movl   $0x1,0x38(%rbx) 
0x00007ffff18271b0 <+384>:   85 c0   test   %eax,%eax 
0x00007ffff18271b2 <+386>:   0f 84 80 01 00 00       je     0x7ffff1827338 <clover_handler+776> 
0x00007ffff18271b8 <+392>:   48 8b 74 24 58  mov    0x58(%rsp),%rsi 
0x00007ffff18271bd <+397>:   49 8b 44 24 18  mov    0x18(%r12),%rax 
0x00007ffff18271c2 <+402>:   4d 85 ff        test   %r15,%r15 
0x00007ffff18271c5 <+405>:   4c 89 ff        mov    %r15,%rdi 
0x00007ffff18271c8 <+408>:   48 0f 44 7c 24 60       cmove  0x60(%rsp),%rdi 
0x00007ffff18271ce <+414>:   48 8b 40 08     mov    0x8(%rax),%rax 
0x00007ffff18271d2 <+418>:   48 8b 90 80 00 00 00    mov    0x80(%rax),%rdx 
0x00007ffff18271d9 <+425>:   e8 f2 fa ff ff  callq  0x7ffff1826cd0 <apr_bucket_transient_create@plt>
```
 
x64 Linux の呼び出し規約は、System V Application Binary Interface (ABI) として定義されています。仕様は ↓ にあります。

 
AMD64 Documentation <br />
[http://www.x86-64.org/documentation.html](http://www.x86-64.org/documentation.html)

 
"Figure 3.4: Register Usage" の図にパラメーターを渡す時に使われるレジスターの一覧があります。整数の場合、rdi -&gt; rsi -&gt; rdx -&gt; rcx -&gt; r8 -&gt; r9 の順番で使われるようです。何これ Windows と全然違う・・・

 
デバッガーに戻り、今回確認したい文字列は第二パラメーターの linestr なので、rsi レジスターに入るはずです。デバッグ時のログはこんな感じ・・

 
```
(gdb) break *0x00007ffff182718b 
Breakpoint 3 at 0x7ffff182718b: file mod_clover.c, line 295. 
(gdb) c 
Continuing.

(ブラウザーから http://11.10.90.10/?t=1&m=9 にアクセス)

Breakpoint 3, 0x00007ffff182718b in clover_handler (f=0x7fffec22f308, bb=0x7fffec22f9f0) 
    at mod_clover.c:295 
295                             status = apr_brigade_pflatten(context->snippets, &linestr, &linelength, context->subpool); 
(gdb) i r r14 rsi 
r14            0x7fffffffde20   140737488346656 
rsi            0x7fffffffde20   140737488346656 
(gdb) x/g 0x7fffffffde20 
0x7fffffffde20: 0x0000000000000000 
(gdb) ni 
296                             if ( status!=APR_SUCCESS ) { 
(gdb) i r eax 
eax            0x0      0 
(gdb) i r r14 rsi 
r14            0x7fffffffde20   140737488346656 
rsi            0x7fffec222056   140737155047510 
(gdb) x/g $r14 
0x7fffffffde20: 0x00007fffec2260a8 
(gdb) p linestr 
$1 = 0x7fffec2260a8 "37\213\b" 
(gdb) x/s 0x00007fffec2260a8 
0x7fffec2260a8: "37\213\b" 
(gdb) x/8x 0x00007fffec2260a8 
0x7fffec2260a8: 0x1f    0x8b    0x08    0x00    0x00    0x00    0x00    0x00 
(gdb) c 
Continuing.

Breakpoint 3, 0x00007ffff182718b in clover_handler (f=0x7fffec22f308, bb=0x7fffec22f9f0) 
    at mod_clover.c:295 
295                             status = apr_brigade_pflatten(context->snippets, &linestr, &linelength, context->subpool); 
(gdb) ni 
296                             if ( status!=APR_SUCCESS ) { 
(gdb) x/g $r14 
0x7fffffffde20: 0x00007fffec2262b0 
(gdb) x/8b 0x00007fffec2262b0 
0x7fffec2262b0: 0xbe    0x00    0x65    0x22    0x30    0x2a    0x53    0x85 
(gdb) p linestr 
$2 = 0x7fffec2262b0 "\276" 
(gdb)
```
 
青字で示した行が、mod_deflate から流れてきたデータです。確かに文字列ではありません。念のため Network Monitor でパケットを確認すると、デバッガーに表示されているものと全く同じ 1F 8B 08 00 00 ... で始まるバイナリ データが HTTP 応答として返ってきています。

 
![]({{site.assets_url}}2015-01-02-image2.png)

 
というわけで、フィルター処理の順番として、mod_deflate の前に mod_clover を実行させる必要があります。

 
有効化されているモジュールのロード、及び初期設定パラメーターは、/etc/apache2/apache2.conf に記載されている IncludeOptional によってインクルードされるので、その前に mod_clover に関する設定を記述します。青字の 2 行を追加しました。000-default.conf からは、LoadModule と AddOutputFilterByType を消しておきます。

 
```
# 
# LogLevel: Control the severity of messages logged to the error_log. 
# Available values: trace8, ..., trace1, debug, info, notice, warn, 
# error, crit, alert, emerg. 
# It is also possible to configure the log level for particular modules, e.g. 
# "LogLevel info ssl:warn" 
# 
LogLevel warn

LoadModule clover_module /usr/lib/apache2/modules/mod_clover.so 
AddOutputFilterByType CLOVER text/html

# Include module configuration: 
IncludeOptional mods-enabled/*.load 
IncludeOptional mods-enabled/*.conf

# Include list of ports to listen on 
Include ports.conf
```
 
Apache を再起動し、[http://11.10.90.10/?t=1&m=9](http://11.10.90.10/?t=1&m=9) を開きます。今度は、DOCTYPE が HTML5、DocMode が IE9 になっており、mod_clover が意図通りに動いています。フィルターの順番を変えただけなので、HTTP 応答の圧縮も正しく行われています。

 
![]({{site.assets_url}}2015-01-02-image3.png)

