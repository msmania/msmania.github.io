---
layout: post
title: "How to expose a valarray with Boost.Python"
date: 2015-12-22 16:00:58.000 -08:00
categories:
- C/C++
- Debug
- Linux
- Python
tags:
- python
- valarray
---

Python のパフォーマンスの不利を補うため、C++ で書いた共有ライブラリを Python のモジュールとして利用することができます。前回の速度比較の結果から、ベクトルの四則演算を std::valarray の形のまま実行すべく C++ のコードを書いたところ、思わぬ結果として Python の罠を見つけたので経緯を含めて紹介します。

  
### 1. Boost.Python を使う

 
まず、C++ で Python モジュールを書く方法ですが、伝統的な Python.h をインクルードして C で書く方法と、Boost.Python のテンプレートを使って C++ で書く方法の 2 通りがあります。Boost の方が圧倒的に楽です。以下のサイトの説明がとても分かりやすい。

 
c/c++をラップしてpythonで使えるように - Python | Welcome to underground <br />
[https://www.quark.kj.yamagata-u.ac.jp/~hiroki/python/?id=19](https://www.quark.kj.yamagata-u.ac.jp/~hiroki/python/?id=19)

 
Boost.Python の機能をざっと紹介してみる - muddy brown thang <br />
[http://d.hatena.ne.jp/moriyoshi/20091214/1260779899](http://d.hatena.ne.jp/moriyoshi/20091214/1260779899)

 
その他、ctypes モジュールを使って外部モジュールのエクスポート関数を呼び出す方法 (Windows で言うところの LoadLibrary と GetProcAddress を Python から呼べる) もありますが、これは関数が呼べるだけで、Python のモジュールやオブジェクトを作れるわけではないので、少し趣向が異なります。もし ctypes で間に合うなら一番楽な方法だと思います。

 
今実現したいのは、次のような動作を実装した C++ クラスを Python モジュールとして見せることです。

 
1. std::valarray&lt;double&gt; を内部データとして保持 
1. 演算は valarray のまま実行する 
1. プロット描画のため、valarray を何らかの形で matplotlib.collections.PathCollection.set_offsets(offsets) に渡したい 

 
3. についてですが、matplotlib のリファレンスを見ると、set_offsets の引数は "offsets can be a scalar or a sequence." という妙に曖昧な説明しかありません。

 
collections — Matplotlib 1.5.0 documentation <br />
[http://matplotlib.org/api/collections_api.html#matplotlib.collections.PathCollection](http://matplotlib.org/api/collections_api.html#matplotlib.collections.PathCollection)

 
GitHub 上のコードを見ると、引数の offsets はすぐに np.asanyarray によって np.ndarray に変換されて 2 列の行列に変形させられるので、ndarray に変換可能なオブジェクトなら何でもよい、ということになります。

 
[https://github.com/matplotlib/matplotlib/blob/master/lib/matplotlib/collections.py](https://github.com/matplotlib/matplotlib/blob/master/lib/matplotlib/collections.py)

 
C++ 側で列数が 2 の numpy.ndarray オブジェクトを作ることができれば速度的にはベストですが、面倒そうなのと、C++ のモジュールが Numpy に依存するのもあまり美しくないので、Python のリストを返すことができれば十分です。そこで、上記のサイトを参考にしつつ動作確認のため以下の C++ コードを書きました。

 
実行環境は前回と同じです。

 
- OS: Ubuntu 15.10 
- gcc (Ubuntu 5.2.1-22ubuntu2) 5.2.1 20151010 
- Python 2.7.10 

 
C++ ソースコード: shared.cpp 

 
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

BOOST_PYTHON_MODULE(ems) { 
    using namespace boost::python;

    class_<Field>("Field", init<int>()) 
        .def("Positions", &Field::Positions, 
             return_value_policy<copy_const_reference>()) 
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
```
 
メイク ファイル: Makefile

 
```
CC=g++ 
RM=rm -f

TARGET=ems.so 
SRCS=$(wildcard *.cpp) 
OBJS=$(SRCS:.cpp=.o)

override CFLAGS+=-Wall -fPIC -std=c++11 -O2 -g 
LFLAGS=

INCLUDES=-I/usr/include/python2.7 
LIBS=-lpython2.7 -lboost_python

all: clean $(TARGET)

clean: 
        $(RM) $(OBJS) $(TARGET)

$(TARGET): $(OBJS) 
        $(CC) -shared $(LFLAGS) $(LIBDIRS) $^ -o $@ $(LIBS)

$(OBJS): $(SRCS) 
        $(CC) $(INCLUDES) $(CFLAGS) -c $^
```
 
Field クラスを Python オブジェクトとして扱えるようにします。このとき、valarray の const 参照を返すメンバ関数の Field::Positions を Python オブジェクトのメソッドとして実装するため、valarray のコンバーターを別途作って \__getitem__ と \__len__ メソッドを実装します。これは一種のダック タイピングで、Python 側ではシーケンスとして見えるようになります。

 
Field::Positions は Field::_data の参照を返すようにしておかないと、Positions を呼ぶたびに valarray をコピーして Python に渡すようになるので、速度が落ちます。しかし、実は上記のコードは間違っています。試しにこのまま Python から使ってみると以下の結果が得られます。

 
```
>>> import ems 
>>> f = ems.Field(4) 
Field::Field(): 0x2011a50 
>>> x = f.Positions() 
>>> f.Dump() 
[ 0.000 0.000 0.000 0.000 ] 
>>> x[0] 
0.0 
>>> f.Churn() 
>>> f.Dump() 
[ 0.132 0.459 0.219 0.679 ] 
>>> x[0] 
0.0 
>>> quit() 
Field::~Field() 0x2011a50 
john@ubuntu1510:~/Documents/pyc$
```
 
f.Churn() で C++ 側の値を変更した後も、Python 側のシーケンスの値が 0 のままで変わっていません。x = f.Position() したときに、valarray がコピーされたようです。Positions を定義するときの return_value_policy で copy_const_reference ポリシーを使っているのがいけないのです。

 
```
    class_<Field>("Field", init<int>()) 
        .def("Positions", &Field::Positions, 
             return_value_policy<copy_const_reference>())
```
 
 <br />
以下のページに記載があるように、このポリシーは "returning a reference-to-const type such that the referenced value is copied into a new Python object." です。ポリシーの名前で勘違いしていましたが、これは、参照をコピーして Python に渡すのではなく、"参照された値" をコピーします。Positions の戻り値となる Python オブジェクトを作るときに、参照に対してコピー コンストラクタを呼んで、そのコピーをオブジェクトに保持させるのだと思います。これでは参照を使う意味がありません。

 
Boost.Python - &lt;boost/python/copy_const_reference.hpp&gt; - 1.54.0 <br />
[http://www.boost.org/doc/libs/1_54_0/libs/python/doc/v2/copy_const_reference.html](http://www.boost.org/doc/libs/1_54_0/libs/python/doc/v2/copy_const_reference.html)

 
ここで使うべきポリシーは、return_internal_reference です。説明によると "CallPolicies which allow pointers and references to objects held internally by a free or member function argument or from the target of a member function to be returned safely without making a copy of the referent" となっています。

 
Boost.Python - &lt;boost/python/return_internal_reference.hpp&gt; - 1.54.0 <br />
[http://www.boost.org/doc/libs/1_54_0/libs/python/doc/v2/return_internal_reference.html](http://www.boost.org/doc/libs/1_54_0/libs/python/doc/v2/return_internal_reference.html)

 
コードをこう変えます。

 
```
class_<Field>("Field", init<int>()) 
    .def("Positions", &Field::Positions, 
         return_internal_reference<>()) 
```
 
これで、C++ オブジェクトへの参照を Python が保持できるようになりました。

 
```
>>> import ems 
>>> f = ems.Field(4) 
Field::Field(): 0xde4a50 
>>> f.Dump() 
[ 0.000 0.000 0.000 0.000 ] 
>>> x = f.Positions() 
>>> x[0] 
0.0 
>>> f.Churn() 
>>> f.Dump() 
[ 0.132 0.459 0.219 0.679 ] 
>>> x[0] 
0.13153778773876065 
>>> x 
<ems.darray object at 0x7fded8919130> 
>>> y = f.Positions() 
>>> y 
<ems.darray object at 0x7fded89193d0> 
>>> y[0] 
0.13153778773876065 
>>> quit() 
Field::~Field() 0xde4a50
```
 
上記の例で、f.Positions() の戻り値である ems.darray オブジェクトの x と y を単純に表示させた値が異なっています。これも最初勘違いしていましたが、Positions() を呼ぶたびに、ems.darray という Python オブジェクトは常に新しく作られます。それぞれの ems.darray が同じ valarray への参照を内包する構造になっています。

  
### 2. Python のハングと原因

 
ここから本題です。先ほど作った ems.Field を matplotlib の set_offsets に渡すとハングすることが分かりました。上で既に触れたとおり、set_offsets は引数を ndarray に変換しているだけなので、以下のコードで簡単に再現できます。

 
```
>>> import ems 
>>> import numpy as np 
>>> np.__version__ 
'1.10.1' 
>>> f = ems.Field(4) 
Field::Field(): 0x16f90b0 
>>> x = f.Positinos() 
Traceback (most recent call last): 
  File "<stdin>", line 1, in <module> 
AttributeError: 'Field' object has no attribute 'Positinos' 
>>> x = f.Positions() 
>>> x[0] 
0.0 
>>> len(x) 
4 
>>> a = np.array(x) # ここでハング
```
 
\__getitem__ と \__len__ だけだとリストに見せかけるのは無理なのかと諦めかけていたのですが、偶然、Numpy 1.8 だと問題なく動くことが分かりました。

 
```
>>> import ems 
>>> import numpy as np 
>>> np.__version__ 
'1.8.2' 
>>> f = ems.Field(4) 
Field::Field(): 0x233acf0 
>>> x = f.Positions() 
>>> a = np.array(x) 
>>> x[0] 
0.0 
>>> a 
array([ 0.,  0.,  0.,  0.])
```
 
Numpy 側のコードを比べると、1.8.x から 1.9.x にバージョンが上がった時に、PyArray_DTypeFromObjectHelper() のロジックが少し変更されています。520 行目あたりで青字の部分が追加されており、ハングは PySequence_Fast から制御が返ってこないことで発生しています。

 
[https://github.com/numpy/numpy/blob/maintenance/1.8.x/numpy/core/src/multiarray/common.c](https://github.com/numpy/numpy/blob/maintenance/1.8.x/numpy/core/src/multiarray/common.c) <br />
[https://github.com/numpy/numpy/blob/maintenance/1.9.x/numpy/core/src/multiarray/common.c](https://github.com/numpy/numpy/blob/maintenance/1.9.x/numpy/core/src/multiarray/common.c)

 
```
/* 
* fails if convertable to list but no len is defined which some libraries 
* require to get object arrays 
*/ 
size = PySequence_Size(obj); 
if (size < 0) { 
    goto fail; 
}

/* Recursive case, first check the sequence contains only one type */ 
seq = PySequence_Fast(obj, "Could not convert object to sequence"); 
if (seq == NULL) { 
    goto fail; 
} 
objects = PySequence_Fast_ITEMS(seq); 
common_type = size > 0 ? Py_TYPE(objects[0]) : NULL; 
for (i = 1; i < size; ++i) { 
    if (Py_TYPE(objects[i]) != common_type) { 
        common_type = NULL; 
        break; 
    } 
} 
```
 
結論から先に書くと、ems.darray の \__getitem__ を実装するときに、valarray::operator&#x5b;&#x5d; を渡しているのが諸悪の根源でした。

 
```
    class_<darray>("darray") 
        .def("__getitem__", 
             (const double &(darray::*)(size_t) const)&darray::operator[], 
             return_value_policy<copy_const_reference>())
```
 
ネット上でよく出てくるのは、valarray ではなく vector を Python に渡す方法ですが、この場合の \__getitem__ は、operator&#x5b;&#x5d; ではなく vector::at を使うものばかりです。恥ずかしながら知らなかったのですが、vector::at と vector::operator&#x5b;&#x5d; には大きな違いがありました。vector::at は配列の長さを超えた場合に out_of_range 例外を投げてくれますが、operator&#x5b;&#x5d; は何もチェックせずに配列のインデックス アクセスを淡々とこなします。

 
vector::at - C++ Reference <br />
[http://www.cplusplus.com/reference/vector/vector/at/](http://www.cplusplus.com/reference/vector/vector/at/)

 
<em>The function automatically checks whether n is within the bounds of valid elements in the vector, throwing an out_of_range exception if it is not (i.e., if n is greater or equal than its size). This is in contrast with member operator[], that does not check against bounds.</em>

 
Python 側に作られた ems.Field は iteratable なオブジェクトとして作られ、Python の iterator オブジェクト (seqiterobject 構造体) によって iterate されます。この動作は Objects/iterobject.c にある iter_iternext という関数で行われますが、iterate の終了条件は、戻り値が NULL を返すかどうかです。オブジェクトのサイズはチェックしません。

 
```
45 static PyObject * 
46 iter_iternext(PyObject *iterator) 
47 { 
48     seqiterobject *it; 
49     PyObject *seq; 
50     PyObject *result; 
51 
52     assert(PySeqIter_Check(iterator)); 
53     it = (seqiterobject *)iterator; 
54     seq = it->it_seq; 
55     if (seq == NULL) 
56         return NULL; 
57     if (it->it_index == LONG_MAX) { 
58         PyErr_SetString(PyExc_OverflowError, 
59                         "iter index too large"); 
60         return NULL; 
61     } 
62 
63     result = PySequence_GetItem(seq, it->it_index); // getitem を呼ぶ箇所 
64     if (result != NULL) { 
65         it->it_index++; 
66         return result; 
67     } 
68     if (PyErr_ExceptionMatches(PyExc_IndexError) || 
69         PyErr_ExceptionMatches(PyExc_StopIteration)) 
70     { 
71         PyErr_Clear(); 
72         Py_DECREF(seq); 
73         it->it_seq = NULL; 
74     } 
75     return NULL; 
76 }
```
 
Numpy 1.9.x 以上でハングが起こる原因は、Objects/listobject.c にある listextend で無限ループが発生するからです。iter_iternext がどんなインデックスに対しても値を返してくるので、このループが終わりません。

 
```
870     /* Run iterator to exhaustion. */ 
871     for (;;) { 
872         PyObject *item = iternext(it); 
873         if (item == NULL) { 
874             if (PyErr_Occurred()) { 
875                 if (PyErr_ExceptionMatches(PyExc_StopIteration)) 
876                     PyErr_Clear(); 
877                 else 
878                     goto error; 
879             } 
880             break; 
881         } 
882         if (Py_SIZE(self) < self->allocated) { 
883             /* steals ref */ 
884             PyList_SET_ITEM(self, Py_SIZE(self), item); 
885             ++Py_SIZE(self); 
886         } 
887         else { 
888             int status = app1(self, item); 
889             Py_DECREF(item);  /* append creates a new ref */ 
890             if (status < 0) 
891                 goto error; 
892         } 
893     }
```
 
他の人の役に立つか不明ですが、一応コールスタックなどの情報を含むデバッグ ログを載せておきます。

 
```
(gdb) r 
Starting program: /usr/local/python/python-2.7.11/bin/python 
[Thread debugging using libthread_db enabled] 
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1". 
Python 2.7.11 (default, Dec 21 2015, 12:40:02) 
[GCC 5.2.1 20151010] on linux2 
Type "help", "copyright", "credits" or "license" for more information.

>>> import numpy as np 
>>> import ems 
>>> f = ems.Field(1) 
Field::Field(): 0xaa0060 
>>> x = f.Positions() 
>>> f.Churn() 
>>>

Program received signal SIGINT, Interrupt. 
0x00007ffff71df723 in __select_nocancel () at ../sysdeps/unix/syscall-template.S:81 
81      ../sysdeps/unix/syscall-template.S: No such file or directory. 
(gdb) b slot_sq_item 
Breakpoint 1 at 0x4816d0: file Objects/typeobject.c, line 4987. 
(gdb) c 
Continuing.

>>> a = np.array(x)

Breakpoint 1, slot_sq_item (self=0x7ffff1a92670, i=0) at Objects/typeobject.c:4987 
4987    { 
(gdb) p i 
$1 = 0 
(gdb) c 
Continuing. 
Breakpoint 1, slot_sq_item (self=0x7ffff1a92670, i=1) at Objects/typeobject.c:4987 
4987    { 
(gdb) p i 
$2 = 1 <<<< この時点で既に out-of-range 
(gdb) c 
Continuing. 
Breakpoint 1, slot_sq_item (self=0x7ffff1a92670, i=2) at Objects/typeobject.c:4987 
4987    { 
(gdb) p i 
$3 = 2

(gdb) bt 
#0  slot_sq_item (self=0x7ffff1a92670, i=2) at Objects/typeobject.c:4987 
#1  0x0000000000444e5d in iter_iternext (iterator=0x7ffff7e96910) at Objects/iterobject.c:63 
#2  0x0000000000448e9a in listextend (self=self@entry=0x7ffff1ab4cb0, b=b@entry=0x7ffff7e96910) 
    at Objects/listobject.c:872 
#3  0x000000000044aeb5 in _PyList_Extend (self=self@entry=0x7ffff1ab4cb0, b=b@entry=0x7ffff7e96910) 
    at Objects/listobject.c:910 
#4  0x000000000042243c in PySequence_List (v=0x7ffff7e96910) at Objects/abstract.c:2264 
#5  PySequence_Fast (v=v@entry=0x7ffff1a92670, m=m@entry=0x7ffff5c299e8 "Could not convert object to sequence") 
    at Objects/abstract.c:2293 
#6  0x00007ffff5b5473c in PyArray_DTypeFromObjectHelper (obj=obj@entry=0x7ffff1a92670, maxdims=maxdims@entry=32, 
    out_dtype=out_dtype@entry=0x7fffffffdea8, string_type=string_type@entry=0) 
    at numpy/core/src/multiarray/common.c:531 
#7  0x00007ffff5b549c3 in PyArray_DTypeFromObject (obj=obj@entry=0x7ffff1a92670, maxdims=maxdims@entry=32, 
    out_dtype=out_dtype@entry=0x7fffffffdea8) at numpy/core/src/multiarray/common.c:184 
#8  0x00007ffff5b5de81 in PyArray_GetArrayParamsFromObject (op=0x7ffff1a92670, requested_dtype=<optimized out>, 
    writeable=<optimized out>, out_dtype=0x7fffffffdea8, out_ndim=0x7fffffffde9c, out_dims=0x7fffffffdeb0, 
    out_arr=0x7fffffffdea0, context=0x0) at numpy/core/src/multiarray/ctors.c:1542 
#9  0x00007ffff5b5e26d in PyArray_FromAny (op=op@entry=0x7ffff1a92670, newtype=0x0, min_depth=0, max_depth=0, 
    flags=flags@entry=112, context=<optimized out>) at numpy/core/src/multiarray/ctors.c:1674 
#10 0x00007ffff5b5e63f in PyArray_CheckFromAny (op=0x7ffff1a92670, descr=<optimized out>, min_depth=min_depth@entry=0, 
    max_depth=max_depth@entry=0, requires=112, context=context@entry=0x0) at numpy/core/src/multiarray/ctors.c:1852 
#11 0x00007ffff5bd850e in _array_fromobject (__NPY_UNUSED_TAGGEDignored=<optimized out>, args=<optimized out>, kws=0x0) 
    at numpy/core/src/multiarray/multiarraymodule.c:1773 
#12 0x00000000004b6f2a in call_function (oparg=<optimized out>, pp_stack=0x7fffffffe110) at Python/ceval.c:4350 
#13 PyEval_EvalFrameEx (f=f@entry=0x7ffff7fc0c20, throwflag=throwflag@entry=0) at Python/ceval.c:2987 
#14 0x00000000004b938c in PyEval_EvalCodeEx (co=co@entry=0x7ffff7ecfe30, globals=globals@entry=0x7ffff7f6c168, 
    locals=locals@entry=0x7ffff7f6c168, args=args@entry=0x0, argcount=argcount@entry=0, kws=kws@entry=0x0, kwcount=0, 
    defs=0x0, defcount=0, closure=0x0) at Python/ceval.c:3582 
#15 0x00000000004b9499 in PyEval_EvalCode (co=co@entry=0x7ffff7ecfe30, globals=globals@entry=0x7ffff7f6c168, 
    locals=locals@entry=0x7ffff7f6c168) at Python/ceval.c:669 
#16 0x00000000004e2b4d in run_mod (arena=0x856e10, flags=<optimized out>, locals=0x7ffff7f6c168, 
    globals=0x7ffff7f6c168, filename=0x546f03 "<stdin>", mod=0x8a1c48) at Python/pythonrun.c:1370 
#17 PyRun_InteractiveOneFlags (fp=0x7ffff74a6980 <_IO_2_1_stdin_>, filename=0x546f03 "<stdin>", flags=<optimized out>) 
    at Python/pythonrun.c:857 
#18 0x00000000004e2dfe in PyRun_InteractiveLoopFlags (fp=fp@entry=0x7ffff74a6980 <_IO_2_1_stdin_>, 
    filename=filename@entry=0x546f03 "<stdin>", flags=flags@entry=0x7fffffffe3a0) at Python/pythonrun.c:777 
#19 0x00000000004e3366 in PyRun_AnyFileExFlags (fp=0x7ffff74a6980 <_IO_2_1_stdin_>, filename=<optimized out>, 
    closeit=0, flags=0x7fffffffe3a0) at Python/pythonrun.c:746 
#20 0x0000000000416160 in Py_Main (argc=<optimized out>, argv=<optimized out>) at Modules/main.c:640 
#21 0x00007ffff7102a40 in __libc_start_main (main=0x415290 <main>, argc=1, argv=0x7fffffffe568, init=<optimized out>, 
    fini=<optimized out>, rtld_fini=<optimized out>, stack_end=0x7fffffffe558) at libc-start.c:289 
#22 0x00000000004152c9 in _start ()
```
 
### 4. 回避策

 
valarray には at 関数がなく、境界チェックをしない operator&#x5b;&#x5d; があるのみです。したがって回避策として、valarray をラップする darray クラスを C++ 側で作って、at を追加実装しました。記憶が曖昧ですが、boost を使えば .NET のようにクラスを拡張できたような気がしますが、今回はこれで。

 
```
#include <boost/python.hpp> 
#include <valarray> 
#include <random> 
#include <stdio.h>

std::default_random_engine generator; 
std::uniform_real_distribution<double> distribution(0.0, 1.0);

class darray : public std::valarray<double> { 
public: 
    darray() : std::valarray<double>() {} 
    darray(size_t n) : std::valarray<double>(n) {}

    const double& at(size_t n) const { 
        if (n >= this->size()) { 
            std::__throw_out_of_range_fmt(__N("out_of_range")); 
        } 
        return (*this)[n]; 
    } 
};

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

BOOST_PYTHON_MODULE(ems) { 
    using namespace boost::python;

    class_<Field>("Field", init<int>()) 
        .def("Positions", &Field::Positions, 
             return_internal_reference<>()) 
        .def("Dump", &Field::Dump) 
        .def("Churn", &Field::Churn) 
        ;

    class_<darray>("darray") 
        .def("__getitem__", &darray::at, 
             return_value_policy<copy_const_reference>()) 
        .def("__len__", &darray::size) 
        ; 
}
```
 
Numpy 1.10.1 でも問題なく動作するようになりました。

 
```
>>> import ems 
>>> import numpy as np 
>>> np.__version__ 
'1.10.1' 
>>> f = ems.Field(4) 
Field::Field(): 0x1029880 
>>> x = f.Positions() 
>>> f.Churn() 
>>> f.Dump() 
[ 0.132 0.459 0.219 0.679 ] 
>>> np.array(x) 
array([ 0.13153779,  0.45865013,  0.21895919,  0.67886472]) 
>>> quit() 
Field::~Field() 0x1029880
```
 
この場合の動作ですが、darray::at で投げた例外が boost_python ライブラリの中の例外ハンドラーによって捕捉されるようです。たぶん #1 か #2 が例外ハンドラー。

 
```
#0  PyErr_SetString (exception=0x7a2ce0 <_PyExc_IndexError>, string=0x7ea428 "out_of_range") at Python/errors.c:68 
#1  0x00007ffff56f3471 in boost::python::handle_exception_impl(boost::function0<void>) () 
   from /usr/lib/x86_64-linux-gnu/libboost_python-py27.so.1.58.0 
#2  0x00007ffff56e8719 in ?? () from /usr/lib/x86_64-linux-gnu/libboost_python-py27.so.1.58.0 
#3  0x0000000000422faa in PyObject_Call (func=func@entry=0x8bce90, arg=arg@entry=0x7ffff0b4f710, kw=kw@entry=0x0) 
    at Objects/abstract.c:2546 
#4  0x0000000000429dfc in instancemethod_call (func=0x8bce90, arg=0x7ffff0b4f710, kw=0x0) at Objects/classobject.c:2602 
#5  0x0000000000422faa in PyObject_Call (func=func@entry=0x7ffff0b3ce60, arg=arg@entry=0x7ffff7e965d0, kw=kw@entry=0x0) 
    at Objects/abstract.c:2546 
#6  0x0000000000481766 in slot_sq_item (self=<optimized out>, i=<optimized out>) at Objects/typeobject.c:5012 
#7  0x0000000000444e5d in iter_iternext (iterator=0x7ffff0b98e50) at Objects/iterobject.c:63 
#8  0x0000000000448e9a in listextend (self=self@entry=0x7ffff0b4f5f0, b=b@entry=0x7ffff0b98e50) 
    at Objects/listobject.c:872 
#9  0x000000000044aeb5 in _PyList_Extend (self=self@entry=0x7ffff0b4f5f0, b=b@entry=0x7ffff0b98e50) 
    at Objects/listobject.c:910 
#10 0x000000000042243c in PySequence_List (v=0x7ffff0b98e50) at Objects/abstract.c:2264 
#11 PySequence_Fast (v=v@entry=0x7ffff0b24670, m=m@entry=0x7ffff4aa09e8 "Could not convert object to sequence") 
    at Objects/abstract.c:2293 
#12 0x00007ffff49cb73c in PyArray_DTypeFromObjectHelper (obj=obj@entry=0x7ffff0b24670, maxdims=maxdims@entry=32, 
    out_dtype=out_dtype@entry=0x7fffffffdea8, string_type=string_type@entry=0) 
    at numpy/core/src/multiarray/common.c:531
```
 
このハングは、numpy.ndarray に限りません。例えばリスト内包表記で ems::darray を列挙しようとしても再現します。そのときのコールスタックはこのようになります。

 
```
#0  darray::at (this=0xb60d30, n=1) at shared.cpp:16 
#1  0x00007ffff5e933bb in boost::python::detail::invoke<boost::python::to_python_value<double const&>, double const& (darray::*)(unsigned long) const, boost::python::arg_from_python<darray&>, boost::python::arg_from_python<unsigned long> > 
    (rc=..., ac0=..., tc=<synthetic pointer>, f= 
    @0x8bcc58: (const double &(darray::*)(const darray * const, unsigned long)) 0x7ffff5e92170 <darray::at(unsigned long) const>) at /usr/include/boost/python/detail/invoke.hpp:88 
#2  boost::python::detail::caller_arity<2u>::impl<double const& (darray::*)(unsigned long) const, boost::python::return_value_policy<boost::python::copy_const_reference, boost::python::default_call_policies>, boost::mpl::vector3<double const&, darray&, unsigned long> >::operator() (args_=<optimized out>, this=0x8bcc58) 
    at /usr/include/boost/python/detail/caller.hpp:223 
#3  boost::python::objects::caller_py_function_impl<boost::python::detail::caller<double const& (darray::*)(unsigned long) const, boost::python::return_value_policy<boost::python::copy_const_reference, boost::python::default_call_policies>, boost::mpl::vector3<double const&, darray&, unsigned long> > >::operator() (this=0x8bcc50, args=<optimized out>, 
    kw=<optimized out>) at /usr/include/boost/python/object/py_function.hpp:38 
#4  0x00007ffff56eb33d in boost::python::objects::function::call(_object*, _object*) const () 
   from /usr/lib/x86_64-linux-gnu/libboost_python-py27.so.1.58.0 
#5  0x00007ffff56eb528 in ?? () from /usr/lib/x86_64-linux-gnu/libboost_python-py27.so.1.58.0 
#6  0x00007ffff56f3363 in boost::python::handle_exception_impl(boost::function0<void>) () 
   from /usr/lib/x86_64-linux-gnu/libboost_python-py27.so.1.58.0 
#7  0x00007ffff56e8719 in ?? () from /usr/lib/x86_64-linux-gnu/libboost_python-py27.so.1.58.0 
#8  0x0000000000422faa in PyObject_Call (func=func@entry=0x8bce90, arg=arg@entry=0x7ffff0b4f758, kw=kw@entry=0x0) 
    at Objects/abstract.c:2546 
#9  0x0000000000429dfc in instancemethod_call (func=0x8bce90, arg=0x7ffff0b4f758, kw=0x0) at Objects/classobject.c:2602 
#10 0x0000000000422faa in PyObject_Call (func=func@entry=0x7ffff0b3ce60, arg=arg@entry=0x7ffff7e964d0, kw=kw@entry=0x0) 
    at Objects/abstract.c:2546 
#11 0x0000000000481766 in slot_sq_item (self=<optimized out>, i=<optimized out>) at Objects/typeobject.c:5012 
#12 0x0000000000444e5d in iter_iternext (iterator=0x7ffff0b98e50) at Objects/iterobject.c:63 
#13 0x00000000004b2373 in PyEval_EvalFrameEx (f=f@entry=0x7ffff1b3faa0, throwflag=throwflag@entry=0) 
    at Python/ceval.c:2806
```
 
フレーム#12 と #13 から分かるように、今度は PyEval_EvalFrameEx から iter_iternext が呼ばれています。仮にこのハングを Python 側で直すとして、iter_iternext の中でサイズをチェックする、というアプローチが考えられます。Numpy のコードから確認できますが、PySequence_Size は darray::\__len__ を呼ぶので、サイズは正しく取得できます。が、コードを見る限り、Python の iterator オブジェクトはサイズをチェックしなくても iterator するだけで要素を列挙できるのが利点なので、iter_iternext はこのままのほうが自然です。

 
もう少し見てみないと分かりませんが、ems.Field オブジェクトが iterator を使ってシーケンシャルにアクセスする種類になっているのが悪いのではないかと思います。何らかの方法で、ems.Field は iterator ではなくインデックスを使ってランダム アクセスすべきものに種別できればちゃんと動くのではないかと。そんな種類があるかどうか分かりませんが。後で調べよう。

 
### 4. おまけ - Python のデバッグ環境

 
Python をデバッグするため、Python そのものをソースからビルドしたので、そのときのコマンドを紹介します。

 
```
$ wget https://www.python.org/ftp/python/2.7.11/Python-2.7.11.tgz 
$ tar -xvf Python-2.7.11.tgz 
$ cd Python-2.7.11/ 
$ ./configure --prefix=/usr/local/python/python-2.7.11 --enable-unicode=ucs4 
$ make 
$ sudo make install 
$ sudo ln -s /usr/local/python/python-2.7.11 /usr/local/python/current 
```
 
configure するときに ucs4 を指定しておかないと、numpy をインポートしたときに以下のエラーが出ます。

 
```
>>> import numpy as np 
Traceback (most recent call last): 
  File "<stdin>", line 1, in <module> 
  File "/usr/lib/python2.7/dist-packages/numpy/__init__.py", line 153, in <module> 
    from . import add_newdocs 
  File "/usr/lib/python2.7/dist-packages/numpy/add_newdocs.py", line 13, in <module> 
    from numpy.lib import add_newdoc 
  File "/usr/lib/python2.7/dist-packages/numpy/lib/__init__.py", line 8, in <module> 
    from .type_check import * 
  File "/usr/lib/python2.7/dist-packages/numpy/lib/type_check.py", line 11, in <module> 
    import numpy.core.numeric as _nx 
  File "/usr/lib/python2.7/dist-packages/numpy/core/__init__.py", line 6, in <module> 
    from . import multiarray 
ImportError: /usr/lib/python2.7/dist-packages/numpy/core/multiarray.so: undefined symbol: PyUnicodeUCS4_AsUnicodeEscapeString
```
 
このままだと、ビルドした Python のモジュール検索パスが空っぽなので、デバッグするときは環境変数を使って、元からあった Python の dist-packages を追加しておきました。たぶんもっとうまいやり方があるはず。

 
```
john@ubuntu1510:~/Documents/pyc$ export PYTHONPATH=/usr/local/lib/python2.7/dist-packages 
john@ubuntu1510:~/Documents/pyc$ gdb /usr/local/python/current/bin/python 
GNU gdb (Ubuntu 7.10-1ubuntu2) 7.10 
Copyright (C) 2015 Free Software Foundation, Inc. 
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
Reading symbols from /usr/local/python/current/bin/python...done. 
(gdb) r 
Starting program: /usr/local/python/python-2.7.11/bin/python 
[Thread debugging using libthread_db enabled] 
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1". 
Python 2.7.11 (default, Dec 21 2015, 12:40:02) 
[GCC 5.2.1 20151010] on linux2 
Type "help", "copyright", "credits" or "license" for more information. 
>>>
```
 
Numpy は、以前 pip でインストールしたものにデバッグ情報が入っていたので、わざわざソースからビルドすることなくそのまま使いました。というか、Numpy のビルドは追加モジュールがいろいろ必要で面倒そうだったので諦めたともいいます。

