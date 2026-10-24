#!/usr/bin/env bash
# One-command autonomy setup for Vantage-ARS.
#
# Generates the two secrets a self-running office needs (BETTER_AUTH_SECRET and
# CRON_SECRET), writes .env from .env.example if there is none, makes sure
# AUTONOMY=on, and prints the remaining manual steps.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.example ]; then
  echo "Run this from inside the vantage-ars repository." >&2
  exit 1
fi

command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 1; }

if [ -f .env ]; then
  echo ".env already exists — leaving it alone. Add these two if missing:"
else
  cp .env.example .env
  echo "Created .env from .env.example."
fi

add_secret() {
  # $1 = variable name, $2 = generated value
  if grep -qE "^$1=..*" .env; then
    echo "  $1 is already set — kept."
  elif grep -qE "^$1=" .env; then
    sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak
    echo "  $1 generated."
  else
    printf '%s=%s\n' "$1" "$2" >> .env
    echo "  $1 appended."
  fi
}

echo
echo "Secrets:"
add_secret BETTER_AUTH_SECRET "$(openssl rand -base64 32 | tr -d '\n')"
add_secret CRON_SECRET "$(openssl rand -hex 32)"

# AUTONOMY=on is the default in .env.example; enforce it here regardless.
sed -i.bak 's|^AUTONOMY=.*|AUTONOMY=on|' .env && rm -f .env.bak

cat <<'EOF'

Done. The remaining steps stay yours by design:

1. GitHub Actions scheduler (drives the ten-minute tick on Vercel deploys):
   GitHub → Settings → Secrets and variables → Actions → New repository secret
   Name: CRON_SECRET   Value: the CRON_SECRET line in .env

2. Set your public URL in .env: BETTER_AUTH_URL
   (default https://www.vantage-ars.co.za). Deploy.

3. Founder setup (once): open /office, create the founder account with
   FOUNDER_SETUP_TOKEN, then REMOVE that token and redeploy — sign-up closes
   once a founder exists.

4. The last autonomy switch is in the app, not in git: open
   /office/delegations and save a standing delegation preset. With no
   delegation the office stops at the founder gate for every cost, every
   customer win and loss, and every marketing-to-sales handoff.

5. Run it:
   Docker:      docker compose up -d --build   (the scheduler sidecar ticks the
                floor every ten minutes — no GitHub cron needed)
   Plain Node:  npm ci && npm run build && npm start
                plus deploy/systemd/ (service + ten-minute timer)
EOF
