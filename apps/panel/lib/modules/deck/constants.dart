import 'package:fastybird_smart_panel/modules/spaces/views/light_targets/view.dart';

/// Module name identifier.
const String kDeckModuleName = 'deck';

/// Deck UI animation constants.
class DeckConstants {
  DeckConstants._();

  /// Duration for page transition animations (ms).
  static const int pageAnimationMs = 300;

  /// Duration for dot indicator animations (ms).
  static const int dotAnimationMs = 300;
}

/// Lighting domain constants for behavior and thresholds.
class LightingConstants {
  LightingConstants._();

  // ---------------------------------------------------------------------------
  // Feature Flags
  // ---------------------------------------------------------------------------

  /// Enable backend intent integration for lighting control.
  ///
  /// When `true`, lighting controls (mode selection, role toggling) will use
  /// backend intents via [SpacesService] for coordinated multi-device control.
  ///
  /// When `false`, falls back to direct device control via [DevicesService],
  /// controlling each device individually.
  ///
  /// Backend intents provide:
  /// - Atomic multi-device operations
  /// - Server-side mode/scene logic
  /// - Better state consistency
  ///
  /// Direct device control provides:
  /// - Works without backend intent support
  /// - Lower latency for single devices
  /// - Useful for debugging
  ///
  /// Set to `false` to disable backend intents globally (e.g., for testing
  /// fallback behavior or when backend doesn't support intents).
  static const bool useBackendIntents = true;

  /// Threshold for large target lists that may benefit from optimized processing.
  ///
  /// When the number of light targets exceeds this value, certain operations
  /// may use optimized algorithms (e.g., pre-built device lookup maps).
  static const int largeTargetListThreshold = 50;

  // ---------------------------------------------------------------------------
  // Timing Constants
  // ---------------------------------------------------------------------------

  /// Settling window after a control change completes (ms).
  /// Used for brightness, hue, temperature, and white controls.
  static const int settlingWindowMs = 2000;

  /// Settling window for on/off state changes (ms).
  /// Longer than control settling to allow all devices to sync.
  static const int onOffSettlingWindowMs = 3000;

  /// Debounce delay for slider controls (ms).
  /// Prevents overwhelming the backend with rapid API calls.
  static const int sliderDebounceMs = 300;

  // ---------------------------------------------------------------------------
  // Tolerances & Thresholds
  // ---------------------------------------------------------------------------

  /// Tolerances for considering values "equal" across devices.
  static const double brightnessTolerance = 3.0;
  static const double hueTolerance = 5.0;
  static const double temperatureTolerance = 100.0;
  static const double whiteTolerance = 5.0;

  /// Thresholds for detecting "mixed" states across devices.
  static const int mixedThreshold = 10;
  static const int hueMixedThreshold = 20;
  static const int whiteMixedThreshold = 15;

  /// Threshold for determining on/off state from a double value (0.0-1.0).
  static const double onOffThreshold = 0.5;

  /// Value representing "on" state for control services.
  static const double onValue = 1.0;

  /// Value representing "off" state for control services.
  static const double offValue = 0.0;

  // ---------------------------------------------------------------------------
  // DomainControlStateService Channel IDs
  // ---------------------------------------------------------------------------

  /// Control channel ID for lighting mode (off/work/relax/night).
  static const String modeChannelId = 'mode';

  /// Control channel ID for brightness control.
  static const String brightnessChannelId = 'brightness';

  /// Control channel ID for hue/color control.
  static const String hueChannelId = 'hue';

  /// Control channel ID for color temperature control.
  static const String temperatureChannelId = 'temperature';

  /// Control channel ID for white channel control.
  static const String whiteChannelId = 'white';

  /// Control channel ID for on/off state control.
  static const String onOffChannelId = 'onOff';

  /// Settling window for mode changes (ms).
  /// Longer than control settling as mode changes may affect multiple devices.
  static const int modeSettlingWindowMs = 3000;

  /// Settling window for role toggle changes (ms).
  static const int roleToggleSettlingWindowMs = 2500;

  // ---------------------------------------------------------------------------
  // Role Toggle Channel IDs
  // ---------------------------------------------------------------------------

  /// Control channel ID for main role toggle.
  static const String roleMainChannelId = 'role_main';

  /// Control channel ID for task role toggle.
  static const String roleTaskChannelId = 'role_task';

  /// Control channel ID for ambient role toggle.
  static const String roleAmbientChannelId = 'role_ambient';

  /// Control channel ID for accent role toggle.
  static const String roleAccentChannelId = 'role_accent';

  /// Control channel ID for night role toggle.
  static const String roleNightChannelId = 'role_night';

  /// Control channel ID for other role toggle.
  static const String roleOtherChannelId = 'role_other';

  /// Get channel ID for a specific role.
  static String getRoleChannelId(LightTargetRole role) {
    switch (role) {
      case LightTargetRole.main:
        return roleMainChannelId;
      case LightTargetRole.task:
        return roleTaskChannelId;
      case LightTargetRole.ambient:
        return roleAmbientChannelId;
      case LightTargetRole.accent:
        return roleAccentChannelId;
      case LightTargetRole.night:
        return roleNightChannelId;
      case LightTargetRole.other:
        return roleOtherChannelId;
      case LightTargetRole.hidden:
        return 'role_hidden'; // Should not be used
    }
  }
}
