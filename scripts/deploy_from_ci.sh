#!/bin/bash

set -euo pipefail

PROJECT_DIR="/opt/cloud-blog"
DEPLOY_DIR="${PROJECT_DIR}/deploy"
LOG_DIR="${PROJECT_DIR}/logs/deploy"
LOG_FILE="${LOG_DIR}/deploy.log"

mkdir -p "${LOG_DIR}"

log() {
  echo "[$(date '+%F %T')] $*" | tee -a "${LOG_FILE}"
}

log "开始 CI/CD 自动部署"

cd "${PROJECT_DIR}"

log "拉取 GitHub 最新代码"
git fetch origin main
git reset --hard origin/main

cd "${DEPLOY_DIR}"

log "校验 Docker Compose 配置"
sudo docker compose -f compose.yaml -f compose.override.yaml config --quiet

log "登录状态检查与镜像拉取"
sudo docker compose -f compose.yaml -f compose.override.yaml pull api web

log "重建 API 和 Web 容器"
sudo docker compose -f compose.yaml -f compose.override.yaml up -d --force-recreate api web

log "等待服务启动"
sleep 10

log "检查容器状态"
sudo docker compose -f compose.yaml -f compose.override.yaml ps | tee -a "${LOG_FILE}"

log "健康检查：API version"
API_VERSION="$(curl -fsS http://127.0.0.1/api/version)"
echo "${API_VERSION}" | tee -a "${LOG_FILE}"

log "健康检查：API metrics"
curl -fsS http://127.0.0.1/api/metrics >/dev/null

log "健康检查：首页"
curl -fsSI http://127.0.0.1 >/dev/null

log "CI/CD 自动部署完成"
