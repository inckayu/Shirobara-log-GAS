// ユーザリストを作成
const getSlackUser = () => {
  
  const options = {
    "method" : "get",
    "contentType": "application/x-www-form-urlencoded",
    "payload" : { 
      "token": SLACK_TOKEN
    }
  };
  
  const url = "https://slack.com/api/users.list";
  const response = UrlFetchApp.fetch(url, options);
  
  const members = JSON.parse(response).members;
  console.log(JSON.stringify(members))
  let arr = [];
  
  for (const member of members) {
    
    //削除済、botユーザー、Slackbotを除く
    if (!member.deleted) {
      let id = member.id;
      let real_name = member.profile.display_name ? member.profile.display_name : member.real_name; //表示名が設定されていない場合は氏名を表示
      arr.push([real_name,id]);
    }
  }
  
  //スプレッドシートに書き込み
  sheetUsers.clear().appendRow(['ユーザ名', 'ユーザID'])
  for (let i=0; i<arr.length; i++) {
    sheetUsers.appendRow(arr[i])
  }
}

// チャンネルリストを作成
const setSlackChannelInfoInSheet = () => {
  const channelInfoArr = [];
  let cursor; //whileの外で宣言だけして未定義undefinedにしておく（空文字にしないこと！そうするとwhileが最初からfalseになって実行されなくなってしまうので）
  while (cursor !== '') { //最終頁ではnext_cursorが空文字列となることを利用したwhile文で全ページを巡回
    const url = 'https://www.slack.com/api/conversations.list';

    const options = {
      method: "get",
      contentType: "application/x-www-form-urlencoded",
      headers: { "Authorization": "Bearer " + SLACK_TOKEN },
      "payload": {
        "token": SLACK_TOKEN,
        "limit": 200, 
        "cursor": cursor,
        "types": "public_channel, private_channel",
      }
    }
  
    //fetchメソッドによる情報取得
    const response = UrlFetchApp.fetch(url, options);
    const conversationsListObj = JSON.parse(response);

    //シートのヘッダーとなるレコードを配列に追加
    channelInfoArr.push(['チャンネル名', 'チャンネルID', 'チャンネル概要'])
    //取得したチャンネルごとに、チャンネル名、チャンネルID、チャンネル概要、アーカイブ済かどうかのレコードを配列に追加
    conversationsListObj.channels.forEach(channel => {
      !channel.is_archived ? (channelInfoArr.push([channel.name, channel.id, channel.purpose.value])) : null
    });
    //次のページをリクエストするためのnext_cursorをレスポンスから抽出してcursorに代入（これがoptionsに入るため、次のページが取れる）
    cursor = conversationsListObj.response_metadata.next_cursor;

    conversationsListObj.channels.forEach((channel) => {
      console.log(channel)
    })
    console.log(JSON.stringify(conversationsListObj))
  }

  //アクティブシートに書き出し
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const targetSheet = ss.getSheetByName('info_channels')
  targetSheet.clear()
    .getRange(1, 1, channelInfoArr.length, channelInfoArr[0].length)
    .setValues(channelInfoArr)
}

// 指定されたチャンネル(channelId)にメッセージを投稿
const postMessage = (channelId, message) => {
  const message_options = {
    "method" : "post",
    "contentType": "application/x-www-form-urlencoded",
    "payload" : {
      "token": SLACK_TOKEN,
      "channel": channelId,
      "text": message,
    }
  };

  UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", message_options)
}

// ユーザのDMのIDを取得
const getChannelID = (userId) => { 
  const options = {
    "method" : "post",
    "contentType": "application/x-www-form-urlencoded",
    "payload" : {
      "token": SLACK_TOKEN,
      "users": userId
    }
  }
  
  //必要scope = im:write
  const url = 'https://slack.com/api/conversations.open';
  const response = UrlFetchApp.fetch(url, options);
  
  const obj = JSON.parse(response);
  console.log(obj);
  
  return obj.channel.id;

}

//botからDMを送る
const postDM = (userId, message) => {
  
  //【処理1】DMを開き、チャンネルIDを取得する
  const channelId = getChannelID(userId)
  
  //【処理2】指定の[チャンネルID]にDMを送信する
  const message_options = {
    "method" : "post",
    "contentType": "application/x-www-form-urlencoded",
    "payload" : {
      "token": SLACK_TOKEN,
      "channel": channelId,
      "text": message,
    }
  };
  
  const message_url = 'https://slack.com/api/chat.postMessage'
  UrlFetchApp.fetch(message_url, message_options)
}