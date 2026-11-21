# Smart Panel Documentation

This directory contains developer documentation for the Smart Panel project.

## Documentation Structure

```
docs/
├── README.md                          # This file
├── admin-ui-design-spec.md            # Admin UI design system (authoritative for admin screens)
├── admin-ui-screens-and-plugins.md    # Current admin screens and plugin UI inventory
├── archive/                           # Superseded documents, kept for history
├── architecture.md                    # System architecture overview
├── automations-architecture.md        # Automations module: graph, engine, cards
├── climate-domain.md                  # Climate domain implementation
├── device-simulator.md                # Device simulator plugin for testing
├── display-ui-design-spec.md          # Display UI design system (authoritative for panel screens)
├── domains.md                         # Domain architecture (lights, climate, media, etc.)
├── energy-module.md                   # Energy module implementation
├── extensions.md                      # Extensions system documentation
├── media-domain.md                    # Media domain implementation
├── spaces_devices_relations.md        # Spaces and devices relationships
└── spaces_rooms_and_zones.md          # Rooms and zones documentation
```

## Quick Links

### For Users

- [Installation Guide](../build/docs/INSTALLATION.md) - Server, display, and all-in-one installation

### For Developers

- [Architecture Overview](./architecture.md) - System design and module structure
- [Development Guidelines](../.ai-rules/GUIDELINES.md) - Setup, build commands, coding style
- [API Conventions](../.ai-rules/API_CONVENTIONS.md) - Backend API patterns
- [Extensions System](./extensions.md) - How to build and register extensions
- [Admin UI Design Spec](./admin-ui-design-spec.md) - Tokens, components, page templates, screen sizes and plugin slots for the admin
- [Display UI Design Spec](./display-ui-design-spec.md) - Tokens, fonts, size system, components and screen rules for the wall display
- [Automations](./automations-architecture.md) - Automation graph model, run semantics and how to add cards
- [Domain Architecture](./domains.md) - Domain definitions (lights, climate, media, security, sensors)
- [Climate Domain](./climate-domain.md) - Climate domain implementation details
- [Media Domain](./media-domain.md) - Media domain implementation details
- [Energy Module](./energy-module.md) - Energy tracking and aggregation
- [Device Simulator](./device-simulator.md) - Create virtual devices for testing
- [Spaces & Devices](./spaces_devices_relations.md) - Relationships between spaces and devices
- [Rooms & Zones](./spaces_rooms_and_zones.md) - Room and zone conceptual model

### For AI Tools

AI tools (Claude Code, etc.) should primarily reference:
1. `CLAUDE.md` (also `AGENTS.md`) - Quick reference for project commands, structure, rules and architecture documents
2. `docs/admin-ui-design-spec.md` - Admin UI design system; read before any admin UI change
3. `docs/display-ui-design-spec.md` - Display UI design system; read before any panel UI change
4. `tasks/` - Task specifications for feature implementation
