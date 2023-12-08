// ユーザIDに対応するユーザ名を取得
const searchUser = (targetUser) => {
  for (let i=1; i<5; i++) {
    // firestoreのinfo/usersドキュメントのtargetUserに対応するユーザ名を取得する
    try {
      const doc = firestore.getDocument(`info/users`).fields[targetUser].mapValue.fields
      var userName = doc.name.stringValue
      break
    } catch (e) {
      // loggerの白ばらログへのアクセスメッセージのユーザID(B055FHXJ5S8)が取得できない場合は通知しない
      if (targetUser === SLACK_LOGGER_BOT_ID) return
      const message = `指定されたユーザIDに対応するユーザが見つかりませんでした。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>エラーメッセージ: ${e.message}\nユーザID: ${targetUser}`
      // sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
    }
  }
  return userName
}


// チャンネルIDに対応するチャンネル名を取得
const searchChannel = (targetChannel) => {
  for (let i=1; i<5; i++) {
    // チャンネルID一覧を作成
    try {
      sheetsId = Object.keys(firestore.getDocument(`info/channels`).fields)
      break
    } catch (e) {
      const message = `チャンネルID一覧の取得に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>エラーメッセージ: ${e.message}`
      // sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
    }
  }

  for (let i=1; i<5; i++) {
    // targetChannelに対応するチャンネル名を取得
    try {
      var channelName = firestore.getDocument(`info/channels`).fields[targetChannel].mapValue.fields.name.stringValue
      break
    } catch (e) {
      const message = `指定されたチャンネルIDに対応するチャンネルが見つかりませんでした。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>エラーメッセージ: ${e.message}\nチャンネルID: ${targetChannel}`
      // sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
    }
  }
  return channelName
}