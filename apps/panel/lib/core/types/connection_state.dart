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

/// Extension providing UI-related state queries for [ConnectionState].
extension SocketConnectionStateExtension on SocketConnectionState {
  /// Whether the panel can be used (even if in degraded state).
  ///
  /// Returns true for [online] and [reconnecting] states where
  /// cached data may still be displayed.
  bool get isUsable =>
      this == SocketConnectionState.online || this == SocketConnectionState.reconnecting;

  /// Whether device controls should be disabled.
  ///
  /// Only [online] state allows active control of devices.
  bool get controlsDisabled => this != SocketConnectionState.online;

  /// Whether to show any connection status indicator.
  ///
  /// Returns false only when fully [online].
  bool get showIndicator => this != SocketConnectionState.online;

  /// Whether this is a blocking error state requiring user attention.
  ///
  /// These states typically require full-screen error displays.
  bool get isBlockingError => switch (this) {
        SocketConnectionState.offline => true,
        SocketConnectionState.authError => true,
        SocketConnectionState.serverUnavailable => true,
        SocketConnectionState.networkUnavailable => true,
        _ => false,
      };

  /// Whether automatic reconnection should be attempted.
  bool get shouldAutoReconnect => switch (this) {
        SocketConnectionState.reconnecting => true,
        SocketConnectionState.connecting => true,
        SocketConnectionState.networkUnavailable => true,
        SocketConnectionState.serverUnavailable => true,
        _ => false,
      };

  /// Human-readable description for debugging.
  String get debugLabel => switch (this) {
        SocketConnectionState.initializing => 'Initializing',
        SocketConnectionState.connecting => 'Connecting',
        SocketConnectionState.authenticating => 'Authenticating',
        SocketConnectionState.online => 'Online',
        SocketConnectionState.reconnecting => 'Reconnecting',
        SocketConnectionState.offline => 'Offline',
        SocketConnectionState.authError => 'Authentication Error',
        SocketConnectionState.serverUnavailable => 'Server Unavailable',
        SocketConnectionState.networkUnavailable => 'Network Unavailable',
      };
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
