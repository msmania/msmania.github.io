---
layout: post
title: "[VMware] ネットワークアダプタ"
date: 2010-11-05 00:31:55.000 +09:00
categories:
- misc
---
Vista 以降の Windows OS を VMware のゲストOS として導入するときは、 vmx ファイルに次のパラメータを設定しないと、 NIC のドライバが正しく読み込まれない。 
```
ethernet0.virtualDev = "e1000"
```
 デフォルトだと AMD の NIC が検出されるが、 e1000 を設定することで Intel のドライバが検出され、 Microsoft の汎用ドライバが使える模様。 覚書程度に。