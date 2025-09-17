from django.db import models
from pets.models import Pet

class HealthReport(models.Model):
    CHECK_TYPE_CHOICES = [
        ('cbc', '全血計數'),          # Complete Blood Count
        ('biochemistry', '血液生化檢查'),
        ('urinalysis', '尿液分析'),
        ('other', '其他'),
    ]

    pet = models.ForeignKey(Pet, on_delete=models.CASCADE, related_name='health_reports')
    data = models.JSONField()  # 儲存 OCR 擷取到的完整結果
    created_at = models.DateTimeField(auto_now_add=True)
    check_date = models.DateField(null=True, blank=True)
    check_type = models.CharField(max_length=50, choices=CHECK_TYPE_CHOICES, null=True, blank=True)
    check_location = models.CharField(max_length=100, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    def __str__(self):
        pet_name = self.pet.pet_name if self.pet else "未知寵物"
        check_date_str = self.check_date.strftime('%Y-%m-%d') if self.check_date else "未知日期"
        check_type_str = dict(self.CHECK_TYPE_CHOICES).get(self.check_type, "未指定檢查")
        check_location_str = self.check_location if self.check_location else "未指定地點"
        return f"{pet_name} 健康報告 | 日期: {check_date_str} | 類型: {check_type_str} | 地點: {check_location_str}"
