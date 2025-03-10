// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_req_update_section_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigReqUpdateSectionDataUnionAudioImpl
    _$$ConfigReqUpdateSectionDataUnionAudioImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigReqUpdateSectionDataUnionAudioImpl(
          type: ConfigUpdateAudioType.fromJson(json['type'] as String),
          speaker: json['speaker'] as bool,
          speakerVolume: (json['speaker_volume'] as num).toInt(),
          microphone: json['microphone'] as bool,
          microphoneVolume: (json['microphone_volume'] as num).toInt(),
        );

Map<String, dynamic> _$$ConfigReqUpdateSectionDataUnionAudioImplToJson(
        _$ConfigReqUpdateSectionDataUnionAudioImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigUpdateAudioTypeEnumMap[instance.type]!,
      'speaker': instance.speaker,
      'speaker_volume': instance.speakerVolume,
      'microphone': instance.microphone,
      'microphone_volume': instance.microphoneVolume,
    };

const _$ConfigUpdateAudioTypeEnumMap = {
  ConfigUpdateAudioType.audio: 'audio',
  ConfigUpdateAudioType.$unknown: r'$unknown',
};

_$ConfigReqUpdateSectionDataUnionDisplayImpl
    _$$ConfigReqUpdateSectionDataUnionDisplayImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigReqUpdateSectionDataUnionDisplayImpl(
          type: ConfigUpdateDisplayType.fromJson(json['type'] as String),
          darkMode: json['dark_mode'] as bool,
          brightness: (json['brightness'] as num).toInt(),
          screenLockDuration: (json['screen_lock_duration'] as num).toInt(),
          screenSaver: json['screen_saver'] as bool,
        );

Map<String, dynamic> _$$ConfigReqUpdateSectionDataUnionDisplayImplToJson(
        _$ConfigReqUpdateSectionDataUnionDisplayImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigUpdateDisplayTypeEnumMap[instance.type]!,
      'dark_mode': instance.darkMode,
      'brightness': instance.brightness,
      'screen_lock_duration': instance.screenLockDuration,
      'screen_saver': instance.screenSaver,
    };

const _$ConfigUpdateDisplayTypeEnumMap = {
  ConfigUpdateDisplayType.display: 'display',
  ConfigUpdateDisplayType.$unknown: r'$unknown',
};

_$ConfigReqUpdateSectionDataUnionLanguageImpl
    _$$ConfigReqUpdateSectionDataUnionLanguageImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigReqUpdateSectionDataUnionLanguageImpl(
          type: ConfigUpdateLanguageType.fromJson(json['type'] as String),
          language:
              ConfigUpdateLanguageLanguage.fromJson(json['language'] as String),
          timezone: json['timezone'] as String,
          timeFormat: ConfigUpdateLanguageTimeFormat.fromJson(
              json['time_format'] as String),
        );

Map<String, dynamic> _$$ConfigReqUpdateSectionDataUnionLanguageImplToJson(
        _$ConfigReqUpdateSectionDataUnionLanguageImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigUpdateLanguageTypeEnumMap[instance.type]!,
      'language': _$ConfigUpdateLanguageLanguageEnumMap[instance.language]!,
      'timezone': instance.timezone,
      'time_format':
          _$ConfigUpdateLanguageTimeFormatEnumMap[instance.timeFormat]!,
    };

const _$ConfigUpdateLanguageTypeEnumMap = {
  ConfigUpdateLanguageType.language: 'language',
  ConfigUpdateLanguageType.$unknown: r'$unknown',
};

const _$ConfigUpdateLanguageLanguageEnumMap = {
  ConfigUpdateLanguageLanguage.enUS: 'en_US',
  ConfigUpdateLanguageLanguage.csCZ: 'cs_CZ',
  ConfigUpdateLanguageLanguage.$unknown: r'$unknown',
};

const _$ConfigUpdateLanguageTimeFormatEnumMap = {
  ConfigUpdateLanguageTimeFormat.value12h: '12h',
  ConfigUpdateLanguageTimeFormat.value24h: '24h',
  ConfigUpdateLanguageTimeFormat.$unknown: r'$unknown',
};

_$ConfigReqUpdateSectionDataUnionWeatherImpl
    _$$ConfigReqUpdateSectionDataUnionWeatherImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigReqUpdateSectionDataUnionWeatherImpl(
          type: ConfigUpdateWeatherType.fromJson(json['type'] as String),
          locationType: ConfigUpdateWeatherLocationType.fromJson(
              json['location_type'] as String),
          unit: ConfigUpdateWeatherUnit.fromJson(json['unit'] as String),
          location: json['location'] as String?,
          openWeatherApiKey: json['open_weather_api_key'] as String?,
        );

Map<String, dynamic> _$$ConfigReqUpdateSectionDataUnionWeatherImplToJson(
        _$ConfigReqUpdateSectionDataUnionWeatherImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigUpdateWeatherTypeEnumMap[instance.type]!,
      'location_type':
          _$ConfigUpdateWeatherLocationTypeEnumMap[instance.locationType]!,
      'unit': _$ConfigUpdateWeatherUnitEnumMap[instance.unit]!,
      'location': instance.location,
      'open_weather_api_key': instance.openWeatherApiKey,
    };

const _$ConfigUpdateWeatherTypeEnumMap = {
  ConfigUpdateWeatherType.weather: 'weather',
  ConfigUpdateWeatherType.$unknown: r'$unknown',
};

const _$ConfigUpdateWeatherLocationTypeEnumMap = {
  ConfigUpdateWeatherLocationType.latLon: 'lat_lon',
  ConfigUpdateWeatherLocationType.cityName: 'city_name',
  ConfigUpdateWeatherLocationType.cityId: 'city_id',
  ConfigUpdateWeatherLocationType.zipCode: 'zip_code',
  ConfigUpdateWeatherLocationType.$unknown: r'$unknown',
};

const _$ConfigUpdateWeatherUnitEnumMap = {
  ConfigUpdateWeatherUnit.celsius: 'celsius',
  ConfigUpdateWeatherUnit.fahrenheit: 'fahrenheit',
  ConfigUpdateWeatherUnit.$unknown: r'$unknown',
};
