// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_req_update_section_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleReqUpdateSectionDataUnionAudioImpl
    _$$ConfigModuleReqUpdateSectionDataUnionAudioImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigModuleReqUpdateSectionDataUnionAudioImpl(
          type: ConfigModuleUpdateAudioType.fromJson(json['type'] as String),
          speaker: json['speaker'] as bool,
          speakerVolume: (json['speaker_volume'] as num).toInt(),
          microphone: json['microphone'] as bool,
          microphoneVolume: (json['microphone_volume'] as num).toInt(),
        );

Map<String, dynamic> _$$ConfigModuleReqUpdateSectionDataUnionAudioImplToJson(
        _$ConfigModuleReqUpdateSectionDataUnionAudioImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleUpdateAudioTypeEnumMap[instance.type]!,
      'speaker': instance.speaker,
      'speaker_volume': instance.speakerVolume,
      'microphone': instance.microphone,
      'microphone_volume': instance.microphoneVolume,
    };

const _$ConfigModuleUpdateAudioTypeEnumMap = {
  ConfigModuleUpdateAudioType.audio: 'audio',
  ConfigModuleUpdateAudioType.$unknown: r'$unknown',
};

_$ConfigModuleReqUpdateSectionDataUnionDisplayImpl
    _$$ConfigModuleReqUpdateSectionDataUnionDisplayImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl(
          type: ConfigModuleUpdateDisplayType.fromJson(json['type'] as String),
          darkMode: json['dark_mode'] as bool,
          brightness: (json['brightness'] as num).toInt(),
          screenLockDuration: (json['screen_lock_duration'] as num).toInt(),
          screenSaver: json['screen_saver'] as bool,
        );

Map<String, dynamic> _$$ConfigModuleReqUpdateSectionDataUnionDisplayImplToJson(
        _$ConfigModuleReqUpdateSectionDataUnionDisplayImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleUpdateDisplayTypeEnumMap[instance.type]!,
      'dark_mode': instance.darkMode,
      'brightness': instance.brightness,
      'screen_lock_duration': instance.screenLockDuration,
      'screen_saver': instance.screenSaver,
    };

const _$ConfigModuleUpdateDisplayTypeEnumMap = {
  ConfigModuleUpdateDisplayType.display: 'display',
  ConfigModuleUpdateDisplayType.$unknown: r'$unknown',
};

_$ConfigModuleReqUpdateSectionDataUnionLanguageImpl
    _$$ConfigModuleReqUpdateSectionDataUnionLanguageImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl(
          type: ConfigModuleUpdateLanguageType.fromJson(json['type'] as String),
          language: ConfigModuleUpdateLanguageLanguage.fromJson(
              json['language'] as String),
          timezone: json['timezone'] as String,
          timeFormat: ConfigModuleUpdateLanguageTimeFormat.fromJson(
              json['time_format'] as String),
        );

Map<String, dynamic> _$$ConfigModuleReqUpdateSectionDataUnionLanguageImplToJson(
        _$ConfigModuleReqUpdateSectionDataUnionLanguageImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleUpdateLanguageTypeEnumMap[instance.type]!,
      'language':
          _$ConfigModuleUpdateLanguageLanguageEnumMap[instance.language]!,
      'timezone': instance.timezone,
      'time_format':
          _$ConfigModuleUpdateLanguageTimeFormatEnumMap[instance.timeFormat]!,
    };

const _$ConfigModuleUpdateLanguageTypeEnumMap = {
  ConfigModuleUpdateLanguageType.language: 'language',
  ConfigModuleUpdateLanguageType.$unknown: r'$unknown',
};

const _$ConfigModuleUpdateLanguageLanguageEnumMap = {
  ConfigModuleUpdateLanguageLanguage.enUS: 'en_US',
  ConfigModuleUpdateLanguageLanguage.csCZ: 'cs_CZ',
  ConfigModuleUpdateLanguageLanguage.$unknown: r'$unknown',
};

const _$ConfigModuleUpdateLanguageTimeFormatEnumMap = {
  ConfigModuleUpdateLanguageTimeFormat.value12h: '12h',
  ConfigModuleUpdateLanguageTimeFormat.value24h: '24h',
  ConfigModuleUpdateLanguageTimeFormat.$unknown: r'$unknown',
};

_$ConfigModuleReqUpdateSectionDataUnionWeatherImpl
    _$$ConfigModuleReqUpdateSectionDataUnionWeatherImplFromJson(
            Map<String, dynamic> json) =>
        _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl(
          type: ConfigModuleUpdateWeatherType.fromJson(json['type'] as String),
          locationType: ConfigModuleUpdateWeatherLocationType.fromJson(
              json['location_type'] as String),
          unit: ConfigModuleUpdateWeatherUnit.fromJson(json['unit'] as String),
          location: json['location'] as String?,
          openWeatherApiKey: json['open_weather_api_key'] as String?,
        );

Map<String, dynamic> _$$ConfigModuleReqUpdateSectionDataUnionWeatherImplToJson(
        _$ConfigModuleReqUpdateSectionDataUnionWeatherImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleUpdateWeatherTypeEnumMap[instance.type]!,
      'location_type': _$ConfigModuleUpdateWeatherLocationTypeEnumMap[
          instance.locationType]!,
      'unit': _$ConfigModuleUpdateWeatherUnitEnumMap[instance.unit]!,
      'location': instance.location,
      'open_weather_api_key': instance.openWeatherApiKey,
    };

const _$ConfigModuleUpdateWeatherTypeEnumMap = {
  ConfigModuleUpdateWeatherType.weather: 'weather',
  ConfigModuleUpdateWeatherType.$unknown: r'$unknown',
};

const _$ConfigModuleUpdateWeatherLocationTypeEnumMap = {
  ConfigModuleUpdateWeatherLocationType.latLon: 'lat_lon',
  ConfigModuleUpdateWeatherLocationType.cityName: 'city_name',
  ConfigModuleUpdateWeatherLocationType.cityId: 'city_id',
  ConfigModuleUpdateWeatherLocationType.zipCode: 'zip_code',
  ConfigModuleUpdateWeatherLocationType.$unknown: r'$unknown',
};

const _$ConfigModuleUpdateWeatherUnitEnumMap = {
  ConfigModuleUpdateWeatherUnit.celsius: 'celsius',
  ConfigModuleUpdateWeatherUnit.fahrenheit: 'fahrenheit',
  ConfigModuleUpdateWeatherUnit.$unknown: r'$unknown',
};
