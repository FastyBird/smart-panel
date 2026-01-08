/// Types of intents that can be executed by the panel.
///
/// Intents provide a unified interface for actions from UI and future
/// voice control, routing to the appropriate underlying services.
enum IntentType {
  /// Navigate to a specific deck item by ID.
  navigateToDeckItem,

  /// Navigate to the home/start item.
  navigateHome,

  /// Activate a scene by ID.
  activateScene,

  /// Set a device channel property value.
  setDeviceProperty,

  /// Toggle a boolean device property.
  toggleDevice,

  /// Set room context (for room-specific actions).
  setRoomContext,
}

/// Result status of an intent execution.
enum IntentResultStatus {
  /// Intent executed successfully.
  success,

  /// Intent failed with an error.
  failure,

  /// Intent was partially successful (e.g., scene with some failures).
  partialSuccess,

  /// Intent was not executed because it was invalid.
  invalid,
}
