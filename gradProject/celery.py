import os

from celery import Celery

# 設置默認 Django 設置模塊
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gradProject.settings')

app = Celery('gradProject')

# 使用字符串，這樣 worker 不需要序列化配置對象
app.config_from_object('django.conf:settings', namespace='CELERY')

# 從所有已註冊的 Django 應用載入任務模塊
app.autodiscover_tasks()

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}') 