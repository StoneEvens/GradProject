from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from .models import Bulletin, AuctionResult, BulletinPetImage
from .forms import WinnerSubmissionForm
from django.contrib import messages
from utils.firebase_service import firebase_storage_service

# def bulletin_detail(request, pk):
#     bulletin = get_object_or_404(Bulletin, pk=pk)
#     display = (
#         AuctionResult.objects.filter(session__bulletin=bulletin, content_status="APPROVED")
#         .order_by("-session__end_date")
#         .first()
#     )
#     return render(request, "auctions/bulletin_detail.html", {
#         "bulletin": bulletin,
#         "display": display,
#     })
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
