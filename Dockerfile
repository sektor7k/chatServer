# Bun tabanlı bir Docker image kullan
FROM oven/bun:1.0.3

# Çalışma dizini belirle
WORKDIR /app

# Tüm dosyaları konteynere kopyala
COPY . .

# Bağımlılıkları yükle
RUN bun install

# Ortam değişkeni olarak Render’ın verdiği PORT’u kullan
ENV PORT=3001

# API'yi başlat
CMD ["bun", "run", "start"]
