# Media Domain – "Done" Checklist

This checklist defines the **definition of done** for the Media domain. All items must be satisfied before the feature is considered shippable.

## API & Backend

- [x] Endpoints API stable and returns correct derived endpoints
- [x] Default bindings produce sensible results for common setups (TV-only, TV+Receiver, full AV)
- [x] Activity activation executes ordered steps with proper timeouts
- [x] Deactivation stops playback and clears active state
- [x] Dry-run preview returns plan and warnings without side effects
- [x] Partial failures are tracked with structured errors and warnings
- [x] Only one active activity per space (enforced at DB level)
- [x] Idempotent re-activation returns current state
- [x] All Media-related errors include spaceId, activityKey, and device context
- [x] Warn-level logging for missing endpoint references and skipped capabilities

## Admin UI

- [x] Admin can view auto-detected endpoints
- [x] Admin can apply default bindings
- [x] Admin can adjust individual bindings (endpoint slots, input, volume)
- [x] Admin can preview execution plan (dry run)
- [x] Admin can test-activate and test-deactivate activities
- [x] Warnings and errors are displayed clearly

## Panel UI

- [x] Panel shows available activities for a space
- [x] Activity activation triggers backend and shows real-time status
- [x] Partial failures show warnings to user
- [x] Full failures show error state with details
- [x] Deactivated state is clearly communicated
- [x] No media devices → clear "unavailable" message
- [x] WebSocket offline → appropriate degraded behavior

## Testing

- [x] Unit tests cover activation, deactivation, dry-run, and failure paths
- [x] Binding service tests cover smart defaults and validation
- [x] Endpoint derivation tests cover all supported device categories
- [x] Regression harness covers TV-only, full AV, and edge-case scenarios
- [x] No role-based logic remains in Media domain

## Documentation

- [x] User-facing docs explain activities and behavior (`/docs/panel/media.md`)
- [x] Admin-facing docs explain configuration flow (`/docs/admin/media.md`)
- [x] Developer docs explain architecture and extension points (`/docs/dev/media-architecture.md`)
- [x] Done checklist exists and is current (`/docs/media-done-checklist.md`)

## After This Checklist

Media domain is considered **alpha complete** and **feature complete**. Ready for:
- Real device testing
- User feedback
- Phase 2 roadmap (queue, multiroom, automations)

Any further work is **enhancement**, not completion.
