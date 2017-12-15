---
layout: post
title: "[Windows Azure] [C#] Blob を操作するコマンドライン ツールの作成"
date: 2011-05-08 13:03:49.000 +09:00
tags:
- Azure
- BeginDownloadToStream
- BeginUploadFromStream
- C#
- IAsyncResult
---

Windows Azure の Blob サービスを使うにあたって、自分用の CUI ツールを作ったので、一応ソースを載せておきます。世にはもっと便利なツールが出回っていると思いますが、特徴はこんな感じです。

 
- コマンドライン 
- 非同期ダウンロード/アップロード 
- アップロード時にメタデータを指定 
- MIME の Content-Type にレジストリの HKCR から取ってきた値を指定 

 
GUI だったら Azure Storage Explorer というのが便利そうです。

 
[http://azurestorageexplorer.codeplex.com/](http://azurestorageexplorer.codeplex.com/)

 
開発/動作環境はこれ。

 
- OS: Windows 7 SP1 x64 
- IDE: Visual Studio 2010 SP1 
- SDK: .NET Framework 4.0 + Windows Azure SDK 1.4 

 
作っていて気づいた注意点など。

 
- Azure SDK をアセンブリに追加する際、 Target Framework を ".NET Framework 4" に変更する必要がある <br />
（デフォルトは ".NET Framework 4 Client Profile" になっている） <br />
![]({{site.assets_url}}2011-05-08-image42.png) 
- CloudBlobClient.GetContainerReference や CloudBlobContainer.GetBlobReference では、コンテナーやブロブの存在確認はできず、存在しなくてもインスタンスが取得できる。存在確認をするためには、FetchAttributes を呼び出して、例外 StorageClientException を補足しなければならない。 <br />
[http://msdn.microsoft.com/en-us/library/microsoft.windowsazure.storageclient.cloudblobclient.getcontainerreference.aspx](http://msdn.microsoft.com/en-us/library/microsoft.windowsazure.storageclient.cloudblobclient.getcontainerreference.aspx) 
- CloudBlob からブロブ名を取得するプロパティがない？ <br />
CloudBlob.Uri.LocalPath だと "/コンテナ名/ブロブ名" になってしまうので、CloudBlob.Uri.Segments.Last() という苦肉の策を使う。 

 
非同期処理については、もちろん CloudBlob.BeginUploadFromStream と CloudBlob.BeginDownloadToStream を使うわけですが、コールバック関数や EndUploadFromStream, EndDownloadToStream は使わなかった。アップロードの前後で記述する関数が変わるのもおかしいから、というのが理由ですが、これって .NET 的に普通なのかが不明。なにぶん独習 C# ぐらいの知識しかないので、Begin/End パターンへの理解が乏しい。

 
コンテナの追加と削除、ページ ブロブやブロック ブロブとしての操作は実装していません。

 
もっと単純なものにする予定だったのが、無駄に凝ってしまった結果がこれ。実質半日ぐらいかかってしまった。 <br />
青字の部分は、自分の Azure アカウントに応じて変更して下さい。

 
最近またコーディング スタイルを変えている。テーマは脱ハンガリアン。変数名の先頭を大文字にするのに抵抗がなくなってきた。でもメンバ変数の頭には m を付けようと思っている。

 
```
// 
// 
//

using System; 
using System.Collections.Generic; 
using System.Linq; 
using System.Text; 
using System.IO;

using Microsoft.Win32; // registry 
using Microsoft.WindowsAzure; 
using Microsoft.WindowsAzure.StorageClient;


namespace AzureBlob { 
    class BlobStorageException : Exception { 
        public BlobStorageException(string Message, bool Dump) 
            : base(Message) { 
            Console.WriteLine(Message + "\n"); 
            if (Dump) DumpUsage(); 
        }

        public BlobStorageException(string Message, 
                                    bool Dump, Exception Base) 
            : base(Message, Base) { 
            Console.WriteLine(Message + "\n"); 
            if (Dump) DumpUsage(); 
        }

        private void DumpUsage() { 
            Console.WriteLine(@"Usage: 
   AzureBlob /list     <container> 
   AzureBlob /info     <container> <blobname> 
   AzureBlob /delete   <container> <blobname> 
   AzureBlob /upload   <container> <blobname> <file> <key1:val1> <key2:val2> 
   AzureBlob /download <container> <blobname> <file> 
"); 
        } 
    }

    class Program { 
        static void Main(string[] args) { 
            Program p = new Program();

            try { 
                p.ParseArguments(args); 
                Console.WriteLine("Done.\n"); 
            } 
            catch (BlobStorageException) { 
                Console.WriteLine("Failed.\n"); 
            } 
        }

        enum CommandType { List = 0, Info, Delete, Upload, Download }; 
        struct ArgumentType { 
            public CommandType Type; 
            public string Command; 
            public int MinimumArguments; 
            public bool BlobMustExist; 
            public ArgumentType(CommandType t, string s, int n, bool b) { 
                Type = t; Command = s; MinimumArguments = n; 
                BlobMustExist = b; 
            } 
        } 
        static ArgumentType[] ArgumentTypes = { 
            new ArgumentType(CommandType.List,     "/list",     2, false), 
            new ArgumentType(CommandType.Info,     "/info",     3, true), 
            new ArgumentType(CommandType.Delete,   "/delete",   3, true), 
            new ArgumentType(CommandType.Upload,   "/upload",   4, false), 
            new ArgumentType(CommandType.Download, "/download", 4, true), 
        }; 
        
        private string PrimaryAccessKey = "ほげほげABCD=="; 
        private string StorageAccount = "ストレージアカウント名"; 
        private CloudBlobContainer GetBlobContainer(string ContainerName, 
                                                    bool IsCreate) { 
            CloudStorageAccount Account = new CloudStorageAccount( 
              new StorageCredentialsAccountAndKey(StorageAccount, 
              Convert.FromBase64String(PrimaryAccessKey)), false); 
            CloudBlobClient BlobClient = Account.CreateCloudBlobClient(); 
            CloudBlobContainer BlobContainer = 
              BlobClient.GetContainerReference(ContainerName);

            //BlobContainerPermissions Permissions = 
            //  new BlobContainerPermissions(); 
            //Permissions.PublicAccess = 
            //  BlobContainerPublicAccessType.Container; 
            //mContainer.SetPermissions(Permissions);

            if (!IsCreate) { 
                try { 
                    BlobContainer.FetchAttributes(); 
                } 
                catch (StorageClientException) { 
                    return null; 
                } 
            }

            // BlobContainer.CreateIfNotExist(); 
            return BlobContainer; 
        }

        string mFile = null; 
        string mBlobName = null; 
        CloudBlobContainer mBlobContainer = null; 
        CloudBlob mBlob = null;

        private void ParseArguments(string[] Arguments) { 
            if (Arguments.Length < 1) 
                throw new BlobStorageException( 
                  "Some parameter are missing.", true); 


            int CommandIndex = -1; 
            for ( int i=0 ; i<ArgumentTypes.Length ; ++i ) { 
                if (Arguments[0].ToLower() == ArgumentTypes[i].Command) { 
                    CommandIndex = i; 
                    break; 
                } 
            }

            if (CommandIndex == -1) 
                throw new BlobStorageException("Bad command.", true); 


            ArgumentType Command= ArgumentTypes[CommandIndex];

            if (Arguments.Length < Command.MinimumArguments) 
                throw new BlobStorageException( 
                  "Some parameter are missing.", true); 


            mBlobContainer = GetBlobContainer(Arguments[1], false); 
            if (mBlobContainer == null) 
                throw new BlobStorageException( 
                  string.Format("The container `{0}` does not exist.", 
                    Arguments[1]), false);

            if (Command.Type == CommandType.List) { 
                OnList(); 
                return; 
            }

            mBlobName = Arguments[2]; 
            mBlob = mBlobContainer.GetBlobReference(mBlobName); 
            if (Command.BlobMustExist) { 
                try { 
                    mBlob.FetchAttributes(); 
                } 
                catch (StorageClientException) { 
                    throw new BlobStorageException( 
                      string.Format("The blob `{0}` does not exist.", 
                        mBlobName), false); 
                } 
            }

            switch (Command.Type) { 
            case CommandType.Info: 
                OnInfo(); 
                break; 
            case CommandType.Delete: 
                OnDelete(); 
                break; 
            case CommandType.Upload: 
                mFile = Arguments[3]; 
                string[] Metadata = new string[Arguments.Length - 4]; 
                Array.Copy(Arguments, 4, Metadata, 0, Arguments.Length - 4); 
                OnUpload(Metadata); 
                break; 
            case CommandType.Download: 
                mFile = Arguments[3]; 
                OnDownload(); 
                break; 
            } 
        }

        private void OnList() { 
            Console.WriteLine("[Blobs in Container]"); 
            foreach (var b in mBlobContainer.ListBlobs()) 
                Console.WriteLine(b.Uri.Segments.Last()); 
            Console.WriteLine(""); 
        }

        private void OnInfo() { 
            Console.WriteLine("[Basics]"); 
            Console.WriteLine(" URI         : {0}", mBlob.Uri.ToString()); 
            Console.WriteLine(" LocalPath   : {0}", mBlob.Uri.LocalPath); 
            Console.WriteLine(""); 
            Console.WriteLine("[Properties]"); 
            Console.WriteLine(" Length      : {0:#,#} bytes", 
              mBlob.Properties.Length); 
            Console.WriteLine(" Content-Type: {0}", 
              mBlob.Properties.ContentType); 
            Console.WriteLine(""); 
            Console.WriteLine("[Metadata]"); 
            foreach (var key in mBlob.Metadata.AllKeys) 
                Console.WriteLine(" {0}: {1}", key, mBlob.Metadata[key]); 
            Console.WriteLine(""); 
        }

        private void OnDelete() { 
            mBlob.Delete(); 
            Console.WriteLine(""); 
        }

        private void Progress(int n) { 
            char[] bars = { '｜', '／', '―', '＼' }; 
            Console.SetCursorPosition(0, Console.CursorTop); 
            Console.Write(bars[n % 4]); 
        }

        private string TickToDuration(long Tick) { 
            Tick /= (1000 * 1000 * 10); // covert fron 100nsec to sec 
            return string.Format("{0:0#}m{1:0#}s", Tick / 60, Tick % 60); 
        }

        private void OnDownload() { 
            //mBlob.DownloadToFile(mFile); 
            
            IAsyncResult Result= null; 
            try { 
                FileStream SerializedFile = new FileStream( 
                  mFile, FileMode.Create, 
                  FileAccess.ReadWrite, FileShare.None); 
                Result = mBlob.BeginDownloadToStream( 
                  SerializedFile, null, null); // no use of callback 
            } 
            catch (Exception e) { 
                throw new BlobStorageException("File I/O error.", false, e); 
            }

            Console.Write("｜ Downloading...");

            bool IsSeekable = true; 
            try { 
                Console.SetCursorPosition(0, Console.CursorTop); 
            } 
            catch { 
                // not seeakable console 
                IsSeekable = false; 
                Console.WriteLine(""); 
            }

            int n = 0; 
            while (Result != null && !Result.AsyncWaitHandle.WaitOne(100)) { 
                if (IsSeekable) Progress(n); 
                n = (n + 1) % 4; 
            }

            Console.WriteLine(""); 
        }

        private void OnUpload(string[] Metadata) { 
            // mBlob.UploadFile(mFile);

            IAsyncResult Result = null; 
            try { 
                FileStream SerializedFile = new FileStream( 
                  mFile, FileMode.Open, FileAccess.Read, FileShare.Read); 
                // mBlob.UploadFromStream(SerializedFile); 
                Result = mBlob.BeginUploadFromStream( 
                  SerializedFile, null, null); // no use of callback 
            } 
            catch (Exception e) { 
                throw new BlobStorageException("File I/O error.", false, e); 
            }

            Console.Write("｜ Uploading...");

            bool IsSeekable = true; 
            try { 
                Console.SetCursorPosition(0, Console.CursorTop); 
            } 
            catch { 
                // not seeakable console 
                IsSeekable = false; 
                Console.WriteLine(""); 
            }

            long StartTime = DateTime.Now.Ticks;

            int n = 0; 
            while (Result!=null && !Result.AsyncWaitHandle.WaitOne(100)) { 
                if ( IsSeekable ) Progress(n); 
                n = (n + 1) % 4; 
            }

            long EndTime = DateTime.Now.Ticks;

            Console.WriteLine("Uploading done - [{0}]\n", 
              TickToDuration(EndTime - StartTime));

            mBlob.Properties.ContentType = 
              GetContentType(Path.GetExtension(mFile)); 
            Console.WriteLine("Content-Type set -> {0}", 
              mBlob.Properties.ContentType); 
            mBlob.SetProperties();

            string key, value; 
            foreach (string s in Metadata) { 
                int pos= s.IndexOf(':'); 
                if (pos == 0) { 
                    Console.WriteLine("Metadata {0} is skipped", s); 
                    continue; 
                } 
                else if (pos == -1) { 
                    key = s; value = ""; 
                    Console.WriteLine("Metadata set -> {0}", key); 
                } 
                else { 
                    key = s.Substring(0, pos); 
                    value = s.Substring(pos + 1); 
                    Console.WriteLine("Metadata set -> {0}: {1}", 
                      key, value); 
                }

                mBlob.Metadata.Add(key, value); 
            } 
            mBlob.SetMetadata();

            Console.WriteLine(""); 
        }

        private string GetContentType(string Extenstion) { 
            RegistryKey RegKey= Registry.ClassesRoot.OpenSubKey(Extenstion); 
            if (RegKey == null) 
                return ""; // Extension is not registered

            string RegValue = RegKey.GetValue("Content Type") as string; 
            return RegValue == null ? "" : RegValue; 
        } 
    } 
} 
```
