// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_language_language.dart';
import 'config_language_time_format.dart';
import 'config_language_type.dart';

part 'config_language.freezed.dart';
part 'config_language.g.dart';

/// Schema for language configuration, time zone, and time format on the smart panel.
@Freezed()
class ConfigLanguage with _$ConfigLanguage {
  const factory ConfigLanguage({
    /// Configuration section type
    @Default(ConfigLanguageType.language)
    ConfigLanguageType type,

    /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
    @Default(ConfigLanguageLanguage.enUS)
    ConfigLanguageLanguage language,

    /// Sets the time format for displaying time on the panel.
    @Default('Europe/Prague')
    String timezone,

    /// Defines the time zone of the smart panel. Uses the IANA time zone format.
    @JsonKey(name: 'time_format')
    @Default(ConfigLanguageTimeFormat.value24h)
    ConfigLanguageTimeFormat timeFormat,
  }) = _ConfigLanguage;
  
  factory ConfigLanguage.fromJson(Map<String, Object?> json) => _$ConfigLanguageFromJson(json);
}
