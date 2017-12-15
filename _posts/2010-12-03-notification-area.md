---
layout: post
title: "[.NET] [C#] ウィンドウを閉じると通知アイコンで実行されるプログラム"
date: 2010-12-03 00:36:00.000 +09:00
categories:
- Windows
tags:
- .NET
- ApplicationContext
- C#
- NotifyIcon
---

最近業務外でこそこそと C#.NET のプログラムを書いていて、その中で出てきた Tips。ちなみに、通知 “トレイ” という表現は全くの間違いで、通知エリアにおける通知アイコンというのが正式な表現らしいです。分かりにくいことに、通知エリアもタスクバーの一部なので、「じゃあ本来のタスクバーのボタンの名前は？」と聞かれると分かりません。タスクボタン？ですかね。

 
閑話休題。.NET で通知アイコンを表示させるのは簡単です。 NotifyIcon クラスを使います。下記 URL にあるサンプルを見れば一目瞭然。

 
[http://msdn.microsoft.com/ja-jp/library/system.windows.forms.notifyicon(VS.80).aspx](http://msdn.microsoft.com/ja-jp/library/system.windows.forms.notifyicon(VS.80).aspx)

 
このプログラムをベースに、ウィンドウを閉じたときにタスクボタンが消えて、通知アイコンだけになるプログラムを作ります。タスクボタンは、プログラムがウィンドウを持っているときに表示されているので、ウィンドウを閉じればタスクボタンは消えます。ウィンドウを閉じたときにアプリケーションが終了してしまってはまずいので、 Application.Run メソッドに Form を渡してはダメです。

 
さて、 NotifyIcon インスタンスはどこに持たせればいいのでしょうか。もし、ウィンドウを閉じる=破棄する というのであれば、当然 NotifyIcon は Form に持たせるわけにはいかず、 Application クラスを継承してなんちゃらかんちゃら、という風に Form の外側に持たせる必要があります。しかし、ウィンドウの × ボタンを押すたびにウィンドウが破棄され、通知アイコンをダブルクリックするなどしたときに、またウィンドウが初期状態に戻ってしまうというのも現実的な仕様ではありません。Form.Show() ではなく、 Form.ShowDialog() を使ってウィンドウをモーダル表示させると、ウィンドウを閉じても破棄されません。通知アイコンをダブルクリックなどしたときに再度 Form.ShowDialog() を呼び出すと、閉じる前の状態でウィンドウが復活します。

 
これを使えば Form クラスの中に NotifyIcon を持たせてもよさそうなものですが、個人的には違和感を感じます。例えアプリケーションがウィンドウを一つしか持っていなかったとしても、通知アイコンというのは概念的には「アプリケーションそのもの」を指しているわけで、そのアプリケーションのフロントエンドに過ぎないフォームオブジェクトが通知アイコンを所有しているというのは設計的におかしい気がするのです。

 
以上を踏まえて Application.Run のオーバーロード一覧を見ると、 Application.Run(ApplicationContext) といういかにも使えそうなものがあります。ユーザ定義の ApplicationContext クラスを作って、そこに通知アイコンなど、アプリケーション関連処理を持たせれば万事解決です。

 
```
using System; 
using System.Collections.Generic; 
using System.Linq; 
using System.Windows.Forms;

using System.IO; 
using System.Reflection;

namespace CSSandbox { 
    static class Program { 
        /// <summary> 
        /// アプリケーションのメイン エントリ ポイントです。 
        /// </summary> 
        [STAThread] 
        static void Main() { 
            Application.EnableVisualStyles(); 
            Application.SetCompatibleTextRenderingDefault(false);

            Application.Run(new MyApplicationContext(new Form1())); 
        } 
    }

    class MyApplicationContext : ApplicationContext { 
        private Form mForm; 
        private NotifyIcon mNotifyIcon; 
        private ContextMenu mContextMenu;

        public MyApplicationContext(Form f) { 
            mForm = f;

            InitNotifyTray(); 
            f.ShowDialog(); 
        }

        private void InitNotifyTray() { 
            MenuItem menu = new MenuItem(); 
            menu.Index = 0; 
            menu.Text = "E&xit"; 
            menu.Click += new System.EventHandler(menuItem1_Click);

            mContextMenu = new ContextMenu(); 
            mContextMenu.MenuItems.Add(menu);

            mNotifyIcon= new NotifyIcon(); 
            mNotifyIcon.Icon = new Icon("appicon.ico"); 
            mNotifyIcon.ContextMenu = mContextMenu; 
            mNotifyIcon.Text = "NotifyIcon Tooltip"; 
            mNotifyIcon.Visible = true; 
        }

        private void notifyIcon1_DoubleClick(object Sender, EventArgs e) { 
            if ( !mForm.Visible ) 
                mForm.ShowDialog(); 
        }

        private void menuItem1_Click(object Sender, EventArgs e) { 
            Application.Exit(); 
        } 
    } 
}
```
 
コンテキストメニューを ApplicationContext に持たせる必要もないのですが、なんとなく。

 
このプログラムで目的は達成したような気がしますが、アプリケーションを終了させても通知アイコンが通知エリアから消えないという現象が起きます。アプリケーションがクラッシュした時と同じようなことが起こっていて、マウスポインタをその通知アイコン上に持っていくと通知アイコンは消えます。再描画イベントが発生しない、とかなんでしょうかね。理由は不明です。

 
このままでは気持ち悪いので、試しに通知アイコンの破棄を明示的に行ったところ、無事に通知アイコンは自動的に消えるようになりました。すなわち、 ApplicationContext のコンストラクタに次のようにイベントハンドラを追加し、

 
```
public MyApplicationContext(Form f) { 
    mForm = f; 
    Application.ApplicationExit += new EventHandler(OnQuit);

    InitNotifyTray(); 
    f.ShowDialog(); 
}
```
 
OnQuit 関数を追加します。

 
```
private void OnQuit(object sender, EventArgs e) { 
    mNotifyIcon.Dispose(); 
} 
```
 
最後にもう一点。通知アイコンをアイコンファイルからロードしているあたりが何とも滑稽なので、これをリソースから読み込むように変えたほうがよさそうです。で、リソースからバイナリを読み込む方法をいろいろ調べても意外とすんなり出てこない。以下のサイトの方法を試してみてもなぜかうまくいかず、というか Win32API の世界よりめんどくさくなっている気がしておかしい。

 
[http://support.microsoft.com/kb/319292/en](http://support.microsoft.com/kb/319292/en) <br />
[http://dobon.net/vb/dotnet/programing/resourcemanager.html](http://dobon.net/vb/dotnet/programing/resourcemanager.html)

 
と、 30 分ほど困っていたら、偶然見つけることができました。リソースは既にインスタンスとして与えられているじゃないか、と。

 
```
  mNotifyIcon.Icon = Properties.Resources.Icon1;
```
 
瞬殺。.NET 本には書いてありそうですね。知ってて当たり前なのだろうか。

