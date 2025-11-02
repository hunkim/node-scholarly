# Publishing Guide

This package is automatically published to npm using GitHub Actions when you create a new version tag.

## Setup (One-time)

### 1. Create npm Access Token

1. Login to [npmjs.com](https://www.npmjs.com)
2. Click on your profile → "Access Tokens"
3. Click "Generate New Token" → "Classic Token"
4. Select **Automation** type
5. Copy the token (starts with `npm_...`)

### 2. Add Token to GitHub Secrets

1. Go to your GitHub repository: https://github.com/hunkim/node-scholarly
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click **Add secret**

## Publishing a New Version

### Option 1: Using npm version command (Recommended)

```bash
# Update patch version (1.0.0 → 1.0.1)
npm version patch -m "chore: release v%s"

# Update minor version (1.0.0 → 1.1.0)
npm version minor -m "feat: release v%s"

# Update major version (1.0.0 → 2.0.0)
npm version major -m "breaking: release v%s"

# Push the tag
git push origin main --tags
```

This will:
1. Update `package.json` version
2. Create a git commit
3. Create a git tag (e.g., `v1.0.1`)
4. When you push the tag, GitHub Actions will automatically publish to npm

### Option 2: Manual tagging

```bash
# Update version in package.json manually
# Then commit the change
git add package.json
git commit -m "chore: bump version to 1.0.1"

# Create and push tag
git tag v1.0.1
git push origin main --tags
```

### Option 3: Using GitHub Releases

1. Go to https://github.com/hunkim/node-scholarly/releases
2. Click **"Draft a new release"**
3. Click **"Choose a tag"** → Type `v1.0.1` → **"Create new tag"**
4. Fill in release title and notes
5. Click **"Publish release"**

This will trigger the publish workflow automatically.

## What Happens Automatically

When you push a version tag (e.g., `v1.0.1`):

1. ✅ GitHub Actions workflow starts
2. ✅ Code is checked out
3. ✅ Dependencies are installed
4. ✅ Tests are run
5. ✅ Package is built
6. ✅ Package is published to npm
7. ✅ Package is available at `npm install node-scholarly`

## Viewing Workflow Status

Check the workflow status at:
https://github.com/hunkim/node-scholarly/actions

## Testing Before Publishing

Before creating a tag, you can:

```bash
# Run tests locally
npm test

# Build locally
npm run build

# Test the package locally
npm pack
# This creates node-scholarly-1.0.0.tgz
```

## Versioning Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **Patch** (1.0.x): Bug fixes, no breaking changes
- **Minor** (1.x.0): New features, backwards compatible
- **Major** (x.0.0): Breaking changes

## Troubleshooting

### Workflow fails with "401 Unauthorized"
- Check that `NPM_TOKEN` secret is set correctly in GitHub
- Make sure the token is an **Automation** token
- Token should not be expired

### Package not appearing on npm
- Check workflow logs at https://github.com/hunkim/node-scholarly/actions
- Verify tag was pushed: `git tag -l`
- Ensure version in package.json doesn't already exist on npm

### Tests failing in CI
- Run tests locally first: `npm test`
- Check if all dependencies are listed in package.json
- Review workflow logs for specific errors

## Manual Publishing (Fallback)

If automated publishing fails, you can still publish manually:

```bash
npm login
npm publish
```

