# Use Microsoft's official Playwright image — has Chromium + all browser deps pre-installed
FROM mcr.microsoft.com/playwright/python:v1.49.1-jammy

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8100
EXPOSE 8100

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
