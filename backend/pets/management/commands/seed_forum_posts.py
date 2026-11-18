# -*- coding: utf-8 -*-
"""
Seed the ten forum posts used in the recall experiment.

Each row of the study CSV becomes a complete, native-looking forum thread:
an author account, that author's pet, one abnormal record, and a public
disease archive (DiseaseArchiveContent + PostFrame) linking them - the same
objects, in the same order, that CreateDiseaseArchiveAPIView builds.

Dates are counted back from the experiment day (--experiment-date), so the
feed shows the spread the study design asks for rather than ten posts all
stamped today.

Two things about symptoms are worth knowing before you read the output.
Symptom lookup everywhere in this project is
``Symptom.objects.filter(symptom_name=...).first()`` - an unmatched name is
dropped without an error - so each CSV label is mapped onto a name that
seed_symptoms creates. The mapping is printed on every run. Where a label has no
equivalent, the record is still created and simply carries no tag, and the
command says so rather than letting it vanish quietly. Nothing is unmapped at
the moment: 挑食 is tagged 食慾不振, so four of the ten posts share that tag.

The record's own text keeps the CSV's original wording even where the tag is
mapped, so a post about 食量減少 still reads 食量減少 to a participant even
though it is tagged 食慾不振.

    python manage.py seed_forum_posts --experiment-date 2026-11-18 --dry-run
    python manage.py seed_forum_posts --experiment-date 2026-11-18
    python manage.py seed_forum_posts --delete --yes
"""

import csv
import datetime

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from pets.models import (
    AbnormalPost, ArchiveAbnormalPostRelation, DiseaseArchiveContent,
    Pet, PostSymptomsRelation, Symptom,
)
from social.models import Interactables, PostFrame

User = get_user_model()

ACCOUNT_PREFIX = 'FORUM-A'

# CSV label -> a symptom seed_symptoms creates. None means "no equivalent":
# the record is created without a tag and the run reports it.
SYMPTOM_MAP = {
    '食慾不振': '食慾不振',
    '嘔吐': '嘔吐',
    '打噴嚏': '打噴嚏',
    '飲水量增加': '頻繁喝水',
    '食量減少': '食慾不振',      # collapses onto row 1's tag by design decision
    '皮膚紅疹': '皮膚紅腫',
    '走路跛腳': '跛行',
    '眼睛分泌物': '眼睛分泌物增多',
    '挑食': '食慾不振',        # asked for as 食慾不佳; 食慾不振 is the name that exists
}

# The study CSV, embedded so the command is self-contained on the server.
# (number, role, author, species, breed, pet, symptom, title, body, days_before, went_to_doctor)
ROWS = [
    (1, '目標', '小芋圓媽', '狗', '柴犬', '芋圓', '食慾不振',
     '柴犬兩天都不太吃飯，正常嗎？',
     '芋圓已經連續兩天食慾不振，平常一餐都吃光，這兩天只吃幾口。精神看起來還好，也有喝水，想問大家要再觀察還是直接看醫生？',
     9, False),
    (2, '相近干擾', '吐司爸', '狗', '米克斯', '吐司', '食慾不振',
     '昨晚突然不吃晚餐',
     '吐司昨天晚餐一口都沒吃，今天早上就恢復正常了。是不是天氣太熱的關係？',
     4, False),
    (3, '相近干擾', 'Lucky 的家', '狗', '柯基', 'Lucky', '飲水量增加',
     '這兩天一直喝水',
     'Lucky 連續兩天喝水量變成平常的兩倍，吃飯和精神都正常。有人遇過類似情況嗎？',
     6, False),
    (4, '相近干擾', '三花貓奴', '貓', '米克斯', '三花', '食量減少',
     '貓咪一週食量變少',
     '三花這一週吃的量大概只有平常一半，也比較常躲起來睡覺。已經約了下週看醫生。',
     12, True),
    (5, '相近干擾', '豆皮哥', '狗', '貴賓', '豆皮', '嘔吐',
     '吃完飯就吐',
     '豆皮今天早上吃完飯十分鐘就吐了，食慾倒是很好，吐完又想吃。需要禁食一下嗎？',
     2, False),
    (6, '相近干擾', 'Momo 媽咪', '狗', '博美', 'Momo', '挑食',
     '換飼料後只挑舊的吃',
     '上週開始換新飼料，Momo 把新的挑出來只吃舊的，混在一起也一樣。這算是食慾不好嗎？',
     15, False),
    (7, '無關貼文', '阿福爸', '狗', '黃金獵犬', '阿福', '皮膚紅疹',
     '肚子上冒出紅疹',
     '阿福肚子上出現一小片紅疹，會一直舔。最近有換洗毛精，不知道有沒有關係。',
     7, False),
    (8, '無關貼文', '橘子奴才', '貓', '橘貓', '橘子', '打噴嚏',
     '貓咪一直打噴嚏',
     '橘子這三天常常打噴嚏，偶爾有一點鼻水，食慾正常。',
     10, False),
    (9, '無關貼文', '布丁家', '狗', '臘腸', '布丁', '走路跛腳',
     '散步回來後腳有點跛',
     '布丁散步回來後右後腳好像不太敢踩地，摸的時候會縮。',
     3, False),
    (10, '無關貼文', '小黑的主人', '貓', '黑貓', '小黑', '眼睛分泌物',
     '眼睛分泌物變多',
     '小黑最近眼屎變多，顏色偏咖啡色，眼睛看起來沒有紅腫。',
     13, False),
]

POST_HOUR = 20           # posts land at 20:00 local time on their day
RECORD_HOUR = 19         # the abnormal record an hour before the post


# A visit already booked or made, not a question about whether to go. The
# embedded rows carry this explicitly; only --csv has to infer it, because the
# study CSV has no column for it. Matching on "看醫生" alone would mark row 1
# ("要再觀察還是直接看醫生？") as a vet visit, which it is not.
DOCTOR_MARKERS = ('已經約', '已約', '已經帶', '帶去看', '看過醫生', '就醫過', '已就醫')


def went_to_doctor(body):
    return any(marker in body for marker in DOCTOR_MARKERS)


def account_name(n):
    return f'{ACCOUNT_PREFIX}{n:02d}'


def password_for(n):
    return f'ForumPass{n:02d}'


def email_for(n, domain):
    # The login identifier: the login form posts `email` and the serializer
    # looks the account up by it.
    return f'{account_name(n).lower()}@{domain}'


class Command(BaseCommand):
    help = 'Seed the ten experiment forum posts, with their authors, pets and abnormal records.'

    def add_arguments(self, parser):
        parser.add_argument('--experiment-date', required=True,
                            help='The study day, YYYY-MM-DD. Post dates are counted back from it.')
        parser.add_argument('--csv', dest='csv_path', default=None,
                            help='Read the rows from this CSV instead of the embedded copy. '
                                 'Same columns as seed_forum_posts.csv.')
        parser.add_argument('--email-domain', default='pilot.invalid',
                            help='Domain for the author addresses (default unroutable).')
        parser.add_argument('--skip-vectors', action='store_true',
                            help='Disconnect the vector signals during the run. A public archive is '
                                 'embedded on save, so without this the run makes an embedding call '
                                 'per post. Run init_vector_dbs afterwards.')
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would happen, write nothing.')
        parser.add_argument('--delete', action='store_true',
                            help=f'Delete every {ACCOUNT_PREFIX}* author instead, with their pets, '
                                 'records and archives.')
        parser.add_argument('--yes', action='store_true', help='Confirm --delete.')

    # ------------------------------------------------------------------ main
    def handle(self, *args, **options):
        if options['delete']:
            return self.delete_authors(options)

        try:
            day = datetime.datetime.strptime(options['experiment_date'], '%Y-%m-%d').date()
        except ValueError:
            raise CommandError('--experiment-date must look like 2026-11-18.')

        rows = self.load_rows(options['csv_path'])
        dry = options['dry_run']

        if options['skip_vectors']:
            self.disconnect_vector_signals()

        self.stdout.write(f'Experiment day {day}. {len(rows)} posts, '
                          f'{day - datetime.timedelta(days=max(r[9] for r in rows))} to '
                          f'{day - datetime.timedelta(days=min(r[9] for r in rows))}.')
        self.report_symptom_mapping(rows, dry)

        made = {'authors': 0, 'pets': 0, 'records': 0, 'archives': 0}
        for row in rows:
            posted_on = day - datetime.timedelta(days=row[9])
            if dry:
                self.report_planned(row, posted_on, options['email_domain'])
                continue
            with transaction.atomic():
                self.seed_one(row, posted_on, options, made)

        if dry:
            self.stdout.write(self.style.WARNING('Dry run: nothing was written.'))
            return

        self.stdout.write(self.style.SUCCESS(
            f"Created {made['authors']} authors, {made['pets']} pets, "
            f"{made['records']} abnormal records, {made['archives']} forum posts."))
        self.stdout.write('All archives are public, so they appear in the forum immediately.')
        if options['skip_vectors']:
            self.stdout.write('Run "manage.py init_vector_dbs" so they are searchable.')

    # ------------------------------------------------------------------- rows
    def load_rows(self, path):
        if not path:
            return ROWS
        rows = []
        with open(path, encoding='utf-8-sig', newline='') as fh:
            for i, r in enumerate(csv.DictReader(fh), start=1):
                if not (r.get('貼文標題') or '').strip():
                    continue       # trailing blank line
                rows.append((
                    int(r['編號']), r['角色'].strip(), r['作者暱稱'].strip(),
                    r['寵物種類'].strip(), r['品種'].strip(), r['寵物名字'].strip(),
                    r['附加的異常紀錄（症狀）'].strip(), r['貼文標題'].strip(),
                    r['貼文內容'].strip(), int(r['發文時間（實驗日前幾天）']),
                    went_to_doctor(r['貼文內容']),
                ))
        if not rows:
            raise CommandError(f'No usable rows in {path}.')
        return rows

    def report_symptom_mapping(self, rows, dry):
        self.stdout.write('Symptom tags:')
        missing_in_db = []
        for row in rows:
            label = row[6]
            mapped = SYMPTOM_MAP.get(label, label)
            if mapped is None:
                self.stdout.write(self.style.WARNING(
                    f'  {label:<6} -> (no equivalent) record {row[0]} will have no symptom tag'))
                continue
            exists = Symptom.objects.filter(symptom_name=mapped).exists()
            if not exists:
                missing_in_db.append(mapped)
            arrow = '=' if mapped == label else '->'
            note = '' if exists else '   MISSING from the database'
            self.stdout.write(f'  {label:<6} {arrow} {mapped}{note}')
        if missing_in_db:
            self.stdout.write(self.style.ERROR(
                'Run "manage.py seed_symptoms" first: ' + ', '.join(sorted(set(missing_in_db)))
                + ' would be dropped silently.'))

    # ------------------------------------------------------------- one thread
    def seed_one(self, row, posted_on, options, made):
        (number, role, nickname, species, breed, pet_name,
         symptom_label, title, body, _days, went_to_doctor) = row

        name = account_name(number)
        author, created = User.objects.get_or_create(
            username=name,
            defaults={
                # user_account is what the forum card shows as the author name,
                # so the nickname goes there; username stays an ASCII handle.
                'user_account': nickname,
                'email': email_for(number, options['email_domain']),
                'user_fullname': nickname,
                'account_privacy': 'public',   # their posts are meant to be found
            },
        )
        if created:
            author.set_password(password_for(number))
            author.save(update_fields=['password'])
            made['authors'] += 1

        pet, created = Pet.objects.get_or_create(
            owner=author, pet_name=pet_name,
            defaults={'pet_type': species, 'breed': breed, 'pet_stage': 'adult'},
        )
        if created:
            made['pets'] += 1

        tz = timezone.get_default_timezone()
        record_at = timezone.make_aware(
            datetime.datetime.combine(posted_on, datetime.time(RECORD_HOUR, 0)), tz)
        posted_at = timezone.make_aware(
            datetime.datetime.combine(posted_on, datetime.time(POST_HOUR, 0)), tz)

        record = AbnormalPost.objects.filter(pet=pet, record_date=record_at).first()
        if record is None:
            record = AbnormalPost.objects.create(
                pet=pet, user=author,
                # the CSV's own wording, even where the tag below is mapped
                content=symptom_label,
                record_date=record_at,
                is_emergency=went_to_doctor,
                is_private=False,          # public, to match the published archive
            )
            made['records'] += 1

        mapped = SYMPTOM_MAP.get(symptom_label, symptom_label)
        if mapped:
            symptom = Symptom.objects.filter(symptom_name=mapped).first()
            if symptom is not None:
                PostSymptomsRelation.objects.get_or_create(post=record, symptom=symptom)

        archive = DiseaseArchiveContent.objects.filter(
            pet=pet, archive_title=title).first()
        if archive is None:
            frame = PostFrame.objects.create(user=author)
            archive = DiseaseArchiveContent.objects.create(
                archive_title=title,
                content=body,
                go_to_doctor=went_to_doctor,
                health_status='治療中' if went_to_doctor else '觀察中',
                pet=pet,
                postFrame=frame,
                is_private=False,          # public: this is the forum
            )
            ArchiveAbnormalPostRelation.objects.get_or_create(archive=archive, post=record)
            # created_at is auto_now_add, so it cannot be passed to create();
            # .update() writes the column directly and skips auto fields.
            Interactables.objects.filter(pk=frame.pk).update(created_at=posted_at)
            made['archives'] += 1

        self.stdout.write(
            f'  {number:>2}. {posted_on}  {role:<5}  {nickname:<10}  {title}')

    def report_planned(self, row, posted_on, domain):
        number, role, nickname = row[0], row[1], row[2]
        state = 'exists' if User.objects.filter(username=account_name(number)).exists() else 'new'
        self.stdout.write(
            f'  {number:>2}. {posted_on}  {role:<5}  {nickname:<10}  ({state})  '
            f'login {email_for(number, domain)} / {password_for(number)}')

    # ---------------------------------------------------------------- signals
    def disconnect_vector_signals(self):
        pairs = (
            ('accounts.signals', 'update_user_vector_on_save', post_save, User),
            ('pets.signals', 'update_owner_vector_on_pet_save', post_save, Pet),
            ('pets.signals', 'update_disease_archive_vector_on_save', post_save, DiseaseArchiveContent),
            ('pets.signals', 'update_owner_vector_on_pet_delete', post_delete, Pet),
            ('accounts.signals', 'remove_user_vector_on_delete', post_delete, User),
            ('pets.signals', 'delete_disease_archive_vector_on_delete', post_delete, DiseaseArchiveContent),
        )
        off = 0
        for module, attr, signal, sender in pairs:
            try:
                signal.disconnect(getattr(__import__(module, fromlist=[attr]), attr), sender=sender)
                off += 1
            except Exception:
                pass
        if off:
            self.stdout.write(self.style.WARNING(f'Vector signals off ({off}).'))

    # ----------------------------------------------------------------- delete
    def delete_authors(self, options):
        authors = User.objects.filter(username__startswith=ACCOUNT_PREFIX)
        names = sorted(authors.values_list('username', flat=True))
        if not names:
            self.stdout.write(f'No {ACCOUNT_PREFIX}* authors to delete.')
            return
        archives = DiseaseArchiveContent.objects.filter(postFrame__user__in=authors).count()
        records = AbnormalPost.objects.filter(user__in=authors).count()
        self.stdout.write(
            f'This deletes {len(names)} authors ({names[0]}..{names[-1]}), their pets, '
            f'{records} abnormal records and {archives} forum posts. It cannot be undone.')
        if options['dry_run']:
            self.stdout.write(self.style.WARNING('Dry run: nothing was deleted.'))
            return
        if not options['yes']:
            raise CommandError('Refusing to delete without --yes.')
        self.disconnect_vector_signals()
        authors.delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {len(names)} authors and everything under them.'))
        self.stdout.write('Run "manage.py init_vector_dbs" to clear them from the vector index.')
