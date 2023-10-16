/**
 * スプシからfirestoreにデータをコピーするときのバッチ処理やfirestoreからのデータ取得のテストなどを行う関数をまとめたファイル
 * 一部バッチ処理はデータ取得をスプシから行っているものがあるのであまり使うべきではない(使えない)
 * その他のファイルで使用している一部の関数はここで定義している
 */

const notifyError = () => {
  const message = "An error occurred."
  sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
}

// 同一イベントが複数回送信されるのを防ぐ
const isCachedId = (id) => {
  const cache = CacheService.getScriptCache();
  const isCached = cache.get(id);
  if (isCached)
  {
    return true;
  }
  cache.put(id, true, 60 * 10); // 10min
  return false;
}

// スプシのバックアップを作成して白ばらgoogle driveに保存する
const createFile = () => {
  const folder = DriveApp.getFolderById(GOOGLE_DRIVE_BACKUP_FOLDER)
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_LOG}/export?format=xlsx`

  try {
    const response = UrlFetchApp.fetch(url);
    const blob = response.getBlob();
    const file = folder.createFile(blob);
    const date = new Date()
    file.setName(`slackログ_${date.getFullYear()}${date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1).toString() : date.getMonth() + 1}${date.getDate() < 10 ? "0" + date.getDate().toString() : date.getDate()}${date.getHours() < 10 ? "0" + date.getHours().toString() : date.getHours()}${date.getMinutes() < 10 ? "0" + date.getMinutes().toString() : date.getMinutes()}`)
  } catch (error) {
    const message = `slackログのバックアップの保存に失敗しました。\n\nエラーメッセージ: ${error.message}`
    postMessage(SLACK_CHANNEL_DEV, message)
    return
  }
  const message = `<https://drive.google.com/drive/u/0/folders/${GOOGLE_DRIVE_BACKUP_FOLDER}|slackログのバックアップ>を保存しました。`
  postMessage(SLACK_CHANNEL_DEV, message)
  return
}

const fetchFirestore = (inputReaction) => {
  // リアクションが押されたメッセージのタイムスタンプからメッセージIDを取得
  const targetMessage = inputReaction.targetMessageTS
  const channel = inputReaction.channel
  const channelName = searchChannel(inputReaction.channel)
  const sheet = ss.getSheetByName(`channel_${channelName}`)
  const lastRow = sheet.getLastRow()
  let id = ""
  for (let i=lastRow; i>=2; i--) {
    const ts = sheet.getRange(i, 6).getValue().toString().replace(".", "")
    if (targetMessage.toString().includes(ts)) {
      id = sheet.getRange(i, 11).getValue()
      break
    }
  }

  // reactionsに追加するリアクションの情報をまとめる
  let newReaction = {}
  newReaction[`${inputReaction.postAt}`] = {
    reaction: inputReaction.reaction,
    user: inputReaction.user,
    postAt: inputReaction.postAt,
    deletedAt: inputReaction.deletedAt,
  }
  console.log(id)
  const doc = firestore.getDocument(`messages/channels/${channel}/${id}`)
  try {
    // 既存のreactionsを取得
    const reactions = Object.values(doc.fields.reactions.mapValue.fields)
    const reactionsKey = Object.keys(doc.fields.reactions.mapValue.fields)
    let reactionsObj = {}
    reactions.forEach((reaction, index) => {
      const fields = reaction.mapValue.fields
      const content = {
        reaction: fields.reaction.stringValue,
        user: fields.user.stringValue,
        postAt: parseInt(fields.postAt.integerValue),
        deletedAt: fields.deletedAt.integerValue ? parseInt(fields.deletedAt.integerValue) : null,
      }
      reactionsObj[`${reactionsKey[index]}`] = content
    })
    reactionsObj = {...reactionsObj, ...newReaction}
    firestore.updateDocument(`messages/channels/${channel}/${id}`, {reactions: reactionsObj}, true)
  } catch {
    // reactionsがない場合新たに作る
    firestore.updateDocument(`messages/channels/${channel}/${id}`, {reactions: newReaction}, true)
  }
}

const messageTS = (channelName, channelId) => {
  loadSheets()
  const sheet = ss.getSheetByName(`channel_${channelName}`)
  const lastRow = sheet.getLastRow()

  for (let i=331; i<=lastRow; i++) {
    const messageId = sheet.getRange(i, 11).getValue()
    console.log(messageId, i)
    for (let j=2; j<=lastRowRawData; j++) {
      const target = JSON.parse(sheetRawData.getRange(j, 1).getValue())
      if (target.type === "message") {
        if (!target.subtype) {
          const rawId = target.client_msg_id
          if (rawId === messageId) {
            // TSを抜き取ってpostAtを更新
            const postAt = target.ts
            if (target.thread_ts) {
              const content = {
                postAt: parseFloat(postAt)*1000000,
                repliedMessageTS: parseFloat(target.thread_ts)*1000000,
              }
              firestore.updateDocument(`messages/channels/${channelId}/${messageId}`, content, true)
            } else {
              const content = {
                postAt: parseFloat(postAt)*1000000,
              }
              firestore.updateDocument(`messages/channels/${channelId}/${messageId}`, content, true)
            }
          }
        } else {
          if (target.subtype === "message_changed") {
            const rawId = target.previous_message.client_msg_id
            if (rawId === messageId) {
              // TSを抜き取ってupdatedAtを更新
              const updatedAt = target.ts
              const content = {
                updatedAt: parseFloat(updatedAt)*1000000,
              }
              firestore.updateDocument(`messages/channels/${channelId}/${messageId}`, content, true)
            }
          }
          if (target.subtype === "message_deleted") {
            const rawId = target.previous_message.client_msg_id
            if (rawId === messageId) {
              // TSを抜き取ってdeletedAtを更新
              const deletedAt = target.ts
              const content = {
                deletedAt: parseFloat(deletedAt)*1000000,
              }
              firestore.updateDocument(`messages/channels/${channelId}/${messageId}`, content, true)
              break
            }
          }
        }
      }
    }
  }
}

const copyReactions = (channelName, channelId) => {
  loadSheets()
  for (let i=2; i<=1634; i++) {
    console.log(i)
    if (sheetReactions.getRange(i, 4).getValue() === channelName && sheetReactions.getRange(i, 8).getValue() !== "メッセージ" && sheetReactions.getRange(i, 9).getValue() !== "") {
      const reaction = sheetReactions.getRange(i, 1).getValue()
      const user = sheetReactions.getRange(i, 6).getValue()
      if (sheetReactions.getRange(i, 8).getValue() === "追加") {
        const content = {
          channel: channelId,
          user,
          reaction,
          postAt: parseFloat(sheetReactions.getRange(i, 5).getValue())*1000000,
          deletedAt: null
        }
        firestore.updateDocument(`messages/reactions/reactions/${sheetReactions.getRange(i, 9).getValue()}-${user}-${reaction}`, content)
      } else if (sheetReactions.getRange(i, 8).getValue() === "削除") {
        firestore.updateDocument(`messages/reactions/reactions/${sheetReactions.getRange(i, 9).getValue()}-${user}-${reaction}`, {deletedAt: parseFloat(sheetReactions.getRange(i, 5).getValue())*1000000,}, true)
      }
    }
  }
}

const setReactionId = (channelName, channelId) => {
  loadSheets()
  for (let i=2; i<=lastRowReactions; i++) {
    console.log(i)
    if (sheetReactions.getRange(i, 4).getValue() === channelName && sheetReactions.getRange(i, 8).getValue() !== "メッセージ" && sheetReactions.getRange(i, 9).getValue() !== "") {
      const reaction = sheetReactions.getRange(i, 1).getValue()
      const user = sheetReactions.getRange(i, 6).getValue()
      if (sheetReactions.getRange(i, 8).getValue() === "追加") {
        const content = {
          messageTS: sheetReactions.getRange(i, 9).getValue()
        }
        firestore.updateDocument(`messages/reactions/reactions/${sheetReactions.getRange(i, 9).getValue()}-${user}-${reaction}`, content, true)
      } else if (sheetReactions.getRange(i, 8).getValue() === "削除") {
        firestore.updateDocument(`messages/reactions/reactions/${sheetReactions.getRange(i, 9).getValue()}-${user}-${reaction}`, {messageTS: sheetReactions.getRange(i, 9).getValue()}, true)
      }
    }
  }
}

const reactions = () => {
  for (let i=285; i<=lastRowReactions; i++) {
    const ts = sheetReactions.getRange(i, 5).getValue()
    console.log(i)
    if (!sheetReactions.getRange(i, 9).getValue()) {
      for (let j=2; j<=lastRowRawData; j++) {
        const target = JSON.parse(sheetRawData.getRange(j, 1).getValue())
        if (target.type === "reaction_added" || target.type === "reaction_removed") {
          const rawTS = target.item.ts
          const targetTS = target.event_ts
          if (targetTS.toString().includes(ts.toString().slice(0, 10))) {
            sheetReactions.getRange(i, 9).setValue(parseFloat(rawTS)*1000000)
            break
          }
        } else if (target.type === "message") {
          const rawTS = target.ts
          const targetTS = target.event_ts
          if (targetTS.toString().includes(ts.toString().slice(0, 11))) {
            sheetReactions.getRange(i, 9).setValue(parseFloat(rawTS)*1000000)
            break
          }
        }
      }
    }
  }
}

const findId = (channelName) => {
  loadSheets()

  const sheet = ss.getSheetByName(`channel_${channelName}`)
  const lastRow = sheet.getLastRow()

  for (let i=88; i<=lastRow; i++) {
    const ts = sheet.getRange(i, 6).getValue().toString().slice(0, 11)
    for (let j=2; j<=lastRowRawData; j++) {
      const target = sheetRawData.getRange(j, 1).getValue().toString()
      console.log(ts, target)
      if (target.includes(ts)) {
        console.log(ts, sheetRawData.getRange(j, 1).getValue().toString())
        const id = target.match(/([a-zA-Z0-9]{8})-([a-zA-Z0-9]{4})-([a-zA-Z0-9]{4})-([a-zA-Z0-9]{4})-([a-zA-Z0-9]{12})/)
        if (id === null) {
          break
        }
        console.log("id found!")
        sheet.getRange(i, 11).setValue(id[0])
        break
      }
    }
  }
}

const findMention = (channelName) => {
  loadSheets()

  const sheet = ss.getSheetByName(`channel_${channelName}`)
  const lastRow = sheet.getLastRow()

  for (let i=2; i<=199; i++) {
    const target = sheet.getRange(i, 1).getValue().toString()
    const mentions = target.match(/([A-Z0-9]{11})/g)
    if (mentions) {
      sheet.getRange(i, 9).setValue(mentions.join(","))
    }
  }
}

const findEmoji = (text) => {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetEmojis = ss.getSheetByName("info_emojis")
  const lastRowEmojis = sheetEmojis.getLastRow()

  let emojis = []
  const emojiList = sheetEmojis.getRange(1, 1, lastRowEmojis).getValues().flat()
  const possibleEmojiNumber = 100

  for (let i=0; i<possibleEmojiNumber; i++) {
    const firstColonIndex = text.indexOf(":")
    const secondColonIndex = text.slice(firstColonIndex+1).indexOf(":")
    if (secondColonIndex === -1) {
      return emojis
    }
    const lastColonIndex = secondColonIndex + firstColonIndex + 1
    if (firstColonIndex === -1 || lastColonIndex === -1) {
      break
    }
    const emoji = text.slice(firstColonIndex, lastColonIndex+1)

    // URLに含まれる":"に引っかからないようにする。
    if (emojiList.includes(emoji)) {
      emojis.push(text.slice(firstColonIndex+1, lastColonIndex))
      text = text.replace(text.slice(firstColonIndex, lastColonIndex + 1), "")
    } else if (secondColonIndex !== -1 && !emojiList.includes(emoji)) {
      text = text.replace(text.slice(firstColonIndex, lastColonIndex), "")
    } else if (secondColonIndex === -1 && !emojiList.includes(emoji)) {
      return emojis
    } else {
      return emojis
    }
  }
}

const copyMessageToFirestore = (channelName, channelId) => {
  const firestoreDate = () => {
    var dateArray = {
      email: FIRESTORE_EMAIL,
      key: `-----BEGIN PRIVATE KEY-----\n${S3_PRIVATE_KEY_1}\n${S3_PRIVATE_KEY_2}\n${S3_PRIVATE_KEY_3}\n${S3_PRIVATE_KEY_4}\n${S3_PRIVATE_KEY_5}\n${S3_PRIVATE_KEY_6}\n${S3_PRIVATE_KEY_7}\n${S3_PRIVATE_KEY_8}\n${S3_PRIVATE_KEY_9}\n${S3_PRIVATE_KEY_10}\n${S3_PRIVATE_KEY_11}\n${S3_PRIVATE_KEY_12}\n${S3_PRIVATE_KEY_13}\n${S3_PRIVATE_KEY_14}\n${S3_PRIVATE_KEY_15}\n${S3_PRIVATE_KEY_16}\n${S3_PRIVATE_KEY_17}\n${S3_PRIVATE_KEY_18}\n${S3_PRIVATE_KEY_19}\n${S3_PRIVATE_KEY_20}\n${S3_PRIVATE_KEY_21}\n${S3_PRIVATE_KEY_22}\n${S3_PRIVATE_KEY_23}\n${S3_PRIVATE_KEY_24}\n${S3_PRIVATE_KEY_25}\n${S3_PRIVATE_KEY_26}\n-----END PRIVATE KEY-----\n`,
      projectId: FIRESTORE_PROJECT_ID
    }
    return dateArray;
  }
  const dateArray = firestoreDate();
  const firestore = FirestoreApp.getFirestore(dateArray.email, dateArray.key, dateArray.projectId);
  const sheet = ss.getSheetByName(`channel_${channelName}`)
  const lastRow = sheet.getLastRow()
  const sheetFiles = ss.getSheetByName("log_files")
  const lastRowFiles = sheetFiles.getLastRow()
  const fileIdList = sheetFiles.getRange(2, 1, lastRowFiles, 1).getValues().flat()
  const sheetRawData = ss.getSheetByName("info_rawData");
  const lastRowRawData = sheetRawData.getLastRow()
  const rawData = sheetRawData.getRange(2, 1, lastRowRawData, 1).getValues().flat()

  for (let i=2; i <= 73; i++) {
    const row = sheet.getRange(i, 1, 1, 11).getValues().flat()
    const [
      text,
      userName,
      postDate,
      channelName,
      repliedMessage,
      ts,
      prevMessage,
      user,
      mentions,
      isFile,
      id,
    ] = row

    if (!id) {continue}

    if (!repliedMessage && !prevMessage) {
      const initContent = {
        files: [],
        emojis: findEmoji(text),
        id,
        mentions: mentions.length ? mentions.split(",") : null,
        previousMessage: null,
        repliedMessageTS: null,
        text,
        user,
        postAt: ts,
        updatedAt: null,
        deletedAt: null,
      }
      firestore.updateDocument(`messages/channels/${channelId}/${id}`, initContent)

    } else if (repliedMessage && !prevMessage){
      let repliedMessageTS = null
      for (let i=2; i<=lastRow; i++) {
        if (sheet.getRange(i, 1).getValue().toString() === repliedMessage) {
          repliedMessageTS = sheet.getRange(i, 6).getValue().toString()
        }
      }
      const replyContent = {
        files: [],
        emojis: findEmoji(text),
        id,
        mentions: mentions.length ? mentions.split(",") : null,
        previousMessage: null,
        repliedMessageTS: parseFloat(repliedMessageTS)*1000000,
        text,
        user,
        postAt: ts,
        updatedAt: null,
        deletedAt: null,
      }
      firestore.updateDocument(`messages/channels/${channelId}/${id}`, replyContent)
    } else if (!repliedMessage && prevMessage) {
      const changedContent = {
        emojis: findEmoji(text),
        mentions: mentions.length ? mentions.split(",") : null,
        previousMessage: prevMessage,
        text,
        updatedAt: null,
      }
      firestore.updateDocument(`messages/channels/${channelId}/${id}`, changedContent, true)
    }
  }
}

const timestamp = (timestamp) => {
  const date = new Date(timestamp);
  const yyyy = `${date.getFullYear()}`;
  const MM = `0${date.getMonth() + 1}`.slice(-2);
  const dd = `0${date.getDate()}`.slice(-2);
  const HH = `0${date.getHours()}`.slice(-2);
  const mm = `0${date.getMinutes()}`.slice(-2);
  const ss = `0${date.getSeconds()}`.slice(-2);

  return `${yyyy}/${MM}/${dd} ${HH}:${mm}:${ss}`;
}

const generateRandomMessageId = () => {
  const firstRandomId = getAutoId(8)
  const secondRandomId = getAutoId(4)
  const thirdRandomId = getAutoId(4)
  const forthRandomId = getAutoId(4)
  const finalRandomId = getAutoId(12)
  return `${firstRandomId}-${secondRandomId}-${thirdRandomId}-${forthRandomId}-${finalRandomId}`
}
