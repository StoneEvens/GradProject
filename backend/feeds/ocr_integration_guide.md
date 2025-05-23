# OCR 功能整合指南

## 概述
本檔案為團隊成員整合新的 OCR 功能提供指導。舊的 EasyOCR 實作已完全移除，為新的實作騰出空間。

## 已保留的核心結構

### 1. 資料庫模型欄位 ✅
在 `feeds/models.py` 的 `Feed` 模型中保留了以下重要欄位：

```python
# 營養成分欄位（OCR 目標欄位）
protein = models.FloatField(help_text="蛋白質 (g/100g)", default=0)
fat = models.FloatField(help_text="脂肪 (g/100g)", default=0)
calcium = models.FloatField(help_text="鈣 (g/100g)", default=0)
phosphorus = models.FloatField(help_text="磷 (g/100g)", default=0)
magnesium = models.FloatField(help_text="鎂 (mg/100g)", default=0)
sodium = models.FloatField(help_text="鈉 (mg/100g)", default=0)
carbohydrate = models.FloatField(help_text="碳水化合物 (g/100g)", default=0)

# OCR 處理相關欄位
extracted_text = models.TextField(blank=True, null=True, help_text="OCR 提取的原始文本")
processing_status = models.CharField('處理狀態', max_length=25, choices=PROCESSING_STATUS_CHOICES, default='pending')
processing_error = models.TextField('處理錯誤信息', blank=True)
```

### 2. 處理狀態選項 ✅
```python
PROCESSING_STATUS_CHOICES = [
    ('pending', '待處理'),
    ('processing', '處理中'),
    ('completed', '處理完成'),
    ('completed_with_warnings', '處理完成但有警告'),
    ('failed', '處理失敗'),
]
```

### 3. 圖片上傳功能 ✅
- 前面圖片上傳（`front_image`）
- 營養成分圖片上傳（`nutrition_image`）
- 圖片安全檢查機制已保留

## 建議的整合方式

### 方式 1: 同步處理（簡單）
在 `feeds/views.py` 的 `UploadFeedAPIView.post()` 方法中：

```python
# 在現有的上傳邏輯之後加入
try:
    # 呼叫新的 OCR 處理函式
    from .ocr_processor import process_nutrition_image  # 您成員的實作
    
    # 設定為處理中狀態
    feed.processing_status = 'processing'
    feed.save()
    
    # 執行 OCR 處理
    nutrition_data, extracted_text, warnings = process_nutrition_image(nutrition_image_obj.img_url)
    
    # 更新營養數據
    feed.protein = nutrition_data.get('protein', 0)
    feed.fat = nutrition_data.get('fat', 0)
    feed.calcium = nutrition_data.get('calcium', 0)
    feed.phosphorus = nutrition_data.get('phosphorus', 0)
    feed.magnesium = nutrition_data.get('magnesium', 0)
    feed.sodium = nutrition_data.get('sodium', 0)
    feed.carbohydrate = nutrition_data.get('carbohydrate', 0)
    feed.extracted_text = extracted_text
    
    # 設定完成狀態
    if warnings:
        feed.processing_status = 'completed_with_warnings'
        feed.processing_error = '; '.join(warnings)
    else:
        feed.processing_status = 'completed'
        feed.processing_error = ''
    
    feed.save()
    
except Exception as e:
    feed.processing_status = 'failed'
    feed.processing_error = str(e)
    feed.save()
```

### 方式 2: 非同步處理（推薦）
如果需要更好的用戶體驗，可以使用背景任務：

```python
# 在 feeds/ 目錄下創建新的 tasks.py
from celery import shared_task
from .models import Feed
from .ocr_processor import process_nutrition_image

@shared_task
def process_feed_ocr_v2(feed_id, nutrition_image_url):
    try:
        feed = Feed.objects.get(id=feed_id)
        feed.processing_status = 'processing'
        feed.save()
        
        # 呼叫新的 OCR 處理
        nutrition_data, extracted_text, warnings = process_nutrition_image(nutrition_image_url)
        
        # 更新模型...
        
    except Exception as e:
        # 錯誤處理...
```

## 需要您成員提供的介面

建議您的成員提供一個統一的介面函式，例如：

```python
# ocr_processor.py
def process_nutrition_image(image_url_or_path):
    """
    處理營養成分圖片的 OCR 識別
    
    參數:
        image_url_or_path: 圖片的 URL 或本地路徑
    
    返回:
        tuple: (nutrition_data, extracted_text, warnings)
        - nutrition_data: dict, 包含營養成分數據
        - extracted_text: str, OCR 提取的原始文本
        - warnings: list, 警告信息（如果有）
    
    範例:
        nutrition_data = {
            'protein': 25.5,
            'fat': 12.0,
            'calcium': 1.2,
            'phosphorus': 0.8,
            'magnesium': 120.0,  # mg/100g
            'sodium': 350.0,     # mg/100g
            'carbohydrate': 35.0
        }
    """
    pass
```

## 整合檢查清單

### 整合前準備 ✅
- [x] 移除舊的 OCR 實作
- [x] 保留資料庫結構
- [x] 保留圖片上傳功能
- [x] 保留處理狀態邏輯

### 需要您成員提供
- [ ] 新的 OCR 處理函式
- [ ] 相關依賴套件清單
- [ ] 錯誤處理機制
- [ ] 測試用例

### 整合後測試
- [ ] 圖片上傳正常
- [ ] OCR 識別準確度
- [ ] 錯誤處理機制
- [ ] 營養計算功能
- [ ] 處理狀態更新

## 目前的上傳流程

1. **圖片上傳** → `feeds/views.py:UploadFeedAPIView`
2. **圖片安全檢查** → `utils/file_safety.py`
3. **圖片儲存** → `utils/image_service.py`
4. **狀態設定** → 目前直接設為 `completed`（等待 OCR 整合）

## 建議的新流程

1. **圖片上傳** → 保持不變
2. **圖片安全檢查** → 保持不變  
3. **圖片儲存** → 保持不變
4. **OCR 處理** → **新增您成員的實作**
5. **營養數據更新** → **新增**
6. **狀態更新** → **修改為實際處理結果**

## 相關檔案位置

- **模型定義**: `feeds/models.py`
- **上傳邏輯**: `feeds/views.py:UploadFeedAPIView`
- **序列化器**: `feeds/serializers.py`
- **圖片安全**: `utils/file_safety.py`
- **圖片服務**: `utils/image_service.py`

## 聯絡方式

如果整合過程中遇到問題，可以參考：
- 現有的 API 文檔: `backend/API使用指南.txt`
- 資料庫結構: `feeds/models.py`
- 已移除功能總結: `OCR功能移除總結.md`

祝整合順利！🚀 