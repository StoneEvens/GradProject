from django.core.management.base import BaseCommand
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
import logging

logger = logging.getLogger('django')

class Command(BaseCommand):
    help = '清理過期的黑名單令牌，應定期運行以防止數據庫膨脹'
    
    """
    Django 管理命令: 清理過期的 JWT 令牌黑名單
    
    當用戶登出或刷新令牌時，舊令牌會被加入黑名單。
    隨著時間推移，數據庫中會積累大量過期的黑名單令牌，
    這個命令用於定期清理這些過期令牌，以減少數據庫存儲空間。
    
    使用方法:
    python manage.py clear_token_blacklist
    
    選項:
    --dry-run: 只顯示將被刪除的記錄數量，不實際刪除
    --verbose: 顯示詳細日誌
    
    建議將此命令添加到定時任務（如 cron）中定期執行:
    例如，每天凌晨執行一次:
    0 2 * * * cd /path/to/project && python manage.py clear_token_blacklist >> /var/log/token_cleanup.log 2>&1
    """

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='僅顯示將被刪除的記錄數量，不實際刪除',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='顯示詳細日誌',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        verbose = options['verbose']
        
        # 記錄開始時間
        start_time = timezone.now()
        self.stdout.write(f"開始清理令牌黑名單 - {start_time}")
        logger.info(f"開始清理令牌黑名單 - {start_time}")
        
        # 查找已過期的令牌
        expired_tokens = OutstandingToken.objects.filter(
            expires_at__lt=timezone.now()
        )
        
        # 找出黑名單中的已過期令牌
        blacklisted_tokens = BlacklistedToken.objects.filter(
            token__in=expired_tokens
        )
        
        # 計算數量
        blacklisted_count = blacklisted_tokens.count()
        expired_count = expired_tokens.count()
        
        message = f"發現 {blacklisted_count} 個黑名單中的過期令牌"
        self.stdout.write(message)
        if verbose:
            logger.info(message)
            
        message = f"發現 {expired_count} 個過期的令牌"
        self.stdout.write(message)
        if verbose:
            logger.info(message)
        
        if not dry_run:
            # 首先刪除黑名單記錄
            blacklisted_deleted = 0
            if blacklisted_count > 0:
                blacklisted_deleted, _ = blacklisted_tokens.delete()
                message = f"已刪除 {blacklisted_deleted} 個黑名單中的過期令牌"
                self.stdout.write(self.style.SUCCESS(message))
                logger.info(message)
            
            # 然後刪除過期的令牌
            expired_deleted = 0
            if expired_count > 0:
                expired_deleted, _ = expired_tokens.delete()
                message = f"已刪除 {expired_deleted} 個過期的令牌"
                self.stdout.write(self.style.SUCCESS(message))
                logger.info(message)
                
            # 記錄統計信息
            end_time = timezone.now()
            duration = (end_time - start_time).total_seconds()
            message = f"清理完成 - 耗時: {duration:.2f} 秒, 共刪除: {blacklisted_deleted + expired_deleted} 條記錄"
            self.stdout.write(self.style.SUCCESS(message))
            logger.info(message)
        else:
            message = "這是模擬運行，沒有實際刪除任何記錄"
            self.stdout.write(self.style.WARNING(message))
            if verbose:
                logger.info(message)
            
        self.stdout.write(self.style.SUCCESS("清理過程完成")) 