"""
Attach placeholder images to seeded demo posts.

The demo fixture carries post text, hashtags, pets and comments, but not
images: the originals lived in a Firebase bucket that no longer exists, and
re-uploading real photos over a slow link is not worth it.

This generates small PNGs locally (no Pillow needed - the PNG encoder below is
pure standard library), writes them into LOCAL_IMAGE_ROOT where Django already
serves /media/images/, and creates the matching Image rows.

Safe to run more than once: posts that already have an image are skipped.

    python manage.py seed_demo_images
    python manage.py seed_demo_images --dry-run
"""

import os
import struct
import zlib

from django.conf import settings
from django.core.management.base import BaseCommand

SUBDIR = 'posts/demo'

# Muted, distinguishable background colours so a feed of demo posts does not
# look like the same card repeated.
PALETTE = [
    (0xC9, 0x7B, 0x5A), (0x6E, 0x8B, 0x74), (0x5A, 0x6F, 0x94),
    (0xB0, 0x8A, 0xA8), (0xC2, 0xA2, 0x5E), (0x7A, 0x8C, 0x99),
    (0xA8, 0x6B, 0x6B), (0x6B, 0x8E, 0x8E),
]


def _png(width: int, height: int, rgb, seed: int) -> bytes:
    """A gradient PNG, written without any third-party library."""
    r0, g0, b0 = rgb
    rows = bytearray()
    for y in range(height):
        rows.append(0)  # filter type 0 (None) for this scanline
        # vertical gradient, plus a faint diagonal band so each image differs
        t = y / max(height - 1, 1)
        for x in range(width):
            band = 18 if ((x + y * 2 + seed * 37) // 48) % 2 else 0
            rows.append(min(255, max(0, int(r0 * (1 - 0.35 * t)) + band)))
            rows.append(min(255, max(0, int(g0 * (1 - 0.35 * t)) + band)))
            rows.append(min(255, max(0, int(b0 * (1 - 0.35 * t)) + band)))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib.compress(bytes(rows), 9))
            + chunk(b'IEND', b''))


class Command(BaseCommand):
    help = 'Give seeded demo posts a placeholder image so they render like real posts.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would happen, change nothing.')
        parser.add_argument('--width', type=int, default=800)
        parser.add_argument('--height', type=int, default=600)

    def handle(self, *args, **options):
        from media.models import Image
        from social.models import PostFrame, SoLContent

        dry = options['dry_run']
        width, height = options['width'], options['height']

        root = getattr(settings, 'LOCAL_IMAGE_ROOT', None)
        url_prefix = getattr(settings, 'LOCAL_IMAGE_URL', '/media/images/')
        base_url = (getattr(settings, 'PUBLIC_MEDIA_BASE_URL', '') or '').rstrip('/')

        if not root:
            self.stderr.write(self.style.ERROR('LOCAL_IMAGE_ROOT is not configured.'))
            return
        if not base_url:
            self.stdout.write(self.style.WARNING(
                'PUBLIC_MEDIA_BASE_URL is empty: image URLs will be relative, '
                'which breaks when the frontend is on another domain.'))

        frame_ids = set(SoLContent.objects.values_list('postFrame_id', flat=True))
        already = set(Image.objects.filter(postFrame_id__in=frame_ids)
                      .values_list('postFrame_id', flat=True))
        todo = sorted(frame_ids - already)

        self.stdout.write(
            f'{len(frame_ids)} social posts, {len(already)} already have an image, '
            f'{len(todo)} to fill.'
        )
        if not todo:
            self.stdout.write(self.style.SUCCESS('Nothing to do.'))
            return
        if dry:
            self.stdout.write(f'Would write {len(todo)} images into {os.path.join(root, SUBDIR)}')
            return

        out_dir = os.path.join(root, SUBDIR)
        os.makedirs(out_dir, exist_ok=True)

        created = 0
        for i, frame_id in enumerate(todo):
            colour = PALETTE[i % len(PALETTE)]
            name = f'demo_{frame_id}.png'
            rel_path = f'{SUBDIR}/{name}'
            abs_path = os.path.join(out_dir, name)

            blob = _png(width, height, colour, seed=i)
            with open(abs_path, 'wb') as fh:
                fh.write(blob)

            try:
                frame = PostFrame.objects.get(id=frame_id)
            except PostFrame.DoesNotExist:
                continue

            Image.objects.create(
                postFrame=frame,
                firebase_url=f'{base_url}{url_prefix}{rel_path}',
                firebase_path=rel_path,
                original_filename=name,
                file_size=len(blob),
                content_type_mime='image/png',
                alt_text='示範圖片',
                sort_order=0,
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(
            f'Created {created} placeholder images in {out_dir}'
        ))
        self.stdout.write(
            'Next: delete social_post_embs.npy and social_post_ids.npy, then restart, '
            'so the recommendation index is rebuilt from the new posts.'
        )
