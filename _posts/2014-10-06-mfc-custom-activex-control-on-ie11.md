---
layout: post
title: "MFC Custom ActiveX Control on IE11"
date: 2014-10-06 05:13:25.000 +09:00
categories:
- C/C++
- Windows
tags:
- ActiveX
- EPM
- ocx
- Protected Mode
---

Internet Explorer において、Flash を再生する Flash Player とは ActiveX コントロールの一つであり、実体は %windir%\System32\Macromed\Flash 下にある ocx ファイルです。ocx は OLE 対応した単なる DLL です。HTML の Object 要素を使うと、クラス GUID を指定することで任意の ActiveX コントロールを HTML に埋め込むことができます。したがって、ActiveX コントロールを使うと、任意の Win32 ネイティブのコードを IE のプロセス内で動かすことができます。セキュリティ ホールいらずです。また、.NET を使って ActiveX コントロールを書くこともできます。

 
ただし、ActiveX をユーザーに実行させるための最大の難関は、ActiveX コントロールをユーザー側のコンピューターにインストールさせることです。攻撃者としては、言葉巧みにそれらしいメッセージを表示させてユーザーにインストールを許可させようとするしかない、はずです。知らない名前の ActiveX コントロールは絶対にインストールしないようにしましょう。

 
Internet Explorer で一部の ActiveX コントロールがブロックされるのはなぜですか。 <br />
[http://windows.microsoft.com/ja-jp/Windows7/Why-does-Internet-Explorer-block-some-ActiveX-controls](http://windows.microsoft.com/ja-jp/Windows7/Why-does-Internet-Explorer-block-some-ActiveX-controls)

 
では ActiveX コントロールを作って、HTML から実行するまでの手順を紹介します。開発環境は↓です。

 
- OS: Windows 7 SP1 x64 
- IDE: Visual Studio 2012 Update 4 

 
以下のチュートリアルを参考にしましたが、記事が古く、環境やツールが違いすぎるので、Visual Studio のウィザード設定部分ぐらいしか参考にならず・・。

 
A Complete ActiveX Web Control Tutorial - CodeProject <br />
[http://www.codeproject.com/Articles/14533/A-Complete-ActiveX-Web-Control-Tutorial](http://www.codeproject.com/Articles/14533/A-Complete-ActiveX-Web-Control-Tutorial)

 
<font color="#0000ff">[2015/3/2 追記]     <br>本記事の続きとして、EPM でも動作可能にする方法を書きました。また全体のソースを GitHub にアップロードしました。</font>

 
MFC Custom ActiveX Control on IE11 | すなのかたまり <br />
[https://msmania.wordpress.com/2015/02/19/epm-compatible-activex-control/](https://msmania.wordpress.com/2015/02/19/epm-compatible-activex-control/) <br />
[https://github.com/msmania/RunMeOnIE](https://github.com/msmania/RunMeOnIE)

 
さて、コントロールを作るといっても、Visual Studio のプロジェクト テンプレートがあるので、1 から書く必要はありません。そのテンプレートは、Templates &gt; Visual C++ &gt; MFC &gt; MFC ActiveX Control です。このご時勢に MFC を触ることになるとは！

 
![]({{site.assets_url}}2014-10-06-image.png) <br />
ActiveX のプロジェクト テンプレート

 
ウィザードはほぼデフォルトのままにします。よく分からないんで・・・

 
![]({{site.assets_url}}2014-10-06-image1.png) <br />
ウィザード ページ 1

 
![]({{site.assets_url}}2014-10-06-image2.png) <br />
ウィザード ページ 2

 
![]({{site.assets_url}}2014-10-06-image3.png) <br />
ウィザード ページ 3

 
Control Settings の画面では少し設定を変えます。まあ変えなくてもそんなに影響はないかと。

 
- Create control based on: STATIC 
- Flicker-free activation: check 
- Has an About box dialog: uncheck 

 
![]({{site.assets_url}}2014-10-06-image4.png) <br />
ウィザード ページ 4

 
Finish をクリックして完了です。MFC なので、大量のファイルやコードが生成されます。

 
とりあえず何もいじらずにビルドします。すると、いきなりビルド エラーになるはずです。

 
```
1>Link:

1> Creating library E:\VSDev\Projects\myactivex\Debug\myactivex.lib and object E:\VSDev\Projects\myactivex\Debug\myactivex.exp

1> myactivex.vcxproj -> E:\VSDev\Projects\myactivex\Debug\myactivex.ocx

1>C:\Program Files (x86)\MSBuild\Microsoft.Cpp\v4.0\V110\Microsoft.CppCommon.targets(1609,5): warning MSB3075: The command "regsvr32 /s "E:\VSDev\Projects\myactivex\Debug\myactivex.ocx"" exited with code 5. Please verify that you have sufficient rights to run this command.

1> The previous error was converted to a warning because the task was called with ContinueOnError=true.

1> Build continuing because "ContinueOnError" on the task "Exec" is set to "true".

1>C:\Program Files (x86)\MSBuild\Microsoft.Cpp\v4.0\V110\Microsoft.CppCommon.targets(1621,5): error MSB8011: Failed to register output. Please try enabling Per-user Redirection or register the component from a command prompt with elevated permissions.

1>

1>Build FAILED.
```
 
親切にも、ビルド後に regsvr32 でコントロールを登録しようとしてくれて Access Denied されているようです。余計なお世話です。もちろん、Visual Studio を管理者として実行すればいいのでしょうが、開発機に余計な ActiveX コントロールはインストールしたくありません。このregsvr32、Post -Build Event あたりにでも登録されているのかと思いきや、どこに設定があるのか見つかりません。そこで、エラー メッセージに表示されている Microsoft.CppCommon.targets とやらの 1609 行目あたりを見てみます。

 
```
<!-- ******************************************************************************************* 
      RegisterDll 
     ******************************************************************************************* --> 
<Target Name="RegisterOutput" 
        Condition="'$(EmbedManifest)'=='true' and '$(LinkSkippedExecution)' != 'true' and ('$(_IsNativeEnvironment)' == 'true' or '$(Platform)' == 'Win32')">

  <Exec Command="regsvr32 /s &quot;%(Link.OutputFile)&quot;" Condition="'$(ConfigurationType)'=='DynamicLibrary' and '%(Link.RegisterOutput)'=='true' and '%(Link.PerUserRedirection)'!='true'" ContinueOnError="true"> 
    <Output TaskParameter="ExitCode" PropertyName="_RegisterOutputExitCode"/> 
  </Exec> 
  <Exec Command="regsvr32 /s /n /i:user &quot;%(Link.OutputFile)&quot;" Condition="'$(ConfigurationType)'=='DynamicLibrary' and '%(Link.RegisterOutput)'=='true' and '%(Link.PerUserRedirection)'=='true'" ContinueOnError="true"> 
    <Output TaskParameter="ExitCode" PropertyName="_RegisterOutputExitCode"/> 
  </Exec> 
  <Exec Command="&quot;%(Link.OutputFile)&quot; /RegServer" Condition="'$(ConfigurationType)'=='Application' and '%(Link.RegisterOutput)'=='true' and '%(Link.PerUserRedirection)'!='true'" ContinueOnError="true"> 
    <Output TaskParameter="ExitCode" PropertyName="_RegisterOutputExitCode"/> 
  </Exec> 
  <Exec Command="&quot;%(Link.OutputFile)&quot; /RegServerPerUser" Condition="'$(ConfigurationType)'=='Application' and '%(Link.RegisterOutput)'=='true' and '%(Link.PerUserRedirection)'=='true'" ContinueOnError="true"> 
    <Output TaskParameter="ExitCode" PropertyName="_RegisterOutputExitCode"/> 
  </Exec> 
  <VCMessage Code="MSB8011" Type="Error" Condition="'$(_RegisterOutputExitCode)' != '' and '$(_RegisterOutputExitCode)' != '0'" /> 
</Target>
```
 
regsvr32 コマンドが見つかりました。プロジェクト ユニークではなく、msbuild によるビルド ステップに組み込まれているようです。RegisterOutput というセクションで実行されるらしいことを確認して、次にさっき作ったプロジェクト内を検索します。すると、myactivex.vcxproj ファイルに以下のような記述が見つかります。

 
```
<ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Debug|Win32'"> 
  <ClCompile> 
    <PrecompiledHeader>Use</PrecompiledHeader> 
    <WarningLevel>Level3</WarningLevel> 
    <Optimization>Disabled</Optimization> 
    <PreprocessorDefinitions>WIN32;_WINDOWS;_DEBUG;_USRDLL;%(PreprocessorDefinitions)</PreprocessorDefinitions> 
    <SDLCheck>true</SDLCheck> 
  </ClCompile> 
  <Link> 
    <SubSystem>Windows</SubSystem> 
    <GenerateDebugInformation>true</GenerateDebugInformation> 
    <ModuleDefinitionFile>.\myactivex.def</ModuleDefinitionFile> 
    <OutputFile>$(OutDir)$(ProjectName).ocx</OutputFile> 
    <RegisterOutput>true</RegisterOutput> 
  </Link>
```
 
RegisterOutput が true に設定されています。これは Link のセクションにあるので、Visual Studio に戻ってプロジェクト設定の Linker の設定を探します。すると、General に Register Output といういかにもな項目がありました。これを False にして、無事 regsvr32 を無効にすることができました。

 
![]({{site.assets_url}}2014-10-06-image5.png)

 
ビルドすると myactive.ocx ファイルができます。コードは何もいじっていませんが、とりあえずはこの ocx を HTML からロードしてみます。

 
前述の通り、HTML で ActiveX を埋め込むには、クラス GUID を指定した object 要素を使います。クラス GUID はウィザードが適当なものを割り振っているはずで、プロジェクトの idl ファイルを見ると分かります。このような定義を探してください。以下の例だと、ＧＵＩＤ は 87CBF97A-D5C3-4DCD-85E7-044732782EA9 です。

 
```
//  Class information for CmyactivexCtrl 
[ 
  uuid(87CBF97A-D5C3-4DCD-85E7-044732782EA9) 
] 
coclass myactivex 
{ 
  [default] dispinterface _Dmyactivex; 
  [default, source] dispinterface _DmyactivexEvents; 
}; 
```
 
書いた HTML が↓です。これを適当な Web サーバーにデプロイして下さい。

 
```
<!DOCTYPE html> 
<html> 
<head> 
</head> 
<body> 
<p>welcome to custom activex!</p> 
<object id="myactivex" classid="clsid:87CBF97A-D5C3-4DCD-85E7-044732782EA9" /> 
</body> 
</html> 
```
 
動かす環境はこれにします。

 
- OS: Windows 8.1 x64 + Update 1 
- IE11 + KB2977629 (Sep. 2014 Update) 

 
Web ページを開く前に ActiveX コントロールをインストールしておく必要があります。まず、ビルドしてできた ocx ファイルを適当なフォルダーにコピーします。プロジェクトの設定を変えていないので、VC と MFC のランタイムが必要です。ファイルは以下の通りです。また、デバッグのため、pdb シンボルも忘れずにコピーします。

 
![]({{site.assets_url}}2014-10-06-02.png) <br />
コピーしたファイル。今回は Debug ビルドを使用。

 
次に、regsvr32 を実行して ocx を登録します。regsvr32 の実行には管理者権限が必要です。

 
![]({{site.assets_url}}2014-10-06-image6.png)

 
regsvr32 によってocx 用のエントリがレジストリに登録され、GUID 経由で ocx ファイルの位置などを特定できるようになります。regsvr32 に /u オプションをつけて実行すると、登録を解除することができます。

 
登録が終わったら、HTML を開きます。ActiveX を含んでいることによる警告が出ました。ここで Allow をクリックすることで、IE のプロセス内に ocx がロードされます。

 
![]({{site.assets_url}}2014-10-06-01.png)

 
デバッガーをアタッチして lm コマンドを実行すると、確かに myactivex.ocx がロードされています。

 
```
1:016> lm m myactivex 
start             end                 module name 
00000000`70ec0000 00000000`70eee000   myactivex   (deferred)
```
 
なお、デバッガーをアタッチしたまま IE を閉じると、プロセス終了時にメモリ リークが検出されます。おいおい・・どっち側のバグでしょうかね。

 
```
Detected memory leaks! 
Dumping objects -> 
e:\vsdev\projects\myactivex\myactivexctrl.cpp(13) : {82} client block at 0x04F91F60, subtype c0, 500 bytes long. 
a CmyactivexCtrl object at $04F91F60, 500 bytes long 
Object dump complete.
```
 
これだけでは面白くないので、ActiveX クラスにメソッドを追加して JavaScript から実行できるようにします。

 
まずは Visual Studio で Class View を開き、COM のインターフェースを右クリックして Add &gt; Add Method メニューをクリックします。ウィザードで何も変えていなければ、????Lib の下の _D???? という名前のインターフェースがそれです。

 
![]({{site.assets_url}}2014-10-06-image9.png) <br />
Class View

 
メソッドの追加ウィザードが始まるので、追加するメソッドの名前、戻り値、パラメーターを適当に決めて次に進みます。

 
![]({{site.assets_url}}2014-10-06-image7.png)

 
次の画面は、よく分からないのでそのまま Finish をクリックします。

 
![]({{site.assets_url}}2014-10-06-image8.png)

 
ウィザードによって、複数の場所が変更されます。まずは idl ファイルのインターフェース定義にメソッドが追加されます。

 
```
//  Primary dispatch interface for CmyactivexCtrl 
[  
  uuid(744067E6-5C99-4D71-B814-24750B6575F5)   
] 
dispinterface _Dmyactivex 
{ 
  properties: 
  methods: 
        [id(1)] ULONG Run(BSTR Command); 
}; 
```
 
ヘッダー ファイルには、列挙型とメソッドの宣言が追加されます。

 
```
class CmyactivexCtrl : public COleControl 
{ 
(snip) 
// Dispatch and event IDs 
public: 
  enum {  
        dispidRun = 1L 
    }; 
protected: 
    ULONG Run(LPCTSTR Command); 

};
```
 
cpp ファイルには、メソッドの定義に加えて、ディスパッチ マップとかいうエントリも追加されます。これがクラスとインターフェースを繋げるものらしいので、例えばメソッドを削除/変更するときには忘れずに整合性が取れるようにしておく必要があります。

 
ウィザードが作成したメソッドの定義に、1 行 (青字) だけ付け加えました。パラメーターをそのままメッセージボックスとして表示させます。

 
```
// Dispatch map 

BEGIN_DISPATCH_MAP(CmyactivexCtrl, COleControl) 
    DISP_FUNCTION_ID(CmyactivexCtrl, "Run", dispidRun, Run, VT_UI4, VTS_BSTR) 
END_DISPATCH_MAP() 

(snip) 

// CmyactivexCtrl message handlers 

ULONG CmyactivexCtrl::Run(LPCTSTR Command) 
{ 
    AFX_MANAGE_STATE(AfxGetStaticModuleState()); 

    // TODO: Add your dispatch handler code here 
    AfxMessageBox(Command); 

    return 0; 
}
```
 
この状態でビルドして、できたファイルをテストマシンにコピーし、HTML を以下のように変更します。ロード時に Run メソッドが呼ばれるようにしただけです。

 
```
<!DOCTYPE html> 
<html> 
<head> 
<script> 
window.onload = function() { 
  var o = document.getElementById('myactivex'); 
  try { 
    o.Run('Hello, ActiveX!'); 
  } 
  catch (e) { 
    alert(e); 
  } 
} 
</script> 
</head> 
<body> 
<p>welcome to custom activex!</p> 
<object id="myactivex" classid="clsid:87cbf97a-d5c3-4dcd-85e7-044732782ea9" /> 
</body> 
</html> 
```
 
この状態で HTML を開くと、"Object doesn't support property or method" という JavaScript のエラーが出ます。プロセス内に ocx はロードされているようですが、JavaScript からは正しくオブジェクトが見えないようです。

 
![]({{site.assets_url}}2014-10-06-a.png)

 
実はここでけっこうハマりましたが、結局コードに悪いところはどこにもなく、IE のセキュリティ設定によるものだと分かりました。お馴染みのことながらエラーメッセージが不親切すぎる・・。

 
まずは、HTML を置いてあるサイトを Trusted sites に登録します。

 
![]({{site.assets_url}}2014-10-06-04.png)

 
ページをロードしなおすと、今度は "Member not found." という別のエラーが出ます。Trusted sites に追加するだけじゃ駄目なようです。

 
![]({{site.assets_url}}2014-10-06-05.png)

 
あと面白いことに、Trusted sites に追加することで、プロセス終了時のメモリリークは発生しなくなります。IE の防御が中途半端で、オブジェクト作成時のコードは実行されるけど解放のコードは防御対象になってしまう、とかそんな感じなのかもしれません。IE のバグっぽいです。

 
Trusted sites のセキュリティ設定を眺めて、それっぽい設定を探すと、"Initialize and script ActiveX controls not marked as safe for scripting" という設定が Disable になっているものが見つかります。これを Prompt もしくは Enable にすることで、メソッドが実行されるようになりました。

 
![]({{site.assets_url}}2014-10-06-06.png)

 
Prompt を選んでページをロードしなおすと、以下のダイアログが表示されます。最後の警告です。

 
![]({{site.assets_url}}2014-10-06-07.png)

 
ここで Yes を選ぶと、無事メッセージボックスが表示されました。

 
![]({{site.assets_url}}2014-10-06-08.png)

 
以上の結果から、未署名の ActiveX オブジェクトのメソッドを呼ぶには、ユーザーがいろいろと許可しないといけないように見えます。しかし、任意のネイティブコードを HTML から実行させるという観点から考えると、関門は 2 つだけで、ocx ファイルのインストールと、最初の Allow ボタンです。

 
Allow をクリックして ocx がロードされた時点で、すでにコードは実行されているわけで、そこに悪意あるコードを書いておけば、Trusted sites に登録させる必要はないのです。例えば、CmyactivexCtrl クラスのコンストラクターにブレークポイントを設定すると、サイトが Internet ゾーンに所属していようと、ロード時に実行されることが分かります。

 
```
0:028> |1s 
wow64cpu!CpupSyscallStub+0x2: 
00000000`77d82772 c3              ret 
1:026> bu myactivex!CmyactivexCtrl::CmyactivexCtrl 
1:026> g 
ModLoad: 00007ff8`c33a0000 00007ff8`c33d0000   C:\Windows\SYSTEM32\ntmarta.dll 
ModLoad: 00007ff8`bd6c0000 00007ff8`bd700000   C:\Windows\System32\MSWB7.dll 
ModLoad: 00000000`71c30000 00000000`71c78000   C:\Windows\SysWOW64\OLEACC.DLL 
ModLoad: 00000000`71bb0000 00000000`71c2b000   C:\Windows\SysWOW64\sxs.dll 
ModLoad: 00000000`71ba0000 00000000`71ba7000   C:\Windows\SysWOW64\rasadhlp.dll 
ModLoad: 00000000`71ab0000 00000000`71b94000   C:\Windows\SysWOW64\uiautomationcore.dll 
ModLoad: 00000000`71a60000 00000000`71aa4000   C:\Windows\SysWOW64\fwpuclnt.dll 
ModLoad: 00007ff8`c4eb0000 00007ff8`c4ee8000   C:\Windows\SYSTEM32\XmlLite.dll 
ModLoad: 00000000`71a40000 00000000`71a56000   C:\Program Files (x86)\Windows Defender\MpOav.dll 
ModLoad: 00000000`719a0000 00000000`71a3e000   C:\Program Files (x86)\Windows Defender\mpclient.dll 
ModLoad: 00000000`71990000 00000000`71998000   C:\Windows\SysWOW64\VERSION.dll 
ModLoad: 00000000`774b0000 00000000`774e8000   C:\Windows\SysWOW64\WINTRUST.dll 
ModLoad: 00000000`71970000 00000000`7198e000   C:\Windows\SysWOW64\gpapi.dll 
*** WARNING: Unable to verify checksum for C:\MSWORK\activex\myactivex.ocx 
ModLoad: 00000000`71940000 00000000`7196e000   C:\MSWORK\activex\myactivex.ocx 
ModLoad: 00000000`71150000 00000000`71933000   C:\MSWORK\activex\mfc110ud.dll 
ModLoad: 00000000`70fa0000 00000000`71141000   C:\MSWORK\activex\MSVCR110D.dll 
Breakpoint 0 hit 
myactivex!CmyactivexCtrl::CmyactivexCtrl: 
71955a70 55              push    ebp 
1:015:x86> k 
ChildEBP RetAddr 
02af6204 719535cf myactivex!CmyactivexCtrl::CmyactivexCtrl 
02af6304 715d3bcd myactivex!CmyactivexCtrl::CreateObject+0x6f 
02af6354 7162698d mfc110ud!CRuntimeClass::CreateObject+0xdd 
02af6364 716261d2 mfc110ud!COleObjectFactory::OnCreateObject+0x5d 
02af63e4 71626044 mfc110ud!COleObjectFactory::XClassFactory::CreateInstanceLic+0x172 
02af6408 73377f92 mfc110ud!COleObjectFactory::XClassFactory::CreateInstance+0x24 
02af6440 73378f4b MSHTML!COleSite::InstantiateObjectFromCF+0xd2 
02af84c8 733770e2 MSHTML!COleSite::CreateObjectNow+0x96 
02af84ec 73378bfb MSHTML!CCodeLoad::OnObjectAvailable+0x59 
02af8578 73378875 MSHTML!CCodeLoad::BindToObject+0x36d 
02af8598 733786be MSHTML!CCodeLoad::Init+0x19f 
02af85c4 73363688 MSHTML!COleSite::CreateObject+0x24d 
02afc674 73363199 MSHTML!CObjectElement::FinalCreateObject+0x32b 
02afc6f0 73364a83 MSHTML!CObjectElement::CreateObject+0x109 
02afc6f8 730e956e MSHTML!CHtmObject10ParseCtx::Execute+0x18 
02afc770 731d01ec MSHTML!CHtmParseBase::Execute+0x136 
02afc894 730d72c2 MSHTML!CHtmPost::Exec+0x468 
02afc8ac 730d7246 MSHTML!CHtmPost::Run+0x1c 
02afc8cc 730d7b35 MSHTML!PostManExecute+0x61 
02afc8e0 730d7a96 MSHTML!PostManResume+0x7b 
02afc910 73240a23 MSHTML!CHtmPost::OnDwnChanCallback+0x38 
02afc920 73021f12 MSHTML!CDwnChan::OnMethodCall+0x19 
02afc964 73008dda MSHTML!GlobalWndOnMethodCall+0x12c 
02afc9b0 75f17834 MSHTML!GlobalWndProc+0x15c 
02afc9dc 75f17a9a user32!_InternalCallWinProc+0x23 
02afca6c 75f1988e user32!UserCallWinProcCheckWow+0x184 
02afcad8 75f198f1 user32!DispatchMessageWorker+0x208 
02afcae4 749b8eb4 user32!DispatchMessageW+0x10 
02affcb0 749f0a07 IEFRAME!CTabWindow::_TabWindowThreadProc+0x449 
02affd68 755b6bac IEFRAME!LCIETab_ThreadProc+0x301 
02affd78 746abcf2 iertutil!_IsoThreadProc_WrapperToReleaseScope+0xe 
02affda4 75a7919f IEShims!NS_CreateThread::DesktopIE_ThreadProc+0x71 
02affdb0 77dda8cb KERNEL32!BaseThreadInitThunk+0xe 
02affdf4 77dda8a1 ntdll_77d90000!__RtlUserThreadStart+0x20 
02affe04 00000000 ntdll_77d90000!_RtlUserThreadStart+0x1b
```
 
IE9 あたりから、アドオンを管理する機能が追加されました。ここで、自分の環境にインストールされている ActiveX コントロールの一覧を確認することができます。これを無効にすると、ページを開いても ocx はロードされません。パフォーマンスだけでなく、セキュリティ面ｊから、使うもの以外は無効にしておきましょう。

 
Internet Explorer 9 のアドオンの管理方法 - Windows ヘルプ <br />
[http://windows.microsoft.com/ja-jp/windows/manage-addons-internet-explorer-9](http://windows.microsoft.com/ja-jp/windows/manage-addons-internet-explorer-9)

 
![]({{site.assets_url}}2014-10-06-b.png)

 
最後に、Protected Mode について。ActiveX に限らず、何らかの脆弱性によって inject されてしまったコードであっても、とにかく IE のプロセス内で実行されるコードは、プロセスが持つ権限による制限を受けます。万が一悪意があるコードが実行されたとしても、そもそも IE ができることを制限しておくことで被害をを最小限に留めることができます。それが IE7 から導入されたProtected Mode と IE10 から導入された Enhanced Protected Mode (EPM) です。

 
まず Protected Mode ですが、これは Vista で導入された Integrity Mechanism という機能を利用するものです。簡単に言えば、Protected Mode を有効にした IE は、プロセスの権限が弱く設定されており (Low Integrity Level) 、書き込みが可能なファイルやレジストリの場所が制限されたりします。Process Explorer から各プロセスの Integrity Level を確認できます。こんな感じ。

 
![]({{site.assets_url}}2014-10-06-c.png) <br />
Protected Mode = ON (既定値)

 
![]({{site.assets_url}}2014-10-06-d.png) <br />
Protected Node = OFF

 
iexplore.exe が 2 つありますが、それぞれフレーム プロセスとタブ プロセスです。実際に HTML や ActiveX をロードするのはタブ プロセスの方で、フレーム プロセスの子プロセスとして起動されます。そのタブ プロセスの Integrity が Protected Mode によって変わっていることが分かります。

 
なお、IE を管理者権限で実行したり、Administrator アカウントを日常的に使っていると、プロセスは High Integrity Level になってしまうので、Protected Mode は意味を為さなくなります。これはとても危険な状態です。

 
![]({{site.assets_url}}2014-10-06-g.png)

 
最後に Enhanced Protected Mode (EPM) について。これもプロセスの権限を、従来の Protected Mode よりさらに厳しくするものです。EPM を有効にして Process Explorer を見ると、iexplore.exe プロセスが 3 つになっていて、Integrity が AppContainer と表示されるものがあります。これが EPM の特徴です。

 
![]({{site.assets_url}}2014-10-06-e.png) <br />
EPM = ON の設定

 
![]({{site.assets_url}}2014-10-06-h.png) <br />
EPM = ON; Integrity = AppContainer のプロセスがある。

 
AppContainer とは、Windows 8 から導入された機能であり、Integrity Level 以上にプロセスの権限を細かく制限できる機能です。 主に Modern UI (Windows ストア アプリ) で使われています。Modern UI は全然触ったことがないので、詳細はパス。このブログとか分かりやすい。

 
AppContainer 導入による Windows 開発への影響 - NyaRuRuが地球にいたころ <br />
[http://nyaruru.hatenablog.com/entry/2012/10/08/185804](http://nyaruru.hatenablog.com/entry/2012/10/08/185804)

 
EPM を有効にすると、デスクトップの IE でも AppContainer が使われるというわけです。Low Integrity Level も存在しますが、おそらくこれは AppContainer の中だけでは実行できないタスクなどを AppContainer の外から実行するためのブローカー プロセスではないかと。

 
Enhanced Protected Mode on desktop IE (Windows) <br />
[http://msdn.microsoft.com/en-us/library/ie/dn265025(v=vs.85).aspx](http://msdn.microsoft.com/en-us/library/ie/dn265025(v=vs.85).aspx)

 
ちなみに、Protected Mode を Off にした状態でも EPM のチェックボックスを ON にすることはできますが、このときは Integrity Level は Medium のままです。EPM を ON にするには Protected Mode = ON が必須です。

 
もう一つ、上に掲載したインターネット オプションで EPM を ON にしている画面で、"Enable 64-bit processes for Enhanced Protected Mode" という設定項目があります。これは文字通り、EPM を有効にしたときにデスクトップ IE のタブ プロセスを 64bit にするオプションです。デスクトップ IE のタブ プロセスは既定で 32bit だからです。この設定は IE10 にはなく、IE10 で EPM を有効にすると、勝手にタブ プロセスが 64bit になります。32bit の AppContainer 内の IE のプロセス、というのが IE11 で追加された新しいモードです。

 
また、IE11 は Windows 7 にもインストールすることができます。しかし AppContainer の機能は Windows 8 からなので、当然 Windows 7 にはありません。では、IE11 on Windows 7 には EPM の設定がないかというと、実は存在します。何これ。

 
![]({{site.assets_url}}2014-10-06-i.png) <br />
EPM setting on Windows 7

 
世の中には同じ疑問を持つ人がいるようで、以下のフォーラムに答えがありました。どうやらこの設定は、タブ プロセスを 64bit にするための設定のようです。AppContainer とは関係がありません。そして 32bit OS だとただの飾りになるようです。うーんIE の世界は深淵すぎる。IE と OS の組み合わせだけでもおかしいのに、設定の組み合わせ数が尋常じゃない。

 
'Enhanced Protected Mode' option missing in IE 11 on Windows - Microsoft Community <br />
[http://answers.microsoft.com/en-us/ie/forum/ie11-windows_7/enhanced-protected-mode-option-missing-in-ie-11-on/320ebe0a-28a1-4707-b944-cf3d1a32aa34](http://answers.microsoft.com/en-us/ie/forum/ie11-windows_7/enhanced-protected-mode-option-missing-in-ie-11-on/320ebe0a-28a1-4707-b944-cf3d1a32aa34)

