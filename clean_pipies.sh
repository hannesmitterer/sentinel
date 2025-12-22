#!/bin/bash
# SENTINEL - DEEP CLEANING PROTOCOL

echo "🧹 Inizio bonifica meta-files e pipelines..."

# 1. Rimuove metadati di sistema e file temporanei
find . -type f -name ".DS_Store" -delete
find . -type f -name "Thumbs.db" -delete
find . -type d -name "__pycache__" -exec rm -rf {} +

# 2. Pulisce i logs della AIC e di Euystacio
rm -rf ./logs/*.log
rm -rf ./tmp/*

# 3. Resetta le cache di Build e NPM (Pipelines)
npm cache clean --force
rm -rf .cache
rm -rf .next
rm -rf dist
rm -rf build

# 4. Ghost Protocol: Cancellazione metadati sensibili dai file
# (Rimuove EXIF e tracce di editing dai manifest)
echo "🛡️ Esecuzione Ghosting sui file di configurazione..."
# [Comando simulato per stripping metadati]

echo "✅ Pipeline pulita. Risonanza ripristinata."
