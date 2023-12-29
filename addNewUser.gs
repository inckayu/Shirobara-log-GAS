// 新規ユーザがワークスペースに入った場合にfirestoreに反映
const addNewUser = (contents) => {
  const user = contents.event.user
  const id = user.id
  const profile = user.profile
  const message = `白ばらのSlackワークスペースへようこそモル:bangbang:\n<https://docs.google.com/document/d/${GOOGLE_DOCUMENT_SLACK}|Slackの使い方をまとめたドキュメント>があるモルから、ぜひ読んで確認してほしいモル:star-struck:\n90日以前のメッセージを見たい場合は、<${SHIROBARA_LOG_URL}|白ばらSlackログ>から見れるモル:bangbang:。パスワードは \`${SHIROBARA_LOG_PASSWORD}\` モルよ:bangbang:\n\nちなみに僕はバーチャルアイドルモルモットっていうアイドルモル:star-struck:好きなチャンネルで僕のことをメンションして質問してくれたらなんでも答えてあげるモルよ:bangbang:質問には画像を添付することもできるモル。\n質問の頭に[draw]をつけると、絵を描くことができるモル:star-struck:`

  postDMAsMolmot(id, message)

  const content = {
    [id]: {
      id,
      name: profile.display_name || profile.real_name, // display_nameが存在しないor空文字列の場合はreal_nameを使用
      icon: profile.image_512,
    }
  }

  for (let i=1; i<5; i++) {
    try {
      firestore.updateDocument(`info/users`, content, true);
      break
    } catch {
      const message = `新規ユーザ参加イベントの反映に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>新規ユーザID: ${content.id}\n新規ユーザ名: ${content.name}`
      postMessage(SLACK_CHANNEL_LOG, message)
    }
  }
}