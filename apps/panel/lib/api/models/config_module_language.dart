// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_module_language_language.dart';
import 'config_module_language_time_format.dart';
import 'config_module_language_type.dart';

part 'config_module_language.freezed.dart';
part 'config_module_language.g.dart';

/// Schema for language configuration, time zone, and time format on the smart panel.
@Freezed()
class ConfigModuleLanguage with _$ConfigModuleLanguage {
  const factory ConfigModuleLanguage({
    /// Configuration section type
    @Default(ConfigModuleLanguageType.language)
    ConfigModuleLanguageType type,

    /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
    @Default(ConfigModuleLanguageLanguage.enUS)
    ConfigModuleLanguageLanguage language,

    /// Sets the time format for displaying time on the panel.
    @Default('Europe/Prague')
    String timezone,

    /// Defines the time zone of the smart panel. Uses the IANA time zone format.
    @JsonKey(name: 'time_format')
    @Default(ConfigModuleLanguageTimeFormat.value24h)
    ConfigModuleLanguageTimeFormat timeFormat,
  }) = _ConfigModuleLanguage;
  
  factory ConfigModuleLanguage.fromJson(Map<String, Object?> json) => _$ConfigModuleLanguageFromJson(json);
}
