from django.db import models

class SymptomRecord(models.Model):
    record_date = models.DateField()
    symptoms = models.JSONField()
    for_medical = models.BooleanField(default=False)
    weight = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    water_intake = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    body_temperature = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='symptom_images/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.record_date} 紀錄"
