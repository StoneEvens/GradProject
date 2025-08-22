from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from .models import Bulletin, AuctionResult
from .forms import WinnerSubmissionForm


def bulletin_detail(request, pk):
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


@login_required
def winner_submit(request, result_id):
    result = get_object_or_404(AuctionResult, pk=result_id)

    if not result.can_submit_content(request.user):
        return render(request, "auctions/not_allowed.html")

    if request.method == "POST":
        form = WinnerSubmissionForm(request.POST, request.FILES, instance=result)
        if form.is_valid():
            form.save()
            return redirect("auctions:bulletin_detail", pk=result.session.bulletin.pk)
    else:
        form = WinnerSubmissionForm(instance=result)

    return render(request, "auctions/winner_submit.html", {"form": form, "result": result})
