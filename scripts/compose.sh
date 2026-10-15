#!/bin/sh
# Runs the local dev services with whichever Compose CLI is installed
# (Docker Compose plugin `docker compose` or standalone `docker-compose`).
set -eu
COMPOSE_FILE="$(dirname "$0")/../infra/docker-compose.yml"
if docker compose version >/dev/null 2>&1; then
  exec docker compose -f "$COMPOSE_FILE" "$@"
elif command -v docker-compose >/dev/null 2>&1; then
  exec docker-compose -f "$COMPOSE_FILE" "$@"
else
  echo "Docker Compose not found. Install the Docker Compose plugin or docker-compose." >&2
  exit 1
fi
