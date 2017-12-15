---
layout: post
title: "Debugger Command Cheat Sheet (windbg/gdb/lldb)"
date: 2015-08-02 12:29:10.000 -07:00
categories:
- Debug
tags:
- gdb
- lldb
- windbg
---

たまに gdb や lldb を使うときは、いつも基本的なコマンドをググるのに時間を費やしているので、自分用にコマンドをまとめてみました。こうしてみると、やはり Windows Debugger のコマンドはシンプルで洗練されていて好き。gdb と lldb のコマンドは長すぎるし、そもそもソースコードがあることが前提で、最適化済みのコードや、アセンブリを見てデバッグすることがほとんど想定されていないように思える。随時更新予定です。

 
<font color="#0000ff">(2015/8/3 追記)     <br>.gdbinit や .lldbinit という設定ファイルを作ってカスタム コマンドを定義する方法があるらしい。GitHub に、いろいろな人の設定ファイルが公開されているので、使いやすいものを選んで利用することも可能。</font>

 
(このブログ、テーブルのスタイルが指定できない・・？ 後で何とかしないと。)

 <table><caption>Debugger Commands (Last update: Aug. 2, 2015)</caption><thead>     <tr>       <th>Windows Debugger</th>        <th>GDB</th>        <th>LLDB</th>     </tr>   </thead><tbody>     <tr>       <td>bp</td>        <td>b</td>        <td>br set [-n &lt;func&gt;] [-a &lt;addr&gt;]</td>     </tr>      <tr>       <td>bp &lt;addr&gt; "&lt;commands&gt;"</td>        <td>commands #</td>        <td>br command add</td>     </tr>      <tr>       <td>bl</td>        <td>info break</td>        <td>br list</td>     </tr>      <tr>       <td>bc*</td>        <td>delete break</td>        <td>br del -f</td>     </tr>      <tr>       <td>bc#</td>        <td>d #</td>        <td>br del #</td>     </tr>      <tr>       <td>be</td>        <td>enable</td>        <td>br enable</td>     </tr>      <tr>       <td>bd</td>        <td>disable</td>        <td>br disable</td>     </tr>      <tr>       <td>~</td>        <td>info threads</td>        <td>th list</td>     </tr>      <tr>       <td>.frame</td>        <td>frame</td>        <td>frame select</td>     </tr>      <tr>       <td>gc</td>        <td>c</td>        <td>c</td>     </tr>      <tr>       <td>g &lt;addr&gt;</td>        <td>&nbsp;</td>        <td>&nbsp;</td>     </tr>      <tr>       <td>q</td>        <td>q</td>        <td>q</td>     </tr>      <tr>       <td>p</td>        <td>ni</td>        <td>ni</td>     </tr>      <tr>       <td>t</td>        <td>si</td>        <td>si</td>     </tr>      <tr>       <td>gu</td>        <td>fin</td>        <td>fin</td>     </tr>      <tr>       <td>r</td>        <td>info registers</td>        <td>reg r</td>     </tr>      <tr>       <td>r rax=0</td>        <td>set $rax = 0</td>        <td>reg w rax 0</td>     </tr>      <tr>       <td>k</td>        <td>bt</td>        <td>bt</td>     </tr>      <tr>       <td>dv</td>        <td>info locals</td>        <td>frame variable</td>     </tr>      <tr>       <td>dv &lt;var&gt;</td>        <td>p</td>        <td>p, po</td>     </tr>      <tr>       <td>dt</td>        <td>ptype</td>        <td>type lookup</td>     </tr>      <tr>       <td>u . l1</td>        <td>info line          <br>info frame</td>        <td>frame info</td>     </tr>      <tr>       <td>uf</td>        <td>disass /r</td>        <td>d -b</td>     </tr>      <tr>       <td>ln</td>        <td>l *&lt;addr&gt;</td>        <td>l &lt;addr&gt;</td>     </tr>      <tr>       <td>x</td>        <td>info line</td>        <td>image lookup -n</td>     </tr>      <tr>       <td>dd &lt;addr&gt; l10</td>        <td>x/16wx &lt;addr&gt;</td>        <td>x/16wx &lt;addr&gt;</td>     </tr>      <tr>       <td>dq &lt;addr&gt; l10</td>        <td>x/16gx &lt;addr&gt;</td>        <td>x/16gx &lt;addr&gt;</td>     </tr>      <tr>       <td>dc &lt;addr&gt; l10</td>        <td>x/16c &lt;addr&gt;</td>        <td>x/16c &lt;addr&gt;</td>     </tr>      <tr>       <td>db &lt;addr&gt; l10</td>        <td>x/16b &lt;addr&gt;</td>        <td>x/16x &lt;addr&gt;</td>     </tr>      <tr>       <td>u &lt;addr&gt; l10</td>        <td>x/16i &lt;addr&gt;</td>        <td>x/16i &lt;addr&gt;</td>     </tr>      <tr>       <td>ed &lt;addr&gt; &lt;value&gt;</td>        <td>set *(int*)&lt;addr&gt;=&lt;value&gt;</td>        <td>memory write -s 4 &lt;addr&gt; &lt;value&gt;</td>     </tr>      <tr>       <td>windbg.exe</td>        <td>C-x C-a          <br>C-x C-1           <br>C-x C-2</td>        <td>gui</td>     </tr>   </tbody></table> 
### Other cheat sheets

 
- Linux Tutorial - GNU GDB Debugger Command Cheat Sheet <br />
[http://www.yolinux.com/TUTORIALS/GDB-Commands.html](http://www.yolinux.com/TUTORIALS/GDB-Commands.html) 
- LLDB to GDB Command Map <br />
[http://lldb.llvm.org/lldb-gdb.html](http://lldb.llvm.org/lldb-gdb.html) 

