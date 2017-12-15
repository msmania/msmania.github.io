---
layout: post
title: "Debugging Flash.ocx"
date: 2014-09-27 06:43:54.000 +09:00
categories:
- C/C++
- Debug
- Security
- Windows
tags:
- flash.ocx
---

ActionScript のオブジェクトについて少しデバッグしてみたので、そこで得られた結果などを紹介します。

 
まずは前回の続きです。Exploit が使っている C394 という Stack Pivot のコードの代わりに、デバッグ ブレークが発生するように CCCC という命令を選んで vtable を書き換え、得られたブレークがこれでした。

 
```
0:005> r 
eax=1a001018 ebx=028eb8e0 ecx=241ff020 edx=07f3df20 esi=70185d60 edi=07fce810 
eip=6f8e1fc8 esp=028eb830 ebp=028eb838 iopl=0         nv up ei pl nz na po nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00200200 
Flash+0x1fc8: 
6f8e1fc8 cc              int     3 
0:005> dd esp 
028eb830  70158fc5 07faeec8 028eb844 70185d70 
028eb840  241ff021 028eb8a0 7019dd98 07faeec8 
028eb850  00000001 028eb8e0 07fce810 07faeec8 
028eb860  08340fa0 00000000 00000000 07fce810 
028eb870  07faeec8 08046600 028eb8e8 00000000 
028eb880  00000000 00000000 00000000 00000000 
028eb890  00000000 00000007 00000000 ad5aa7aa 
028eb8a0  028eb8c0 7019eb48 07faeec8 00000001 
0:005> ub 70158fc5 
Flash!IAEModule_AEModule_PutKernel+0x2b68d2: 
70158fb2 2407            and     al,7 
70158fb4 3c01            cmp     al,1 
70158fb6 7512            jne     Flash!IAEModule_AEModule_PutKernel+0x2b68ea (70158fca) 
70158fb8 83f904          cmp     ecx,4 
70158fbb 720d            jb      Flash!IAEModule_AEModule_PutKernel+0x2b68ea (70158fca) 
70158fbd 83e1f8          and     ecx,0FFFFFFF8h 
70158fc0 8b01            mov     eax,dword ptr [ecx] 
           <<<<<<<< ecx: Sound object, eax: vtable 
70158fc2 ff5078          call    dword ptr [eax+78h] 
           <<<<<<<< calling Sound.toString()  
0:005> dd ecx l8 
241ff020  1a001018 400000ff 0832ef38 08355d60 
241ff030  00000000 00000000 083a23b0 00000000 
0:005> dd 1a001018 
1a001018  768d5994 1a001c08 1a001000 00004000 
1a001028  00000040 1a002000 6f8e1fc8 6f8e1fc8 
1a001038  6f8e1fc8 6f8e1fc8 6f8e1fc8 6f8e1fc8 
1a001048  6f8e1fc8 6f8e1fc8 6f8e1fc8 6f8e1fc8 
1a001058  6f8e1fc8 6f8e1fc8 6f8e1fc8 6f8e1fc8 
1a001068  6f8e1fc8 6f8e1fc8 6f8e1fc8 6f8e1fc8 
1a001078  6f8e1fc8 6f8e1fc8 6f8e1fc8 6f8e1fc8 
1a001088  6f8e1fc8 6f8e1fc8 6f8e1fc8 6f8e1fc8 
0:005> ln 768d5994 
(768d5994)   kernel32!VirtualProtectStub   |  (768d59a5)   kernel32!VirtualProtectExStub 
Exact matches: 
    kernel32!VirtualProtectStub (<no parameter info>)  
```
 
AVM2 (ActionScript) 上での Sound .toString() が、CPU 上では仮想テーブルを eax に入れたうえで call ptr &#x5b;eax+78&#x5d; を実行するような indirect call になっているので、Stack Pivot によって eip と esp を同時に乗っ取ることができるのでした。

 
以前紹介した以下のブログ記事に "<em>In the exploit found in the wild, a Sound() object was used. I also chose to use it but it is possible to use any other object as long as you can control it." </em>という記述があり、Sound オブジェクトは既に exploit された実績があり、既知の情報として業界では有名なのかもしれません。

 
HDW Sec - Blog <br />
[http://hdwsec.fr/blog/CVE-2014-0322.html](http://hdwsec.fr/blog/CVE-2014-0322.html)

 
知識として知っておくだけでも知らないよりは随分と違いますが、何もないところからどうやって見つけてくるのか、という方法を知りたいところです。そこで、exploit で使われていた Heap Spray のテクニックを応用してデバッグしてみました。

 
まずは ActionScript を書きます。

 
```
package { 
  import flash.display.Sprite; 
  import flash.events.*; 
  import flash.media.*; 
  import flash.printing.*; 
  import flash.system.fscommand; 
  import flash.utils.*; 
  import flash.xml.*; 

  public class Main extends Sprite { 
    public var mTimer:Timer; 
    public var mCounter:int; 

    public function Main():void { 
      this.mCounter = 0; 
      this.mTimer = new Timer(1000, 3600); 
      this.mTimer.addEventListener("timer", this.timerHandler); 
      this.mTimer.start(); 

      buildBuffer(); 
    } 

    public var mSound:Sound; 
    public var mPrint:PrintJob; 
    public var mXmlDoc:XMLDocument; 
    public var mXml:XML; 

    public var mSounds:Vector.<Object>; 
    public var mPrints:Vector.<Object>; 
    public var mXmlDocs:Vector.<Object>; 
    public var mXmls:Vector.<Object>; 

    public function buildBuffer():void { 
      this.mSound = new Sound(); 
      this.mPrint = new PrintJob(); 
      this.mXmlDoc = new XMLDocument(); 
      this.mXml = <books> 
        <book publisher="Addison-Wesley" name="Design Patterns" /> 
        <book publisher="Addison-Wesley" name="The Pragmatic Programmer" /> 
        <book publisher="Addison-Wesley" name="Test Driven Development" /> 
        <book publisher="Addison-Wesley" name="Refactoring to Patterns" /> 
        <book publisher="O'Reilly Media" name="The Cathedral & the Bazaar" /> 
        <book publisher="O'Reilly Media" name="Unit Test Frameworks" /> 
        </books>; 

      var i:int = 0; 
      var j:int = 0; 
      var len0:int = 0x123; 

      var len1:int = 0x1234; 
      var len2:int = 0x5678; 
      var len3:int = 0x4321; 
      var len4:int = 0x4444; 

      this.mSounds = new Vector.<Object>(len0); 
      this.mPrints = new Vector.<Object>(len0); 
      this.mXmlDocs = new Vector.<Object>(len0); 
      this.mXmls = new Vector.<Object>(len0); 

      for ( i = 0  i < len0  ++i ) { 
        this.mSounds[i] = new Vector.<Object>(len1); 
        for ( j = 0  j < len1  ++j ) { 
          this.mSounds[i][j] = this.mSound; 
        } 

        this.mPrints[i] = new Vector.<Object>(len2); 
        for ( j = 0  j < len2  ++j ) { 
          this.mPrints[i][j] = this.mPrint; 
        } 

        this.mXmlDocs[i] = new Vector.<Object>(len3); 
        for ( j = 0  j < len3  ++j ) { 
          this.mXmlDocs[i][j] = this.mXmlDoc; 
        } 

        this.mXmls[i] = new Vector.<Object>(len4); 
        for ( j = 0  j < len4  ++j ) { 
          this.mXmls[i][j] = this.mXml; 
        } 
      } 

      trace("ready."); 
    } 

    public function hex(n:uint) : String { 
      var s:String = n.toString(16); 
      while( s.length < 8 ) { 
        s = '0' + s; 
      } 
      return s; 
    } 

    public function timerHandler(param1:TimerEvent) : void { 
      trace("+ENTER timerHandler: " + hex(mCounter += 1000)); 

      trace("calling Sound.toString()..."); 
      mSound.toString(); 

      trace("calling PrintJob.willTrigger()..."); 
      mPrint.willTrigger('jugemujugemu!'); 

      trace("calling XMLDocument.parseXML()..."); 
      mXmlDoc.parseXML('namuamidabutu'); 

      trace("calling XML.descendants()..."); 
      mXml.descendants('hoge'); 
    } 
  } 
}
```
 
HTML も書きます。例によって embed タグの間に空白を入れています。

 
```
<!DOCTYPE html> 
<html> 
<head></head> 
<body> 
<p>welcome to heapspray</p> 
<em bed src="heapspray.swf" width="50" height="50"></em bed> 
</body> 
</html>
```
 
ActionScript をコンパイルして、得られた swf ファイルと HTML を適当な Web サーバーにデプロイします。今回スプレーしたオブジェクト、配列の長さ、試すメソッドは以下の 4 種類です。全部適当に選んでいます。

 
- Sound | length = 0x1234 | method = toString() 
- PrintJob | length = 0x5678 | method = willTrigger(type:String) 
- XMLDocument | length = 0x4321 | method = parseXML(source:String) 
- XML | length = 0x4444 | method = descendants(name:*) 

 
今回は最新の環境でデバッグを行います。Flash Player はデバッグ機能がないものを使いました。

 
- OS: Windows 8.1 x64 with Update 1 
- Browser: IE11 32bit + KB2977629 (Sep. 2014 Update) 
- Flash Player: 15.0 

 
やろうとすることは単純で、配列の長さの情報をメモリ上で検索してオブジェクトへのアドレスを見つけ、仮想テーブルのアドレスに対して read のアクセス ブレークポイントを設定するだけです。

 
まずは Sound.toString() から。狙い通りのところでブレークしました。Exploit のときは &#x5b;eax+78&#x5d; でしたが、今回は &#x5b;eax+70&#x5d; のアドレスを call するようです。Exploit では Windows 8 用のデバッグ機能付きの flash.ocx を使っており、環境が違うとvtable 上のオフセットも変わるということでしょう。Exploit の中で、狙っているメソッドを決め打ちしにいくメリットはあまりなく、広範囲にわたって vtable 書き換えるのが現実的なようです。

 
```
0:035> lmvm flash 
start    end        module name 
6fd20000 70f43000   Flash      (deferred)              
    Image path: C:\Windows\SysWOW64\Macromed\Flash\Flash.ocx 
    Image name: Flash.ocx 
    Timestamp:        Fri Sep 12 18:51:54 2014 (5413A33A) 
    CheckSum:         0113F37D 
    ImageSize:        01223000 
    File version:     15.0.0.167 
    Product version:  15.0.0.167 
    File flags:       0 (Mask 3F) 
    File OS:          4 Unknown Win32 
    File type:        2.0 Dll 
    File date:        00000000.00000000 
    Translations:     0409.04b0 
    CompanyName:      Adobe Systems, Inc. 
    ProductName:      Shockwave Flash 
    InternalName:     Adobe Flash Player 15.0 
    OriginalFilename: Flash.ocx 
    ProductVersion:   15,0,0,167 
    FileVersion:      15,0,0,167 
    FileDescription:  Adobe Flash Player 15.0 r0 
    LegalCopyright:   Adobe? Flash? Player. Copyright ? 1996-2014 Adobe Systems Incorporated. All Rights Reserved. Adobe and Flash are either trademarks or registered trademarks in the United States and/or other countries. 
    LegalTrademarks:  Adobe Flash Player 

0:021> s -d 00000000 l1000000 00001234 
03537dc0  00001234 03209010 03204100 724b2e6d  4..... ..A .m.Kr 
036ebd58  00001234 000003a8 000004e4 00000000  4............... 
0:021> s -d 04000000 l1000000 00001234 
04983508  00001234 000000f0 00001244 00000834  4.......D...4... 
049835c0  00001234 000000f0 00001244 00000834  4.......D...4... 
049860e0  00001234 00002104 000016b4 00000834  4....!......4... 
04986250  00001234 00002104 000016b4 00000834  4....!......4... 
(snip) 
0:021> s -d 08000000 l1000000 00001234 
0800aac8  00001234 12350000 12371236 12380000  4.....5.6.7...8. 
09f69024  00001234 0a0e2021 0a0e2021 0a0e2021  4...! ..! ..! .. 
09f72024  00001234 0a0e2021 0a0e2021 0a0e2021  4...! ..! ..! .. 
09f7f024  00001234 0a0e2021 0a0e2021 0a0e2021  4...! ..! ..! .. 
09f8e024  00001234 0a0e2021 0a0e2021 0a0e2021  4...! ..! ..! .. 
0a00d024  00001234 0a0e2021 0a0e2021 0a0e2021  4...! ..! ..! .. 
0:021> ba r4 0a0e2020 
0:021> g 
Breakpoint 0 hit 
*** ERROR: Symbol file could not be found.  Defaulted to export symbols for C:\Windows\SysWOW64\Macromed\Flash\Flash.ocx -  
eax=70a24b14 ebx=00000000 ecx=0a0e2020 edx=09d54040 esi=0a042f10 edi=09c3f810 
eip=704bae52 esp=02a3bf70 ebp=02a3bf74 iopl=0         nv up ei pl nz na po nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00200202 
Flash!IAEModule_AEModule_PutKernel+0x1ec142: 
704bae52 ff5070          call    dword ptr [eax+70h]  ds:002b:70a24b84=c04d4b70 
0:002> ub . 
Flash!IAEModule_AEModule_PutKernel+0x1ec130: 
704bae40 8bc1            mov     eax,ecx 
704bae42 2407            and     al,7 
704bae44 3c01            cmp     al,1 
704bae46 7512            jne     Flash!IAEModule_AEModule_PutKernel+0x1ec14a (704bae5a) 
704bae48 83f904          cmp     ecx,4 
704bae4b 720d            jb      Flash!IAEModule_AEModule_PutKernel+0x1ec14a (704bae5a) 
704bae4d 83e1f8          and     ecx,0FFFFFFF8h 
704bae50 8b01            mov     eax,dword ptr [ecx] 
0:002> u . 
Flash!IAEModule_AEModule_PutKernel+0x1ec142: 
704bae52 ff5070          call    dword ptr [eax+70h] 
704bae55 5f              pop     edi 
704bae56 5d              pop     ebp 
704bae57 c20400          ret     4 
704bae5a 56              push    esi 
704bae5b 51              push    ecx 
704bae5c 8b4a04          mov     ecx,dword ptr [edx+4] 
704bae5f e83cfbfeff      call    Flash!IAEModule_AEModule_PutKernel+0x1dbc90 (704aa9a0)
```
 
では次のメソッド、PrintJob.willTrigger です。

 
```
0:016> s -d 08000000 l1000000 00005678 
0a147024  00005678 09c0e859 09c0e859 09c0e859  xV..Y...Y...Y... 
0a403024  00005678 09c0e859 09c0e859 09c0e859  xV..Y...Y...Y... 
0a43c024  00005678 09c0e859 09c0e859 09c0e859  xV..Y...Y...Y... 
0a488024  00005678 09c0e859 09c0e859 09c0e859  xV..Y...Y...Y... 
0a4c1024  00005678 09c0e859 09c0e859 09c0e859  xV..Y...Y...Y... 

0:016> ba r4 09c0e858 
0:016> g 
Breakpoint 0 hit 
eax=70a23af4 ebx=09c3f810 ecx=09c0e858 edx=09c0e858 esi=09c0e858 edi=09c0e859 
eip=7014f13b esp=02a3c0c0 ebp=02a3c0d4 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00200246 
Flash!DllUnregisterServer+0x9b45b: 
7014f13b ff750c          push    dword ptr [ebp+0Ch]  ss:002b:02a3c0e0=01000000 

0:002> ub . 
Flash!DllUnregisterServer+0x9b447: 
7014f127 83cf01          or      edi,1 
7014f12a 8bc8            mov     ecx,eax 
7014f12c 8bd7            mov     edx,edi 
7014f12e e8dd903500      call    Flash!IAEModule_AEModule_PutKernel+0x1d9500 (704a8210) 
7014f133 8bce            mov     ecx,esi 
7014f135 84c0            test    al,al 
7014f137 7519            jne     Flash!DllUnregisterServer+0x9b472 (7014f152) 
7014f139 8b06            mov     eax,dword ptr [esi] 
0:002> u . 
Flash!DllUnregisterServer+0x9b45b: 
7014f13b ff750c          push    dword ptr [ebp+0Ch] 
7014f13e ff7508          push    dword ptr [ebp+8] 
7014f141 8b808c000000    mov     eax,dword ptr [eax+8Ch] 
7014f147 ffd0            call    eax 
7014f149 5f              pop     edi 
7014f14a 5e              pop     esi 
7014f14b 5b              pop     ebx 
7014f14c 8be5            mov     esp,ebp 
```
 
こちらもヒットしました。vtable の +8C のところにあるアドレスを実行しています。しかし、これは同じ方法で exploit に使うことはできません。indirect call ではあるのですが、eax+8C にある関数のアドレスを一度 eax に代入してから call しているので、eax と esp 交換するだけの Stack Pivot では esp を乗っ取ることができません。仮想テーブルのアドレスが esi に残っているので、これを使えば何とか、というところですが・・・esi を参照して eax などのレジスターに入れてから esp と交換、するようなコードを見つけることができれば使えます。

 
次のクラスに移る前に、もう少し調べてみたいことがあります。ActionScript 上の willTrigger は String クラスの引数を 1 つ取ります。アセンブリを見ると、call の前に 2 回 push しているので、vtable+8C は引数を 2 つ取る関数のように見えます。call までステップ オーバーしてスタックの中身を見ます。

 
```
eax=70a23af4 ebx=09c3f810 ecx=09c0e858 edx=09c0e858 esi=09c0e858 edi=09c0e859 
eip=7014f13b esp=02a3c0c0 ebp=02a3c0d4 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00200246 
Flash!DllUnregisterServer+0x9b45b: 
7014f13b ff750c          push    dword ptr [ebp+0Ch]  ss:002b:02a3c0e0=01000000 
0:002> p 
eax=70a23af4 ebx=09c3f810 ecx=09c0e858 edx=09c0e858 esi=09c0e858 edi=09c0e859 
eip=7014f13e esp=02a3c0bc ebp=02a3c0d4 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00200246 
Flash!DllUnregisterServer+0x9b45e: 
7014f13e ff7508          push    dword ptr [ebp+8]    ss:002b:02a3c0dc=b8cc0b0a 
0:002>  
eax=70a23af4 ebx=09c3f810 ecx=09c0e858 edx=09c0e858 esi=09c0e858 edi=09c0e859 
eip=7014f141 esp=02a3c0b8 ebp=02a3c0d4 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00200246 
Flash!DllUnregisterServer+0x9b461: 
7014f141 8b808c000000    mov     eax,dword ptr [eax+8Ch] ds:002b:70a23b80=20e81470 
0:002>  
eax=7014e820 ebx=09c3f810 ecx=09c0e858 edx=09c0e858 esi=09c0e858 edi=09c0e859 
eip=7014f147 esp=02a3c0b8 ebp=02a3c0d4 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00200246 
Flash!DllUnregisterServer+0x9b467: 
7014f147 ffd0            call    eax {Flash!DllUnregisterServer+0x9ab40 (7014e820)} 
0:002> dd esp 
02a3c0b8  0a0bccb8 00000001 09c0e858 0a0bccb8 
02a3c0c8  09c3f810 704b384d 09c3000a 02a3c0fc 
02a3c0d8  70152897 0a0bccb8 00000001 02a3c0f4 
02a3c0e8  09ba2fc0 02a3c2e0 09c3f810 0a120c70 
02a3c0f8  9d5b780c 02a3c108 70195a40 0a0bccb8 
02a3c108  02a3c158 0a0f41c8 0a075ef8 00000001 
02a3c118  02a3c138 0a0f4179 00000011 00000000 
02a3c128  0a0dd080 00005208 0a0d80ac 0a0dd080 
0:002> dd 0a0bccb8 
0a0bccb8  70a8b9fc 40000002 09c8e7a4 00000000 
0a0bccc8  0000000d 0000001a 70a8b9fc 40000002 
0a0bccd8  09c8e782 00000000 00000021 0000001a 
0a0bcce8  70a8b9fc 40000002 09c8e766 00000000 
0a0bccf8  0000001b 0000001a 70a8b9fc 40000002 
0a0bcd08  09c8e74c 00000000 00000015 0000001a 
0a0bcd18  70a8cbe4 00000017 09fed1f0 0a0bcd30 
0a0bcd28  09bb1c91 20000001 70a8cbe4 00000003 
0:002> dd 70a8b9fc 
70a8b9fc  70490070 70491f70 704931c0 7064d0cb 
70a8ba0c  704bb7f0 70494050 6ff39720 704943a0 
70a8ba1c  70494310 70494330 704946f0 6ff39ad0 
70a8ba2c  6fe3a620 70494290 6ff39720 704943a0 
70a8ba3c  70494310 70494330 70494700 70494900 
70a8ba4c  704944e0 70496190 70494180 70494c60 
70a8ba5c  7064d0cb 70495600 6fdc66e0 7064d0cb 
70a8ba6c  702e65f0 70495e20 704957d0 6ff50820 
0:002> db 09c8e7a4 
09c8e7a4  6a 75 67 65 6d 75 6a 75-67 65 6d 75 21 0b 77 69  jugemujugemu!.wi 
09c8e7b4  6c 6c 54 72 69 67 67 65-72 21 63 61 6c 6c 69 6e  llTrigger!callin 
09c8e7c4  67 20 58 4d 4c 44 6f 63-75 6d 65 6e 74 2e 70 61  g XMLDocument.pa 
09c8e7d4  72 73 65 58 4d 4c 28 29-2e 2e 2e 0d 6e 61 6d 75  rseXML()....namu 
09c8e7e4  61 6d 69 64 61 62 75 74-75 08 70 61 72 73 65 58  amidabutu.parseX 
09c8e7f4  4d 4c 1c 63 61 6c 6c 69-6e 67 20 58 4d 4c 2e 64  ML.calling XML.d 
09c8e804  65 73 63 65 6e 64 61 6e-74 73 28 29 2e 2e 2e 04  escendants().... 
09c8e814  68 6f 67 65 0b 64 65 73-63 65 6e 64 61 6e 74 73  hoge.descendants 
```
 
最初に push されていたのは 1 なので、これは無視するとして、第一引数はオブジェクトの参照のように見えます。実際に参照先をダンプすると、オフセット +0 は vtable で、明らかに何かのクラスです。+8 のところにあるアドレスをダンプしてみると、引数として与えた " jugemujugemu!" という文字を指していました。ということで第一引数は ActionScript 上の引数である String オブジェクトと同等のものが渡されていると考えてもよさそうです。

 
さて次のメソッド、XMLDocument.parseXML。vtable らしき構造はあるのにブレークせず。何かコードがまずいのだろうか。よく分からないのでパス。

 
```
0:014> s -d 08000000 l1000000 00004321 
0a3e0024  00004321 0a131041 0a131041 0a131041  !C..A...A...A... 
0a419024  00004321 0a131041 0a131041 0a131041  !C..A...A...A... 
0a452024  00004321 0a131041 0a131041 0a131041  !C..A...A...A... 
0a475024  00004321 0a131041 0a131041 0a131041  !C..A...A...A... 
0a49e024  00004321 0a131041 0a131041 0a131041  !C..A...A...A... 
0a4d7024  00004321 0a131041 0a131041 0a131041  !C..A...A...A... 
0:014> ba r4 0a131040 
0:014> g  
ヒットせず・・・
```
 
最後、XML.descendants。

 
```
0:013> s -d 08000000 l1000000 00004444 
08288f14  00004444 00004a44 00005044 00005644  DD..DJ..DP..DV.. 
0a3f1024  00004444 0a045941 0a045941 0a045941  DD..AY..AY..AY.. 
0a42a024  00004444 0a045941 0a045941 0a045941  DD..AY..AY..AY.. 
0a463024  00004444 0a045941 0a045941 0a045941  DD..AY..AY..AY.. 
0a4af024  00004444 0a045941 0a045941 0a045941  DD..AY..AY..AY.. 
0a4e8024  00004444 0a045941 0a045941 0a045941  DD..AY..AY..AY.. 
0a529024  00004444 0a045941 0a045941 0a045941  DD..AY..AY..AY.. 
0:013> ba r4 0a045940 
0:013> g 
Breakpoint 0 hit 
eax=70a8c930 ebx=09c3f810 ecx=09b9b240 edx=00000010 esi=0a045940 edi=09ba2fc0 
eip=704b0d11 esp=02a3c0dc ebp=02a3c0f4 iopl=0         nv up ei pl zr na pe nc 
cs=0023  ss=002b  ds=002b  es=002b  fs=0053  gs=002b             efl=00200246 
Flash!IAEModule_AEModule_PutKernel+0x1e2001: 
704b0d11 8d4dec          lea     ecx,[ebp-14h] 
0:002> ub . 
Flash!IAEModule_AEModule_PutKernel+0x1e1fea: 
704b0cfa 8945f4          mov     dword ptr [ebp-0Ch],eax 
704b0cfd 8945f8          mov     dword ptr [ebp-8],eax 
704b0d00 8d45ec          lea     eax,[ebp-14h] 
704b0d03 8b4904          mov     ecx,dword ptr [ecx+4] 
704b0d06 50              push    eax 
704b0d07 ff7508          push    dword ptr [ebp+8] 
704b0d0a e8417bffff      call    Flash!IAEModule_AEModule_PutKernel+0x1d9b40 (704a8850) 
704b0d0f 8b06            mov     eax,dword ptr [esi] 
0:002> u . 
Flash!IAEModule_AEModule_PutKernel+0x1e2001: 
704b0d11 8d4dec          lea     ecx,[ebp-14h] 
704b0d14 51              push    ecx 
704b0d15 8bce            mov     ecx,esi 
704b0d17 ff500c          call    dword ptr [eax+0Ch] 
704b0d1a 50              push    eax 
704b0d1b e82007ffff      call    Flash!IAEModule_AEModule_PutKernel+0x1d2730 (704a1440) 
704b0d20 8b4dfc          mov     ecx,dword ptr [ebp-4] 
704b0d23 83c404          add     esp,4 
```
 
今度は狙い通りブレーク。call も関数のアドレスをレジスタに入れることなく、そのまま call ptr &#x5b;eax+c&#x5d; しているところはよいのですが、オフセットの +C というのは小さすぎて使えない気がします。

 
それにしても、ちょうどいいメソッドを見つけるのは難しいものです。なんだかんだ素直に Sound.toString() を使うのが最良の選択といったところ。しかし、アクセス ブレークポイントを使ってある程度はデバッガーから Flash オブジェクトの動きを探れないこともなさそうです。頑張れば解析ツールを書くことも技術的には可能か・・・。

