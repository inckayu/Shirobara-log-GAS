const emojiExtractor = (text) => {
  let emojis = []
  /**
   * メッセージのテキストから絵文字部分(Emojisの要素に該当するもの)を抽出している
   * テキスト中で用いられたカスタムリアクションはは抽出されず、firestoreのメッセージフィールドのemojisにも含まれないがreactアプリ側で画像として処理されるので問題ない
   * 2023/05/30 21:00以前のメッセージについてはカスタムリアクションも含まれるが当該時刻以降のメッセージは含まれない
  */
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
    if (Emojis.includes(emoji)) {
      emojis.push(text.slice(firstColonIndex+1, lastColonIndex))
      text = text.replace(text.slice(firstColonIndex, lastColonIndex + 1), "")
    } else if (secondColonIndex !== -1 && !Emojis.includes(emoji)) {
      text = text.replace(text.slice(firstColonIndex, lastColonIndex), "")
    } else if (secondColonIndex === -1 && !Emojis.includes(emoji)) {
      return emojis
    } else {
      return emojis
    }
  }
  console.log(emojis)
}

// メッセージに含まれるメンション一覧を配列にして返す
const mentionDetecter = (text) => {
  let mentions = []
  const possibleMentionedNumber = 50

  for (let i=0; i < possibleMentionedNumber; i++) {
    const firstIndex = text.indexOf("@U")
    const lastIndex = text.indexOf(">")
    const isMentionExistence = text.includes("@U")

    //メッセージからメンション先をすべてリストに追加したらループ終了
    if (!isMentionExistence) {
      break;
    }
    mentions.push(text.slice(firstIndex+1, lastIndex))
    text = text.replace(text.slice(firstIndex - 1, lastIndex + 1), "")//replaceする文字列が複数存在する場合は左から初めのものしかreplaceされない
  }
  return mentions;//メンションの配列を返す
}

// タイムスタンプから年月日と日時を取得
const timestampToTime = (ts) => {
  const date = new Date(ts * 1000);
  const yyyy = `${date.getFullYear()}`;
  const MM = `0${date.getMonth() + 1}`.slice(-2);
  const dd = `0${date.getDate()}`.slice(-2);
  const HH = `0${date.getHours()}`.slice(-2);
  const mm = `0${date.getMinutes()}`.slice(-2);
  const ss = `0${date.getSeconds()}`.slice(-2);

  return `${yyyy}/${MM}/${dd} ${HH}:${mm}:${ss}`;
}

// メッセージイベントからユーザIDを抽出
const extractUser = (contents) => {
  if (contents.event.user) {
    return contents.event.user
  } else if (contents.event.bot_id) {
    return contents.event.bot_id
  } else {
    if (contents.event.subtype === "message_changed") {
      return contents.event.message.user
    } else {
      return contents.event.previous_message.user
    }
  }
}


// メッセージイベントからテキストを抽出
const extractText = (contents) => {
  if (contents.event.text === "" || contents.event.text) {
    return contents.event.text.replace(/\n/g, "¥n")
  } else {
    if (contents.event.subtype === "message_changed") {
      return contents.event.message.text.replace(/\n/g, "¥n")
    } else {
      return contents.event.previous_message.text.replace(/\n/g, "¥n")
    }
  }
}

// メッセージイベントからタイムスタンプを抽出
const extractTS = (contents) => {
  if (contents.event.ts) {
    return contents.event.ts
  } else if (contents.event.event_ts) {
    return contents.event.event_ts
  } else {
    return contents.event.ts
  }
}


// メッセージイベントからメッセージIDを抽出
const extractId = (contents) => {
  if (contents.event.app_id || contents.event.bot_id || contents.event.attachments) {
    // botのメッセージにはIDが付与されないのでこちらで生成する
    const firstRandomId = getAutoId(8)
    const secondRandomId = getAutoId(4)
    const thirdRandomId = getAutoId(4)
    const forthRandomId = getAutoId(4)
    const finalRandomId = getAutoId(12)
    return `${firstRandomId}-${secondRandomId}-${thirdRandomId}-${forthRandomId}-${finalRandomId}`
  }
  if (contents.event.client_msg_id) {
    return contents.event.client_msg_id
  } else {
    if (contents.event.subtype === "message_changed") {
      return contents.event.message.client_msg_id
    } else {
      try {
        return contents.event.previous_message.client_msg_id
      } catch {
        return generateRandomMessageId()
      }
    }
  }
}


// メッセージイベントからテキストを取得
const getText = (contents) => {
  if (contents.event.type === "message") {
    const targetText = extractText(contents)
    return targetText
  } else {
    return ""
  }
}

// メッセージイベントから編集前メッセージを取得
const getPreviousMessage = (contents) => {
  if (contents.event.subtype === "bot_message") return ""
  if (contents.event.type === "message") {
    // FIXME: contents.event.previous_messageはオブジェクトなので返り値の型に整合性がない
    const previousMessage = contents.event.subtype === 'message_changed' ? contents.event.previous_message : ""
    return previousMessage
  } else {
    return ""
  }
}