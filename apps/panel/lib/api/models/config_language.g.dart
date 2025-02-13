// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_language.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigLanguageImpl _$$ConfigLanguageImplFromJson(Map<String, dynamic> json) =>
    _$ConfigLanguageImpl(
      type: json['type'] == null
          ? ConfigLanguageType.language
          : ConfigLanguageType.fromJson(json['type'] as String),
      language: json['language'] == null
          ? ConfigLanguageLanguage.enUS
          : ConfigLanguageLanguage.fromJson(json['language'] as String),
      timezone: json['timezone'] as String? ?? 'Europe/Prague',
      timeFormat: json['time_format'] == null
          ? ConfigLanguageTimeFormat.value24h
          : ConfigLanguageTimeFormat.fromJson(json['time_format'] as String),
    );

Map<String, dynamic> _$$ConfigLanguageImplToJson(
        _$ConfigLanguageImpl instance) =>
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
