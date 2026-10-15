#!/bin/sh
# Runs inside the "backup" container (see docker-compose.yml). Once a day:
#   - dumps the database to /backups/db/db_<timestamp>.dump   (restore with pg_restore)
#   - copies any NEW uploaded files into /backups/uploads    (uploads never change once written)
#   - deletes database dumps older than BACKUP_KEEP_DAYS
# /backups is the ./backups folder on the server. Copy it somewhere off the machine regularly
# (an external drive, another computer, or cloud storage) — see README "Backups".
set -eu

mkdir -p /backups/db /backups/uploads

while true; do
  ts=$(date -u +%Y-%m-%d_%H%M)
  echo "[backup] $ts starting"

  if pg_dump --format=custom --file="/backups/db/db_$ts.dump.partial"; then
    mv "/backups/db/db_$ts.dump.partial" "/backups/db/db_$ts.dump"
    echo "[backup] database dump OK"
  else
    rm -f "/backups/db/db_$ts.dump.partial"
    echo "[backup] database dump FAILED"
  fi

  # -n: never overwrite; existing files are skipped, so this only copies new uploads.
  cp -a -n /data/uploads/. /backups/uploads/ && echo "[backup] uploads copied"

  find /backups/db -name 'db_*.dump' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete

  sleep 86400
done
