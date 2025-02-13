// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_app.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigAppImpl _$$ConfigAppImplFromJson(Map<String, dynamic> json) =>
    _$ConfigAppImpl(
      audio: ConfigAudio.fromJson(json['audio'] as Map<String, dynamic>),
      display: ConfigDisplay.fromJson(json['display'] as Map<String, dynamic>),
      language:
          ConfigLanguage.fromJson(json['language'] as Map<String, dynamic>),
      weather: ConfigWeather.fromJson(json['weather'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$ConfigAppImplToJson(_$ConfigAppImpl instance) =>
    <String, dynamic>{
      'audio': instance.audio,
      'display': instance.display,
      'language': instance.language,
      'weather': instance.weather,
    };
