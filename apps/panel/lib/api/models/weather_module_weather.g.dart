// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_module_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherModuleWeatherImpl _$$WeatherModuleWeatherImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherModuleWeatherImpl(
      code: json['code'] as num,
      main: json['main'] as String,
      description: json['description'] as String,
      icon: json['icon'] as String,
    );

Map<String, dynamic> _$$WeatherModuleWeatherImplToJson(
        _$WeatherModuleWeatherImpl instance) =>
    <String, dynamic>{
      'code': instance.code,
      'main': instance.main,
      'description': instance.description,
      'icon': instance.icon,
    };
