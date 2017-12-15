---
layout: post
title: "Boost.Python debugging"
date: 2015-12-27 12:36:38.000 -08:00
categories:
- C/C++
- Debug
- Linux
- Python
tags:
- PyTypeObject
---

Boost.Python で std::valarray をエクスポートする際、\__getitem__ に operator&#x5b;&#x5d; を渡すと、インデックスが境界を超えてもエラーにならないため、無限ループに陥る現象について書きました。その後の追加情報を紹介します。

  
### 1. 非メンバ関数をクラス メソッドとしてエクスポート

 
前回は、回避策として valarray を継承したクラスを作って operator::at を新たに定義しました。が、Python の wiki を見ていたところ、Boost.Python の class_ で定義するコンバーターのメンバー関数にはメンバー関数ポインターだけでなく、通常の関数も指定できることが分かりました。

 
boost.python/ExportingClasses - Python Wiki <br />
[https://wiki.python.org/moin/boost.python/ExportingClasses](https://wiki.python.org/moin/boost.python/ExportingClasses)

 
これを使うと、新たにクラスを定義しなくても \__getitem__ を正しく定義できます。

 
```
#include <boost/python.hpp> 
#include <valarray> 
#include <random> 
#include <stdio.h>

std::default_random_engine generator; 
std::uniform_real_distribution<double> distribution(0.0, 1.0);

typedef std::valarray<double> darray;

class Field { 
private: 
    darray _data;

public: 
    Field(int n) : _data(n) { 
        printf("Field::Field(): %p\n", this); 
    } 
    ~Field() { 
        printf("Field::~Field() %p\n", this); 
    }

    void Dump() const { 
        printf("["); 
        for (auto &d : _data) { 
            printf("% 3.3f", d); 
        } 
        printf(" ]\n"); 
    }

    void Churn() { 
        for (auto &d : _data) { 
            d = distribution(generator); 
        } 
    }

    const darray &Positions() const { 
        return _data; 
    } 
};

double GetAt(const darray &arr, size_t n) { 
    if (n >= arr.size()) { 
        std::__throw_out_of_range_fmt(__N("out_of_range")); 
    } 
    return arr[n]; 
}

BOOST_PYTHON_MODULE(ems) { 
    using namespace boost::python;

    class_<Field>("Field", init<int>()) 
        .def("Positions", &Field::Positions, 
             return_internal_reference<>()) 
        .def("Dump", &Field::Dump) 
        .def("Churn", &Field::Churn) 
        ;

    class_<darray>("darray") 
        .def("__getitem__", GetAt) 
        .def("__len__", &darray::size) 
        ; 
}
```
 
ここから、壮大に話が逸れていくのですが、前回こんなことを書きました。

 
```
もう少し見てみないと分かりませんが、ems.Field オブジェクトが iterator を使ってシーケンシャルにアクセスする種類になっているのが悪いのではないかと思います。何らかの方法で、ems.Field は iterator ではなくインデックスを使ってランダム アクセスすべきものに種別できればちゃんと動くのではないかと。そんな種類があるかどうか分かりませんが。後で調べよう。
```
 
今回も結論から書くとたぶんこれは無理です。Boost.Python をデバッグしつつ調べたので、その過程を書いておきます。

 
### 2. Boost.Python をソースからビルドして使う

 
まずデバッグ環境の構築です。Boost のコードは GitHub にあるので、クローンしてからビルドします。

 
```
git clone --recursive https://github.com/boostorg/boost.git modular-boost 
git checkout refs/tags/boost-1.60.0 
cd modular-boost/ 
./bootstrap.sh 
./b2 -a --with-python debug-symbols=on 
sudo ./b2 -a --prefix=/usr/local/boost/boost-1.60.0 --with-python debug-symbols=on install 
sudo ln -s /usr/local/boost/boost-1.60.0 /usr/local/boost/current 
```
 
コマンドを作るうえで参考にしたページは↓。Boost をビルドしている人は少ない気がする・・。

 
TryModBoost – Boost C++ Libraries <br />
[https://svn.boost.org/trac/boost/wiki/TryModBoost](https://svn.boost.org/trac/boost/wiki/TryModBoost)

 
Installing Boost.Python on your System <br />
[http://boostorg.github.io/python/doc/html/building/installing_boost_python_on_your_.html](http://boostorg.github.io/python/doc/html/building/installing_boost_python_on_your_.html)

 
Builtin features <br />
[http://www.boost.org/build/doc/html/bbv2/overview/builtins/features.html](http://www.boost.org/build/doc/html/bbv2/overview/builtins/features.html)

 
ビルドには、make ではなく b2 (build boost?) を使います。最新のリポジトリをクローンしてそのままビルドしたところ、文法エラーでビルドが失敗したので、boost-1.60.0 のタグの状態でビルドしました。もう直っているかもしれません。

 
デバッグ情報を生成するため、debug-symbols=on というオプションをつけています。これは、コードの最適化はデフォルトの ON にしたまま、デバッグ情報を生成するという意味です。普通は variant=debug というオプションをつけて、最適化も off にしたほうがいいです。インライン展開された魔境に挑みたい人のみ、debug-symbols=on を使いましょう。 

 
上記コマンドで、libboost_python が /usr/local/boost/current/lib にできるので、C++ の Makefile を以下のように変更します。Boost,Python は Python API を使うので、API の中をデバッグするため、libpython2.7 のデバッグ情報もあったほうが便利です。以下の Makefile は、ソースからビルドした Python 2.7 が /usr/local/python/current/ にインストールされている前提です。Boost.Python を使って共有ライブラリを作るので、libpython2.7 も PIC でコンパイルする必要があります。つまり、Python の configure で --enable-shared オプションをつけておいてください。

 
```
CC=g++ 
RM=rm -f

TARGET=ems.so 
SRCS=$(wildcard *.cpp) 
OBJS=$(SRCS:.cpp=.o)

override CFLAGS+=-Wall -fPIC -std=c++11 -O2 -g 
LFLAGS=

INCLUDES=-I/usr/local/python/current/include/python2.7 -I/usr/local/boost/current/include 
LIBDIRS=-L/usr/local/python/current/lib -L/usr/local/boost/current/lib 
LIBS=-lpython2.7 -lboost_python

all: clean $(TARGET)

clean: 
        $(RM) $(OBJS) $(TARGET)

$(TARGET): $(OBJS) 
        $(CC) -shared $(LFLAGS) $(LIBDIRS) $^ -o $@ $(LIBS)

$(OBJS): $(SRCS) 
        $(CC) $(INCLUDES) $(CFLAGS) -c $^
```
 
デバッガーを起動する前に、python を実行する前のライブラリの検索パスにも追加しておきます。gdb を起動するときはこんな感じにします。

 
```
export PYTHONPATH=/usr/local/lib/python2.7/dist-packages 
export LD_LIBRARY_PATH=/usr/local/boost/current/lib:/usr/local/python/current/lib 
gdb /usr/local/python/current/bin/python 
```
 
ここから gdb によるデバッグを行いますが、結果として何か得られたわけではありません。考え方の参考になれば幸いです。

 
まず、Python API に PyObject_GetIter という関数があります。

 
Object Protocol — Python 2.7.11 documentation <br />
[https://docs.python.org/2/c-api/object.html](https://docs.python.org/2/c-api/object.html)

 
valarray のコンバーターである darray に対して Python から列挙を行なおうとすると、PyObject_GetIter が呼ばれます。

 
```
john@ubuntu1510:~/Documents/pyc$ export PYTHONPATH=/usr/local/lib/python2.7/dist-packages 
john@ubuntu1510:~/Documents/pyc$ export LD_LIBRARY_PATH=/usr/local/boost/current/lib:/usr/local/python/current/lib 
john@ubuntu1510:~/Documents/pyc$ gdb /usr/local/python/current/bin/python 
GNU gdb (Ubuntu 7.10-1ubuntu2) 7.10 
Copyright (C) 2015 Free Software Foundation, Inc. 
(略) 
Type "apropos word" to search for commands related to "word"... 
Reading symbols from /usr/local/python/current/bin/python...done. 
(gdb) r 
Starting program: /usr/local/python/python-2.7.11/bin/python 
[Thread debugging using libthread_db enabled] 
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1". 
Python 2.7.11 (default, Dec 22 2015, 22:30:16) 
[GCC 5.2.1 20151010] on linux2 
Type "help", "copyright", "credits" or "license" for more information. 
>>> import ems 
>>> f = ems.Field(4) 
Field::Field(): 0x6d09d0 
>>> x = f.Positions() 
>>> x 
<ems.darray object at 0x7ffff7ed5600> 
>>> 
Program received signal SIGINT, Interrupt. 
0x00007ffff74e4723 in __select_nocancel () at ../sysdeps/unix/syscall-template.S:81 
81      ../sysdeps/unix/syscall-template.S: No such file or directory. 
(gdb) b PyObject_GetIter 
Breakpoint 1 at 0x7ffff7a261c0: file Objects/abstract.c, line 3085. 
(gdb) i b 
Num     Type           Disp Enb Address            What 
1       breakpoint     keep y   0x00007ffff7a261c0 in PyObject_GetIter at Objects/abstract.c:3085 
(gdb) c 
Continuing.

>>> [i for i in x]

Breakpoint 1, PyObject_GetIter (o=o@entry=0x7ffff7ed5600) at Objects/abstract.c:3085 
3085    { 
(gdb) bt 5 
#0  PyObject_GetIter (o=o@entry=0x7ffff7ed5600) at Objects/abstract.c:3085 
#1  0x00007ffff7ad7db0 in PyEval_EvalFrameEx (f=f@entry=0x7ffff7f7e050, 
    throwflag=throwflag@entry=0) at Python/ceval.c:2790 
#2  0x00007ffff7ae068c in PyEval_EvalCodeEx (co=co@entry=0x7ffff7ed6930, 
    globals=globals@entry=0x7ffff7f6b168, locals=locals@entry=0x7ffff7f6b168, args=args@entry=0x0, 
    argcount=argcount@entry=0, kws=kws@entry=0x0, kwcount=0, defs=0x0, defcount=0, closure=0x0) 
    at Python/ceval.c:3582 
#3  0x00007ffff7ae07a9 in PyEval_EvalCode (co=co@entry=0x7ffff7ed6930, 
    globals=globals@entry=0x7ffff7f6b168, locals=locals@entry=0x7ffff7f6b168) at Python/ceval.c:669 
#4  0x00007ffff7b05d81 in run_mod (arena=0x66f100, flags=0x7fffffffe370, locals=0x7ffff7f6b168, 
    globals=0x7ffff7f6b168, filename=0x7fffffffe370 "", mod=0x6b9ce8) at Python/pythonrun.c:1370 
(More stack frames follow...)
```
 
関数のコードはこうなっています。引数として与えられた Python オブジェクトに関連付けられた Iterator をオブジェクトとして返す関数です。

 
```
Objects/abstract.c 
3083 PyObject * 
3084 PyObject_GetIter(PyObject *o) 
3085 { 
3086     PyTypeObject *t = o->ob_type; 
3087     getiterfunc f = NULL; 
3088     if (PyType_HasFeature(t, Py_TPFLAGS_HAVE_ITER)) 
3089         f = t->tp_iter; 
3090     if (f == NULL) { 
3091         if (PySequence_Check(o)) 
3092             return PySeqIter_New(o); 
3093         return type_error("'%.200s' object is not iterable", o); 
3094     } 
3095     else { 
3096         PyObject *res = (*f)(o); 
3097         if (res != NULL && !PyIter_Check(res)) { 
3098             PyErr_Format(PyExc_TypeError, 
3099                          "iter() returned non-iterator " 
3100                          "of type '%.100s'", 
3101                          res->ob_type->tp_name);
```
 
関数の冒頭で、引数の PyTypeObject で Py_TPFLAGS_HAVE_ITER フラグを判定し、有効な場合は関連付けられた iterator である tp_iter を使うようになっています。これをパッと見たときに、valarray からコンバートした darray オブジェクトからこのフラグを削除してみようと考えました。まずは、現時点での TypeObject を見てます。

 
```
(gdb) frame 
#0  PyObject_GetIter (o=o@entry=0x7ffff7ed5600) at Objects/abstract.c:3085 
3085    { 
(gdb) p *o->ob_type 
$1 = {ob_refcnt = 5, ob_type = 0x7ffff5a7cc40 <boost::python::class_metatype_object>, ob_size = 0, 
  tp_name = 0x7ffff7e94954 "darray", tp_basicsize = 48, tp_itemsize = 1, 
  tp_dealloc = 0x7ffff7a8b390 <subtype_dealloc>, tp_print = 0x0, tp_getattr = 0x0, 
  tp_setattr = 0x0, tp_compare = 0x0, tp_repr = 0x7ffff7a8f390 <object_repr>, 
  tp_as_number = 0x6d3c88, tp_as_sequence = 0x6d3dd8, tp_as_mapping = 0x6d3dc0, 
  tp_hash = 0x7ffff7a70be0 <_Py_HashPointer>, tp_call = 0x0, tp_str = 0x7ffff7a8acc0 <object_str>, 
  tp_getattro = 0x7ffff7a72410 <PyObject_GenericGetAttr>, 
  tp_setattro = 0x7ffff7a72670 <PyObject_GenericSetAttr>, tp_as_buffer = 0x6d3e28, 
  tp_flags = 153595, tp_doc = 0x0, tp_traverse = 0x7ffff7a8b0a0 <subtype_traverse>, 
  tp_clear = 0x7ffff7a8d290 <subtype_clear>, tp_richcompare = 0x0, tp_weaklistoffset = 32, 
  tp_iter = 0x0, tp_iternext = 0x7ffff7a72100 <_PyObject_NextNotImplemented>, tp_methods = 0x0, 
  tp_members = 0x6d3e68, tp_getset = 0x0, 
  tp_base = 0x7ffff5a7cfa0 <boost::python::objects::class_type_object>, tp_dict = 0x7ffff7e98050, 
  tp_descr_get = 0x0, tp_descr_set = 0x0, tp_dictoffset = 24, 
  tp_init = 0x7ffff7a91f70 <slot_tp_init>, tp_alloc = 0x7ffff7a8ade0 <PyType_GenericAlloc>, 
  tp_new = 0x7ffff5856890 
     <boost::python::objects::instance_new(PyTypeObject*, PyObject*, PyObject*)>, 
  tp_free = 0x7ffff7b1e2b0 <PyObject_GC_Del>, tp_is_gc = 0x0, tp_bases = 0x7ffff7e96410, 
  tp_mro = 0x7ffff7e8e780, tp_cache = 0x0, tp_subclasses = 0x0, tp_weaklist = 0x7ffff7e77f70, 
  tp_del = 0x0, tp_version_tag = 0} 
(gdb) p/x 153595 
$2 = 0x257fb
```
 
型の名前は "darray" となっており、Py_TPFLAGS_HAVE_ITER (= 0x80) は ON、tp_iter は NULL になっています。気づくまで時間がかかってしまったのですが、この TypeObject の内容と PyObject_GetIter のコードを見る限り、Py_TPFLAGS_HAVE_ITER の有無による影響はなく、いずれの場合でも f == NULL は true になります。そこで PySequence_Check の定義を見ます。

 
```
Objects/abstract.c 
1843 int 
1844 PySequence_Check(PyObject *s) 
1845 { 
1846     if (s == NULL) 
1847         return 0; 
1848     if (PyInstance_Check(s)) 
1849         return PyObject_HasAttrString(s, "__getitem__"); 
1850     if (PyDict_Check(s)) 
1851         return 0; 
1852     return  s->ob_type->tp_as_sequence && 
1853         s->ob_type->tp_as_sequence->sq_item != NULL; 
1854 }
```
 
darray オブジェクトは、3 つの if 文には引っかかりませんが、最後の条件で true になります。sq_item の値は slot_sq_item 関数になっています。slot_sq_item 関数は前回のデバッグ時に、iter_iternext から呼び出されており、これらが境界チェックをしていないのが無限ループの原因でした。

 
```
(gdb) p *$1.tp_as_sequence 
$8 = {sq_length = 0x7ffff7a93f60 <slot_sq_length>, sq_concat = 0x0, sq_repeat = 0x0, 
  sq_item = 0x7ffff7a91090 <slot_sq_item>, sq_slice = 0x0, sq_ass_item = 0x0, sq_ass_slice = 0x0, 
  sq_contains = 0x0, sq_inplace_concat = 0x0, sq_inplace_repeat = 0x0}
```
 
そんなわけで PySequence_Check は true を返すので、PyObject_GetIter から PySeqIter_New が呼ばれて新しい iterator が作られます。その iterator が↓です。gdb に windbg で言うところの ub コマンドが無いのが辛い・・。

 
```
(gdb) x/5i 0x7ffff7ad7da1 
   0x7ffff7ad7da1 <PyEval_EvalFrameEx+4225>:    mov    %rcx,%rbp 
   0x7ffff7ad7da4 <PyEval_EvalFrameEx+4228>:    mov    -0x8(%rbx),%r13 
   0x7ffff7ad7da8 <PyEval_EvalFrameEx+4232>:    mov    %r13,%rdi 
   0x7ffff7ad7dab <PyEval_EvalFrameEx+4235>:    callq  0x7ffff7a0f550 <PyObject_GetIter@plt> 
=> 0x7ffff7ad7db0 <PyEval_EvalFrameEx+4240>:    subq   $0x1,0x0(%r13) 
(gdb) p *(seqiterobject*)$rax 
$9 = {ob_refcnt = 1, ob_type = 0x7ffff7d9e9c0 <PySeqIter_Type>, it_index = 0, 
  it_seq = 0x7ffff7ed5600}
```
 
つまり、\__getitem__ だけを実装したオブジェクトはシーケンスとして扱われるが、Python はシーケンスもリストも iterator を使ってアクセスし、それは境界をいちいちチェックしない、という仕様になっています。つまりわりとどうしようもないです。冒頭で書いたように、クラス定義をしなくても通常関数をオブジェクト メソッドとして実装できるので、それが正しい解決策なのだと思います。

 
Boost のデバッグいつ出てくるんだ、という話ですが、Python オブジェクトから Py_TPFLAGS_HAVE_ITER フラグを消す方法を見つけるためにデバッグしました。

 
### 3. Boost.Python のコードをデバッグする

 
上述の o-&gt;ob_type が指すオブジェクトがいつ作られているのか、を追いかけます。Boost や Python のコードを見ても、Py_TPFLAGS_HAVE_ITER を個別に設定しているコードは無く、デフォルトの Py_TPFLAGS_DEFAULT で使われているだけです。darray の TypeObject が作られるヒントとしては、TypeObject の ob_type が ob_type = 0x7ffff5a7cc40 &lt;boost::python::class_metatype_object&gt; になっているのが使えます。

 
class_metatype_object は、Boost.Python のグローバル変数であり、これが使われる場所は一箇所しかありません。それが class_metatype() です。

 
```
src/object/class.cpp 
315   BOOST_PYTHON_DECL type_handle class_metatype() 
316   { 
317       if (class_metatype_object.tp_dict == 0) 
318       { 
319           Py_TYPE(&class_metatype_object) = &PyType_Type; 
320           class_metatype_object.tp_base = &PyType_Type; 
321           if (PyType_Ready(&class_metatype_object)) 
322               return type_handle(); 
323       } 
324       return type_handle(borrowed(&class_metatype_object)); 
325   }
```
 
幸い、この関数はインライン展開されないので、ここを起点にします。ポイントは、この関数はモジュールのインポート時に呼ばれることです。そこで、import 後の状態で関数の完全修飾名を調べてから、再度デバッグ ターゲットを実行します。

 
```
john@ubuntu1510:~/Documents/pyc$ gdb /usr/local/python/current/bin/python 
GNU gdb (Ubuntu 7.10-1ubuntu2) 7.10 
(略) 
Reading symbols from /usr/local/python/current/bin/python...done. 
(gdb) r 
Starting program: /usr/local/python/python-2.7.11/bin/python 
[Thread debugging using libthread_db enabled] 
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1". 
Python 2.7.11 (default, Dec 22 2015, 22:30:16) 
[GCC 5.2.1 20151010] on linux2 
Type "help", "copyright", "credits" or "license" for more information. 
>>> import ems # まずは何もせずインポート 
>>> 
Program received signal SIGINT, Interrupt. 
0x00007ffff74e4723 in __select_nocancel () at ../sysdeps/unix/syscall-template.S:81 
81      ../sysdeps/unix/syscall-template.S: No such file or directory. 
(gdb) i func class_metatype # 完全修飾名を調べる 
All functions matching regular expression "class_metatype":

File libs/python/src/object/class.cpp: 
boost::python::type_handle boost::python::objects::class_metatype();

Non-debugging symbols: 
0x00007ffff5845c40  boost::python::objects::class_metatype()@plt 
(gdb) r # 再実行 
The program being debugged has been started already. 
Start it from the beginning? (y or n) y 
Starting program: /usr/local/python/python-2.7.11/bin/python 
[Thread debugging using libthread_db enabled] 
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1". 
Python 2.7.11 (default, Dec 22 2015, 22:30:16) 
[GCC 5.2.1 20151010] on linux2 
Type "help", "copyright", "credits" or "license" for more information. 
>>> 
Program received signal SIGINT, Interrupt. 
0x00007ffff74e4723 in __select_nocancel () at ../sysdeps/unix/syscall-template.S:81 
81      ../sysdeps/unix/syscall-template.S: No such file or directory. 
(gdb) b boost::python::objects::class_metatype # import 前にブレークポイント 
Function "boost::python::objects::class_metatype" not defined. 
Make breakpoint pending on future shared library load? (y or [n]) y 
Breakpoint 1 (boost::python::objects::class_metatype) pending. 
(gdb) c 
Continuing.

>>> import ems

Breakpoint 1, 0x00007ffff5845c40 in boost::python::objects::class_metatype()@plt () 
   from /usr/local/boost/current/lib/libboost_python.so.1.60.0 
(gdb) i b 
Num     Type           Disp Enb Address            What 
1       breakpoint     keep y   <MULTIPLE> 
        breakpoint already hit 1 time 
1.1                         y     0x00007ffff5845c40 <boost::python::objects::class_metatype()@plt> 
1.2                         y     0x00007ffff5856b00 in boost::python::objects::class_metatype() 
                                                   at libs/python/src/object/class.cpp:317 
(gdb) disable 1.1 # plt 上のブレークポイントは無効 
(gdb) c 
Continuing.

Breakpoint 1, boost::python::objects::class_metatype () at libs/python/src/object/class.cpp:317 
317           if (class_metatype_object.tp_dict == 0) 
(gdb)
```
 
もう一点。この方法だと、モジュールがロードされたときにシンボル名をもとにアドレスをに検索するので、対象が共有ライブラリの場合、関数の先頭のアドレス以外に、plt 上のアドレスにもブレークポイントが設定されます。これは邪魔なので無効にしておきます。

 
PLT とは Procedure Linkage Table の略で、Windows でいうところのインポート テーブルと似たようなものです。

 
Technovelty - PLT and GOT - the key to code sharing and dynamic libraries <br />
[https://www.technovelty.org/linux/plt-and-got-the-key-to-code-sharing-and-dynamic-libraries.html](https://www.technovelty.org/linux/plt-and-got-the-key-to-code-sharing-and-dynamic-libraries.html)

 
コールスタックを見ると、shared.cpp に実装された init_module_ems から、class_ クラスのコンストラクタ (#4) 経由で呼ばれています。テンプレートの入れ子で、シンボル名が複雑怪奇です。

 
```
(gdb) bt 10 
#0  boost::python::objects::class_metatype () at libs/python/src/object/class.cpp:317 
#1  0x00007ffff5856bb8 in boost::python::objects::class_type () 
    at libs/python/src/object/class.cpp:473 
#2  0x00007ffff5857d8d in boost::python::objects::(anonymous namespace)::new_class ( 
    doc=<optimized out>, types=0x7fffffffdd90, num_types=1, name=<optimized out>) 
    at libs/python/src/object/class.cpp:561 
#3  boost::python::objects::class_base::class_base (this=0x7fffffffdbf0, 
    name=0x7ffff5a89bd5 "Field", num_types=1, types=0x7fffffffdd90, doc=0x0) 
    at libs/python/src/object/class.cpp:591 
#4  0x00007ffff5a874be in boost::python::class_<Field, boost::python::detail::not_specified, boost::python::detail::not_specified, boost::python::detail::not_specified>::class_<boost::python::init<int, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_, mpl_::void_> > (i=..., 
    name=0x7ffff5a89bd5 "Field", this=0x7fffffffdbf0) 
    at /usr/local/boost/current/include/boost/python/class.hpp:206 
#5  init_module_ems () at shared.cpp:51 
#6  0x00007ffff58639f3 in boost::function0<void>::operator() (this=0x7fffffffde50) 
    at ./boost/function/function_template.hpp:771 
#7  boost::python::handle_exception_impl (f=...) at libs/python/src/errors.cpp:25 
#8  0x00007ffff5864736 in boost::python::handle_exception<void (*)()> ( 
    f=0x7ffff5a87440 <init_module_ems()>) at ./boost/python/errors.hpp:29 
#9  boost::python::detail::(anonymous namespace)::init_module_in_scope ( 
    init_function=<optimized out>, m=0x7ffff7e937c0) at libs/python/src/module.cpp:24 
(More stack frames follow...)
```
 
#3 の class_base のコンストラクタは以下のように定義されています。

 
```
src/object/class.cpp 
589   class_base::class_base( 
590       char const* name, std::size_t num_types, type_info const* const types, char const* doc) 
591       : object(new_class(name, num_types, types, doc)) 
592   { 
593       // Insert the new class object in the registry 
594       converter::registration& converters = const_cast<converter::registration&>( 
595           converter::registry::lookup(types[0])); 
596 
597       // Class object is leaked, for now 
598       converters.m_class_object = (PyTypeObject*)incref(this->ptr()); 
599   }
```
 
class_metatype() は初期化リストのなかで使われています。ここでの object とは、class_base の基底クラスの一つです。object クラスを new_class 関数の戻り値で初期化すると、m_ptr というメンバー関数が初期化されます。引数の types を元に lookup してきたコンバーターの m_class_object に、その m_ptr を代入する、というのがこのコンストラクターの動作です。

 
ブレークポイントを設定した class_metatype() は、new_class() から 2 回呼ばれます。line:561 の class_type() 経由と、line:575 です。戻り値に直接関係あるのは後者です。

 
```
src/object/class.cpp 
548     inline object 
549     new_class(char const* name, std::size_t num_types, type_info const* const types, char const*     doc) 
550     { 
551       assert(num_types >= 1); 
552 
553       // Build a tuple of the base Python type objects. If no bases 
554       // were declared, we'll use our class_type() as the single base 
555       // class. 
556       ssize_t const num_bases = (std::max)(num_types - 1, static_cast<std::size_t>(1)); 
557       handle<> bases(PyTuple_New(num_bases)); 
558 
559       for (ssize_t i = 1; i <= num_bases; ++i) 
560       { 
561           type_handle c = (i >= static_cast<ssize_t>(num_types)) ? class_type() : get_class(type    s[i]); 
562           // PyTuple_SET_ITEM steals this reference 
563           PyTuple_SET_ITEM(bases.get(), static_cast<ssize_t>(i - 1), upcast<PyObject>(c.release(    ))); 
564       } 
565 
566       // Call the class metatype to create a new class 
567       dict d; 
568 
569       object m = module_prefix(); 
570       if (m) d["__module__"] = m; 
571 
572       if (doc != 0) 
573           d["__doc__"] = doc; 
574 
575       object result = object(class_metatype())(name, bases, d); 
576       assert(PyType_IsSubtype(Py_TYPE(result.ptr()), &PyType_Type)); 
577 
578       if (scope().ptr() != Py_None) 
579           scope().attr(name) = result; 
580 
581       // For pickle. Will lead to informative error messages if pickling 
582       // is not enabled. 
583       result.attr("__reduce__") = object(make_instance_reduce_function()); 
584 
585       return result; 
586     } 
587   }
```
 
1 回目の呼び出しはスルーして、2 回目の呼び出しで止めます。

 
```
(gdb) b boost::python::objects::class_metatype 
Function "boost::python::objects::class_metatype" not defined. 
Make breakpoint pending on future shared library load? (y or [n]) y 
Breakpoint 1 (boost::python::objects::class_metatype) pending. 
(gdb) r 
Starting program: /usr/local/python/python-2.7.11/bin/python 
[Thread debugging using libthread_db enabled] 
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1". 
Python 2.7.11 (default, Dec 22 2015, 22:30:16) 
[GCC 5.2.1 20151010] on linux2 
Type "help", "copyright", "credits" or "license" for more information. 
>>> import ems

Breakpoint 1, 0x00007ffff5845c40 in boost::python::objects::class_metatype()@plt () 
   from /usr/local/boost/current/lib/libboost_python.so.1.60.0 
(gdb) i b 
Num     Type           Disp Enb Address            What 
1       breakpoint     keep y   <MULTIPLE> 
        breakpoint already hit 1 time 
1.1                         y     0x00007ffff5845c40 <boost::python::objects::class_metatype()@plt> 
1.2                         y     0x00007ffff5856b00 in boost::python::objects::class_metatype() 
                                                   at libs/python/src/object/class.cpp:317 
(gdb) disable 1.1 
(gdb) c 
Continuing.

Breakpoint 1, boost::python::objects::class_metatype () at libs/python/src/object/class.cpp:317 
317           if (class_metatype_object.tp_dict == 0) 
(gdb) bt 4 
#0  boost::python::objects::class_metatype () at libs/python/src/object/class.cpp:317 
#1  0x00007ffff5856bb8 in boost::python::objects::class_type () 
    at libs/python/src/object/class.cpp:473 
#2  0x00007ffff5857d8d in boost::python::objects::(anonymous namespace)::new_class ( 
    doc=<optimized out>, types=0x7fffffffdd90, num_types=1, name=<optimized out>) 
    at libs/python/src/object/class.cpp:561 
#3  boost::python::objects::class_base::class_base (this=0x7fffffffdbf0, 
    name=0x7ffff5a89bd5 "Field", num_types=1, types=0x7fffffffdd90, doc=0x0) 
    at libs/python/src/object/class.cpp:591 
(More stack frames follow...) 
(gdb) c 
Continuing.

Breakpoint 1, boost::python::objects::class_metatype () at libs/python/src/object/class.cpp:317 
317           if (class_metatype_object.tp_dict == 0) 
(gdb) bt 3 
#0  boost::python::objects::class_metatype () at libs/python/src/object/class.cpp:317 
#1  0x00007ffff5857f92 in boost::python::objects::(anonymous namespace)::new_class ( 
    doc=<optimized out>, types=0x7fffffffdd90, num_types=1, name=<optimized out>) 
    at libs/python/src/object/class.cpp:575 
#2  boost::python::objects::class_base::class_base (this=0x7fffffffdbf0, 
    name=0x7ffff5a89bd5 "Field", num_types=1, types=0x7fffffffdd90, doc=0x0) 
    at libs/python/src/object/class.cpp:591 
(More stack frames follow...) 
(gdb)
```
 
line:575 の "object(class_metatype())(name, bases, d);" で、object が関数なのかコンストラクタなのか理解に苦しむところです。後半の (name, bases, d) は operator() 呼び出しだと推測は出来ます。この行は最適化が有効だと全部インライン展開されるので、とりあえず class_metatype() から戻ってきたところでアセンブリを見ます。

 
```
(gdb) fin 
Run till exit from #0  boost::python::objects::class_metatype () 
    at libs/python/src/object/class.cpp:317 
boost::python::objects::(anonymous namespace)::new_class (doc=<optimized out>, 
    types=0x7fffffffdd90, num_types=1, name=<optimized out>) 
    at libs/python/src/object/class.cpp:575 
Value returned is $1 = {m_p = 0x7fffffffdaa0} 
(gdb) x/20i $rip 
=> 0x7ffff5857f92 <...+690>:   mov    0x60(%rsp),%rbx 
   0x7ffff5857f97 <...+695>:   test   %rbx,%rbx 
   0x7ffff5857f9a <...+698>:   je     0x7ffff5858582 <...+2210> 
   0x7ffff5857fa0 <...+704>:   addq   $0x1,(%rbx) 
   0x7ffff5857fa4 <...+708>:   test   %rbp,%rbp 
   0x7ffff5857fa7 <...+711>:   mov    0x40(%rsp),%r14 
   0x7ffff5857fac <...+716>:   mov    %rbp,%r13 
   0x7ffff5857faf <...+719>:   je     0x7ffff5858576 <...+2198> 
   0x7ffff5857fb5 <...+725>:   mov    0x18(%rsp),%rdi 
   0x7ffff5857fba <...+730>:   callq  0x7ffff5844d40 <_ZN5boost6python9converter19do_return_to_pythonEPKc@plt> 
   0x7ffff5857fbf <...+735>:   test   %rax,%rax 
   0x7ffff5857fc2 <...+738>:   mov    %rax,%r12 
   0x7ffff5857fc5 <...+741>:   je     0x7ffff58585bd <...+2269> 
   0x7ffff5857fcb <...+747>:   lea    0x1705a(%rip),%rsi        # 0x7ffff586f02c 
   0x7ffff5857fd2 <...+754>:   mov    %r14,%r8 
   0x7ffff5857fd5 <...+757>:   mov    %r13,%rcx 
   0x7ffff5857fd8 <...+760>:   mov    %r12,%rdx 
   0x7ffff5857fdb <...+763>:   mov    %rbx,%rdi 
   0x7ffff5857fde <...+766>:   xor    %eax,%eax 
   0x7ffff5857fe0 <...+768>:   callq  0x7ffff5845a30 <PyEval_CallFunction@plt> 
(gdb) 
```
 
PyEval_CallFunction という Python API の呼び出しが怪しいのでここで止めます。

 
```
(gdb) b PyEval_CallFunction 
Breakpoint 2 at 0x7ffff7b00fd0: file Python/modsupport.c, line 544. 
(gdb) c 
Continuing.

Breakpoint 2, PyEval_CallFunction ( 
    obj=obj@entry=0x7ffff5a7cc40 <boost::python::class_metatype_object>, 
    format=format@entry=0x7ffff586f02c "(OOO)") at Python/modsupport.c:544 
544     { 
(gdb) bt 5 
#0  PyEval_CallFunction (obj=obj@entry=0x7ffff5a7cc40 <boost::python::class_metatype_object>, 
    format=format@entry=0x7ffff586f02c "(OOO)") at Python/modsupport.c:544 
#1  0x00007ffff5857fe5 in boost::python::call<boost::python::api::object, char const*, boost::python::handle<_object>, boost::python::dict> (a2=..., a1=<synthetic pointer>, a0=<synthetic pointer>, 
    callable=0x7ffff5a7cc40 <boost::python::class_metatype_object>) at ./boost/python/call.hpp:66 
#2  boost::python::api::object_operators<boost::python::api::object>::operator()<char const*, boost::python::handle<_object>, boost::python::dict> (a2=..., a1=<synthetic pointer>, 
    a0=<synthetic pointer>, this=<optimized out>) at ./boost/python/object_call.hpp:19 
#3  boost::python::objects::(anonymous namespace)::new_class (doc=<optimized out>, 
    types=0x7fffffffdd90, num_types=<optimized out>, name=<optimized out>) 
    at libs/python/src/object/class.cpp:575 
#4  boost::python::objects::class_base::class_base (this=0x7fffffffdbf0, 
    name=0x7ffff5a89bd5 "Field", num_types=<optimized out>, types=0x7fffffffdd90, doc=0x0) 
    at libs/python/src/object/class.cpp:591 
(More stack frames follow...) 
(gdb) 
```
 
PyEval_CallFunction は、C/C++ から Python の関数を呼ぶための API です。第二引数の format が "(OOO)" になっているので、3 つのオブジェクトからなるタプルを引数として Python の関数を呼んでいます。何の関数を呼ぶのかは、第一引数を見れば分かります。

 
```
(gdb) p *obj->ob_type 
$4 = {ob_refcnt = 41, ob_type = 0x7ffff7daaf60 <PyType_Type>, ob_size = 0, 
  tp_name = 0x7ffff7b4008c "type", tp_basicsize = 872, tp_itemsize = 40, 
  tp_dealloc = 0x7ffff7a8b1f0 <type_dealloc>, tp_print = 0x0, tp_getattr = 0x0, tp_setattr = 0x0, 
  tp_compare = 0x0, tp_repr = 0x7ffff7a8f600 <type_repr>, tp_as_number = 0x0, 
  tp_as_sequence = 0x0, tp_as_mapping = 0x0, tp_hash = 0x7ffff7a70be0 <_Py_HashPointer>, 
  tp_call = 0x7ffff7a908a0 <type_call>, tp_str = 0x7ffff7a8acc0 <object_str>, 
  tp_getattro = 0x7ffff7a9a2c0 <type_getattro>, tp_setattro = 0x7ffff7a91930 <type_setattro>, 
  tp_as_buffer = 0x0, tp_flags = 2148423147, 
  tp_doc = 0x7ffff7da8f80 <type_doc> "type(object) -> the object's type\ntype(name, bases, dict) -> a new type", tp_traverse = 0x7ffff7a8c2c0 <type_traverse>, tp_clear = 0x7ffff7a90370 <type_clear>, 
  tp_richcompare = 0x7ffff7a8bac0 <type_richcompare>, tp_weaklistoffset = 368, tp_iter = 0x0, 
  tp_iternext = 0x0, tp_methods = 0x7ffff7da9200 <type_methods>, 
  tp_members = 0x7ffff7da9500 <type_members>, tp_getset = 0x7ffff7da93e0 <type_getsets>, 
  tp_base = 0x7ffff7daadc0 <PyBaseObject_Type>, tp_dict = 0x7ffff7f98280, tp_descr_get = 0x0, 
  tp_descr_set = 0x0, tp_dictoffset = 264, tp_init = 0x7ffff7a8d3b0 <type_init>, 
  tp_alloc = 0x7ffff7a8ade0 <PyType_GenericAlloc>, tp_new = 0x7ffff7a98200 <type_new>, 
  tp_free = 0x7ffff7b1e2b0 <PyObject_GC_Del>, tp_is_gc = 0x7ffff7a8aca0 <type_is_gc>, 
  tp_bases = 0x7ffff7f9b090, tp_mro = 0x7ffff7f9a878, tp_cache = 0x0, 
  tp_subclasses = 0x7ffff7f4ce60, tp_weaklist = 0x7ffff7f9e050, tp_del = 0x0, tp_version_tag = 11}
```
 
名前と doc から、これは Python の組み込み関数 type() であることが分かります。どうやら Boost.Python は、Python の組み込み関数を使って型を作っているようです。テンプレートでこんなことができるとか Boost 凄すぎ・・。

 
Python のコードの中に、新しい型オブジェクトを作る関数があるはずなので、それを適当なキーワード (Py_TPFLAGS_HAVE_GC とか) を使って探すと、type_new というそれっぽい関数が Objects/typeobject.c に見つかるので、ここで止めます。

 
```
(gdb) i b 
Num     Type           Disp Enb Address            What 
1       breakpoint     keep y   <MULTIPLE> 
        breakpoint already hit 3 times 
1.1                         n     0x00007ffff5845c40 <boost::python::objects::class_metatype()@plt> 
1.2                         y     0x00007ffff5856b00 in boost::python::objects::class_metatype() 
                                                   at libs/python/src/object/class.cpp:317 
2       breakpoint     keep y   0x00007ffff7b00fd0 in PyEval_CallFunction 
                                                   at Python/modsupport.c:544 
        breakpoint already hit 1 time 
(gdb) disable 
(gdb) b type_new 
Breakpoint 3 at 0x7ffff7a98200: file Objects/typeobject.c, line 2068. 
(gdb) c 
Continuing.

Breakpoint 3, type_new (metatype=0x7ffff5a7cc40 <boost::python::class_metatype_object>, 
    args=0x7ffff7e8e370, kwds=0x0) at Objects/typeobject.c:2068 
2068    { 
(gdb) bt 8 
#0  type_new (metatype=0x7ffff5a7cc40 <boost::python::class_metatype_object>, args=0x7ffff7e8e370, 
    kwds=0x0) at Objects/typeobject.c:2068 
#1  0x00007ffff7a908c3 in type_call (type=0x7ffff5a7cc40 <boost::python::class_metatype_object>, 
    args=0x7ffff7e8e370, kwds=0x0) at Objects/typeobject.c:729 
#2  0x00007ffff7a244e3 in PyObject_Call ( 
    func=func@entry=0x7ffff5a7cc40 <boost::python::class_metatype_object>, 
    arg=arg@entry=0x7ffff7e8e370, kw=<optimized out>) at Objects/abstract.c:2546 
#3  0x00007ffff7ad6707 in PyEval_CallObjectWithKeywords ( 
    func=func@entry=0x7ffff5a7cc40 <boost::python::class_metatype_object>, 
    arg=arg@entry=0x7ffff7e8e370, kw=kw@entry=0x0) at Python/ceval.c:4219 
#4  0x00007ffff7b01087 in PyEval_CallFunction ( 
    obj=obj@entry=0x7ffff5a7cc40 <boost::python::class_metatype_object>, 
    format=format@entry=0x7ffff586f02c "(OOO)") at Python/modsupport.c:557 
#5  0x00007ffff5857fe5 in boost::python::call<boost::python::api::object, char const*, boost::python::handle<_object>, boost::python::dict> (a2=..., a1=<synthetic pointer>, a0=<synthetic pointer>, 
    callable=0x7ffff5a7cc40 <boost::python::class_metatype_object>) at ./boost/python/call.hpp:66 
#6  boost::python::api::object_operators<boost::python::api::object>::operator()<char const*, boost::python::handle<_object>, boost::python::dict> (a2=..., a1=<synthetic pointer>, 
    a0=<synthetic pointer>, this=<optimized out>) at ./boost/python/object_call.hpp:19 
#7  boost::python::objects::(anonymous namespace)::new_class (doc=<optimized out>, 
    types=0x7fffffffdd90, num_types=<optimized out>, name=<optimized out>) 
    at libs/python/src/object/class.cpp:575 
(More stack frames follow...)
```
 
ここまで来れば、答えは見えました。この関数の中で PyTypeObject を作って返すのですが、tp_flags をセットするときに Py_TPFLAGS_DEFAULT を使っています。したがって、新しい型は必ず Py_TPFLAGS_HAVE_ITER フラグを持っています。というかわざわざデバッグしなくても、Python のドキュメントのどこかに書いてありそう。

 
```
2066 static PyObject * 
2067 type_new(PyTypeObject *metatype, PyObject *args, PyObject *kwds) 
2068 { 
2069     PyObject *name, *bases, *dict; 
2070     static char *kwlist[] = {"name", "bases", "dict", 0}; 
... 
2326     /* Initialize tp_flags */ 
2327     type->tp_flags = Py_TPFLAGS_DEFAULT | Py_TPFLAGS_HEAPTYPE | 
2328         Py_TPFLAGS_BASETYPE; 
2329     if (base->tp_flags & Py_TPFLAGS_HAVE_GC) 
2330         type->tp_flags |= Py_TPFLAGS_HAVE_GC; 
2331     if (base->tp_flags & Py_TPFLAGS_HAVE_NEWBUFFER) 
2332         type->tp_flags |= Py_TPFLAGS_HAVE_NEWBUFFER; 
... 
```
 
### 4. PyTypeObject::tp_flags を動的に変更する方法

 
Boost.Python や Python の実装を見ても、tp_flags を変更する API は用意されていないようです。しかし boost::python::objects::class_base::class_base の実装から分かるように、各型のひな形となるような TypeObject は、 boost::python::converter::registry::lookup で取ってきたコンバーターの m_class_object から取得できそうです。そこで、以下のようなコードを試してみます。

 
```
#include <boost/python.hpp> 
#include <valarray> 
#include <random> 
#include <stdio.h>

std::default_random_engine generator; 
std::uniform_real_distribution<double> distribution(0.0, 1.0);

void ChangeType();

typedef std::valarray<double> darray;

class Field { 
private: 
    darray _data;

public: 
    Field(int n) : _data(n) { 
        printf("Field::Field(): %p\n", this); 
        ChangeType(); 
    } 
    ~Field() { 
        printf("Field::~Field() %p\n", this); 
    }

    void Dump() const { 
        printf("["); 
        for (auto &d : _data) { 
            printf("% 3.3f", d); 
        } 
        printf(" ]\n"); 
    }

    void Churn() { 
        for (auto &d : _data) { 
            d = distribution(generator); 
        } 
    }

    const darray &Positions() const { 
        return _data; 
    } 
};

using namespace boost::python;

BOOST_PYTHON_MODULE(ems) { 
    class_<Field>("Field", init<int>()) 
        .def("Positions", &Field::Positions, 
             return_internal_reference<>()) 
        .def("Dump", &Field::Dump) 
        .def("Churn", &Field::Churn) 
        ;

    class_<darray>("darray") 
        .def("__getitem__", 
             (const double &(darray::*)(size_t) const)&darray::operator[], 
             return_value_policy<copy_const_reference>()) 
        .def("__len__", &darray::size) 
        ; 
}

void ChangeType() { 
    converter::registration const& converters = 
        converter::registry::lookup(type_id<darray>()); 
    long l = converters.m_class_object->tp_flags; 
    converters.m_class_object->tp_flags = l & ~Py_TPFLAGS_HAVE_ITER; 
    printf("converters.m_class_object = %p\n", converters.m_class_object); 
    printf("tp_flags: %08lx -> %08lx\n", l, converters.m_class_object->tp_flags); 
}
```
 
ChangeType() という関数を作って、Field のコンストラクターから呼ぶコードを追加しました。これを Python から実行して、darray の tp_flags を確認します。

 
```
john@ubuntu1510:~/Documents/pyc$ gdb /usr/local/python/current/bin/python 
GNU gdb (Ubuntu 7.10-1ubuntu2) 7.10 
(略) 
Reading symbols from /usr/local/python/current/bin/python...done. 
(gdb) r 
Starting program: /usr/local/python/python-2.7.11/bin/python 
[Thread debugging using libthread_db enabled] 
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1". 
Python 2.7.11 (default, Dec 22 2015, 22:30:16) 
[GCC 5.2.1 20151010] on linux2 
Type "help", "copyright", "credits" or "license" for more information. 
>>> import ems 
>>> f = ems.Field(4) 
Field::Field(): 0x6d09d0 
converters.m_class_object = 0x6d3b00 
tp_flags: 000257fb -> 0002577b 
>>> x = f.Positions() 
>>> x 
<ems.darray object at 0x7ffff7ed5600> 
>>> 
Program received signal SIGINT, Interrupt. 
0x00007ffff74e4723 in __select_nocancel () at ../sysdeps/unix/syscall-template.S:81 
81      ../sysdeps/unix/syscall-template.S: No such file or directory. 
(gdb) p *(PyObject*)0x7ffff7ed5600 
$1 = {ob_refcnt = 2, ob_type = 0x6d3b00} 
(gdb) p *$1.ob_type 
$2 = {ob_refcnt = 5, ob_type = 0x7ffff5a7cc40 <boost::python::class_metatype_object>, ob_size = 0, 
  tp_name = 0x7ffff7e94954 "darray", tp_basicsize = 48, tp_itemsize = 1, 
  tp_dealloc = 0x7ffff7a8b390 <subtype_dealloc>, tp_print = 0x0, tp_getattr = 0x0, 
  tp_setattr = 0x0, tp_compare = 0x0, tp_repr = 0x7ffff7a8f390 <object_repr>, 
  tp_as_number = 0x6d3c88, tp_as_sequence = 0x6d3dd8, tp_as_mapping = 0x6d3dc0, 
  tp_hash = 0x7ffff7a70be0 <_Py_HashPointer>, tp_call = 0x0, tp_str = 0x7ffff7a8acc0 <object_str>, 
  tp_getattro = 0x7ffff7a72410 <PyObject_GenericGetAttr>, 
  tp_setattro = 0x7ffff7a72670 <PyObject_GenericSetAttr>, tp_as_buffer = 0x6d3e28, 
  tp_flags = 153467, tp_doc = 0x0, tp_traverse = 0x7ffff7a8b0a0 <subtype_traverse>, 
  tp_clear = 0x7ffff7a8d290 <subtype_clear>, tp_richcompare = 0x0, tp_weaklistoffset = 32, 
  tp_iter = 0x0, tp_iternext = 0x7ffff7a72100 <_PyObject_NextNotImplemented>, tp_methods = 0x0, 
  tp_members = 0x6d3e68, tp_getset = 0x0, 
  tp_base = 0x7ffff5a7cfa0 <boost::python::objects::class_type_object>, tp_dict = 0x7ffff7e98050, 
  tp_descr_get = 0x0, tp_descr_set = 0x0, tp_dictoffset = 24, 
  tp_init = 0x7ffff7a91f70 <slot_tp_init>, tp_alloc = 0x7ffff7a8ade0 <PyType_GenericAlloc>, 
  tp_new = 0x7ffff5856890 
     <boost::python::objects::instance_new(PyTypeObject*, PyObject*, PyObject*)>, 
  tp_free = 0x7ffff7b1e2b0 <PyObject_GC_Del>, tp_is_gc = 0x0, tp_bases = 0x7ffff7e96410, 
  tp_mro = 0x7ffff7e8e780, tp_cache = 0x0, tp_subclasses = 0x0, tp_weaklist = 0x7ffff7e77f70, 
  tp_del = 0x0, tp_version_tag = 0} 
(gdb) p/x 153467 
$3 = 0x2577b
```
 
思惑通り、tp_flags から Py_TPFLAGS_HAVE_ITER を消せました。今回は tp_flags を変えても全く意味がなかったのですが、これで TypeObject の内容は思いのままです。Boost.Python では、初期化時に int など基本型の TypeObject も列挙しているので、基本型の中身を変更する禁じ手も可能です。そんなことをしたらいろいろ壊れそうですが。

