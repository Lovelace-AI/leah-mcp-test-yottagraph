# Update Instructions

Update Cursor rules, commands, and skills from the `@yottagraph-app/aether-instructions` npm package.

## Overview

This command downloads the latest instructions package and extracts it to your `.cursor/` directory. A manifest file (`.cursor/.aether-instructions-manifest`) tracks which files came from the package so updates only replace package-provided files.

**What happens:**

1. Downloads the latest `@yottagraph-app/aether-instructions` package
2. Deletes files listed in the existing manifest
3. Cleans up any legacy `aether_*` prefixed files from older versions
4. Extracts fresh files from the package
5. Writes a new manifest
6. Commits the changes

**Your files are safe:** Only files listed in the manifest are touched during updates. If you've created your own rules or commands, they won't be modified.

---

## Step 1: Check Current Version

Read the current installed version:

```bash
cat .cursor/.aether-instructions-version 2>/dev/null || echo "Not installed"
```

Report to user:

> Current version: X.Y.Z (or "Not installed")

---

## Step 2: Check Latest Version

Query npm for the latest version:

```bash
npm view @yottagraph-app/aether-instructions version
```

Compare with current:

- If same version: Ask user if they want to reinstall anyway
- If newer version: Proceed with update
- If current is newer: Warn user (they may have a pre-release)

---

## Step 3: Download Package

Create a temporary directory and download the package:

```bash
TEMP_DIR=$(mktemp -d)
npm pack @yottagraph-app/aether-instructions@latest --pack-destination "$TEMP_DIR"
```

Extract the tarball:

```bash
tar -xzf "$TEMP_DIR"/*.tgz -C "$TEMP_DIR"
```

The extracted content is in `$TEMP_DIR/package/`.

---

## Step 4: Delete Previously Installed Files

Read the manifest and delete listed files:

```bash
if [ -f .cursor/.aether-instructions-manifest ]; then
  while IFS= read -r rel; do
    rm -rf ".cursor/$rel"
  done < .cursor/.aether-instructions-manifest
fi
```

Also clean up legacy `aether_*` files from older package versions:

```bash
rm -f .cursor/rules/aether_*.mdc
rm -f .cursor/commands/aether_*.md
rm -rf .cursor/skills/aether_*/
```

---

## Step 5: Copy New Files

Create directories if needed:

```bash
mkdir -p .cursor/rules .cursor/commands .cursor/skills
```

Copy files from the extracted package:

```bash
cp "$TEMP_DIR/package/rules/"* .cursor/rules/ 2>/dev/null || true
cp "$TEMP_DIR/package/commands/"* .cursor/commands/ 2>/dev/null || true
cp -r "$TEMP_DIR/package/skills/"* .cursor/skills/ 2>/dev/null || true
```

---

## Step 6: Write Manifest and Version Marker

Build a manifest of all installed files (one relative path per line):

```bash
MANIFEST=""
for f in .cursor/rules/*.mdc; do [ -f "$f" ] && MANIFEST="$MANIFEST\nrules/$(basename "$f")"; done
for f in .cursor/commands/*.md; do [ -f "$f" ] && MANIFEST="$MANIFEST\ncommands/$(basename "$f")"; done
for d in .cursor/skills/*/; do [ -d "$d" ] && MANIFEST="$MANIFEST\nskills/$(basename "$d")"; done
echo -e "$MANIFEST" > .cursor/.aether-instructions-manifest
```

Write the version marker:

```bash
grep -o '"version": *"[^"]*"' "$TEMP_DIR/package/package.json" | grep -o '[0-9][^"]*' > .cursor/.aether-instructions-version
```

---

## Step 7: Cleanup

Remove the temporary directory:

```bash
rm -rf "$TEMP_DIR"
```

---

## Step 8: Report Changes

Count what was installed:

```bash
wc -l < .cursor/.aether-instructions-manifest
ls .cursor/rules/*.mdc 2>/dev/null | wc -l
ls .cursor/commands/*.md 2>/dev/null | wc -l
ls -d .cursor/skills/*/ 2>/dev/null | wc -l
```

Report to user:

> Updated to @yottagraph-app/aether-instructions@X.Y.Z
>
> - Rules: N files
> - Commands: N files
> - Skills: N directories

---

## Step 9: Commit Changes

Commit the updated instruction files:

```bash
git add .cursor/rules/ .cursor/commands/ .cursor/skills/ .cursor/.aether-instructions-version .cursor/.aether-instructions-manifest
git commit -m "Update instructions to vX.Y.Z"
```

> Changes committed. Your instructions are now up to date.

---

## Troubleshooting

### npm pack fails

If `npm pack` fails with a registry error:

> Make sure you have network access to npmjs.com. If you're behind a proxy, configure npm: `npm config set proxy <url>`

### Permission denied

If you get permission errors:

> Try running with appropriate permissions, or check that `.cursor/` is writable.

### Want to customize a rule or command?

If you need to modify a package-provided file:

1. Edit it directly — your changes will persist until the next update
2. To preserve changes across updates, copy it to a new name first
3. Remove the original's entry from `.cursor/.aether-instructions-manifest` so it won't be deleted on update
