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
  Timer? _escalationTimer;
  Timer? _debounceTimer;
  Timer? _recoveryCooldownTimer;
  bool _isInRecoveryCooldown = false;
  bool _pendingDisconnectDuringCooldown = false;

  // Timing configuration - can be adjusted for different UX requirements
  static const Duration _debounceDelay = Duration(seconds: 2);
  static const Duration _bannerThreshold = Duration(seconds: 2);
  static const Duration _overlayThreshold = Duration(seconds: 10);
  static const Duration _fullScreenThreshold = Duration(seconds: 60);
  static const Duration _recoveryCooldown = Duration(seconds: 3);
  static const Duration _escalationCheckInterval = Duration(seconds: 5);

  /// Current connection state
  SocketConnectionState get state => _state;

  /// Duration since disconnection started, or zero if connected
  Duration get disconnectedDuration => _disconnectedAt != null
      ? DateTime.now().difference(_disconnectedAt!)
      : Duration.zero;

  /// Called when socket connects successfully.
  ///
  /// Resets failure counters and transitions to [SocketConnectionState.online].
  void onConnected() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onConnected called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _recoveryCooldownTimer?.cancel();

    final wasDisconnected = _state != SocketConnectionState.online &&
        _state != SocketConnectionState.initializing;

    _disconnectedAt = null;
    _pendingDisconnectDuringCooldown = false;
    // Always reset cooldown flag when connected to prevent it getting stuck
    // (e.g., duplicate connect events while already online and in cooldown)
    _isInRecoveryCooldown = false;

    // Start recovery cooldown to suppress brief disconnect warnings
    if (wasDisconnected) {
      _isInRecoveryCooldown = true;
      _recoveryCooldownTimer = Timer(_recoveryCooldown, () {
        _isInRecoveryCooldown = false;
        // Process any disconnect that occurred during cooldown
        if (_pendingDisconnectDuringCooldown) {
          _pendingDisconnectDuringCooldown = false;
          _processDisconnect();
        }
      });
    }

    _updateState(SocketConnectionState.online);
  }

  /// Called when socket connection is lost.
  ///
  /// Starts debounce timer before transitioning to [SocketConnectionState.reconnecting].
  void onDisconnected() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onDisconnected called, current state: $_state');
    }

    // During recovery cooldown, defer the disconnect instead of ignoring it
    if (_isInRecoveryCooldown) {
      if (kDebugMode) {
        debugPrint('[ConnectionStateManager] Deferring disconnect during recovery cooldown');
      }
      _pendingDisconnectDuringCooldown = true;
      return;
    }

    _processDisconnect();
  }

  /// Internal method to process a disconnect event.
  void _processDisconnect() {
    if (_state == SocketConnectionState.online) {
      // Record disconnect time immediately for accurate duration tracking
      _disconnectedAt = DateTime.now();

      // Start debounce - don't immediately change state, but time is already tracked
      _debounceTimer?.cancel();
      _debounceTimer = Timer(_debounceDelay, () {
        _updateState(SocketConnectionState.reconnecting);
        _startEscalationTimer();
      });
    } else if (_state == SocketConnectionState.initializing) {
      // During initialization, don't debounce - show reconnecting state immediately
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
      debugPrint('[ConnectionStateManager] onAuthError called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _disconnectedAt ??= DateTime.now();
    _updateState(SocketConnectionState.authError);
  }

  /// Called when server returns 503 or similar.
  ///
  /// Transitions to [SocketConnectionState.serverUnavailable].
  /// Note: Does not start escalation timer since serverUnavailable is already
  /// a full-screen error state - no further escalation needed.
  void onServerUnavailable() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onServerUnavailable called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _disconnectedAt ??= DateTime.now();
    _updateState(SocketConnectionState.serverUnavailable);
  }

  /// Called when network is unreachable.
  ///
  /// Transitions to [SocketConnectionState.networkUnavailable].
  void onNetworkUnavailable() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onNetworkUnavailable called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _disconnectedAt ??= DateTime.now();
    _updateState(SocketConnectionState.networkUnavailable);
  }

  /// Called when a reconnection attempt starts (e.g., user clicks Retry).
  ///
  /// Resets the disconnect timestamp to give reconnection a fresh window
  /// before escalating back to offline state.
  void onReconnecting() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] onReconnecting called');
    }

    _debounceTimer?.cancel();

    if (_state != SocketConnectionState.online) {
      // Reset timestamp to give reconnection a fresh escalation window.
      // This prevents immediate jump back to offline when retrying after 60+ seconds.
      _disconnectedAt = DateTime.now();
      _updateState(SocketConnectionState.reconnecting);
      _startEscalationTimer();
    }
  }

  /// Reset to initial state (e.g., when changing gateway).
  void reset() {
    if (kDebugMode) {
      debugPrint('[ConnectionStateManager] reset called');
    }

    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _recoveryCooldownTimer?.cancel();

    _disconnectedAt = null;
    _isInRecoveryCooldown = false;
    _pendingDisconnectDuringCooldown = false;
    _updateState(SocketConnectionState.initializing);
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

      // Only process escalation for reconnecting state
      if (_state != SocketConnectionState.reconnecting) {
        return;
      }

      // Escalate to offline state after full-screen threshold (60s)
      if (duration >= _fullScreenThreshold) {
        _updateState(SocketConnectionState.offline);
        _escalationTimer?.cancel();
        return;
      }

      // Notify listeners on each tick so UI can update based on new
      // disconnectedDuration (banner at 2s, overlay at 10s, etc.)
      // This is necessary because uiSeverity depends on duration, not just state.
      notifyListeners();
    });
  }

  void _updateState(SocketConnectionState newState) {
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
      case SocketConnectionState.online:
        return ConnectionUISeverity.none;

      case SocketConnectionState.initializing:
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
        previousState != SocketConnectionState.initializing;
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _escalationTimer?.cancel();
    _recoveryCooldownTimer?.cancel();
    super.dispose();
  }
}
