import 'dart:async';

import 'package:fastybird_smart_panel/modules/displays/presentation/lock.dart';
import 'package:fastybird_smart_panel/modules/displays/presentation/screen_saver.dart';
import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';

/// Overlay ID for inactivity overlays.
class InactivityOverlayIds {
  static const String inactivity = 'inactivity';
}

/// Manages an inactivity timer and shows a lock screen or screen saver
/// via the [OverlayManager] when the user is idle.
class InactivityOverlayProvider {
  final OverlayManager _overlayManager;

  bool _isInitialized = false;
  Timer? _inactivityTimer;
  bool _wasActive = false;

  int _screenLockDuration = 30;
  bool _hasScreenSaver = true;

  InactivityOverlayProvider({
    required OverlayManager overlayManager,
  }) : _overlayManager = overlayManager;

  /// Initialize by registering the overlay entry and starting the timer.
  void init() {
    if (_isInitialized) return;
    _isInitialized = true;

    _overlayManager.register(AppOverlayEntry(
      id: InactivityOverlayIds.inactivity,
      displayType: OverlayDisplayType.fullScreen,
      priority: 50,
      closable: true,
      customBuilder: (context) => const LockScreen(),
    ));

    // Listen to overlay manager to detect user dismissal
    _overlayManager.addListener(_onOverlayChanged);

    resetTimer();
  }

  /// Clean up timer, listeners, and unregister overlay.
  void dispose() {
    if (!_isInitialized) return;
    _isInitialized = false;

    _inactivityTimer?.cancel();
    _overlayManager.removeListener(_onOverlayChanged);
    _overlayManager.unregister(InactivityOverlayIds.inactivity);
  }

  /// Update configuration. Call when display settings change.
  void updateConfig({
    required int screenLockDuration,
    required bool hasScreenSaver,
  }) {
    _screenLockDuration = screenLockDuration;
    _hasScreenSaver = hasScreenSaver;
    resetTimer();
  }

  /// Reset the inactivity timer. Call on user interaction (tap/pan).
  void resetTimer() {
    _inactivityTimer?.cancel();

    if (_screenLockDuration > 0) {
      _inactivityTimer = Timer(
        Duration(seconds: _screenLockDuration),
        _onInactivityTimeout,
      );
    }
  }

  void _onInactivityTimeout() {
    // Skip if a full-screen overlay is already active (system action, connection error, etc.)
    if (_overlayManager.hasActiveFullScreen) {
      resetTimer();
      return;
    }

    _overlayManager.show(
      InactivityOverlayIds.inactivity,
      displayType: OverlayDisplayType.fullScreen,
      closable: true,
      customBuilder: (context) {
        if (_hasScreenSaver) {
          return const ScreenSaverScreen();
        }

        return const LockScreen();
      },
    );
  }

  /// Detect when the inactivity overlay is dismissed by the user
  /// (active → inactive transition) and restart the timer.
  void _onOverlayChanged() {
    final entry = _overlayManager.getEntry(InactivityOverlayIds.inactivity);
    final isActive = entry?.isActive ?? false;

    if (_wasActive && !isActive) {
      // Overlay was just dismissed — restart timer
      resetTimer();
    }

    _wasActive = isActive;
  }
}
