// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_module_audio_type.dart';
import 'config_module_display_type.dart';
import 'config_module_language_language.dart';
import 'config_module_language_time_format.dart';
import 'config_module_language_type.dart';
import 'config_module_weather_location_type.dart';
import 'config_module_weather_type.dart';
import 'config_module_weather_unit.dart';

part 'config_module_res_section_data_union.freezed.dart';
part 'config_module_res_section_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class ConfigModuleResSectionDataUnion with _$ConfigModuleResSectionDataUnion {
  @FreezedUnionValue('audio')
  const factory ConfigModuleResSectionDataUnion.audio({
    /// Configuration section type
    @Default(ConfigModuleAudioType.audio)
    ConfigModuleAudioType type,

    /// Indicates whether the speaker is enabled.
    @Default(false)
    bool speaker,

    /// The volume level of the speaker, ranging from 0 to 100.
    @JsonKey(name: 'speaker_volume')
    @Default(0)
    int speakerVolume,

    /// Indicates whether the microphone is enabled.
    @Default(false)
    bool microphone,

    /// The volume level of the microphone, ranging from 0 to 100.
    @JsonKey(name: 'microphone_volume')
    @Default(0)
    int microphoneVolume,
  }) = ConfigModuleResSectionDataUnionAudio;

  @FreezedUnionValue('display')
  const factory ConfigModuleResSectionDataUnion.display({
    /// Configuration section type
    @Default(ConfigModuleDisplayType.display)
    ConfigModuleDisplayType type,

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
  }) = ConfigModuleResSectionDataUnionDisplay;

  @FreezedUnionValue('language')
  const factory ConfigModuleResSectionDataUnion.language({
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
  }) = ConfigModuleResSectionDataUnionLanguage;

  @FreezedUnionValue('weather')
  const factory ConfigModuleResSectionDataUnion.weather({
    /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
    required String? location,

    /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
    @JsonKey(name: 'open_weather_api_key')
    required String? openWeatherApiKey,

    /// Configuration section type
    @Default(ConfigModuleWeatherType.weather)
    ConfigModuleWeatherType type,

    /// Specifies the method used to determine the location for weather updates.
    @JsonKey(name: 'location_type')
    @Default(ConfigModuleWeatherLocationType.cityName)
    ConfigModuleWeatherLocationType locationType,

    /// Defines the temperature unit for weather data.
    @Default(ConfigModuleWeatherUnit.celsius)
    ConfigModuleWeatherUnit unit,
  }) = ConfigModuleResSectionDataUnionWeather;

  
  factory ConfigModuleResSectionDataUnion.fromJson(Map<String, Object?> json) => _$ConfigModuleResSectionDataUnionFromJson(json);
}
