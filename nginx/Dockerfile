# Собирает мини-апп (Vite) и отдаёт статику + проксирует /api к backend'у из
# одного контейнера — единая точка входа на порт 80/443, без CORS.
# Контекст сборки — корень репозитория (см. docker-compose.yaml).

FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Собираем со встроенным VITE_API_URL=/api — фронтенд и API за одним nginx,
# путь относительный, доменное имя пилота на этапе сборки не нужно.
ENV VITE_API_URL=/api
ENV VITE_API_MODE=http
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html
COPY nginx.config /etc/nginx/conf.d/default.conf
