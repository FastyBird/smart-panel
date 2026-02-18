# Smart Panel Documentation

This directory contains developer documentation for the Smart Panel project.

## Documentation Structure

```
docs/
├── README.md                          # This file
├── architecture.md                    # System architecture overview
├── climate-domain.md                  # Climate domain implementation
├── device-simulator.md                # Device simulator plugin for testing
├── domains.md                         # Domain architecture (lights, climate, media, etc.)
├── energy-module.md                   # Energy module implementation
├── extensions.md                      # Extensions system documentation
├── media-done-checklist.md            # Media domain implementation checklist
├── spaces_devices_relations.md        # Spaces and devices relationships
├── spaces_rooms_and_zones.md          # Rooms and zones documentation
├── admin/
│   └── media.md                       # Admin media domain guide
├── dev/
│   └── media-architecture.md          # Media architecture implementation details
├── features/
│   └── media-domain-simulator-regression.md  # Media simulator regression notes
└── panel/
    └── media.md                       # Panel media domain guide
```

## Quick Links

### For Developers

- [Architecture Overview](./architecture.md) - System design and module structure
- [Development Guidelines](../.ai-rules/GUIDELINES.md) - Setup, build commands, coding style
- [API Conventions](../.ai-rules/API_CONVENTIONS.md) - Backend API patterns
- [Extensions System](./extensions.md) - How to build and register extensions
- [Domain Architecture](./domains.md) - Domain definitions (lights, climate, media, security, sensors)
- [Device Simulator](./device-simulator.md) - Create virtual devices for testing
- [Energy Module](./energy-module.md) - Energy tracking and aggregation
- [Spaces & Devices](./spaces_devices_relations.md) - Relationships between spaces and devices
- [Rooms & Zones](./spaces_rooms_and_zones.md) - Room and zone conceptual model

### For AI Tools

AI tools (Claude Code, etc.) should primarily reference:
1. `CLAUDE.md` - Quick reference for project commands, structure, and rules
2. `.ai-rules/GUIDELINES.md` - Comprehensive development guidelines
3. `.ai-rules/API_CONVENTIONS.md` - API design patterns
4. `.ai-rules/CLIMATE_ARCHITECTURE.md` - Climate domain architecture
5. `.ai-rules/MEDIA_ARCHITECTURE.md` - Media domain architecture
6. `.ai-rules/OPTIMISTIC_UI_ARCHITECTURE.md` - Panel optimistic UI patterns
7. `tasks/` - Task specifications for feature implementation
