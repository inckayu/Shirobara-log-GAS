// メッセージに添付ファイルがあるかどうか判定
// もっとスマートに書けるかも...
const hasFileExist = (contents) => {
  if (contents.event.subtype === "bot_message") return 0
  if(contents.event.files) {
    return 1
  } else if (contents.event.subtype) {
    if(contents.event.subtype === "message_changed") {
      if (contents.event.message.files) {
        return 1
      } else return 0
    } else {
      if (contents.event.previous_message.files) {
        return 1
      } else return 0
    }
  } else return 0
}
