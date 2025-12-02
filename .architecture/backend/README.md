# Architecture Documentation

This directory contains **internal technical documentation** for the Smart Panel project.

It is the source of truth for:
- Backend & API design
- Module and plugin architecture
- Cross-cutting conventions (naming, Swagger, DTOs, models, entities)
- Any long-lived system-level decisions

## Structure

A recommended structure for this directory:

- `backend/`
  - `API_CONVENTIONS.md` – backend API & Swagger conventions (controllers, DTOs, models, entities)
  - Other backend-specific documents (config, modules, plugins, eventing, persistence…)
- `frontend/` (optional)
  - Documentation for the admin app, panel app, shared UI concepts
- `integration/` (optional)
  - Docs for communication with external systems (Home Assistant, Shelly, etc.)
- `README.md`
  - This file

You can adjust the structure as the project grows, but keep it:
- **Stable** – documents here should be long-lived
- **Authoritative** – when in doubt, this directory wins over comments or ad‑hoc notes
- **Discoverable** – prefer a few well-organized documents over many random files

## Intended Audience

- Core maintainers of the Smart Panel backend and frontend
- Contributors working on architecture, APIs, or plugins
- AI assistants (via explicit prompts) that need to understand project‑wide rules

## Conventions

- All documents in this directory should be written in **English**.
- Use clear, direct language and concrete examples from the codebase.
- When you introduce a new convention (e.g. new API pattern), link to the relevant file here from PR descriptions.

## Related Directories

- `/tasks/` – feature / technical / bug task specs (work units)
- `/.ai-rules/` – machine-readable rules for AI assistants (short, strict)
- `/docs/` – public-facing documentation / presentation website for Smart Panel
