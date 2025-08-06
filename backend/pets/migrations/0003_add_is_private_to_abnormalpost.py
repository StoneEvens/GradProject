# Generated migration for adding is_private field to AbnormalPost

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pets', '0002_initial'),  # 依賴前一個遷移
    ]

    operations = [
        migrations.AddField(
            model_name='abnormalpost',
            name='is_private',
            field=models.BooleanField(default=True, help_text='是否為私人記錄，預設為私人'),
        ),
    ]