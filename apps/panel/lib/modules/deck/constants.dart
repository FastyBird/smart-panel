/// Module name identifier.
const String kDeckModuleName = 'deck';

/// Lighting domain constants for behavior and thresholds.
class LightingConstants {
  LightingConstants._();

  /// Settling window after an intent completes (ms).
  static const int settlingWindowMs = 2000;

  /// Tolerances for considering values "equal" across devices.
  static const double brightnessTolerance = 3.0;
  static const double hueTolerance = 5.0;
  static const double temperatureTolerance = 100.0;
  static const double whiteTolerance = 5.0;

  /// Threshold for detecting "mixed" states across devices.
  static const int mixedThreshold = 10;
}
