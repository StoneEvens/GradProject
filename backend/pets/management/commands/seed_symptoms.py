"""
Populate the symptom list that abnormal records are tagged with.

Why this exists: every place that attaches a symptom to a record - the REST
API (pets/views.py), the MCP tools and the operation handler - looks the name
up with ``Symptom.objects.filter(symptom_name=...).first()`` and quietly skips
anything it does not find. There is no create-on-demand anywhere. So with an
empty table every abnormal record is saved with no symptoms at all, and no
error is raised; the symptom picker on the create page is simply empty.

The names below are the single source of truth. They match the keys in
frontend/src/utils/symptomTranslations.js, so each one renders in English,
Simplified Chinese and Japanese; a name that is not in both places shows up
untranslated.

Safe to run as often as you like: existing rows are left alone and nothing is
ever deleted.

    python manage.py seed_symptoms
    python manage.py seed_symptoms --dry-run
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from pets.models import Symptom

# Ordered by body system, because this order becomes the order of the dropdown
# on the create-record page (the API returns them by primary key).
SYMPTOMS = [
    # 消化道
    '嘔吐',            # Vomiting
    '腹瀉',            # Diarrhea
    '軟便',            # Soft stool
    '血便',            # Bloody stool
    '便祕',            # Constipation
    '食慾不振',        # Loss of appetite

    # 呼吸道
    '打噴嚏',          # Sneezing
    '咳嗽',            # Coughing
    '流鼻水',          # Runny nose
    '呼吸急促',        # Rapid breathing
    '呼吸困難',        # Laboured breathing

    # 皮膚與被毛
    '掉毛',            # Hair loss
    '皮膚紅腫',        # Red, swollen skin
    '皮膚搔癢',        # Itchy skin
    '皮屑增多',        # Flaky skin
    '傷口紅腫',        # Inflamed wound

    # 眼睛與耳朵
    '眼睛紅腫',        # Red, swollen eyes
    '眼睛分泌物增多',  # Eye discharge
    '頻繁搔抓耳朵',    # Scratching ears
    '耳朵有異味',      # Ear odour

    # 行動與精神
    '精神萎靡',        # Lethargy
    '焦躁不安',        # Restlessness
    '顫抖',            # Trembling
    '行動不便',        # Difficulty moving
    '跛行',            # Limping

    # 全身
    '發燒',            # Fever
    '體重下降',        # Weight loss
    '頻繁喝水',        # Excessive thirst
    '頻尿',            # Frequent urination
    '排尿困難',        # Difficulty urinating
    '抽搐',            # Seizures
    '牙齦蒼白',        # Pale gums

    # 其他
    '其他',            # Other
]


class Command(BaseCommand):
    help = 'Create the standard symptom list used by abnormal records.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would change, write nothing.')

    def handle(self, *args, **options):
        dry = options['dry_run']

        existing = set(Symptom.objects.values_list('symptom_name', flat=True))
        missing = [name for name in SYMPTOMS if name not in existing]

        self.stdout.write(
            f'{len(SYMPTOMS)} symptoms in the catalogue, '
            f'{len(SYMPTOMS) - len(missing)} already present, '
            f'{len(missing)} to add.'
        )

        if dry:
            for name in missing:
                self.stdout.write(f'  would add  {name}')
        elif missing:
            with transaction.atomic():
                for name in missing:
                    Symptom.objects.get_or_create(symptom_name=name)
                    self.stdout.write(f'  added  {name}')
            self.stdout.write(self.style.SUCCESS(f'Added {len(missing)} symptoms.'))
        else:
            self.stdout.write(self.style.SUCCESS('Nothing to add.'))

        # Rows that predate this list, or that someone typed by hand. Left in
        # place - they may already be attached to records - but worth seeing,
        # because they will not translate outside Chinese.
        unknown = sorted(existing - set(SYMPTOMS))
        if unknown:
            self.stdout.write(self.style.WARNING(
                f'{len(unknown)} symptom(s) in the database are not in this list: '
                + ', '.join(unknown)
            ))
