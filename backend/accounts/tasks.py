from celery import shared_task
from django.core.management import call_command
from gradProject.celery import app
from celery.schedules import crontab

@shared_task
def distribute_daily_missions():
    """每天凌晨執行，為所有用戶分配任務"""
    call_command('distribute_missions')
    return "每日任務分配完成"

@shared_task
def check_mission_status():
    """每8小時檢查任務完成情況，並處理過期任務"""
    call_command('check_missions')
    return "任務狀態檢查完成"

# 註冊定時任務
app.conf.beat_schedule = {
    # 每天凌晨 0:00 分配任務
    'distribute-daily-missions': {
        'task': 'accounts.tasks.distribute_daily_missions',
        'schedule': crontab(hour=0, minute=0),
    },
    # 每8小時檢查任務狀態 (0:00, 8:00, 16:00)
    'check-mission-status-00': {
        'task': 'accounts.tasks.check_mission_status',
        'schedule': crontab(hour=0, minute=0),
    },
    'check-mission-status-08': {
        'task': 'accounts.tasks.check_mission_status',
        'schedule': crontab(hour=8, minute=0),
    },
    'check-mission-status-16': {
        'task': 'accounts.tasks.check_mission_status',
        'schedule': crontab(hour=16, minute=0),
    },
} 