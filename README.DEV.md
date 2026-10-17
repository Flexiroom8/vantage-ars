# Vantage-ARS — developer notes

This branch implements a founder-only forgot-password flow, hardens Better Auth hooks for the founder setup and reset endpoints, and restores the office login component.

Quick local run (developer):

```bash
git fetch origin
git checkout fix/founder-forgot-password-and-auth-flow
npm ci
cp .env.example .env
# Set at least FOUNDER_SETUP_TOKEN (16+ chars) and (optionally) FOUNDER_EMAIL
npm run validate   # typecheck + lint + tests
npm run dev
```

Founder flows:
- First-time setup: /office → "First-time founder setup" (requires FOUNDER_SETUP_TOKEN)
- Forgot password (founder): /forgot-password (accepts only configured founder email)
- Reset password: /reset-password?token=... (token supplied by reset email)

If you want me to open a PR with these changes so CI can run, create a PR from this branch to main or tell me and I will prepare a PR body for you to paste into the GitHub UI.
