FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=4100
WORKDIR /app

RUN addgroup --system harambeeone && adduser --system --ingroup harambeeone harambeeone
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir .

USER harambeeone
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4100/health/readiness',timeout=4)"
CMD ["sh", "-c", "python -m uvicorn harambeeone_api.main:app --host 0.0.0.0 --port ${PORT}"]
