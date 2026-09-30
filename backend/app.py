"""
Entry point for DirectAdmin's "Setup Python App" (Passenger).

IMPORTANT: this file must NOT be called passenger_wsgi.py. The panel generates
its own passenger_wsgi.py whose only job is to import the startup file you name
in the "Application startup file" field. Naming that field passenger_wsgi.py
makes the generated stub import itself and recurse until Python gives up.

So: put this file in the application root (the folder holding manage.py, i.e.
the repo's backend/ directory) and set

    Application startup file  ->  app.py
    Application entry point   ->  application

The panel's generated passenger_wsgi.py is not ours and is gitignored.

Why the environment variables: this is shared hosting, where the account has
a limit on how many threads/processes it may start. PyTorch otherwise starts
one worker thread per CPU core (dozens on this machine) and gets refused with
"failed to spawn thread". One thread each is plenty for the recommendation
model, which only embeds short texts.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Keep native libraries single-threaded (see docstring)
for _key, _value in {
    "OMP_NUM_THREADS": "1",
    "MKL_NUM_THREADS": "1",
    "OPENBLAS_NUM_THREADS": "1",
    "NUMEXPR_NUM_THREADS": "1",
    "TOKENIZERS_PARALLELISM": "false",
    # The Rust tokenizer builds its own rayon thread pool and ignores the
    # OpenMP variables above; without this it tries one thread per CPU core
    # and panics with "The global thread pool has not been initialized".
    "RAYON_NUM_THREADS": "1",
    # Model files are on disk; never try to download from Hugging Face at runtime
    "HF_HUB_DISABLE_XET": "1",
    "HF_HUB_OFFLINE": "1",
    "TRANSFORMERS_OFFLINE": "1",
}.items():
    os.environ.setdefault(_key, _value)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "gradProject.settings")

# Secrets and per-server settings live in backend/.env (not in git)
try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(BASE_DIR, ".env"))
except Exception:  # pragma: no cover - dotenv is optional
    pass

try:
    import torch

    torch.set_num_threads(1)
except Exception:  # torch missing or unusable: the app still runs
    pass

from gradProject.wsgi import application  # noqa: E402  (must come after the setup above)
