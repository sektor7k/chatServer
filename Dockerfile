# Bun tabanlı, 1.2.4 sürümünü kullanan Docker imajı
FROM oven/bun:1.2.4

# Çalışma dizinini ayarla
WORKDIR /app

# Tüm dosyaları konteynere kopyala
COPY . .

# Bağımlılıkları yükle
RUN bun install

# Container içindeki portu aç
EXPOSE 5001

# Uygulamayı başlat
CMD ["bun", "run", "start"]
