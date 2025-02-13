// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_display_type.dart';

part 'config_display.freezed.dart';
part 'config_display.g.dart';

/// Schema for display configuration, including brightness, dark mode, and screen lock behavior.
@Freezed()
class ConfigDisplay with _$ConfigDisplay {
  const factory ConfigDisplay({
    /// Configuration section type
    @Default(ConfigDisplayType.display)
    ConfigDisplayType type,

    /// Enables dark mode for the display.
    @JsonKey(name: 'dark_mode')
    @Default(false)
    bool darkMode,

    /// Sets the brightness level of the display (0-100).
    @Default(0)
    int brightness,

    /// Time in seconds before the screen automatically locks.
    @JsonKey(name: 'screen_lock_duration')
    @Default(30)
    int screenLockDuration,

    /// Enables the screen saver when the device is idle. Value is in seconds.
    @JsonKey(name: 'screen_saver')
    @Default(true)
    bool screenSaver,
  }) = _ConfigDisplay;
  
  factory ConfigDisplay.fromJson(Map<String, Object?> json) => _$ConfigDisplayFromJson(json);
}
