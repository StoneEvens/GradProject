"""
圖片服務模塊

提供統一的圖片處理功能，用於減少代碼重複並提高查詢效率
"""

from django.contrib.contenttypes.models import ContentType
from django.db.models import Prefetch
from collections import defaultdict
import logging
from django.core.cache import cache
import hashlib

logger = logging.getLogger(__name__)

class ImageService:
    """圖片服務類，提供統一的圖片處理功能"""
    
    # 默認緩存超時時間（24小時）
    DEFAULT_CACHE_TIMEOUT = 60 * 60 * 24
    
    @staticmethod
    def get_cache_key(model_name, object_id, position=None):
        """
        生成圖片緩存的鍵名
        
        Parameters:
        - model_name: 模型名稱
        - object_id: 對象ID
        - position: 圖片位置（可選，如 'first', 'last', '1', '2'）
        
        Returns:
        - str: 緩存鍵名
        """
        key = f"img_{model_name}_{object_id}"
        if position:
            key = f"{key}_{position}"
        return key
    
    @staticmethod
    def get_content_type(model_class):
        """
        獲取指定模型的內容類型
        
        Parameters:
        - model_class: Django 模型類
        
        Returns:
        - ContentType: 內容類型對象
        """
        return ContentType.objects.get_for_model(model_class)
    
    @staticmethod
    def get_object_images(obj, model_class=None, order_by='sort_order', use_cache=False):
        """
        獲取單個對象的所有圖片
        
        Parameters:
        - obj: Django 模型實例
        - model_class: Django 模型類 (可選，如果為 None 則使用 obj.__class__)
        - order_by: 排序字段 (默認為 'sort_order')
        - use_cache: 是否使用緩存
        
        Returns:
        - QuerySet: 圖片查詢集
        """
        from media.models import Image
        
        if model_class is None:
            model_class = obj.__class__
            
        content_type = ImageService.get_content_type(model_class)
        
        return Image.objects.filter(
            content_type=content_type,
            object_id=obj.id
        ).order_by(order_by)
    
    @staticmethod
    def get_object_first_image(obj, model_class=None, use_cache=False):
        """
        獲取單個對象的第一張圖片
        
        Parameters:
        - obj: Django 模型實例
        - model_class: Django 模型類 (可選，如果為 None 則使用 obj.__class__)
        - use_cache: 是否使用緩存
        
        Returns:
        - Image: 圖片對象或 None
        """
        if model_class is None:
            model_class = obj.__class__
            
        if use_cache:
            # 嘗試從緩存獲取
            cache_key = ImageService.get_cache_key(
                model_class._meta.model_name, 
                obj.id, 
                'first'
            )
            cached_url = cache.get(cache_key)
            if cached_url is not None:
                return cached_url
                
        images = ImageService.get_object_images(obj, model_class)
        image = images.first() if images.exists() else None
        
        if use_cache and image:
            # 緩存 URL
            cache_key = ImageService.get_cache_key(
                model_class._meta.model_name, 
                obj.id, 
                'first'
            )
            image_url = image.img_url.url if hasattr(image.img_url, 'url') else None
            cache.set(cache_key, image_url, ImageService.DEFAULT_CACHE_TIMEOUT)
            return image_url
            
        return image
    
    @staticmethod
    def get_object_first_image_url(obj, model_class=None, use_cache=True):
        """
        獲取單個對象的第一張圖片URL
        
        Parameters:
        - obj: Django 模型實例
        - model_class: Django 模型類 (可選，如果為 None 則使用 obj.__class__)
        - use_cache: 是否使用緩存
        
        Returns:
        - str: 圖片URL或 None
        """
        if model_class is None:
            model_class = obj.__class__
            
        if use_cache:
            # 嘗試從緩存獲取
            cache_key = ImageService.get_cache_key(
                model_class._meta.model_name, 
                obj.id, 
                'first'
            )
            cached_url = cache.get(cache_key)
            if cached_url is not None:
                return cached_url
        
        image = ImageService.get_object_first_image(obj, model_class, use_cache=False)
        image_url = image.img_url.url if image and hasattr(image.img_url, 'url') else None
        
        if use_cache and image_url:
            # 緩存 URL
            cache_key = ImageService.get_cache_key(
                model_class._meta.model_name, 
                obj.id, 
                'first'
            )
            cache.set(cache_key, image_url, ImageService.DEFAULT_CACHE_TIMEOUT)
            
        return image_url
    
    @staticmethod
    def invalidate_image_cache(obj_or_id, model_class=None):
        """
        使指定對象的圖片緩存失效
        
        Parameters:
        - obj_or_id: Django 模型實例或對象ID
        - model_class: Django 模型類 (當 obj_or_id 為 ID 時必須提供)
        """
        # 確定對象 ID 和模型名稱
        if isinstance(obj_or_id, int):
            if model_class is None:
                raise ValueError("當 obj_or_id 為 ID 時，必須提供 model_class")
            object_id = obj_or_id
            model_name = model_class._meta.model_name
        else:
            object_id = obj_or_id.id
            model_class = obj_or_id.__class__ if model_class is None else model_class
            model_name = model_class._meta.model_name
            
        # 刪除相關緩存
        # 首先刪除所有單張圖片的緩存
        for position in ['first', 'last']:
            cache_key = ImageService.get_cache_key(model_name, object_id, position)
            cache.delete(cache_key)
            
        # 刪除所有數字位置的緩存（假設最多10張圖片）
        for i in range(1, 11):
            cache_key = ImageService.get_cache_key(model_name, object_id, str(i))
            cache.delete(cache_key)
            
        # 刪除特定模型的緩存（例如飼料的正面圖和營養圖）
        if model_name == 'feed':
            for img_type in ['front', 'nutrition']:
                cache_key = ImageService.get_cache_key(model_name, object_id, img_type)
                cache.delete(cache_key)
    
    @staticmethod
    def preload_images_for_objects(objects, model_class=None, limit=None, use_cache=True):
        """
        預加載多個對象的圖片，並返回映射
        
        Parameters:
        - objects: 對象列表或查詢集
        - model_class: Django 模型類 (可選，如果為 None 則嘗試從第一個對象獲取)
        - limit: 每個對象最多加載的圖片數量 (可選)
        - use_cache: 是否使用緩存
        
        Returns:
        - dict: 以對象ID為鍵，圖片列表為值的字典
        """
        from media.models import Image
        
        if not objects:
            return {}
            
        # 如果未提供模型類，嘗試從第一個對象獲取
        if model_class is None:
            if hasattr(objects, 'model'):
                model_class = objects.model
            else:
                try:
                    model_class = objects[0].__class__
                except (IndexError, TypeError):
                    logger.error("無法確定對象的模型類，無法預加載圖片")
                    return {}
                    
        # 獲取內容類型
        content_type = ImageService.get_content_type(model_class)
        model_name = model_class._meta.model_name
        
        # 獲取所有對象ID
        if hasattr(objects, 'values_list'):
            # 如果是查詢集
            object_ids = list(objects.values_list('id', flat=True))
        else:
            # 如果是對象列表
            object_ids = [obj.id for obj in objects if hasattr(obj, 'id')]
            
        if not object_ids:
            return {}
            
        # 如果使用緩存，檢查哪些對象的圖片已經在緩存中
        cached_image_maps = {}
        uncached_object_ids = []
        
        if use_cache:
            for obj_id in object_ids:
                # 檢查第一張圖片是否在緩存中
                cache_key = ImageService.get_cache_key(model_name, obj_id, 'first')
                cached_url = cache.get(cache_key)
                
                if cached_url is not None:
                    # 如果使用限制，且限制為1，直接返回緩存的URL
                    if limit == 1:
                        cached_image_maps[obj_id] = [{'url': cached_url}]
                    else:
                        # 否則需要查詢所有圖片
                        uncached_object_ids.append(obj_id)
                else:
                    uncached_object_ids.append(obj_id)
        else:
            uncached_object_ids = object_ids
        
        # 只查詢未緩存的對象的圖片
        image_map = defaultdict(list)
        
        if uncached_object_ids:
            # 查詢所有相關圖片
            images_queryset = Image.objects.filter(
                content_type=content_type,
                object_id__in=uncached_object_ids
            ).order_by('object_id', 'sort_order')
            
            # 如果有限制數量
            if limit is not None:
                # 創建一個計數器，記錄每個對象已加載的圖片數量
                counter = defaultdict(int)
                filtered_images = []
                
                for image in images_queryset:
                    if counter[image.object_id] < limit:
                        filtered_images.append(image)
                        counter[image.object_id] += 1
                        
                        # 如果使用緩存，將第一張圖片的URL緩存
                        if use_cache and counter[image.object_id] == 1:
                            image_url = image.img_url.url if hasattr(image.img_url, 'url') else None
                            if image_url:
                                cache_key = ImageService.get_cache_key(model_name, image.object_id, 'first')
                                cache.set(cache_key, image_url, ImageService.DEFAULT_CACHE_TIMEOUT)
                        
                images = filtered_images
            else:
                images = list(images_queryset)
                
                # 如果使用緩存，緩存每個對象的第一張圖片
                if use_cache:
                    # 按對象ID分組
                    image_by_object = defaultdict(list)
                    for image in images:
                        image_by_object[image.object_id].append(image)
                        
                    # 緩存每個對象的第一張圖片
                    for obj_id, obj_images in image_by_object.items():
                        if obj_images:
                            image_url = obj_images[0].img_url.url if hasattr(obj_images[0].img_url, 'url') else None
                            if image_url:
                                cache_key = ImageService.get_cache_key(model_name, obj_id, 'first')
                                cache.set(cache_key, image_url, ImageService.DEFAULT_CACHE_TIMEOUT)
                
            # 將圖片按對象ID分組
            for image in images:
                image_map[image.object_id].append(image)
                
        # 合併緩存和查詢結果
        result_map = dict(image_map)
        for obj_id, cached_images in cached_image_maps.items():
            result_map[obj_id] = cached_images
            
        return result_map
    
    @staticmethod
    def preload_first_image_for_objects(objects, model_class=None, use_cache=True):
        """
        預加載多個對象的第一張圖片，並返回映射
        
        Parameters:
        - objects: 對象列表或查詢集
        - model_class: Django 模型類 (可選，如果為 None 則嘗試從第一個對象獲取)
        - use_cache: 是否使用緩存
        
        Returns:
        - dict: 以對象ID為鍵，第一張圖片為值的字典
        """
        image_map = ImageService.preload_images_for_objects(objects, model_class, limit=1, use_cache=use_cache)
        
        # 將列表轉換為單個元素
        first_image_map = {}
        for obj_id, images in image_map.items():
            if images:
                first_image_map[obj_id] = images[0]
                
        return first_image_map
    
    @staticmethod
    def get_feed_images(feed_id, use_cache=True):
        """
        獲取飼料的正面圖和營養成分圖
        
        Parameters:
        - feed_id: 飼料ID
        - use_cache: 是否使用緩存
        
        Returns:
        - tuple: (front_image, nutrition_image) 或 (None, None)
        """
        from feeds.models import Feed
        from media.models import Image
        
        if use_cache:
            # 嘗試從緩存獲取
            front_key = ImageService.get_cache_key('feed', feed_id, 'front')
            nutrition_key = ImageService.get_cache_key('feed', feed_id, 'nutrition')
            
            front_url = cache.get(front_key)
            nutrition_url = cache.get(nutrition_key)
            
            if front_url is not None and nutrition_url is not None:
                # 兩者都在緩存中，直接返回
                return front_url, nutrition_url
        
        content_type = ImageService.get_content_type(Feed)
        
        images = Image.objects.filter(
            content_type=content_type,
            object_id=feed_id
        ).order_by('sort_order')
        
        front_image = None
        nutrition_image = None
        
        if images.exists():
            if images.count() >= 1:
                front_image = images[0]
            if images.count() >= 2:
                nutrition_image = images[1]
                
            # 如果使用緩存，緩存圖片URL
            if use_cache:
                front_url = front_image.img_url.url if front_image and hasattr(front_image.img_url, 'url') else None
                nutrition_url = nutrition_image.img_url.url if nutrition_image and hasattr(nutrition_image.img_url, 'url') else None
                
                if front_url:
                    front_key = ImageService.get_cache_key('feed', feed_id, 'front')
                    cache.set(front_key, front_url, ImageService.DEFAULT_CACHE_TIMEOUT)
                    
                if nutrition_url:
                    nutrition_key = ImageService.get_cache_key('feed', feed_id, 'nutrition')
                    cache.set(nutrition_key, nutrition_url, ImageService.DEFAULT_CACHE_TIMEOUT)
                
        return front_image, nutrition_image
    
    @staticmethod
    def get_feed_image_urls(feed_id, use_cache=True):
        """
        獲取飼料的正面圖和營養成分圖URL
        
        Parameters:
        - feed_id: 飼料ID
        - use_cache: 是否使用緩存
        
        Returns:
        - tuple: (front_image_url, nutrition_image_url) 或 (None, None)
        """
        if use_cache:
            # 嘗試從緩存獲取
            front_key = ImageService.get_cache_key('feed', feed_id, 'front')
            nutrition_key = ImageService.get_cache_key('feed', feed_id, 'nutrition')
            
            front_url = cache.get(front_key)
            nutrition_url = cache.get(nutrition_key)
            
            if front_url is not None and nutrition_url is not None:
                # 兩者都在緩存中，直接返回
                return front_url, nutrition_url
        
        front_image, nutrition_image = ImageService.get_feed_images(feed_id, use_cache=False)
        
        front_image_url = front_image.img_url.url if front_image and hasattr(front_image.img_url, 'url') else None
        nutrition_image_url = nutrition_image.img_url.url if nutrition_image and hasattr(nutrition_image.img_url, 'url') else None
        
        # 如果使用緩存，緩存URL
        if use_cache:
            if front_image_url:
                front_key = ImageService.get_cache_key('feed', feed_id, 'front')
                cache.set(front_key, front_image_url, ImageService.DEFAULT_CACHE_TIMEOUT)
                
            if nutrition_image_url:
                nutrition_key = ImageService.get_cache_key('feed', feed_id, 'nutrition')
                cache.set(nutrition_key, nutrition_image_url, ImageService.DEFAULT_CACHE_TIMEOUT)
        
        return front_image_url, nutrition_image_url
    
    @staticmethod
    def optimize_queryset_with_images(queryset, model_class=None, attr_name='images'):
        """
        使用 prefetch_related 優化查詢集，預加載相關圖片
        
        Parameters:
        - queryset: 要優化的查詢集
        - model_class: Django 模型類 (可選，如果為 None 則使用 queryset.model)
        - attr_name: 圖片屬性名稱 (默認為 'images')
        
        Returns:
        - QuerySet: 優化後的查詢集
        """
        from media.models import Image
        
        if model_class is None:
            model_class = queryset.model
            
        content_type = ImageService.get_content_type(model_class)
        
        return queryset.prefetch_related(
            Prefetch(
                'content_object_set',
                queryset=Image.objects.filter(
                    content_type=content_type
                ).order_by('sort_order'),
                to_attr=attr_name
            )
        ) 