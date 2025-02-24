// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_update_audio_type.dart';
import 'config_update_display_type.dart';
import 'config_update_language_language.dart';
import 'config_update_language_time_format.dart';
import 'config_update_language_type.dart';
import 'config_update_weather_location_type.dart';
import 'config_update_weather_type.dart';
import 'config_update_weather_unit.dart';

part 'config_req_update_section_data_union.freezed.dart';
part 'config_req_update_section_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class ConfigReqUpdateSectionDataUnion with _$ConfigReqUpdateSectionDataUnion {
  @FreezedUnionValue('audio')
  const factory ConfigReqUpdateSectionDataUnion.audio({
    /// Configuration section type
    required ConfigUpdateAudioType type,

    /// Enables or disables the speaker.
    required bool speaker,

    /// Sets the speaker volume (0-100).
    @JsonKey(name: 'speaker_volume')
    required int speakerVolume,

    /// Enables or disables the microphone.
    required bool microphone,

    /// Sets the microphone volume (0-100).
    @JsonKey(name: 'microphone_volume')
    required int microphoneVolume,
  }) = ConfigReqUpdateSectionDataUnionAudio;

  @FreezedUnionValue('display')
  const factory ConfigReqUpdateSectionDataUnion.display({
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
  }) = ConfigReqUpdateSectionDataUnionDisplay;

  @FreezedUnionValue('language')
  const factory ConfigReqUpdateSectionDataUnion.language({
    /// Configuration section type
    required ConfigUpdateLanguageType type,

    /// Defines the language and region format.
    required ConfigUpdateLanguageLanguage language,

    /// Defines the time zone using the IANA time zone format.
    required String timezone,

    /// Sets the time format (12-hour or 24-hour).
    @JsonKey(name: 'time_format')
    required ConfigUpdateLanguageTimeFormat timeFormat,
  }) = ConfigReqUpdateSectionDataUnionLanguage;

  @FreezedUnionValue('weather')
  const factory ConfigReqUpdateSectionDataUnion.weather({
    /// Configuration section type
    required ConfigUpdateWeatherType type,

    /// Specifies the method used to determine the location for weather updates.
    @JsonKey(name: 'location_type')
    required ConfigUpdateWeatherLocationType locationType,

    /// Defines the temperature unit for weather data.
    required ConfigUpdateWeatherUnit unit,

    /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
    String? location,

    /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
    @JsonKey(name: 'open_weather_api_key')
    String? openWeatherApiKey,
  }) = ConfigReqUpdateSectionDataUnionWeather;

  
  factory ConfigReqUpdateSectionDataUnion.fromJson(Map<String, Object?> json) => _$ConfigReqUpdateSectionDataUnionFromJson(json);
}
