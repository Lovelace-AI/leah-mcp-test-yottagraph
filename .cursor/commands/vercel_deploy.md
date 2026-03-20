# Vercel Deploy

Deploy the current state of the project to Vercel via Git integration.

## Overview

This command helps the user deploy their code to Vercel. It handles committing changes, choosing production vs. preview (branch) deployment, pushing to the right branch, and confirming the deployment succeeded.

**Prerequisite:** The project must already be set up with Vercel (linked, env vars synced, etc.). If it hasn't been set up yet, redirect the user to `/vercel_setup`.

---

## Step 1: Verify Vercel is Set Up

Check that the project is linked to Vercel by checking whether `.vercel/project.json` exists (read the file or check the directory).

**If the file does not exist:** The project hasn't been set up yet. Tell the user:

> This project hasn't been connected to Vercel yet. Let's run the setup first.

Then stop and redirect them to run `/vercel_setup`.

Also verify there's at least one prior deployment:

```bash
npx vercel ls 2>&1
```

**If no deployments are listed:** Same as above — redirect to `/vercel_setup`.

**If deployments exist:** Continue.

---

## Step 2: Check for Uncommitted Changes

```bash
git status
```

**If the working tree is clean** (nothing to commit): Continue to Step 3.

**If there are uncommitted changes:** Show the user what's changed:

```bash
git status --short
```

Then ask:

```
AskQuestion({
  title: "Uncommitted Changes",
  questions: [
    {
      id: "commit-changes",
      prompt: "You have uncommitted changes. These need to be committed before deploying.\n\n[paste the git status output here]\n\nWould you like me to commit them now?",
      options: [
        { id: "commit", label: "Yes — commit all changes and continue" },
        { id: "review", label: "Let me review first — I'll commit manually" }
      ]
    }
  ]
})
```

If the user selects "commit": Follow the commit workflow in `git-support.mdc` (format, stage, commit). Do not proceed to Step 3 with a failed commit.

If the user selects "review": Stop and wait for them to come back after committing manually.

---

## Step 3: Choose Deployment Target

Determine the current branch and the main branch:

```bash
git branch --show-current
git remote show origin | grep 'HEAD branch'
```

Then ask the user where they want to deploy:

```
AskQuestion({
  title: "Deployment Target",
  questions: [
    {
      id: "deploy-target",
      prompt: "Where would you like to deploy?\n\nYou're currently on branch: [current-branch]",
      options: [
        { id: "production", label: "Production — deploy to main branch (live site)" },
        { id: "preview", label: "Preview — deploy to a branch (staging/test URL)" }
      ]
    }
  ]
})
```

Then follow the appropriate path below.

---

### Path A: Deploy to Production

The user wants to deploy to the main branch.

**If already on main:**

```bash
git push origin main 2>&1
```

**If the push is rejected:** Pull the latest changes first with `git pull --rebase origin main`, then try pushing again. If branch protection rules prevent direct pushes to main, the user will need to use the PR path instead.

**If on a feature branch:**

The user's changes need to get to main. Ask how:

```
AskQuestion({
  title: "Merge to Main",
  questions: [
    {
      id: "merge-strategy",
      prompt: "You're on branch [current-branch]. To deploy to production, your changes need to be on main.\n\nHow would you like to proceed?",
      options: [
        { id: "merge", label: "Merge [current-branch] into main and push" },
        { id: "pr", label: "Create a pull request instead (I'll merge it myself)" }
      ]
    }
  ]
})
```

If "merge":

```bash
git checkout main
git pull origin main
git merge [feature-branch] --no-edit
git push origin main
```

If the merge has conflicts, stop and tell the user:

> There are merge conflicts that need to be resolved manually. After resolving them, commit the merge and run this command again.

**If the push is rejected:** Pull the latest changes with `git pull --rebase origin main` and try pushing again. If branch protection rules prevent direct pushes to main, the user will need to use the PR path instead.

If "pr":

First push the branch if needed:

```bash
git push -u origin [feature-branch]
```

Then create a PR:

```bash
gh pr create --title "Deploy [feature-branch] to production" --body "$(cat <<'EOF'
[Summarize the actual changes — see below]
EOF
)"
```

Before creating the PR, analyze the commits on the branch (using `git log main..[branch] --oneline`) and draft a meaningful PR description summarizing the changes, rather than using a generic message.

Return the PR URL and tell the user:

> Pull request created: [PR URL]
>
> Merge it on GitHub to trigger a production deployment. Vercel will auto-deploy when the merge lands on main.

Then stop — the deployment will happen automatically when they merge.

---

### Path B: Deploy to Preview (Branch)

The user wants a preview deployment on a branch.

**If already on a feature branch:**

Push the current branch:

```bash
git push -u origin [current-branch] 2>&1
```

**If the push is rejected:** Pull the latest changes with `git pull --rebase origin [current-branch]` and try pushing again. If there are rebase conflicts, stop and let the user resolve them.

**If on main:**

The user needs a branch. Ask for a name:

```
AskQuestion({
  title: "Branch Name",
  questions: [
    {
      id: "branch-name",
      prompt: "You're on main. To create a preview deployment, we need a branch.\n\nWhat would you like to call it? (e.g., 'dev', 'staging', 'leah/feature-x')",
      options: [
        { id: "dev", label: "dev" },
        { id: "staging", label: "staging" },
        { id: "custom", label: "I'll type a custom branch name" }
      ]
    }
  ]
})
```

If the user picks "custom", ask them to provide the branch name.

Create and push the branch:

```bash
git checkout -b [branch-name]
git push -u origin [branch-name] 2>&1
```

---

## Step 4: Confirm Deployment

After pushing, Vercel's Git integration will automatically start a build. Monitor it:

```bash
sleep 5
npx vercel ls 2>&1
```

Look for the latest deployment matching the push. It may show status as `● Building` initially.

If the deployment is building, wait and poll:

```bash
sleep 15
npx vercel ls 2>&1
```

Keep polling (with increasing intervals: 15s, 30s, 30s) until the status changes to `● Ready` or shows an error. If the build hasn't completed after ~5 minutes of polling, provide the Vercel dashboard link and suggest the user check the build logs there.

**If status is `● Ready`:**

Get the deployment URL from the output. Then verify static assets are served correctly:

```bash
curl -sI "https://<deployment-url>/_nuxt/<any-chunk>.js" | head -5
```

Confirm `content-type: application/javascript`.

Present the result to the user:

> Deployment successful!
>
> **URL:** [deployment URL]
> **Environment:** [Production / Preview]
> **Branch:** [branch name]
>
> [If production and custom domain exists]: Also available at: [custom domain URL]

**If the build failed:**

Check the logs:

```bash
npx vercel logs <deployment-url> 2>&1 | tail -30
```

Common failures:

- **E401 npm install:** `NPM_TOKEN` not set for this environment. See `/vercel_setup` Step 1 (NPM Authentication).
- **Build error:** Show the user the relevant log lines and help them debug.
- **Missing env vars:** Env vars may not be set for the preview environment. See `/vercel_setup` Step 5 (Sync Environment Variables).
