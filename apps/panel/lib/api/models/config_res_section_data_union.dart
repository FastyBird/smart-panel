// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_audio_type.dart';
import 'config_display_type.dart';
import 'config_language_language.dart';
import 'config_language_time_format.dart';
import 'config_language_type.dart';
import 'config_weather_location_type.dart';
import 'config_weather_type.dart';
import 'config_weather_unit.dart';

part 'config_res_section_data_union.freezed.dart';
part 'config_res_section_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class ConfigResSectionDataUnion with _$ConfigResSectionDataUnion {
  @FreezedUnionValue('audio')
  const factory ConfigResSectionDataUnion.audio({
    /// Configuration section type
    @Default(ConfigAudioType.audio)
    ConfigAudioType type,

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
  }) = ConfigResSectionDataUnionAudio;

  @FreezedUnionValue('display')
  const factory ConfigResSectionDataUnion.display({
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
  }) = ConfigResSectionDataUnionDisplay;

  @FreezedUnionValue('language')
  const factory ConfigResSectionDataUnion.language({
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
  }) = ConfigResSectionDataUnionLanguage;

  @FreezedUnionValue('weather')
  const factory ConfigResSectionDataUnion.weather({
    /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
    required String? location,

    /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
    @JsonKey(name: 'open_weather_api_key')
    required String? openWeatherApiKey,

    /// Configuration section type
    @Default(ConfigWeatherType.weather)
    ConfigWeatherType type,

    /// Specifies the method used to determine the location for weather updates.
    @JsonKey(name: 'location_type')
    @Default(ConfigWeatherLocationType.cityName)
    ConfigWeatherLocationType locationType,

    /// Defines the temperature unit for weather data.
    @Default(ConfigWeatherUnit.celsius)
    ConfigWeatherUnit unit,
  }) = ConfigResSectionDataUnionWeather;

  
  factory ConfigResSectionDataUnion.fromJson(Map<String, Object?> json) => _$ConfigResSectionDataUnionFromJson(json);
}
