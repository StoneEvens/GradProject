from django.conf import settings
from django.db import models
from django.utils import timezone


class Bulletin(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.title


class AuctionSession(models.Model):
    bulletin = models.ForeignKey(Bulletin, on_delete=models.CASCADE)
    session_code = models.CharField(max_length=20)  # e.g. "2025-W34"
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        unique_together = ("bulletin", "session_code")

    def __str__(self):
        return f"{self.bulletin.title} - {self.session_code}"


class AuctionResult(models.Model):
    session = models.OneToOneField(AuctionSession, on_delete=models.CASCADE)
    winning_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    winning_amount = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    # 新增展示內容
    pet_name = models.CharField(max_length=100, blank=True)
    pet_photo = models.ImageField(upload_to="pet_photos/", blank=True, null=True)

    STATUS_CHOICES = [
        ("PENDING", "Pending Review"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    ]
    content_status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default="PENDING"
    )
    published_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Result {self.session} - {self.winning_user}"

    def can_submit_content(self, user):
        return user == self.winning_user

    def mark_published(self):
        self.content_status = "APPROVED"
        self.published_at = timezone.now()
        self.save()


class Bid(models.Model):
    session = models.ForeignKey(AuctionSession, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    amount = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-amount", "created_at"]

    def __str__(self):
        return f"{self.user} bid {self.amount} on {self.session}"


class Wallet(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    balance = models.PositiveIntegerField(default=0)

    def deposit(self, amount):
        self.balance += amount
        self.save()

    def can_afford(self, amount):
        return self.balance >= amount

    def deduct(self, amount):
        if self.can_afford(amount):
            self.balance -= amount
            self.save()
            return True
        return False

    def __str__(self):
        return f"{self.user} Wallet ({self.balance})"
