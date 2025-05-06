from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum, Count
from .models import UserMission, MissionCondition, UserConditionRecord
import json
import logging

logger = logging.getLogger(__name__)

class MissionConditionService:
    """
    任務條件檢查服務：用於處理和驗證任務完成條件
    """
    
    @staticmethod
    def record_condition_progress(user, condition_type, details=None, related_entity=None, increment=1):
        """
        記錄用戶完成特定類型條件的進度
        
        Args:
            user: 用戶對象
            condition_type: 條件類型 (如 'post', 'comment' 等)
            details: 額外詳細資訊，如發布文章的ID等
            related_entity: 相關實體ID或標識
            increment: 進度增量，默認為1
            
        Returns:
            生成的記錄對象列表和是否觸發了任務完成
        """
        if details is None:
            details = {}
        
        # 查找匹配的任務條件
        conditions = MissionCondition.objects.filter(type=condition_type)
        
        # 如果有相關實體，也檢查實體是否匹配
        if related_entity:
            entity_conditions = conditions.filter(target_entity=related_entity)
            if entity_conditions.exists():
                conditions = entity_conditions
        
        if not conditions.exists():
            return [], False
        
        # 用戶當前進行中的任務
        active_missions = UserMission.objects.filter(
            user=user,
            status='pending',
            due__gte=timezone.now().date()
        ).prefetch_related('mission__conditions')
        
        # 創建記錄並檢查任務進度
        created_records = []
        missions_completed = []
        
        for condition in conditions:
            # 創建條件完成記錄
            record_details = {
                'action_type': condition_type,
                'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
            }
            
            if details:
                record_details.update(details)
                
            if related_entity:
                record_details['entity_id'] = related_entity
            
            # 找出包含此條件的任務
            for user_mission in active_missions:
                mission = user_mission.mission
                if condition in mission.conditions.all():
                    # 關聯記錄到特定任務
                    record = UserConditionRecord.objects.create(
                        user=user,
                        condition=condition,
                        user_mission=user_mission,
                        count=increment,
                        details=record_details
                    )
                    created_records.append(record)
                    
                    # 更新任務進度
                    progress = json.loads(json.dumps(user_mission.condition_progress or {}))
                    condition_id = str(condition.id)
                    
                    if condition_id not in progress:
                        progress[condition_id] = {'count': 0, 'completed': False}
                    
                    progress[condition_id]['count'] += increment
                    if progress[condition_id]['count'] >= condition.target_count:
                        progress[condition_id]['completed'] = True
                    
                    user_mission.condition_progress = progress
                    user_mission.save(update_fields=['condition_progress'])
                    
                    # 檢查任務是否全部條件已完成
                    MissionConditionService.check_mission_completion(user_mission)
                    if user_mission.status == 'completed':
                        missions_completed.append(user_mission)
        
        # 也創建一個不關聯特定任務的通用記錄，以便日後查詢用戶行為
        generic_record = UserConditionRecord.objects.create(
            user=user,
            condition=conditions.first(),
            count=increment,
            details=record_details
        )
        created_records.append(generic_record)
        
        return created_records, len(missions_completed) > 0
    
    @staticmethod
    def check_mission_completion(user_mission):
        """
        檢查一個任務的所有條件是否已完成
        
        Args:
            user_mission: UserMission對象
            
        Returns:
            如果任務條件全部完成，返回True；否則返回False
        """
        # 獲取任務的所有條件
        mission_conditions = user_mission.mission.conditions.all()
        
        # 如果任務沒有設定條件，直接返回False
        if not mission_conditions.exists():
            return False
        
        # 檢查條件進度
        progress = user_mission.condition_progress or {}
        
        # 對於所有條件，檢查是否完成
        all_completed = True
        for condition in mission_conditions:
            condition_id = str(condition.id)
            # 如果條件不在進度中，或者未完成，則任務未完成
            if condition_id not in progress or not progress[condition_id].get('completed', False):
                all_completed = False
                break
        
        # 如果所有條件都已完成，將任務標記為已完成
        if all_completed and user_mission.status == 'pending':
            user_mission.status = 'completed'
            user_mission.date_achieved = timezone.now().date()
            user_mission.save(update_fields=['status', 'date_achieved'])
            
            # 這裡可以添加後續處理，如加積分等
            from accounts.views import CompleteMissionAPIView
            CompleteMissionAPIView.award_points(user_mission)
            
            return True
        
        return False
    
    @staticmethod
    def validate_custom_condition(user, condition, data):
        """
        驗證自定義條件是否滿足
        
        Args:
            user: 用戶對象
            condition: MissionCondition對象
            data: 包含驗證所需數據的字典
            
        Returns:
            True如果條件滿足，否則False
        """
        # 取得自定義驗證代碼或邏輯
        validation_code = condition.custom_validation_code
        
        # 這裡只是一個簡單的例子，實際中可能需要更複雜的邏輯
        try:
            # 假設驗證代碼是JSON格式的簡單規則集
            rules = json.loads(validation_code) if validation_code else {}
            
            # 執行規則檢查 (這只是示例邏輯)
            for key, value in rules.items():
                if key not in data or data[key] != value:
                    return False
            
            return True
        except Exception as e:
            logger.error(f"自定義條件驗證錯誤: {str(e)}")
            return False 