# Documentation

This directory contains all project documentation organized by category.

## Structure

- **`architecture/`** - Architectural decisions, patterns, and system design
- **`security/`** - Security-related documentation, authentication, authorization
- **`domain/`** - Domain-specific documentation (display registration, token handling, etc.)
- **`decisions/`** - Architectural and design decision records (ADRs)
- **`integrations/`** - Integration documentation (WebSockets, APIs, etc.)

## Documentation Index

### Architecture
- [Multi-Backend Display Migration](./architecture/Multi-Backend-Migration.md) - Implementation for migrating displays between backends

### Security
- [Display Registration Security](./security/Display-Registration-Security.md) - Security enhancement plan for display registration
- [Token Refresh and Permit Join](./security/Token-Refresh-Permit-Join.md) - Requirements for token refresh vs permit join
- [Lost Token and Permit Join UI](./security/Lost-Token-Permit-Join-UI.md) - UI implementation for lost token scenarios

### Domain
- [Display Registration Scenarios](./domain/Display-Registration-Scenarios.md) - Validation scenarios for display registration
- [Display Registration Validation](./domain/Display-Registration-Validation.md) - Summary of registration validation
- [Display Deletion and Revocation](./domain/Display-Deletion-Revocation.md) - Scenarios for display deletion and token revocation
- [Token and Display Reset](./domain/Token-Display-Reset.md) - Analysis of token/display reset behavior

### Decisions
- [Refactoring Plan: Displays Module](./decisions/Refactoring-Plan-Displays-Module.md) - Architectural decision record for consolidating display modules
- [Refactoring Plan: Page-Display Relation](./decisions/Refactoring-Plan-Page-Display-Relation.md) - Architectural decision record for changing page-display relationship to 1:n

### Integrations
- [WebSocket Token Updates](./integrations/WebSocket-Token-Updates.md) - WebSocket integration with token refresh
