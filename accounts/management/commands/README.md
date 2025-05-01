# JWT 令牌黑名單清理命令

## 目的

在使用 JWT 認證的系統中，當用戶登出或刷新令牌時，舊令牌會被添加到黑名單中以防止重用。隨著時間推移，數據庫中會積累大量過期的黑名單令牌，可能導致數據庫膨脹，影響性能。

這個管理命令用於定期清理過期的黑名單令牌，保持數據庫的整潔和高效。

## 使用方法

### 基本用法

```bash
python manage.py clear_token_blacklist
```

### 選項

- `--dry-run`: 只顯示將被刪除的記錄數量，不實際刪除
- `--verbose`: 顯示詳細日誌

### 示例

```bash
# 查看有多少過期令牌，不實際刪除
python manage.py clear_token_blacklist --dry-run

# 刪除過期令牌並輸出詳細日誌
python manage.py clear_token_blacklist --verbose
```

## 定時執行

建議將此命令添加到定時任務中定期執行。

### 使用 cron（Linux/Mac）

編輯 crontab：

```bash
crontab -e
```

添加每天凌晨 2 點執行的任務：

```
0 2 * * * cd /path/to/your/project && /path/to/python manage.py clear_token_blacklist >> /var/log/token_cleanup.log 2>&1
```

### 使用 Windows 任務計劃程序

1. 打開「任務計劃程序」
2. 創建基本任務
3. 設置每天凌晨 2 點執行
4. 操作設置為啟動程序
5. 程序路徑設置為 Python 解釋器路徑
6. 參數設置為 `manage.py clear_token_blacklist`
7. 啟動路徑設置為項目目錄

## 日誌

命令執行時會輸出以下信息：

- 開始時間
- 發現的過期黑名單令牌數量
- 發現的過期令牌數量
- 已刪除的記錄數量
- 執行耗時
- 執行結果

## 安全考慮

此命令只刪除已過期的令牌，不會影響當前有效的用戶會話。 