FROM python:3.12-slim

# fonts-dejavu-core — кириллический TTF для генерации PDF (app/pdf.py), лицензия
# свободная для распространения.
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# --proxy-headers/--forwarded-allow-ips: без них uvicorn не доверяет
# X-Forwarded-Proto от nginx (nginx.config проксирует по plain HTTP внутри
# docker-сети) и строит на его основе ссылки (request.base_url — см.
# app/files.py build_pdf_url) со схемой http:// вместо https://, хотя
# сама страница открыта по HTTPS — браузер/MAX Bridge блокирует такой
# mixed-content запрос как небезопасный. '*' безопасен: api не публикует
# порт наружу (docker-compose.yaml), достучаться до него можно только
# через nginx внутри той же compose-сети.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
