import json
from django.core.management.base import BaseCommand
from social.models import PostFrame, SoLContent
from accounts.models import CustomUser
from django.db import transaction

class Command(BaseCommand):
    help = "Inject test data into the database"

    @transaction.atomic
    def handle(self, *args, **options):
        user = CustomUser.get_user(id=1)  # Assuming user with ID 1 exists

        json_file = open('C:/Users/Steven/GradProject/backend/testdata.json', 'r', encoding='utf-8')
        test_data = json.load(json_file)
        json_file.close()

        print(test_data[0])
        print(test_data[0].get('content'))

        for post in test_data:
            postFrame = PostFrame.create(user = user)
            sol_content = SoLContent.create(postFrame=postFrame, content_text=post.get('content'), location="新北市")

        # Your data injection logic here
        self.stdout.write(self.style.SUCCESS("Test data injected successfully"))