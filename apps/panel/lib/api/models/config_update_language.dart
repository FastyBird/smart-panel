// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_update_language_language.dart';
import 'config_update_language_time_format.dart';
import 'config_update_language_type.dart';

part 'config_update_language.freezed.dart';
part 'config_update_language.g.dart';

/// Schema for partial update settings for language and localization configuration.
@Freezed()
class ConfigUpdateLanguage with _$ConfigUpdateLanguage {
  const factory ConfigUpdateLanguage({
    /// Configuration section type
    required ConfigUpdateLanguageType type,

    /// Defines the language and region format.
    required ConfigUpdateLanguageLanguage language,

    /// Defines the time zone using the IANA time zone format.
    required String timezone,

    /// Sets the time format (12-hour or 24-hour).
    @JsonKey(name: 'time_format')
    required ConfigUpdateLanguageTimeFormat timeFormat,
  }) = _ConfigUpdateLanguage;
  
  factory ConfigUpdateLanguage.fromJson(Map<String, Object?> json) => _$ConfigUpdateLanguageFromJson(json);
}
