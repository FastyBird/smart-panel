# Publish NPM Package

This GitHub Action publishes a package to the NPM registry. It supports versioning (manual or automatic), pre-release tags, provenance, and includes the published version as an output.

## ✅ Features

- ✔️ Publishes any package (e.g., `apps/backend`) to NPM or GitHub Packages
- 🔄 Supports **manual** or **dynamic versioning**
- 🏷️ Handles **pre-release tags** like `alpha`, `beta`
- 🔐 Supports **custom registries** and **authentication**
- 📤 Outputs the published version for downstream jobs
- 🧱 Optimized for **monorepos** and **pnpm**

## ✅ Usage

```yaml
- name: Publish to NPM
  uses: ./.github/actions/publish-npm-package
  with:
    package-path: apps/backend
    tag: alpha
    npm-auth-token: ${{ secrets.NPM_REGISTRY_TOKEN }}
```

## 💡 Inputs

| Name                         | Description                                             | Default                      | Required |
|------------------------------|---------------------------------------------------------|------------------------------|----------|
| `package-path`               | Path to the package directory                           | `-`                          | ✅        |
| `tag`                        | NPM tag name (e.g. latest, alpha, beta)                 | `-`                          | ❌        |
| `npm-version-command`        | If set, runs pnpm version <value>                       | `-`                          | ❌        |
| `pre-id`                     | Pre-release identifier (e.g. alpha, beta)               | `-`                          | ❌        |
| `dynamically-adjust-version` | Runs script to automatically adjust version             | `false`                      | ❌        |
| `npm-auth-token`             | NPM token to authenticate publish                       | `-`                          | ✅        |
| `npm-registry-url`           | NPM registry URL (e.g., https://npm.pkg.github.com)     | `https://registry.npmjs.org` | ❌        |
| `npm-registry`               | Registry hostname for .npmrc (e.g., npm.pkg.github.com) | `npm.pkg.github.com`         | ❌        |


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
