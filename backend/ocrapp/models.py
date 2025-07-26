from django.db import models
from pets.models import Pet

class HealthReport(models.Model):
    pet = models.ForeignKey(Pet, on_delete=models.CASCADE, related_name='health_reports')
    data = models.JSONField()  # 儲存 OCR 擷取到的完整結果
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.pet.pet_name} 健康報告 {self.created_at.strftime('%Y-%m-%d')}"