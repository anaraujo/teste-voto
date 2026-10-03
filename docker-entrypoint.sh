#!/bin/sh
# Copia os dados do bucket GCS montado em /mnt/tse-data para o disco local.
# SQLite exige semântica de lock/mmap que o FUSE não garante; a cópia de
# ~10 MB leva < 2 s e isola o cold start do FUSE.
set -eu

: "${DATA_DIR:=/app/data}"
mkdir -p "$DATA_DIR"

if [ ! -f /mnt/tse-data/tse.db ]; then
  echo "[entrypoint] /mnt/tse-data/tse.db ausente — publice dados com npm run publish:data" >&2
  exit 1
fi

cp /mnt/tse-data/tse.db "$DATA_DIR/tse.db"
if [ -d /mnt/tse-data/photos ]; then
  rm -rf "$DATA_DIR/photos"
  cp -r /mnt/tse-data/photos "$DATA_DIR/photos"
else
  mkdir -p "$DATA_DIR/photos"
fi
if [ -f /mnt/tse-data/manifest.json ]; then
  cp /mnt/tse-data/manifest.json "$DATA_DIR/manifest.json"
fi

exec node --experimental-sqlite --experimental-strip-types server/index.ts
