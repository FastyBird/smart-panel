// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_audio.dart';
import 'config_display.dart';
import 'config_language.dart';
import 'config_weather.dart';

part 'config_app.freezed.dart';
part 'config_app.g.dart';

/// Schema for the complete configuration settings for the smart panel, including audio, display, language, and weather settings.
@Freezed()
class ConfigApp with _$ConfigApp {
  const factory ConfigApp({
    /// Audio configuration settings, including speaker and microphone options.
    required ConfigAudio audio,

    /// Display settings, including brightness, dark mode, and screen lock duration.
    required ConfigDisplay display,

    /// Language and localization settings, including time zone and time format.
    required ConfigLanguage language,

    /// Weather settings, including location, unit preferences, and API integration.
    required ConfigWeather weather,
  }) = _ConfigApp;
  
  factory ConfigApp.fromJson(Map<String, Object?> json) => _$ConfigAppFromJson(json);
}
