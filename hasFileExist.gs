// メッセージに添付ファイルがあるかどうか判定
// もっとスマートに書けるかも...
const hasFileExist = (contents) => {
  if (contents.event.subtype === "bot_message") return 0
  if (contents.event.subtype === "thread_broadcast") {
    if ("files" in contents.event) {
      return 1
    } else return 0
  }
  if("files" in contents.event) {
    return 1
  } else if ("subtype" in contents.event) {
    if(contents.event.subtype === "message_changed") {
      if ("files" in contents.event.message) {
        return 1
      } else return 0
    } else {
      if ("files" in contents.event.previous_message) {
        return 1
      } else return 0
    }
  } else return 0
}
