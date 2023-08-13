// 各種定数の読み込みなど
const scriptProperties = PropertiesService.getScriptProperties()

// Google Drive
const GOOGLE_DRIVE_BACKUP_FOLDER = scriptProperties.getProperty('GOOGLE_DRIVE_BACKUP_FOLDER')
const SPREADSHEET_LOG = scriptProperties.getProperty('SPREADSHEET_LOG')
const GOOGLE_DOCUMENT_MANUAL = scriptProperties.getProperty('GOOGLE_DOCUMENT_MANUAL')
const GOOGLE_FORM_NEW_CHANNEL = scriptProperties.getProperty('GOOGLE_FORM_NEW_CHANNEL')

// Slack
const SLACK_TOKEN = scriptProperties.getProperty('SLACK_TOKEN')
const SLACK_CHANNEL_LOG = scriptProperties.getProperty('SLACK_CHANNEL_LOG')
const SLACK_CHANNEL_DEV = scriptProperties.getProperty('SLACK_CHANNEL_DEV')
const SLACK_CHANNEL_FREETALK = scriptProperties.getProperty('SLACK_CHANNEL_FREETALK')
const SLACK_ADMIN_ID = scriptProperties.getProperty('SLACK_ADMIN_ID') // admin's user ID
const SLACK_GITHUB_ID = scriptProperties.getProperty('SLACK_GITHUB_ID')
const SLACK_LOGGER_ID = scriptProperties.getProperty('SLACK_LOGGER_ID')
const SLACK_LOGGER_BOT_ID = scriptProperties.getProperty('SLACK_LOGGER_BOT_ID')

// Firebase
const FIRESTORE_EMAIL = scriptProperties.getProperty('FIRESTORE_EMAIL')
const FIRESTORE_KEY = scriptProperties.getProperty('FIRESTORE_KEY')
const FIRESTORE_PROJECT_ID = scriptProperties.getProperty('FIRESTORE_PROJECT_ID')
const FIRESTORE_PRIVATE_KEY_1 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_1')
const FIRESTORE_PRIVATE_KEY_2 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_2')
const FIRESTORE_PRIVATE_KEY_3 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_3')
const FIRESTORE_PRIVATE_KEY_4 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_4')
const FIRESTORE_PRIVATE_KEY_5 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_5')
const FIRESTORE_PRIVATE_KEY_6 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_6')
const FIRESTORE_PRIVATE_KEY_7 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_7')
const FIRESTORE_PRIVATE_KEY_8 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_8')
const FIRESTORE_PRIVATE_KEY_9 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_9')
const FIRESTORE_PRIVATE_KEY_10 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_10')
const FIRESTORE_PRIVATE_KEY_11 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_11')
const FIRESTORE_PRIVATE_KEY_12 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_12')
const FIRESTORE_PRIVATE_KEY_13 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_13')
const FIRESTORE_PRIVATE_KEY_14 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_14')
const FIRESTORE_PRIVATE_KEY_15 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_15')
const FIRESTORE_PRIVATE_KEY_16 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_16')
const FIRESTORE_PRIVATE_KEY_17 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_17')
const FIRESTORE_PRIVATE_KEY_18 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_18')
const FIRESTORE_PRIVATE_KEY_19 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_19')
const FIRESTORE_PRIVATE_KEY_20 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_20')
const FIRESTORE_PRIVATE_KEY_21 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_21')
const FIRESTORE_PRIVATE_KEY_22 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_22')
const FIRESTORE_PRIVATE_KEY_23 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_23')
const FIRESTORE_PRIVATE_KEY_24 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_24')
const FIRESTORE_PRIVATE_KEY_25 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_25')
const FIRESTORE_PRIVATE_KEY_26 = scriptProperties.getProperty('FIRESTORE_PRIVATE_KEY_26')

// AWS S3
const S3_ACCESS_KEY_ID = scriptProperties.getProperty('S3_ACCESS_KEY_ID')
const S3_SECRET_ACCESS_KEY = scriptProperties.getProperty('S3_SECRET_ACCESS_KEY')
const S3_BUCKET_NAME = scriptProperties.getProperty('S3_BUCKET_NAME')
const S3_BUCKET_URL = scriptProperties.getProperty('S3_BUCKET_URL')


// firestore
const firestoreDate = () => {
  const dateArray = {
    email: FIRESTORE_EMAIL,
    key: `-----BEGIN PRIVATE KEY-----\n${FIRESTORE_PRIVATE_KEY_1}\n${FIRESTORE_PRIVATE_KEY_2}\n${FIRESTORE_PRIVATE_KEY_3}\n${FIRESTORE_PRIVATE_KEY_4}\n${FIRESTORE_PRIVATE_KEY_5}\n${FIRESTORE_PRIVATE_KEY_6}\n${FIRESTORE_PRIVATE_KEY_7}\n${FIRESTORE_PRIVATE_KEY_8}\n${FIRESTORE_PRIVATE_KEY_9}\n${FIRESTORE_PRIVATE_KEY_10}\n${FIRESTORE_PRIVATE_KEY_11}\n${FIRESTORE_PRIVATE_KEY_12}\n${FIRESTORE_PRIVATE_KEY_13}\n${FIRESTORE_PRIVATE_KEY_14}\n${FIRESTORE_PRIVATE_KEY_15}\n${FIRESTORE_PRIVATE_KEY_16}\n${FIRESTORE_PRIVATE_KEY_17}\n${FIRESTORE_PRIVATE_KEY_18}\n${FIRESTORE_PRIVATE_KEY_19}\n${FIRESTORE_PRIVATE_KEY_20}\n${FIRESTORE_PRIVATE_KEY_21}\n${FIRESTORE_PRIVATE_KEY_22}\n${FIRESTORE_PRIVATE_KEY_23}\n${FIRESTORE_PRIVATE_KEY_24}\n${FIRESTORE_PRIVATE_KEY_25}\n${FIRESTORE_PRIVATE_KEY_26}\n-----END PRIVATE KEY-----\n`,
    projectId: FIRESTORE_PROJECT_ID
  }
  return dateArray
}
const dateArray = firestoreDate()
const firestore = FirestoreApp.getFirestore(dateArray.email, dateArray.key, dateArray.projectId)

// AWS S3
const uploadToS3 = (url, id, index) => {
  const s3 = getInstance(S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY); 
  const options = {
    "method" : "GET",
    "content-type" : "Application/json",
    "headers" : {
      "Authorization": `Bearer ${SLACK_TOKEN}`
    },
  }
  const response = UrlFetchApp.fetch(url, options)
  const file = response.getBlob()
  const extend = file.getName().match(/[^.]+$/) // ファイルの拡張子を抽出
  const name = `${id}_${index}.${extend}`
  s3.putObject(S3_BUCKET_NAME, name, file, {logRequests:true});
}


let userName = "not found"
let channelName = "not found"
let replyTarget = ""
let replyTargetMessage = ""
let sheetsId = []

//スプレッドシート情報読み込み
const ss = SpreadsheetApp.getActiveSpreadsheet();
const allSheets = ss.getSheets()
const sheetRawData = ss.getSheetByName("info_rawData");
const sheetUsers = ss.getSheetByName("info_users")
const sheetChannels = ss.getSheetByName("info_channels")
const sheetReactions = ss.getSheetByName("log_reactions")
const sheetFiles = ss.getSheetByName("log_files")
const sheetEmojis = ss.getSheetByName("info_emojis")
const sheetErrors = ss.getSheetByName("log_error")

// シートの最終行を取得
const lastRowRawData = sheetRawData.getLastRow()
const lastRowUsers = sheetUsers.getLastRow()
const lastRowChannels = sheetChannels.getLastRow()
const lastRowReactions = sheetReactions.getLastRow()
const lastRowEmojis = sheetEmojis.getLastRow()
const lastRowErrors = sheetErrors.getLastRow()
