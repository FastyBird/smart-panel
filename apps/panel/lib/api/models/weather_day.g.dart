// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_day.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherDayImpl _$$WeatherDayImplFromJson(Map<String, dynamic> json) =>
    _$WeatherDayImpl(
      temperature: json['temperature'] as num,
      temperatureMin: json['temperature_min'] as num,
      temperatureMax: json['temperature_max'] as num,
      feelsLike: json['feels_like'] as num,
      pressure: json['pressure'] as num,
      humidity: json['humidity'] as num,
      weather: WeatherWeather.fromJson(json['weather'] as Map<String, dynamic>),
      wind: WeatherWind.fromJson(json['wind'] as Map<String, dynamic>),
      clouds: json['clouds'] as num,
      rain: json['rain'] as num?,
      snow: json['snow'] as num?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );

Map<String, dynamic> _$$WeatherDayImplToJson(_$WeatherDayImpl instance) =>
    <String, dynamic>{
      'temperature': instance.temperature,
      'temperature_min': instance.temperatureMin,
      'temperature_max': instance.temperatureMax,
      'feels_like': instance.feelsLike,
      'pressure': instance.pressure,
      'humidity': instance.humidity,
      'weather': instance.weather,
      'wind': instance.wind,
      'clouds': instance.clouds,
      'rain': instance.rain,
      'snow': instance.snow,
      'created_at': instance.createdAt.toIso8601String(),
    };
