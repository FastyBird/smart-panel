part of lights_domain_view;

// ============================================================================
// Role UI State Machine + small supporting models
// ============================================================================

/// UI states for role-level aggregated controls
enum RoleUIState {
  /// Normal state - showing actual device values
  idle,

  /// User has initiated action, waiting for intent to be created/completed
  pending,

  /// Intent completed, waiting for devices to converge (settling window)
  settling,

  /// Settling window expired but devices have not converged
  mixed,

  /// Error state (optional, for future use)
  error,
}

/// Control state for a single control type (brightness, hue, temperature, white)
class RoleControlState {
  /// Current UI state
  final RoleUIState state;

  /// The value the user set (persists through PENDING, SETTLING, MIXED)
  final double? desiredValue;

  /// Settling timer (active during SETTLING state)
  final Timer? settlingTimer;

  /// Timestamp when settling started
  final DateTime? settlingStartedAt;

  const RoleControlState({
    this.state = RoleUIState.idle,
    this.desiredValue,
    this.settlingTimer,
    this.settlingStartedAt,
  });

  /// Create a copy with updated fields
  RoleControlState copyWith({
    RoleUIState? state,
    double? desiredValue,
    Timer? settlingTimer,
    DateTime? settlingStartedAt,
    bool clearDesiredValue = false,
    bool clearSettlingTimer = false,
    bool clearSettlingStartedAt = false,
  }) {
    return RoleControlState(
      state: state ?? this.state,
      desiredValue: clearDesiredValue ? null : (desiredValue ?? this.desiredValue),
      settlingTimer: clearSettlingTimer ? null : (settlingTimer ?? this.settlingTimer),
      settlingStartedAt: clearSettlingStartedAt ? null : (settlingStartedAt ?? this.settlingStartedAt),
    );
  }

  /// Whether the control is in a "locked" state where we show desired value
  bool get isLocked => state == RoleUIState.pending || state == RoleUIState.settling || state == RoleUIState.mixed;

  /// Whether we're actively waiting for devices to sync
  bool get isSettling => state == RoleUIState.settling;

  /// Whether devices are in mixed state
  bool get isMixed => state == RoleUIState.mixed;

  /// Cancel any active timer
  void cancelTimer() {
    settlingTimer?.cancel();
  }
}

/// Result of checking if a role's devices are synced or mixed
class RoleMixedState {
  /// True if on/off states differ across devices
  final bool onStateMixed;

  /// True if brightness values differ (among brightness-capable ON devices)
  final bool brightnessMixed;

  /// True if hue values differ (among color-capable ON devices)
  final bool hueMixed;

  /// True if temperature values differ (among temp-capable ON devices)
  final bool temperatureMixed;

  /// True if white values differ (among white-capable ON devices)
  final bool whiteMixed;

  /// Number of devices that are ON
  final int onCount;

  /// Number of devices that are OFF
  final int offCount;

  /// Min/max brightness among ON devices with brightness
  final int? minBrightness;
  final int? maxBrightness;

  /// Min/max hue among ON devices with color
  final double? minHue;
  final double? maxHue;

  /// Min/max temperature among ON devices with temp
  final double? minTemperature;
  final double? maxTemperature;

  /// Min/max white among ON devices with white
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

  /// True if ANY aspect is mixed (role is not synced)
  bool get isMixed => onStateMixed || brightnessMixed || hueMixed || temperatureMixed || whiteMixed;

  /// True if all devices are synced
  bool get isSynced => !isMixed;

  /// True if all devices are ON
  bool get allOn => offCount == 0 && onCount > 0;

  /// True if all devices are OFF
  bool get allOff => onCount == 0 && offCount > 0;

  /// True if at least one device is ON
  bool get anyOn => onCount > 0;
}

/// Role group data for displaying in tiles
class _RoleGroup {
  final LightTargetRole role;
  final List<LightTargetView> targets;
  final int onCount;
  final int totalCount;
  final bool hasBrightness;
  /// First ON device's brightness (or first device's if all off)
  final int? brightness;

  _RoleGroup({
    required this.role,
    required this.targets,
    required this.onCount,
    required this.totalCount,
    required this.hasBrightness,
    this.brightness,
  });

  bool get isOn => onCount > 0;
}

enum _LightRoleMode {
  off,
  brightness,
  color,
  temperature,
  white,
}

