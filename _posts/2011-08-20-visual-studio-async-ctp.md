---
layout: post
title: "[.NET] [C#] Visual Studio Async CTP を試してみる"
date: 2011-08-20 01:29:27.000 +09:00
tags:
- .NET
- async
- await
- C#
- imagelist
- linq to xml
- listview
- rest api
---

話題の Visual Studio Async CTP を試してみました。次期 .NET のバージョンに組み込まれる予定の機能の一つです。C# と VB の言語仕様に async と await という 2 つのキーワードを追加し、言語仕様として非同期処理を実装できるというものです。実は、F# 2.0 には既に async キーワードが実装されていたりしますが。

 
.NET の非同期処理といえば Begin/End パターンですが、それに置き換わるものかと思います。まだ全然使いこなせていませんが、コード量は明らかに減るわけで、確かにこれは便利そうです。もちろん、言語仕様を複雑化することに対する批判もありますけどね。

 
サンプルは、YAHOO! の 「[東日本大震災 写真保存プロジェクト](http://archive.shinsai.yahoo.co.jp/) 写真検索 API」 を使って写真をダウンロードし、それを非同期処理で表示するというものです。主な流れはこんな感じで。

 
1. REST API を読んで、画像 URL の一覧が書かれた XML を取得
1. XML を LINQ to XML でパースして、URL を抽出
1. 画像データをダウンロード
1. ListView と ImageList コントロールを使って一覧表示

 
けっこう単純です。Async の威力を示すため、まず同期処理バージョンを先につくってから、それを非同期処理に書き換えてみます。

 
### 1. 準備

 
Async CTP を利用するには Visual Studio 2010 SP1 が必要です。Express 版は無料なので、持っていない人はここからダウンロードして下さい。 <br />
[http://www.microsoft.com/visualstudio/en-us/products/2010-editions/express](http://www.microsoft.com/visualstudio/en-us/products/2010-editions/express)

 
もちろん Async CTP をインストールしなければいけません。ダウンロード場所は下記 URLです。インストールは、ウィザードにしたがって進めるだけです。Async CTP をインストールすると、大量のサンプルが付随してくるので、それを見るだけで覚えられます。Microsoft にありがちですが、むしろサンプルが大きすぎて読みづらいです。私は匙を投げましたｗ <br />
[http://www.microsoft.com/download/en/details.aspx?id=9983](http://www.microsoft.com/download/en/details.aspx?id=9983)

 
今回は YAHOO! Japan の提供する API を利用するので、[http://developer.yahoo.co.jp/](http://developer.yahoo.co.jp/) からアプリケーション ID を取得して下さい。まあ何でもいいんですけど。

  
### 2. プロジェクトの作成

 
Visual Studio を開き、File &gt; New &gt; Project メニューから Windows Forms Application プロジェクトを作成します。ここでは C# を使います。Visual Basic でも構いません。

 
![]({{site.assets_url}}2011-08-20-image.png)

 
Async CTP には 非同期の拡張メソッドが追加されており、それを async や await を使う新方式で呼び出す、というのが基本の使い方です。その拡張メソッドは、.AsyncCtpLibrary.dll という名前の .NET アセンブリに含まれています。

 
DLL ファイルは、なぜかサンプルの入っているフォルダーにしか見つからなかったので、とりあえずこれを追加します。 <br />
%userprofile%\Documents\Microsoft Visual Studio Async CTP\Samples\AsyncCtpLibrary.dll

 
Solution Browser から References を右クリックし、&#x5b;Add Reference...&#x5d; を選択して下さい。表示されるダイアログで AsyncCtpLibrary.dll を選択して &#x5b;OK&#x5d; をクリックして下さい。

 
![]({{site.assets_url}}2011-08-20-image1.png)

 
プロジェクトのプロパティから、Application &gt; Target framework の選択で &#x5b;.NET Framework 4&#x5d; を選択して下さい。これは System.Net などを使うためです。

 
![]({{site.assets_url}}2011-08-20-image2.png)

 
Async 以外に使うアセンブリを追加します。先ほどと同様の Add References のダイアログで、今度は .NET タブから以下のアセンブリを追加します。

 
- System.Net
- System.Web

 
![]({{site.assets_url}}2011-08-20-image3.png)

 
Solution Explorer がこんな感じになります。

 
![]({{site.assets_url}}2011-08-20-image4.png)

 
### 3. フォームの作成

 
以下のコントロールを貼りつけます。

 
- ListView, ImageList - 画像の一覧表示
- TextBox - 検索キーワード
- Buttom - 検索実行
- TextBox - クエリとなる URL を表示
- ComboBox x2 - 検索結果数、表示画像サイズ

 
めんどくさいのでコントロール名は全部デフォルトで。

 
![]({{site.assets_url}}2011-08-20-image9.png)

 
んで、こんな感じになります。コントロールのプロパティなどはお好みで調整して下さい。

 
![]({{site.assets_url}}2011-08-20-image10.png)

  
### 4. コードを書く（同期処理）

 
以下のようなコードを書きます。これは通常の同期処理です。

 
```
// 
// Form1.cs 
// 
// 
// References 
// 
// http://msdn.microsoft.com/en-us/library/dd250937.aspx (XML) 
// http://www.atmarkit.co.jp/fdotnet/special/linqtoxml/linqtoxml_01.html (Linq to XML) 
// http://www.atmarkit.co.jp/fdotnet/dotnettips/336listviewimage/listviewimage.html (ImageList) 
//


using System; 
using System.Collections.Generic; 
using System.ComponentModel; 
using System.Data; 
using System.Drawing; 
using System.Linq; 
using System.Text; 
using System.Windows.Forms;

using System.Xml.Linq; 
using System.Net; 
using System.Web;

namespace CSSandbox { 
    public partial class Form1 : Form { 
        const string AppId = "YAHOO! のアプリケーション ID";

        public Form1() { 
            InitializeComponent(); 
        }

        private Size[] mImageSizeList = new Size[] { 
            new Size { Width= 64, Height= 48}, 
            new Size { Width= 128, Height= 96}, 
            new Size { Width= 256, Height= 192}, 
        };

        private void Form1_Load(object sender, EventArgs e) { 
            comboBox1.Items.Clear(); 
            comboBox1.Items.AddRange(new string[] {"10", "50", "100"});

            comboBox2.Items.Clear(); 
            for (int i = 0; i < mImageSizeList.Length; ++i) 
                comboBox2.Items.Add(ImageSizeCaption(i));

            comboBox1.SelectedIndex = 0; 
            comboBox2.SelectedIndex = 0;

            SetImageSize(); 
        }

        private string ImageSizeCaption(int index) { 
            if (index >= 0 && index < mImageSizeList.Length) { 
                return String.Format("{0}x{1}", 
                    mImageSizeList[index].Width, 
                    mImageSizeList[index].Height); 
            } 
            else { 
                return "N/A"; 
            } 
        }

        private void SetImageSize() { 
            imageList1.ImageSize = mImageSizeList[comboBox2.SelectedIndex]; 
        }

        private void button1_Click(object sender, EventArgs e) { 
            listView1.Items.Clear(); 
            imageList1.Images.Clear(); 
            SetImageSize();

            Cursor OldCursor = Cursor.Current; 
            Cursor.Current = Cursors.WaitCursor;

            Search(textBox1.Text, 1, int.Parse(comboBox1.Text));

            Cursor.Current = OldCursor; 
        }

        private void Search(string QueryString, int Start, int NumResults) { 
            string requestString = 
              "http://shinsai.yahooapis.jp/v1/Archive/search?" 
                + "AppId=" + AppId 
                + "&query=" 
                + HttpUtility.UrlEncode(QueryString, Encoding.UTF8) 
                + "&hard_flag=true" 
                + "&sort=%2Dorg_time" 
                + "&results=" + NumResults 
                + "&start=" + Start;

            textBox2.Text = requestString;

            var SearchReq = HttpWebRequest.Create(requestString); 
            var SearchRep = SearchReq.GetResponse(); 


            XElement XmlDoc = XElement.Load(SearchRep.GetResponseStream()); 
            XNamespace Namespace = "http://shinsai.yahooapis.jp";

            var query = from element 
                        in XmlDoc.Descendants(Namespace + "ThumbnailUrl") 
                        select element;

            int ImageIndex= 0; 
            foreach (var item in query) { 
                var DownloadReq = System.Net.WebRequest.Create(item.Value); 
                var DownloadRep = DownloadReq.GetResponse(); 


                if (DownloadRep.ContentType == "image/jpeg") { 
                    var Original = 
                      Image.FromStream(DownloadRep.GetResponseStream()); 
                    listView1.Items.Add(item.Value, ++ImageIndex); 
                    imageList1.Images.Add(Original); 
                } 
            } 
        } 
    } 
} 
```
 
よく見ると、実は LINQ to XML は不要だったりします。単に使ってみたかっただけです、はい。

 
API の仕様はここに載っています。クエリ オプションは他にもあります。 <br />
[http://developer.yahoo.co.jp/webapi/shinsai/archive/v1/search.html](http://developer.yahoo.co.jp/webapi/shinsai/archive/v1/search.html)

 
さて、これでプロジェクトをビルドし、適当に検索ワードとオプションを選択して Go ボタンを押すと、画像が表示されます。

 
![]({{site.assets_url}}2011-08-20-image7.png)

 
しかし同期処理なので、画像を表示中はウィンドウがフリーズした状態になります。表示画像数を 100 にして検索すると、10 秒以上待たされます。そこで非同期処理の登場です。

 
### 5. コードを書き直す（非同期処理）

 
まあ、この記事の趣旨からして、いとも簡単に非同期処理に変更できるわけですね。さて、何行ぐらい変えればいいと思いますか。

 
正解は 4 行です。青字で示した行が変更箇所です。

 
```
// 
// Form1.cs 
// 
// 
// References 
// 
// http://msdn.microsoft.com/en-us/library/dd250937.aspx (XML) 
// http://www.atmarkit.co.jp/fdotnet/special/linqtoxml/linqtoxml_01.html (Linq to XML) 
// http://www.atmarkit.co.jp/fdotnet/dotnettips/336listviewimage/listviewimage.html (ImageList) 
//


using System; 
using System.Collections.Generic; 
using System.ComponentModel; 
using System.Data; 
using System.Drawing; 
using System.Linq; 
using System.Text; 
using System.Windows.Forms;

using System.Xml.Linq; 
using System.Net; 
using System.Web;

using System.Threading.Tasks;

namespace CSSandbox { 
    public partial class Form1 : Form { 
        const string AppId = "YAHOO! のアプリケーション ID";

        public Form1() { 
            InitializeComponent(); 
        }

        private Size[] mImageSizeList = new Size[] { 
            new Size { Width= 64, Height= 48}, 
            new Size { Width= 128, Height= 96}, 
            new Size { Width= 256, Height= 192}, 
        };

        private void Form1_Load(object sender, EventArgs e) { 
            comboBox1.Items.Clear(); 
            comboBox1.Items.AddRange(new string[] {"10", "50", "100"});

            comboBox2.Items.Clear(); 
            for (int i = 0; i < mImageSizeList.Length; ++i) 
                comboBox2.Items.Add(ImageSizeCaption(i));

            comboBox1.SelectedIndex = 0; 
            comboBox2.SelectedIndex = 0;

            SetImageSize(); 
        }

        private string ImageSizeCaption(int index) { 
            if (index >= 0 && index < mImageSizeList.Length) { 
                return String.Format("{0}x{1}", 
                    mImageSizeList[index].Width, 
                    mImageSizeList[index].Height); 
            } 
            else { 
                return "N/A"; 
            } 
        }

        private void SetImageSize() { 
            imageList1.ImageSize = mImageSizeList[comboBox2.SelectedIndex]; 
        }

        private void button1_Click(object sender, EventArgs e) { 
            listView1.Items.Clear(); 
            imageList1.Images.Clear(); 
            SetImageSize();

            Cursor OldCursor = Cursor.Current; 
            Cursor.Current = Cursors.WaitCursor;

            Search(textBox1.Text, 1, int.Parse(comboBox1.Text));

            Cursor.Current = OldCursor; 
        }

        private async void Search(string QueryString, 
                                  int Start, int NumResults) { 
            string requestString = 
              "http://shinsai.yahooapis.jp/v1/Archive/search?" 
                + "AppId=" + AppId 
                + "&query=" 
                + HttpUtility.UrlEncode(QueryString, Encoding.UTF8) 
                + "&hard_flag=true" 
                + "&sort=%2Dorg_time" 
                + "&results=" + NumResults 
                + "&start=" + Start;

            textBox2.Text = requestString;

            var SearchReq = HttpWebRequest.Create(requestString); 
            // var SearchRep = SearchReq.GetResponse(); 
            var SearchRep = await SearchReq.GetResponseAsync();

            XElement XmlDoc = XElement.Load(SearchRep.GetResponseStream()); 
            XNamespace Namespace = "http://shinsai.yahooapis.jp";

            var query = from element 
                        in XmlDoc.Descendants(Namespace + "ThumbnailUrl") 
                        select element;

            int ImageIndex= 0; 
            foreach (var item in query) { 
                var DownloadReq = System.Net.WebRequest.Create(item.Value); 
                // var DownloadRep = DownloadReq.GetResponse(); 
                var DownloadRep = await DownloadReq.GetResponseAsync();

                if (DownloadRep.ContentType == "image/jpeg") { 
                    var Original = 
                      Image.FromStream(DownloadRep.GetResponseStream()); 
                    listView1.Items.Add(item.Value, ++ImageIndex); 
                    imageList1.Images.Add(Original); 
                } 
          } 
        } 
    } 
}
```
 
あら不思議。これで 100 枚の画像を表示させてもウィンドウがフリーズしません。

 
変更箇所が 4 行というのはけっこう少ないほうかと思います。その中でも、ポイントは GetResponseAsync でしょうか。これが Async CTP で追加された拡張メソッドの 1 つです。拡張メソッドは、ネットワーク I/O 系の操作を中心に用意されており、基本的には Windows Azure や Windows Phone 7 で利用されることを目的としているようです。モバイル アプリを作るにはけっこう強力な機能だと思います。

 
もちろん、実際に追加されている拡張メソッドは、Object Browser から見ることができます。

 
![]({{site.assets_url}}2011-08-20-image8.png)

 
サンプルが適当すぎて微妙ですが、例外処理を書くときが格段に楽になります。というのも、Begin~End のようにコールバック関数を使うような実装だと、複数箇所に try~catch 文を配置しなければなりませんが、async だと、同期処理と同じように例外を捕捉できます。サンプルの例だと、GetResponseAsync を try~catch で囲めばそれで終わりです。簡単ですね。

 
async には、タイムアウトやキャンセル処理などを実装することもできますが、それはまたの機会に書きます。また、デバッグするとどのように見えるのか、といったところもまだ勉強中です。

 
しかしまあ、このサンプルだと、非同期処理で画像が追加されている最中にウィンドウを操作できるのはいいのですが、コントロールの再描画処理の層で表示がチカチカしてクールではありません。考え物です・・・。

