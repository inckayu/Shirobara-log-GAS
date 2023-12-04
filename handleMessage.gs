const handleMessage = (contents) => {
  const targetUser = extractUser(contents)
  const targetChannel = contents.event.channel || contents.event.item.channel
  const targetTS = extractTS(contents)
  const targetText = getText(contents)
  const previousMessage = getPreviousMessage(contents)
  const targetId = extractId(contents)

  // loggerとGithubのメッセージは保存しない
  // エラーが起きるたびloggerがメッセージを投稿して加速度的に処理イベント数が増えるのを防ぐため
  // githubの装飾テキストはエラーになるため
  const blackUserList = [
    SLACK_LOGGER_ID,
    SLACK_GITHUB_ID,
  ]

  if (targetChannel.slice(0, 1) === "D" || blackUserList.includes(targetUser)) return
  if (contents.event.subtype === "channel_join") return
  searchChannel(targetChannel)
  userName = searchUser(targetUser)
  setSlackChannelInfoInSheet()
  channelName = searchChannel(targetChannel)

  // 書き込むシートとその最終行を取得
  try {
    var targetSheet = ss.getSheetByName('channel_' + channelName)
    var lastRowTargetSheet = targetSheet.getLastRow()
  } catch {
    const message = `メッセージが投稿されたチャンネルがスプレッドシートに存在しませんでした。新しく作成します。`
    postMessage(SLACK_CHANNEL_LOG, message)

    const logHeader = [
      "テキスト",
      "投稿者",
      "投稿日時",
      "チャンネル",
      "返信先メッセージ",
      "タイムスタンプ",
      "編集元メッセージ",
      "投稿者ID",
      "メンション先ID",
      "添付ファイル有無",
      "ID",
    ]
    const channel = contents.event.channel
    const newChannelSheet = ss.insertSheet()
    newChannelSheet.setName('channel_' + channel.name)
    newChannelSheet.appendRow(logHeader)
    var targetSheet = ss.getSheetByName('channel_' + channel.name)
    var lastRowTargetSheet = targetSheet.getLastRow()
  }

  // ファイルのURLを取得しファイルシートに記録
  let filesOutput = []
  if (contents.event.files) {
    const files = contents.event?.files || {}
    files.forEach((file) => {
      const fileInfo = [targetId, file.name, file.url_private, targetUser, targetChannel, targetTS]
      filesOutput.push(fileInfo)
      sheetFiles.appendRow(fileInfo)
    })
  }

  // thread_tsはリプライの宛先のメッセージのts
  if (contents.event.thread_ts || previousMessage.thread_ts) {
    // メッセージがリプライであった場合、セルの色をオレンジにする
    targetSheet.getRange(lastRowTargetSheet + 1, 1, 1, 7).setBackground("#ffbf87")

    for (let i=1; i<5; i++) {
      try {
        // addReactionの処理とほぼ同じ
        const tempTS = parseFloat(contents.event.thread_ts || previousMessage.thread_ts)*1000000
        const doc = firestore.query(`messages/channels/${targetChannel}`).Where("postAt", ">=", parseInt(tempTS)-10).Where("postAt", "<=", parseInt(tempTS)+10).Execute()

        if (doc.length > 1) {
          let messages = ""
          doc.forEach((item, index) => {
            messages += `*${index}* : ${item.fields.text.stringValue}\n`
          })
          const message = `返信元メッセージのタイムスタンプと近いメッセージが${doc.length}件ヒットしました。firestoreには1つめのメッセージを返信元メッセージとして処理します。\n\n>>>${messages.slice(0, 50)}...`
          postMessage(SLACK_CHANNEL_LOG, message)
        }

        var replyTarget = doc[0].fields.user.stringValue //tryスコープ外でも使いたい
        var replyTargetMessage = doc[0].fields.text.stringValue //tryスコープ外でも使いたい
        break
      } catch (e) {
        const message = `返信元メッセージの取得に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>エラーメッセージ: ${e.message}`
        sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
      }
    }
  }

  let attachments = []
  if (contents.event.attachments) {
    const atc = contents.event.attachments[0]
    attachments = [atc.ts, atc.channel_id, atc.text]
  } else if (contents.event.previous_message?.attachments) {
    const atc = contents.event.previous_message.attachments[0]
    attachments = [atc.ts, atc.channel_id, atc.text]
  }

  const eventDetails = [
    targetText,
    userName,
    timestampToTime(targetTS),
    channelName,
    replyTargetMessage,
    targetTS,
    previousMessage !== "" ? previousMessage.text : "",
    targetUser,
    mentionDetecter(targetText).join(","),
    hasFileExist(contents),
    targetId,
    attachments.length ? attachments : ""
  ]

  const messageType = contents.event.subtype || ""
  const isMessageChanged = messageType === "message_changed" // メッセージ編集
  const isMessageDeleted = messageType === "message_deleted" // メッセージ削除

  const files = [...filesOutput].map((file, index) => {return `${S3_BUCKET_URL}/${targetId}_${index}.${file[2].match(/[^.]+$/)}`});

  let fileObject = {}

  filesOutput.forEach((file, index) => {
    fileObject[`${file[0]}_${index}`] = {
      url: files[index],
      name: file[1],
    }
  })

  let editedMessageId
  let deletedMessageId
  if ((isMessageChanged || isMessageDeleted) && (contents.event.message?.attachments || contents.event.previous_message?.attachments)) {
    for (let i=1; i<5; i++) {
      try {
        // addReactionの処理とほぼ同じ
        const tempTS = parseFloat(contents.event.previous_message.ts)*1000000
        const doc = firestore.query(`messages/channels/${targetChannel}`).Where("postAt", ">=", parseInt(tempTS)-10).Where("postAt", "<=", parseInt(tempTS)+10).Execute()

        if (doc.length > 1) {
          let messages = ""
          doc.forEach((item, index) => {
            messages += `*${index}* : ${item.fields.text.stringValue}\n`
          })
          const message = `編集されたメッセージのタイムスタンプと近いメッセージが${doc.length}件ヒットしました。firestoreには1つめのメッセージを編集されたメッセージとして処理します。\n\n>>>${messages.slice(0, 50)}...`
          postMessage(SLACK_CHANNEL_LOG, message)
        }

        editedMessageId = doc[0].fields.id.stringValue //tryスコープ外でも使いたい
        deletedMessageId = doc[0].fields.id.stringValue //tryスコープ外でも使いたい
        break
      } catch (e) {
        const message = `編集されたメッセージの取得に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>エラーメッセージ: ${e.message}`
        sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
      }
    }
  } else {
    editedMessageId = isMessageChanged ? contents.event.message.client_msg_id : targetId
    deletedMessageId = isMessageDeleted ? contents.event.previous_message.client_msg_id : targetId
  }

  // メッセージが投稿された場合
  const message = {
    id: targetId,
    text: targetText,
    postAt: parseFloat(targetTS)*1000000,
    updatedAt: null,
    deletedAt: null,
    user: targetUser,
    channel: targetChannel,
    repliedMessageTS: parseFloat(contents.event.thread_ts)*1000000 ? parseFloat(contents.event.thread_ts)*1000000 : null,
    previousMessage: null,
    mentions: mentionDetecter(targetText),
    files: filesOutput ? fileObject : null,
    emojis: emojiExtractor(targetText),
    attachments: attachments.length ? {ts: parseFloat(attachments[0])*1000000, channel: attachments[1]} : null,
  }
  
  // メッセージが編集された場合
  const changedMessage = {
    id: editedMessageId,
    text: targetText,
    updatedAt: parseFloat(targetTS)*1000000,
    previousMessage: previousMessage ? previousMessage.text : "",
    emojis: emojiExtractor(targetText),
    mentions: mentionDetecter(targetText),
  }

  // メッセージが削除された場合
  const deletedMessage = {
    id: deletedMessageId,
    deletedAt: parseFloat(targetTS)*1000000,
  }

  // メッセージが送られたチャンネル名のシートに書き込み
  targetSheet.appendRow(eventDetails)
  
  // S3にアップロード
  const up = () => {
    if (isMessageChanged) {
      firestore.updateDocument(`messages/channels/${targetChannel}/${changedMessage.id}`, changedMessage, isMessageChanged);
    } else if (isMessageDeleted) {
      firestore.updateDocument(`messages/channels/${targetChannel}/${deletedMessage.id}`, deletedMessage, isMessageDeleted);
    } else {
      firestore.updateDocument(`messages/channels/${targetChannel}/${message.id}`, message);
    }
    if (filesOutput.length) {
      contents.event.files.forEach((file, i) => {
        uploadToS3(file.url_private, targetId, i)
      })
    }
  }

  for (let i=1; i<5; i++) {
    try {
      up()
      break
    } catch (e) {
      const message = `firestoreへのメッセージ情報の送信に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>エラーメッセージ: ${e.message}\nメッセージID: ${targetId}\nメッセージテキスト: ${targetText}\nユーザ: ${targetUser}\nチャンネル: ${targetChannel}`
      sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
    }
  }

  const emojis = emojiExtractor(targetText)
  const mentions = mentionDetecter(targetText)
  if (replyTarget && !mentions.includes(replyTarget)) {
    mentions.push(replyTarget)
  }

  // メッセージに絵文字が含まれていた場合にreactionsシートを更新。空配列はbooleanの値がfalseにならないのでlengthで判定。
  if(emojis.length) {
    for (i=0; i<emojis.length; i++) {
      if (!mentions.length) {
        const emojiDetails = [
          emojis[i], // 絵文字名
          searchUser(targetUser), // 送信者名
          timestampToTime(targetTS), // 日時
          searchChannel(targetChannel), // チャンネル名
          targetTS,// タイムスタンプ
          targetUser, // 送信者ID
          "", // 受信者ID
          "メッセージ",
        ]
        sheetReactions.appendRow(emojiDetails)
      }
      for (j=0; j<mentions.length; j++) {
        const emojiDetails = [
          emojis[i],
          searchUser(targetUser),
          timestampToTime(targetTS),
          searchChannel(targetChannel),
          targetTS,
          targetUser,
          mentions[j],
          "メッセージ",
        ]
        sheetReactions.appendRow(emojiDetails)
      }
    }
  }
}