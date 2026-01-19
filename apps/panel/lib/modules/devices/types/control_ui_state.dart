/// UI states for device property controls with intent tracking.
///
/// Used by [DeviceControlStateService] to track the state of control channels
/// for individual device properties or property groups.
enum DeviceControlUIState {
  /// Normal state - showing actual device values.
  idle,

  /// User has initiated action, waiting for intent to be created/completed.
  pending,

  /// Intent completed, waiting for device state to converge (settling window).
  settling,

  /// Settling window expired but device state has not converged.
  /// This indicates a sync issue where device didn't reach desired value.
  mixed,
}
