import firebase_admin
from firebase_admin import credentials, db

# 讀取 Firebase 服務帳戶金鑰
cred = credentials.Certificate("serviceAccountKey.json")

# 初始化 Firebase（請填入你的 Firebase Realtime Database URL）
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://graduateproject-b69cf-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

# 取得資料庫引用
ref = db.reference('/users')

# 寫入資料
ref.set({
    'chien': {
        'age': 21,
        'email': 'chien@example.com'
    }
})

print("資料寫入成功！")