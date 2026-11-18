"""
Create the PILOT-Pnn accounts used for the pilot study.

Each account gets:
  - a private user (account_privacy='private'), so nothing it posts is visible
    to anyone else;
  - one pet, 麻糬, a 5-year-old 柴犬 weighing 10.2 kg;
  - one abnormal record, 「軟便，一天兩次」, dated 2026-11-18 21:00 Taipei time,
    tagged with the 軟便 symptom and left private.

Credentials are derived from the index, zero-padded to two digits:
    PILOT-P01 / Password01  ...  PILOT-P25 / Password25

Safe to run more than once. Accounts, pets and records are matched on their
natural key and reused, so a second run reports "already there" and changes
nothing. Passwords are set only when the account is created, so a tester who
changes theirs does not get it reset underneath them; --reset-passwords forces
them back to the published value.

    python manage.py seed_pilot_accounts --dry-run
    python manage.py seed_pilot_accounts
    python manage.py seed_pilot_accounts --count 5 --start 26   # add P26..P30
    python manage.py seed_pilot_accounts --delete --yes         # clean up after

Note on the pet: the Pet model has no birth-date or sex field, so the persona's
2021-03-15 and 公（已結紮）are not stored; age=5 carries the age.
"""

import datetime

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from pets.models import AbnormalPost, Pet, PostSymptomsRelation, Symptom

User = get_user_model()

ACCOUNT_PREFIX = 'PILOT-P'

# The shared pet. Keys are Pet fields; anything the model does not have is not
# here (see the note in the module docstring).
PET = {
    'pet_name': '麻糬',
    'pet_type': '狗',
    'breed': '柴犬',
    'age': 5,
    'weight': 10.2,
    'pet_stage': 'adult',
    'description': '',
}

RECORD_CONTENT = '軟便，一天兩次'
RECORD_SYMPTOM = '軟便'
# Local wall-clock time; made timezone-aware below using the project's
# TIME_ZONE (Asia/Taipei), because USE_TZ is on and a naive datetime would be
# stored as UTC and show up at 05:00 the next morning.
RECORD_LOCAL_DATETIME = datetime.datetime(2026, 11, 18, 21, 0)


def account_name(n):
    return f'{ACCOUNT_PREFIX}{n:02d}'


def password_for(n):
    return f'Password{n:02d}'


class Command(BaseCommand):
    help = 'Create (or remove) the PILOT-Pnn pilot-study accounts, each with a pet and one abnormal record.'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=25,
                            help='How many accounts (default 25).')
        parser.add_argument('--start', type=int, default=1,
                            help='First index, so a later batch can continue the numbering (default 1).')
        parser.add_argument('--email-domain', default='pilot.invalid',
                            help='Domain for the generated addresses. The default is deliberately '
                                 'unroutable, so nothing can be mailed to a real inbox by accident.')
        parser.add_argument('--reset-passwords', action='store_true',
                            help='Also reset the password of accounts that already exist.')
        parser.add_argument('--skip-vectors', action='store_true',
                            help='Disconnect the BERT user-vector signals during the run. Each user '
                                 'and pet save embeds the owner, so 25 accounts means 50 embeddings; '
                                 'on the VPS that is slow. Run init_vector_dbs afterwards.')
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would happen, write nothing.')
        parser.add_argument('--delete', action='store_true',
                            help=f'Delete every {ACCOUNT_PREFIX}* account instead, with its pets and records.')
        parser.add_argument('--yes', action='store_true',
                            help='Confirm --delete without being asked.')

    # ------------------------------------------------------------------ main
    def handle(self, *args, **options):
        if options['delete']:
            return self.delete_accounts(options)

        count, start = options['count'], options['start']
        if count < 1 or start < 1:
            raise CommandError('--count and --start must be 1 or more.')
        if start + count - 1 > 99:
            raise CommandError('Indexes past 99 would break the two-digit naming.')

        dry = options['dry_run']
        indexes = range(start, start + count)

        if options['skip_vectors']:
            self.disconnect_vector_signals()

        record_at = timezone.make_aware(RECORD_LOCAL_DATETIME, timezone.get_default_timezone())

        self.stdout.write(
            f'{count} accounts, {account_name(start)} to {account_name(start + count - 1)}.\n'
            f'Record date {record_at:%Y-%m-%d %H:%M %Z}.'
        )

        symptom = self.ensure_symptom(dry)

        made = {'users': 0, 'pets': 0, 'records': 0, 'passwords': 0}
        for n in indexes:
            if dry:
                self.report_planned(n, options['email_domain'])
                continue
            with transaction.atomic():
                self.seed_one(n, options, symptom, record_at, made)

        if dry:
            self.stdout.write(self.style.WARNING('Dry run: nothing was written.'))
            return

        self.stdout.write(self.style.SUCCESS(
            f"Created {made['users']} accounts, {made['pets']} pets, {made['records']} records"
            + (f", reset {made['passwords']} passwords" if made['passwords'] else '')
            + '.'
        ))
        self.stdout.write(
            f'Sign in as {account_name(start)} / {password_for(start)} '
            f'through {account_name(start + count - 1)} / {password_for(start + count - 1)}.'
        )

    # ------------------------------------------------------------- one account
    def seed_one(self, n, options, symptom, record_at, made):
        name = account_name(n)

        user, created = User.objects.get_or_create(
            username=name,
            defaults={
                'user_account': name,
                'email': f'{name.lower()}@{options["email_domain"]}',
                'user_fullname': f'測試者 {n:02d}',
                'account_privacy': 'private',
            },
        )
        if created:
            user.set_password(password_for(n))
            user.save(update_fields=['password'])
            made['users'] += 1
            self.stdout.write(f'  {name}  account created')
        else:
            # An account from an earlier run. Make sure it is still private -
            # that is the point of these - and leave everything else alone.
            if user.account_privacy != 'private':
                user.account_privacy = 'private'
                user.save(update_fields=['account_privacy'])
                self.stdout.write(f'  {name}  set back to private')
            if options['reset_passwords']:
                user.set_password(password_for(n))
                user.save(update_fields=['password'])
                made['passwords'] += 1
            self.stdout.write(f'  {name}  account already there')

        pet, created = Pet.objects.get_or_create(
            owner=user, pet_name=PET['pet_name'], defaults=PET,
        )
        if created:
            made['pets'] += 1

        # One record per pet per day is what the rest of the app assumes, so
        # the date is the key: re-running must not add a second one.
        day_start = record_at.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = record_at.replace(hour=23, minute=59, second=59, microsecond=999999)
        record = AbnormalPost.objects.filter(
            pet=pet, record_date__range=(day_start, day_end)
        ).first()
        if record is None:
            record = AbnormalPost.objects.create(
                pet=pet,
                user=user,
                content=RECORD_CONTENT,
                record_date=record_at,
                is_emergency=False,
                is_private=True,
            )
            made['records'] += 1

        if symptom is not None:
            PostSymptomsRelation.objects.get_or_create(post=record, symptom=symptom)

    # ----------------------------------------------------------------- helpers
    def ensure_symptom(self, dry):
        """
        Make sure 軟便 exists before tagging anything with it.

        Every symptom lookup in this project is
        ``Symptom.objects.filter(symptom_name=...).first()`` - nothing creates
        on demand - so a missing row means the record is saved with no symptom
        and no error. seed_symptoms is the real source of the list; this just
        guarantees the one name this script needs.
        """
        symptom = Symptom.objects.filter(symptom_name=RECORD_SYMPTOM).first()
        if symptom is not None:
            return symptom
        if dry:
            self.stdout.write(self.style.WARNING(
                f'  {RECORD_SYMPTOM} is not in the database; it would be created.'))
            return None
        symptom = Symptom.objects.create(symptom_name=RECORD_SYMPTOM)
        self.stdout.write(self.style.WARNING(
            f'{RECORD_SYMPTOM} was missing and has been created. '
            'Run "manage.py seed_symptoms" for the full list.'))
        return symptom

    def report_planned(self, n, domain):
        name = account_name(n)
        state = 'exists' if User.objects.filter(username=name).exists() else 'new'
        self.stdout.write(
            f'  {name}  ({state})  password {password_for(n)}  {name.lower()}@{domain}')

    def disconnect_vector_signals(self, announce=True):
        disconnected = []
        try:
            from accounts.signals import update_user_vector_on_save
            post_save.disconnect(update_user_vector_on_save, sender=User)
            disconnected.append('user')
        except Exception:
            pass
        try:
            from pets.signals import update_owner_vector_on_pet_save
            post_save.disconnect(update_owner_vector_on_pet_save, sender=Pet)
            disconnected.append('pet')
        except Exception:
            pass
        if disconnected and announce:
            self.stdout.write(self.style.WARNING(
                f'Vector signals off ({", ".join(disconnected)}). Run init_vector_dbs afterwards.'))

    def disconnect_delete_signals(self):
        """
        Turn off the vector hooks that run while rows are being deleted.

        pets.signals.update_owner_vector_on_pet_delete used to read
        instance.owner outside its try block. Deleting a user cascades to
        their pets, and by the time that hook runs the owner row is already
        gone, so the whole delete blew up with CustomUser.DoesNotExist. That
        is fixed in pets/signals.py, but a server running an older copy still
        has it, and the vectors are rebuilt afterwards anyway.
        """
        for module, name, sender in (
            ('pets.signals', 'update_owner_vector_on_pet_delete', Pet),
            ('accounts.signals', 'remove_user_vector_on_delete', User),
        ):
            try:
                receiver = getattr(__import__(module, fromlist=[name]), name)
                post_delete.disconnect(receiver, sender=sender)
            except Exception:
                pass

    # ------------------------------------------------------------------ delete
    def delete_accounts(self, options):
        users = User.objects.filter(username__startswith=ACCOUNT_PREFIX)
        names = sorted(users.values_list('username', flat=True))
        if not names:
            self.stdout.write(f'No {ACCOUNT_PREFIX}* accounts to delete.')
            return

        pets = Pet.objects.filter(owner__in=users).count()
        records = AbnormalPost.objects.filter(user__in=users).count()
        self.stdout.write(
            f'This deletes {len(names)} accounts ({names[0]}..{names[-1]}), '
            f'{pets} pets and {records} abnormal records. It cannot be undone.'
        )
        if options['dry_run']:
            self.stdout.write(self.style.WARNING('Dry run: nothing was deleted.'))
            return
        if not options['yes']:
            raise CommandError('Refusing to delete without --yes.')

        self.disconnect_vector_signals(announce=False)
        self.disconnect_delete_signals()
        users.delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {len(names)} accounts and everything under them.'))
        self.stdout.write('Their vectors are stale now; run "manage.py init_vector_dbs" to rebuild.')
