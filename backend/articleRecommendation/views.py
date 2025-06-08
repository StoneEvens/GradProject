from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404

from utils.api_response import APIResponse
# Create your views here.
class ArticleRecommendationsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        articles = [
            {
                "id": 1,
                "title": '法鬥的溫柔減肥之路',
                "tags": ['法國鬥牛犬', '過重']
            },
            {
                "id": 2,
                "title": '吉娃娃終於把舌頭收起來',
                "tags": ['吉娃娃', '調皮失調']
            },
            {
                "id": 3,
                "title": '黃金獵犬的髖關節治好了',
                "tags": ['黃金獵犬', '髖關節']
            },
            {
                "id": 4,
                "title": '柴犬糖尿病獲得有效控制',
                "tags": ['柴犬', '糖尿病', '嗜吐']
            },
            {
                "id": 5,
                "title": '邊境牧羊犬的耐心訓練指南',
                "tags": ['邊牧', '訓練', '技巧']
            },
            {
                "id": 6,
                "title": '哈士奇變乖了！主人分享秘訣',
                "tags": ['哈士奇', '行為矯正']
            },
            {
                "id": 7,
                "title": '馬爾濟斯的毛髮護理全攻略',
                "tags": ['馬爾濟斯', '毛髮護理']
            },
            {
                "id": 8,
                "title": '臘腸狗的背部保健方法',
                "tags": ['臘腸狗', '脊椎健康']
            },
            {
                "id": 9,
                "title": '鬆獅犬的日常飲食建議',
                "tags": ['鬆獅犬', '營養', '飲食']
            },
            {
                "id": 10,
                "title": '貓狗和平相處的小技巧',
                "tags": ['貓咪', '犬隻', '相處']
            }
        ]


        return APIResponse(
            data={
                "articles": articles  # Wrap the list in a dictionary with a key
            }
        )