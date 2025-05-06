#!/usr/bin/env python
"""
雲端圖片存儲遷移腳本

TODO: [雲端存儲] 這個腳本將在雲端存儲服務準備好後使用
用於將現有的本地圖片遷移到雲端存儲

使用方法:
python manage.py runscript migrate_to_cloud_storage --script-args [選項]

選項:
--dry-run: 僅顯示將進行的操作，不實際執行
--batch-size=100: 設置每批處理的數量
--start-id=1000: 設置開始處理的 ID
--end-id=2000: 設置結束處理的 ID
"""

import os
import sys
import time
import logging
import argparse
from django.db import transaction
from django.conf import settings
from django.core.management.base import BaseCommand

# 在正式實現時導入必要的模塊
# from media.models import Image, PetHeadshot, UserHeadshot
# from utils.cloud_storage import get_storage_service

# 設置日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cloud_migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('cloud_migration')


def setup_argparse():
    """設置命令行參數解析"""
    parser = argparse.ArgumentParser(description='遷移圖片到雲端存儲')
    parser.add_argument('--dry-run', action='store_true', help='僅顯示將進行的操作，不實際執行')
    parser.add_argument('--batch-size', type=int, default=100, help='每批處理的數量')
    parser.add_argument('--start-id', type=int, default=0, help='開始處理的 ID')
    parser.add_argument('--end-id', type=int, default=None, help='結束處理的 ID')
    parser.add_argument('--model', type=str, default='Image', 
                       choices=['Image', 'PetHeadshot', 'UserHeadshot', 'all'],
                       help='要遷移的模型')
    
    return parser


def migrate_image(image, storage_service, dry_run=False):
    """
    遷移單個圖片到雲端存儲
    
    參數:
    - image: 圖片模型實例
    - storage_service: 雲端存儲服務
    - dry_run: 是否為演練模式
    
    返回:
    - 成功或失敗
    """
    try:
        # TODO: 實現具體的遷移邏輯
        # 1. 獲取本地文件路徑
        # 2. 檢查文件是否存在
        # 3. 確定雲端存儲路徑和文件名
        # 4. 上傳文件
        # 5. 更新數據庫記錄
        
        if dry_run:
            logger.info(f"將遷移圖片 ID={image.id} 到雲端 (DRY RUN)")
            return True
            
        # 示例代碼，正式實現時需要替換
        """
        # 獲取本地文件路徑
        local_path = os.path.join(settings.MEDIA_ROOT, str(image.img_url))
        
        if not os.path.exists(local_path):
            logger.warning(f"圖片 ID={image.id} 的本地文件不存在: {local_path}")
            return False
            
        # 確定雲端存儲路徑
        model_name = image._meta.model_name
        folder_path = f"{model_name}/{image.id // 1000}"
        
        # 生成唯一文件名
        from utils.cloud_storage import generate_unique_filename
        filename = generate_unique_filename(os.path.basename(local_path))
        
        # 上傳文件
        cloud_url = storage_service.upload_file(
            file_obj=local_path,
            folder_path=folder_path,
            file_name=filename
        )
        
        # 更新數據庫記錄
        image.img_url = cloud_url
        # 如果有添加其他字段，也一併更新
        # image.storage_provider = 'S3'
        # image.file_size = os.path.getsize(local_path)
        image.save()
        """
        
        # 模擬上傳時間
        time.sleep(0.1)
        logger.info(f"已遷移圖片 ID={image.id} 到雲端")
        return True
        
    except Exception as e:
        logger.error(f"遷移圖片 ID={image.id} 失敗: {str(e)}")
        return False


def migrate_batch(model_class, batch_size, start_id, end_id, storage_service, dry_run=False):
    """
    批量遷移圖片
    
    參數:
    - model_class: 模型類
    - batch_size: 每批處理的數量
    - start_id: 開始處理的 ID
    - end_id: 結束處理的 ID
    - storage_service: 雲端存儲服務
    - dry_run: 是否為演練模式
    """
    logger.info(f"開始遷移 {model_class.__name__} 模型圖片到雲端")
    
    # 構建查詢條件
    query = model_class.objects.all()
    if start_id:
        query = query.filter(id__gte=start_id)
    if end_id:
        query = query.filter(id__lte=end_id)
    
    # 獲取總數
    total = query.count()
    logger.info(f"找到 {total} 張待遷移的圖片")
    
    # 分批處理
    processed = 0
    success = 0
    failed = 0
    
    for i in range(0, total, batch_size):
        batch = query[i:i+batch_size]
        logger.info(f"處理批次 {i//batch_size + 1}, IDs: {batch.first().id} - {batch.last().id}")
        
        for image in batch:
            processed += 1
            result = migrate_image(image, storage_service, dry_run)
            if result:
                success += 1
            else:
                failed += 1
                
        # 顯示進度
        progress = processed / total * 100
        logger.info(f"進度: {progress:.2f}% ({processed}/{total}), 成功: {success}, 失敗: {failed}")
        
    logger.info(f"完成 {model_class.__name__} 模型圖片遷移，總數: {total}, 成功: {success}, 失敗: {failed}")
    return success, failed


def run(*args):
    """
    腳本入口點
    """
    # 解析命令行參數
    parser = setup_argparse()
    options = parser.parse_args(args)
    
    logger.info("開始雲端存儲遷移")
    logger.info(f"選項: {options}")
    
    # 獲取雲端存儲服務
    # storage_service = get_storage_service()
    storage_service = None  # 模擬存儲服務
    
    # 導入模型
    from django.apps import apps
    Image = apps.get_model('media', 'Image')
    PetHeadshot = apps.get_model('media', 'PetHeadshot')
    UserHeadshot = apps.get_model('media', 'UserHeadshot')
    
    total_success = 0
    total_failed = 0
    
    # 根據指定的模型執行遷移
    if options.model in ['Image', 'all']:
        success, failed = migrate_batch(
            Image, options.batch_size, options.start_id, options.end_id, 
            storage_service, options.dry_run
        )
        total_success += success
        total_failed += failed
        
    if options.model in ['PetHeadshot', 'all']:
        success, failed = migrate_batch(
            PetHeadshot, options.batch_size, options.start_id, options.end_id, 
            storage_service, options.dry_run
        )
        total_success += success
        total_failed += failed
        
    if options.model in ['UserHeadshot', 'all']:
        success, failed = migrate_batch(
            UserHeadshot, options.batch_size, options.start_id, options.end_id, 
            storage_service, options.dry_run
        )
        total_success += success
        total_failed += failed
    
    # 輸出總結
    logger.info("雲端存儲遷移完成")
    logger.info(f"總數: {total_success + total_failed}, 成功: {total_success}, 失敗: {total_failed}")
    
    if options.dry_run:
        logger.info("這是演練模式，沒有實際進行任何更改")
        
    return total_success, total_failed


if __name__ == "__main__":
    # 如果直接運行腳本，而不是通過 Django 的 runscript 命令
    logger.info("請通過 Django 的 runscript 命令運行此腳本")
    logger.info("例如: python manage.py runscript migrate_to_cloud_storage --script-args --dry-run")
    sys.exit(1) 