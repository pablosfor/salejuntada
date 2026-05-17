#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

echo "Updating repository..."
git pull --ff-only

echo "Building and starting containers..."
docker compose up -d --build --remove-orphans

echo "Removing unused Docker images..."
docker image prune -af

echo "Removing unused Docker build cache..."
docker builder prune -af

echo "Current containers:"
docker compose ps
