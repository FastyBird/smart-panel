// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_update_language.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigUpdateLanguageImpl _$$ConfigUpdateLanguageImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigUpdateLanguageImpl(
      type: ConfigUpdateLanguageType.fromJson(json['type'] as String),
      language:
          ConfigUpdateLanguageLanguage.fromJson(json['language'] as String),
      timezone: json['timezone'] as String,
      timeFormat: ConfigUpdateLanguageTimeFormat.fromJson(
          json['time_format'] as String),
    );

Map<String, dynamic> _$$ConfigUpdateLanguageImplToJson(
        _$ConfigUpdateLanguageImpl instance) =>
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
