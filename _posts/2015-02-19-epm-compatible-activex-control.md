---
layout: post
title: "EPM-compatible ActiveX control"
date: 2015-02-19 16:55:18.000 -08:00
categories:
- Security
- Windows
tags:
- ActiveX
- EPM
---

ちょっとした小ネタを。以前、MFC ベースの ActiveX コントロールを Visual Studio で作る方法を書きましたが、それに対する補足です。

 
MFC Custom ActiveX Control on IE11 | すなのかたまり <br />
[https://msmania.wordpress.com/2014/10/06/mfc-custom-activex-control-on-ie11/](https://msmania.wordpress.com/2014/10/06/mfc-custom-activex-control-on-ie11/)

 
上記記事で作った ActiveX コントロールは、Protected Mode が有効であるゾーン、すなわち Low Integrity Level のプロセスでも動作させることができますが、Enhanced Protected Mode (EPM)、すなわち AppContainer のプロセスでは動きません。EPM を有効にしてページを開くと、以下のようなポップアップが表示されます。

 
![]({{site.assets_url}}2015-02-19-image.png)

 
```
This webpage wants to run '(ActiveX control name)' which isn't compatible with Internet Explorer's enhanced security features. If you trust this site, you can disable Enhanced Protected Mode for this site and allow the control to run.
```
 
ここで Run Control を選ぶと ActiveX が使えるようになります。が、これは現在のサイトに対してのみ EPM を無効にしたためであり、 Protected Mode でページを開いているからです。この機能、すなわち、サイト レベルで EPM のオン/オフを切り替える機能に UI はなく、サイト名と同じ名前のレジストリが HKEY_CURRENT_USER\Software\Microsoft\Internet Explorer\TabProcConfig の下に作られることで実現されています。この機能については、以下のブログで触れられています。

 
How Internet Explorer Enhanced Protected Mode (EPM) is enabled under different configurations - AsiaTech: Microsoft APGC Internet Developer Support Team - Site Home - MSDN Blogs <br />
[http://blogs.msdn.com/b/asiatech/archive/2013/12/25/how-internet-explorer-enhanced-protected-mode-epm-is-enabled-under-different-configurations.aspx](http://blogs.msdn.com/b/asiatech/archive/2013/12/25/how-internet-explorer-enhanced-protected-mode-epm-is-enabled-under-different-configurations.aspx)

 
```
This per domain configuration is located in registry, path HKEY_CURRENT_USER\Software\Microsoft\Internet Explorer\TabProcConfig. As shown in the screenshot below. Each domain is configured by a DWORD value. Different DWORD values have different effects on EPM. The most common value is 0x47b, which means to use 32bit process & load incompatible add-ons. If a domain is given that 0x47b value, you will see protected mode as “On”, not “Enhanced”.
```
 
一度 Run Control をクリックしてしまうと、元に戻すにはレジストリを削除するしかなさそうです。

 
TabProcConfig の助けを借りなくても、ActiveX コントロールに EPM に対する互換性を持たせることができます。その方法が以下の MSDN のページに書かれている、と思いきや実は書かれていません。

 
Supporting enhanced protected mode (EPM) (Windows) <br />
[https://msdn.microsoft.com/en-us/library/ie/dn519894(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/ie/dn519894(v=vs.85).aspx)

 
この GUID で定義されるカテゴリを使ってコントロールを登録しろと書かれていますが、肝心な方法が書かれていません。DEFINE_GUID で定数を定義するコードは載っていますが、欲しいのはそれじゃない。

 
```
Register the ActiveX control as one that is compatible with AppContainers. To do this, you register your control with the CAT_ID AppContainerCompatible ({59fb2056-d625-48d0-a944-1a85b5ab2640})
```
 
具体的なコードは Stack Overflow で見つかりました。ActiveX コントロールそのものではなく、regsvr32 でコントロールを登録するときに、カテゴリの GUID も登録する必要があるみたいです。

 
internet explorer - IE BHO Toolbar in EPM (Enhanced Protected Mode) - Stack Overflow <br />
[http://stackoverflow.com/questions/17591740/ie-bho-toolbar-in-epm-enhanced-protected-mode](http://stackoverflow.com/questions/17591740/ie-bho-toolbar-in-epm-enhanced-protected-mode)

 
というわけで、Visual Studio のテンプレートが自動的に生成した 2 つの関数 DllRegisterServer と DllUnregisterServer を以下のように変更します。必要かどうか分かりませんが、念のため Unregister も変更しておきます。コントロールの GUID である CLSID_RunMeOnIE は、環境によって異なるので注意してください。

 
全体のコードについては、こちらをご確認ください。 <br />
[https://github.com/msmania/RunMeOnIE](https://github.com/msmania/RunMeOnIE)

 
```
const GUID CDECL CATID_AppContainerCompatible = 
{ 0x59fb2056, 0xd625, 0x48d0, { 0xa9, 0x44, 0x1a, 0x85, 0xb5, 0xab, 0x26, 0x40 } }; 
const GUID CDECL CLSID_RunMeOnIE = 
{ 0x5C630378, 0xA070, 0x42A6, { 0xBF, 0xD5, 0xC7, 0x46, 0xF7, 0xDC, 0xAA, 0xCC } }; 


HRESULT RegiterClassWithCategory(CLSID ClassId, CATID CategoryId, bool IsRegister = true) { 
    ICatRegister *Registerer = NULL; 
    HRESULT hr = S_OK;

    hr = CoCreateInstance(CLSID_StdComponentCategoriesMgr, 
        NULL, 
        CLSCTX_INPROC_SERVER, 
        IID_ICatRegister, 
        (LPVOID*)&Registerer);

    if (SUCCEEDED(hr)) { 
        if (IsRegister) { 
            hr = Registerer->RegisterClassImplCategories(ClassId, 1, &CategoryId); 
        } 
        else { 
            hr = Registerer->UnRegisterClassImplCategories(ClassId, 1, &CategoryId); 
        }

        Registerer->Release(); 
    }

    return hr; 
}

// DllRegisterServer - Adds entries to the system registry

STDAPI DllRegisterServer(void) 
{ 
    AFX_MANAGE_STATE(_afxModuleAddrThis);

    if (!AfxOleRegisterTypeLib(AfxGetInstanceHandle(), _tlid)) 
        return ResultFromScode(SELFREG_E_TYPELIB);

    if (!COleObjectFactoryEx::UpdateRegistryAll(TRUE)) 
        return ResultFromScode(SELFREG_E_CLASS);

    RegiterClassWithCategory(CLSID_RunMeOnIE, CATID_AppContainerCompatible);

    return NOERROR; 
}

// DllUnregisterServer - Removes entries from the system registry

STDAPI DllUnregisterServer(void) 
{ 
    AFX_MANAGE_STATE(_afxModuleAddrThis);

    if (!AfxOleUnregisterTypeLib(_tlid, _wVerMajor, _wVerMinor)) 
        return ResultFromScode(SELFREG_E_TYPELIB);

    if (!COleObjectFactoryEx::UpdateRegistryAll(FALSE)) 
        return ResultFromScode(SELFREG_E_CLASS);

    RegiterClassWithCategory(CLSID_RunMeOnIE, CATID_AppContainerCompatible, false);

    return NOERROR; 
} 
```
 
ocx をビルドし直し、regsvr32 で再登録してからレジストリを見ると、HKCR\CLSID\{GUID} の下に Implemented Categories というキーがあり、CAT_ID AppContainerCompatible のキーが追加されています。

 
![]({{site.assets_url}}2015-02-19-image1.png)

 
しかし、これではまだ EPM のページで ActiveX を実行することはできません。AppContainer プロセスは、読み取り権限も厳しく制限されており、通常の作業フォルダーにもアクセスできないからです。例えばデスクトップへもアクセス権はありません。

 
アクセス権のあるフォルダーの一つとして、C:\Program Files フォルダーがあります。C:\Program Files 配下に適当なフォルダーを作って ocx をコピーし、再度 regsvr32 で登録し直すことで、ようやく EPM で ActiveX を動かすことができるようになります。

 
ここまでの話はデスクトップ IE における EPM であり、同じく AppContainer で動作する Immersive IE については、上記の方法を使っても ActiveX コントロールを動かすことはできません。そもそも Immersive IE は、プラグイン フリーのブラウジングを目的としているためです。

 
Get ready for plug-in free browsing (Internet Explorer) <br />
[https://msdn.microsoft.com/en-us/library/ie/hh968248(v=vs.85).aspx](https://msdn.microsoft.com/en-us/library/ie/hh968248(v=vs.85).aspx)

