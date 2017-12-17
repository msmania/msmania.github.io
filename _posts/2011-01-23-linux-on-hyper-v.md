---
layout: post
title: "[Memo] Linux on Hyper-V"
date: 2011-01-23 23:55:08.000 +09:00
categories:
- Windows
tags:
- Hyper-V
- Legacy Network Adapter
- ubuntu
---

メモ書き程度に。

 
Hyper-V のゲスト OS として、Linux を動かすことができます。マイクロソフト社による一次情報としては、以下のページにサポート OS の一覧があります。

 
[http://www.microsoft.com/windowsserver2008/en/us/hyperv-supported-guest-os.aspx](http://www.microsoft.com/windowsserver2008/en/us/hyperv-supported-guest-os.aspx)

 
2011 年 1 月現在、サポートされている環境としては、SUSE と Redhat のエンタープライズ版のみ。個人では入手不可能ですね。試しに、前回の記事で使った Ubuntu をインストールしてみたところ、動作しました。

 
前回の記事

[Windows Server の SNMP エージェント機能と net-snmp の連携 Part1](https://msmania.wordpress.com/2010/11/06/windows-server-%E3%81%AE-smnp-%E3%82%A8%E3%83%BC%E3%82%B8%E3%82%A7%E3%83%B3%E3%83%88%E6%A9%9F%E8%83%BD%E3%81%A8-net-snmp-%E3%81%AE%E9%80%A3%E6%90%BA-part1-ubuntu-%E3%82%A4%E3%83%B3%E3%82%B9%E3%83%88/)<br />
[Windows Server の SNMP エージェント機能と net-snmp の連携 Part2](https://msmania.wordpress.com/2010/11/06/windows-server-%e3%81%ae-smnp-%e3%82%a8%e3%83%bc%e3%82%b8%e3%82%a7%e3%83%b3%e3%83%88%e6%a9%9f%e8%83%bd%e3%81%a8-net-snmp-%e3%81%ae%e9%80%a3%e6%90%ba-part2-ubuntu-%e5%88%9d%e6%9c%9f%e8%a8%ad%e5%ae%9a/)
 
環境は以下の通りです。

 
- ゲスト OS : Ubuntu 10.10 Desktop Edition 英語版 
- ホスト OS : Windows Server 2008 R2 (x64) 英語版 SPなし 
- ホスト CPU : Core 2 Duo 

 
注意点としては以下の通りです。

 
- NIC は Legacy Network Adapter を使う 
- RAM サイズ、HDD サイズを小さめにすると起動しないことがある（原因不明） 
- 再起動の処理をすると、ブートできなくなることが多い（原因不明） <br />
シャットダウンしてから起動すれば問題なし 
- 統合機能は使えない 

 
不穏な動作が多いです。

 
Legacy Network Adapter についてですが、デフォルトで設定されている Network Adapter を削除した上で、Add Hardware から Legacy Network Adapter を追加します。確か Windows XP あたりの古い OS も同様にデフォルトだと NIC が認識されなかったような気がします。

 
![]({{site.assets_url}}2011-01-23-image14.png)

 
あとは、前回の記事と同じ手順で、インストール、ネットワーク設定、アップデートなどを行なうことができました。

 
![]({{site.assets_url}}2011-01-23-image15.png)

