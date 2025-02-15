// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_location_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherLocationWeatherImpl _$$WeatherLocationWeatherImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherLocationWeatherImpl(
      current:
          WeatherCurrentDay.fromJson(json['current'] as Map<String, dynamic>),
      forecast: (json['forecast'] as List<dynamic>)
          .map((e) => WeatherForecastDay.fromJson(e as Map<String, dynamic>))
          .toList(),
      location:
          WeatherLocation.fromJson(json['location'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$WeatherLocationWeatherImplToJson(
        _$WeatherLocationWeatherImpl instance) =>
    <String, dynamic>{
      'current': instance.current,
      'forecast': instance.forecast,
      'location': instance.location,
    };
