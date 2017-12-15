---
layout: post
title: "Custom WebOC in Non-MFC Dialog-Based App"
date: 2015-07-26 11:31:30.000 -07:00
categories:
- C/C++
- Windows
tags:
- COM
- mshtml
- weboc
---

WebOC と呼ばれる ActiveX コントロールを使うと、IE が利用している HTML レンダリング エンジン (Trident; mshtml.dll) を、IE 以外のアプリケーションからも利用することができます。余談ですが、[このページ](http://www.microsoft.com/en-pk/download/details.aspx?id=21016)に、"Web Browser ActiveX control (WebOC)" と書かれていますが、どう略したら WebOC になるのか謎です。Web Browser OLE Control の略じゃないのか、と思っていますが真相は不明です。

 
MFC を使うと、あまりコードを書かなくても、ダイアログ ベースのアプリケーションに WebOC を追加できます。MSDN にある以下のサンプルが分かりやすいです。この情報は、VC++6.0/IE4 時代に書かれたようですが、今でも問題なく動きます。

 
Using MFC to Host a WebBrowser Control (Internet Explorer) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/aa752046(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/aa752046(v=vs.85).aspx)

 
ほぼ MSDN 通りに書いた MFC アプリがこれ。Visual Studio 2012/IE11 の環境で動きました。

 
[https://github.com/msmania/miniweboc](https://github.com/msmania/miniweboc)

 
宗教上の理由で MFC が使えない場合でも、書くコードは増えますが、WebOC は利用可能です。今の時代、WebOC を使う人が早々いないので、サンプルを探すのに苦労しましたが、いろいろと切り貼りして、こんなコードを書いてみました。ダイアログ ベースの非 MFC ネイティブ アプリケーションで WebOC を使う例です。

 
[https://github.com/msmania/minibrowser](https://github.com/msmania/minibrowser)

 
なお、単に HTML コンテンツを表示するダイアログを表示させたいときは、mshtml.dll がエクスポートしている ShowHTMLDialog 関数を呼ぶ方法もあります。ただし、WebOC を使う場合と比べると、できることは限られます。

 
ShowHTMLDialog function (Internet Explorer) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/aa741858(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/aa741858(v=vs.85).aspx)

 
例えば WebOC では、IDocHostUIHandler::GetExternal を独自実装することで、ホストしているページの DOM ツリーを拡張して、JavaScript から window.external オブジェクト経由で C++ の処理を実行できるようにしています。

 
サンプルを書くにあたって、以下のサイトを参考にしました。

 
How to disable the default pop-up menu for CHtmlView in Visual C++ <br />
[https://support.microsoft.com/en-us/kb/236312](https://support.microsoft.com/en-us/kb/236312) <br />
----&gt; MFC を使っている場合で、IDocHostUIHandler を独自実装するサンプル

 
Use an ActiveX control in your Win32 Project without MFC with CreateWindowEx or in a dialog box - CodeProject <br />
[http://www.codeproject.com/Articles/18417/Use-an-ActiveX-control-in-your-Win-Project-witho](http://www.codeproject.com/Articles/18417/Use-an-ActiveX-control-in-your-Win-Project-witho) <br />
----&gt; 非 MFC のダイアログ ベースのアプリケーションから WebOC を使うサンプル

 
WebBrowser Customization (Internet Explorer) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/aa770041(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/aa770041(v=vs.85).aspx) <br />
----&gt; WebOC リファレンス。

 
IDocHostUIHandler interface (Windows) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/aa753260(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/aa753260(v=vs.85).aspx) <br />
----&gt; IDocHostUIHandler インターフェース リファレンス。

 
プログラムにおける主要なポイントは以下の通り。

 
1. ダイアログ リソース上で、適当なコントロール クラス名を指定してカスタム コントロールを配置。 <br />
サンプルでは "MINIHOST" という名前を指定。
1. カスタム コントロールが WM_CREATE メッセージを処理する際の初期化コードにおいて、WebOC オブジェクトを紐付けた OLE オブジェクトをコントロール ウィンドウに登録
1. OLE オブジェクトの IDocHostUIHandler::GetExternal が呼ばれたときに、独自実装した IDispatch のオブジェクトを返すように実装
1. IDispatch::GetIDsOfNames と IDispatch::Invoke を実装

 
3. と 4. は window.external の実装で、上述の KB236312 に書いてある内容です。最大のポイントは 2. で、以下 2 つのメソッドを実行して WebOC をダイアログ上のカスタム コントロールに登録します。

 
IOleObject::SetClientSite method (COM) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/ms684013(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/ms684013(v=vs.85).aspx) <br />
----&gt; WebOC のオブジェクトを CoCreateInstance で作成し、"サイト" として IOleObject を実装したコンテナー オブジェクトに登録

 
IOleObject::DoVerb method (COM) <br />
[https://msdn.microsoft.com/en-us/library/windows/desktop/ms694508(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/windows/desktop/ms694508(v=vs.85).aspx) <br />
----&gt; OLE オブジェクトを、ウィンドウ上で有効化

 
WebOC のコンテナーとなる OLE オブジェクトは SetWindowLongPtr を使ってウィンドウ ハンドルに紐づけました。これは必須ではなく、例えばグローバル変数として保存しておくだけでもいいですが、SetWindowLongPtr を使う方法が一般的だと思います。

 
WebOC に限らず COM オブジェクト全般におけるポイントですが、参照カウントを使ってオブジェクトの確保/解放を管理しないといけません。まず、参照カウンターとなるメンバー変数を適当に定義し、IUnknown::AddRef と IUnknown::Release の中でインクリメント/デクリメントする処理を書きます。

 
単に ++ と -- を使うだけでも動きますが、マルチ スレッド環境を考慮して InterlockedIncrement/InterlockedDecrement を使うのが一般的です。

 
```
STDMETHODIMP_(ULONG) MiniBrowserSite::AddRef(void) { 
    return InterlockedIncrement(&_ulRefs); 
}

STDMETHODIMP_(ULONG) MiniBrowserSite::Release(void) { 
    ULONG cref = (ULONG)InterlockedDecrement(&_ulRefs); 
    if (cref > 0) { 
        return cref; 
    } 
    delete this; 
    return 0; 
} 
```
 
オブジェクトの作成は、new 演算子を使いますが、ポインターを SetWindowLongPtr で登録するときに、AddRef() を自分で呼び出して参照カウントを増やさないといけません。さらに、WM_DESTROY でオブジェクトを破棄するときには、delete 演算子で直接オブジェクトを解放するのではなく、Release() を使って、参照カウントを減らすだけにしておきます。

 
```
case WM_CREATE: 
    BrowserSite = new MiniBrowserSite(h); 
    if (BrowserSite == nullptr || FAILED(BrowserSite->InPlaceActivate())) { 
        if (BrowserSite) 
            delete BrowserSite;

        return -1; 
    }

    SetWindowLongPtr(h, GWLP_USERDATA, (LONG_PTR)BrowserSite); 
    BrowserSite->AddRef(); 
    break;

case WM_DESTROY: 
    BrowserSite = (MiniBrowserSite*)GetWindowLongPtr(h, GWLP_USERDATA); 
    if (BrowserSite) { 
        BrowserSite->Cleanup(); 
        BrowserSite->Release(); // do not 'delete BrowserSite' directly 
    } 
    break;
```
 
WebOC のコンテナーとなる OLE オブジェクトの参照カウントは、IWebBrowser2::Navigate などの WebOC に対する操作を行ったときに、mshtml.dll 内部で頻繁に変更されます。これは、mshtml.dll 内部でもオブジェクトへのポインターが複数個所に保存されていることが予想されるためで、勝手にアプリケーションから delete してしまうと、mshtml.dll 内部のポインターが Use-After-Free を誘発する可能性があります。また、WM_CREATE で AddRef を忘れると、逆に WM_DESTROY で deleete を実行するときに double free でクラッシュする可能性があります。

 
minibrowser!MiniBrowserSite::Release にブレークポイントを置いてスタックを見てみると、Navigate を呼ぶだけで 20 回以上はヒットします。その中の一つを例として以下に示します。スタックの中に ieframe!CWebBrowserOC::Navigate が含まれていない代わりに、jscript9 の処理が見えます。

 
```
Child-SP          RetAddr           Call Site 
00000000`002be298 000007fe`f10647ab minibrowser!MiniBrowserSite::Release 
00000000`002be2a0 000007fe`f13ce7f5 ieframe!IUnknown_SafeReleaseAndNullPtr<IACList>+0x2b 
00000000`002be2d0 000007fe`f13cdcd8 ieframe!CIEFrameAuto::_GetParentFramePrivate+0xc5 
00000000`002be320 000007fe`f142cfbe ieframe!CIEFrameAuto::GetParentFrame+0x18 
00000000`002be360 000007fe`f12d34cf ieframe!CWebBrowserSB::QueryService+0x13e 
00000000`002be3a0 000007fe`ff101c82 ieframe!CIEFrameAuto::QueryService+0x10d4df 
00000000`002be3d0 000007fe`f11c6105 SHLWAPI!IUnknown_QueryService+0x5a 
00000000`002be430 000007fe`f10db378 ieframe!GetTopWBConnectionPoints+0x52 
00000000`002be480 000007fe`f10db323 ieframe!FireEvent_BeforeScriptExecute+0x38 
00000000`002be4e0 000007fe`ea00faf3 ieframe!CBaseBrowser2::FireBeforeScriptExecute+0x33 
00000000`002be510 000007fe`ea00f9e7 mshtml!CWebOCEvents::BeforeScriptExecute+0xf3 
00000000`002be590 000007fe`e9d72a88 mshtml!CScriptCollection::FireFirstScriptExecutionEvent+0xa0 
00000000`002be5d0 000007fe`e7b4aee1 mshtml!CActiveScriptHolder::OnEnterScript+0xaa 
00000000`002be600 000007fe`e7b4ae17 jscript9!ScriptEngine::OnEnterScript+0xbd 
00000000`002be660 000007fe`e7b4ade4 jscript9!ScriptSite::ScriptStartEventHandler+0x27 
00000000`002be690 000007fe`e7b4b075 jscript9!Js::ScriptContext::OnScriptStart+0x7d 
00000000`002be6d0 000007fe`e7b4acc7 jscript9!Js::JavascriptFunction::CallRootFunction+0xc5 
00000000`002be7b0 000007fe`e7b4ac1c jscript9!ScriptSite::CallRootFunction+0x63 
00000000`002be810 000007fe`e7bd1346 jscript9!ScriptSite::Execute+0x122 
00000000`002be8a0 000007fe`e7bd080d jscript9!ScriptEngine::ExecutePendingScripts+0x208 
00000000`002be990 000007fe`e7bd1fb4 jscript9!ScriptEngine::ParseScriptTextCore+0x4a5 
00000000`002beaf0 000007fe`ea00f6e1 jscript9!ScriptEngine::ParseScriptText+0xc4 
00000000`002beba0 000007fe`ea00df0b mshtml!CActiveScriptHolder::ParseScriptText+0xc1 
00000000`002bec20 000007fe`ea00db91 mshtml!CJScript9Holder::ParseScriptText+0xf7 
00000000`002becd0 000007fe`ea00ef9d mshtml!CScriptCollection::ParseScriptText+0x28c 
00000000`002bedb0 000007fe`ea00e9ae mshtml!CScriptData::CommitCode+0x3d9 
00000000`002bef80 000007fe`ea00e731 mshtml!CScriptData::Execute+0x283 
00000000`002bf040 000007fe`ea58fb75 mshtml!CHtmScriptParseCtx::Execute+0x101 
00000000`002bf080 000007fe`e9d7db8d mshtml!CHtmParseBase::Execute+0x241 
00000000`002bf170 000007fe`e9ff8e1f mshtml!CHtmPost::Exec+0x534 
00000000`002bf380 000007fe`e9ff8d70 mshtml!CHtmPost::Run+0x3f 
00000000`002bf3b0 000007fe`e9ffa6f8 mshtml!PostManExecute+0x70 
00000000`002bf430 000007fe`e9ffe0c3 mshtml!PostManResume+0xa1 
00000000`002bf470 000007fe`e9d54917 mshtml!CHtmPost::OnDwnChanCallback+0x43 
00000000`002bf4c0 000007fe`e9c9295c mshtml!CDwnChan::OnMethodCall+0x41 
00000000`002bf4f0 000007fe`e9c8aa74 mshtml!GlobalWndOnMethodCall+0x246 
00000000`002bf590 00000000`77269bd1 mshtml!GlobalWndProc+0x186 
00000000`002bf620 00000000`772698da USER32!UserCallWinProcCheckWow+0x1ad 
00000000`002bf6e0 00000000`77274c1f USER32!DispatchMessageWorker+0x3b5 
00000000`002bf760 00000000`77274edd USER32!DialogBox2+0x1b2 
00000000`002bf7f0 00000000`77274f52 USER32!InternalDialogBox+0x135 
00000000`002bf850 00000000`7726d476 USER32!DialogBoxIndirectParamAorW+0x58 
00000000`002bf890 00000001`3f141fe4 USER32!DialogBoxParamW+0x66 
00000000`002bf8d0 00000001`3f142ec4 minibrowser!wWinMain+0x94 
00000000`002bf960 00000000`771459cd minibrowser!__tmainCRTStartup+0x148 
00000000`002bf9a0 00000000`7737b981 kernel32!BaseThreadInitThunk+0xd 
00000000`002bf9d0 00000000`00000000 ntdll!RtlUserThreadStart+0x1d 
```
 
参照カウントの処理が意図通りに動作しているかどうかを確認する方法として、Application Verifier でメモリのフラグを有効にして動作確認を行う方法があります。ただし Application Verifier は、モジュールが解放されるときにリークしているメモリを検出するので、モジュールのアンロードを行なわずにいきなりプロセスが終了するプログラムだと、メモリ リークを検出できません。

 
![]({{site.assets_url}}2015-07-26-image.png)

 
このような場合、クラスのデストラクターが呼ばれるかどうかをデバッガーから確認するの方法が確実です。ただし、今回のサンプル プログラムのようにデストラクターが空の場合、minibrowser!MiniBrowserSite::~MiniBrowserSite や minibrowser!CExternalDispatch::~CExternalDispatch にはヒットしないので注意が必要です。(最適化しないでコンパイルすれば使えるかも・・)

 
Release() から delete 演算子を呼んでいるところで止めて、そのシンボルを見ると、minibrowser!MiniBrowserSite::`scalar deleting destructor' という不思議な関数が呼ばれています。

 
```
0:002> uf 00000001`3f801c80 
minibrowser!MiniBrowserSite::Release: 
00000001`3f801c80 4883ec28        sub     rsp,28h 
00000001`3f801c84 83c8ff          or      eax,0FFFFFFFFh 
00000001`3f801c87 f00fc14118      lock xadd dword ptr [rcx+18h],eax 
00000001`3f801c8c ffc8            dec     eax 
00000001`3f801c8e 7512            jne     minibrowser!MiniBrowserSite::Release+0x22 (00000001`3f801ca2)

minibrowser!MiniBrowserSite::Release+0x10: 
00000001`3f801c90 4885c9          test    rcx,rcx 
00000001`3f801c93 740b            je      minibrowser!MiniBrowserSite::Release+0x20 (00000001`3f801ca0)

minibrowser!MiniBrowserSite::Release+0x15: 
00000001`3f801c95 488b01          mov     rax,qword ptr [rcx] 
00000001`3f801c98 ba01000000      mov     edx,1 
00000001`3f801c9d ff5048          call    qword ptr [rax+48h]

minibrowser!MiniBrowserSite::Release+0x20: 
00000001`3f801ca0 33c0            xor     eax,eax

minibrowser!MiniBrowserSite::Release+0x22: 
00000001`3f801ca2 4883c428        add     rsp,28h 
00000001`3f801ca6 c3              ret

0:002> bp 00000001`3f801c9d 
0:002> g 
Breakpoint 2 hit 
minibrowser!MiniBrowserSite::Release+0x1d: 
00000001`3f801c9d ff5048          call    qword ptr [rax+48h] ds:00000001`3f820a20={minibrowser!Mini 
BrowserSite::`scalar deleting destructor' (00000001`3f8013a0)} 
0:000> ln poi(rax+48) 
(00000001`3f8013a0)   minibrowser!MiniBrowserSite::`scalar deleting destructor'   |  (00000001`3f801420)   minibrowser!CExternalDispatch::AddRef 
Exact matches: 
    minibrowser!MiniBrowserSite::`scalar deleting destructor' (void) 
0:000> 
```
 
そこで、この `scalar deleting destructor' という関数にブレークポイントを置いてダイアログを閉じたときの動作を見ると、コンテナー OLE オブジェクトも IDispatch オブジェクトも解放されていることが確認できました。

 
```
0:000> k 
Child-SP          RetAddr           Call Site 
00000000`0024efc8 00000001`3fd21c70 minibrowser!CExternalDispatch::`scalar deleting destructor' 
00000000`0024efd0 00000001`3fd213ec minibrowser!CExternalDispatch::Release+0x20 
00000000`0024f000 00000001`3fd21ca0 minibrowser!MiniBrowserSite::`scalar deleting destructor'+0x4c 
00000000`0024f040 00000001`3fd219be minibrowser!MiniBrowserSite::Release+0x20 
00000000`0024f070 00000000`77269bd1 minibrowser!MiniBrowserSite::MiniHostProc+0xee 
00000000`0024f500 00000000`772672cb USER32!UserCallWinProcCheckWow+0x1ad 
00000000`0024f5c0 00000000`77266829 USER32!DispatchClientMessage+0xc3 
00000000`0024f620 00000000`7739dae5 USER32!_fnDWORD+0x2d 
00000000`0024f680 00000000`7725cbfa ntdll!KiUserCallbackDispatcherContinue 
00000000`0024f708 00000000`7727505b USER32!ZwUserDestroyWindow+0xa 
00000000`0024f710 00000000`77274edd USER32!DialogBox2+0x2ec 
00000000`0024f7a0 00000000`77274f52 USER32!InternalDialogBox+0x135 
00000000`0024f800 00000000`7726d476 USER32!DialogBoxIndirectParamAorW+0x58 
00000000`0024f840 00000001`3fd21fe4 USER32!DialogBoxParamW+0x66 
00000000`0024f880 00000001`3fd22ec4 minibrowser!wWinMain+0x94 
00000000`0024f910 00000000`771459cd minibrowser!__tmainCRTStartup+0x148 
00000000`0024f950 00000000`7737b981 kernel32!BaseThreadInitThunk+0xd 
00000000`0024f980 00000000`00000000 ntdll!RtlUserThreadStart+0x1d
```
 
`scalar deleting destructor' を始め、COM オブジェクトのデバッガーからの見え方については次回ってことで。

