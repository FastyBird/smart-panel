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
  ConnectionState _state = ConnectionState.initializing;
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
  static const Duration _recoveryHysteresis = Duration(seconds: 5);
  static const Duration _recoveryCooldown = Duration(seconds: 3);
  static const Duration _escalationCheckInterval = Duration(seconds: 5);

  /// Current connection state
  ConnectionState get state => _state;

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
  /// Resets failure counters and transitions to [ConnectionState.online].
  void onConnected() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onConnected called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _recoveryHysteresisTimer?.cancel();

    final wasDisconnected = _state != ConnectionState.online &&
        _state != ConnectionState.initializing;

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

    _updateState(ConnectionState.online);
  }

  /// Called when socket connection is lost.
  ///
  /// Starts debounce timer before transitioning to [ConnectionState.reconnecting].
  void onDisconnected() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onDisconnected called, current state: $_state');
    }

    // Ignore disconnects during recovery cooldown
    if (_isInRecoveryCooldown) {
      if (kDebugMode) {
        debugPrint('[ConnectionStateManager] Ignoring disconnect during recovery cooldown');
      }
      return;
    }

    if (_state == ConnectionState.online) {
      // Start debounce - don't immediately change state
      _debounceTimer?.cancel();
      _debounceTimer = Timer(_debounceDelay, () {
        _disconnectedAt = DateTime.now();
        _updateState(ConnectionState.reconnecting);
        _startEscalationTimer();
      });
    } else if (_state == ConnectionState.initializing ||
        _state == ConnectionState.connecting) {
      // During initialization, don't debounce - show connecting state
      _disconnectedAt = DateTime.now();
      _updateState(ConnectionState.reconnecting);
      _startEscalationTimer();
    }
  }

  /// Called when authentication fails.
  ///
  /// Immediately transitions to [ConnectionState.authError] without debouncing.
  void onAuthError() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onAuthError called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _updateState(ConnectionState.authError);
  }

  /// Called when server returns 503 or similar.
  ///
  /// Transitions to [ConnectionState.serverUnavailable].
  void onServerUnavailable() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onServerUnavailable called');
    }

    _debounceTimer?.cancel();
    _updateState(ConnectionState.serverUnavailable);
    _startEscalationTimer();
  }

  /// Called when network is unreachable.
  ///
  /// Transitions to [ConnectionState.networkUnavailable].
  void onNetworkUnavailable() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onNetworkUnavailable called');
    }

    _debounceTimer?.cancel();
    _updateState(ConnectionState.networkUnavailable);
  }

  /// Called when a reconnection attempt starts.
  void onReconnecting() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onReconnecting called');
    }

    if (_state != ConnectionState.online) {
      _disconnectedAt ??= DateTime.now();
      _updateState(ConnectionState.reconnecting);
    }
  }

  /// Called when initialization/connection attempt starts.
  void onConnecting() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onConnecting called');
    }

    if (_state == ConnectionState.initializing) {
      _updateState(ConnectionState.connecting);
    }
  }

  /// Reset to initial state (e.g., when changing gateway).
  void reset() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] reset called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _recoveryHysteresisTimer?.cancel();

    _disconnectedAt = null;
    _consecutiveFailures = 0;
    _isInRecoveryCooldown = false;
    _updateState(ConnectionState.initializing);
  }

  void _startEscalationTimer() {
    _escalationTimer?.cancel();
    _escalationTimer = Timer.periodic(_escalationCheckInterval, (_) {
      final duration = disconnectedDuration;

      if (kDebugMode) {
        debugPrint(
          '[ConnectionStateManager] Escalation check - duration: ${duration.inSeconds}s, state: $_state',
        );
      }

      // Escalate to offline after threshold
      if (duration >= _offlineThreshold && _state == ConnectionState.reconnecting) {
        _consecutiveFailures++;

        if (duration >= _fullScreenThreshold) {
          _updateState(ConnectionState.offline);
          _escalationTimer?.cancel();
        }
      }
    });
  }

  void _updateState(ConnectionState newState) {
    if (_state != newState) {
      if (kDebugMode) {
        debugPrint('[ConnectionStateManager] State transition: $_state -> $newState');
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
      case ConnectionState.online:
        return ConnectionUISeverity.none;

      case ConnectionState.initializing:
      case ConnectionState.connecting:
      case ConnectionState.authenticating:
        return ConnectionUISeverity.splash;

      case ConnectionState.reconnecting:
        final duration = disconnectedDuration;
        if (duration < _bannerThreshold) return ConnectionUISeverity.none;
        if (duration < _overlayThreshold) return ConnectionUISeverity.banner;
        return ConnectionUISeverity.overlay;

      case ConnectionState.offline:
        return ConnectionUISeverity.fullScreen;

      case ConnectionState.authError:
      case ConnectionState.serverUnavailable:
      case ConnectionState.networkUnavailable:
        return ConnectionUISeverity.fullScreen;
    }
  }

  /// Whether a recovery toast should be shown.
  ///
  /// Returns true when transitioning from a disconnected state to online.
  bool shouldShowRecoveryToast(ConnectionState previousState) {
    return _state == ConnectionState.online &&
        previousState != ConnectionState.online &&
        previousState != ConnectionState.initializing &&
        previousState != ConnectionState.connecting;
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _recoveryHysteresisTimer?.cancel();
    super.dispose();
  }
}
