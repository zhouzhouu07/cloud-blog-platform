#!/bin/bash

set -euo pipefail

PROJECT_NAME="cloud-blog"
CONTAINER_NAME="cloud-blog-db"
BACKUP_DIR="/opt/cloud-blog/backup/mysql"
LOG_DIR="/opt/cloud-blog/logs/backup"
RETENTION_DAYS=7

DATE_TIME="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${PROJECT_NAME}_mysql_${DATE_TIME}.sql.gz"
LOG_FILE="${LOG_DIR}/mysql_backup.log"

mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"

log() {
  echo "[$(date '+%F %T')] $*" | tee -a "${LOG_FILE}"
}

log "开始备份 MariaDB 数据库..."

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  log "错误：数据库容器 ${CONTAINER_NAME} 未运行"
  exit 1
fi

docker exec "${CONTAINER_NAME}" sh -c '
  mariadb-dump \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --events \
    --add-drop-table \
    -u"$MARIADB_USER" \
    -p"$MARIADB_PASSWORD" \
    "$MARIADB_DATABASE"
' | gzip > "${BACKUP_FILE}"

if [ ! -s "${BACKUP_FILE}" ]; then
  log "错误：备份文件为空"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

gzip -t "${BACKUP_FILE}"

BACKUP_SIZE="$(du -h "${BACKUP_FILE}" | awk '{print $1}')"

log "备份成功：${BACKUP_FILE}"
log "备份大小：${BACKUP_SIZE}"

find "${BACKUP_DIR}" \
  -name "${PROJECT_NAME}_mysql_*.sql.gz" \
  -type f \
  -mtime +"${RETENTION_DAYS}" \
  -print \
  -delete | while read -r old_file; do
    log "清理过期备份：${old_file}"
  done

log "MariaDB 备份任务完成"
