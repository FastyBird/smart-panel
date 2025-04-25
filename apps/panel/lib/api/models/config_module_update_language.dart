// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_module_update_language_language.dart';
import 'config_module_update_language_time_format.dart';
import 'config_module_update_language_type.dart';

part 'config_module_update_language.freezed.dart';
part 'config_module_update_language.g.dart';

/// Schema for partial update settings for language and localization configuration.
@Freezed()
class ConfigModuleUpdateLanguage with _$ConfigModuleUpdateLanguage {
  const factory ConfigModuleUpdateLanguage({
    /// Configuration section type
    required ConfigModuleUpdateLanguageType type,

    /// Defines the language and region format.
    required ConfigModuleUpdateLanguageLanguage language,

    /// Defines the time zone using the IANA time zone format.
    required String timezone,

    /// Sets the time format (12-hour or 24-hour).
    @JsonKey(name: 'time_format')
    required ConfigModuleUpdateLanguageTimeFormat timeFormat,
  }) = _ConfigModuleUpdateLanguage;
  
  factory ConfigModuleUpdateLanguage.fromJson(Map<String, Object?> json) => _$ConfigModuleUpdateLanguageFromJson(json);
}
