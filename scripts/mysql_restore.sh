#!/bin/bash

set -euo pipefail

CONTAINER_NAME="cloud-blog-db"
LOG_DIR="/opt/cloud-blog/logs/backup"
LOG_FILE="${LOG_DIR}/mysql_restore.log"

mkdir -p "${LOG_DIR}"

log() {
  echo "[$(date '+%F %T')] $*" | tee -a "${LOG_FILE}"
}

if [ $# -ne 1 ]; then
  echo "用法：sudo /opt/cloud-blog/scripts/mysql_restore.sh /opt/cloud-blog/backup/mysql/xxx.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  log "错误：备份文件不存在：${BACKUP_FILE}"
  exit 1
fi

if [[ "${BACKUP_FILE}" != *.sql.gz ]]; then
  log "错误：只支持 .sql.gz 备份文件"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  log "错误：数据库容器 ${CONTAINER_NAME} 未运行"
  exit 1
fi

gzip -t "${BACKUP_FILE}"

echo "即将恢复数据库，当前数据库中的同名表会被覆盖。"
echo "备份文件：${BACKUP_FILE}"
read -r -p "确认恢复请输入 YES: " CONFIRM

if [ "${CONFIRM}" != "YES" ]; then
  log "用户取消恢复操作"
  exit 0
fi

log "开始恢复数据库：${BACKUP_FILE}"

gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" sh -c '
  mariadb \
    -u"$MARIADB_USER" \
    -p"$MARIADB_PASSWORD" \
    "$MARIADB_DATABASE"
'

log "数据库恢复完成"
