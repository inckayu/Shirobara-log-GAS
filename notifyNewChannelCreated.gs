// 新規チャンネルが作成された場合にチャンネル作成者にフォーム付きメッセージを送信
// devチャンネルでも通知する
const notifyNewChannelCreated = (contents) => {
  const creatorId = contents.event.channel.creator
  const newChannelId = contents.event.channel.id
  const newChannelName = contents.event.channel.name
  postMessage(SLACK_CHANNEL_DEV, `<@${SLACK_ADMIN_ID}>\n<@${creatorId}>が新しいパブリックチャンネル<#${newChannelId}|${newChannelName}>を作成しました。`)

  const encodedURL = encodeURI(`https://docs.google.com/forms/d/e/${GOOGLE_FORM_NEW_CHANNEL}/viewform?usp=pp_url&entry.1847258911=${newChannelId}&entry.1471610540=${newChannelName}`)

  const message = `新しいチャンネルが作成されました。\n投稿から90日以上経過したメッセージを<${SHIROBARA_LOG_URL}|白ばらSlackログ>上で閲覧できるようにするためにチャンネル情報の登録が必要です。\n\n①Slackアプリloggerを<#${newChannelId}|${newChannelName}>に追加(<https://docs.google.com/document/d/${GOOGLE_DOCUMENT_MANUAL}/edit#heading=h.rxtzqkfsaevk|追加方法>)\n②<${encodedURL}|こちらのGoogle Form>からチャンネル情報の入力\n\n以上２点の作業をお願いします。\n\n＊Google FormのリンクはPCから開いてください(スマホから開くと一部内容が自動入力されない場合があります)。\n＊白ばらSlackログのパスワードは \`${SHIROBARA_LOG_PASSWORD}\` です。\n＊プライベートチャンネルを作成した際もメッセージを保存しておきたい場合は同様の手順をお願いします。`

  postDM(creatorId, message)
}
