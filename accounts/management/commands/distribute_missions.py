from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Count, Q
from django.contrib.auth import get_user_model
from accounts.models import Mission, UserMission
import random
from datetime import timedelta

User = get_user_model()

class Command(BaseCommand):
    help = '分配任務給所有使用者'

    def handle(self, *args, **options):
        """
        每天執行，分配四個低級任務和兩個高級任務給每個使用者
        """
        today = timezone.now().date()
        due_date = today + timedelta(days=7)  # 一週後到期
        
        # 獲取所有用戶
        users = User.objects.all()
        
        # 獲取所有任務, 按等級分組
        low_level_missions = list(Mission.objects.filter(level='low'))
        high_level_missions = list(Mission.objects.filter(level='high'))
        
        if not low_level_missions or not high_level_missions:
            self.stdout.write(self.style.ERROR('無法分配任務: 任務池中沒有足夠的任務'))
            return
        
        total_users = 0
        missions_assigned = 0
        
        for user in users:
            # 檢查用戶當前的任務數量
            active_missions = UserMission.objects.filter(
                user=user,
                status='pending',
                due__gte=today
            ).count()
            
            # 計算需要分配的任務數量
            low_to_assign = min(4, 6 - active_missions)  # 最多4個低級任務
            high_to_assign = min(2, 6 - active_missions - low_to_assign)  # 最多2個高級任務
            
            if low_to_assign <= 0 and high_to_assign <= 0:
                continue  # 跳過已有足夠任務的用戶
            
            # 獲取用戶已有的任務ID，避免重複分配
            existing_mission_ids = UserMission.objects.filter(
                user=user,
                status='pending',
                due__gte=today
            ).values_list('mission_id', flat=True)
            
            # 低級任務分配
            available_low_missions = [m for m in low_level_missions if m.id not in existing_mission_ids]
            if available_low_missions and low_to_assign > 0:
                assigned_low_missions = random.sample(
                    available_low_missions, 
                    min(low_to_assign, len(available_low_missions))
                )
                
                for mission in assigned_low_missions:
                    UserMission.objects.create(
                        user=user,
                        mission=mission,
                        due=due_date,
                        status='pending'
                    )
                    missions_assigned += 1
                    existing_mission_ids = list(existing_mission_ids) + [mission.id]
            
            # 高級任務分配
            available_high_missions = [m for m in high_level_missions if m.id not in existing_mission_ids]
            if available_high_missions and high_to_assign > 0:
                assigned_high_missions = random.sample(
                    available_high_missions, 
                    min(high_to_assign, len(available_high_missions))
                )
                
                for mission in assigned_high_missions:
                    UserMission.objects.create(
                        user=user,
                        mission=mission,
                        due=due_date,
                        status='pending'
                    )
                    missions_assigned += 1
            
            total_users += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'成功為 {total_users} 位用戶分配了 {missions_assigned} 個任務')
        ) 