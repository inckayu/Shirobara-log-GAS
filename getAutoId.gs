// digit桁のランダムなIDを生成
const getAutoId = (digit) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let autoId = ''
  for (let i = 0; i < digit; i += 1) {
    autoId += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return autoId
}
