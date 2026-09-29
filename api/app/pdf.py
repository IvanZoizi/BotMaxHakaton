from __future__ import annotations

import hashlib
from pathlib import Path

from fpdf import FPDF

from .config import settings

DOCUMENT_TITLES = {
    "application": "Заявление о предоставлении отпуска",
    "order_t6": "Приказ о предоставлении отпуска (форма Т-6)",
    "schedule_t7": "График отпусков (форма Т-7)",
    "notice": "Уведомление о начале отпуска",
}

# Docker-образ api ставит fonts-dejavu-core (см. Dockerfile) — DejaVu содержит
# кириллицу и свободно распространяется. Вне контейнера (локальный dev без
# Docker) шрифт может отсутствовать — тогда используется латинский core-шрифт
# и кириллица в PDF не отрендерится корректно; сам документ и его sha256 при
# этом всё равно создаются.
_UNICODE_FONT_CANDIDATES = (
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/dejavu/DejaVuSans.ttf"),
    Path("/opt/homebrew/share/fonts/DejaVuSans.ttf"),
)


def _find_unicode_font() -> Path | None:
    for candidate in _UNICODE_FONT_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


def generate_document_pdf(document_id: str, kind: str, number: str, lines: list[str]) -> tuple[Path, str]:
    settings.files_dir.mkdir(parents=True, exist_ok=True)

    pdf = FPDF()
    pdf.add_page()

    font_path = _find_unicode_font()
    if font_path is not None:
        pdf.add_font("DejaVu", "", str(font_path))
        pdf.set_font("DejaVu", size=14)
    else:
        pdf.set_font("Helvetica", size=14)

    # new_x/new_y: fpdf2 по умолчанию оставляет курсор у правого края последней
    # строки (XPos.RIGHT), а не у левого поля — без этого следующий multi_cell
    # падает с "Not enough horizontal space to render a single character".
    pdf.multi_cell(0, 10, DOCUMENT_TITLES.get(kind, kind), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font_size(11)
    pdf.multi_cell(0, 8, f"No {number}", new_x="LMARGIN", new_y="NEXT")
    for line in lines:
        pdf.multi_cell(0, 8, line, new_x="LMARGIN", new_y="NEXT")

    path = settings.files_dir / f"{document_id}.pdf"
    pdf.output(str(path))
    sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    return path, sha256
