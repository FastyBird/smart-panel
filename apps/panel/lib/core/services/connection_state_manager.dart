import 'dart:async';

import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/core/types/connection_state.dart';

/// Manages WebSocket connection state with grace periods and debouncing.
///
/// This service provides intelligent connection state management that:
/// - Debounces rapid connection changes to prevent UI flickering
/// - Escalates UI severity based on disconnection duration
/// - Tracks connection timing for staleness indicators
/// - Prevents oscillation between states
///
/// Example usage:
/// ```dart
/// final manager = ConnectionStateManager();
/// manager.addListener(() {
///   print('State: ${manager.state}, Severity: ${manager.uiSeverity}');
/// });
/// manager.onConnected();
/// ```
class ConnectionStateManager extends ChangeNotifier {
  SocketConnectionState _state = SocketConnectionState.initializing;
  DateTime? _disconnectedAt;
  DateTime? _lastConnectedAt;
  Timer? _escalationTimer;
  Timer? _debounceTimer;
  Timer? _recoveryHysteresisTimer;
  int _consecutiveFailures = 0;
  bool _isInRecoveryCooldown = false;

  // Timing configuration - can be adjusted for different UX requirements
  static const Duration _debounceDelay = Duration(seconds: 2);
  static const Duration _bannerThreshold = Duration(seconds: 2);
  static const Duration _overlayThreshold = Duration(seconds: 10);
  static const Duration _offlineThreshold = Duration(seconds: 30);
  static const Duration _fullScreenThreshold = Duration(seconds: 60);
  // ignore: unused_field - reserved for future hysteresis implementation
  static const Duration _recoveryHysteresis = Duration(seconds: 5);
  static const Duration _recoveryCooldown = Duration(seconds: 3);
  static const Duration _escalationCheckInterval = Duration(seconds: 5);

  /// Current connection state
  SocketConnectionState get state => _state;

  /// Duration since disconnection started, or zero if connected
  Duration get disconnectedDuration => _disconnectedAt != null
      ? DateTime.now().difference(_disconnectedAt!)
      : Duration.zero;

  /// Timestamp of last successful connection
  DateTime? get lastConnectedAt => _lastConnectedAt;

  /// Number of consecutive connection failures
  int get consecutiveFailures => _consecutiveFailures;

  /// Whether currently in recovery cooldown (suppress warnings briefly after reconnection)
  bool get isInRecoveryCooldown => _isInRecoveryCooldown;

  /// Called when socket connects successfully.
  ///
  /// Resets failure counters and transitions to [SocketConnectionState.online].
  void onConnected() {
    if (kDebugMode) {
      debugPrint('[SocketConnectionStateManager] onConnected called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _recoveryHysteresisTimer?.cancel();

    final wasDisconnected = _state != SocketConnectionState.online &&
        _state != SocketConnectionState.initializing;

    _disconnectedAt = null;
    _lastConnectedAt = DateTime.now();
    _consecutiveFailures = 0;

    // Start recovery cooldown to suppress brief disconnect warnings
    if (wasDisconnected) {
      _isInRecoveryCooldown = true;
      Timer(_recoveryCooldown, () {
        _isInRecoveryCooldown = false;
      });
    }

    _updateState(SocketConnectionState.online);
  }

  /// Called when socket connection is lost.
  ///
  /// Starts debounce timer before transitioning to [SocketConnectionState.reconnecting].
  void onDisconnected() {
    if (kDebugMode) {
      debugPrint('[SocketConnectionStateManager] onDisconnected called, current state: $_state');
    }

    // Ignore disconnects during recovery cooldown
    if (_isInRecoveryCooldown) {
      if (kDebugMode) {
        debugPrint('[SocketConnectionStateManager] Ignoring disconnect during recovery cooldown');
      }
      return;
    }

    if (_state == SocketConnectionState.online) {
      // Start debounce - don't immediately change state
      _debounceTimer?.cancel();
      _debounceTimer = Timer(_debounceDelay, () {
        _disconnectedAt = DateTime.now();
        _updateState(SocketConnectionState.reconnecting);
        _startEscalationTimer();
      });
    } else if (_state == SocketConnectionState.initializing ||
        _state == SocketConnectionState.connecting) {
      // During initialization, don't debounce - show connecting state
      _disconnectedAt = DateTime.now();
      _updateState(SocketConnectionState.reconnecting);
      _startEscalationTimer();
    }
  }

  /// Called when authentication fails.
  ///
  /// Immediately transitions to [SocketConnectionState.authError] without debouncing.
  void onAuthError() {
    if (kDebugMode) {
      debugPrint('[SocketConnectionStateManager] onAuthError called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _updateState(SocketConnectionState.authError);
  }

  /// Called when server returns 503 or similar.
  ///
  /// Transitions to [SocketConnectionState.serverUnavailable].
  void onServerUnavailable() {
    if (kDebugMode) {
      debugPrint('[SocketConnectionStateManager] onServerUnavailable called');
    }

    _debounceTimer?.cancel();
    _updateState(SocketConnectionState.serverUnavailable);
    _startEscalationTimer();
  }

  /// Called when network is unreachable.
  ///
  /// Transitions to [SocketConnectionState.networkUnavailable].
  void onNetworkUnavailable() {
    if (kDebugMode) {
      debugPrint('[SocketConnectionStateManager] onNetworkUnavailable called');
    }

    _debounceTimer?.cancel();
    _updateState(SocketConnectionState.networkUnavailable);
  }

  /// Called when a reconnection attempt starts.
  void onReconnecting() {
    if (kDebugMode) {
      debugPrint('[SocketConnectionStateManager] onReconnecting called');
    }

    if (_state != SocketConnectionState.online) {
      _disconnectedAt ??= DateTime.now();
      _updateState(SocketConnectionState.reconnecting);
    }
  }

  /// Called when initialization/connection attempt starts.
  void onConnecting() {
    if (kDebugMode) {
      debugPrint('[SocketConnectionStateManager] onConnecting called');
    }

    if (_state == SocketConnectionState.initializing) {
      _updateState(SocketConnectionState.connecting);
    }
  }

  /// Reset to initial state (e.g., when changing gateway).
  void reset() {
    if (kDebugMode) {
      debugPrint('[SocketConnectionStateManager] reset called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _recoveryHysteresisTimer?.cancel();

    _disconnectedAt = null;
    _consecutiveFailures = 0;
    _isInRecoveryCooldown = false;
    _updateState(SocketConnectionState.initializing);
  }

  void _startEscalationTimer() {
    _escalationTimer?.cancel();
    _escalationTimer = Timer.periodic(_escalationCheckInterval, (_) {
      final duration = disconnectedDuration;

      if (kDebugMode) {
        debugPrint(
          '[SocketConnectionStateManager] Escalation check - duration: ${duration.inSeconds}s, state: $_state',
        );
      }

      // Escalate to offline after threshold
      if (duration >= _offlineThreshold && _state == SocketConnectionState.reconnecting) {
        _consecutiveFailures++;

        if (duration >= _fullScreenThreshold) {
          _updateState(SocketConnectionState.offline);
          _escalationTimer?.cancel();
        }
      }
    });
  }

  void _updateState(SocketConnectionState newState) {
    if (_state != newState) {
      if (kDebugMode) {
        debugPrint('[SocketConnectionStateManager] State transition: $_state -> $newState');
      }
      _state = newState;
      notifyListeners();
    }
  }

  /// UI severity level based on current state and disconnection duration.
  ///
  /// This determines what type of UI feedback should be shown:
  /// - [ConnectionUISeverity.none]: No indicator (fully connected)
  /// - [ConnectionUISeverity.banner]: Non-blocking top banner
  /// - [ConnectionUISeverity.overlay]: Semi-blocking overlay with dimmed content
  /// - [ConnectionUISeverity.splash]: Startup splash screen
  /// - [ConnectionUISeverity.fullScreen]: Full blocking error screen
  ConnectionUISeverity get uiSeverity {
    switch (_state) {
      case SocketConnectionState.online:
        return ConnectionUISeverity.none;

      case SocketConnectionState.initializing:
      case SocketConnectionState.connecting:
      case SocketConnectionState.authenticating:
        return ConnectionUISeverity.splash;

      case SocketConnectionState.reconnecting:
        final duration = disconnectedDuration;
        if (duration < _bannerThreshold) return ConnectionUISeverity.none;
        if (duration < _overlayThreshold) return ConnectionUISeverity.banner;
        return ConnectionUISeverity.overlay;

      case SocketConnectionState.offline:
        return ConnectionUISeverity.fullScreen;

      case SocketConnectionState.authError:
      case SocketConnectionState.serverUnavailable:
      case SocketConnectionState.networkUnavailable:
        return ConnectionUISeverity.fullScreen;
    }
  }

  /// Whether a recovery toast should be shown.
  ///
  /// Returns true when transitioning from a disconnected state to online.
  bool shouldShowRecoveryToast(SocketConnectionState previousState) {
    return _state == SocketConnectionState.online &&
        previousState != SocketConnectionState.online &&
        previousState != SocketConnectionState.initializing &&
        previousState != SocketConnectionState.connecting;
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _recoveryHysteresisTimer?.cancel();
    super.dispose();
  }
}
