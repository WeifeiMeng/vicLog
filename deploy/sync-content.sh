#!/usr/bin/env bash
set -Eeuo pipefail

repository="/opt/viclog"
lock_file="/var/lock/viclog-content-deploy.lock"

exec 9>"$lock_file"
if ! flock -n 9; then
  echo "Another Vic Log content deployment is already running." >&2
  exit 1
fi

git_as_viclog() {
  runuser -u viclog -- env \
    HOME=/opt/viclog \
    GIT_TERMINAL_PROMPT=0 \
    GIT_PAGER=cat \
    git -C "$repository" "$@"
}

if [[ -n "$(git_as_viclog status --porcelain --untracked-files=normal)" ]]; then
  echo "Refusing to deploy because /opt/viclog has uncommitted changes." >&2
  exit 1
fi

git_as_viclog fetch --prune origin main

if ! git_as_viclog rebase origin/main; then
  git_as_viclog rebase --abort || true
  echo "Content deployment stopped because the server branch conflicts with origin/main." >&2
  exit 1
fi

if ! curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3001/ >/dev/null; then
  echo "Content was synchronized, but the Vic Log health check failed." >&2
  exit 1
fi

echo "Vic Log content synchronized at $(git_as_viclog rev-parse --short HEAD)."
