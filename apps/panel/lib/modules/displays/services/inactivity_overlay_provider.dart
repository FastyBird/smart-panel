import 'dart:async';

import 'package:fastybird_smart_panel/core/services/screen_power.dart';
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
///
/// When [screenPowerOff] is enabled, the physical display is powered off
/// when the lock screen activates and powered back on when dismissed.
class InactivityOverlayProvider {
  final OverlayManager _overlayManager;
  final ScreenPowerService _screenPowerService;

  bool _isInitialized = false;
  Timer? _inactivityTimer;
  bool _wasActive = false;

  int _screenLockDuration = 30;
  bool _hasScreenSaver = true;
  bool _screenPowerOff = false;

  InactivityOverlayProvider({
    required OverlayManager overlayManager,
    ScreenPowerService? screenPowerService,
  })  : _overlayManager = overlayManager,
        _screenPowerService = screenPowerService ?? ScreenPowerService();

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
    bool? screenPowerOff,
  }) {
    _screenLockDuration = screenLockDuration;
    _hasScreenSaver = hasScreenSaver;
    if (screenPowerOff != null) {
      _screenPowerOff = screenPowerOff;
    }
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

    // Power off the screen if enabled and not showing screen saver
    if (_screenPowerOff && !_hasScreenSaver) {
      _screenPowerService.screenOff();
    }
  }

  /// Detect when the inactivity overlay is dismissed by the user
  /// (active -> inactive transition) and restart the timer.
  void _onOverlayChanged() {
    final entry = _overlayManager.getEntry(InactivityOverlayIds.inactivity);
    final isActive = entry?.isActive ?? false;

    if (_wasActive && !isActive) {
      // Overlay was just dismissed — power on screen and restart timer
      if (_screenPowerService.isScreenOff) {
        _screenPowerService.screenOn();
      }
      resetTimer();
    }

    _wasActive = isActive;
  }
}
