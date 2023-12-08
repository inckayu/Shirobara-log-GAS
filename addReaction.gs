// メッセージにリアクションが付与されたときにfirestoreに反映
const addReaction = (inputReaction) => {
  // リアクションが押されたメッセージのタイムスタンプからメッセージIDを取得
  const targetMessage = inputReaction.targetMessageTS
  const channel = inputReaction.channel
  const channelName = searchChannel(inputReaction.channel)
  const user = inputReaction.user
  const userName = searchUser(user)
  const reaction = inputReaction.reaction

  /**
   * リアクション追加/削除イベントには当該リアクションの対象のメッセージIDが含まれず、メッセージのタイムスタンプしか含まれない。
   * logスプシの作成者(=片岡勇輝)以外のアカウントによるリアクションイベントにはメッセージIDが付与されているがリアクション対象のメッセージのIDとは異なる(何のID？)
   * 以上の理由からリアクション対象のメッセージを特定するにはタイムスタンプを使うしかない
   * 
   * 編集済みのメッセージに対してリアクションがされた場合、当該リアクションイベントのitem.tsはメッセージの変更時間ではなく投稿時間
  */

  for (let i=1; i<5; i++) {
    try {
      // firestoreからpostAtがtargetMessage(タイムスタンプ)と一致するメッセージのIDを取得
      // タイムスタンプを1000倍しているため四捨五入かなにかの影響でタイムスタンプが完全に一致せずメッセージを取得できない場合がある(けっこうな割合で取得できない)ので一定の範囲内で該当するものを取得
      const doc = firestore.query(`messages/channels/${channel}`).Where("postAt", ">=", parseInt(targetMessage)-10).Where("postAt", "<=", parseInt(targetMessage)+10).Execute()
      
      if (doc.length > 1) {
        let messages = ""
        doc.forEach((item, index) => {
          messages += `*${index}* : ${item.fields.text.stringValue}\n`
        })
        const message = `リアクション対象メッセージのタイムスタンプと近いメッセージが${doc.length}件ヒットしました。firestoreには1つめのメッセージにリアクションを反映します。\n\n>>>${messages.slice(0, 50)}...`
        postMessage(SLACK_CHANNEL_LOG, message)
      }

      var id = doc[0].fields.id.stringValue //tryスコープ外でも使いたい
      break
      
    } catch (e) {
      const message = `リアクションイベントの反映に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>エラーメッセージ: ${e.message}\nリアクションされたメッセージのタイムスタンプ: ${timestamp(parseInt(targetMessage) / 1000)}\nチャンネル: ${channelName}\nユーザ: ${userName}\nリアクション: :${reaction}:`
      // sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
    }
  }

  // reactionsに追加する新規リアクションの情報をまとめる
  // postAtをキーとするオブジェクト
  let newReaction = {}
  newReaction[`${inputReaction.postAt}`] = {
    reaction: inputReaction.reaction,
    user: inputReaction.user,
    postAt: inputReaction.postAt,
    deletedAt: inputReaction.deletedAt,
  }

  for (let i=1; i<5; i++) {
    try {
      var document = firestore.getDocument(`messages/channels/${channel}/${id}`) // forスコープ外で使いたい
      break
    } catch (e) {
      const message = `リアクションされたメッセージ情報の取得に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n>>>エラーメッセージ: ${e.message}`
      // sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
    }
  }

  try {
    // 既存のreactionsを取得
    const reactions = Object.values(document.fields.reactions.mapValue.fields)
    const reactionsKey = Object.keys(document.fields.reactions.mapValue.fields)
    let reactionsObj = {}
    reactions.forEach((reaction, index) => {
      const fields = reaction.mapValue.fields
      if (
        /**
        既存のreactionsからinputReactionのreactionとuserが一致し、かつ削除されていないもの以外
        同一ユーザが複数リアクションをした場合や、ある特定のリアクションが複数ユーザにされた場合を想定
        つまり既存のreactionsをすべてreactionsObjに追加する
        */

        (inputReaction.reaction !== fields.reaction.stringValue ||
        inputReaction.user !== fields.user.stringValue) &&
        inputReaction.deletedAt === null
        ) {
          const content = {
            reaction: fields.reaction.stringValue,
            user: fields.user.stringValue,
            postAt: parseInt(fields.postAt.integerValue),
            deletedAt: null,
          }
          reactionsObj[`${reactionsKey[index]}`] = content
        }
    })
    // reactionsObj: 既存のリアクション
    // newReaction: 新しく追加されたリアクション
    reactionsObj = {...reactionsObj, ...newReaction}

    for (let i=1; i<5; i++) {
      try {
        firestore.updateDocument(`messages/channels/${channel}/${id}`, {reactions: reactionsObj}, true)
        break
      } catch {
        const message = `リアクションの追加に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>ユーザ: ${newReaction[`${inputReaction.postAt}`].user}\nチャンネル: ${newReaction[`${inputReaction.postAt}`].channel}\nリアクション: :${newReaction[`${inputReaction.postAt}`].reaction}:\n新規ユーザ名: ${content.name}`
        sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
      }
    }

  } catch {
      for (let i=1; i<5; i++) {
        try {
        // reactionsがない場合新たに作る
        firestore.updateDocument(`messages/channels/${channel}/${id}`, {reactions: newReaction}, true)
        break
      } catch (e) {
        const message = `リアクションの新規追加に失敗しました。${i === 4 ? "" : String(i) + "度目の再試行を行います。"}\n\n>>>ユーザ: ${newReaction[`${inputReaction.postAt}`].user}\nチャンネル: ${newReaction[`${inputReaction.postAt}`].channel}\nリアクション: :${newReaction[`${inputReaction.postAt}`].reaction}:\n新規ユーザ名: ${content.name}`
        sheetErrors.appendRow([timestampToTime(parseInt(String(Date.now()).slice(0, 10))), message])
      }
    }
  }
}