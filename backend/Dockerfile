# Python'un hafif versiyonunu kullan
FROM python:3.11-slim

# Çalışma dizinini ayarla
WORKDIR /app

# Önce bağımlılıkları kopyala ve yükle
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Tüm backend dosyalarını kopyala
COPY . .

# FastAPI'yi 8000 portunda başlat
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]