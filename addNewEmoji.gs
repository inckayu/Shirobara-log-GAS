// 新規カスタム絵文字が追加された場合にfirestoreに反映する
const addNewEmoji = (contents) => {
  const subtype = contents.event.subtype
  switch (subtype) {
    case "add":
      // スプシにも追加
      sheetEmojis.getRange(lastRowEmojis + 1, 1).setValue(`:${contents.event.name}:`)
      sheetEmojis.getRange(lastRowEmojis + 1, 1).setBackground("#ffbf87")

      const content = {
        [contents.event.name]:{
          image: contents.event.value,
          name: contents.event.name
          }
      }

      for (let i=1; i<5; i++) {
        try {
          firestore.updateDocument(`info/customReactions`, content, true);
          break
        } catch {
          const message = `新規リアクションの追加に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>チャンネル: ${channelName}\nユーザ: ${userName}\nリアクション: :${reaction}:`
          postMessage(SLACK_CHANNEL_LOG, message)
        }
      }
      break
    default:
      break
  }
}