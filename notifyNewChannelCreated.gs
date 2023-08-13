// 新規チャンネルが作成された場合にチャンネル作成者にフォーム付きメッセージを送信
// devチャンネルでも通知する
const notifyNewChannelCreated = (contents) => {
  const creatorId = contents.event.channel.creator
  const newChannelId = contents.event.channel.id
  const newChannelName = contents.event.channel.name
  postMessage(SLACK_CHANNEL_DEV, `<@${SLACK_ADMIN_ID}>\n<@${creatorId}>が新しいパブリックチャンネル<#${newChannelId}|${newChannelName}>を作成しました。`)

  const encodedURL = encodeURI(`https://docs.google.com/forms/d/e/${GOOGLE_FORM_NEW_CHANNEL}/viewform?usp=pp_url&entry.1847258911=${newChannelId}&entry.1471610540=${newChannelName}`)

  const message = `新しいパブリックチャンネル<#${newChannelId}|${newChannelName}>が作成されました:bangbang:\n\n①slackアプリloggerを<#${newChannelId}|${newChannelName}>に追加(<https://docs.google.com/document/d/${GOOGLE_DOCUMENT_MANUAL}/edit#heading=h.rxtzqkfsaevk|追加方法>)\n②<${encodedURL}|こちらのGoogle Form>からチャンネル情報の入力\n\n以上２点の作業をお願いします:bangbang::man-bowing:\n\n\n＊Google FormのリンクはPCから開いてください(スマホから開くと一部内容が自動入力されない場合があります)。`

  postDM(creatorId, message)
}
