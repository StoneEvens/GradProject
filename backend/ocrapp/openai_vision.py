"""
OCR via the OpenAI Responses API.

This replaces Google Cloud Vision, which stopped working because it needs a
service-account JSON file (``ai-project-454107-a1e8b881803e.json``) that was
never in the repository and does not exist on the server.

Two things changed with the move, and the second one matters more than the
first:

1.  No credentials file. The only secret is OPENAI_API_KEY, which the project
    already sets for the AI agent.

2.  The model returns the *fields*, not a wall of text. The old pipeline ran
    Vision to get raw text and then pulled values out with regexes like
    ``{alias}.*?([\\d\\.]+)\\s*([^\\s]+)`` over the whole page flattened into
    one line - which happily matched a number from a different row. Here the
    model is asked for a JSON object that satisfies a schema, so a value comes
    back attached to the field it was printed next to.

PDFs go straight to the API as input_file; nothing is rasterised locally, so
pdf2image and its poppler binaries are no longer needed.

Cost, at the default model (gpt-6-luna, the cheapest vision-capable model):
roughly US$0.0002 per page. See OCR_MODEL in settings.py to change it.
"""

import base64
import json
import logging
from typing import Any, Dict, Optional

from django.conf import settings

logger = logging.getLogger(__name__)

# Keep this well under the API's own 50 MB limit: the request body is held in
# memory in the Passenger worker, which is tightly capped on shared hosting.
MAX_UPLOAD_BYTES = 12 * 1024 * 1024

# Magic bytes are checked rather than Content-Type, which the browser sets and
# is often wrong (phones send image/jpeg for HEIC, for instance).
_SIGNATURES = (
    (b'\x89PNG\r\n\x1a\n', 'image/png'),
    (b'\xff\xd8\xff', 'image/jpeg'),
    (b'GIF87a', 'image/gif'),
    (b'GIF89a', 'image/gif'),
    (b'%PDF-', 'application/pdf'),
)


class OCRConfigurationError(RuntimeError):
    """The server is not set up for OCR (no API key, SDK missing)."""


class OCRExtractionError(RuntimeError):
    """The file could not be read, or the API call failed."""


def sniff_media_type(blob: bytes, fallback: str = '') -> str:
    """Return the real media type of ``blob``, or '' if it is not one we accept."""
    for signature, media_type in _SIGNATURES:
        if blob.startswith(signature):
            return media_type
    # WEBP is 'RIFF....WEBP', so the marker is not at offset 0.
    if blob[:4] == b'RIFF' and blob[8:12] == b'WEBP':
        return 'image/webp'
    fallback = (fallback or '').split(';')[0].strip().lower()
    if fallback in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'):
        return fallback
    return ''


def read_upload(uploaded_file) -> bytes:
    """Read a Django UploadedFile, refusing anything too large or unreadable."""
    size = getattr(uploaded_file, 'size', None)
    if size is not None and size > MAX_UPLOAD_BYTES:
        raise OCRExtractionError(
            f'檔案過大（{size / 1048576:.1f} MB），請上傳 {MAX_UPLOAD_BYTES // 1048576} MB 以內的檔案'
        )
    try:
        blob = uploaded_file.read()
    except Exception as exc:  # pragma: no cover - depends on the storage backend
        raise OCRExtractionError('無法讀取上傳的檔案') from exc
    if not blob:
        raise OCRExtractionError('上傳的檔案是空的')
    if len(blob) > MAX_UPLOAD_BYTES:
        raise OCRExtractionError(
            f'檔案過大（{len(blob) / 1048576:.1f} MB），請上傳 {MAX_UPLOAD_BYTES // 1048576} MB 以內的檔案'
        )
    return blob


def _build_file_part(blob: bytes, media_type: str, filename: str) -> Dict[str, Any]:
    encoded = base64.b64encode(blob).decode('ascii')
    if media_type == 'application/pdf':
        return {
            'type': 'input_file',
            # The API uses the extension to decide how to parse the bytes, so a
            # name without '.pdf' is rejected even when the data URL is right.
            'filename': filename if filename.lower().endswith('.pdf') else 'report.pdf',
            'file_data': f'data:application/pdf;base64,{encoded}',
        }
    return {
        'type': 'input_image',
        'image_url': f'data:{media_type};base64,{encoded}',
        # Lab reports and ingredient panels are small print. 'low' downsamples
        # far enough to lose decimal points, and the price difference is
        # fractions of a cent.
        'detail': 'high',
    }


def extract(
    uploaded_file,
    *,
    schema_name: str,
    schema: Dict[str, Any],
    instructions: str,
    prompt: str,
    model: Optional[str] = None,
    max_output_tokens: int = 4000,
) -> Dict[str, Any]:
    """
    Send one image or PDF to the model and return the JSON object it produced.

    ``schema`` is a JSON Schema object sent with strict structured outputs, so
    the result is guaranteed to match it: every key is present, every enum
    value is one we listed. Callers do not need to defend against missing keys.

    Raises OCRConfigurationError or OCRExtractionError; never returns partial
    results silently.
    """
    api_key = getattr(settings, 'OPENAI_API_KEY', '') or ''
    if not api_key:
        raise OCRConfigurationError('伺服器未設定 OPENAI_API_KEY，無法使用辨識功能')

    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover - openai is in requirements
        raise OCRConfigurationError('伺服器未安裝 openai 套件') from exc

    blob = read_upload(uploaded_file)
    media_type = sniff_media_type(blob, getattr(uploaded_file, 'content_type', ''))
    if not media_type:
        raise OCRExtractionError('不支援的檔案格式，請上傳 JPG、PNG、WEBP 或 PDF')

    filename = getattr(uploaded_file, 'name', '') or 'upload'
    model = model or getattr(settings, 'OCR_MODEL', 'gpt-6-luna')
    timeout = float(getattr(settings, 'OCR_TIMEOUT_SECONDS', 90))

    client = OpenAI(api_key=api_key, timeout=timeout)

    try:
        response = client.responses.create(
            model=model,
            instructions=instructions,
            input=[{
                'role': 'user',
                'content': [
                    {'type': 'input_text', 'text': prompt},
                    _build_file_part(blob, media_type, filename),
                ],
            }],
            text={
                'format': {
                    'type': 'json_schema',
                    'name': schema_name,
                    'schema': schema,
                    'strict': True,
                }
            },
            max_output_tokens=max_output_tokens,
        )
    except Exception as exc:
        # The message can carry the key or the whole base64 payload, so it is
        # logged and not returned to the browser.
        logger.exception('OCR request to OpenAI failed (model=%s, type=%s)', model, media_type)
        raise OCRExtractionError('辨識服務暫時無法使用，請稍後再試') from exc

    text = _output_text(response)
    if not text:
        # Usually means the model hit max_output_tokens mid-object.
        logger.error('OCR response had no text output (model=%s, status=%s)',
                     model, getattr(response, 'status', None))
        raise OCRExtractionError('辨識結果為空，請換一張更清楚的圖片再試')

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error('OCR response was not valid JSON (model=%s): %.500s', model, text)
        raise OCRExtractionError('辨識結果格式錯誤，請稍後再試') from exc


def _output_text(response) -> str:
    """
    Pull the assistant's text out of a Responses API result.

    ``response.output_text`` is the documented shortcut, but it is absent on
    older SDK builds and on some error-shaped responses, so the output list is
    walked as a fallback rather than letting an AttributeError surface as a 500.
    """
    text = getattr(response, 'output_text', None)
    if text:
        return text

    chunks = []
    for item in getattr(response, 'output', None) or []:
        for part in getattr(item, 'content', None) or []:
            value = getattr(part, 'text', None)
            if isinstance(value, str):
                chunks.append(value)
    return ''.join(chunks).strip()
