// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_wind.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherWindImpl _$$WeatherWindImplFromJson(Map<String, dynamic> json) =>
    _$WeatherWindImpl(
      speed: json['speed'] as num,
      deg: json['deg'] as num,
      gust: json['gust'] as num?,
    );

Map<String, dynamic> _$$WeatherWindImplToJson(_$WeatherWindImpl instance) =>
    <String, dynamic>{
      'speed': instance.speed,
      'deg': instance.deg,
      'gust': instance.gust,
    };
