// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_location_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherLocationWeatherImpl _$$WeatherLocationWeatherImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherLocationWeatherImpl(
      current: WeatherDay.fromJson(json['current'] as Map<String, dynamic>),
      forecast: (json['forecast'] as List<dynamic>)
          .map((e) => WeatherDay.fromJson(e as Map<String, dynamic>))
          .toList(),
      location:
          WeatherLocation.fromJson(json['location'] as Map<String, dynamic>),
      sunrise: DateTime.parse(json['sunrise'] as String),
      sunset: DateTime.parse(json['sunset'] as String),
      createdAt: DateTime.parse(json['created_at'] as String),
    );

Map<String, dynamic> _$$WeatherLocationWeatherImplToJson(
        _$WeatherLocationWeatherImpl instance) =>
    <String, dynamic>{
      'current': instance.current,
      'forecast': instance.forecast,
      'location': instance.location,
      'sunrise': instance.sunrise.toIso8601String(),
      'sunset': instance.sunset.toIso8601String(),
      'created_at': instance.createdAt.toIso8601String(),
    };
