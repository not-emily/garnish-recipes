#!/bin/bash
set -e

REMOTE_HOST="farley_station"
REMOTE_DIR="~/.garnish"

echo "==> Deploying backend to $REMOTE_HOST..."

ssh "$REMOTE_HOST" bash -s <<EOF
  set -e
  export PATH="\$HOME/.rbenv/bin:\$PATH"
  eval "\$(rbenv init -)"
  cd $REMOTE_DIR

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
EOF
