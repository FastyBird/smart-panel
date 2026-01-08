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

  /// Settling window after a control change completes (ms).
  /// Used for brightness, hue, temperature, and white controls.
  static const int settlingWindowMs = 2000;

  /// Settling window for on/off state changes (ms).
  /// Longer than control settling to allow all devices to sync.
  static const int onOffSettlingWindowMs = 3000;

  /// Debounce delay for slider controls (ms).
  /// Prevents overwhelming the backend with rapid API calls.
  static const int sliderDebounceMs = 300;

  /// Tolerances for considering values "equal" across devices.
  static const double brightnessTolerance = 3.0;
  static const double hueTolerance = 5.0;
  static const double temperatureTolerance = 100.0;
  static const double whiteTolerance = 5.0;

  /// Threshold for detecting "mixed" states across devices.
  static const int mixedThreshold = 10;
}
