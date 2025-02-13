// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_update_display_type.dart';

part 'config_update_display.freezed.dart';
part 'config_update_display.g.dart';

/// Schema for partial update settings for display configuration, allowing changes to brightness, dark mode, and screen lock duration.
@Freezed()
class ConfigUpdateDisplay with _$ConfigUpdateDisplay {
  const factory ConfigUpdateDisplay({
    /// Configuration section type
    required ConfigUpdateDisplayType type,

    /// Enables or disables dark mode.
    @JsonKey(name: 'dark_mode')
    required bool darkMode,

    /// Sets the brightness level (0-100).
    required int brightness,

    /// Time in seconds before the screen automatically locks.
    @JsonKey(name: 'screen_lock_duration')
    required int screenLockDuration,

    /// Enables or disables the screen saver.
    @JsonKey(name: 'screen_saver')
    required bool screenSaver,
  }) = _ConfigUpdateDisplay;
  
  factory ConfigUpdateDisplay.fromJson(Map<String, Object?> json) => _$ConfigUpdateDisplayFromJson(json);
}
