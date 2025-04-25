// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_language.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleLanguageImpl _$$ConfigModuleLanguageImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleLanguageImpl(
      type: json['type'] == null
          ? ConfigModuleLanguageType.language
          : ConfigModuleLanguageType.fromJson(json['type'] as String),
      language: json['language'] == null
          ? ConfigModuleLanguageLanguage.enUS
          : ConfigModuleLanguageLanguage.fromJson(json['language'] as String),
      timezone: json['timezone'] as String? ?? 'Europe/Prague',
      timeFormat: json['time_format'] == null
          ? ConfigModuleLanguageTimeFormat.value24h
          : ConfigModuleLanguageTimeFormat.fromJson(
              json['time_format'] as String),
    );

Map<String, dynamic> _$$ConfigModuleLanguageImplToJson(
        _$ConfigModuleLanguageImpl instance) =>
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
