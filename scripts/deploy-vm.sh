#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

if docker compose version >/dev/null 2>&1; then
  compose() {
    docker compose "$@"
  }
elif command -v docker-compose >/dev/null 2>&1; then
  compose() {
    docker-compose "$@"
  }
else
  echo "Docker Compose is not installed. Install docker-compose-plugin or docker-compose." >&2
  exit 1
fi

echo "Updating repository..."
git pull --ff-only

echo "Building and starting containers..."
compose up -d --build --remove-orphans

echo "Removing unused Docker images..."
docker image prune -af

echo "Removing unused Docker build cache..."
docker builder prune -af

echo "Current containers:"
compose ps
