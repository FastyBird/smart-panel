/// Generic UI states for domain-level aggregated controls.
///
/// Used by [DomainControlStateService] to track the state of control channels
/// (e.g., brightness, temperature, position) across multiple devices.
enum ControlUIState {
  /// Normal state - showing actual device values.
  idle,

  /// User has initiated action, waiting for intent to be created/completed.
  pending,

  /// Intent completed, waiting for devices to converge (settling window).
  settling,

  /// Settling window expired but devices have not converged.
  /// This indicates a sync issue where devices have different values.
  mixed,

  /// Error state (reserved for future use).
  error,
}
