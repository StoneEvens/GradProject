"""
Django Management Command: 初始化向量資料庫
"""

from django.core.management.base import BaseCommand
from utils.recommendation_service import RecommendationService
from aiAgent.services.vector_db_implementations import (
    UserVectorDB,
    PetVectorDB,
    FeedVectorDB,
    SystemOperationVectorDB
)


class Command(BaseCommand):
    help = '初始化所有向量資料庫（使用者、寵物、飼料、系統操作）'

    def add_arguments(self, parser):
        parser.add_argument(
            '--db',
            type=str,
            choices=['user', 'pet', 'feed', 'system', 'all'],
            default='all',
            help='指定要初始化的資料庫'
        )
        parser.add_argument(
            '--rebuild',
            action='store_true',
            help='強制重建現有的資料庫'
        )

    def handle(self, *args, **options):
        db_type = options['db']
        rebuild = options['rebuild']

        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('開始初始化向量資料庫'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

        # 初始化 BERT 服務
        self.stdout.write('載入 BERT 模型...')
        embedding_service = RecommendationService()
        self.stdout.write(self.style.SUCCESS('✅ BERT 模型載入完成'))

        # 初始化指定的資料庫
        if db_type in ['user', 'all']:
            self._init_user_db(embedding_service, rebuild)

        if db_type in ['pet', 'all']:
            self._init_pet_db(embedding_service, rebuild)

        if db_type in ['feed', 'all']:
            self._init_feed_db(embedding_service, rebuild)

        if db_type in ['system', 'all']:
            self._init_system_db(embedding_service, rebuild)

        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('向量資料庫初始化完成！'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

    def _init_user_db(self, embedding_service, rebuild):
        """初始化使用者向量資料庫"""
        self.stdout.write('\n' + '─' * 60)
        self.stdout.write('初始化使用者向量資料庫...')
        self.stdout.write('─' * 60)

        try:
            db = UserVectorDB(embedding_service)

            if rebuild and len(db.ids) > 0:
                self.stdout.write(self.style.WARNING('⚠️  強制重建模式：刪除現有資料'))
                db.ids = []
                db.embeddings = []
                db.metadata = []
                db.initialize_from_db()
            elif len(db.ids) == 0:
                self.stdout.write('⚠️  資料庫為空，開始初始化...')
                db.initialize_from_db()
            else:
                self.stdout.write(self.style.SUCCESS(f'✅ 使用者資料庫已存在: {len(db.ids)} 筆'))

            # 顯示統計
            stats = db.get_stats()
            self.stdout.write(self.style.SUCCESS(f'   - 總數: {stats["total_items"]} 筆'))
            self.stdout.write(self.style.SUCCESS(f'   - 維度: {stats["embedding_dim"]}'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ 初始化使用者資料庫失敗: {str(e)}'))

    def _init_pet_db(self, embedding_service, rebuild):
        """初始化寵物向量資料庫"""
        self.stdout.write('\n' + '─' * 60)
        self.stdout.write('初始化寵物向量資料庫...')
        self.stdout.write('─' * 60)

        try:
            db = PetVectorDB(embedding_service)

            if rebuild and len(db.ids) > 0:
                self.stdout.write(self.style.WARNING('⚠️  強制重建模式：刪除現有資料'))
                db.ids = []
                db.embeddings = []
                db.metadata = []
                db.initialize_from_db()
            elif len(db.ids) == 0:
                self.stdout.write('⚠️  資料庫為空，開始初始化...')
                db.initialize_from_db()
            else:
                self.stdout.write(self.style.SUCCESS(f'✅ 寵物資料庫已存在: {len(db.ids)} 筆'))

            # 顯示統計
            stats = db.get_stats()
            self.stdout.write(self.style.SUCCESS(f'   - 總數: {stats["total_items"]} 筆'))
            self.stdout.write(self.style.SUCCESS(f'   - 維度: {stats["embedding_dim"]}'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ 初始化寵物資料庫失敗: {str(e)}'))

    def _init_feed_db(self, embedding_service, rebuild):
        """初始化飼料向量資料庫"""
        self.stdout.write('\n' + '─' * 60)
        self.stdout.write('初始化飼料向量資料庫...')
        self.stdout.write('─' * 60)

        try:
            db = FeedVectorDB(embedding_service)

            if rebuild and len(db.ids) > 0:
                self.stdout.write(self.style.WARNING('⚠️  強制重建模式：刪除現有資料'))
                db.ids = []
                db.embeddings = []
                db.metadata = []
                db.initialize_from_db()
            elif len(db.ids) == 0:
                self.stdout.write('⚠️  資料庫為空，開始初始化...')
                db.initialize_from_db()
            else:
                self.stdout.write(self.style.SUCCESS(f'✅ 飼料資料庫已存在: {len(db.ids)} 筆'))

            # 顯示統計
            stats = db.get_stats()
            self.stdout.write(self.style.SUCCESS(f'   - 總數: {stats["total_items"]} 筆'))
            self.stdout.write(self.style.SUCCESS(f'   - 維度: {stats["embedding_dim"]}'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ 初始化飼料資料庫失敗: {str(e)}'))

    def _init_system_db(self, embedding_service, rebuild):
        """初始化系統操作資訊向量資料庫"""
        self.stdout.write('\n' + '─' * 60)
        self.stdout.write('初始化系統操作資訊向量資料庫...')
        self.stdout.write('─' * 60)

        try:
            db = SystemOperationVectorDB(embedding_service)

            if rebuild and len(db.ids) > 0:
                self.stdout.write(self.style.WARNING('⚠️  強制重建模式：刪除現有資料'))
                db.ids = []
                db.embeddings = []
                db.metadata = []
                db.initialize_from_db()
            elif len(db.ids) == 0:
                self.stdout.write('⚠️  資料庫為空，開始初始化...')
                db.initialize_from_db()
            else:
                self.stdout.write(self.style.SUCCESS(f'✅ 系統操作資料庫已存在: {len(db.ids)} 筆'))

            # 顯示統計
            stats = db.get_stats()
            self.stdout.write(self.style.SUCCESS(f'   - 總數: {stats["total_items"]} 筆'))
            self.stdout.write(self.style.SUCCESS(f'   - 維度: {stats["embedding_dim"]}'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ 初始化系統操作資料庫失敗: {str(e)}'))