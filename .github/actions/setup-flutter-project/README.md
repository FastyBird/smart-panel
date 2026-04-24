# Setup Flutter Project

This GitHub Action sets up a Flutter project using a specified Flutter SDK version, installs Melos, bootstraps dependencies, and runs code generation.

## 📦 Features

* Installs a specific Flutter SDK version using `subosito/flutter-action`
* Activates Melos globally
* Bootstraps packages with `melos bootstrap`
* Generates Dart code using `melos rebuild-api`

## ✅ Usage

```yaml
- name: Setup Flutter Project
  uses: ./.github/actions/setup-flutter-project
  with:
    flutter-version: 3.41.5      # Optional, defaults to 3.41.5
    flutter-channel: stable      # Optional, defaults to stable
```

## 💡 Inputs

| Name              | Description                                | Default  | Required |
|-------------------|--------------------------------------------|----------|----------|
| `flutter-version` | Version of the Flutter SDK to install      | `3.41.5` | ❌        |
| `flutter-channel` | Flutter release channel (`stable`, `beta`) | `stable` | ❌        |

## 🛠 Included Steps

1. Install Flutter SDK using subosito/flutter-action
2. Activate Melos globally via Dart
3. Bootstraps dependencies via `melos bootstrap`
4. Builds generated code via `melos rebuild-api`

## 📁 Project Structure

This action expects to be used in a monorepo structure managed by Melos with a valid melos.yaml file in the root directory.
