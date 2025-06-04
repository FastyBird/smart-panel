# Publish NPM Package

This GitHub Action publishes a package to the NPM registry. It supports versioning (manual or automatic), pre-release tags, provenance, and includes the published version as an output.

## 📦 Features

- Publishes any package in the repository to NPM
- Supports both static and dynamic versioning
- Supports pre-release identifiers like `alpha`, `beta`
- Returns published version as output
- Optionally builds code before publishing

## ✅ Usage

```yaml
- name: Publish to NPM
  uses: ./.github/actions/publish-npm-package
  with:
    package_path: "apps/backend"
    tag: "alpha"
  secrets:
    npm_auth_token: ${{ secrets.NPM_REGISTRY_TOKEN }}
```

## 💡 Inputs

| Name                         | Description                                 | Default | Required |
|------------------------------|---------------------------------------------|---------|----------|
| `package-path`               | Path to the package directory               | `-`     | ✅        |
| `tag`                        | NPM tag name (e.g. latest, alpha, beta)     | `-`     | ❌        |
| `npm-version-command`        | If set, runs pnpm version <value>           | `-`     | ❌        |
| `pre-id`                     | Pre-release identifier (e.g. alpha, beta)   | `-`     | ❌        |
| `dynamically-adjust-version` | Runs script to automatically adjust version | `false` | ❌        |
| `npm-auth-token`             | NPM token to authenticate publish           | `-`     | ✅        |


## 🧾 Outputs

| Name          | Description                      |
|---------------|----------------------------------|
| `NPM_VERSION` | Published version of the package |

## 🛠 Included Steps

1. Run versioning logic (manual or dynamic)
2. Publish package to NPM with tag or default
3. Output published version

## 📁 Project Structure

This action is designed for use in monorepos or multi-package repositories using pnpm.
