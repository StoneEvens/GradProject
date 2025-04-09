import firebase_admin
from firebase_admin import credentials, db
import os

# 從環境變數中讀取憑證檔案路徑
cred_path = os.getenv("FIREBASE_CREDENTIALS")

# 確保環境變數存在
if not cred_path:
    raise ValueError("FIREBASE_CREDENTIALS environment variable is not set")

# 使用憑證檔案初始化 Firebase Admin SDK
cred = credentials.Certificate(cred_path)

# 現在可以使用 Firebase Admin SDK 操作資料庫等
print("Firebase initialized successfully!")

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