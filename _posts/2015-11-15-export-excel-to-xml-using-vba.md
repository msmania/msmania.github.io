---
layout: post
title: "Export Excel to XML using VBA"
date: 2015-11-15 12:19:56.000 -08:00
categories:
- Other
- Windows
---

CSV などのテーブル データから XML を作りたいことが多々あります。Excel にはもともと XML へのエクスポートを行なう機能がありますが、望みどおりに動いてくれないため、VBA でマクロを書いてみましたのでコードを公開します。しかしこのご時勢では XML より JSON 派のほうが多いんですかね・・。

 
ちなみに開発環境は、Windows 7 SP1 上の Excel 2010 です。Office 2013 はどうも好きになれない。Windows 10 は入れたいのだが、諸事情でこの PC には入れられない・・。

 
さて、無味乾燥なサンプルだと面白くないので、楽天 API 経由で取ってきた商品データを使うことにします。といっても簡単で、PowerShell で以下のコマンドレットを実行するだけです。クエリ URL の &lt;APPID&gt; のところは、各自のアプリ ID を入れてください。持っていない人は、[https://webservice.rakuten.co.jp/](https://webservice.rakuten.co.jp/) でアカウントを登録して作ることができます。

 
```
PS> $Client = New-Object System.Net.WebClient 
PS> $QueryUrl = 'https://app.rakuten.co.jp/services/api/BooksTotal/Search/20130522?format=xml&keyword=%E5%AF%BF%E5%8F%B8&booksGenreId=000&hits=10&applicationId=<APPID>' 
PS> $Client.DownloadFile($QueryUrl, 'E:\MSWORK\Generator\Sushi.xml') 
```
 
上記は、楽天ブックスから "寿司" というキーワードで 10 件の検索結果を取ってきて、Sushi.xml という XML ファイルで保存するものです。これを Excel で開くと、以下のダイアログが出てくるので、「XML テーブルとして開く」 を選んで OK をクリックします。

 
![]({{site.assets_url}}2015-11-15-image.png)

 
スキーマ情報がないので以下のダイアログが表示されます。OK をクリックします。

 
![]({{site.assets_url}}2015-11-15-image1.png)

 
テーブルができます。

 
![]({{site.assets_url}}2015-11-15-image2.png)

 
ちなみにこのまま、XML ソースの画面にある &#x5b;エクスポートする対応付けの確認..&#x5d; をクリックすると、"例外的なデータ" (= denormalized data) が存在するとかでエクスポートできません。意味不明・・。

 
![]({{site.assets_url}}2015-11-15-image3.png)

 
と、いうわけで、このようなテーブルを XML にエクスポートするためのマクロを書きます。

 
元の Sushi.xml の構造は、大まかには以下のようになっています。検索結果の各アイテムの情報が root &gt; items &gt; item というノードに保存されています。簡単のため、items 以外の count や page といった検索のメタ情報は Excel のシートから除外することにします。

 
```
<root> 
  <count>4926</count> 
  <page>1</page> 
  <first>1</first> 
  <last>10</last> 
  <hits>10</hits> 
  <carrier>0</carrier> 
  <pageCount>100</pageCount> 
  <Items> 
    <Item> 
      <title>検索結果１</title> 
      ... 
    </Item> 
    <Item> 
      <title>検索結果２</title> 
      ... 
    </Item> 
  </Items> 
  <GenreInformation /> 
</root> 
```
 
列を削除して XMLGenerator.xlsm という名前で保存します。マクロを使うので、拡張子は xlsm という形式にします。

 
![]({{site.assets_url}}2015-11-15-image4.png)

 
リボンに &#x5b;開発&#x5d; タブが表示されていない人は、以下の手順で有効にしてください。

 
&#x5b;開発&#x5d; タブを表示する - Office のサポート <br />
[https://support.office.com/ja-jp/article/-%E9%96%8B%E7%99%BA-%E3%82%BF%E3%83%96%E3%82%92%E8%A1%A8%E7%A4%BA%E3%81%99%E3%82%8B-e1192344-5e56-4d45-931b-e5fd9bea2d45](https://support.office.com/ja-jp/article/-%E9%96%8B%E7%99%BA-%E3%82%BF%E3%83%96%E3%82%92%E8%A1%A8%E7%A4%BA%E3%81%99%E3%82%8B-e1192344-5e56-4d45-931b-e5fd9bea2d45)

 
コードを書く前にもう一点確認。テーブル内のセルのひとつにカーソルを置いた状態で &#x5b;デザイン&#x5d; タブを開いてテーブル名を確認します。以下の画面キャプチャだと、左上の方に "テーブル1" と入力されている部分がそれです。 

 
![]({{site.assets_url}}2015-11-15-image5.png)

 
では、&#x5b;開発&#x5d; タブにある &#x5b;Visual Basic&#x5b; をクリックして VBA の画面を起動します。ほとんど VB6 と同じですね。

 
XML の読み書きには MSXML を使いたいので、まずは参照設定を追加します。メニューから &#x5b;ツール&#x5d; &gt; &#x5b;参照設定&#x5d; を選びます。

 
![]({{site.assets_url}}2015-11-15-image6.png)

 
ライブラリのリストから Microsoft XML というのを探して、チェックをつけてから OK をクリックします。v3.0 と v6.0 の両方がありましたが、新しい方の v6.0 を選んでおきます。

 
![]({{site.assets_url}}2015-11-15-image7.png)

 
コードを追加します。Sheet1 または ThisWorkbook のどちらかのモジュールに紐付ける、もしくは新規にモジュールを作る、という選択肢がありますが、今回は ThisWorkbook にコードを追加します。ＴｈｉｓWorksheet を右クリックして、コンテキスト メニューの &#x5b;コードの表示&#x5d; を選びます。

 
![]({{site.assets_url}}2015-11-15-image8.png)

 
コードをごにょごにょ書きます。先ほど確認した "テーブル1" というテーブル名をそのまま使っています。

 
```
Option Explicit 
Private Function AddElementToNode(xmlObj As MSXML2.DOMDocument60, rootNode As MSXML2.IXMLDOMNode, elementName As String, elementValue As String) As MSXML2.IXMLDOMNode 
    Dim newElement As MSXML2.IXMLDOMElement 
    Set newElement = xmlObj.createElement(elementName) 
    newElement.Text = elementValue 
    Set AddElementToNode = rootNode.appendChild(newElement) 
End Function

Private Sub AddAttributeToElement(xmlObj As MSXML2.DOMDocument60, rootElement As MSXML2.IXMLDOMElement, attributeName As String, attributeValue As String) 
    Dim newAttribute As MSXML2.IXMLDOMAttribute 
    Set newAttribute = xmlObj.createAttribute(attributeName) 
    newAttribute.Text = attributeValue 
    rootElement.setAttributeNode newAttribute 
End Sub

Sub ExportTableToXml() 
    Dim sheet1 As Worksheet 
    Set sheet1 = ThisWorkbook.Worksheets(1) 
    
    Dim outputFile As String 
    outputFile = ThisWorkbook.Path & "\001.xml" 
    
    Dim msg As String 
    Dim result As String 
    msg = "If [" & outputFile & "] exists, overwrite it?" 
    result = MsgBox(msg, vbYesNo, "Just to make sure...") 
    
    If result = vbNo Then Exit Sub 
    
    Dim table1 As range 
    Set table1 = range("テーブル1") 
               
    Dim xmlObj As MSXML2.DOMDocument60 
    Set xmlObj = New MSXML2.DOMDocument60

    xmlObj.async = False 
    xmlObj.setProperty "SelectionLanguage", "XPath" 
    
    xmlObj.appendChild xmlObj.createProcessingInstruction("xml", "version='1.0' encoding='utf-8'")

    Dim rootElement As MSXML2.IXMLDOMElement 
    Set rootElement = xmlObj.createElement("root") 
    
    Dim itemsContainer As MSXML2.IXMLDOMElement 
    Set itemsContainer = xmlObj.createElement("items") 
    rootElement.appendChild itemsContainer 
    
    Dim row As Integer 
    For row = 1 To table1.Rows.Count 
        Dim itemElem As MSXML2.IXMLDOMElement 
        Set itemElem = xmlObj.createElement("item") 
        
        Dim col As Integer 
        For col = 1 To table1.Columns.Count 
            Dim colName As String 
            colName = table1.Cells(0, col) 
            
            If LCase(colName) = "title" Then 
                AddAttributeToElement xmlObj, itemElem, colName, table1.Cells(row, col) 
            Else 
                AddElementToNode xmlObj, itemElem, colName, table1.Cells(row, col) 
            End If 
        Next

        itemsContainer.appendChild itemElem 
    Next 
    
    xmlObj.appendChild rootElement 
    xmlObj.Save outputFile 
    
    msg = "[" & outputFile & "] has been created/updated." 
    MsgBox msg, vbOKOnly, "Done." 
End Sub
```
 
プロシージャ呼び出しにはカッコをつけない、オブジェクトを New するときは Set を使う、などの意味不明な文法に苦労しましたが、まあこれで動きます。

 
ユーザビリティを考えるのであれば、ワークシートのほうにボタンを配置して、そこからマクロを呼ぶようにするのが自然でしょうか。というわけで、ワークシートに戻って &#x5b;開発&#x5d; タブから &#x5b;デザイン モード&#x5d; に入ってボタンを挿入します。&#x5b;マクロの登録&#x5d; ダイアログが出てくるので、先ほど作ったプロシージャ ExportTableToXml() を選択して OK をクリックします。

 
![]({{site.assets_url}}2015-11-15-image9.png)

 
こんな感じになりました。

 
![]({{site.assets_url}}2015-11-15-image10.png)

 
ボタンをクリックすると出力ファイルのパスとともに確認ダイアログが出るようにしています。出力ディレクトリは Excel ファイルと同じところ、ファイル名は 001.xml で固定です。

 
![]({{site.assets_url}}2015-11-15-image11.png)

 
出力がうまくいけば、以下のようなダイアログが出ます。

 
![]({{site.assets_url}}2015-11-15-image12.png)

 
出力された XML をブラウザー (ここでは Chrome) で開いて確認します。もとの Sushi.xml とほぼ同じです。変えた部分は、root 直下の items 以外のノードを削除したことと、本のタイトルを &lt;title&gt; ノードの値からく、&lt;item&gt; の name 属性に移動したことです。

 
![]({{site.assets_url}}2015-11-15-image13.png)

