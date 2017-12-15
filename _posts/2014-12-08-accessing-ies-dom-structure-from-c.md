---
layout: post
title: "Accessing IE's DOM structure from C#"
date: 2014-12-08 10:37:14.000 +09:00
categories:
- C#
- Windows
tags:
- IHTMLDocument
- mshtml
- tlbimp
- WM_HTML_GETOBJECT
---

IE のレンダリング エンジンと言えば Trident と呼ばれる mshtml.dll です。なんと単一の DLL でサイズが 20MB もあります。この Trident、COM 経由でデータにアクセスするための API を実装しているらしい、ということで試してみました。検索すると、わりといろいろな人が試していてメジャーな方法らしい。ウィキにも書いてありました。

 
Trident (layout engine) - Wikipedia, the free encyclopedia <br />
[http://en.wikipedia.org/wiki/Trident_(layout_engine)](http://en.wikipedia.org/wiki/Trident_(layout_engine))

 
基本となる元ネタはこの KB。今回は Win32 ではなく C# で書き直すことにします。

 
How to get IHTMLDocument2 from a HWND <br />
[http://support.microsoft.com/kb/249232/en](http://support.microsoft.com/kb/249232/en)

 
上記 KB のプログラムをざっと見ると、ウィンドウ ハンドルに対して WM_HTML_GETOBJECT というウィンドウ メッセージを送ると、COM インターフェースである IHTMLDocument2 が返ってくるらしい。ウィンドウ ハンドルは普通の方法で列挙して、クラス名が "Internet Explorer_Server" であるものを探せばいいようだ。簡単でいい感じ。

 
IHTMLDocument2 インターフェースのリファレンスは MSDN も載っています。最新版だと IHTMLDocument8 まであるらしい。

 
Scripting Object Interfaces (MSHTML) (Windows) <br />
[http://msdn.microsoft.com/en-us/library/hh801967(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/hh801967(v=vs.85).aspx)

 
今回の開発環境はこれで。プログラムは Windows 8 や 8.1 でも動くはずです。さすがに試していませんが、.NET Framework 4.0 を入れれば XP や Vista でも行けるはず・・。

 
- OS: Windows 7 SP1 x64 
- IE: Internet Explorer 11 + KB3003057 (Nov. 2014 Update) 
- IDE: Visual Studio 2012 
- CLI: .NET Framework 4.0 

 
適当な C# プロジェクトを作って、リファレンスを追加します。が、ここで一つ罠が。Visual Studio の Reference Manager を見ると、Microsoft HTML Object Library という Type Library が既定で存在しています。これは既に mshtml のライブラリが GAC に登録されているからであり、おそらく .NET か Windows のインストール時に追加されたものと考えられます。

 
![]({{site.assets_url}}2014-12-08-image.png)

 
手元の環境だと、"C:\Windows\assembly\GAC\Microsoft.mshtml\7.0.3300.0__b03f5f7f11d50a3a" に存在する Microsoft.mshtml.dll がそのライブラリでした。

 
![]({{site.assets_url}}2014-12-08-image1.png)

 
このライブラリを使っても問題はないのですが、IE のアップデート時や累積パッチの適用時に GAC は更新されないらしく、古いのです。開発環境の Windows 7 において Object Explorer から確認すると分かりますが、例えば IHTMLDocument5 インターフェースまでしか存在せず、 IHTMLDocument6 以降がありません。

 
![]({{site.assets_url}}2014-12-08-image2.png)

 
便利なことに、IE 更新時には適用される mshtml.dll に対応する Type Library ファイル mshtml.tlb も一緒に提供されるので、このファイルからアセンブリ DLL を作れば最新のライブラリを使うことができます。TLB から DLL を作る方法は、以前に紹介した tlbimp というツールが使えます。"Developer Command Prompt for VS2012" を開いてコマンドを実行するだけです。

 
出力例はこんな感じ。ファイル名は mshtml.ie11.dll にしていますが、何でもよいです。system32 にある mshtml.tlb から DLL を作りましたが、生成された DLL は 32bit からでも 64bit からでも使うことができます。

 
```
E:\VSDev\Projects\iehack> tlbimp /reference:C:\windows\system32\mshtml.tlb /out:mshtml.ie11.dll 
Microsoft (R) .NET Framework Type Library to Assembly Converter 4.0.30319.17929 
Copyright (C) Microsoft Corporation.  All rights reserved.

TlbImp : error TI2005 : No input file has been specified.

E:\VSDev\Projects\iehack>tlbimp C:\windows\system32\mshtml.tlb /out:mshtml.ie11.dll 
Microsoft (R) .NET Framework Type Library to Assembly Converter 4.0.30319.17929 
Copyright (C) Microsoft Corporation.  All rights reserved.

TlbImp : warning TI3001 : Primary interop assembly 'Microsoft.mshtml, Version=7.0.3300.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a' is already registered for type library 'C:\windows\system32\mshtml.tlb'. 
TlbImp : warning TI3015 : At least one of the arguments for 'mshtml.ie11.IActiveIMMApp.GetDefaultIMEWnd' cannot be marshaled by the runtime marshaler.  Such arguments will therefore be passed as a pointer and may require unsafe code to manipulate. 
TlbImp : warning TI3016 : The type library importer could not convert the signature for the member 'mshtml.ie11._userBITMAP.pBuffer'. 
TlbImp : warning TI3016 : The type library importer could not convert the signature for the member 'mshtml.ie11._FLAGGED_BYTE_BLOB.abData'. 
TlbImp : warning TI3015 : At least one of the arguments for 'mshtml.ie11.IEventTarget2.GetRegisteredEventTypes' cannot be marshaled by the runtime marshaler.  Such arguments will therefore be passed as a pointer and may require unsafe code to manipulate. 
TlbImp : warning TI3015 : At least one of the arguments for 'mshtml.ie11.IEventTarget2.GetListenersForType' cannot be marshaled by the runtime marshaler.  Such arguments will therefore be passed as a pointer and may require unsafe code to manipulate. 
TlbImp : warning TI3016 : The type library importer could not convert the signature for the member 'mshtml.ie11.tagSAFEARRAY.rgsabound'. 
TlbImp : warning TI3015 : At least one of the arguments for 'mshtml.ie11.ICanvasPixelArrayData.GetBufferPointer' cannot be marshaled by the runtime marshaler.  Such arguments will therefore be passed as a pointer and may require unsafe code to manipulate. 
TlbImp : Type library imported to E:\VSDev\Projects\iehack\mshtml.ie11.dll 
```
 
 

 
警告がたくさん出ましたが、よく分からないので (汗) 無視します。

 
生成された mshtml.ie11.dll をプロジェクトに追加して Object Explorer で見てみると、今度は IHTMLDocument8 がありました。それにしてもクラスやらインターフェースが多いです。アセンブリだけで 15MB 近いサイズになります。

 
![]({{site.assets_url}}2014-12-08-image3.png)

 
あとは素直に C# を書くだけです。

 
```
// 
// Program.cs 
// 
// http://support.microsoft.com/kb/249232/en 
// 

using System; 
using System.Collections.Generic; 
using System.Globalization; 
using System.Runtime.InteropServices; 
using System.Text; 
using System.Threading.Tasks; 

namespace iehack { 
    class Program { 
        public delegate int WNDENUMPROC(IntPtr hwnd, IntPtr lParam); 

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] 
        static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount); 

        [DllImport("user32.dll", SetLastError = true)] 
        static extern int EnumChildWindows(IntPtr hwndParent, WNDENUMPROC lpEnumFunc, IntPtr lParam); 

        [DllImport("user32.dll", SetLastError = true)] 
        static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId); 

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] 
        static extern uint RegisterWindowMessage(string lpString); 

        [Flags] 
        public enum SendMessageTimeoutFlags : uint { 
            SMTO_NORMAL = 0x0, 
            SMTO_BLOCK = 0x1, 
            SMTO_ABORTIFHUNG = 0x2, 
            SMTO_NOTIMEOUTIFNOTHUNG = 0x8, 
            SMTO_ERRORONEXIT = 0x20 
        } 

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] 
        public static extern IntPtr SendMessageTimeout( 
            IntPtr hWnd, 
            uint Msg, 
            IntPtr wParam, 
            IntPtr lParam, 
            SendMessageTimeoutFlags fuFlags, 
            uint uTimeout, 
            out IntPtr lpdwResult); 

        [DllImport("oleacc.dll", PreserveSig = false)] 
        [return: MarshalAs(UnmanagedType.Interface)] 
        static extern object ObjectFromLresult(IntPtr lResult, 
             [MarshalAs(UnmanagedType.LPStruct)] Guid refiid, IntPtr wParam); 

        private static int EnumWindowsProc(IntPtr hwnd, IntPtr lParam) { 
            // http://msdn.microsoft.com/en-us/library/windows/desktop/ms633576(v=vs.85).aspx 
            // The maximum length for lpszClassName is 256. 

            StringBuilder ClassName = new StringBuilder(256); 
            int Ret = GetClassName(hwnd, ClassName, ClassName.Capacity); 
            if (Ret != 0) { 
                if (string.Compare(ClassName.ToString(), "Internet Explorer_Server", true, CultureInfo.InvariantCulture) == 0) { 
                    var TargetList = GCHandle.FromIntPtr(lParam).Target as List<IntPtr>; 
                    if (TargetList != null) { 
                        TargetList.Add(hwnd); 
                    } 
                } 
            } 

            return 1; 
        } 

        private static int EnumTopWindowsProc(IntPtr hwnd, IntPtr lParam) { 
            EnumChildWindows(hwnd, EnumWindowsProc, lParam); 
            return 1; 
        } 

        static uint WM_HTML_GETOBJECT = 0; 

        public static object GetDom(IntPtr Window, Guid InterfaceType) { 
            const int Timeout = 1000; 

            if (WM_HTML_GETOBJECT == 0) { 
                WM_HTML_GETOBJECT = RegisterWindowMessage("WM_HTML_GETOBJECT"); 
            } 

            IntPtr Result = IntPtr.Zero; 
            SendMessageTimeout(Window, WM_HTML_GETOBJECT, 
                IntPtr.Zero, IntPtr.Zero, 
                SendMessageTimeoutFlags.SMTO_ABORTIFHUNG, 
                Timeout, 
                out Result); 

            return ObjectFromLresult(Result, InterfaceType, IntPtr.Zero); 
        } 

        List<IntPtr> WindowHandles; 

        public void Run() { 
            WindowHandles = new List<IntPtr>(); 
            var ListHandle = GCHandle.Alloc(WindowHandles); 
            EnumChildWindows(IntPtr.Zero, EnumTopWindowsProc, GCHandle.ToIntPtr(ListHandle)); 

            int i = 0; 
            foreach (var ie in WindowHandles) { 
                uint pid, tid; 
                tid = GetWindowThreadProcessId(ie, out pid); 

                Console.WriteLine("[{0}] hWnd = 0x{1:x}, pid = 0x{2:x4}, tid = 0x{3:x4}", i++, ie.ToInt64(), pid, tid); 

                var dom2 = GetDom(ie, typeof(mshtml.ie11.IHTMLDocument2).GUID) as mshtml.ie11.IHTMLDocument2; 
                if (dom2 != null) { 
                    Console.WriteLine("url = " + dom2.url); 

                    var dom6 = GetDom(ie, typeof(mshtml.ie11.IHTMLDocument6).GUID) as mshtml.ie11.IHTMLDocument6; 
                    if (dom6 != null) { 
                        Console.WriteLine("docmode = " + dom6.documentMode); 
                    } 
                } 
            } 
        } 

        static void Main(string[] args) { 
            var p = new Program(); 
            p.Run(); 
        } 
    } 
}
```
 
やろうと思えばもっと工夫できそうな気もしますが、データが取得できることが確認できればいいので最低限で。このサンプルを実行すると、ウィンドウ クラス名が "Internet Explorer_Server" であるウィンドウ全てに対して、そのコントロールが開いている URL と DocMode を表示します。

 
DocMode とは、IE8 から導入された機能です。主に HTML レイアウトの後方互換性を維持するために、古いバージョンの IE のレンダリング モードをある程度まで再現することができるようになっています。例えば IE8 向けに作られたサイトで、IE11 で開くとレイアウトが崩れてしまうような場合には、HTML 内の meta 要素で DocMode を明示的に 8 に指定して回避できることがあります。

 
Specifying legacy document modes (Internet Explorer) <br />
[http://msdn.microsoft.com/en-us/library/jj676915(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/jj676915(v=vs.85).aspx)

 
IE8/IE9の「ブラウザーモード」と「ドキュメントモード」のまとめ: 小粋空間 <br />
[http://www.koikikukan.com/archives/2011/02/07-005555.php](http://www.koikikukan.com/archives/2011/02/07-005555.php)

 
手元の環境で実行した結果がこんな感じです。IE の各タブだけでなく、以下の例では Windows Live Writer で使われている Web コントロールの情報も表示されています。

 
```
E:\VSDev\Projects\iehack\bin\x64\Release>iehack.exe 
[0] hWnd = 0x40914, pid = 0x1d94, tid = 0x0d6c 
url = https://www.google.com/?gws_rd=ssl 
docmode = 11 
[1] hWnd = 0x1505aa, pid = 0x1c58, tid = 0x2010 
url = https://www.facebook.com/ 
docmode = 10 
[2] hWnd = 0x804e6, pid = 0x1c58, tid = 0x1094 
url = about:blank 
docmode = 11 
[3] hWnd = 0x204d2, pid = 0x118c, tid = 0x0948 
url = file://C:\Users\John\AppData\Local\Temp\WindowsLiveWriter1286139640\B8DD92B2061F\index.htm 
docmode = 7 
```
 
このサンプルでは試していませんが、KB249232 の例で背景色を変更しているように、値を取得するだけではなく、変更することもできます。しかし DocumentMode プロパティを始めとして、読み取り専用のプロパティもあります。

