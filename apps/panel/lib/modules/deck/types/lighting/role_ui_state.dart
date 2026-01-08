/// UI states for role-level aggregated controls.
enum RoleUIState {
  /// Normal state - showing actual device values.
  idle,

  /// User has initiated action, waiting for intent to be created/completed.
  pending,

  /// Intent completed, waiting for devices to converge (settling window).
  settling,

  /// Settling window expired but devices have not converged.
  mixed,

  /// Error state (optional, for future use).
  error,
}
