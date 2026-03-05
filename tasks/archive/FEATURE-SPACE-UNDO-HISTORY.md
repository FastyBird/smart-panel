# Task: Lightweight undo for Space intents
ID: FEATURE-SPACE-UNDO-HISTORY
Type: feature
Scope: backend, panel
Size: medium
Parent: EPIC-SPACES-FIRST-UX
Status: done

## Summary

Implement lightweight undo functionality for Space intents (lighting and climate), allowing users to revert the most recent action within a 5-minute window.

## Motivation

When users accidentally trigger lighting mode changes or temperature adjustments, they need a quick way to revert to the previous state. This feature provides a lightweight, time-limited undo mechanism that captures device states before intent execution and restores them on demand.

## Implementation

### Backend (NestJS)

1. **SpaceUndoHistoryService** (`apps/backend/src/modules/spaces/services/space-undo-history.service.ts`)
   - In-memory storage with per-space undo stack
   - Maximum 1 entry per space (lightweight design)
   - 5-minute TTL for undo entries
   - Automatic cleanup of expired entries
   - Methods: `pushSnapshot()`, `peekUndoEntry()`, `executeUndo()`, `clearSpace()`

2. **SpaceIntentService Integration**
   - Captures context snapshot before executing lighting/climate intents
   - Stores snapshot in undo history with action description

3. **API Endpoints** (SpacesController)
   - `GET /spaces/:id/undo` - Get undo state (canUndo, description, expiresInSeconds)
   - `POST /spaces/:id/intents/undo` - Execute undo, restore device states

4. **Response Models**
   - `UndoStateDataModel` - undo availability and metadata
   - `UndoResultDataModel` - undo execution result

### Panel (Flutter/Dart)

1. **SpacePage State**
   - `_canUndo`, `_undoDescription`, `_undoExpiresInSeconds` state variables
   - `_loadUndoState()` - fetch undo availability from API
   - `_executeUndo()` - trigger undo and refresh states

2. **UI**
   - Undo button in header badges (appears when undo is available)
   - Visual feedback with loading indicator during undo execution
   - Success/error alerts after undo completes

## API Reference

### GET /spaces/:id/undo

Response:
```json
{
  "data": {
    "can_undo": true,
    "action_description": "Set lighting mode to work",
    "intent_category": "lighting",
    "captured_at": "2025-01-25T12:00:00Z",
    "expires_in_seconds": 240
  }
}
```

### POST /spaces/:id/intents/undo

Response:
```json
{
  "data": {
    "success": true,
    "restored_devices": 3,
    "failed_devices": 0,
    "message": "Restored 3 device(s)"
  }
}
```

## Files Changed

### Backend
- `apps/backend/src/modules/spaces/services/space-undo-history.service.ts` (new)
- `apps/backend/src/modules/spaces/services/space-undo-history.service.spec.ts` (new)
- `apps/backend/src/modules/spaces/services/space-intent.service.ts` (modified)
- `apps/backend/src/modules/spaces/controllers/spaces.controller.ts` (modified)
- `apps/backend/src/modules/spaces/models/spaces-response.model.ts` (modified)
- `apps/backend/src/modules/spaces/spaces.module.ts` (modified)
- `apps/backend/src/modules/spaces/spaces.openapi.ts` (modified)

### Panel
- `apps/panel/lib/features/dashboard/presentation/pages/space.dart` (modified)

## Acceptance Criteria

- [x] Undo is captured before each lighting intent execution
- [x] Undo is captured before each climate intent execution
- [x] Undo entries expire after 5 minutes
- [x] Only the most recent action can be undone (1 entry per space)
- [x] API endpoints for getting undo state and executing undo
- [x] Panel shows undo button when available
- [x] Panel refreshes undo state after intent execution
- [x] Unit tests for undo service
