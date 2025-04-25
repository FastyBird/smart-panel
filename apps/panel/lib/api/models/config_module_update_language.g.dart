// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_update_language.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleUpdateLanguageImpl _$$ConfigModuleUpdateLanguageImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleUpdateLanguageImpl(
      type: ConfigModuleUpdateLanguageType.fromJson(json['type'] as String),
      language: ConfigModuleUpdateLanguageLanguage.fromJson(
          json['language'] as String),
      timezone: json['timezone'] as String,
      timeFormat: ConfigModuleUpdateLanguageTimeFormat.fromJson(
          json['time_format'] as String),
    );

Map<String, dynamic> _$$ConfigModuleUpdateLanguageImplToJson(
        _$ConfigModuleUpdateLanguageImpl instance) =>
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
