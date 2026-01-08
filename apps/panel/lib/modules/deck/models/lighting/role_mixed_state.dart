/// Result of checking if a role's devices are synced or mixed.
class RoleMixedState {
  /// True if on/off states differ across devices.
  final bool onStateMixed;

  /// True if brightness values differ (among brightness-capable ON devices).
  final bool brightnessMixed;

  /// True if hue values differ (among color-capable ON devices).
  final bool hueMixed;

  /// True if temperature values differ (among temp-capable ON devices).
  final bool temperatureMixed;

  /// True if white values differ (among white-capable ON devices).
  final bool whiteMixed;

  /// Number of devices that are ON.
  final int onCount;

  /// Number of devices that are OFF.
  final int offCount;

  /// Min/max brightness among ON devices with brightness.
  final int? minBrightness;
  final int? maxBrightness;

  /// Min/max hue among ON devices with color.
  final double? minHue;
  final double? maxHue;

  /// Min/max temperature among ON devices with temp.
  final double? minTemperature;
  final double? maxTemperature;

  /// Min/max white among ON devices with white.
  final int? minWhite;
  final int? maxWhite;

  const RoleMixedState({
    this.onStateMixed = false,
    this.brightnessMixed = false,
    this.hueMixed = false,
    this.temperatureMixed = false,
    this.whiteMixed = false,
    this.onCount = 0,
    this.offCount = 0,
    this.minBrightness,
    this.maxBrightness,
    this.minHue,
    this.maxHue,
    this.minTemperature,
    this.maxTemperature,
    this.minWhite,
    this.maxWhite,
  });

  /// True if ANY aspect is mixed (role is not synced).
  bool get isMixed =>
      onStateMixed ||
      brightnessMixed ||
      hueMixed ||
      temperatureMixed ||
      whiteMixed;

  /// True if all devices are synced.
  bool get isSynced => !isMixed;

  /// True if all devices are ON.
  bool get allOn => offCount == 0 && onCount > 0;

  /// True if all devices are OFF.
  bool get allOff => onCount == 0 && offCount > 0;

  /// True if at least one device is ON.
  bool get anyOn => onCount > 0;
}
