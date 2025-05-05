from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from utils.api_response import APIResponse
from rest_framework import status
from .services import MissionConditionService

class RecordUserActionAPIView(APIView):
    """
    記錄用戶行為並檢查是否滿足任務條件
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """
        接收用戶行為數據，記錄並檢查是否滿足任務條件
        
        POST 數據格式:
        {
            "action_type": "post",  // 行為類型，如 post, comment, login 等
            "entity_id": "123",     // 可選，相關實體ID
            "details": {            // 可選，行為詳情
                "content_length": 500,
                "category": "health"
            }
        }
        """
        action_type = request.data.get('action_type')
        entity_id = request.data.get('entity_id')
        details = request.data.get('details', {})
        
        if not action_type:
            return APIResponse(
                message="必須提供action_type",
                code=status.HTTP_400_BAD_REQUEST,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 記錄用戶行為並檢查任務完成情況
        records, missions_completed = MissionConditionService.record_condition_progress(
            user=request.user,
            condition_type=action_type,
            details=details,
            related_entity=entity_id
        )
        
        response_data = {
            'action_recorded': len(records) > 0,
            'missions_affected': len(records) - 1 if len(records) > 0 else 0,  # 減去通用記錄
            'missions_completed': missions_completed
        }
        
        return APIResponse(
            data=response_data,
            message="用戶行為記錄成功"
        )

class CheckMissionConditionsAPIView(APIView):
    """
    檢查特定任務的完成條件狀態
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, mission_id):
        try:
            from .models import UserMission
            
            # 獲取用戶任務
            user_mission = UserMission.objects.get(
                id=mission_id,
                user=request.user
            ).select_related('mission')
            
            mission = user_mission.mission
            
            # 獲取任務所有條件
            conditions = mission.conditions.all()
            
            if not conditions.exists():
                return APIResponse(
                    data={
                        'mission_id': mission_id,
                        'mission_name': mission.mission_name,
                        'has_conditions': False,
                        'message': '此任務沒有特定條件要求'
                    }
                )
            
            # 獲取條件進度
            progress = user_mission.condition_progress or {}
            
            conditions_data = []
            for condition in conditions:
                condition_id = str(condition.id)
                condition_progress = progress.get(condition_id, {'count': 0, 'completed': False})
                
                conditions_data.append({
                    'condition_id': condition.id,
                    'name': condition.name,
                    'type': condition.type,
                    'description': condition.description,
                    'target_count': condition.target_count,
                    'current_count': condition_progress.get('count', 0),
                    'completed': condition_progress.get('completed', False),
                    'progress_percentage': min(100, int(condition_progress.get('count', 0) / condition.target_count * 100))
                })
            
            # 計算總體進度
            total_conditions = len(conditions)
            completed_conditions = sum(1 for c in conditions_data if c['completed'])
            total_progress = int(completed_conditions / total_conditions * 100) if total_conditions > 0 else 0
            
            return APIResponse(
                data={
                    'mission_id': mission_id,
                    'mission_name': mission.mission_name,
                    'has_conditions': True,
                    'conditions': conditions_data,
                    'total_progress': total_progress,
                    'all_completed': total_progress == 100
                }
            )
            
        except UserMission.DoesNotExist:
            return APIResponse(
                message="找不到指定的任務",
                code=status.HTTP_404_NOT_FOUND,
                status=status.HTTP_404_NOT_FOUND
            ) 