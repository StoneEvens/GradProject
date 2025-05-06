from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Count, Q
from django.contrib.auth import get_user_model
from accounts.models import Mission, UserMission
import random
from datetime import timedelta

User = get_user_model()

class Command(BaseCommand):
    help = '檢查任務完成情況，處理過期任務，補充新任務'

    def handle(self, *args, **options):
        """
        1. 檢查並更新過期的任務
        2. 為用戶補充任務，保持六個活躍任務
        """
        today = timezone.now().date()
        due_date = today + timedelta(days=7)  # 一週後到期
        
        # 更新所有已過期但未完成的任務
        expired_missions = UserMission.objects.filter(
            due__lt=today,
            status='pending'
        )
        
        expired_count = expired_missions.count()
        expired_missions.update(status='expired')
        
        self.stdout.write(
            self.style.WARNING(f'已將 {expired_count} 個過期任務標記為已過期')
        )
        
        # 刪除一週前完成的任務
        one_week_ago = today - timedelta(days=7)
        old_completed_missions = UserMission.objects.filter(
            status='completed',
            date_achieved__lt=one_week_ago
        )
        deleted_count = old_completed_missions.count()
        old_completed_missions.delete()
        
        self.stdout.write(
            self.style.SUCCESS(f'已刪除 {deleted_count} 個一週前完成的任務')
        )
        
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
            active_missions_count = UserMission.objects.filter(
                user=user,
                status='pending',
                due__gte=today
            ).count()
            
            # 如果任務少於6個，需要補充
            if active_missions_count < 6:
                # 計算需要補充的任務數量
                total_to_assign = 6 - active_missions_count
                
                # 獲取用戶已有的活躍任務
                active_missions = UserMission.objects.filter(
                    user=user,
                    status='pending',
                    due__gte=today
                )
                
                # 計算當前低級和高級任務的數量
                low_count = active_missions.filter(mission__level='low').count()
                high_count = active_missions.filter(mission__level='high').count()
                
                # 計算需要補充的低級和高級任務數量
                # 保持 4 低級 : 2 高級 的比例
                low_to_assign = min(4 - low_count, total_to_assign) if low_count < 4 else 0
                high_to_assign = min(2 - high_count, total_to_assign - low_to_assign) if high_count < 2 else 0
                
                # 如果還有剩餘的任務分配名額，優先分配低級任務
                remaining = total_to_assign - low_to_assign - high_to_assign
                if remaining > 0:
                    low_to_assign += remaining
                
                if low_to_assign <= 0 and high_to_assign <= 0:
                    continue  # 無需分配新任務
                
                # 獲取用戶已有的任務ID，避免重複分配
                existing_mission_ids = active_missions.values_list('mission_id', flat=True)
                
                # 補充低級任務
                if low_to_assign > 0:
                    available_low_missions = [m for m in low_level_missions if m.id not in existing_mission_ids]
                    if available_low_missions:
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
                
                # 補充高級任務
                if high_to_assign > 0:
                    available_high_missions = [m for m in high_level_missions if m.id not in existing_mission_ids]
                    if available_high_missions:
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
                
                if low_to_assign > 0 or high_to_assign > 0:
                    total_users += 1
        
        # 為過期任務自動分配新任務
        self.handle_expired_missions()
        
        self.stdout.write(
            self.style.SUCCESS(f'成功為 {total_users} 位用戶補充了 {missions_assigned} 個任務')
        )
    
    def handle_expired_missions(self):
        """處理過期任務，為每個過期任務分配同等級的新任務"""
        today = timezone.now().date()
        due_date = today + timedelta(days=7)  # 一週後到期
        
        # 獲取最近過期的任務（只處理狀態剛剛被更新為已過期的）
        expired_missions = UserMission.objects.filter(
            status='expired',
            date_assigned__gte=today - timedelta(days=1)  # 只處理最近一天內過期的任務
        )
        
        # 按用戶和等級分組，為每個用戶分配新任務
        expired_by_user = {}
        for expired in expired_missions:
            user_id = expired.user_id
            mission_level = expired.mission.level
            
            if user_id not in expired_by_user:
                expired_by_user[user_id] = {'low': 0, 'high': 0}
            
            expired_by_user[user_id][mission_level] += 1
        
        missions_assigned = 0
        users_processed = 0
        
        # 獲取所有任務, 按等級分組
        low_level_missions = list(Mission.objects.filter(level='low'))
        high_level_missions = list(Mission.objects.filter(level='high'))
        
        for user_id, counts in expired_by_user.items():
            try:
                user = User.objects.get(id=user_id)
                
                # 獲取用戶已有的任務ID，避免重複分配
                existing_mission_ids = UserMission.objects.filter(
                    user_id=user_id,
                    status='pending',
                    due__gte=today
                ).values_list('mission_id', flat=True)
                
                # 分配低級任務
                if counts['low'] > 0:
                    available_missions = [m for m in low_level_missions if m.id not in existing_mission_ids]
                    if available_missions:
                        to_assign = min(counts['low'], len(available_missions))
                        assigned_missions = random.sample(available_missions, to_assign)
                        
                        for mission in assigned_missions:
                            UserMission.objects.create(
                                user=user,
                                mission=mission,
                                due=due_date,
                                status='pending'
                            )
                            missions_assigned += 1
                            existing_mission_ids = list(existing_mission_ids) + [mission.id]
                
                # 分配高級任務
                if counts['high'] > 0:
                    available_missions = [m for m in high_level_missions if m.id not in existing_mission_ids]
                    if available_missions:
                        to_assign = min(counts['high'], len(available_missions))
                        assigned_missions = random.sample(available_missions, to_assign)
                        
                        for mission in assigned_missions:
                            UserMission.objects.create(
                                user=user,
                                mission=mission,
                                due=due_date,
                                status='pending'
                            )
                            missions_assigned += 1
                
                users_processed += 1
                
            except User.DoesNotExist:
                continue
        
        self.stdout.write(
            self.style.SUCCESS(f'成功為 {users_processed} 位用戶的過期任務分配了 {missions_assigned} 個新任務')
        ) 