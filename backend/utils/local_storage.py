"""
Local file storage that mimics the small part of the Firebase Storage
(google-cloud-storage) bucket/blob API used by utils/firebase_service.py.

Enable with IMAGE_STORAGE_BACKEND=local. Files are written under
settings.LOCAL_IMAGE_ROOT and served by Django at settings.LOCAL_IMAGE_URL
(see gradProject/urls.py). The rest of the app keeps using
FirebaseStorageService unchanged.
"""

import os
import shutil
from pathlib import Path
from urllib.parse import quote


class LocalBlob:
    def __init__(self, bucket: "LocalBucket", name: str):
        self.bucket = bucket
        self.name = name
        self.content_type = None
        self._path = bucket.resolve(name)

    def upload_from_file(self, file_obj):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self._path.with_name(self._path.name + ".part")
        with open(tmp_path, "wb") as out:
            shutil.copyfileobj(file_obj, out)
        os.replace(tmp_path, self._path)

    def exists(self) -> bool:
        return self._path.is_file()

    def make_public(self):
        # Local files are always served by Django; nothing to do.
        return None

    @property
    def public_url(self) -> str:
        return f"{self.bucket.base_url}{quote(self.name)}"

    def delete(self):
        self._path.unlink(missing_ok=True)


class LocalBucket:
    def __init__(self, root, base_url: str, public_base_url: str = ""):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        base_url = base_url if base_url.endswith("/") else base_url + "/"
        # Absolute when PUBLIC_MEDIA_BASE_URL is set (frontend on another domain),
        # otherwise a relative path like /media/images/
        self.base_url = public_base_url.rstrip("/") + base_url if public_base_url else base_url
        self.name = f"local:{self.root}"

    def resolve(self, name: str) -> Path:
        """Map a storage path like 'posts/user_1/abc.jpg' to a file under root,
        refusing anything that would escape the root folder."""
        path = (self.root / name.lstrip("/\\")).resolve()
        if path != self.root and self.root not in path.parents:
            raise ValueError(f"Invalid storage path: {name}")
        return path

    def blob(self, name: str) -> LocalBlob:
        return LocalBlob(self, name)
