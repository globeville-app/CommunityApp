# The backend's server image for DigitalOcean App Platform (docs/GO_LIVE.md).
# Built from the repository root because the backend also reads
# shared/app_config.json (the app name) and the app's language files (the
# event category search hints).
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY shared/ shared/
COPY mobile/src/i18n/en.json mobile/src/i18n/es.json mobile/src/i18n/
COPY backend/ backend/

WORKDIR /app/backend
# The admin's CSS and JS, gathered once at build time (served by WhiteNoise).
RUN DJANGO_DEBUG=0 DJANGO_SECRET_KEY=build-only ALLOWED_HOSTS=build \
    python manage.py collectstatic --noinput

# App Platform sets PORT. Two workers is plenty at launch scale.
CMD ["sh", "-c", "gunicorn config.wsgi --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 60 --access-logfile -"]
