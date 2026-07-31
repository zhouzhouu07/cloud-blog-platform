#!/bin/bash

set -euo pipefail

BACKUP_DIR="/opt/cloud-blog/backup/mysql"

LATEST_BACKUP="$(ls -1t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -n 1 || true)"

if [ -z "${LATEST_BACKUP}" ]; then
  echo "未找到数据库备份文件"
  exit 1
fi

echo "最新备份文件：${LATEST_BACKUP}"

gzip -t "${LATEST_BACKUP}"

echo "压缩文件校验：通过"

echo "备份文件大小：$(du -h "${LATEST_BACKUP}" | awk '{print $1}')"

echo "备份文件时间：$(stat -c '%y' "${LATEST_BACKUP}")"

echo "备份文件列表："
ls -lh "${BACKUP_DIR}"/*.sql.gz
