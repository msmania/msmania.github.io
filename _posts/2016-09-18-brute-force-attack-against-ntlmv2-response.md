---
layout: post
title: "Brute-force attack against NTLMv2 Response"
date: 2016-09-18 18:44:18.000 -07:00
categories:
- C/C++
- Network
- Security
- Windows
tags:
- HMAC-MD5
- NTLM
- NTLMv2
---

2016 年 9 月の Windows Update で、NTLM SSO の動作に関連する脆弱性 CVE-2016-3352 が修正されたようです。

 
Microsoft Security Bulletin MS16-110 - Important <br />
[https://technet.microsoft.com/library/security/MS16-110](https://technet.microsoft.com/library/security/MS16-110)

 
_An information disclosure vulnerability exists when Windows fails to properly validate NT LAN Manager (NTLM) Single Sign-On (SSO) requests during Microsoft Account (MSA) login sessions. An attacker who successfully exploited the vulnerability could attempt to brute force a user’s NTLM password hash._

 
_To exploit the vulnerability, an attacker would have to trick a user into browsing to a malicious website, or to an SMB or UNC path destination, or convince a user to load a malicious document that initiates an NTLM SSO validation request without the consent of the user._

 
CVE - CVE-2016-3352 <br />
[http://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2016-3352](http://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2016-3352)

 
_Microsoft Windows 8.1, Windows RT 8.1, and Windows 10 Gold, 1511, and 1607 do not properly check NTLM SSO requests for MSA logins, which makes it easier for remote attackers to determine passwords via a brute-force attack on NTLM password hashes, aka "Microsoft Information Disclosure Vulnerability."_

 
"NTLM SSO" などのキーワードで適当にインターネット検索すると、今年 8 月に書かれた以下の記事が見つかります。

 
The Register - Reminder: IE, Edge, Outlook etc still cough up your Windows, VPN credentials to strangers <br />
[http://www.theregister.co.uk/2016/08/02/smb_attack_is_back/?mt=1474231650819](http://www.theregister.co.uk/2016/08/02/smb_attack_is_back/?mt=1474231650819)

 
画面キャプチャーを見ると、なんと Microsoft アカウントのパスワードが解析されてしまっています。そして Youtube の埋め込み動画では、SMB パケットがブラウザーからリークしていることを示しています。つまり、SMB パケットに埋め込まれた NTLM メッセージに対して brute-force 攻撃をしかけることで Microsoft アカウントのパスワードを解析できる、ことを示しているようです。

 
これは理論的に可能でしょう。が、もしそれが 「簡単に」 できるのであれば、それは NTLM プロトコルの死を意味するべきであり、パッチとして一朝一夕に対応できるものではないはずです。SSLv3 や RC4 と同様にそのプロトコルの使用を止めるべきですが、非ドメイン環境において NTLM の代わりとなるような認証プロトコルは Windows には実装されていないはずです。

 
というわけで、NTLM に対する brute-force がどれぐらい簡単なのかを調べることにしました。まず、NTLM プロトコルがどうやってユーザー認証を行っているかを説明します。と言っても以下の PDF を読み解くだけです。

 
&#x5b;MS-NLMP&#x5d;: NT LAN Manager (NTLM) Authentication Protocol <br />
[https://msdn.microsoft.com/en-us/library/cc236621.aspx](https://msdn.microsoft.com/en-us/library/cc236621.aspx)

 
NTLM が混乱を招く点として、一つのプロトコルが複数のプロトコル バージョン (LanMan, NTLMv1, NTLMv2) に対応していることです。Wiki の情報を見ると NTLMv2 は NT 4.0 SP4 から採用されているので、 NTLMv2 だけで現在は問題なく生きていけるはずです。ただし XP などの古い OS において、さらに古い OS との互換性のために NTLMv1 や Lanman に fallback するような動作が有効になっている場合があります。このへんの細かい話は長くなりそうなので、以下の KB に丸投げします。

 
NT LAN Manager - Wikipedia, the free encyclopedia <br />
[https://en.wikipedia.org/wiki/NT_LAN_Manager](https://en.wikipedia.org/wiki/NT_LAN_Manager)

 
How to prevent Windows from storing a LAN manager hash of your password in Active Directory and local SAM databases <br />
[https://support.microsoft.com/en-us/kb/299656](https://support.microsoft.com/en-us/kb/299656)

 
Security guidance for NTLMv1 and LM network authentication <br />
[https://support.microsoft.com/en-us/kb/2793313](https://support.microsoft.com/en-us/kb/2793313)

 
NTLM は Challenge Reponse Authentication の一つで、簡単に書くとサーバーとクライアントが以下 3 つのメッセージを交換することで認証が行われます。（仕様によると Connectionless モードの場合は Negotiate が存在しないようですが、見たことがないのでパス。）

 
> Client: "I want you to authenticate me."
(= Negotiate Message)

> Server: "Sure. Challenge me. Use 0x0123456789abcdef as a ServerChallenge."
(= Challenge Message)

> Client: "My response is !@#$%^&*()_+..."
(= Authenticate Message)
 
NTLM は単体で使われるプロトコルではなく、必ず別のプロトコルに埋め込まれて使われます。例えば SMB の中で使われる場合には、SMB Session Setup コマンドに埋め込まれます。ダイレクト SMB ポートである 445/tcp をキャプチャーしたときの Network Monitor 上での見え方は以下の通りです。

 
![]({{site.assets_url}}2016-09-18-01.png) <br />
SMB packets over 445/tcp (Lines highlited in purple contain NTLM messages)

 
![]({{site.assets_url}}2016-09-18-02.png) <br />
NTLM Negotiate Message

 
![]({{site.assets_url}}2016-09-18-03.png) <br />
NTLM Challenge Message

 
![]({{site.assets_url}}2016-09-18-04.png) <br />
NTLM Authenticate Message

 
セクション 3.3.2 NTLMv2 Authentication から、パスワードを解析するのに必要な疑似コードの計算式だけを抜き出すと以下の通りです。

 
&#x5b;MS-NLMP&#x5d;: NTLM v2 Authentication - 3.3.2 NTLM v2 Authentication <br />
[https://msdn.microsoft.com/en-us/library/cc236700.aspx](https://msdn.microsoft.com/en-us/library/cc236700.aspx)

 
```
Define NTOWFv2(Passwd, User, UserDom) As 
  HMAC_MD5(MD4(UNICODE(Passwd)), 
           UNICODE(ConcatenationOf(Uppercase(User), UserDom))) 
EndDefine

Set temp to ConcatenationOf(Responserversion, 
                            HiResponserversion, 
                            Z(6), 
                            Time, 
                            ClientChallenge, 
                            Z(4), 
                            ServerName, Z(4)) 
Set NTProofStr to HMAC_MD5(ResponseKeyNT, 
                           ConcatenationOf(CHALLENGE_MESSAGE.ServerChallenge, 
                                           temp)) 
Set NtChallengeResponse to ConcatenationOf(NTProofStr, temp)
```
 
使用しているハッシュ関数は HMAC_MD5 と MD4 のみ。入力データはいろいろあって面倒そうに見えますが、それほど難しくありません。特に、疑似コードの中で temp として扱われているバージョンやタイムスタンプなどのメタ情報が、ハッシュ値である NTProofStr と連結してそのまま Authenticate Message の NtChallengeResponse になっているからです。図示したものを ↓ に示します。図中の Metainfo が、上記擬似コードで言うところの temp です。

 
実際に処理するときは、パスワードを UTF-16 に変換する点と、ユーザー名を大文字に変換する点に注意が必要です。

 
![]({{site.assets_url}}2016-09-18-05.png) <br />
Calculation of NtChallengeResponse in NTLMv2

 
これで材料が出揃ったのでコードを書きます。まずサーバー側のコードとして、Samba サーバーが NTLM メッセージを処理しているときに、brute-force に必要となる情報をテキスト ファイルとして書き出すようにします。これによって、前述の Youtube 動画がやっていることとほぼ同じことができます。

 
Yandex SMB hash capture on IE with email message - YouTube <br />
[https://www.youtube.com/watch?v=GCDuuY7UDwA](https://www.youtube.com/watch?v=GCDuuY7UDwA)

 
msmania/samba at ntlm-hack <br />
[https://github.com/msmania/samba/tree/ntlm-hack](https://github.com/msmania/samba/tree/ntlm-hack)

 
テキスト ファイルと同じ内容をレベル 0 のデバッグ メッセージとしても出力するようにしました。gdb を使って smbd を実行しておくと、SMB 経由で NTLM 認証が行なわれたときにコンソールにログが記録されます。出力される情報はこんな感じです。後でまとめて grep できるようにあえてテキスト ファイルにしました。

 
```
Domain: 
User: ladyg 
Client: LIVINGROOM-PC 
UserAndDomain=4c004100440059004700 
Challenge=ae65c9f0192d64b9 
Auth=0101000000000000b62acefc2d11d201ea3017d2f290d64e00..(長いので省略) 
Response=39329a4a4e9052fe3d4dea4ea9c79ac5
```
 
次に、Samba サーバーが書き出したテキスト ファイルに対して実際に brute-force を行うプログラムを書きます。hashcat に新しいモードを付け足すことができればベストだったのですが、OpenCL を勉強する時間がなかったので、OpenSSL の関数を呼び出すだけの簡単なプログラムになりました。

 
msmania/ntlm-crack <br />
[https://github.com/msmania/ntlm-crack](https://github.com/msmania/ntlm-crack)

 
このプログラムは Samba が生成したテキスト ファイルに対して、別の引数として指定したのテキスト ファイルの各行をパスワードとして NTLMv2 Reponse を生成し、Samba が出力したデータと一致するかどうかを比較します。パスワード一覧ファイルは、ネット上で探せば簡単に見つかります。ntlm-crack リポジトリにサンプルとして入れてある 10_million_password_list_top_1000.txt は、以下のリポジトリからコピーしたものです。

 
GitHub - danielmiessler/SecLists <br />
[https://github.com/danielmiessler/SecLists](https://github.com/danielmiessler/SecLists)

 
では実際にコマンドを実行して brute-force の速度を計測します。マシン スペックは以下の通り。Windows マシンであればもっと新しいマシンで hashcat をぶん回せたのですが・・無念。

 
- OS: Ubuntu 16.04.1 LTS (GNU/Linux 4.4.0-36-generic x86_64) 
- CPU: Intel(R) Core(TM) i5-2520M CPU @ 2.50GHz (Sandy Bridge) 

 
とりあえず 100 万通りのパスワードを試してみます。

 
```
$ ./t -f sample.in -l /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt 
No matching password in /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt. 
Tried 999999 strings in 3343 msec. 
$ ./t -f sample.in -l /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt 
No matching password in /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt. 
Tried 999999 strings in 3372 msec. 
$ ./t -f sample.in -l /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt 
No matching password in /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt. 
Tried 999999 strings in 3344 msec.
```
 
大体 3 秒ちょいです。特に工夫をしたわけでもないのですが、予想していたより速いです。UTF-16 変換の処理を予め済ませて、かつ並列処理をすれば 1M/s は軽く越えられそう。

 
もちろん実際に使われているのはこんな子供騙しではありません。参考として 4 年前の記事ですが、25-GPU を使って 95^8 通りのハッシュを 5.5 時間で生成できたと書かれています。ここでいう NTLM cryptographic algorithm が厳密に何を意味するのかは書かれていません。巷では、UTF-16 エンコードしたパスワードの MD4 ハッシュを NTLM ハッシュと呼ぶことが多く、仮にそうだとすると、5.5 時間という数字には HMAC-MD5 を 2 回計算する部分が含まれていません。試しに、今回作った ntlm-crack から HMAC-MD5 の演算を飛ばして再度実行してみます。

 
```
$ ./t -f sample.in -l /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt 
No matching password in /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt. 
Tried 999999 strings in 347 msec. 
$ ./t -f sample.in -l /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt 
No matching password in /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt. 
Tried 999999 strings in 347 msec. 
$ ./t -f sample.in -l /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt 
No matching password in /data/src/SecLists/Passwords/10_million_password_list_top_1000000.txt. 
Tried 999999 strings in 346 msec.
```
 
計算時間が約 1/10 で済んでしまいました。この比率が 25-GPU マシンにも適用されるとすると、8 文字のパスワードをクラックするのに 4 年前は 55 時間かかっていたはずです。怪しい概算ですが。

 
25-GPU cluster cracks every standard Windows password in &lt;6 hours | Ars Technica <br />
[http://arstechnica.com/security/2012/12/25-gpu-cluster-cracks-every-standard-windows-password-in-6-hours/](http://arstechnica.com/security/2012/12/25-gpu-cluster-cracks-every-standard-windows-password-in-6-hours/)

 
今年は AlphaGo のニュースが衝撃でしたが、そのときの Nature 論文では 1,920 CPUs + 280 GPUs のマシンで AlphaGo を動かしたという実績が書かれているので、個人での所有は難しいにしても、あるべきところ (Google や NSA?) には 4 桁のプロセッサーを動かせるマシンが存在していると仮定できます。これで 2 桁分稼げるので、10 桁程度のパスワードであれば数日で解ける恐れがあります。12 桁のパスワードにしておけば年単位の時間が必要になるので安心かも・・・？

 
話が逸れておきましたが、冒頭の CVE-2016-3352 の話に戻ります。Security Bulletin には、以下のような修正がなされたと書かれています。つまり、誰彼構わず NTLM SSO 認証のための SMB パケットを送るのは止めた、ということでしょうか。

 
> The security update addresses the vulnerability by preventing NTLM SSO authentication to non-private SMB resources when users are signed in to Windows via a Microsoft Account network firewall profile for users who are signed in to Windows via a Microsoft account (https://www.microsoft.com/account) and connected to a “Guest or public networks” firewall profile.
 
この修正ができたということは、 「不特定多数のサーバーに SMB パケットを送ってしまう動作があったため、本来できないはずの brute-force 攻撃の標的になってしまう」 ことが問題とされていたわけです。これでようやく、Security Bulletin の "An attacker who successfully exploited the vulnerability could attempt to brute force" という部分が腑に落ちました。この件に関して言えば、brute-force の成功が現実的かどうかは関係なく、brute-force が可能であることそのものが問題だったわけです。NTLM はまだ生きていていいんだ。

 
あえてケチをつけるならば、CVE の方の記述における "to determine passwords via a brute-force attack on NTLM password hashes" でしょうか。NTLM は複数のハッシュ (MD4 と HMAC-MD5) を使いますが、NTLM password hash と書くと、パスワードのハッシュ、すなわち一段階目の MD4 ハッシュを想定するのが普通です。しかし、MD4 ハッシュは一回目の HMAC-MD5 の鍵として使われるだけで、ネットワーク上を流れることはなく、brute-force の攻撃対象にはなりません。Microsoft 側の Security Bulletin では "attempt to brute force a user’s NTLM password hash" となっており、こちらの記述のほうがより正確な気がします。最近の流行は pass-the-hash 攻撃なので、平文のパスワードに替えて、ハッシュ値が brute-force の標的であってもおかしくはありません。

 
ところで、なぜ Microsoft アカウントに関する言及があるかというと、冒頭で紹介した The Register の記事にもありますが、Microsoft アカウントのユーザー名がユーザーのメール アドレスであり、OneDrive や MSDN などのサービスのアカウントとしても使われているからです。世界のどこかにあるパソコンのユーザー アカウント "Mike" のパスワードが分かってもできることは限られていますが、Microsoft アカウントのパスワードが解析されると大変なことになります。だからこそ今までこの古いバグが放置されてきたのかもしれません。ただ、ユーザー名が平文で SMB として流れるのは気持ち悪いですが。

 
<font color="#0000ff">(2016/9/19 追記)</font>

 
9 月のアップデート後に、LAN ディスクや SAMBA にアクセスできなくなったというツイートやフォーラムを幾つか見つけましたが、おそらく CVE-2016-3352 に対する修正が原因と思われます。どうするんでしょうかね。

 
update kb3185614の不具合について、LANDISKへの接続やリモートアクセスができなくなる - マイクロソフト コミュニティ <br />
[http://answers.microsoft.com/ja-jp/windows/forum/windows_10-update/update/f5219540-a2a5-4b09-b9b6-e944dcbbed38](http://answers.microsoft.com/ja-jp/windows/forum/windows_10-update/update/f5219540-a2a5-4b09-b9b6-e944dcbbed38)

