/**
 * GAS上でのslackメッセージやリアクションやユーザなどのデータ取得をfirestoreから行うと読み取り回数が無料枠の制限(5万回)を超えやすくなる。
 * 最初はスプシから読み取ってたのをすべてfirestoreからに置換した(2023/06/02)が、今後slackの投稿やリアクションが増えることを想定するとスプシからの読み取りに戻したほうがいいかもしれない。
 * 上限に達するとGASのrawDataシートにイベント情報を追加する処理以外がほぼすべてストップしてしまう。
 * 上限がリセットされるのは日本時間で17:00。
 * 
 * slackAPIの叩き方(incoming webhookかurl叩くか)によってイベントの内容が変わる(メッセージ送信イベント)。
 * 具体的にはbot_userか普通のユーザかの差。
 * 
 * GASには様々な実行制約がある。
 * 同時実行数は30, スクリプトの最大実行時間は6分, urlfetchの一日あたりの最大実行回数は20000回など。
 * GAS上からslackにメッセージを投稿するたびにurlfetchが叩かれるためエラーをslack上に送信するとすぐに制限に達するので、エラーログはスプシのlog_errorに記録
 * 大量のメッセージとリアクションイベントが発生する土曜夜(アフター後)などは制約に引っかかって動かなくなることがある。
 * そのためGASからlambdaなどに移動したほうが良いかもしない。
 * 
 * 大量のイベントが発生してurlfetchの制限に達することがしばしばあるのでfreetalkのリアクションイベントは一定確率で反映させている(addReaction参照)。
 */

function doPost(e) {
  if (e.postData == "FileUpload") {
    if (e.parameter.payload) {
      return responseUserButtonAction(e)
    }
    // 変数のスコープをifの外にも広げるするためにvarを用いている
    var contents = JSON.parse(e.postData.contents);
    var type = contents.type;


    //URL確認
    if (type == "url_verification") {
      return ContentService.createTextOutput(JSON.stringify(contents.challenge)).setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // 同一イベントが複数回送信された場合は2回目以降処理しない
  if (isCachedId(contents.event?.client_msg_id || String(contents.event.event_ts))) {
    return
  }

  // logに投稿されたメッセージは処理しない
  if (contents.event.channel === SLACK_CHANNEL_LOG) return

  //info_rawDataに書き込み
  sheetRawData.getRange(lastRowRawData + 1, 1).setValue(JSON.stringify(contents.event))
  sheetRawData.appendRow([JSON.stringify(contents.event)])

  // 新規チャンネル作成イベント
  if (contents.event.type === "channel_created") {
    const channels = Object.keys(firestore.getDocument(`info/channels`).fields).includes(contents.event.channel.id)
    if (channels) return
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
    console.log(JSON.stringify(channel))
    try {
      const content = {
        [channel.id]: {
          id: channel.id,
          name: channel.name,
          choirPart: ["all"],
          joinedYear: ["all"],
          roles: ["all"],
          createdAt: parseInt(Date.now())*1000,
          updatedAt: parseInt(Date.now())*1000,
          deletedAt: null,
        }
      }
      firestore.updateDocument(`info/channels`, content, true);
      notifyNewChannelCreated(contents)
    }
    catch (error) {
      const logMessage = `<@${SLACK_ADMIN_ID}>\nGAS:\n\nチャンネル作成イベントの処理中にエラーが発生しました。\n\nエラー>${error}\n\nイベント>${contents.event}`
      postMessage(SLACK_CHANNEL_LOG, logMessage)
    }
    return
  }

  // ユーザ情報変更or新規ユーザ参加イベント
  if (contents.event.type === "user_change" || contents.event.type === "team_join") {
    try {
      addNewUser(contents)
    }
    catch (error) {
      const logMessage = `<@${SLACK_ADMIN_ID}>\nGAS:\n\nユーザ情報変更/ユーザ参加イベントの処理中にエラーが発生しました。\n\nエラー>${error}\n\nイベント>${contents.event}`
      postMessage(SLACK_CHANNEL_LOG, logMessage)
    }
    return
  }
  
  // カスタム絵文字が追加イベント
  if (contents.event.type === "emoji_changed") {
    try {
      addNewEmoji(contents)
    }
    catch (error) {
      const logMessage = `<@${SLACK_ADMIN_ID}>\nGAS:\n\nカスタム絵文字追加イベントの処理中にエラーが発生しました。\n\nエラー>${error}\n\nイベント>${contents.event}`
      postMessage(SLACK_CHANNEL_LOG, logMessage)
    }
    return
  }

  const targetUser = extractUser(contents)
  const targetChannel = contents.event.channel || contents.event.item.channel
  const targetTS = extractTS(contents)

  // リアクション追加or削除イベント
  if (contents.event.type === "reaction_added" || contents.event.type === "reaction_removed") {

    const channel = contents.event.item.channel
    const user = contents.event.item_user
    const reaction = contents.event.reaction
    const date = new Date()
    const hour = date.getHours()
    const dayOfWeek = date.getDay()
    const random = Math.random()

    /*
    freetalkでは大量の投稿とリアクションイベントが発生してurlFetchの回数制限(20000回/日)に
    引っかかることがしばしばあるので、freetalkで水・土の12時以降に発生したリアクションイベントは25%の確率で反映させる。
    それ以外の日時においてもfreetalkで発生したリアクションイベントは50%の確率で反映させる。
    */
    if (channel === SLACK_CHANNEL_FREETALK && contents.event.type === "reaction_added" && (dayOfWeek === 3 || dayOfWeek === 6) && hour >= 12 && random > 0.25) {
      const message = `urlfetchの回数制限を避けるため、今回のfreetalkのリアクションイベントは処理されませんでした。(25%)\n\n>>>ユーザ: ${user}\nリアクション: :${reaction}:`
      sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
      return
    } else if (channel === SLACK_CHANNEL_FREETALK && contents.event.type === "reaction_added" && hour >= 12 && random > 0.5) {
      const message = `urlfetchの回数制限を避けるため、今回のfreetalkのリアクションイベントは処理されませんでした。(50%)\n\n>>>ユーザ: ${user}\nリアクション: :${reaction}:`
      sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
      return
    }

    if (targetChannel.slice(0, 1) === "D" || contents.event.channel === SLACK_CHANNEL_LOG) return

    const event = contents.event
    const eventDetails = [
      event.reaction,
      searchUser(targetUser),
      timestampToTime(targetTS),
      searchChannel(targetChannel),
      event.event_ts,
      targetUser,
      event.item_user,
      event.type == "reaction_added" ? "追加" : "削除",
      parseFloat(event.item.ts)*1000000,
    ]

    const inputReaction = {
      reaction: event.reaction,
      user: targetUser,
      channel: event.item.channel,
      postAt: parseFloat(event.event_ts)*1000000,
      deletedAt: contents.event.type === "reaction_added" ? null : parseFloat(contents.event.event_ts)*1000000,
      targetMessageTS: parseFloat(event.item.ts)*1000000,
    }
    addReaction(inputReaction)
    sheetReactions.appendRow(eventDetails)
    return
  }

  // メッセージ投稿or修正or削除イベント
  if (contents.event.type === "message") {
    try {
      handleMessage(contents)
    }
    catch (error) {
      const message = `<@${SLACK_ADMIN_ID}>\nGAS:\n\nメッセージ送信イベントの処理中にエラーが発生しました。\n\nエラー>${error.message}\n\nイベント>${JSON.stringify(contents.event)}`
      sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
    }
    return
  }
}
