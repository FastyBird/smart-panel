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
}
