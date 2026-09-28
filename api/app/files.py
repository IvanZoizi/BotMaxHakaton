from __future__ import annotations

import hashlib
import hmac
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from .config import settings

router = APIRouter(tags=["Files"])


def _sign(document_id: str, expires_at: int) -> str:
    message = f"{document_id}:{expires_at}".encode("utf-8")
    return hmac.new(settings.file_signing_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def build_pdf_url(base_url: str, document_id: str) -> str:
    """Временная подписанная ссылка на PDF (`DocumentDetail.pdfUrl`, контракт §4).

    Внутри контейнера маршрут смонтирован как `/files/{id}` (без префикса) —
    так его и вызывает nginx после `proxy_pass` с обрезкой `/api/` (nginx.config).
    Наружу же клиент видит API только под `/api` (openapi.yaml servers), и
    `request.base_url` этого префикса не знает — поэтому он приписывается здесь.
    """
    expires_at = int(time.time()) + settings.file_url_ttl_seconds
    token = _sign(document_id, expires_at)
    return f"{base_url}/api/files/{document_id}?expires={expires_at}&token={token}"


@router.get("/files/{document_id}")
def download_file(document_id: str, expires: int, token: str) -> FileResponse:
    if int(time.time()) > expires:
        raise HTTPException(status_code=410, detail="Ссылка устарела")
    if not hmac.compare_digest(_sign(document_id, expires), token):
        raise HTTPException(status_code=403, detail="Неверная подпись ссылки")
    path = settings.files_dir / f"{document_id}.pdf"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(path, media_type="application/pdf", filename=path.name)
