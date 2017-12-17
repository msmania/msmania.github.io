---
layout: post
title: "Apache Output Filter and Bucket Brigade"
date: 2014-12-29 04:58:57.000 +09:00
categories:
- Apache
- C/C++
- Debug
- Linux
tags:
- apache
- apxs
- brigade
- bucket
- gdb
---

Apache のフィルター モジュールを書きました。

 
参考にしたのは以下の情報。

 
- mod_sed.c 
- mod_substitute.c 
- Guide to writing output filters - Apache HTTP Server Version 2.5 <br />
[http://httpd.apache.org/docs/trunk/developer/output-filters.html](http://httpd.apache.org/docs/trunk/developer/output-filters.html) 
- mod_filter - Apache HTTP Server Version 2.4 <br />
[http://httpd.apache.org/docs/current/mod/mod_filter.html](http://httpd.apache.org/docs/current/mod/mod_filter.html) 
- Introduction to Buckets and Brigades <br />
[http://www.apachetutor.org/dev/brigades](http://www.apachetutor.org/dev/brigades) 

 
データの入出力は、bucket brigade (バケツ リレー) という名前で呼ばれる双方向循環リストを通して行います。何だか Windows カーネルのようだ。これは Apache 1.x から 2 になったときに導入されたらしい。リストを使うことで、ストリームを途中で分割したり、長さの異なるデータに置換したりするのが楽になる、というのがメリットです。

 
書いたモジュールは以下の 2 つ。コーヒーとサンドイッチ。塩漬けになっていた GitHub を使ってみた。

 
- [https://github.com/msmania/mod_coffee](https://github.com/msmania/mod_coffee) 
- [https://github.com/msmania/mod_sandwich](https://github.com/msmania/mod_sandwich) 

 
サンドイッチの方は、上記参考 URL の最後にある apachetutor とほぼ同じ。完全なソースは ↓ で見つかりました。

 
mod_txt <br />
[http://apache.webthing.com/mod_txt/mod_txt.c](http://apache.webthing.com/mod_txt/mod_txt.c)

 
フィルターに限らず、Apache のモジュールを開発するときは apxs というツールを使うと便利です。実体は Perl スクリプトです。Apache をソースからビルドしたときは、bin フォルダーに apxs が入っています。

 
```
$ ls -l /usr/local/apache-httpd/current/bin 
total 4448 
-rwxr-xr-x 1 root root 1992139 Dec  3 23:36 ab 
-rwxr-xr-x 1 john john    3537 Dec 22 21:51 apachectl 
-rwxr-xr-x 1 john john   23533 Dec  3 23:19 apxs 
-rwxr-xr-x 1 root root   13657 Dec  3 23:36 checkgid 
-rwxr-xr-x 1 john john    8925 Dec  3 23:19 dbmmanage 
-rw-rw-r-- 1 john john    1109 Dec  3 23:19 envvars 
-rw-rw-r-- 1 john john    1109 Dec  3 23:19 envvars-std 
-rwxr-xr-x 1 root root   24063 Dec  3 23:36 fcgistarter 
-rwxr-xr-x 1 root root   80843 Dec  3 23:36 htcacheclean 
-rwxr-xr-x 1 root root   51710 Dec  3 23:36 htdbm 
-rwxr-xr-x 1 root root   25987 Dec  3 23:36 htdigest 
-rwxr-xr-x 1 root root   51035 Dec  3 23:36 htpasswd 
-rwxr-xr-x 1 root root 2149389 Dec  3 23:36 httpd 
-rwxr-xr-x 1 root root   22250 Dec  3 23:36 httxt2dbm 
-rwxr-xr-x 1 root root   25086 Dec  3 23:36 logresolve 
-rwxr-xr-x 1 root root   45976 Dec  3 23:36 rotatelogs
```
 
apt-get した Apache に対して使うときは、apache2-dev というパッケージに入っているので、それを別途インストールして下さい。手元の Ubuntu だと、スクリプトは /usr/bin にできました。apxs2 というのは単なるシンボリックリンクです。

 
```
$ ls -l /usr/bin/apxs* 
-rwxr-xr-x 1 root root 19761 Jul 22 07:36 /usr/bin/apxs 
lrwxrwxrwx 1 root root     4 Jul 22 07:37 /usr/bin/apxs2 -> apxs
```
 
apxs コマンドの主な役割は 3 つです。

 
- ソースコードのテンプレートの作成 = オプション -g 
- ビルド = オプション -c 
- Apache へのインストール = オプション -i 

 
開発環境は以下の通り。

 
- Ubuntu Server 14.04 LTS x64 
- Linux Kernel 3.13.0-24-generic 
- Apache httpd 2.4.10 (ソースからビルド) 
- gcc (Ubuntu 4.8.2-19ubuntu1) 4.8.2 
- GNU gdb (Ubuntu 7.7.1-0ubuntu5~14.04.2) 7.7.1 

 
まずは、テンプレートを作ります。モジュール名のディレクトリも apxs が作ります。

 
```
john@glycine:~$ /usr/local/apache-httpd/current/bin/apxs -g -n coffee 
Creating [DIR]  coffee 
Creating [FILE] coffee/Makefile 
Creating [FILE] coffee/modules.mk 
Creating [FILE] coffee/mod_coffee.c 
Creating [FILE] coffee/.deps 
```
 
mod_coffee.c が唯一のソース ファイルです。このファイルのコメントに書いてありますが、生成されたまま何も変更を加えない状態でも動作をテストできるのでやってみます。

 
apxs を使ってビルド、するわけですが、この後のデバッグでビルドとインストールコマンドを飽きるほど実行するので、スクリプトを作っておきます。もうちょっと汎用的なスクリプト書けよ、という突っ込みはなしの方向で (汗

 
```
john@glycine:~/coffee$ cat build.sh 
/usr/local/apache-httpd/current/bin/apxs -c mod_coffee.c 
john@glycine:~/coffee$ cat install.sh 
/usr/local/apache-httpd/current/bin/apxs -i mod_coffee.la 
```
 
ビルドします。

 
```
john@glycine:~/coffee$ ./build.sh 
/usr/local/apr/apr-1.5.1/build-1/libtool --silent --mode=compile gcc -std=gnu99 -prefer-pic   -DLINUX -D_REENTRANT -D_GNU_SOURCE -g -O2 -pthread -I/usr/local/apache-httpd/httpd-2.4.10/include  -I/usr/local/apr/apr-1.5.1/include/apr-1   -I/usr/local/apr-util/apr-util-1.5.4/include/apr-1   -c -o mod_coffee.lo mod_coffee.c && touch mod_coffee.slo

/usr/local/apr/apr-1.5.1/build-1/libtool --silent --mode=link gcc -std=gnu99    -o mod_coffee.la  -rpath /usr/local/apache-httpd/httpd-2.4.10/modules -module -avoid-version    mod_coffee.lo
```
 
コンパイル エラーはなくビルドは上手くいったので、Apache にインストールします。root 権限が必要です。

 
```
john@glycine:~/coffee$ sudo ./install.sh 
[sudo] password for john: 
no talloc stackframe at ../source3/param/loadparm.c:4864, leaking memory 
/usr/local/apache-httpd/httpd-2.4.10/build/instdso.sh SH_LIBTOOL='/usr/local/apr/apr-1.5.1/build-1/libtool' mod_coffee.la /usr/local/apache-httpd/httpd-2.4.10/modules 
/usr/local/apr/apr-1.5.1/build-1/libtool --mode=install install mod_coffee.la /usr/local/apache-httpd/httpd-2.4.10/modules/ 
libtool: install: install .libs/mod_coffee.so /usr/local/apache-httpd/httpd-2.4.10/modules/mod_coffee.so 
libtool: install: install .libs/mod_coffee.lai /usr/local/apache-httpd/httpd-2.4.10/modules/mod_coffee.la 
libtool: install: install .libs/mod_coffee.a /usr/local/apache-httpd/httpd-2.4.10/modules/mod_coffee.a 
libtool: install: chmod 644 /usr/local/apache-httpd/httpd-2.4.10/modules/mod_coffee.a 
libtool: install: ranlib /usr/local/apache-httpd/httpd-2.4.10/modules/mod_coffee.a 
libtool: finish: PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/sbin" ldconfig -n /usr/local/apache-httpd/httpd-2.4.10/modules 
---------------------------------------------------------------------- 
Libraries have been installed in: 
   /usr/local/apache-httpd/httpd-2.4.10/modules

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
chmod 755 /usr/local/apache-httpd/httpd-2.4.10/modules/mod_coffee.so
```
 
これで、mod_coffee.so が Apache の modules ディレクトリに作られました。では httpd.conf を編集します。以下の 4 行を追加します。

 
```
LoadModule coffee_module modules/mod_coffee.so 
<Location /coffee> 
    SetHandler coffee 
</Location> 
```
 
最後に httpd を再起動して、ブラウザーで /coffee を開きます。"The sample page from..." という文字列が表示されれば成功です。

 
![]({{site.assets_url}}2014-12-29-image6.png)

 
apxs コマンドでは、-c -i -a というように同時にオプションを指定すると、ビルド、インストール、設定ファイルへの LoadModule の追加を一気にやってくれます、が、実際にモジュールを開発するときは分けて実行した方がよさそうです。コンパイル エラー出まくるし・・。

 
apxs が生成したテンプレートはコンテンツ ハンドラーで、フィルターではありません。フィルターのテンプレートは作ってくれないので、自分で全部書かないといけません。ハンドラーとなるコールバック関数は、 coffee_register_hooks の中でap_hook_handler によって登録されていますが、これの代わりに ap_register_output_filter を使うと出力フィルターのコールバック関数を登録できます。

 
サーバーが応答するときに、ap_register_output_filter で登録したコールバック関数が前述の bucket brigade をパラメーターとして呼び出されます。bucket brigade が表現するストリーム データが HTTP 応答として送信されるデータになります。フィルターは、この bucket brigade を加工することができます。Apache は複数のフィルターを持つことができ、コールバック関数がパラメーターとして受け取る bucket brigade は、前のフィルターから渡されてきています。つまり、bucket brigade を受け取ったフィルターは、データを加工した後、次のフィルターに加工済みの bucket brigade を流すことでデータを出力したことになります。このあたりがバケツ リレーという名前の由来になっているのでしょう。

 
bucket brigade は双方向循環リストでありapr_bucket_brigade 構造体で表されます。リストの個々の要素はバケツと呼ばれ、apr_bucket 構造体で表されます。バケツには種類があり、メモリ上の BLOB を表す HEAP だけでなく、ディスク上のファイルを表す FILE、ストリームの末尾を表す EOS などがあります。EOS などのメタデータではなく、実データが入っているバケツからは、apr_bucket_read などの関数を使ってデータを char の配列として取り出すことができます。

 
フィルターは、入力データの bucket brigade に対して、バケツの分割や削除、新しいバケツの追加などを行うことができます。最終的には次のフィルターに対して bucket brigade の形でデータを流せばそれが応答になるので、次のフィルターに渡さなかったバケツはフィルターによって削除されたように見えます。次のフィルターに bucket brigade を渡すのは、ap_pass_brigade 関数で行います。渡すことができるのは bucket brigade であり、バケツ単体を渡すことはできません。

 
ここでポイントになるのは、上から流れてきたバケツ リレーと同じものを下のフィルターに渡す必要は全くないということです。フィルターの中で新たにリストの構造 (=apr_bucket_brigade) を作って、中のバケツを新たなリストに移動させて次のフィルターに渡しても全く問題ありません。元のバケツ リレーのリストからバケツを削除したとしても、次のフィルターに渡さない限りその構造は使われないためです。

 
mod_sed や mod_substitute のソースを見ると、コールバック関数の中で bucket brigade の中身を一つずつ読む大きなループを書くのが一般的なように見えます。このとき、次のフィルターに bucket brigade を渡す方法は 2 通り考えられます。ループの中で、バケツ毎に ap_pass_brigade を呼び出す方法、もしくは、ループの中では新しい bucket brigade にバケツを追加するだけにとどめ、ループの後でまとめて ap_pass_brigade を呼び出す方法です。どちらの方法でも構いませんが、後者の方法を取るときは、FLUSH バケツが来たときに、自分がバッファーしているバケツを即時に次のフィルターへ流す処理を実装しないといけません。

 
Guide to writing output filters - Apache HTTP Server Version 2.5 <br />
[http://httpd.apache.org/docs/trunk/developer/output-filters.html](http://httpd.apache.org/docs/trunk/developer/output-filters.html)

 
> A FLUSH bucket indicates that the filter should flush any buffered buckets (if applicable) down the filter chain immediately.
 
例えば mod_substitute は前者の方法にしているので、以下のようなコメントがあります。

 
```
/* 
* No need to handle FLUSH buckets separately as we call 
* ap_pass_brigade anyway at the end of the loop. 
*/
```
 
細かいことを挙げていくとキリがありませんが、以上が調べていて分かった bucket brigade の大体のイメージです。で、何のフィルターを書いたかというと、サンドイッチは、流れてきたデータを HTML ではなくテキストとして表示するためのフィルターで、コーヒーは、どんなバケツが流れてきているのかをコンソール、もしくはエラー ログに出力するためのフィルターです。

 
GitHub にあるコードをビルドして、Apache にインストールした後、httpd.conf に以下の設定を追加します。

 
```
AddOutputFilterByType SANDWICH text/html 
Sandwich_Header "conf/header" 
Sandwich_Footer "conf/footer"

AddOutputFilterByType Sed text/html 
OutputSed "s/Welcome/WELCOME/g"

AddOutputFilterByType SUBSTITUTE text/html 
Substitute "s/h3>/h2>/"

AddOutputFilterByType COFFEE text/html 
Coffee_LogOption 1
```
 
mod_sandwich が使うヘッダーとフッターのファイルを作成します。

 
```
john@glycine:~$ cat /usr/local/apache-httpd/current/conf/header 
<!DOCTYPE html><html><head></head><body><pre>

john@glycine:~$ cat /usr/local/apache-httpd/current/conf/footer 
</pre></body></html>
```
 
index.html はこれを使います。

 
```
<!DOCTYPE html> 
<html><head> 
<meta http-equiv="x-ua-compatible" content="IE=8"> 
</head><body><h3>Welcome!</h3><p>This is a body text.</p></body></html>
```
 
httpd をデバッガーから起動してブラウザーでサーバーにアクセスすると、以下のように表示されます。

 
![]({{site.assets_url}}2014-12-29-image7.png)

 
httpd.conf に設定したように、データは mod_sandwich --&gt; mod_sed --&gt; mod_substitute --&gt; mod_coffee の順に処理されます。welcome は大文字に置換されますが、h3 エレメントは最初の mod_sandwich によって "&gt;" がエスケープされているので置換されません。最後の mod_coffee によって、デバッガー上でには以下のようなログが出力されます。

 
```
ENTERING coffee_filter 
Processing data bucket (len=46) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=1) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=27) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=25) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=87) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=140) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=1) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=21) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=1) 
        ==> ap_pass_brigade returned 0 
LEAVING coffee_filter 
ENTERING coffee_filter 
Processing EOS bucket. 
        ==> ap_pass_brigade returned 0 
LEAVING coffee_filter 
```
 
上記出力から、coffee_filter は 2 回呼び出されていることが分かります。ほとんどは 1 回目の呼び出し時に処理されていますが、EOS だけの bucket brigade が 2 回目の呼び出し時に流れてきています。一回のリクエストであっても、フィルターのコールバック関数が何回呼ばれるのかは、その他のフィルターなどの設定に依存します。

 
フィルターの多くは、入力データを見て、その内容に応じてデータを加工することになるはずです。例えばストリームの先頭の方のデータを見て、末尾の方のデータを変更する、となったときに、先頭のデータを元にする情報はどこかに保持していないといけません。しかし、コールバック関数が何度呼ばれるか分からない以上、それをコールバック関数のローカル変数として保持させるわけにはいきません。このため、多くのフィルターでは、コールバック関数のもう一つのパラメーターである ap_filter_t 構造体の ctx を使います。このポインターに、フィルター独自の構造体を割り当てておくことで、異なるタイミングで呼ばれたコールバック関数内でも一貫したデータを扱えるようになります。

 
デバッガーから、mod_coffee が呼ばれるときのコールスタックを見てみます。

 
```
(gdb) i functions coffee 
All functions matching regular expression "coffee": 

File mod_coffee.c: 
static apr_status_t coffee_filter(ap_filter_t *, apr_bucket_brigade *); 
static void coffee_register_hooks(apr_pool_t *); 
(gdb) break coffee_filter 
Breakpoint 1 at 0x7ffff3aacd30: file mod_coffee.c, line 95. 
(gdb) command 1 
Type commands for breakpoint(s) 1, one per line. 
End with a line saying just "end". 
>bt 
>c 
>end 
(gdb) i break 
Num     Type           Disp Enb Address            What 
1       breakpoint     keep y   0x00007ffff3aacd30 in coffee_filter at mod_coffee.c:95 
        bt 
        c 
(gdb) !touch /usr/local/apache-httpd/current/htdocs/index.html 
(gdb) r -X 
The program being debugged has been started already. 
Start it from the beginning? (y or n) y 
Starting program: /usr/local/apache-httpd/httpd-2.4.10/bin/httpd -X 
[Thread debugging using libthread_db enabled] 
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1". 
warning: Temporarily disabling breakpoints for unloaded shared library "/usr/local/apache-httpd/httpd-2.4.10/modules/mod_coffee.so" 
[New Thread 0x7ffff306c700 (LWP 19607)] 
...snip... 
[New Thread 0x7fffe1feb700 (LWP 19633)] 
[Thread 0x7ffff306c700 (LWP 19607) exited] 
[Switching to Thread 0x7fffe27ec700 (LWP 19632)] 

Breakpoint 1, coffee_filter (f=0x7fffdc008bf8, bb=0x7fffdc00a248) at mod_coffee.c:95 
95      static apr_status_t coffee_filter(ap_filter_t *f, apr_bucket_brigade *bb) { 
#0  coffee_filter (f=0x7fffdc008bf8, bb=0x7fffdc00a248) at mod_coffee.c:95 
#1  0x00007ffff56f6194 in filter_harness (f=0x7fffdc008bf8, bb=0x7fffdc00a248) at mod_filter.c:323 
#2  0x00007ffff54f1bb5 in substitute_filter (f=0x7fffdc008bd0, bb=0x7fffdc00a0d0) at mod_substitute.c:511 
#3  0x00007ffff56f6194 in filter_harness (f=0x7fffdc008bd0, bb=0x7fffdc00a0d0) at mod_filter.c:323 
#4  0x00007ffff52e81f6 in sed_response_filter (f=0x7fffdc008ba8, bb=0x7fffdc009040) at mod_sed.c:376 
#5  0x00007ffff56f6194 in filter_harness (f=0x7fffdc008ba8, bb=0x7fffdc009040) at mod_filter.c:323 
#6  0x00007ffff38a9e6f in sandwich_filter_handler (filter=0x7fffdc008b80, bb=0x7fffdc009040) at mod_sandwich.c:165 
#7  0x00007ffff56f6194 in filter_harness (f=0x7fffdc008b80, bb=0x7fffdc009040) at mod_filter.c:323 
#8  0x0000000000439f07 in default_handler (r=0x7fffdc002970) at core.c:4369 
#9  0x000000000044a260 in ap_run_handler (r=0x7fffdc002970) at config.c:169 
#10 0x000000000044a7a9 in ap_invoke_handler (r=r@entry=0x7fffdc002970) at config.c:433 
#11 0x000000000045dd5a in ap_process_async_request (r=r@entry=0x7fffdc002970) at http_request.c:317 
#12 0x000000000045ad70 in ap_process_http_async_connection (c=0x7fffec0372a0) at http_core.c:143 
#13 ap_process_http_connection (c=0x7fffec0372a0) at http_core.c:228 
#14 0x0000000000453580 in ap_run_process_connection (c=0x7fffec0372a0) at connection.c:41 
#15 0x0000000000465d94 in process_socket (my_thread_num=24, my_child_num=0, cs=0x7fffec037218, sock=<optimized out>, 
    p=<optimized out>, thd=<optimized out>) at event.c:1035 
#16 worker_thread (thd=<optimized out>, dummy=<optimized out>) at event.c:1875 
#17 0x00007ffff754e182 in start_thread (arg=0x7fffe27ec700) at pthread_create.c:312 
#18 0x00007ffff727afbd in clone () at ../sysdeps/unix/sysv/linux/x86_64/clone.S:111 
ENTERING coffee_filter 
Processing data bucket (len=46) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=1) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=27) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=25) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=87) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=140) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=1) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=21) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=1) 
        ==> ap_pass_brigade returned 0 
LEAVING coffee_filter 

Breakpoint 1, coffee_filter (f=0x7fffdc008bf8, bb=0x7fffdc00a248) at mod_coffee.c:95 
95      static apr_status_t coffee_filter(ap_filter_t *f, apr_bucket_brigade *bb) { 
#0  coffee_filter (f=0x7fffdc008bf8, bb=0x7fffdc00a248) at mod_coffee.c:95 
#1  0x00007ffff56f6194 in filter_harness (f=0x7fffdc008bf8, bb=0x7fffdc00a248) at mod_filter.c:323 
#2  0x00007ffff54f1bb5 in substitute_filter (f=0x7fffdc008bd0, bb=0x7fffdc00a0d0) at mod_substitute.c:511 
#3  0x00007ffff56f6194 in filter_harness (f=0x7fffdc008bd0, bb=0x7fffdc00a0d0) at mod_filter.c:323 
#4  0x00007ffff52e81f6 in sed_response_filter (f=0x7fffdc008ba8, bb=0x7fffdc009040) at mod_sed.c:376 
#5  0x00007ffff56f6194 in filter_harness (f=0x7fffdc008ba8, bb=0x7fffdc009040) at mod_filter.c:323 
#6  0x00007ffff38a9e6f in sandwich_filter_handler (filter=0x7fffdc008b80, bb=0x7fffdc009040) at mod_sandwich.c:165 
#7  0x00007ffff56f6194 in filter_harness (f=0x7fffdc008b80, bb=0x7fffdc009040) at mod_filter.c:323 
#8  0x0000000000439f07 in default_handler (r=0x7fffdc002970) at core.c:4369 
#9  0x000000000044a260 in ap_run_handler (r=0x7fffdc002970) at config.c:169 
---Type <return> to continue, or q <return> to quit--- 
#10 0x000000000044a7a9 in ap_invoke_handler (r=r@entry=0x7fffdc002970) at config.c:433 
#11 0x000000000045dd5a in ap_process_async_request (r=r@entry=0x7fffdc002970) at http_request.c:317 
#12 0x000000000045ad70 in ap_process_http_async_connection (c=0x7fffec0372a0) at http_core.c:143 
#13 ap_process_http_connection (c=0x7fffec0372a0) at http_core.c:228 
#14 0x0000000000453580 in ap_run_process_connection (c=0x7fffec0372a0) at connection.c:41 
#15 0x0000000000465d94 in process_socket (my_thread_num=24, my_child_num=0, cs=0x7fffec037218, sock=<optimized out>, 
    p=<optimized out>, thd=<optimized out>) at event.c:1035 
#16 worker_thread (thd=<optimized out>, dummy=<optimized out>) at event.c:1875 
#17 0x00007ffff754e182 in start_thread (arg=0x7fffe27ec700) at pthread_create.c:312 
#18 0x00007ffff727afbd in clone () at ../sysdeps/unix/sysv/linux/x86_64/clone.S:111 
ENTERING coffee_filter 
Processing EOS bucket. 
        ==> ap_pass_brigade returned 0 
LEAVING coffee_filter 
```
 
4 つのフィルターが、httpd.conf に設定した通りの順で呼ばれていることが分かります。行番号を見ると、フィルターから ap_pass_brigade を呼び出すことで filter_harness が呼ばれ、次のフィルターのコールバック関数に繋がることが分かります。

 
次にフィルターの順番を入れ替えます。mod_coffee を mod_sandwich の直後にしました。

 
```
AddOutputFilterByType SANDWICH text/html 
Sandwich_Header "conf/header" 
Sandwich_Footer "conf/footer"

AddOutputFilterByType COFFEE text/html 
Coffee_LogOption 1

AddOutputFilterByType Sed text/html 
OutputSed "s/Welcome/WELCOME/g"

AddOutputFilterByType SUBSTITUTE text/html 
Substitute "s/h3>/h2>/" 
```
 
ブラウザーから見たときの出力結果は変わりませんが、mod_coffee によるコンソール出力がかなり長くなります。

 
```
ENTERING coffee_filter 
Processing data bucket (len=47) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=0) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=4) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=8) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=6) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=4) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=4) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=1) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=4) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=4) 
        ==> ap_pass_brigade returned 0 
(..snip..) 
Processing data bucket (len=0) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=4) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=5) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=4) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=0) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=4) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=5) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=4) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=2) 
        ==> ap_pass_brigade returned 0 
Processing data bucket (len=22) 
        ==> ap_pass_brigade returned 0 
Processing EOS bucket. 
        ==> ap_pass_brigade returned 0 
LEAVING coffee_filter 
```
 
出力が長くなる理由は、mod_sandwich が特殊文字をエスケープするたびにバケツを分割しているためです。例えば上記のうち、len=4 となっているバケツは &gt; か &lt; という 4 文字の文字列と考えられます。しかし、先ほどと違って coffee_filter は一度しか呼ばれません。mod_sed か mod_substitute のどちらかが、細々に分割されたバケツをある程度繋げたのだと判断できます。

