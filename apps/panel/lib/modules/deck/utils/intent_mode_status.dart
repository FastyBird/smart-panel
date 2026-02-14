/// Result of computing intent mode status for a mode selector.
///
/// Each field maps to a specific icon in the popup:
/// - [checkMode] → `Icons.check` — the active mode (selected + actively applied via intent)
/// - [syncMode] → `Icons.sync` — externally applied mode (not selected + matches device state)
/// - [historyMode] → `Icons.history` — overridden mode (selected but no longer active)
class IntentModeStatus<T> {
  final T? checkMode;
  final T? syncMode;
  final T? historyMode;

  const IntentModeStatus({
    this.checkMode,
    this.syncMode,
    this.historyMode,
  });

  /// Convert to positional tuple for backward compatibility with existing callers.
  (T?, T?, T?) toTuple() => (checkMode, syncMode, historyMode);
}

/// Computes the intent status icon for each mode in a mode selector.
///
/// Determines which icon (check / sync / history / none) to show on each mode
/// button based on the relationship between the selected intent, current device
/// state, and whether the current state was achieved through an intent.
///
/// ## Rules
///
/// **Selected intent** (last intent triggered from panel):
/// - current state matches AND was achieved via intent → `check` (actively applied)
/// - otherwise → `history` (was applied but overridden — by manual change, automation, etc.)
///
/// **Other intents** (not the selected one):
/// - matches current device state → `sync` (externally applied)
/// - does NOT match → no icon
///
/// **Optimistic UI** (locked state):
/// - When the control state machine is locked (user just tapped a mode),
///   the [lockedValue] is shown with `check` immediately. No pending state.
///
/// ## Parameters
///
/// - [selectedIntent]: The last mode triggered from the panel (`lastAppliedMode`).
/// - [currentState]: The mode detected from actual device state (`detectedMode`).
/// - [isCurrentStateFromIntent]: Whether the current detected state was achieved
///   through a mode intent (`isModeFromIntent`). When `false`, even if
///   [currentState] equals [selectedIntent], the intent is considered overridden
///   (e.g., user manually changed a role position).
/// - [isLocked]: Whether the control state machine is currently locked (optimistic UI).
/// - [lockedValue]: The desired mode value during optimistic lock.
///
/// ## Edge Cases
///
/// - If [selectedIntent] is null (no intent ever applied), [currentState] is
///   shown as `check` (it's the active mode, just no intent history).
/// - If both are null, no icons are shown.
/// - If user manually changes device state back to fully match the selected
///   intent (and backend re-detects it as from-intent), `history` automatically
///   becomes `check` again.
IntentModeStatus<T> computeIntentModeStatus<T>({
  required T? selectedIntent,
  required T? currentState,
  required bool isCurrentStateFromIntent,
  required bool isLocked,
  T? lockedValue,
}) {
  // Optimistic UI: when locked, show check on the desired value immediately.
  if (isLocked && lockedValue != null) {
    return IntentModeStatus(checkMode: lockedValue);
  }

  // No selected intent — show check on current state if available.
  if (selectedIntent == null) {
    return IntentModeStatus(checkMode: currentState);
  }

  // Selected intent matches current state AND was achieved via intent → check.
  if (selectedIntent == currentState && isCurrentStateFromIntent) {
    return IntentModeStatus(checkMode: selectedIntent);
  }

  // Selected intent is overridden (different state, or same state but not from intent).
  // → history on selected, sync on current only if it's a different mode.
  return IntentModeStatus(
    syncMode: currentState != selectedIntent ? currentState : null,
    historyMode: selectedIntent,
  );
}
