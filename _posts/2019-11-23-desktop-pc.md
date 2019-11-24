---
layout: post
title: "CPU を買った"
date: 2019-11-23 12:00:00.000 -08:00
---

### 計画と購入

家で仕事をするようになったため、メインの作業はもともと使っていたデスクトップ PC で行うようになりました。会社からは Lenovo X280 が支給されたのですが、私はモニターが二枚ないと作業効率が著しく落ちる人間なので、ラップトップはビルドを並行したいときや、自宅以外で使っています。ただし、デスクトップ PC の CPU はいわゆる第二世代 (Sandy Bridge) の i7-2600 なので、第八世代 (Kaby Lake) の Core i7-8650U を積んでいる Lenovo と比べると明らかにビルド時間などが遅いのが不満でした。さらに、友人から使わなくなったモニターを譲ってもらったので、これを期に二台構成だった環境を三台構成にしたくなり、パソコンの買い替えを検討することにしました。過去のメール履歴を調べると、デスクトップ PC は 2011/10 にドスパラで注文したものでした。当時 80,000 円だったようです。8 年の間に国を跨って 6 回ぐらい引越ししてますが、よく故障せずに済んだものです。

仕事効率にも直結するのであまりケチらず、CPU は第九世代の i7 + メモリ 32GB の構成で値段を調べると、Dell で $1,600、HP で $1,700 ぐらいすることが分かりました。さすがに高すぎる。そこで、今使っている PC のパーツを変更することにしました。買うのは CPU、GPU、マザーボード、メモリ、電源です。これなら $1,000 以内で済みます。で、Amazon と BestBuy を組み合わせて買ったのは↓。トータル $832.59。

- Core i7-9700 - $335.99
- NVIDIA GeForce GTX 1660 - $235.39
- Gigabyte B365M DS3H - $68.75
- DDR4-2666 16GB x2 - $138.59
- Thermaltake SMART 600W $53.87

CPU。さすがに Core i9 は高すぎる。できれば 9700F が欲しいところだったのですが、どこにも在庫がない。普通は 9700K を買うべきなのでしょうが、冷却ファンを別に買うのが面倒くさいという消極的な理由で 9700 にしました。なんだかんだ AMD より Intel が好きです。

GPU。RTX シリーズは高すぎる上にレイトレなんぞ要らん。Radeon の RX 580 あたりも気になりましたが、結局 NVIDIA をチョイス。別にアンチ AMD なわけではない。

マザボ。Q や Z シリーズは高すぎるので検討していませんが、B360/B365/H370 のどれにするかはけっこう迷いました。値段もそんなに変わらない。特に H370 の USB 3.1 は魅力的でしたが、今のところ 3.1 のデバイスを持っていないので B365 にしました。正直 H370 の方がよかったかもしれない。

電源。今まで使っていたのが 350W で、RX 580 だと推奨電源が 500W だったので一応購入。だが GTX 1660 は 350W でも動くっぽいので、買わなくてもよかったかもしれない。というか Radeon は電力を消費し過ぎなのでは。

### ハードウェア

実はマザーボードを交換するのは初めてなのと、わりと勢いでパーツを選んだので、かなり不安のある作業でした。


まず電源を交換。

![]({{site.assets_url}}2019-11-23-01-power.jpg)<br />

マザーボードを交換。この細かいケーブル (Power, Reset, Power LED, HDD LED, Chassis Speaker) の処理がミスを誘ってくる。

![]({{site.assets_url}}2019-11-23-02-cables.jpg)<br />

取れた。

![]({{site.assets_url}}2019-11-23-03-oldboard.jpg)<br />

これが新しいボード。ヒートシンクが小さくなった。

![]({{site.assets_url}}2019-11-23-04-newboard.jpg)<br />

いろいろ繋いだ後。COM ポートというロマン溢れるカードに注目してほしい。

![]({{site.assets_url}}2019-11-23-05-done.jpg)<br />


### ソフトウェア

事前の懸念としてあったのは、BIOS が第九世代の CPU に対応しているかどうかです。B365 が出た当時はまだ第九世代がリリースされていなかったらしく、古い BIOS では第九世代が動かないという情報があり、現在出荷時の BIOS が古かったら動作しないことになります。この場合は第八世代の CPU を買って BIOS だけ更新してから返品するコース。面倒な上、店にも迷惑に違いない。

結果的には、下記の F4 バージョンがインストール済みで問題なしでした。

B365M DS3H (rev. 1.0) | Motherboard - GIGABYTE U.S.A.<br />
[https://www.gigabyte.com/us/Motherboard/B365M-DS3H-rev-10/support#support-dl-bios](https://www.gigabyte.com/us/Motherboard/B365M-DS3H-rev-10/support#support-dl-bios)

一応 F5 にアップデートしておきます。アメリカは電圧がけっこう不安定なので、このタイミングも不安です。そもそも平日の夕方じゃなくて週末にやれよって話ですが。

![]({{site.assets_url}}2019-11-23-06-bios-update.jpg)<br />

一つだけ問題が発生。グラフィック カードを差すと Windows が起動しなくなる現象に遭遇。エラーメッセージは "BlInitializeLibrary failed 0xc00000bb"。まさかカーネルデバッグの出番か。

![]({{site.assets_url}}2019-11-23-07-boot-error.jpg)<br />

一応 KB はあったが、解決策がよく分からない。

"BlInitializeLibrary failed XXX" error when you install or start an operating system on a 64-bit UEFI-based computer<br />
[https://support.microsoft.com/en-us/help/4020050/blinitializelibrary-failed-xxx-error-when-you-install-or-start-an-oper](https://support.microsoft.com/en-us/help/4020050/blinitializelibrary-failed-xxx-error-when-you-install-or-start-an-oper)

BIOS の設定が怪しいと睨んでそれっぽい設定をいろいろ弄ったところ "Above 4G Decoding" を Enabled にしたことで解決しました。何だったんだ一体。

![]({{site.assets_url}}2019-11-23-08-bios-4g-decoding.jpg)<br />

というわけで作業完了。モニターを縦置きで使うのは初めてなのですが、これは素晴らしい。Windows をマルチ DPI 構成で使うといろいろおかしな動作をするのは相変わらずですが、我慢できるレベルです。

![]({{site.assets_url}}2019-11-23-09-desktop.jpg)<br />

作業前では、4K モニターで Firefox を使うとレンダリングが極度に遅くなる現象 (たぶんこれ・・・？ [https://bugzilla.mozilla.org/show_bug.cgi?id=1549901](https://bugzilla.mozilla.org/show_bug.cgi?id=1549901)) に遭遇していたのですが、作業後は解消されました。交換前のグラフィック カードが Quadro FX 580 で、GPU のスペックが足りなかったのが原因かもしません。

江添氏の 「[効率化のためには眼球にできるだけ多くのピクセルを叩き込むべきである。](https://cpplover.blogspot.com/2016/07/pc.html)」 という言葉は名言だと思います。
