#!/bin/bash
set -e

echo "==> Pulling latest code..."
git pull origin main

echo "==> Installing gems..."
cd backend
bundle install --without development test

echo "==> Running migrations..."
RAILS_ENV=production bin/rails db:migrate

echo "==> Restarting server..."
bin/rails restart

echo "==> Deploy complete!"
