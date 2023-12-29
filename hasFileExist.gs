// メッセージに添付ファイルがあるかどうか判定
// もっとスマートに書けるかも...
const hasFileExist = (contents) => {
  const event = contents.event
  const subtype = event.subtype
  if (subtype === "bot_message") return 0
  if (subtype === "thread_broadcast") {
    if ("files" in event) {
      return 1
    } else return 0
  }
  if("files" in event) {
    return 1
  } else if ("subtype" in event) {
    if(subtype === "message_changed") {
      if ("files" in event.message) {
        return 1
      } else return 0
    } else {
      if ("files" in event.previous_message) {
        return 1
      } else return 0
    }
  } else return 0
}
