// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_module_wind.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherModuleWindImpl _$$WeatherModuleWindImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherModuleWindImpl(
      speed: json['speed'] as num,
      deg: json['deg'] as num,
      gust: json['gust'] as num?,
    );

Map<String, dynamic> _$$WeatherModuleWindImplToJson(
        _$WeatherModuleWindImpl instance) =>
    <String, dynamic>{
      'speed': instance.speed,
      'deg': instance.deg,
      'gust': instance.gust,
    };
