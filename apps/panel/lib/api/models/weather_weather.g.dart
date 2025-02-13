// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherWeatherImpl _$$WeatherWeatherImplFromJson(Map<String, dynamic> json) =>
    _$WeatherWeatherImpl(
      code: json['code'] as num,
      main: json['main'] as String,
      description: json['description'] as String,
      icon: json['icon'] as String,
    );

Map<String, dynamic> _$$WeatherWeatherImplToJson(
        _$WeatherWeatherImpl instance) =>
    <String, dynamic>{
      'code': instance.code,
      'main': instance.main,
      'description': instance.description,
      'icon': instance.icon,
    };
