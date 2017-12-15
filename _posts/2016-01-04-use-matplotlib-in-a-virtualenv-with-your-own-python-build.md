---
layout: post
title: "Use matplotlib in a virtualenv with your own Python build"
date: 2016-01-04 19:32:38.000 -08:00
categories:
- Linux
- Python
tags:
- matplotlib
- pip
- virtualenv
---

真っ新の状態の Ubuntu 15.10 に、Python 2.7 をソースからビルドして、matplotlib を virtualenv で動かせるようになるまで一日ぐらいハマったので、コマンドをまとめておきます。

 
まず、ビルドに必要なパッケージを入れます。

 
```
sudo apt-get update 
sudo apt-get install build-essential git openssh-server vim
```
 
今回インストールするパッケージは以下の通り。2016/1/4 時点での最新バージョンです。

 <table width="597" border="0" cellspacing="0" cellpadding="2"><tbody>     <tr>       <td width="201" valign="top">名前</td>        <td width="153" valign="top">URL</td>        <td width="128" valign="top">バージョン</td>        <td width="113" valign="top">依存関係</td>     </tr>      <tr>       <td width="212" valign="top">OpenSSL</td>        <td width="159" valign="top"><a title="http://www.openssl.org/source/" href="http://www.openssl.org/source/">http://www.openssl.org/source/</a></td>        <td width="132" valign="top">1.0.2e</td>        <td width="116" valign="top">なし</td>     </tr>      <tr>       <td width="215" valign="top">zlib</td>        <td width="161" valign="top"><a title="http://zlib.net/" href="http://zlib.net/">http://zlib.net/</a></td>        <td width="133" valign="top">1.2.8</td>        <td width="117" valign="top">なし</td>     </tr>      <tr>       <td width="215" valign="top">Tcl</td>        <td width="162" valign="top"><a title="http://tcl.tk/software/tcltk/download.html" href="http://tcl.tk/software/tcltk/download.html">http://tcl.tk/software/tcltk/download.html</a></td>        <td width="134" valign="top">8.6.4</td>        <td width="117" valign="top">なし</td>     </tr>      <tr>       <td width="215" valign="top">Tk</td>        <td width="162" valign="top"><a title="http://tcl.tk/software/tcltk/download.html" href="http://tcl.tk/software/tcltk/download.html">http://tcl.tk/software/tcltk/download.html</a></td>        <td width="134" valign="top">8.6.4</td>        <td width="117" valign="top">Tcl          <br>libx11-dev</td>     </tr>      <tr>       <td width="215" valign="top">Python</td>        <td width="162" valign="top"><a title="https://www.python.org/downloads/" href="https://www.python.org/downloads/">https://www.python.org/downloads/</a></td>        <td width="134" valign="top">2.7.11</td>        <td width="117" valign="top">OpenSSL          <br>zlib           <br>Tcl           <br>Tk</td>     </tr>   </tbody></table> 
Python 以外にソースからビルドが必要になるコンポーネントの理由は↓。もちろん apt-get でインストールすることもできます。

 
- numpy/scipy/matplotlib をインストールするときに pip を使う 
- pip は HTTPS で zip をダウンロードしてくるので、OpenSSL と zlib が必要 
- matplotlib でプロットを GUI 表示するために ビルトイン モジュールである _tkinter が必要 

 
まずは OpenSSL。コードは GitHub からクローンします。

 
```
$ git clone https://github.com/openssl/openssl.git 
$ cd openssl/ 
$ git checkout refs/tags/OpenSSL_1_0_2e 
$ ./config shared --prefix=/usr/local/openssl/openssl-1.0.2e 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/openssl/openssl-1.0.2e /usr/local/openssl/current
```
 
次 zlib。

 
```
$ wget http://zlib.net/zlib-1.2.8.tar.gz 
$ tar -xvf zlib-1.2.8.tar.gz 
$ cd zlib-1.2.8/ 
$ ./configure --prefix=/usr/local/zlib/zlib-1.2.8 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/zlib/zlib-1.2.8 /usr/local/zlib/current
```
 
次 Tcl。

 
```
$ wget http://prdownloads.sourceforge.net/tcl/tcl8.6.4-src.tar.gz 
$ tar -xvf tcl8.6.4-src.tar.gz 
$ cd tcl8.6.4/unix/ 
$ ./configure --prefix=/usr/local/tcl/tcl-8.6.4 --enable-shared 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/tcl/tcl-8.6.4 /usr/local/tcl/current
```
 
そして Tk。

 
```
$ sudo apt-get install libx11-dev 
$ wget http://prdownloads.sourceforge.net/tcl/tk8.6.4-src.tar.gz 
$ tar -xvf tk8.6.4-src.tar.gz 
$ cd tk8.6.4/unix/ 
$ ./configure --prefix=/usr/local/tk/tk-8.6.4 --enable-shared \ 
--with-tcl=/usr/local/tcl/current/lib 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/tk/tk-8.6.4 /usr/local/tk/current
```
 
ちなみに libx11-dev がインストールされていないと、以下のコンパイル エラーが出ます。

 
```
In file included from /usr/src/tk8.6.4/unix/../generic/tkPort.h:21:0, 
                 from /usr/src/tk8.6.4/unix/../generic/tkInt.h:19, 
                 from /usr/src/tk8.6.4/unix/../generic/tkStubLib.c:14: 
/usr/src/tk8.6.4/unix/../generic/tk.h:96:25: fatal error: X11/Xlib.h: No such file or directory 
compilation terminated. 
Makefile:1164: recipe for target 'tkStubLib.o' failed
```
 
ここまでは余裕です。次に Python をビルドします。

 
```
$ wget https://www.python.org/ftp/python/2.7.11/Python-2.7.11.tgz 
$ tar -xvf Python-2.7.11.tgz 
$ cd Python-2.7.11/ 
$ export LDFLAGS='-L/usr/local/openssl/current/lib -L/usr/local/zlib/current/lib -L/usr/local/tcl/current/lib -L/usr/local/tk/current/lib' 
$ export CPPFLAGS='-I/usr/local/openssl/current/include -I/usr/local/zlib/current/include -I/usr/local/tcl/current/include -I/usr/local/tk/current/include' 
$ export LD_LIBRARY_PATH=/usr/local/openssl/current/lib:/usr/local/zlib/current/lib:/usr/local/tcl/current/lib:/usr/local/tk/current/lib 
$ ./configure --prefix=/usr/local/python/python-2.7.11 \ 
--enable-shared --enable-unicode=ucs4 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/python/python-2.7.11 /usr/local/python/current
```
 
make の最後に以下のようなログが出力されるので、必要なビルトイン モジュール (_ssl, _tkinter, zlib) がコンパイルされ、ログに表示されていないことを確認してください。

 
```
Python build finished, but the necessary bits to build these modules were not found: 
_bsddb             _curses            _curses_panel 
_sqlite3           bsddb185           bz2 
dbm                dl                 gdbm 
imageop            readline           sunaudiodev 
To find the necessary bits, look in setup.py in detect_modules() for the module's name.
```
 
失敗例を示します。以下の例では、zlib と _ssl がコンパイルされていないので、後続の手順を実行できません。

 
```
Python build finished, but the necessary bits to build these modules were not found: 
_bsddb             _curses            _curses_panel 
_sqlite3           bsddb185           bz2 
dbm                dl                 gdbm 
imageop            readline           sunaudiodev 
zlib 
To find the necessary bits, look in setup.py in detect_modules() for the module's name.

Failed to build these modules: 
_ssl
```
 
Python ビルド時のポイントは以下の通りです。

 
- ヘッダーやライブラリの有無を自動的に確認し、存在する場合のみモジュールが インストールされる <br />
（Apache の configure のように、--with-xxx というオプションは存在しない） 
- 予めビルドしておいた zlib や tcl/tk のパスを認識させる必要がある 
- configure 前に環境変数 LDFLAGS, CPPFLAGS を設定しておくと、configure で Makefile に値が反映される 
- ビルトイン モジュールがロードされたときに、依存関係のある共有モジュール tcl/tk を正しく見つからければならないため、環境変数 LD_LIBRARY_PATH で対応 <br />
（後述するが、LD_LIBRARY_PATH ではなく ldconfig でグローバルに追加しておいてもよい。というかその方が楽。） 

 
ここでハマりやすいポイントは共有モジュールの検索パスの追加です。共有モジュールが見つからないと、ビルド後のエクスポート関数のチェックで失敗して、以下のようなエラーが出ます。

 
```
// OpenSSL の共有モジュールが見つからない場合 
*** WARNING: renaming "_ssl" since importing it failed: build/lib.linux-x86_64-2.7/_ssl.so: undefined symbol: SSLv2_method

// Tcl/Tk の共有モジュールが見つからない場合 
*** WARNING: renaming "_tkinter" since importing it failed: build/lib.linux-x86_64-2.7/_tkinter.so: undefined symbol: Tcl_GetCharLength
```
 
余談になりますが、./configure --help でパラメーターを確認すると、--with-libs オプションと LIBS 環境変数を使って、追加のライブラリをリンクすることができるように書かれています。今回は共有ライブラリなので、これらのオプションを使ってライブラリを追加する必要がありませんが、実は LIBS 環境変数は罠で、--with-libs オプションを使わないと駄目です。configure を実行すると、--with-libs の値を含めて LIBS 変数を一から作るので、configure 前に LIBS を指定しても上書きされてしまいます。また、ヘルプの書式も分かりにくいのですが、configure は --with-libs の値をそのまま LIBS に追加し、それがリンカのパラメーターの一部になります。したがって、仮に --with-libs を使うときは --with-libs='-lssl -lz' というように -l オプションをつけないといけません。実に紛らわしいヘルプです。

 
```
$ /usr/src/Python-2.7.11/configure --help 
`configure' configures python 2.7 to adapt to many kinds of systems.

Usage: /usr/src/Python-2.7.11/configure [OPTION]... [VAR=VALUE]...

(snip)

  --with-libs='lib1 ...'  link against additional libs

(snip)

  CFLAGS      C compiler flags 
  LDFLAGS     linker flags, e.g. -L<lib dir> if you have libraries in a 
              nonstandard directory <lib dir> 
  LIBS        libraries to pass to the linker, e.g. -l<library> 
  CPPFLAGS    (Objective) C/C++ preprocessor flags, e.g. -I<include dir> if 
              you have headers in a nonstandard directory <include dir> 
  CPP         C preprocessor

(snip) 
```
 
これで Python の準備はできました。次に pip をインストールします。方法は幾つかありますが、ここでは get-pip.py を使います。

 
Installation — pip 7.1.2 documentation <br />
[https://pip.pypa.io/en/stable/installing/](https://pip.pypa.io/en/stable/installing/)

 
ダウンロード時になぜか証明書エラーが出るので --no-check-certificate オプションをつけていますが、基本的には不要です。

 
```
$ wget --no-check-certificate https://bootstrap.pypa.io/get-pip.py 
$ sudo -H /usr/local/python/current/bin/python get-pip.py
```
 
今までの手順通りにやると、ここでエラーが出るはずです。

 
```
$ sudo -H /usr/local/python/current/bin/python get-pip.py 
Traceback (most recent call last): 
  File "get-pip.py", line 17759, in <module> 
    main() 
  File "get-pip.py", line 162, in main 
    bootstrap(tmpdir=tmpdir) 
  File "get-pip.py", line 82, in bootstrap 
    import pip 
  File "/tmp/tmpuPVaWi/pip.zip/pip/__init__.py", line 15, in <module> 
  File "/tmp/tmpuPVaWi/pip.zip/pip/vcs/subversion.py", line 9, in <module> 
  File "/tmp/tmpuPVaWi/pip.zip/pip/index.py", line 30, in <module> 
  File "/tmp/tmpuPVaWi/pip.zip/pip/wheel.py", line 35, in <module> 
  File "/tmp/tmpuPVaWi/pip.zip/pip/_vendor/distlib/scripts.py", line 14, in <module> 
  File "/tmp/tmpuPVaWi/pip.zip/pip/_vendor/distlib/compat.py", line 31, in <module> 
ImportError: cannot import name HTTPSHandler
```
 
理由は、sudo で実行している python には LD_LIBRARY_PATH によるライブラリの検索パスが反映されていないためです。sudo -H LD_LIBRARY_PATH=*** /usr/local/python/current/bin/python *** というように一行で実行することもできますが、システム ワイドに検索パスを追加しておいた方が後々楽です。

 
ここでは /etc/ld.so.conf.d/local.conf というファイルを新しく作って ldconfig を実行します。

 
```
john@ubuntu1510:/usr/src$ sudo vi /etc/ld.so.conf.d/local.conf <<< 作成 
john@ubuntu1510:/usr/src$ cat /etc/ld.so.conf.d/local.conf 
/usr/local/openssl/current/lib 
/usr/local/zlib/current/lib 
/usr/local/tcl/current/lib 
/usr/local/tk/current/lib 
john@ubuntu1510:/usr/src$ sudo ldconfig 
john@ubuntu1510:/usr/src$ ldconfig -v | grep ^/ <<< 確認 
/sbin/ldconfig.real: Path `/lib/x86_64-linux-gnu' given more than once 
/sbin/ldconfig.real: Path `/usr/lib/x86_64-linux-gnu' given more than once 
/usr/lib/x86_64-linux-gnu/libfakeroot: 
/usr/local/lib: 
/usr/local/openssl/current/lib: 
/usr/local/zlib/current/lib: 
/usr/local/tcl/current/lib: 
/usr/local/tk/current/lib: 
/lib/x86_64-linux-gnu: 
/sbin/ldconfig.real: /lib/x86_64-linux-gnu/ld-2.21.so is the dynamic linker, ignoring

/usr/lib/x86_64-linux-gnu: 
/usr/lib/x86_64-linux-gnu/mesa-egl: 
/usr/lib/x86_64-linux-gnu/mesa: 
/lib: 
/usr/lib: 
/sbin/ldconfig.real: Can't create temporary cache file /etc/ld.so.cache~: Permission denied
```
 
これで get-pip.py はうまく実行できるはずです。

 
```
$ sudo -H /usr/local/python/current/bin/python get-pip.py 
[sudo] password for john: 
Collecting pip 
  Downloading pip-7.1.2-py2.py3-none-any.whl (1.1MB) 
    100% |????????????????????????????????| 1.1MB 204kB/s 
Collecting setuptools 
  Downloading setuptools-19.2-py2.py3-none-any.whl (463kB) 
    100% |????????????????????????????????| 466kB 693kB/s 
Collecting wheel 
  Downloading wheel-0.26.0-py2.py3-none-any.whl (63kB) 
    100% |????????????????????????????????| 65kB 5.4MB/s 
Installing collected packages: pip, setuptools, wheel 
Successfully installed pip-7.1.2 setuptools-19.2 wheel-0.26.0
```
 
pip がインストールされたので、これを使って virtualenv をインストールします。本来であれば、この時点で /usr/local/bin/pip のようなスクリプトが作られて、pip コマンドを実行できるはずなのですか、これまでの手順だとなぜか作られません。それほど支障にはならないので、pip コマンドの代わりに python -m pip &lt;command&gt; という風に python を直に実行します。

 
```
$ sudo -H /usr/local/python/current/bin/python -m pip install virtualenv 
Collecting virtualenv 
  Downloading virtualenv-13.1.2-py2.py3-none-any.whl (1.7MB) 
    100% |????????????????????????????????| 1.7MB 333kB/s 
Installing collected packages: virtualenv 
Successfully installed virtualenv-13.1.2
```
 
virtualenv 環境を作ります。

 
```
$ /usr/local/python/current/bin/python -m virtualenv ~/Documents/pydev 
New python executable in /home/john/Documents/pydev/bin/python 
Installing setuptools, pip, wheel...done. 
$ cd ~/Documents/pydev/ 
$ source bin/activate 
(pydev)$
```
 
virtualenv 内では pip コマンドが使えます。依存パッケージを予めインストールし、普通に pip を使うだけです。

 
```
$ sudo apt-get install libblas-dev libatlas-dev liblapack-dev \ 
gfortran libfreetype6-dev libpng12-dev 
$ pip install numpy scipy matplotlib
```
 
依存パッケージが存在しなかった時のエラーは以下の通りです。

 
```
// scipy インストール時のエラー (1) 
  File "scipy/linalg/setup.py", line 20, in configuration 
    raise NotFoundError('no lapack/blas resources found') 
numpy.distutils.system_info.NotFoundError: no lapack/blas resources found

// scipy インストール時のエラー (2) 
building 'dfftpack' library 
error: library dfftpack has Fortran sources but no Fortran compiler found

// matplotlib インストール時のエラー 
* The following required packages can not be built: 
* freetype, png
```
 
最後に、scatter plot のサンプルを使って動作確認をします。

 
shapes_and_collections example code: scatter_demo.py — Matplotlib 1.5.0 documentation <br />
[http://matplotlib.org/examples/shapes_and_collections/scatter_demo.html](http://matplotlib.org/examples/shapes_and_collections/scatter_demo.html)

 
```
(pydev)$ export TK_LIBRARY=/usr/local/tk/current/lib/tk8.6 
(pydev)$ wget http://matplotlib.org/mpl_examples/shapes_and_collections/scatter_demo.py 
(pydev)$ python scatter_demo.py
```
 
以下のようなプロットが表示されれば成功です。

 
![]({{site.assets_url}}2016-01-04-scatterdemo.png)

 
ここで環境変数 TK_LIBRARY を設定しているのは、python からは Tcl が呼ばれているらしく、tk.tcl の検索パスが /usr/local/tcl であり、/usr/local/tk を検索してくれないためです。ファイルは tk 以下にあります。

 
```
$ find /usr/local -name tk.tcl 
/usr/local/tk/tk-8.6.4/lib/tk8.6/tk.tcl
```
 
具体的には、以下のようなエラーが出ます。

 
```
  File "/usr/local/python/current/lib/python2.7/lib-tk/Tkinter.py", line 1814, in __init__ 
    self.tk = _tkinter.create(screenName, baseName, className, interactive, wantobjects, useTk, sync, use) 
_tkinter.TclError: Can't find a usable tk.tcl in the following directories: 
    /usr/local/tcl/tcl-8.6.4/lib/tcl8.6/tk8.6 /usr/local/tcl/tcl-8.6.4/lib/tk8.6 /home/john/Documents/pydev/lib/tk8.6 /home/john/Documents/lib/tk8.6 /home/john/Documents/pydev/library
```
 
環境変数で対応するのが気持ち悪い場合は、Tcl と Tk を同じディレクトリにインストールしてしまうという手があります。tcl と tk の代わりに、tktcl というディレクトリを作った場合の例を以下にします。こっちのほうがシンプルになってよいかもしれません。

 
```
$ wget http://prdownloads.sourceforge.net/tcl/tcl8.6.4-src.tar.gz 
$ tar -xvf tcl8.6.4-src.tar.gz 
$ cd tcl8.6.4/unix/ 
$ ./configure --prefix=/usr/local/tktcl/tktcl-8.6.4 --enable-shared 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/tktcl/tktcl-8.6.4 /usr/local/tktcl/current

$ sudo apt-get install libx11-dev 
$ wget http://prdownloads.sourceforge.net/tcl/tk8.6.4-src.tar.gz 
$ tar -xvf tk8.6.4-src.tar.gz 
$ cd tk8.6.4/unix/ 
$ ./configure --prefix=/usr/local/tktcl/tktcl-8.6.4 --enable-shared \ 
--with-tcl=/usr/local/tktcl/current/lib 
$ make 
$ sudo make install

$ cat /etc/ld.so.conf.d/local.conf 
/usr/local/openssl/current/lib 
/usr/local/zlib/current/lib 
/usr/local/tktcl/current/lib

$ wget https://www.python.org/ftp/python/2.7.11/Python-2.7.11.tgz 
$ tar -xvf Python-2.7.11.tgz 
$ cd Python-2.7.11/ 
$ export LDFLAGS='-L/usr/local/openssl/current/lib -L/usr/local/zlib/current/lib -L/usr/local/tktcl/current/lib' 
$ export CPPFLAGS='-I/usr/local/openssl/current/include -I/usr/local/zlib/current/include -I/usr/local/tktcl/current/include' 
$ ./configure --prefix=/usr/local/python/python-2.7.11 \ 
--enable-shared --enable-unicode=ucs4 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/python/python-2.7.11 /usr/local/python/current
```
 
今回紹介した matplotlib を virtualenv で使う方法は、ずいぶんとハマっている人が多いです。最初につまずくのは、plt.show() を実行しても何も表示されないという現象です。ほとんどの場合において、Python の _tkinter モジュールが正しくインストールされていないため、matplotlib の backend が non-interactive の agg になっていることが理由と考えられます。これは matplotlib をインポートした後に get_backend() を実行することで確認できます。

 
```
// GUI が表示される場合 
>>> import matplotlib 
>>> matplotlib.get_backend() 
u'TkAgg'

// GUI が表示されない場合 
>>> import matplotlib 
>>> matplotlib.get_backend() 
u'agg'
```
 
Matplotlib のページを見ると、virtualenv を作るときに --system-site-packages オプションを使うと解決できる、とも書かれていますが、少なくとも今回紹介した手順では、このオプションを使わなくても GUI 表示が可能でした。

 
Working with Matplotlib in Virtual environments — Matplotlib 1.5.0 documentation <br />
[http://matplotlib.org/faq/virtualenv_faq.html](http://matplotlib.org/faq/virtualenv_faq.html)

