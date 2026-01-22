import 'package:fastybird_smart_panel/modules/spaces/models/covers_state/covers_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';

/// Types of lighting intents that can be executed on a space.
///
/// Each type corresponds to a specific lighting action:
/// - [off]/[on]: Turn all lights off/on
/// - [setMode]: Apply a predefined lighting mode (work, relax, night)
/// - [brightnessDelta]: Adjust brightness by a relative amount
/// - [roleOn]/[roleOff]: Control lights by their role (main, task, ambient, etc.)
/// - [roleBrightness]/[roleColor]/[roleColorTemp]/[roleWhite]: Set specific values for a role
/// - [roleSet]: Set multiple properties for a role at once
enum LightingIntentType {
  off,
  on,
  setMode,
  brightnessDelta,
  roleOn,
  roleOff,
  roleBrightness,
  roleColor,
  roleColorTemp,
  roleWhite,
  roleSet,
}

/// Size of brightness adjustment for delta-based changes.
///
/// - [small]: Minor adjustment (e.g., 10%)
/// - [medium]: Moderate adjustment (e.g., 25%)
/// - [large]: Significant adjustment (e.g., 50%)
enum BrightnessDelta {
  small,
  medium,
  large,
}

/// Types of climate intents that can be executed on a space.
///
/// Each type corresponds to a specific climate action:
/// - [setpointDelta]: Adjust temperature setpoint by a relative amount
/// - [setpointSet]: Set temperature setpoint to an absolute value
/// - [setMode]: Change HVAC mode (heat, cool, auto, off)
/// - [climateSet]: Set multiple climate properties at once
enum ClimateIntentType {
  setpointDelta,
  setpointSet,
  setMode,
  climateSet,
}

/// Size of setpoint adjustment for delta-based temperature changes.
///
/// - [small]: Minor adjustment (e.g., 0.5°C)
/// - [medium]: Moderate adjustment (e.g., 1°C)
/// - [large]: Significant adjustment (e.g., 2°C)
enum SetpointDelta {
  small,
  medium,
  large,
}

/// Types of media intents that can be executed on a space.
///
/// - [powerOn]/[powerOff]: Control power for all media devices
/// - [volumeSet]/[volumeDelta]: Set or adjust volume across devices
/// - [mute]/[unmute]: Toggle mute state
/// - [rolePower]/[roleVolume]: Control specific media roles
/// - [play]/[pause]/[stop]/[next]/[previous]: Playback intents
/// - [inputSet]: Change input/source
/// - [setMode]: Apply preset media mode (off/background/focused/party)
enum MediaIntentType {
  powerOn,
  powerOff,
  volumeSet,
  volumeDelta,
  mute,
  unmute,
  rolePower,
  roleVolume,
  play,
  pause,
  stop,
  next,
  previous,
  inputSet,
  setMode,
}

/// Size of volume adjustment for delta-based changes.
enum VolumeDelta {
  small,
  medium,
  large,
}

/// Types of covers intents that can be executed on a space.
///
/// Each type corresponds to a specific covers action:
/// - [open]: Open all covers
/// - [close]: Close all covers
/// - [setPosition]: Set covers to a specific position (0-100)
/// - [positionDelta]: Adjust position by a relative amount
/// - [rolePosition]: Set position for covers with a specific role
/// - [setMode]: Set covers mode (e.g., normal, privacy)
enum CoversIntentType {
  open,
  close,
  setPosition,
  positionDelta,
  rolePosition,
  setMode,
}

/// Size of position adjustment for delta-based covers changes.
///
/// - [small]: Minor adjustment (e.g., 10%)
/// - [medium]: Moderate adjustment (e.g., 25%)
/// - [large]: Significant adjustment (e.g., 50%)
enum PositionDelta {
  small,
  medium,
  large,
}

/// Convert LightingIntentType to API string
String lightingIntentTypeToString(LightingIntentType type) {
  switch (type) {
    case LightingIntentType.off:
      return 'off';
    case LightingIntentType.on:
      return 'on';
    case LightingIntentType.setMode:
      return 'set_mode';
    case LightingIntentType.brightnessDelta:
      return 'brightness_delta';
    case LightingIntentType.roleOn:
      return 'role_on';
    case LightingIntentType.roleOff:
      return 'role_off';
    case LightingIntentType.roleBrightness:
      return 'role_brightness';
    case LightingIntentType.roleColor:
      return 'role_color';
    case LightingIntentType.roleColorTemp:
      return 'role_color_temp';
    case LightingIntentType.roleWhite:
      return 'role_white';
    case LightingIntentType.roleSet:
      return 'role_set';
  }
}

/// Convert BrightnessDelta to API string
String brightnessDeltaToString(BrightnessDelta delta) {
  switch (delta) {
    case BrightnessDelta.small:
      return 'small';
    case BrightnessDelta.medium:
      return 'medium';
    case BrightnessDelta.large:
      return 'large';
  }
}

/// Convert ClimateIntentType to API string
String climateIntentTypeToString(ClimateIntentType type) {
  switch (type) {
    case ClimateIntentType.setpointDelta:
      return 'setpoint_delta';
    case ClimateIntentType.setpointSet:
      return 'setpoint_set';
    case ClimateIntentType.setMode:
      return 'set_mode';
    case ClimateIntentType.climateSet:
      return 'climate_set';
  }
}

/// Convert SetpointDelta to API string
String setpointDeltaToString(SetpointDelta delta) {
  switch (delta) {
    case SetpointDelta.small:
      return 'small';
    case SetpointDelta.medium:
      return 'medium';
    case SetpointDelta.large:
      return 'large';
  }
}

/// Convert MediaIntentType to API string
String mediaIntentTypeToString(MediaIntentType type) {
  switch (type) {
    case MediaIntentType.powerOn:
      return 'power_on';
    case MediaIntentType.powerOff:
      return 'power_off';
    case MediaIntentType.volumeSet:
      return 'volume_set';
    case MediaIntentType.volumeDelta:
      return 'volume_delta';
    case MediaIntentType.mute:
      return 'mute';
    case MediaIntentType.unmute:
      return 'unmute';
    case MediaIntentType.rolePower:
      return 'role_power';
    case MediaIntentType.roleVolume:
      return 'role_volume';
    case MediaIntentType.play:
      return 'play';
    case MediaIntentType.pause:
      return 'pause';
    case MediaIntentType.stop:
      return 'stop';
    case MediaIntentType.next:
      return 'next';
    case MediaIntentType.previous:
      return 'previous';
    case MediaIntentType.inputSet:
      return 'input_set';
    case MediaIntentType.setMode:
      return 'set_mode';
  }
}

/// Convert VolumeDelta to API string
String volumeDeltaToString(VolumeDelta delta) {
  switch (delta) {
    case VolumeDelta.small:
      return 'small';
    case VolumeDelta.medium:
      return 'medium';
    case VolumeDelta.large:
      return 'large';
  }
}

/// Convert LightingMode to API string
String lightingModeToString(LightingMode mode) {
  switch (mode) {
    case LightingMode.work:
      return 'work';
    case LightingMode.relax:
      return 'relax';
    case LightingMode.night:
      return 'night';
  }
}

/// Convert LightingStateRole to API string
String lightingRoleToString(LightingStateRole role) {
  switch (role) {
    case LightingStateRole.main:
      return 'main';
    case LightingStateRole.task:
      return 'task';
    case LightingStateRole.ambient:
      return 'ambient';
    case LightingStateRole.accent:
      return 'accent';
    case LightingStateRole.night:
      return 'night';
    case LightingStateRole.other:
      return 'other';
  }
}

/// Convert CoversIntentType to API string
String coversIntentTypeToString(CoversIntentType type) {
  switch (type) {
    case CoversIntentType.open:
      return 'open';
    case CoversIntentType.close:
      return 'close';
    case CoversIntentType.setPosition:
      return 'set_position';
    case CoversIntentType.positionDelta:
      return 'position_delta';
    case CoversIntentType.rolePosition:
      return 'role_position';
    case CoversIntentType.setMode:
      return 'set_mode';
  }
}

/// Convert PositionDelta to API string
String positionDeltaToString(PositionDelta delta) {
  switch (delta) {
    case PositionDelta.small:
      return 'small';
    case PositionDelta.medium:
      return 'medium';
    case PositionDelta.large:
      return 'large';
  }
}

/// Convert CoversStateRole to API string
String coversRoleToString(CoversStateRole role) {
  switch (role) {
    case CoversStateRole.primary:
      return 'primary';
    case CoversStateRole.blackout:
      return 'blackout';
    case CoversStateRole.sheer:
      return 'sheer';
    case CoversStateRole.outdoor:
      return 'outdoor';
    case CoversStateRole.hidden:
      return 'hidden';
  }
}
