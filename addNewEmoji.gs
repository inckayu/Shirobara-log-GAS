// 新規カスタム絵文字が追加された場合にfirestoreに反映する
const addNewEmoji = (contents) => {
  const event = contents.event
  const subtype = event.subtype
  const reaction = event.name
  switch (subtype) {
    case "add":
      // スプシにも追加
      sheetEmojis.getRange(lastRowEmojis + 1, 1).setValue(`:${event.name}:`)
      sheetEmojis.getRange(lastRowEmojis + 1, 1).setBackground("#ffbf87")

      const content = {
        [reaction]:{
          image: event.value,
          name: reaction
          }
      }

      for (let i=1; i<5; i++) {
        try {
          firestore.updateDocument(`info/customReactions`, content, true);
          const message = `新規リアクションが作成されました。\n\n>>>*リアクション*: :${reaction}:`
          postMessage(SLACK_CHANNEL_LOG, message)
          break
        } catch {
          const message = `新規リアクションの追加に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>*リアクション*: :${reaction}:`
          postMessage(SLACK_CHANNEL_LOG, message)
        }
      }
      break
    default:
      break
  }
}