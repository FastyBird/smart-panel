# Setup Node Project

This GitHub Action sets up a Node.js project using PNPM, installs dependencies, caches the store, and runs code generation.

## 📦 Features

* Sets up a specified Node.js version
* Installs a specified PNPM version
* Caches the PNPM store for faster installs
* Installs project dependencies
* Runs `pnpm generate:openapi`

## ✅ Usage

```yaml
- name: Setup Node.js Project
  uses: ./.github/actions/setup-node-project
  with:
    node-version: 22        # Optional, defaults to 22
    pnpm-version: 9.13.0    # Optional, defaults to 9.13.0
```

## 💡 Inputs

| Name            | Description                            | Default  | Required |
|-----------------|----------------------------------------|----------|----------|
| `node-version`  | Node.js version to install             | `22`     | ❌        |
| `pnpm-version`  | PNPM version to install                | `9.13.0` | ❌        |

## 🛠 Included Steps

1. Setup Node.js using `actions/setup-node`
2. Setup PNPM using `pnpm/action-setup`
3. Cache the PNPM store directory
4. Install dependencies using `pnpm install`
5. Run `pnpm generate:openapi`

## 📁 Project Structure

This action expects to be used in a monorepo setup with a shared `pnpm-lock.yaml` at the root.
