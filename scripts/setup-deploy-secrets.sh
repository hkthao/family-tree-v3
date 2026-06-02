#!/usr/bin/env bash
# Set every GitHub Actions secret the deploy.yml workflow expects.
#
# Usage:
#   1. Fill in .env.deploy (copy from .env.deploy.example).
#   2. Make sure you're authenticated:  gh auth status
#   3. Run:    ./scripts/setup-deploy-secrets.sh
#
# Secrets you supply (everything in .env.deploy) get pushed to the
# `actions` scope of the current repository — exactly what
# `gh secret set` does, just batched + with a smoke check.

set -euo pipefail

ENV_FILE="${1:-.env.deploy}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.deploy.example and fill it in." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) not installed. brew install gh — then gh auth login." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not authenticated. Run: gh auth login" >&2
  exit 1
fi

# `gh secret set -f` reads KEY=value lines from a dotenv-style file,
# strips quotes around values, and pushes each as a repository
# secret. Lines starting with # are ignored.
echo "Pushing secrets from $ENV_FILE …"
gh secret set -f "$ENV_FILE"

echo
echo "Done. Verifying secret names landed in the repo:"
gh secret list | awk '{print "  " $1}'

echo
echo "If anything's missing, edit $ENV_FILE and re-run this script."
