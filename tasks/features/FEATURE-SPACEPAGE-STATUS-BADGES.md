# Task: Add status badges to SpacePage header
ID: FEATURE-SPACEPAGE-STATUS-BADGES
Type: feature
Scope: panel
Size: small
Parent: EPIC-SPACES-FIRST-UX
Status: completed

## 1. Business goal

As a user viewing a space page,
I want to see status badges in the header showing:
- Lighting status (number of lights on, or "Off" when all lights are off)
- Temperature reading (when climate devices are available)

So that I can quickly understand the current state of the space without scrolling through the page.

## 2. Implementation

Status badges are displayed in the SpacePage header using the `AppTopBar.actions` parameter:

- **Lighting Badge**: Shows a lightbulb icon with either the count of lights on (e.g., "3") or "Off" when no lights are active
  - Uses warning color (amber) when lights are on
  - Uses placeholder/muted styling when lights are off

- **Climate Badge**: Shows a thermometer icon with current temperature (e.g., "22.5°")
  - Only displayed when climate devices are available and temperature reading exists
  - Uses secondary/info color styling

## 3. Acceptance criteria

- [x] Lighting badge shows count when lights are on
- [x] Lighting badge shows "Off" when all lights are off
- [x] Climate badge shows current temperature when available
- [x] Badges respect light/dark theme
- [x] Badges are responsive using screen service scaling
