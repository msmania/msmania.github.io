---
layout: post
title: "[Windows] SQL from PowerShell without Additional Cmdlets"
date: 2013-01-03 00:37:48.000 +09:00
categories:
- Windows
tags:
- ADFS
- PowerShell
- SQL
---

ついでにもう一個。

 
SQL Server を操作するときには、SQL Server Management Studio や sqlcmd などの管理ツールを使うのが普通です。最近は SQL Server PowerShell もあるみたいですね。

 
SQL Server PowerShell Overview <br />
[http://msdn.microsoft.com/en-us/library/cc281954(v=sql.105).aspx](http://msdn.microsoft.com/en-us/library/cc281954(v=sql.105).aspx)

 
しかし、SQL Server 向けのモジュールを入れなくても、.NET があれば SQL クエリを発行できるので、標準の PowerShell の機能だけで SQL Server の簡単な操作ならできるはず、ということでやってみました。

 
ADFS や WSUS など、Windows Internal Database の環境には便利かもしれません。管理ツールを追加でインストールすることに制限がある環境には特に。

 
```
# 
# PowerSQL.ps1 
#

if ( $args.Count -eq 0 ) { 
@"

SQL Server Command-Line Tool with PowerShell

USAGE: 
  .\POWERSQL.PS1 -Tab 
  .\POWERSQL.PS1 -Col <Table> 
  .\POWERSQL.PS1 <Query String>

"@; 
    exit 0; 
} 
elseif ( $args[0].ToString().ToUpper() -eq "-TAB" ) { 
    $QueryStr= @" 
SELECT CONCAT(s.name, '.', t.name) 
FROM sys.tables AS t INNER JOIN sys.schemas AS s 
  ON t.schema_id = s.schema_id 
"@; 
} 
elseif ( ($args[0].ToString().ToUpper() -eq "-COL") 
         -and ($args.Count -gt 1) ) { 
    $ColName= $args[1]; 
    $QueryStr= @" 
SELECT o.name, c.name 
FROM sys.columns AS c INNER JOIN sys.tables AS o 
  ON o.object_id = c.object_id WHERE o.name = '$ColName' 
"@; 
} 
else { 
    $QueryStr= $args[0]; 
}

[void][Reflection.Assembly]::LoadWithPartialName("System.Data");

$ConnStr= (gwmi -Namespace root\adfs SecurityTokenService).ConfigurationDatabaseConnectionString;

$SQLConn= New-Object System.Data.SqlClient.SqlConnection($ConnStr); 
$SQLConn.Open();

$SQLComm= $SQLConn.CreateCommand(); 
$SQLComm.CommandText= $QueryStr;

$Table= @();

@" 
Connection String 
----------------- 
$ConnStr

Query String 
------------ 
$QueryStr 
"@;

$Reader= $SQLComm.ExecuteReader(); 
while ( $Reader.Read() ) { 
    $Line= New-Object PSObject; 
    for ( $i=0 ; $i -lt $Reader.FieldCount ; ++$i ) { 
        Add-Member -InputObject $Line ` 
                    -MemberType NoteProperty ` 
                    -Name ("Col"+$i) ` 
                    -Value ($Reader.GetValue($i).ToString()); 
    } 
    $Table+= $Line; 
}

$SQLConn.Close();

$Table | ft -AutoSize; 


 
```
 
もともと ADFS 環境でテストをするために作ったので、接続文字列 $ConnStr は Windows Server 2012 ADFS 専用に WMI から取ってきています。実際には以下の文字列になります。Windows Server 2008 R2 までとは、既定の名前付きパイプ名が異なることに注意。

 
```
Data Source=\\.\pipe\Microsoft##WID\tsql\query;Initial Catalog=AdfsConfiguration;Integrated Security=True
```
 
ADFS 以外のインスタンスに対する接続文字列は、以下のページをご覧下さい。

 
SqlConnection.ConnectionString プロパティ (System.Data.SqlClient) <br />
[http://msdn.microsoft.com/ja-jp/library/system.data.sqlclient.sqlconnection.connectionstring(v=VS.80).aspx](http://msdn.microsoft.com/ja-jp/library/system.data.sqlclient.sqlconnection.connectionstring(v=VS.80).aspx)

 
ExecuteReader メソッドしか実装していないので、対応している SQL 文は SELECT のみです。接続文字列を引数として取るようにして、ExecuteNonQuery メソッドも実装すればより便利になります。テーブルと列の一覧ぐらいは簡単に見れた方がいいので、カタログ ビューを使うクエリは予め実装しておきました。

 
出力例を示します。Windows Server 2012 ADFS での出力例です。

 
```
PS C:\mswork> .\PowerSQL.ps1

SQL Server Command-Line Tool with PowerShell

USAGE: 
  .\POWERSQL.PS1 -Tab 
  .\POWERSQL.PS1 -Col <Table> 
  .\POWERSQL.PS1 <Query String>

PS C:\mswork> .\PowerSQL.ps1 -tab 
Connection String 
----------------- 
Data Source=\\.\pipe\Microsoft##WID\tsql\query;Initial Catalog=AdfsConfiguration;Integrated Securit 
y=True

Query String 
------------ 
SELECT CONCAT(s.name, '.', t.name) 
FROM sys.tables AS t INNER JOIN sys.schemas AS s 
  ON t.schema_id = s.schema_id

Col0 
---- 
IdentityServerPolicy.Policies 
IdentityServerPolicy.ClaimTypes 
IdentityServerPolicy.ClaimDescriptors 
IdentityServerPolicy.ClaimDescriptorExtensibleProperties 
IdentityServerPolicy.Scopes 
IdentityServerPolicy.ScopeIdentities 
IdentityServerPolicy.ScopeSigningCertificates 
IdentityServerPolicy.ScopeClaimTypes 
IdentityServerPolicy.ScopeContactInfoAddresses 
IdentityServerPolicy.ScopePolicies 
IdentityServerPolicy.ScopeExtensibleProperties 
IdentityServerPolicy.Authorities 
IdentityServerPolicy.AuthorityIdentities 
IdentityServerPolicy.AuthorityContactInfoAddresses 
IdentityServerPolicy.AuthorityExtensibleProperties 
IdentityServerPolicy.AuthorityPolicies 
IdentityServerPolicy.MetadataSources 
IdentityServerPolicy.AuthorityArtifactResolutionServices 
IdentityServerPolicy.AuthoritySamlEndpoints 
IdentityServerPolicy.ScopeSamlEndpoints 
IdentityServerPolicy.ScopeAssertionConsumerServices 
IdentityServerPolicy.AuthorityClaimTypes 
IdentityServerPolicy.ServiceSettings 
IdentityServerPolicy.LeasedTasks 
IdentityServerPolicy.ServiceStateSummary 
IdentityServerPolicy.ServiceObjectTypeRelationships 
IdentityServerPolicy.SyncProperties


PS C:\mswork> .\PowerSQL.ps1 -col SyncProperties 
Connection String 
----------------- 
Data Source=\\.\pipe\Microsoft##WID\tsql\query;Initial Catalog=AdfsConfiguration;Integrated Security=True

Query String 
------------ 
SELECT o.name, c.name 
FROM sys.columns AS c INNER JOIN sys.tables AS o 
  ON o.object_id = c.object_id WHERE o.name = 'SyncProperties'

Col0           Col1 
----           ---- 
SyncProperties PropertyName 
SyncProperties PropertyValue


PS C:\mswork> .\PowerSQL.ps1 "select * from IdentityServerPolicy.SyncProperties" 
Connection String 
----------------- 
Data Source=\\.\pipe\Microsoft##WID\tsql\query;Initial Catalog=AdfsConfiguration;Integrated Security=True

Query String 
------------ 
select * from IdentityServerPolicy.SyncProperties

Col0                            Col1 
----                            ---- 
LastSyncFromPrimaryComputerName 
LastSyncStatus                  0 
LastSyncTime                    2012/12/24 11:49:21 
PollDurationInSeconds           300 
PrimaryComputerName 
PrimaryComputerPort             80 
Role                            PrimaryComputer


PS C:\mswork> 


 
```
 
sqlcmd の方がいいな・・・。（ぼそ

