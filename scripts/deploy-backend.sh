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

  echo "==> Killing Puma master so launchd respawns with fresh env..."
  # Use Puma's pidfile (specific to this app — won't touch other Pumas
  # on the box, won't touch Postgres). \`bin/rails restart\` is a phased
  # restart that keeps the master alive, so application.yml or
  # initializer changes don't get picked up. Killing the master and
  # letting launchd's KeepAlive respawn it is the only reliable way to
  # fully reload the process environment.
  PID_FILE="tmp/pids/server.pid"
  if [ -f "\$PID_FILE" ]; then
    PUMA_PID=\$(cat "\$PID_FILE")
    echo "    Master PID: \$PUMA_PID"
    kill "\$PUMA_PID" 2>/dev/null || echo "    (process already gone)"
    sleep 3
    if [ -f "\$PID_FILE" ]; then
      NEW_PID=\$(cat "\$PID_FILE")
      if [ "\$NEW_PID" != "\$PUMA_PID" ]; then
        echo "    Puma respawned, new master PID: \$NEW_PID"
      else
        echo "    WARNING: PID file unchanged — launchd may not have respawned. Check logs."
      fi
    fi
  else
    echo "    WARNING: no \$PID_FILE found. Falling back to bin/rails restart (phased)."
    bin/rails restart
  fi

  echo "==> Deploy complete!"
EOF
