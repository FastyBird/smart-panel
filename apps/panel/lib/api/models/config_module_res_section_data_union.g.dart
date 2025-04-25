// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_res_section_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleResSectionDataUnionAudioImpl
    _$$ConfigModuleResSectionDataUnionAudioImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigModuleResSectionDataUnionAudioImpl(
          type: json['type'] == null
              ? ConfigModuleAudioType.audio
              : ConfigModuleAudioType.fromJson(json['type'] as String),
          speaker: json['speaker'] as bool? ?? false,
          speakerVolume: (json['speaker_volume'] as num?)?.toInt() ?? 0,
          microphone: json['microphone'] as bool? ?? false,
          microphoneVolume: (json['microphone_volume'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$ConfigModuleResSectionDataUnionAudioImplToJson(
        _$ConfigModuleResSectionDataUnionAudioImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleAudioTypeEnumMap[instance.type]!,
      'speaker': instance.speaker,
      'speaker_volume': instance.speakerVolume,
      'microphone': instance.microphone,
      'microphone_volume': instance.microphoneVolume,
    };

const _$ConfigModuleAudioTypeEnumMap = {
  ConfigModuleAudioType.audio: 'audio',
  ConfigModuleAudioType.$unknown: r'$unknown',
};

_$ConfigModuleResSectionDataUnionDisplayImpl
    _$$ConfigModuleResSectionDataUnionDisplayImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigModuleResSectionDataUnionDisplayImpl(
          type: json['type'] == null
              ? ConfigModuleDisplayType.display
              : ConfigModuleDisplayType.fromJson(json['type'] as String),
          darkMode: json['dark_mode'] as bool? ?? false,
          brightness: (json['brightness'] as num?)?.toInt() ?? 0,
          screenLockDuration:
              (json['screen_lock_duration'] as num?)?.toInt() ?? 30,
          screenSaver: json['screen_saver'] as bool? ?? true,
        );

Map<String, dynamic> _$$ConfigModuleResSectionDataUnionDisplayImplToJson(
        _$ConfigModuleResSectionDataUnionDisplayImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleDisplayTypeEnumMap[instance.type]!,
      'dark_mode': instance.darkMode,
      'brightness': instance.brightness,
      'screen_lock_duration': instance.screenLockDuration,
      'screen_saver': instance.screenSaver,
    };

const _$ConfigModuleDisplayTypeEnumMap = {
  ConfigModuleDisplayType.display: 'display',
  ConfigModuleDisplayType.$unknown: r'$unknown',
};

_$ConfigModuleResSectionDataUnionLanguageImpl
    _$$ConfigModuleResSectionDataUnionLanguageImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigModuleResSectionDataUnionLanguageImpl(
          type: json['type'] == null
              ? ConfigModuleLanguageType.language
              : ConfigModuleLanguageType.fromJson(json['type'] as String),
          language: json['language'] == null
              ? ConfigModuleLanguageLanguage.enUS
              : ConfigModuleLanguageLanguage.fromJson(
                  json['language'] as String),
          timezone: json['timezone'] as String? ?? 'Europe/Prague',
          timeFormat: json['time_format'] == null
              ? ConfigModuleLanguageTimeFormat.value24h
              : ConfigModuleLanguageTimeFormat.fromJson(
                  json['time_format'] as String),
        );

Map<String, dynamic> _$$ConfigModuleResSectionDataUnionLanguageImplToJson(
        _$ConfigModuleResSectionDataUnionLanguageImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleLanguageTypeEnumMap[instance.type]!,
      'language': _$ConfigModuleLanguageLanguageEnumMap[instance.language]!,
      'timezone': instance.timezone,
      'time_format':
          _$ConfigModuleLanguageTimeFormatEnumMap[instance.timeFormat]!,
    };

const _$ConfigModuleLanguageTypeEnumMap = {
  ConfigModuleLanguageType.language: 'language',
  ConfigModuleLanguageType.$unknown: r'$unknown',
};

const _$ConfigModuleLanguageLanguageEnumMap = {
  ConfigModuleLanguageLanguage.enUS: 'en_US',
  ConfigModuleLanguageLanguage.csCZ: 'cs_CZ',
  ConfigModuleLanguageLanguage.$unknown: r'$unknown',
};

const _$ConfigModuleLanguageTimeFormatEnumMap = {
  ConfigModuleLanguageTimeFormat.value12h: '12h',
  ConfigModuleLanguageTimeFormat.value24h: '24h',
  ConfigModuleLanguageTimeFormat.$unknown: r'$unknown',
};

_$ConfigModuleResSectionDataUnionWeatherImpl
    _$$ConfigModuleResSectionDataUnionWeatherImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigModuleResSectionDataUnionWeatherImpl(
          location: json['location'] as String?,
          openWeatherApiKey: json['open_weather_api_key'] as String?,
          type: json['type'] == null
              ? ConfigModuleWeatherType.weather
              : ConfigModuleWeatherType.fromJson(json['type'] as String),
          locationType: json['location_type'] == null
              ? ConfigModuleWeatherLocationType.cityName
              : ConfigModuleWeatherLocationType.fromJson(
                  json['location_type'] as String),
          unit: json['unit'] == null
              ? ConfigModuleWeatherUnit.celsius
              : ConfigModuleWeatherUnit.fromJson(json['unit'] as String),
        );

Map<String, dynamic> _$$ConfigModuleResSectionDataUnionWeatherImplToJson(
        _$ConfigModuleResSectionDataUnionWeatherImpl instance) =>
    <String, dynamic>{
      'location': instance.location,
      'open_weather_api_key': instance.openWeatherApiKey,
      'type': _$ConfigModuleWeatherTypeEnumMap[instance.type]!,
      'location_type':
          _$ConfigModuleWeatherLocationTypeEnumMap[instance.locationType]!,
      'unit': _$ConfigModuleWeatherUnitEnumMap[instance.unit]!,
    };

const _$ConfigModuleWeatherTypeEnumMap = {
  ConfigModuleWeatherType.weather: 'weather',
  ConfigModuleWeatherType.$unknown: r'$unknown',
};

const _$ConfigModuleWeatherLocationTypeEnumMap = {
  ConfigModuleWeatherLocationType.latLon: 'lat_lon',
  ConfigModuleWeatherLocationType.cityName: 'city_name',
  ConfigModuleWeatherLocationType.cityId: 'city_id',
  ConfigModuleWeatherLocationType.zipCode: 'zip_code',
  ConfigModuleWeatherLocationType.$unknown: r'$unknown',
};

const _$ConfigModuleWeatherUnitEnumMap = {
  ConfigModuleWeatherUnit.celsius: 'celsius',
  ConfigModuleWeatherUnit.fahrenheit: 'fahrenheit',
  ConfigModuleWeatherUnit.$unknown: r'$unknown',
};
