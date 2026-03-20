# Vercel Setup

Set up and sync this Aether project with Vercel for web deployment.

## Overview

This command walks through connecting an Aether project to Vercel and syncing environment variables. It assumes the user has already created a GitHub repository from the Aether template and wants to deploy it to Vercel.

The Vercel connection itself (linking the GitHub repo to a Vercel project) must be done by the user through the Vercel dashboard. Once connected, this command handles everything else via the Vercel CLI.

---

## Step 1: Check NPM Authentication for Private Packages

This project depends on private `@lovelace-ai` packages from GitHub Packages. Both local installs and Vercel builds need a valid token. Setting this up first avoids build failures later.

### Check `.npmrc`

Read `.npmrc` in the project root. It should contain:

```
@lovelace-ai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

**If `.npmrc` is missing:** Create it with the content above.

**If `.npmrc` has a hardcoded token** (a literal value like `_authToken=ghp_xxxx` instead of `${NPM_TOKEN}`): This shouldn't normally happen since `.npmrc` is committed to git with `${NPM_TOKEN}`. Stop and tell the user:

> Your `.npmrc` has a hardcoded token instead of `${NPM_TOKEN}`. Please move the token value to your `NPM_TOKEN` environment variable, then replace the hardcoded value in `.npmrc` with `${NPM_TOKEN}`.

Wait for the user to confirm before continuing.

**If `.npmrc` already uses `${NPM_TOKEN}`:** Good, continue.

### Ensure `NPM_TOKEN` is a valid PAT

```bash
echo $NPM_TOKEN
```

Check the token prefix:

- `ghp_` — Classic PAT. Good, skip to **"Ensure `.npmrc` is committed"**.
- `github_pat_` — Fine-grained PAT. Good, skip to **"Ensure `.npmrc` is committed"**.
- `gho_` — **This is an OAuth token, NOT a PAT.** OAuth tokens are tied to a specific device/session and will fail on Vercel's build servers. Tell the user their current token value so they can save it if needed:

    > Your current `NPM_TOKEN` is an OAuth token (`gho_...`), which won't work on Vercel. Here's the value in case you want to save it: `<the full gho_ token>`
    >
    > We need to replace it with a classic PAT (`ghp_`).

    Check `~/.npmrc` — it may contain a `ghp_` classic PAT that can be reused. If found, use it as the new `NPM_TOKEN` and persist it (see below). If not, the user needs to create one — use the AskQuestion below.

- **Empty** — The user needs a GitHub Personal Access Token. Check `~/.npmrc` for a usable `ghp_` token first. If found, use it and persist it (see below). If not, use the AskQuestion below.

```
AskQuestion({
  title: "GitHub Token Required for Private Packages",
  questions: [
    {
      id: "npm-token",
      prompt: "This project needs a GitHub Personal Access Token (PAT) to install private @lovelace-ai packages.\n\nNote: OAuth tokens (gho_) won't work on Vercel — you need a classic PAT (ghp_).\n\nDo you already have one, or do you need to create one?",
      options: [
        { id: "have-token", label: "I have a classic PAT — I'll set it as NPM_TOKEN" },
        { id: "need-token", label: "I need to create one" }
      ]
    }
  ]
})
```

If the user selects "need-token", guide them:

> To create a GitHub token for npm packages:
>
> 1. Go to https://github.com/settings/tokens
> 2. Click **Generate new token** > **Generate new token (classic)**
> 3. Give it a name like "Aether npm packages"
> 4. Select the **read:packages** scope (that's all you need)
> 5. Click **Generate token**
> 6. Copy the token — you won't see it again

### Persist `NPM_TOKEN` to the shell profile

Once you have a valid PAT (from `~/.npmrc` or from the user), persist it. Detect the user's shell:

```bash
echo $SHELL
```

| `$SHELL`    | Profile file |
| ----------- | ------------ |
| `/bin/zsh`  | `~/.zshrc`   |
| `/bin/bash` | `~/.bashrc`  |

If the user's shell is something else (fish, etc.), tell them to set `NPM_TOKEN` as a persistent environment variable themselves and move on.

For **zsh** or **bash**, add or update the export (replacing `<shell_rc>` with the profile filename from the table):

```bash
sed -i.bak '/^export NPM_TOKEN=/d' ~/.<shell_rc> && rm -f ~/.<shell_rc>.bak
echo 'export NPM_TOKEN=<the_token>' >> ~/.<shell_rc>
source ~/.<shell_rc>
```

Verify it took effect:

```bash
echo $NPM_TOKEN
```

### Ensure `.npmrc` is committed

Check that `.npmrc` is NOT in `.gitignore`. Since it uses `${NPM_TOKEN}` (not a hardcoded secret), it's safe to commit and must be present in the repo for Vercel builds to work.

If `.npmrc` appears in `.gitignore`, remove that line and replace it with a comment:

```
# .npmrc is committed — it uses ${NPM_TOKEN} env var, not a hardcoded token
```

---

## Step 2: Check Vercel CLI & Authentication

The `vercel` package is included as a devDependency, so it should already be available after `npm install` / `npm run init`. Use `npx vercel` to invoke it.

Verify it's available and the user is authenticated:

```bash
npx vercel whoami
```

**If the command succeeds** (prints a username): Continue to Step 3.

**If the command fails:** Run the login command in the background so you can read its output:

```bash
npx vercel login
```

Run this as a background command (set `block_until_ms: 0`) so you can read its output while it waits. Then read the terminal output to find the one-time device code. The CLI will print a line like:

```
> Please visit the following URL to log in: https://vercel.com/device
> Enter code: XXXX-XXXX
```

**IMPORTANT:** Extract the code from the terminal output and present it to the user in chat, along with the URL. For example:

> Vercel needs you to authorize this device. Please:
>
> 1. Open **https://vercel.com/device** in your browser (it may have opened automatically)
> 2. Enter code: **XXXX-XXXX**
> 3. Verify the location, IP, and request time, then approve
>
> Let me know once you've approved it.

If the code is not immediately visible in the terminal output, wait a couple of seconds and re-read the terminal file — the CLI may take a moment to contact Vercel's servers.

After the user confirms they've approved, poll the terminal output until the login command completes. Then verify:

```bash
npx vercel whoami
```

**Stop here if authentication fails.** The user may need to:

- Check that their browser opened and they completed the authorization
- Ensure they have a Vercel account (sign up at https://vercel.com/signup)
- Try running `npx vercel login` again

---

## Step 3: Select the Correct Vercel Team

The project should be deployed under the shared **Lovelace** team, not a personal account. Check and switch to the correct team:

```bash
npx vercel teams ls
```

Look for `lovelace-web` (team name: Lovelace) in the list. If the checkmark (✔) is not on `lovelace-web`, switch to it:

```bash
npx vercel teams switch lovelace-web
```

**If `lovelace-web` is not listed:** The user needs to be invited to the Lovelace team on Vercel. They should ask a team admin to add them at https://vercel.com/lovelace-web/settings/members.

**Stop here if they can't access the team.** All subsequent steps assume the Lovelace team scope.

---

## Step 4: Check Vercel Project Link

Check if the project is already linked to Vercel by checking whether `.vercel/project.json` exists (read the file or check the directory).

**If the file exists:** Read it and confirm the project link. Continue to Step 5.

**If the file does not exist:** The project is not linked to Vercel yet. Tell the user:

> Your project needs to be connected to Vercel before we can continue.
>
> Please complete these steps:
>
> 1. Go to [vercel.com/new](https://vercel.com/new)
> 2. Click 'Import Git Repository'
> 3. Select your GitHub repository (the one created from the Aether template)
> 4. In the 'Configure Project' screen:
>     - Framework Preset should auto-detect as 'Nuxt.js'
>     - Leave Build Command as default
>     - Leave Output Directory as default
> 5. Click 'Deploy'
>     - The first deploy may fail (missing env vars) — that's OK, we'll fix it next
>
> Once the project is imported, come back here.

Use the AskQuestion tool:

```
AskQuestion({
  title: "Vercel Project Connection Required",
  questions: [
    {
      id: "vercel-connected",
      prompt: "Can you confirm that you imported the git repository to Vercel?",
      options: [
        { id: "done", label: "Done — I've imported the project to Vercel" },
        { id: "help", label: "I need help with this step" }
      ]
    }
  ]
})
```

If the user selects "help", provide additional guidance:

- They need a Vercel account at https://vercel.com/signup (free tier works fine)
- They need to install the Vercel GitHub App when prompted during import
- The repository must be the one they created from the Aether template, not the original template repo
- If the repository is in their personal github account, they should be able to import it. However, if it is the team github account, or someone else's github account, they will probably need additional permissions.

After the user confirms they've imported the project, link the local project:

```bash
npx vercel link --yes
```

This creates the `.vercel/project.json` file that connects the local directory to the Vercel project. If it prompts to select a project, choose the one that matches the repository name.

**Note:** `vercel link` automatically appends `.vercel` to `.gitignore`, even if `.vercel/` is already listed. Check `.gitignore` after linking and remove the duplicate entry if one was added.

Verify the link succeeded by confirming `.vercel/project.json` now exists.

**Stop here if linking fails.** The user may need to re-run `npx vercel link` and select the correct project.

---

## Step 5: Sync Environment Variables to Vercel

Now that Vercel is authenticated and the project is linked, sync all required environment variables — starting with `NPM_TOKEN`, then the rest from `.env`.

### Add `NPM_TOKEN` to Vercel

Step 1 ensured `NPM_TOKEN` is valid locally. Now push it to Vercel so builds can use it too.

**IMPORTANT:** Add `NPM_TOKEN` to BOTH the `production` AND `preview` environments. Production deploys come from the main branch; preview deploys come from all other branches. If you only set it for production, branch deploys will fail with E401 during `npm install`.

Check if it already exists on Vercel:

```bash
npx vercel env ls production
npx vercel env ls preview
```

Add it to both environments:

```bash
printf '%s' "$NPM_TOKEN" | npx vercel env add NPM_TOKEN production --force
printf '%s' "$NPM_TOKEN" | npx vercel env add NPM_TOKEN preview --force
```

This uses the local `NPM_TOKEN` value directly. Verify it was added to both:

```bash
npx vercel env ls production
npx vercel env ls preview
```

### Sync `.env` variables

With `NPM_TOKEN` on Vercel, sync the remaining app-level configuration from `.env`.

Read the local `.env` file and parse all non-commented, non-empty lines into KEY=VALUE pairs.

**Variables to sync:** All variables defined in `.env` that are NOT commented out. This typically includes:

- `NUXT_PUBLIC_APP_ID`
- `NUXT_PUBLIC_APP_NAME`
- `NUXT_PUBLIC_QUERY_SERVER_ADDRESS`
- `NUXT_PUBLIC_AUTH0_CLIENT_ID`
- `NUXT_PUBLIC_AUTH0_CLIENT_SECRET`
- `NUXT_PUBLIC_USER_NAME`

**Variables to skip:** Do NOT sync these to Vercel:

- Commented-out lines (starting with `#`)
- Variables with empty values (e.g., `NUXT_PUBLIC_USER_NAME=`, `NUXT_PUBLIC_QUERY_SERVER_ADDRESS=`)
    > **Why skip empty values?** Nuxt's runtime config defaults them to empty strings already.
    > The Vercel CLI cannot store truly empty values — it either prompts interactively or
    > requires a non-empty string. Using a space or placeholder causes bugs. For example,
    > a space in `NUXT_PUBLIC_USER_NAME` bypasses Auth0 login entirely.

### Sync Process

**IMPORTANT:** Sync env vars to BOTH `production` and `preview` environments. Production is used for main branch deploys; preview is used for all other branch deploys. Missing env vars in preview will cause branch builds to fail or the app to misbehave.

For each variable to sync, push it to Vercel for **both** environments. Use the following pattern to avoid interactive prompts:

```bash
printf '%s' "VALUE" | npx vercel env add VAR_NAME production --force
printf '%s' "VALUE" | npx vercel env add VAR_NAME preview --force
```

**IMPORTANT:** Use `printf '%s'` — NOT `echo`. `echo` appends a trailing newline to the value, which gets stored as part of the env var and causes runtime bugs (e.g., Auth0 rejecting a client ID with `\n` appended).

**Note on `--force`:** This flag overwrites existing values without prompting. This is safe for syncing because we want local values to be the source of truth.

If a variable has a value with spaces or special characters (like `NUXT_PUBLIC_APP_NAME`), the printf/pipe approach handles this correctly.

**IMPORTANT:** Strip surrounding quotes from `.env` values before piping. If `.env` has `NUXT_PUBLIC_APP_NAME="Aether Vercel Demo"`, pipe `Aether Vercel Demo` (without the `"` characters). Vercel stores the value literally — quotes included.

### Sensitive Variables Warning

Before syncing, warn the user about sensitive values:

> **Heads up:** The following sensitive values will be synced to Vercel:
>
> - `NUXT_PUBLIC_AUTH0_CLIENT_SECRET` — Note: this is in `NUXT_PUBLIC_` which means it's exposed to the browser. Consider moving it to a server-only config in the future.
>
> Vercel encrypts environment variables at rest and in transit.

### After Syncing

Confirm the sync by listing the variables:

```bash
npx vercel env ls production
```

Display the list to the user so they can verify.

---

## Step 6: Trigger a Production Deployment

After environment variables are synced, the existing deployment (if any) won't have them yet. Trigger a new production build:

```bash
npx vercel --prod --yes
```

This builds and deploys the app using the CLI. Alternatively, if the user prefers to use Git integration for deploys:

> Your environment variables are synced. To trigger a deploy with the new variables, you can either:
>
> 1. Push a commit to your `main` branch (Vercel will auto-deploy via Git integration)
> 2. Go to the Vercel dashboard and click "Redeploy" on the latest deployment

**If the deploy fails:** Check `npx vercel logs <deployment-url>` and refer to the Troubleshooting section. The most common cause is missing environment variables — re-run Step 5 if needed.

---

## Step 7: Configure Custom Domain

After the first successful deploy, add a custom domain under `.yottagraph.app`.

First, determine the subdomain. Read the repository name from the git remote to use as a suggested default, then ask the user:

```bash
git remote get-url origin
```

Extract the repo name (e.g., `aether_vercel_demo` from the URL), convert underscores to hyphens for a cleaner subdomain (e.g., `aether-vercel-demo`), and present it as a suggestion.

Use the AskQuestion tool with a text-like prompt:

```
AskQuestion({
  title: "Custom Domain",
  questions: [
    {
      id: "subdomain",
      prompt: "Choose a subdomain for your app.\n\nYour app will be available at: <subdomain>.yottagraph.app\n\nSuggested based on your repo name: [suggested-name]",
      options: [
        { id: "suggested", label: "[suggested-name]" },
        { id: "other", label: "Other" }
      ]
    }
  ]
})
```

If the user selects "other", ask them to type just the subdomain they'd like (not the full domain). Confirm the full URL (`<their-choice>.yottagraph.app`) before proceeding. Always append `.yottagraph.app` to whatever the user provides.

Check what domains are already configured:

```bash
npx vercel domains ls 2>&1
```

Add the custom domain:

```bash
npx vercel domains add <subdomain>.yottagraph.app
```

**If the domain add succeeds:** Vercel will automatically provision a TLS certificate. The domain should be active within a few minutes.

**If it prompts for DNS configuration:** The `.yottagraph.app` domain must have a wildcard CNAME or individual CNAME record pointing to `cname.vercel-dns.com`. If DNS is already configured for `*.yottagraph.app`, new subdomains should work automatically.

**If it fails with a permission error:** The user may need to verify domain ownership. Domain verification is typically done once per team — if another project in the Lovelace team already uses `.yottagraph.app`, new subdomains should be automatically trusted.

After adding, verify the domain is assigned:

```bash
npx vercel domains ls 2>&1
```

---

## Step 8: Verify Deployment

After the deploy completes, Vercel will output a production URL (e.g., `https://project-name.vercel.app`). **Do not show this URL to the user.** Always use the custom domain chosen in Step 7 (`<subdomain>.yottagraph.app`) when referring to the deployment.

### Verify static assets are served correctly

Before opening the app, confirm that `_nuxt/` static files are being served with the correct MIME type. Use the custom domain for verification:

```bash
curl -sI "https://<subdomain>.yottagraph.app/_nuxt/<any-chunk>.js"
```

Look for `content-type: application/javascript`. If it returns `text/html` instead, the static file routing is broken — the Nuxt serverless function is catching `_nuxt/` requests and serving the SPA template. This usually means `nitro.output.publicDir` is overriding the Vercel preset's output paths. See the troubleshooting section below.

### Verify the app loads

Open `https://<subdomain>.yottagraph.app` and check:

1. The app loads (not a blank page or build error)
2. The navigation sidebar appears
3. If Auth0 is configured, the login flow works

**If the app shows a blank page:**

- First check the static asset verification above — a MIME type mismatch is the most common cause
- Check the Vercel build logs: `npx vercel logs <deployment-url>`
- Common issue: missing environment variables or build errors

**If Auth0 login fails:**
Instruct the user:

> Your custom domain needs to be registered as an allowed callback in Auth0.
>
> 1. Go to https://manage.auth0.com/
> 2. Navigate to Applications > Your Application > Settings
> 3. Add your custom domain to these fields:
>     - **Allowed Callback URLs:** `https://<subdomain>.yottagraph.app/api/auth/callback`
>     - **Allowed Logout URLs:** `https://<subdomain>.yottagraph.app`
>     - **Allowed Web Origins:** `https://<subdomain>.yottagraph.app`
> 4. Save changes

---

## Step 9: Summary

After completing all steps, provide the user with a summary:

```
Vercel Setup Complete!

  Project:    [project name from .vercel/project.json]
  URL:        https://[subdomain].yottagraph.app
  Dashboard:  https://vercel.com/[org]/[project]

Environment variables synced:
  - NPM_TOKEN
  - NUXT_PUBLIC_APP_ID
  - NUXT_PUBLIC_APP_NAME
  - [... list all synced vars]

Next steps:
  - Push code changes to main branch — Vercel will auto-deploy
  - If using Auth0: add your custom domain as an allowed callback (see the Verify Deployment step)
```

---

## Troubleshooting

### `vercel link` fails or selects the wrong project

Run `npx vercel link` again interactively (without `--yes`) and manually select the correct project from the list.

### Environment variable sync fails

If `npx vercel env add` fails with a permission error, the user may need to verify they have the correct Vercel team/scope selected:

```bash
npx vercel whoami
npx vercel teams ls
npx vercel link --yes
```

### Build fails on Vercel

Check build logs:

```bash
npx vercel logs <deployment-url>
```

Common causes:

- **Missing npm packages (E401 Unauthorized):** Private `@lovelace-ai` packages need `NPM_TOKEN` configured. See Step 1 — ensure `.npmrc` uses `${NPM_TOKEN}`, the token is set as a Vercel env var, and `.npmrc` is committed (not gitignored).
- **Orval/API spec errors:** If the build fails during `prebuild` (orval code generation), ensure the API spec file exists or remove the orval dependency if unused.
- **Memory issues:** The build command includes `--max-old-space-size=8192`. Vercel's free tier may have lower limits. Try removing this from the build command in `package.json` if builds OOM.
