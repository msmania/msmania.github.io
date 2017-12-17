---
layout: post
title: "[Win32] [COM] VDS Object Enumeration"
date: 2012-03-03 14:02:49.000 +09:00
categories:
- C/C++
- Windows
tags:
- COM
- IVdsDisk
- IVdsService
- IVdsVolume
- VDS
---

NTFS、パーティション マネジメントあたりがマイブームなので、VDS の COM インターフェースを使って各種オブジェクトを列挙するプログラムを書いてみた。

 
サンプルはこのへん。

 
Loading VDS (Windows) <br />
[http://msdn.microsoft.com/en-us/library/aa383037.aspx](http://msdn.microsoft.com/en-us/library/aa383037.aspx)

 
Working with Enumeration Objects (Windows) <br />
[http://msdn.microsoft.com/en-us/library/aa383988.aspx](http://msdn.microsoft.com/en-us/library/aa383988.aspx)

 
コードは下に貼りますが、特に捻りもない普通のコードです。 <br />
ConsumeVDS で IVdsService インターフェースを取得して、EnumVdsObjects でソフトウェア プロバイダーの,インターフェース (IVdsPack) を取得して EnumVdsVolumes, EnumVdsDisks でそれぞれボリュームとディスクを列挙。 <br />
Dump***Prop 関数は、GetProperties で取ってきた構造体をパースして表示しているだけなので省略。

 
そう言えば、衝撃の事実が上記 MSDN ページに。 <br />
VDS とダイナミック ディスクは星になるようです。

 
> [Both the Virtual Disk Service and dynamic disks are deprecated as of Windows 8 Consumer Preview and Windows Server 8 Beta, and may be unavailable in subsequent versions of Windows. For more information, see Windows Storage Management API.]
 
VDS サービスはスタートアップ種別が手動であり、IVdsVolume インターフェースを取得するため、IVdsServiceLoader::LoadService を呼んだときに起動され、インターフェースを破棄するとサービスが停止します。このデザインはパフォーマンス的にあまりよくない気がします。

 
そんなこんなでソース。

 
```
// 
// vds.cpp 
// 
// http://msdn.microsoft.com/en-us/library/aa383037.aspx 
// http://msdn.microsoft.com/en-us/library/aa383988.aspx 
//

#include <initguid.h> 
#include <vds.h> 
#include <stdio.h>

#pragma comment( lib, "rpcrt4.lib" )

void Logging(LPCWSTR fmt, DWORD err) { 
    //SYSTEMTIME st; 
    //GetSystemTime(&st); 
    //wprintf(L"[%d/%02d/%02d %02d:%02d:%02d.%03d] ", 
    //    st.wYear, 
    //    st.wMonth, 
    //    st.wDay, 
    //    st.wHour, 
    //    st.wMinute, 
    //    st.wSecond, 
    //    st.wMilliseconds);

    wprintf(fmt, err); 
}

#define GET_LODWORD(ll) (((PLARGE_INTEGER)&ll)->LowPart) 
#define GET_HIDWORD(ll) (((PLARGE_INTEGER)&ll)->HighPart) 


void EnumVdsVolumes(IVdsPack *VdsPack) { 
    HRESULT Ret; 
    ULONG Fetched= 0; 
    IUnknown *Unknown= NULL; 
    IEnumVdsObject *EnumVolumes= NULL;

    Ret= VdsPack->QueryVolumes(&EnumVolumes); 
    if ( FAILED(Ret) ) { 
        Logging(L"IVdsPack::QueryVolumes failed - 0x%08x\n", Ret); 
        goto cleanup; 
    }

    do { 
        IVdsVolume *Volume= NULL; 
        IVdsVolumeMF *VolumeMF= NULL; 
                
        VDS_VOLUME_PROP PropVol; 
        VDS_FILE_SYSTEM_PROP PropFs;

        Ret= EnumVolumes->Next(1, &Unknown, &Fetched); 
        if ( Ret==S_FALSE ) break; 
        if ( FAILED(Ret) ) goto cleanup;

        Ret= Unknown->QueryInterface(IID_IVdsVolume, (void**)&Volume); 
        Unknown->Release(); 
        if ( FAILED(Ret) ) { 
            Logging(L"IID_IVdsVolume::QueryInterface failed - 0x%08x\n", 
              Ret); 
            continue; 
        }

        Ret= Volume->GetProperties(&PropVol); 
        if ( Ret==S_OK || Ret==VDS_S_PROPERTIES_INCOMPLETE ) 
            DumpVolumeProp(&PropVol); 
        if ( Ret==VDS_S_PROPERTIES_INCOMPLETE ) 
            wprintf(L"      ** IID_IVdsVolume::GetProperties returned VDS_S_PROPERTIES_INCOMPLETE(0x%08x)\n\n", VDS_S_PROPERTIES_INCOMPLETE); 
        else if ( FAILED(Ret) ) 
            Logging(L"IID_IVdsVolume::GetProperties failed - 0x%08x\n", Ret);

        Ret= Volume->QueryInterface(IID_IVdsVolumeMF, (void**)&VolumeMF); 
        Volume->Release(); 
        if ( Ret!=S_OK ) 
            Logging(L"IID_IVdsVolumeMF::QueryInterface failed - 0x%08x\n", 
              Ret);

        Ret= VolumeMF->GetFileSystemProperties(&PropFs); 
        if ( Ret==VDS_E_NO_MEDIA ) 
            wprintf(L"      ** IID_IVdsVolumeMF::GetProperties returned VDS_E_NO_MEDIA(0x%08x)\n\n", VDS_E_NO_MEDIA); 
        else if ( FAILED(Ret) ) 
            Logging(L"IID_IVdsVolumeMF::GetFileSystemProperties failed - 0x%08x\n", Ret); 
        else 
            DumpFileSystemProp(&PropFs);

    } while(1); 
    
cleanup: 
    if ( EnumVolumes ) 
        EnumVolumes->Release();

    return; 
}

void EnumVdsDisks(IVdsPack *VdsPack) { 
    HRESULT Ret; 
    ULONG Fetched= 0; 
    IUnknown *Unknown= NULL; 
    IEnumVdsObject *EnumDisks= NULL;

    Ret= VdsPack->QueryDisks(&EnumDisks); 
    if ( FAILED(Ret) ) { 
        Logging(L"IVdsPack::QueryDisks failed - 0x%08x\n", Ret); 
        goto cleanup; 
    }

    do { 
        IVdsDisk *Disk= NULL; 
        VDS_DISK_PROP DiskProp;

        Ret= EnumDisks->Next(1, &Unknown, &Fetched); 
        if ( Ret==S_FALSE ) break; 
        if ( FAILED(Ret) ) goto cleanup;

        Ret= Unknown->QueryInterface(IID_IVdsDisk, (void**)&Disk); 
        Unknown->Release(); 
        if ( FAILED(Ret) ) continue;

        Ret= Disk->GetProperties(&DiskProp); 
        if ( FAILED(Ret) ) 
            Logging(L"IID_IVdsDisk::GetProperties failed - 0x%08x\n", Ret); 
        else 
            DumpDiskProp(&DiskProp);

    } while (1);

cleanup: 
    if ( EnumDisks ) 
        EnumDisks->Release();

    return; 
}

void EnumVdsObjects(IVdsService *VdsService) { 
    HRESULT Ret;

    ULONG Fetched= 0; 
    IEnumVdsObject *EnumSwProviders= NULL; 
    IEnumVdsObject *EnumPacks= NULL; 
    IUnknown *Unknown= NULL;

    IVdsProvider *Provider= NULL; 
    IVdsSwProvider *SwProvider= NULL; 
    IVdsPack *VdsPack= NULL;

    VDS_PROVIDER_PROP ProviderProp; 
    VDS_PACK_PROP PackProp;

    Ret= VdsService->QueryProviders(VDS_QUERY_SOFTWARE_PROVIDERS, 
      &EnumSwProviders); 
    if ( Ret!=S_OK ) { 
        Logging(L"IVdsService::QueryProviders failed - 0x%08x\n", Ret); 
        return; 
    }

    do { 
        Ret= EnumSwProviders->Next(1, &Unknown, &Fetched); 
        if ( Ret==S_FALSE ) break; 
        if ( FAILED(Ret) ) goto cleanup;

        Ret= Unknown->QueryInterface(IID_IVdsProvider, (void**)&Provider); 
        Unknown->Release(); 
        if ( FAILED(Ret) ) continue;

        Ret= Provider->GetProperties(&ProviderProp); 
        if ( FAILED(Ret) ) 
            Logging(L"IID_IVdsProvider::GetProperties failed - 0x%08x\n", 
              Ret); 
        else 
            DumpProviderProp(&ProviderProp);

        Ret= Provider->QueryInterface(IID_IVdsSwProvider, 
          (void**)&SwProvider); 
        Provider->Release(); 
        if ( FAILED(Ret) ) continue;

        Ret= SwProvider->QueryPacks(&EnumPacks); 
        SwProvider->Release(); 
        if ( FAILED(Ret) ) continue;

        do { 
            Ret= EnumPacks->Next(1, &Unknown, &Fetched); 
            if ( Ret==S_FALSE ) break; 
            if ( FAILED(Ret) ) goto cleanup;

            Ret= Unknown->QueryInterface(IID_IVdsPack, (void**)&VdsPack); 
            Unknown->Release(); 
            if ( FAILED(Ret) ) continue;

            Ret= VdsPack->GetProperties(&PackProp); 
            if ( FAILED(Ret) ) 
                Logging(L"IID_IVdsPack::GetProperties failed - %08x\n", Ret); 
            else 
                DumpPackProp(&PackProp); 
            
            EnumVdsDisks(VdsPack); 
            EnumVdsVolumes(VdsPack);

        } while (1);

        EnumPacks->Release(); 
        EnumPacks= NULL;

    } while (1);

cleanup: 
    if ( EnumPacks ) 
        EnumPacks->Release();

    if ( EnumSwProviders ) 
        EnumSwProviders->Release();

    return; 
}

void ConsumeVDS() { 
    HRESULT Ret= 0; 
    IVdsServiceLoader *VdsServiceLoader= NULL; 
    IVdsService *VdsService= NULL; 
    
    Ret = CoInitialize(NULL); 
    if ( Ret!=S_OK ) { 
        Logging(L"CoInitialize failed - 0x%08x\n", Ret); 
        goto cleanup; 
    } 
    
    Ret= CoCreateInstance(CLSID_VdsLoader, 
        NULL, 
        CLSCTX_LOCAL_SERVER, 
        IID_IVdsServiceLoader, 
        (void **) &VdsServiceLoader); 
    if ( Ret!=S_OK ) { 
        Logging(L"CoCreateInstance(IVdsServiceLoader) failed - 0x%08x\n", 
          Ret); 
        goto cleanup; 
    } 
    
    Ret= VdsServiceLoader->LoadService(NULL, &VdsService); 
    VdsServiceLoader->Release(); 
    VdsServiceLoader= NULL; 
    
    if ( Ret!=S_OK ) { 
        Logging(L"IVdsServiceLoader::LoadService failed - 0x%08x\n", Ret); 
        goto cleanup; 
    } 
    
    Ret= VdsService->WaitForServiceReady(); 
    if ( Ret!=S_OK ) { 
        Logging(L"IVdsService::WaitForServiceReady failed - 0x%08x\n", Ret); 
        goto cleanup; 
    } 
    
    EnumVdsObjects(VdsService);

cleanup: 
    if ( VdsService ) 
        VdsService->Release();

    if ( VdsServiceLoader ) 
        VdsServiceLoader->Release();

    CoUninitialize();

    return; 
}
```
