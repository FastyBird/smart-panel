# Spaces & Devices Relations – Rooms, Zones and Constraints

This document defines **authoritative rules** for relationships between **Spaces** (Rooms / Zones) and **Devices**.
It is intended as a design contract for backend validation, admin UI logic, and future-proof data modeling.
This document should be used as guidance for implementation and code review.

---

## 1. Core Principles

- **Rooms are the primary physical location for devices**
- **Zones are aggregation / context layers**
- **Devices have exactly one primary location at most**
- **Zones must never replace Rooms as primary location**
- **Floor membership is structural, not explicit**

These rules are designed to:
- keep SpacePage deterministic,
- avoid ambiguous device placement,
- prevent expensive schema migrations later.

---

## 2. Space Types

### SpaceType.ROOM
Represents a physical room inside the building.

Examples:
- Living room
- Bedroom
- Kitchen
- Hallway

Rooms:
- may contain devices directly,
- may have a wall display,
- may have a parent Zone.

---

### SpaceType.ZONE
Represents an aggregation or contextual grouping.

Examples:
- Floors (ground floor, basement)
- Outdoor areas (garden, driveway)
- Functional zones (security perimeter, utility)

Zones:
- are NOT primary interaction targets,
- typically do NOT have wall displays,
- may aggregate rooms and/or devices.

---

## 3. Space Hierarchy (Parent / Child)

### Allowed hierarchy (MVP)

- **Room → Zone** (optional)
- **Zone → none**

Rules:
- `Room.parentId` is optional
- If `Room.parentId` is set:
  - parent must exist
  - parent.type MUST be `ZONE`
- `Zone.parentId` MUST be null (MVP constraint)

This creates a clear tree:
```
Zone (floor / outdoor / utility)
└── Room
```

Zone-to-zone hierarchy is intentionally disallowed in MVP to avoid complexity.

---

## 4. Device → Room (1:1 Primary Location)

Devices have a **single primary location**, represented by a Room.

### Rules

- Device may have **zero or one Room**
- If `device.roomId` is set:
  - referenced Space MUST exist
  - referenced Space MUST have `type = ROOM`

This relationship:
- defines where the device physically lives,
- drives SpacePage content,
- defines default control context.

---

## 5. Device ↔ Zone (M:N Membership)

Devices may optionally belong to multiple Zones as **contextual membership**.

### Rules

- Device may belong to **zero or more Zones**
- All referenced Spaces MUST:
  - exist
  - have `type = ZONE`
- Devices MUST NOT be explicitly assigned to floor Zones

Floor membership is derived via:
```
Device → Room → Parent Zone (floor)
```

### Intended usage

Zone membership is intended for:
- `security_perimeter`
- `utility`
- selected `outdoor_*` contexts

Zone membership is NOT intended for:
- defining primary device location
- replacing Room assignment
- floor aggregation

---

## 6. Validation Rules (Backend – Mandatory)

Validation MUST be enforced at service level (not only UI):

### Spaces
1. ROOM:
   - category ∈ roomCategorySet
2. ZONE:
   - category ∈ zoneCategorySet
3. parentId:
   - allowed only for ROOM
   - parent.type MUST be ZONE

### Devices
1. device.roomId:
   - must reference Space(type=ROOM)
2. device.zones[]:
   - must reference Space(type=ZONE)
   - must NOT include floor categories
3. device must never have:
   - more than one Room
   - Zone-only location without explicit intent

Invalid combinations MUST be rejected even via direct API calls.

---

## 7. Admin UI Implications

- Room assignment:
  - single-select
  - required for indoor devices
- Zone membership:
  - multi-select
  - optional
  - hidden or limited for floor Zones
- Parent selection for Space:
  - only visible for Rooms
  - dropdown limited to Zones

Invalid UI states must be prevented and backend validation must act as final gate.

---

## 8. Why This Model

This approach ensures:
- deterministic SpacePage behavior,
- clean House Overview aggregation,
- no ambiguity for AI / intent systems,
- no forced schema migration when Zones become more important later.

---

## 9. Explicit Non-Goals (MVP)

- Zone-to-zone hierarchy
- Device primary location via Zone
- Implicit multi-room devices
- Automated reassignment logic

These may be added later as explicit features.

---

## 10. Summary

- Rooms = primary location
- Zones = aggregation / context
- Devices belong to **one Room at most**
- Devices may belong to **multiple Zones**
- Floors are derived, not explicitly assigned
- Parent-child hierarchy is strictly Room → Zone

This document defines the authoritative contract for Spaces and Devices relationships.
