/// Represents the WebSocket connection lifecycle states.
///
/// This enum provides granular connection states beyond a simple boolean,
/// enabling appropriate UI responses for different connection scenarios.
///
/// Named `SocketConnectionState` to avoid conflict with Flutter's built-in
/// `ConnectionState` enum from the async library.
enum SocketConnectionState {
  /// App starting, attempting first connection
  initializing,

  /// Actively establishing connection
  connecting,

  /// Connection open, validating authentication
  authenticating,

  /// Fully connected and operational
  online,

  /// Lost connection, automatic retry in progress
  reconnecting,

  /// Reconnection failed after multiple attempts, user action may be needed
  offline,

  /// Authentication/token failure - requires re-authentication
  authError,

  /// Server reachable but rejecting connections (maintenance, overload)
  serverUnavailable,

  /// Cannot reach server (network issue, DNS failure)
  networkUnavailable,
}

/// Severity levels for connection UI feedback.
///
/// Determines what type of UI element should be shown based on
/// connection state and duration.
enum ConnectionUISeverity {
  /// No indicator needed - fully connected
  none,

  /// Non-blocking top banner for brief disconnections
  banner,

  /// Semi-blocking overlay with dimmed content visible underneath
  overlay,

  /// Startup splash screen during initialization
  splash,

  /// Full-screen blocking error requiring user action
  fullScreen,
}

/// Type of connection error for classification.
enum ConnectionErrorType {
  /// Authentication or authorization failure
  auth,

  /// Server is unavailable (503, maintenance)
  serverUnavailable,

  /// Network connectivity issue
  network,

  /// Unknown or unclassified error
  unknown,
}
