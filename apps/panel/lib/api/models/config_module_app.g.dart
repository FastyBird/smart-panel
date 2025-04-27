// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_app.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleAppImpl _$$ConfigModuleAppImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleAppImpl(
      audio: ConfigModuleAudio.fromJson(json['audio'] as Map<String, dynamic>),
      display:
          ConfigModuleDisplay.fromJson(json['display'] as Map<String, dynamic>),
      language: ConfigModuleLanguage.fromJson(
          json['language'] as Map<String, dynamic>),
      weather:
          ConfigModuleWeather.fromJson(json['weather'] as Map<String, dynamic>),
      plugins: (json['plugins'] as List<dynamic>)
          .map((e) => ConfigModulePlugin.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$$ConfigModuleAppImplToJson(
        _$ConfigModuleAppImpl instance) =>
    <String, dynamic>{
      'audio': instance.audio,
      'display': instance.display,
      'language': instance.language,
      'weather': instance.weather,
      'plugins': instance.plugins,
    };
