from django.contrib import admin

# Register your models here.
from django.contrib import admin
from feeds.models import Feed

admin.site.register(Feed)