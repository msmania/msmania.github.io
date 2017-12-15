---
layout: post
title: "Windows could not update the computer's boot configuration"
date: 2016-10-23 16:28:36.000 -07:00
categories:
- Debug
- Windows
tags:
- bcdedit
- EFI
- MBR
- NVRAM
- UEFI
---

Windows Server 2016 が GA になったので、週末を利用して、仕事で使っているマシン 2 台の OS を Windows Server 2016 TP5 から RTM に入れ替えたのですが、インストーラーの怪しげな動作でハマったので書いておきます。強引にインストールは終わらせましたが、完全に直っていない上に根本原因が確認できていないので、時間を見つけて調べて追記する予定です。

 
<font color="#0000ff">(2016/10/30 追記</font>) <br />
<font color="#0000ff">最終確認はまだですが、NVRAM へのアクセスが失敗していることが原因っぽいです。</font><font color="#0000ff">（詳細は後述）</font>

 
インストールを行った二台は HP Z420 Workstation と HP Z440 Workstation。前者がメインの開発機で、コードを書いてビルドする以外に、デバッグ用の Hyper-V 仮想マシンを動かしたり、メールを書いたりもします。後者はサブの開発機で、ほぼビルドと仮想マシンのみ。なお Windows 10 ではなく Server 2016 を入れるのは、Universal App などの煩わしい機能が嫌いだからです。サーバー SKU おすすめです。

 
家で使うマシンも仕事のマシンも同じですが、OS の入れ替えでは常にクリーン インストールを行います。インプレースアップグレードはいまいち動作が信用できないのです。

 
作業は、サブ機の Z440 から行いました。これには光学ドライブがないので、USB ドライブで Windows PE を起動して、別の USB ドライブに入れておいた Windows Server 2016 のインストーラー (MSDN からダウンロードした ISO を単にコピーしたもの) である setup.exe を起動して行います。前の OS が入っていたパーティションを消して、新しくパーティションを作って入れるだけです。作業としては普通です。

 
Z440 の作業は何の問題もなかったのですが、同じ USB ドライブを使って Z420 に Server 2016 をインストールしたところ、インストールの最後のフェーズで "Windows could not update the computer's boot configuration. Installation cannot proceed." が出ました。

 
![]({{site.assets_url}}2016-10-23-01-error.png) <br />
じゃじゃーん

 
これけっこう深刻なエラー・・・。メッセージの内容を信用するならば、インストーラーの wim イメージをボリュームにコピーした後、ブート情報を書き換えるところが失敗しているわけす。当然マシンは起動しなくなります。Windows RE も起動できません。ちなみにインストールが失敗したディスクからシステムを起動すると "Your PC/Device needs to be repaired - The Boot Configuration Data file is missing some required information. File: \BCD Error code: 0xc0000034" 画面が出ました。BCD 情報を書けなかったのはお前んところのインストーラーなんだけどな！

 
![]({{site.assets_url}}2016-10-23-02-bcd.png) <br />
起動失敗の図

 
慌てず騒がず、とりあえず以下の作業を順番に試してみました。

 
1. まったく同じ作業 (同じ USB ドライブを使って、同じハードディスク (以降ディスク A) をインストール先として指定) を試す → 現象変わらず 
1. 別のハードディスク (以降ディスク B) を使ってみる → 現象変わらず 
1. ディスク B を diskpart の clear コマンドでクリアしてからインストール → 現象変わらず 

 
おいおい・・。一台目の Z440 で上手くいっていることからして、USB ドライブに問題はないはず。ハードディスク側にも問題があるとは思えない。ぱっと思いつくのは、BIOS/UEFI の起動方式とディスク形式の MBR/GPT。ディスクをクリアしても同じ現象が出る時点でインストーラーのバグくさいが、だとすると Z440 でうまくいった説明がつかない。Z420 も Z440 も UEFI のはずなのに。

 
しばらく悩んだ結果、Z420 と Z440 とで、パーティション構成に唯一の違いがあることに気づきました。Z440 のインストール先ディスクは 150GB なので、まるまる OS 用のパーティションを入れています。一方、Z420 のインストール先ディスク A は 1TB なので、後ろ半分の 500GB はデータ用にして、先頭の 500GB を OS 用にしていました。今回の作業では、前の OS のパーティションだけを消して、インストーラーから新しくパーティションを作り直していました。また、上記作業 2. と 3. の作業でも、インストーラー経由でパーティションを作ってからインストールをしていました。そこで、新しいディスク C を用意して、パーティションを作らず、ディスク全体を指定して OS をインストールしたところ・・・成功。謎は深まるばかり。

 
そしてすぐに次の問題が発生。インストール後に再起動がかかっても、またも "Your PC/Device needs to be repaired" エラーで Windows 起動しない・・・。インストール成功したんじゃなかったのかよ。

 
試行錯誤の末、Boot menu を開いてインストール先のディスクを明示的に選択すれば起動することが判明。これで何が起こっているのかは分かった、気がする。

 
![]({{site.assets_url}}2016-10-23-03-boot.png)

 
Z420 のブート メニュー <br />
(Legacy Boot Sources の WDC WD2500AA.. を選択すれば起動できた)

 
起動がうまくいったあと、以下の情報を確認しました。

 
- ディスク A は GPT 形式になっていて、EFI System Partition は作成されている <br />
→ インストーラーの最後で BCD 情報の書き換えに失敗した理由が不明 
- ディスク B は MBR 形式になっている 
- Z420 の msinfo32 を見ると、BIOS Mode は Legacy 
- Z440 の起動ディスクは GPT 形式 
- Z440 の msinfo32 で、BIOS Mode は UEFI 

 
上記を整理すると・・

 
1. Windows インストーラー、及び OS 本体は Z420 を Legacy BIOS だと思っているので、MBR 形式のディスクを対象にしたインストールを試みる。 
1. しかし、インストーラーの中のパーティションを作る部分では、システムを UEFI と認識しているためか、MBR ではなく GPT 形式でパーティションを作る。 
1. Z420 のブートの順番は、UEFI を試してから各ディスクの MBR を使って起動しようとする。このとき、UEFI の Windows Boot Manager がなぜか中途半端に実行できてしまうため、MBR の実行を試そうとしない。 
1. システムは MBR 形式でインストールされているので当然起動できない。 

 
不可解なのは以下の点。

 
- そもそも最初に試したときに、BCD 情報が更新できなかった理由 <br />
→ 諸悪の根源。これが上手くいっていれば問題はここまで拗れない。 
- インストーラーでパーティションを作るとディスクが GPT になるくせに、実際にシステムをインストールするときは MBR でディスクを切っている。インストーラーがシステムの BIOS モードをチェックするコードが少なくとも二ヶ所あって、一方は Legacy BIOS、他方は UEFI だと認識してしまうっぽい・・？ 

 
確か似たような現象を調べたときに、Windows のインストーラーにはディスクをクリアしてディスク形式を変更する機能がないので、インストーラーは Legacy BIOS のシステムでは GPT 形式のディスクを認識せず、逆に UEFI のシステムでは MBR のディスクを認識しなかった記憶があります。この場合、diskpart などを使ってあらかじめディスク形式を変えておく必要があります。

 
今回の場合は不可解で、GPT と MBR の扱いがかなり混在してしまっている印象がです。そもそもインストーラーやシステムがシステムを Legacy BIOS として認識しているのであれば、GPT で切れたディスクは認識できるべきではないし、インストールが始まる前にエラーになって欲しいものです。イメージのコピーはうまくいって、最後にこけるのは一番タチが悪い。これが Server 2016 のメディアで新しく発生するのか、もっと前の OS のディスクから発生するのかどうかは確かめていません。

 
今のところ、マシンを再起動するたびに boot menu を起動してディスクを選択しないといけない。超不便。

 
<font color="#0000ff">(2016/10/30 追記</font>)

 
まだ最終確認は取れていませんが、どうやら NVRAM への読み書きができないハードウェア障害のような気がしてきました。調べた内容を以下に記します。

 
まず、Windows インストール時のログはインストール先ディスクの $WINDOWS.~BT\Sources\Panther\setupact.log に残っているので、失敗している箇所を確認。

 
![]({{site.assets_url}}2016-10-23-log.png)

 
```
2016-10-22 16:46:58, Info       [0x060228] IBS    Callback_UpdateBootFiles:Successfully updated Windows boot files. 
2016-10-22 16:46:58, Info                  IBSLIB ModifyBootEntriesLegacy: Not in first boot. No actions to perform. SetupPhase[2] 
2016-10-22 16:46:58, Info                  IBSLIB ModifyBootEntriesBCD:Setup phase is [2] 
2016-10-22 16:46:58, Info                  IBSLIB BfsInitializeBcdStore flags(0x00000008) RetainElementData:n DelExistinObject:n 
2016-10-22 16:46:58, Info                  IBSLIB VolumePathName for H:\Windows is H:\ 
2016-10-22 16:46:58, Info                  IBSLIB Opening template from \Device\HarddiskVolume7\Windows\System32\config\BCD-Template. 
2016-10-22 16:46:58, Info                  IBSLIB System BCD store does not exist, creating. 
2016-10-22 16:46:58, Error      [0x064230] IBSLIB Failed to create a new system store. Status = [c0000001] 
2016-10-22 16:46:58, Error      [0x0641b8] IBSLIB ModifyBootEntries: Error modifying bcd boot entries. dwRetCode=[0x1F][gle=0x0000001f] 
2016-10-22 16:46:58, Info       [0x060216] IBS    CallBack_MungeBootEntries:Failed to modify boot entries; GLE = 31 
2016-10-22 16:46:58, Info       [0x0640ae] IBSLIB PublishMessage: Publishing message [Windows could not update the computer's boot configuration. Installation cannot proceed.] 
2016-10-22 16:46:58, Info       [0x0a013d] UI     Accepting Cancel. Exiting Page Progress. 
```
 
やはり BCD の新規作成に失敗している模様。

 
とりあえず BIOS の設定 (Advanced --&gt; Device Options) を確認。もともとはこんな設定だった。後で触れるがこの時点でちょっと変。

 
![]({{site.assets_url}}2016-10-23-bios01.png)

 
とりあえず Option ROM を Legacy から EFI に変えて試してみる。

 
![]({{site.assets_url}}2016-10-23-bios021.png)

 
なお、ここで Video Options ROMS を EFI に変えてはいけない。間違って変えてしまうと、ビープ音が 6 回鳴ってシステムが起動しない悲しい状態になります。

 
Advisory: HP Z1, Z220, Z420, Z620, Z820 Workstation - 6 Beeps After Changing BIOS Settings <br />
[http://h20564.www2.hp.com/hpsc/doc/public/display?docId=emr_na-c04045903](http://h20564.www2.hp.com/hpsc/doc/public/display?docId=emr_na-c04045903)

 
お決まりだが、見事にこの罠を踏んでしまったのだ。上記 Resolution にあるように、CMOS リセットを行って無事復活。PXE Option ROMS と Mass Storage Option ROMS だけを EFI にして再起動。そして同様にインストーラーを動かすが、状況は変わらず、結局 "Windows could not update the computer's boot configuration. Installation cannot proceed." で失敗する。

 
埒が明かなくなってきたので、真面目に setup.exe をデバッグしてみることに。最近の Windows PE では NIC の標準ドライバーが入っているので TCP/IP ネットワークで簡単にユーザーモードのリモート デバッグができます。Windows PE 起動後に以下のコマンドを実行すると、ネットワークが有効になるので dbgsrv.exe を起動できます。

 
```
> wpeutil initializenetwork 
> wpeutil disablefirewall 
```
 
詳細は省きますが、問題となっているインストーラーの最終フェーズでは、まず空の BCD を作ってから、インストール イメージ内にある windows\system32\config\BCD-Template と NVRAM の状態を元に BCD にデータを入れていくようなことをやっているようです。空の BCD を作るところは問題なく成功して、NVRAM の内容を取ってくると思われるシステム コールから c0000001 が返ってきていました。カーネル デバッグまではやっていないので、カーネルの中で何が失敗しているのかはまだ不明のままです。

 
NVRAM がおかしいとすると、Option ROM が Legacy 設定だったにも関わらず "Your PC/Device needs to be repaired - The Boot Configuration Data file is missing some required information. File: \BCD Error code: 0xc0000034" が出る理由も分かるような気もします。NVRAM の内容が Server 2016 を入れる前の状態のまま変わっていない可能性が高く、本来であれば Option ROM を Legacy に変えたら NVRAM はクリアされて、MBR からの起動を自動的に試すのではないだろうか。

 
デバッガーを使って、NVRAM にアクセスしてエラー コードを返している箇所 (4 箇所あった) で、片っ端からエラーコードを変更してエラーがなかったように見せかける禁断の領域に踏み込んだところ、インストールは終わりましたが、初回起動で OOBE が始まる前の段階で "Windows could not complete the installation. To install Windows on this computer, restart the installation." というポップアップが出て結局起動できず。どうやら Windows 起動時にも NVRAM へのアクセスを行なっているようだ。まあそりゃそうだろう。

 
![]({{site.assets_url}}2016-10-23-image.png)

 
Z420 で NVRAM をクリアする方法を探してみたが、どうにも見つからない。意図せずして行なった CMOS クリアではクリアされなかった。システム設定で ROM をクリアするオプションはあるのだが、何が消えるか分からないためちょっと恐くて試していない。びびり。

 
<font color="#0000ff">(2016/11/6 追記)</font>

 
次は、何とかして NVRAM がおかしいという確証が欲しいところです。以下の資料を見ると、実は bcdedit /enum で出力される値は NVRAM variable から来ているらしい。

 
Presentations and Videos | Unified Extensible Firmware Interface Forum <br />
[http://www.uefi.org/learning_center/presentationsandvideos](http://www.uefi.org/learning_center/presentationsandvideos)

 
上記ページからダウンロードできる "Windows Boot Environment" という PDF の 20 ページ目によると

 
```
- BCD has 1:1 mappings for some UEFI global variables

- Any time {fwbootmgr} is manipulated, NVRAM is automatically updated
```
 
さらに、以下のページによると

 
Remove Duplicate Firmware Objects in BCD and NVRAM <br />
[https://technet.microsoft.com/en-us/library/cc749510(v=ws.10).aspx](https://technet.microsoft.com/en-us/library/cc749510(v=ws.10).aspx)

 
```
When bcdedit opens the BCD, it compares entries in NVRAM with entries in BCD. Entries in NVRAM that were created by the firmware that do not exist in BCD are added to the system BCD. When bcdedit closes the system BCD, any boot manager entries in BCD that are not in NVRAM are added to NVRAM.
```
 
同様のことは以下の日本語のブログにもまとめられています。詳しくていい感じ。

 
PC-UEFI - DXR165の備忘録 <br />
[http://dxr165.blog.fc2.com/blog-category-45.html](http://dxr165.blog.fc2.com/blog-category-45.html)

 
何はともあれ、Windows PE を起動して bcdedit を実行してみます。

 
```
X:\windows\system32> bcdedit /enum {fwbootmgr} 
The boot configuration data store could not be opened. 
A device attached to the system is not functioning. 
```
 
あっさり失敗。インストーラーを起動するまでもないですね。Server 2016 のメディアが悪いのではなく、やはりハードウェアがおかしいくさい。

 
さて、次のステップはいよいよ Windows PE のカーネル デバッグだろうか。幸い、Z420 と Z440 を 1394 ケーブルで繋げられたので、これでデバッグすることにする。最近だとイーサネットも使えるらしいが、試したことはない。

 
上記の bcdedit /enum {fwbootmgr} を実行すると、NT カーネルから HAL を経由し、EFI のランタイム サービス テーブルにおける GetNextVariableName が指すアドレスの関数を呼んで変数名を列挙し、GetVariable で値を取ってきます。ランタイム サービス テーブルの定義は、↓ のファイルにおける EFI_RUNTIME_SERVICES という構造体です。

 
TianoCore EDK2: MdePkg/Include/Uefi/UefiSpec.h Source File <br />
[http://www.bluestop.org/edk2/docs/trunk/_uefi_spec_8h_source.html](http://www.bluestop.org/edk2/docs/trunk/_uefi_spec_8h_source.html)

 
ランタイム サービス テーブルは、EFI システム テーブルの一部であり、EFI システム テーブルは efi_main 関数が取る 2 つのパラメーターのうちの一つらしい。

 
Programming for EFI: Using EFI Services <br />
[http://www.rodsbooks.com/efi-programming/efi_services.html](http://www.rodsbooks.com/efi-programming/efi_services.html)

 
GetNextVariableName のプロトタイプ宣言は分かっているので、呼び出し部分から変数名を GUID を確認しました。102 個ありますが、とりあえず全部載せておきます。

 
```
ffffd000`208578a0  "CurrentDevicePath" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "BootCurrent" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "LangCodes" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "PlatformLangCodes" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "SSID" 
ffffd000`20857868  707c9176 4e27a4c1 371c1d85 c873cab7 
ffffd000`208578a0  "UsbMassDevNum" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "SetupFeatureSupport" 
ffffd000`20857868  b6ad93e3 4c8519f7 c58072aa c7db9471 
ffffd000`208578a0  "ErrOut" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "ErrOutDev" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "RstSataV" 
ffffd000`20857868  193dfefa 4302a445 3aefd899 c6041aad 
ffffd000`208578a0  "PNP0510_0_VV" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "RstScuV" 
ffffd000`20857868  193dfefa 4302a445 3aefd899 c6041aad 
ffffd000`208578a0  "BootOptionSupport" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "ConInDev" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "UsbMassDevValid" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "PNP0501_1_VV" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "PNP0400_0_VV" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "PNP0501_0_VV" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "ConOutDev" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "VgaDeviceInfo" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "VgaDeviceCount" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "RstScuO" 
ffffd000`20857868  193dfefa 4302a445 3aefd899 c6041aad 
ffffd000`208578a0  "DebuggerSerialPortsEnabledVar" 
ffffd000`20857868  97ca1a5b 4d1fb760 90d14ba5 902c0392 
ffffd000`208578a0  "SerialPortsEnabledVar" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "DriverHlthEnable" 
ffffd000`20857868  0885f288 4be1418c ad8bafa6 fe08da61 
ffffd000`208578a0  "DriverHealthCount" 
ffffd000`20857868  7459a7d4 44806533 e279a7bb c943445a 
ffffd000`208578a0  "S3SS" 
ffffd000`20857868  4bafc2b4 410402dc f1d636b2 849e8db9 
ffffd000`208578a0  "RSCInfoAddresss" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "PlatformLang" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "AMITSESetup" 
ffffd000`20857868  c811fa38 457942c8 e960bba9 34fbdd4e 
ffffd000`208578a0  "UsbSupport" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "SlotEnable" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "FrontUsbEnable" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "RearUsbEnable" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "InternalUsbEnable" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "PowerOnTime" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "MSDigitalMarker" 
ffffd000`20857868  c43c9947 4a343578 f38e5fb9 8e43c7a5 
ffffd000`208578a0  "NotFirstBoot" 
ffffd000`20857868  70040abc 45886387 cdddb187 f57a7d6c 
ffffd000`208578a0  "ONBOARD_DEVS_PRESENT" 
ffffd000`20857868  d98397ee 457a7a9d 68e5dfa9 18cc87ae 
ffffd000`208578a0  "MemoryInfo" 
ffffd000`20857868  7ee396a1 431bff7d cd8c53fa c5447c12 
ffffd000`208578a0  "MEMajorVersion" 
ffffd000`20857868  59416f8c 48c4b82d cb107e88 bbc38ec4 
ffffd000`208578a0  "PciSerialPortsLocationVar" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "HeciErrorReset" 
ffffd000`20857868  31d2fce0 11e164b3 00086cb8 669a0c20 
ffffd000`208578a0  "MeInfoSetup" 
ffffd000`20857868  78259433 4db37b6d c436e89a 7da1c3c2 
ffffd000`208578a0  "NetworkStackVar" 
ffffd000`20857868  d1405d16 46957afc 454112bb a295369d 
ffffd000`208578a0  "HSTime" 
ffffd000`20857868  ae601ef0 11e0360b 0008429e 669a0c20 
ffffd000`208578a0  "LastHDS" 
ffffd000`20857868  ae601ef0 11e0360b 0008429e 669a0c20 
ffffd000`208578a0  "ConsoleLock" 
ffffd000`20857868  368cda0d 4b9bcf31 d1e7f68c 7e15ffbf 
ffffd000`208578a0  "SetupAmtFeatures" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "SlotPresent" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "MMIOR." 
ffffd000`20857868  3b2158f5 48c039d3 530384aa dbc6ba65 
ffffd000`208578a0  "SysBuses" 
ffffd000`20857868  55e6fc89 40763e74 e9d4c298 10e8c413 
ffffd000`208578a0  "ThermalErrorLog" 
ffffd000`20857868  707c9176 4e27a4c1 371c1d85 c873cab7 
ffffd000`208578a0  "ConOut" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "SetupCpuSockets" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "FrontUsbPresent" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "RearUsbPresent" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "InternalUsbPresent" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "Lang" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "SBRealRevID" 
ffffd000`20857868  707c9176 4e27a4c1 371c1d85 c873cab7 
ffffd000`208578a0  "TdtAdvancedSetupDataVar" 
ffffd000`20857868  7b77fb8b 4d7e1e0d 80393f95 76e061a2 
ffffd000`208578a0  "HP_CTRACE" 
ffffd000`20857868  707c9176 4e27a4c1 371c1d85 c873cab7 
ffffd000`208578a0  "NBRealRevID" 
ffffd000`20857868  707c9176 4e27a4c1 371c1d85 c873cab7 
ffffd000`208578a0  "MeBiosExtensionSetup" 
ffffd000`20857868  1bad711c 4241d451 3785f3b1 700c2e81 
ffffd000`208578a0  "HpWriteOnceMetaData" 
ffffd000`20857868  707c9176 4e27a4c1 371c1d85 c873cab7 
ffffd000`208578a0  "PBRDevicePath" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "TrueStruct" 
ffffd000`20857868  7349bea7 420bc95c 1e6dcd8d a88b4d9d 
ffffd000`208578a0  "PNP0501_11_NV" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "PNP0501_12_NV" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "SetupLtsxFeatures" 
ffffd000`20857868  ec87d643 4bb5eba4 3e3fe5a1 a90db236 
ffffd000`208578a0  "ucal" 
ffffd000`20857868  707c9176 4e27a4c1 371c1d85 c873cab7 
ffffd000`208578a0  "HpPassphraseStructureVariable" 
ffffd000`20857868  707c9176 4e27a4c1 371c1d85 c873cab7 
ffffd000`208578a0  "EfiTime" 
ffffd000`20857868  9d0da369 46f8540b 5f2ba085 151e302c 
ffffd000`208578a0  "Setup" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "PlatformLang" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "Timeout" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "AMITSESetup" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "IDESecDev" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "SystemIds" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "UsbSupport" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "PNP0501_0_NV" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "PNP0501_1_NV" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "PNP0400_0_NV" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "PNP0510_0_NV" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "HpMfgData" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "SlotEnable" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "FrontUsbEnable" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "RearUsbEnable" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "InternalUsbEnable" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "PowerOnTime" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "MSDigitalMarker" 
ffffd000`20857868  8173aefa 4574adf0 377139a0 1af24aab 
ffffd000`208578a0  "PNP0501_0_NV" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "PNP0501_1_NV" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "PNP0400_0_NV" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "PNP0510_0_NV" 
ffffd000`20857868  560bf58a 4d7e1e0d 80293f95 31e061a2 
ffffd000`208578a0  "HpMor" 
ffffd000`20857868  707c9176 4e27a4c1 371c1d85 c873cab7 
ffffd000`208578a0  "PBRDevicePath" 
ffffd000`20857868  a9b5f8d2 42c2cb6d ffb501bc 5e33e4aa 
ffffd000`208578a0  "PetAlertCfg" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "ConIn" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "Timeout" 
ffffd000`20857868  8be4df61 11d293ca e0000daa 8c2b0398 
ffffd000`208578a0  "CurrentPolicy" 
ffffd000`20857868  77fa9abd 4d320359 f42860bd 4b788fe7 
ffffd000`208578a0  "a8ff1f3f4a8c94074056b76e9d7fab3a862c68d3" 
ffffd000`20857868  ffffffff ffffffff ffffffff ffffffff
```
 
GetNextVariableName からの戻り値は 0 なのですが、最後の変数は名前、GUID ともに明らかに変です。このあと、最後の "a8ff1f3f4a8c94074056b76e9d7fab3a862c68d3" に対して GetVariable すると、戻り値が 14 (= EFI_NOT_FOUND) になります。呼び出し元は hal!HalEnumerateEnvironmentVariablesEx なのですが、GetVariable が失敗すると、この関数は見慣れたエラー コード c0000001 (= STATUS_UNSUCCESSFUL) を返すようになっていました。

 
というわけで、EFI の GetNextVariableName で列挙された変数名がなぜか GetVariable できないためインストールが上手くいかない、ことが分かりました。アセンブラでどうやって NVRAM にアクセスしているのか分かりませんが、やはり NVRAM が怪しいです。

 
それにしても HAL の動作には不満が残ります。GetNextVariableName で列挙された値が GetVariable 出来なかった場合は、全体をエラーにするのではなく、その変数だけをスキップして欲しいですね。

