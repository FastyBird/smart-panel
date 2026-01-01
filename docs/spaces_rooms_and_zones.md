# Spaces: Rooms and Zones

This document defines the conceptual model for **Rooms** and **Zones** within the Smart Panel architecture.
It is intended to be part of the `/docs` folder and serves as an architectural reference for backend, admin UI,
and panel UX design.

---

## 1. Purpose

The goal of introducing Rooms and Zones is to:

- Enable **room-first control** (SpacePage, room panels)
- Enable **house-level overview and aggregation** (master panels)
- Avoid ambiguous or overlapping concepts (e.g. mixing rooms, floors, and security states)
- Keep the model simple, deterministic, and extensible

---

## 2. Definitions

### Room

A **Room** represents a concrete, physical space **inside the building**
where a person can interact with the environment.

**Examples:**
- Living Room
- Kitchen
- Bedroom
- Bathroom
- Hallway
- Garage

**Characteristics:**
- Rooms are the **primary unit of interaction**
- A Room typically:
  - has devices assigned to it
  - can have a SpacePage
  - can have a room panel (display assigned to it)

---

### Zone

A **Zone** represents a **logical or spatial aggregation**
that groups Rooms and/or Devices for overview, filtering, or global actions.

Zones are **not** meant for direct, detailed interaction.

---

## 3. Zone Categories (Recommended)

### 3.1 Floor Zones (`floor`)

Represents vertical grouping of Rooms inside the building.

**Examples:**
- Ground Floor
- First Floor
- Basement

**Rules:**
- A Room belongs to **at most one floor zone**
- Floor zones typically contain Rooms only

---

### 3.2 Outdoor Zones (`outdoor_area`)

Represents areas **outside the building envelope**
(e.g. space in front of the house).

**Examples:**
- Front Yard
- Driveway
- Garden
- Terrace
- Walkway

**Rules:**
- Outdoor zones usually do NOT contain Rooms
- Devices are assigned directly to the Zone

---

### 3.3 Functional Zones (`functional`)

Represents a logical grouping based on function rather than location.

**Examples:**
- Security Perimeter
- Utilities
- Energy / Solar

**Rules:**
- Optional
- Not required for MVP

---

## 4. Relationship Model (MVP)

- Room → optional `floor` Zone
- Device → one primary Room OR one Outdoor Zone
- Display:
  - room panels → assigned to a Room
  - master/entry panels → no Room assignment

---

## 5. UX Implications

- Room panels operate only on Rooms
- Master panels can filter by Zones
- Entry panels focus on House Modes

---

## 6. Explicit Non-Goals

Zones are NOT:
- Entry / Leaving states
- Global "all devices" groups
- Temporary collections

---

## 7. Summary

- Rooms = interaction
- Zones = aggregation
- Displays = interaction surface
- House Modes = global state
