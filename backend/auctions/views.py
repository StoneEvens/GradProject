from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from .models import Bulletin, AuctionResult, BulletinPetImage, AuctionSession, Bid, Wallet
from .serializers import BidSerializer
from .forms import WinnerSubmissionForm
from django.contrib import messages
from utils.firebase_service import firebase_storage_service
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

class SessionBidsView(generics.ListAPIView):
    """
    查看某個場次的所有出價紀錄
    GET /api/v1/auctions/sessions/<id>/bids/
    """
    serializer_class = BidSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        session_id = self.kwargs["session_id"]
        session = get_object_or_404(AuctionSession, id=session_id)
        return Bid.objects.filter(session=session).order_by("-amount", "created_at")

class SettleAuctionView(APIView):
    """
    結算某場拍賣
    POST /api/v1/auctions/sessions/<id>/settle/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        session = get_object_or_404(AuctionSession, id=session_id)
        result = session.settle()

        if result:
            return Response(
                {
                    "message": "結算完成",
                    "winner": result.winning_user.username,
                    "amount": result.winning_amount,
                },
                status=status.HTTP_200_OK
            )
        return Response({"error": "沒有出價，無法結算"}, status=status.HTTP_400_BAD_REQUEST)

class PlaceBidView(generics.GenericAPIView):
    """
    出價或更新出價
    POST /api/v1/auctions/sessions/<id>/bid/
    body: {"amount": 300}
    """
    serializer_class = BidSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        session = get_object_or_404(AuctionSession, id=session_id)
        amount = request.data.get("amount")

        if not amount or int(amount) <= 0:
            return Response({"error": "出價金額必須大於 0"}, status=status.HTTP_400_BAD_REQUEST)

        amount = int(amount)
        wallet = Wallet.objects.get(user=request.user)

        if not wallet.can_afford(amount):
            return Response({"error": "金幣不足，請先儲值"}, status=status.HTTP_400_BAD_REQUEST)

        # ✅ 更新或建立出價
        bid, created = Bid.objects.update_or_create(
            session=session,
            user=request.user,
            defaults={"amount": amount}
        )

        return Response(
            {
                "message": "出價成功" if created else "出價已更新",
                "bid": BidSerializer(bid).data,
            },
            status=status.HTTP_200_OK
        )

class CurrentHighestBidView(generics.RetrieveAPIView):
    """
    查看當前場次最高出價
    GET /api/v1/auctions/sessions/<id>/highest_bid/
    """
    serializer_class = BidSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        session_id = self.kwargs["session_id"]
        session = get_object_or_404(AuctionSession, id=session_id)
        return Bid.objects.filter(session=session).order_by("-amount", "created_at").first()


def bulletin_detail(request, pk):
    from .models import Bulletin, AuctionResult
    bulletin = get_object_or_404(Bulletin, pk=pk)
    display = (
        AuctionResult.objects.filter(session__bulletin=bulletin, content_status="APPROVED")
        .order_by("-session__end_date")
        .first()
    )
    return render(request, "auctions/bulletin_detail.html", {
        "bulletin": bulletin,
        "display": display,
    })

# @login_required
# def winner_submit(request, result_id):
#     result = get_object_or_404(AuctionResult, pk=result_id)

#     if not result.can_submit_content(request.user):
#         return render(request, "auctions/not_allowed.html")

#     if request.method == "POST":
#         form = WinnerSubmissionForm(request.POST, request.FILES, instance=result)
#         if form.is_valid():
#             form.save()
#             return redirect("auctions:bulletin_detail", pk=result.session.bulletin.pk)
#     else:
#         form = WinnerSubmissionForm(instance=result)

#     return render(request, "auctions/winner_submit.html", {"form": form, "result": result})

@login_required
def winner_submit(request, result_id):
    result = get_object_or_404(AuctionResult, pk=result_id)

    if not result.can_submit_content(request.user):
        messages.error(request, "只有本回合的贏家可以提交內容")
        return redirect("auctions:bulletin_detail", pk=result.session.bulletin.pk)

    if request.method == "POST":
        form = WinnerSubmissionForm(request.POST, request.FILES, instance=result)
        if form.is_valid():
            # 更新寵物名字
            result.pet_name = form.cleaned_data["pet_name"]

            # 處理上傳圖片
            pet_file = form.cleaned_data.get("pet_photo")
            if pet_file:
                success, msg, firebase_url, firebase_path = firebase_storage_service.upload_bulletin_pet_image(
                    user_id=request.user.id,
                    session_code=result.session.session_code,
                    image_file=pet_file,
                )

                if success:
                    # 如果有舊的，先刪除
                    if hasattr(result, "pet_image"):
                        result.pet_image.delete()

                    BulletinPetImage.objects.create(
                        result=result,
                        firebase_url=firebase_url,
                        firebase_path=firebase_path,
                        original_filename=pet_file.name,
                        file_size=pet_file.size,
                        content_type_mime=pet_file.content_type,
                    )
                else:
                    messages.error(request, msg)

            # 更新狀態
            result.content_status = "PENDING"
            result.save()

            messages.success(request, "已提交，等待審核")
            return redirect("auctions:bulletin_detail", pk=result.session.bulletin.pk)
    else:
        form = WinnerSubmissionForm(instance=result)

    return render(request, "auctions/winner_submit.html", {"form": form, "result": result})
