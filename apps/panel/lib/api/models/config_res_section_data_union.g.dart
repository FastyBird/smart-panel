// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_res_section_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigResSectionDataUnionAudioImpl
    _$$ConfigResSectionDataUnionAudioImplFromJson(Map<String, dynamic> json) =>
        _$ConfigResSectionDataUnionAudioImpl(
          type: json['type'] == null
              ? ConfigAudioType.audio
              : ConfigAudioType.fromJson(json['type'] as String),
          speaker: json['speaker'] as bool? ?? false,
          speakerVolume: (json['speaker_volume'] as num?)?.toInt() ?? 0,
          microphone: json['microphone'] as bool? ?? false,
          microphoneVolume: (json['microphone_volume'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$ConfigResSectionDataUnionAudioImplToJson(
        _$ConfigResSectionDataUnionAudioImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigAudioTypeEnumMap[instance.type]!,
      'speaker': instance.speaker,
      'speaker_volume': instance.speakerVolume,
      'microphone': instance.microphone,
      'microphone_volume': instance.microphoneVolume,
    };

const _$ConfigAudioTypeEnumMap = {
  ConfigAudioType.audio: 'audio',
  ConfigAudioType.$unknown: r'$unknown',
};

_$ConfigResSectionDataUnionDisplayImpl
    _$$ConfigResSectionDataUnionDisplayImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigResSectionDataUnionDisplayImpl(
          type: json['type'] == null
              ? ConfigDisplayType.display
              : ConfigDisplayType.fromJson(json['type'] as String),
          darkMode: json['dark_mode'] as bool? ?? false,
          brightness: (json['brightness'] as num?)?.toInt() ?? 0,
          screenLockDuration:
              (json['screen_lock_duration'] as num?)?.toInt() ?? 30,
          screenSaver: json['screen_saver'] as bool? ?? true,
        );

Map<String, dynamic> _$$ConfigResSectionDataUnionDisplayImplToJson(
        _$ConfigResSectionDataUnionDisplayImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigDisplayTypeEnumMap[instance.type]!,
      'dark_mode': instance.darkMode,
      'brightness': instance.brightness,
      'screen_lock_duration': instance.screenLockDuration,
      'screen_saver': instance.screenSaver,
    };

const _$ConfigDisplayTypeEnumMap = {
  ConfigDisplayType.display: 'display',
  ConfigDisplayType.$unknown: r'$unknown',
};

_$ConfigResSectionDataUnionLanguageImpl
    _$$ConfigResSectionDataUnionLanguageImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigResSectionDataUnionLanguageImpl(
          type: json['type'] == null
              ? ConfigLanguageType.language
              : ConfigLanguageType.fromJson(json['type'] as String),
          language: json['language'] == null
              ? ConfigLanguageLanguage.enUS
              : ConfigLanguageLanguage.fromJson(json['language'] as String),
          timezone: json['timezone'] as String? ?? 'Europe/Prague',
          timeFormat: json['time_format'] == null
              ? ConfigLanguageTimeFormat.value24h
              : ConfigLanguageTimeFormat.fromJson(
                  json['time_format'] as String),
        );

Map<String, dynamic> _$$ConfigResSectionDataUnionLanguageImplToJson(
        _$ConfigResSectionDataUnionLanguageImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigLanguageTypeEnumMap[instance.type]!,
      'language': _$ConfigLanguageLanguageEnumMap[instance.language]!,
      'timezone': instance.timezone,
      'time_format': _$ConfigLanguageTimeFormatEnumMap[instance.timeFormat]!,
    };

const _$ConfigLanguageTypeEnumMap = {
  ConfigLanguageType.language: 'language',
  ConfigLanguageType.$unknown: r'$unknown',
};

const _$ConfigLanguageLanguageEnumMap = {
  ConfigLanguageLanguage.enUS: 'en_US',
  ConfigLanguageLanguage.csCZ: 'cs_CZ',
  ConfigLanguageLanguage.$unknown: r'$unknown',
};

const _$ConfigLanguageTimeFormatEnumMap = {
  ConfigLanguageTimeFormat.value12h: '12h',
  ConfigLanguageTimeFormat.value24h: '24h',
  ConfigLanguageTimeFormat.$unknown: r'$unknown',
};

_$ConfigResSectionDataUnionWeatherImpl
    _$$ConfigResSectionDataUnionWeatherImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigResSectionDataUnionWeatherImpl(
          location: json['location'] as String?,
          openWeatherApiKey: json['open_weather_api_key'] as String?,
          type: json['type'] == null
              ? ConfigWeatherType.weather
              : ConfigWeatherType.fromJson(json['type'] as String),
          locationType: json['location_type'] == null
              ? ConfigWeatherLocationType.cityName
              : ConfigWeatherLocationType.fromJson(
                  json['location_type'] as String),
          unit: json['unit'] == null
              ? ConfigWeatherUnit.celsius
              : ConfigWeatherUnit.fromJson(json['unit'] as String),
        );

Map<String, dynamic> _$$ConfigResSectionDataUnionWeatherImplToJson(
        _$ConfigResSectionDataUnionWeatherImpl instance) =>
    <String, dynamic>{
      'location': instance.location,
      'open_weather_api_key': instance.openWeatherApiKey,
      'type': _$ConfigWeatherTypeEnumMap[instance.type]!,
      'location_type':
          _$ConfigWeatherLocationTypeEnumMap[instance.locationType]!,
      'unit': _$ConfigWeatherUnitEnumMap[instance.unit]!,
    };

const _$ConfigWeatherTypeEnumMap = {
  ConfigWeatherType.weather: 'weather',
  ConfigWeatherType.$unknown: r'$unknown',
};

const _$ConfigWeatherLocationTypeEnumMap = {
  ConfigWeatherLocationType.latLon: 'lat_lon',
  ConfigWeatherLocationType.cityName: 'city_name',
  ConfigWeatherLocationType.cityId: 'city_id',
  ConfigWeatherLocationType.zipCode: 'zip_code',
  ConfigWeatherLocationType.$unknown: r'$unknown',
};

const _$ConfigWeatherUnitEnumMap = {
  ConfigWeatherUnit.celsius: 'celsius',
  ConfigWeatherUnit.fahrenheit: 'fahrenheit',
  ConfigWeatherUnit.$unknown: r'$unknown',
};
