---
layout: post
title: "[Android] Android 開発環境 on Windows + Eclipse"
date: 2011-05-04 23:25:49.000 +09:00
categories:
- Android
tags:
- Eclipse
- IS06
- SIRIUS
---

スマートフォンを買おうかどうか迷っていたところで、3年以上使った携帯電話が水没し、見事に引導を渡されました。そして買いました Android。8 年ぐらい使い続けている ezweb のメール アドレスにも愛着があるので、au からは乗り換えず。ガラケー機能は不要なので、PANTECH の IS06 (SIRIUS α) を購入。余計な機能がないので値段が安いのも魅力。前の端末が水没したということもあって、防水機能付きの IS04 も気になったが、大きすぎ。大きさと重さを考えるだけでも IS06 一択。

 
[http://jp.pantech.com/products/siriusis06.html](http://jp.pantech.com/products/siriusis06.html) <br />
[http://www.au.kddi.com/seihin/ichiran/smartphone/is06/index.html](http://www.au.kddi.com/seihin/ichiran/smartphone/is06/index.html)

 
余談ですが、スマートフォンをスマホと略すのに抵抗がある。せめてスマフォだろ、と。スマホって音の響きがダサいよね。

 
閑話休題、このブログの流れ的には SDK を入れてアプリを作らないと、ということで初回は環境構築編です。モバイルアプリを作るのは初めてです。Java はけっこう苦手だったりします。.NET が対応してくれないかなー、なんてね。WIndows Phone 7 の日本上陸が待ち遠しい。おっと、また話が逸れました。

 
世には既に Android 開発系ブログが星の数ほど出回っていますが（まあこのブログもその星の一つですがね）、やはり一次情報を見ながら環境を作るのが一番勉強になります。そこで、本家のこちらを参考に進めていきます。

 
[http://developer.android.com/sdk/installing.html](http://developer.android.com/sdk/installing.html)

 
必要なものはこのページに書いてあります。 <br />
[http://developer.android.com/sdk/requirements.html](http://developer.android.com/sdk/requirements.html)

 
私が使ったバージョンはこちら。

 
- 開発マシン OS: Windows 7 SP1 x64 
- IDE: Eclipse 3.6.2 
- Java: JDK 1.6.0_21 
- SDK: Android SDK Revision 10 

 
なお、IS06 に入っている Android のバージョンは 2.2.1 です。

 
インストールの順番としては、JDK → Eclipse → Android SDK ですかね。

 
### 1. JDK インストール

 
すみません、もともとインストールされていたので画面キャプチャないです。まあ特段難しいことはないので、普通にインストーラーの指示に従って進めて下さい。ダウンロード URL はここです。

 
[http://java.sun.com/javase/ja/6/download.html](http://java.sun.com/javase/ja/6/download.html)

 
Java のページもだいぶ Oracle 色になってきました。お決まりですが、間違って JRE をインストールしないように。

 
デフォルトのインストール パスは C:\Program Files\Java\&lt;JDK バージョン&gt; となります。インストーラーは環境変数の変更まではしてくれないので、環境変数をこんな感じに設定しておきます。これもわりとお決まりです。

 
JAVA_HOME= C:\Program Files\Java\jdk1.6.0_21 <br />
PATH= %JAVA_HOME%\bin;&lt;追加前のPATH&gt;

 
### 2. Eclipse インストール

 
ここからダウンロードして下さい。

 
[http://eclipse.org/downloads/](http://eclipse.org/downloads/)

 
前述の Android Developers のページにこんなことが書いてあります。

 
```
The "Eclipse Classic" version is recommended. Otherwise, a Java or RCP version of Eclipse is recommended
```
 
余計なプラグインは入れるなということでしょうか。私は "Eclipse IDE for Java Developers" をダウンロードしました。

 
eclipse は特にインストーラーはないので、ダウンロードした zip に含まれる eclipse フォルダーを Program Files などの適当なフォルダーに解凍して下さい。その ecplise フォルダーの中にある eclipse.exe を起動して下さい。 <br />
![]({{site.assets_url}}2011-05-04-image.png)

 
ワークスペースは、プロジェクトを入れるフォルダーです。マイドキュメントなど適当なフォルダーを指定します。毎回表示させておくほうがいいです。 <br />
![]({{site.assets_url}}2011-05-04-image1.png)

 
起動しました。 <br />
![]({{site.assets_url}}2011-05-04-image2.png)

 
各種プラグインをアップデートします。メニューから Help &gt; Check for Updates を選択して下さい。あとはウィザードに従って進めて下さい。最後に Eclipse を再起動します。このへんは Android と関係ないですが、慣習です。 <br />
![]({{site.assets_url}}2011-05-04-image3.png)

 
### 3. Android SDK インストール

 
ここからダウンロードします。ここでは、推奨となっている exe のインストーラーを使って進めます。 <br />
[http://developer.android.com/sdk/index.html](http://developer.android.com/sdk/index.html)

 
ダウンロードした exe を実行します。 <br />
![]({{site.assets_url}}2011-05-04-image4.png)

 
環境変数の設定が足りないと、「JDK が見つからない」 と怒られます。前述の JAVA_HOME などの設定をして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image5.png)

 
JDK が見つかるとこうなります。 <br />
![]({{site.assets_url}}2011-05-04-image6.png)

 
特に拘りがなければ全部デフォルトでよさそうです。 <br />
![]({{site.assets_url}}2011-05-04-image7.png) → ![]({{site.assets_url}}2011-05-04-image8.png) → ![]({{site.assets_url}}2011-05-04-image9.png) → ![]({{site.assets_url}}2011-05-04-image10.png)

 
インストールが終わると、自動的に SDK Manager が起動してきますが、ここでは &#x5b;Cancel&#x5d; をクリックして閉じて下さい。

 
ここでは &#x5b;Cancel&#x5d; <br />
![]({{site.assets_url}}2011-05-04-image11.png)

 
この段階で &#x5b;Installed packages&#x5d; には &#x5b;Android SDK&#x5d; のみが表示されています。 <br />
![]({{site.assets_url}}2011-05-04-image12.png)

 
### 4. Eclipse 設定

 
次に Eclipse 側の設定を行ないます。まずは、Eclipse の Android 開発用プラグイン ADT (=Android Development Tools) をインストールします。Eclipse を起動し、メニューから Help &gt; Install New Software を選択して下さい。

 
Add をクリックして、アップデート サイトを登録します。 <br />
![]({{site.assets_url}}2011-05-04-image13.png)

 
以下のように入力して &#x5b;OK&#x5d; をクリックして下さい。

 
Name: アップデート サイト名 （任意なので、ADT Plugin など） <br />
Location: [https://dl-ssl.google.com/android/eclipse/](https://dl-ssl.google.com/android/eclipse/)

 
![]({{site.assets_url}}2011-05-04-image14.png)

 
"Developer Tools" にチェックを付けて &#x5b;Next&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image15.png)

 
&#x5b;Next&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image16.png)

 
&#x5b;Finish&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image17.png)

 
未署名なので警告が出てきますが、構わず &#x5b;OK&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image18.png)

 
インストールが終わったら &#x5b;Restart Now&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image19.png)

 
再起動したら、Eclipse の設定を行ないます。メニューから Window &gt; Preferences を選択して下さい。

 
こんなダイアログが出てきたら、使用状況を Google に送るかどうかを選んで &#x5b;Proceed&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image20.png)

 
Preference ダイアログの Android ページで、SDK Location に Android SDK をインストールしたフォルダーを入力して &#x5b;Apply&#x5d; をクリックして下さい。Android SDK のデフォルトのインストール場所は C:\Program Files (x86)\Android\android-sdk です。まだ後述の手順を実施していないので、この段階では SDK Target は何も表示されなくて OK です。 <br />
![]({{site.assets_url}}2011-05-04-image21.png)

 
### 5. SDK の各コンポーネントのインストール

 
Android のプラットフォーム毎のコンポーネントをインストールします。スタートメニューなどから SDK Manager を管理者特権で実行して下さい。スタートメニューに登録していない場合は、android-sdk\SDK Manager.exe を直接実行して下さい。

 
Available packages から、インストールしたいコンポーネントを選んで &#x5b;Install Selected&#x5d; をクリックして下さい。ここでは、以下のものを選択しています。Platform-tools と SDK Platform は必須です。

 
- Android SDK Platform-tools
- Documentation for Android SDK
- SDK Platform Android 2.2
- Samples fpr SDK API 11

 
![]({{site.assets_url}}2011-05-04-image22.png)

 
なお、 Android Developers のページには Usb Driver も入れるように書いてありますが、SDK Manager には出てきません。これは開発用にドライバーがあるわけではなく、端末を買ったときについてくるドライバーで OK です。IS06 の場合は、下記 URL からダウンロードしました。

 
[http://jp.pantech.com/support/download_siriusis06.html](http://jp.pantech.com/support/download_siriusis06.html)

 
&#x5b;Install Selected&#x5d; をクリックすると以下のようなダイアログが表示されるので、&#x5b;Accept All&#x5d; をクリックして &#x5b;Install&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image23.png)

 
管理者特権で起動していない場合、画面は成功したかのように見えますが、&#x5b;Done. Nothing was installed.&#x5d; と表示されていて、何もインストールされていないので気を付けましょう。 <br />
![]({{site.assets_url}}2011-05-04-image24.png)

 
次のようなダイアログが表示された場合は &#x5b;Yes&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image25.png)

 
インストールが成功すると、以下のようなダイアログが表示されます。 <br />
![]({{site.assets_url}}2011-05-04-image26.png)

 
SDK Manager の Installed packages から、インストールされたコンポーネントを確認して下さい。 <br />
![]({{site.assets_url}}2011-05-04-image27.png)

 
Eclipse のメニューから Windows &gt; Preference &gt; Android を選択し、SDK Target が正しく認識されていることを確認して下さい。 <br />
![]({{site.assets_url}}2011-05-04-image28.png)

 
### 6. "Hello, Android" を作ってみる

 
環境構築は完了ですが、ここで終わっても面白くないので、HelloAnroid アプリを作ってみましょう。

 
SDK Manager を起動し、Virtual Devices の画面で &#x5b;New&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image29.png)

 
以下のように入力し、&#x5b;Create AVD&#x5d; をクリックして下さい。いつでも修正できるので、細かい値は適当に入力して下さい。なお、AVD は Android Virtual Devices の略です。デバッグなどで使うための、Android エミュレーターです。

 
Name: Android22API8 （任意の仮想デバイス名） <br />
Target: アプリを動かすプラットフォームを選択。 <br />
SD Card: エミュレートする SD カードの容量 <br />
Skin: エミュレーターの画面サイズ。IS06 に合わせて 480x800 で設定。

 
![]({{site.assets_url}}2011-05-04-image30.png)

 
AVD が登録されました。 <br />
![]({{site.assets_url}}2011-05-04-image31.png)

 
次に Eclipse を起動し、メニューから File &gt; New &gt; Project を選択し、新規プロジェクトの選択画面で、Android &gt; Android &gt; Project を選択して &#x5b;Next&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image32.png)

 
以下のように入力して &#x5b;Finish&#x5d; をクリックして下さい。もちろんここには任意の名前が入力可能です。

 
Project name: HelloAndroid <br />
Application name: Hello, Android （アイコンの名前にはここの文字列が使われます） <br />
Package name: local.android.helloandroid <br />
Create Activity: HelloAndroid

 
![]({{site.assets_url}}2011-05-04-image33.png)

 
HelloAndroid &gt; src &gt; local.android.helloandroid &gt; HelloAndroid.java を開き、ソースコードを以下のように変更します。

 
```
package local.android.helloandroid;

import android.app.Activity; 
import android.os.Bundle;

import android.widget.TextView;

public class HelloAndroid extends Activity { 
    /** Called when the activity is first created. */ 
    @Override 
    public void onCreate(Bundle savedInstanceState) { 
        super.onCreate(savedInstanceState); 
        TextView tv= new TextView(this); 
        tv.setText("Hello, Android."); 
        setContentView(tv); 
        //setContentView(R.layout.main); 
    } 
}
```
 
メニューから Run &gt; Run を選択すると、以下のようなダイアログが表示されるので、&#x5b;Android Applicatiion&#x5d; を選択して &#x5b;OK&#x5d; をクリックして下さい。

 
![]({{site.assets_url}}2011-05-04-image34.png)

 
エミュレーターが起動するので、アプリが起動するまで待ちます。

 
![]({{site.assets_url}}2011-05-04-image35.png) → ![]({{site.assets_url}}2011-05-04-image36.png) → ![]({{site.assets_url}}2011-05-04-image37.png)

 
そして、無事 Hello, Android が起動しました。 <br />
![]({{site.assets_url}}2011-05-04-image38.png)

 
### 7. 実デバイス上で実行する

 
やはり実デバイス上で動かさないと面白くないですよね。

 
Eclipse で AndroidManifest.xml を開き、Debuggable を true に設定して下さい。 <br />
![]({{site.assets_url}}2011-05-04-image39.png)

 
次に Android 端末から、設定 &gt; システム &gt; アプリケーション &gt; 開発 &gt; USB デバッグ を ON にして下さい。

 
端末を USB で接続し、以下のコマンドを実行して、正しく接続されているかを確認して下さい。

 
```
C:\Program Files (x86)\Android\android-sdk\platform-tools> adb devices

List of devices attached 
JMASAI01110185028886 device ← 接続されているデバイス
```
 
Eclipse のメニューから Run &gt; Run Configurations を選択し、&#x5b;Deployment Target Selection Mode&#x5d; を &#x5b;Manual&#x5d; に設定して &#x5b;Close&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image40.png)

 
Eclipse のメニューから Run &gt; Run を選択すると、仮想デバイスか実デバイスで動かすかを選択するダイアログが表示されるので、&#x5b;Choose a running Android device&#x5d; を選択して &#x5b;OK&#x5d; をクリックして下さい。 <br />
![]({{site.assets_url}}2011-05-04-image41.png)

 
Hello, Android がちゃんと動きました。これで、USB 経由のデバッグができます。便利ですね。 <br />
![]({{site.assets_url}}2011-05-04-cimg1455_mini.jpg)

 
アプリが完成したら、プロジェクトフォルダーの bin の中にある apk ファイルを端末の SD カードなどにコピーすれば動きます。ちなみに apk ファイルは単なる zip です。無事に認識されると、メニューに表示されます。

 
左下に Hello, Android がある。 <br />
![]({{site.assets_url}}2011-05-04-cimg1461_mini.jpg)

