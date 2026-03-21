# Continuous Interaction Performance Guidelines

## Core Principle

During continuous interaction, the control itself has priority over all secondary visual updates.

## Rules

1. **Control Priority**: Slider/knob updates immediately. Previews may be isolated, throttled, or delayed.
2. **Architecture**: A continuous control must never directly drive a large widget subtree during drag. Split into control/value/preview/layout subtrees.
3. **State**: Intermediate drag values are UI state, not domain state. Use local ephemeral state during drag, commit on drag end.
4. **Rebuild Scope**: Changing slider position must not rebuild the full page, card, or unrelated widgets.
5. **Repaint Isolation**: Frequently updating visuals must use `RepaintBoundary` or dedicated leaf widgets.
6. **Preview Rendering**: Previews must be cheaper than the control. Fixed layout, paint-only changes, small repaint area.
7. **Throttling**: Throttle secondary previews only, never the gesture response itself.
8. **Value Feedback**: Text labels updating with slider are fine if lightweight and independent from heavy previews.
9. **Visual Complexity**: Minimize opacity, blur, shadows, gradients, and clipping during drag on constrained hardware.
10. **Layout Stability**: Drag must not reshape surrounding layout. Use fixed containers.

## Implementation Pattern

```
On drag start  → initialize local interaction state
During drag    → update local slider value immediately
               → update text value immediately
               → update preview in isolated subtree (throttle if needed)
               → do NOT commit globally
On drag end    → commit final value to store/domain/backend
               → allow heavier downstream updates
```

## Degradation Order (embedded-first)

1. Keep gesture smooth
2. Keep slider thumb aligned with finger
3. Keep value readable
4. Simplify or throttle preview
5. Reduce decorative motion
