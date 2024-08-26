---
layout: post
title: "CPU を再び買った"
date: 2024-08-25 12:00:00.000 -08:00
---

### パーツ選択

会社の経費で何か買っていいことになったので、PC を買いました。今までのメイン PC はこの記事に書いたもので、5 年前に買った Core i7-9700 +  GTX 1660 でした。特に故障もなく使えていますが、まあ、新しいの欲しいじゃん？

今使っている PC もサブとして併用していきたいので、ケースも含めて全部買うことにしました。今回は全パーツを [newegg](https://www.newegg.com/) で選びました。Amazon など他のサイトを見ても、値段や返品ポリシーは大差ありません。選んだパーツはこちら。

- AMD Ryzen 9 7950X3D - $525.03
- MSI MAG B650 TOMAHAWK WIFI - $181.60
- ASRock Challenger Radeon RX 7900 GRE 16GB - $529.99
- CORSAIR Vengeance 64GB (2 x 32GB) DDR5 5600 - $172.99
- CORSAIR RM1000x Shift 80 PLUS Gold - $189.99
- Thermaltake S300 Tempered Glass Snow Edition - $79.99
- NZXT Kraken RGB 240mm - $179.99

newegg のコンボで $46  値引きになり、そこにケースの送料 $5 と消費税 10% が加わって約 $2,000 。高いのか安いのか分かりませんね。日本で買っても同じぐらいではないでしょうか。

5 年前の記事では AMD より Intel が好きとか書いておきながら、今回は CPU も GPU も AMD になりました。まあほら、Intel は [Raptor Lake でやらかした](https://www.pcmag.com/explainers/intels-raptor-lake-desktop-cpu-bug-what-to-know-what-to-do-now)っぽいので、さすがに今回は様子見です。GPU は最初 RTX 4070 12GB で考えていたのですが、同じような値段で AMD なら RX 7900 GRE が VRAM 16GB であることを考慮して AMD にしました。仕事用途を考えるとメモリ容量重視です。

マザーボードは前回同様 B シリーズです。X シリーズとか間違いなくオーバースペック。

残りのパーツは特にこだわりもないので、newegg が提示してくるものを選択。

注文してから 1 週間弱で全部届きました。ATX のケースはでかいですね。このサイズは大昔に NTT-X で Express5800/110Gd (いわゆる鼻毛鯖の類似品) を買ったとき以来です。

![]({{site.assets_url}}2024-08-25-01-boxes.jpg)

### 組み立て

今回は全部新品なので、普通に組み立てるだけです。ストレージは、2.5 インチの SSD が 2 つ (1TB と 2TB) が落ちていたの買わずにすみました。さすがに NVMe や M.2 のストレージは落ちていなかった。残念。

今どきは CPU にも GPU にも電源ケーブルを 2 本挿すのが主流なんですかね。

水冷クーラーの取り付けが初めてだったので、ちょっと苦戦しました。上級者の方はエアフローをしっかり考えるんでしょうが、深く考えずに全面排気でいいだろうということで、前面に排気方向で取り付けました。

全体的に MSI のマニュアルが大変不親切で、ケースのフロントパネルのケーブルを繋ぐときにはこちらのサイトがとても役に立ちました。

[https://www.manualslib.com/manual/3270653/Msi-Mag-B650-Tomahawk-Wifi.html](https://www.manualslib.com/manual/3270653/Msi-Mag-B650-Tomahawk-Wifi.html)

組み立て中。最初はファンを上面につけたが後で変えた。
![]({{site.assets_url}}2024-08-25-02-case.jpg)

### ソフトウェア

Windows 11 を取りあえずインストールして起動確認後、BIOS をアップグレードしておきます。購入時は 7D75v1H でしたが、7D75v1J にしました。CVE-2024-36877 とかいう脆弱性の修正入っているし。

[https://www.msi.com/Motherboard/MAG-B650-TOMAHAWK-WIFI/support](https://www.msi.com/Motherboard/MAG-B650-TOMAHAWK-WIFI/support)

![]({{site.assets_url}}2024-08-25-03-bios.jpg)

まだ 2 日ぐらいしか使っていませんが、今のところ問題なしです。

#### Windows 11

Windows 11 は前評判が大変悪いので、Windows 10 のまま使い続けていたのですが、さすがに新規インストールするのに Windows 10 はいかんだろうということで、Windows 11 を初体験しています。これ全然だめですね。けっこう生産性が落ちそうです。ググりながらカスタマイズしたのは以下の点。

- インストール時にネットワーク接続が必須

  Windows はローカルアカウントで使って MS アカウントとは紐づけたくない派です。これは回避策がありました。

  [https://www.thewindowsclub.com/how-to-install-windows-11-without-an-internet-connection](https://www.thewindowsclub.com/how-to-install-windows-11-without-an-internet-connection)

  この BypassNRO.cmd というスクリプトの内容がしょぼいです。レジストリ追加して再起動するだけという。

  ```
  @echo off
  reg add HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\OOBE /v BypassNRO /t REG_DWORD /d 1 /f
  shutdown /r /t 0
  ```

- 悪名高いコンテキスト メニュー

  "Show more options" を選ばないと従来のメニューが表示されないあれですね。動作を見ると、これをクリックしたときにウィンドウを再作成しているっぽくて実に不快です。これもレジストリで戻せるので助かりました。

  [https://allthings.how/how-to-show-more-options-by-default-in-windows-11-file-explorer/](https://allthings.how/how-to-show-more-options-by-default-in-windows-11-file-explorer/)

  HKCU ハイブに {86ca1aa0-34aa-4e8b-a509-50c905bae2a2} という CLSID を Inproc で追加するだけです。消すと元の動作に戻るようです。この CLSID は C:\Windows\System32\Windows.UI.FileExplorer.dll という DLL に紐づいています。エクスプローラー内の処理で、まず Windows.UI.FileExplorer.dll は利用可能かどうかを確認し、無ければ別の COM オブジェクトを作りにいくような動作になっているですかね。深追いしていないので分かりませんが。

- 既定アプリでメモ帳 (notepad.exe) が選択できない

  UI から選ぼうとすると "Cannot associate a file type with a program" とかいうポップアップが出るやつです。これは ftype コマンドを使って手動でちまちま設定できました。

  [https://thegeekpage.com/fix-file-type-association-error-in-windows-10/](https://thegeekpage.com/fix-file-type-association-error-in-windows-10/)

  この設定をしたい背景は少しマニアックで、Visual Studio がインストール時に勝手に関連付けたファイルが選択されているときに、間違って Enter キーを押して Visual Studio が勝手に起動するのを防ぐためです。メモ帳のように軽いプログラムを関連付けておけばストレスが軽減されます。間違って GB 単位のファイルをメモ帳で開くとそれはそれで悲劇ですが。

いまだに回避策が見つかっていない問題もあります。

- ウィンドウの角が丸い

  これけっこう奥が深そうで、現在のバージョンだとレジストリで無効にすることはできないようですね。このへんを見ると、バイナリクラックしたり udwm.dll をフックしてがちゃがちゃ弄らないといけない予感。

  - [https://github.com/valinet/Win11DisableRoundedCorners/issues/36](https://github.com/valinet/Win11DisableRoundedCorners/issues/36)
  - [https://windhawk.net/mods/disable-rounded-corners](https://windhawk.net/mods/disable-rounded-corners)

  これは不穏なカスタマイズなので、自分で真面目にデバッグしてから試したい。

- Windows Terminal の既定設定が目に悪い

  昔のコマンドプロンプトが良いというわけではないですが、二十年近く触って目と手が慣れてしまったので、使いづらいですね。特にキャレットの形と選択モード。Windows 10 までは設定で変更できたのですが、Windows Terminal は設定画面が変わりすぎて、どこを変えればいいのかよく分からないのでそのままにしています。困ったものだ。

問題はさておき、これで 5 年ぐらいはまた戦えそうですかね。

![]({{site.assets_url}}2024-08-25-04-final.jpg)
