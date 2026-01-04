# Task: Weather Panel Enhancements (Dashboard Tile and Location Switching)
ID: FEATURE-WEATHER-PANEL-ENHANCEMENTS
Type: feature
Scope: panel
Size: medium
Parent: FEATURE-MULTI-LOCATION-WEATHER
Status: planned

## 1. Business goal

In order to view weather information conveniently on the panel
As a smart panel user
I want a dashboard tile showing primary location weather and the ability to switch locations in the weather detail view

## 2. Context

- Multi-location weather support was implemented in FEATURE-MULTI-LOCATION-WEATHER
- Backend supports multiple locations with primary location selection
- Panel has location models and settings page for location selection
- Dashboard tile and location switching in detail view were deferred as future enhancements

## 3. Scope

**In scope**

- Dashboard tile showing primary location weather (defaults to first location)
- Weather detail view with location switching capability
- Location selector UI in weather detail view

**Out of scope**

- Backend API changes
- Admin UI changes
- Multiple weather tiles for different locations

## 4. Acceptance criteria

- [ ] Dashboard tile displays weather for the primary location
- [ ] If no primary location set, defaults to first available location
- [ ] Weather detail view shows location name prominently
- [ ] Location switcher allows changing between configured locations
- [ ] Weather data updates when location is switched
- [ ] Loading state shown during location switch

## 5. Technical constraints

- Follow existing panel architecture patterns
- Use package imports only
- Do not modify generated code in lib/api/ or lib/spec/
- Support both light and dark themes

## 6. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to panel weather components.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
