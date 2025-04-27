// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_module_audio.dart';
import 'config_module_display.dart';
import 'config_module_language.dart';
import 'config_module_plugin.dart';
import 'config_module_weather.dart';

part 'config_module_app.freezed.dart';
part 'config_module_app.g.dart';

/// Schema for the complete configuration settings for the smart panel, including audio, display, language, and weather settings.
@Freezed()
class ConfigModuleApp with _$ConfigModuleApp {
  const factory ConfigModuleApp({
    /// Audio configuration settings, including speaker and microphone options.
    required ConfigModuleAudio audio,

    /// Display settings, including brightness, dark mode, and screen lock duration.
    required ConfigModuleDisplay display,

    /// Language and localization settings, including time zone and time format.
    required ConfigModuleLanguage language,

    /// Weather settings, including location, unit preferences, and API integration.
    required ConfigModuleWeather weather,
    required List<ConfigModulePlugin> plugins,
  }) = _ConfigModuleApp;
  
  factory ConfigModuleApp.fromJson(Map<String, Object?> json) => _$ConfigModuleAppFromJson(json);
}
