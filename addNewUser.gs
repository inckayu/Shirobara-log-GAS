// 新規ユーザがワークスペースに入った場合にfirestoreに反映
const addNewUser = (contents) => {
  const user = contents.event.user
  const profile = user.profile
  const content = {
    [user.id]: {
      id: user.id,
      name: profile.display_name || profile.real_name, // display_nameが存在しないorから文字列の場合はreal_nameを使用
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