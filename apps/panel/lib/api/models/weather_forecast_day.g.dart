// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_forecast_day.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherForecastDayImpl _$$WeatherForecastDayImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherForecastDayImpl(
      temperature:
          Temperature.fromJson(json['temperature'] as Map<String, dynamic>),
      feelsLike: FeelsLike.fromJson(json['feels_like'] as Map<String, dynamic>),
      pressure: json['pressure'] as num,
      humidity: json['humidity'] as num,
      weather: WeatherWeather.fromJson(json['weather'] as Map<String, dynamic>),
      wind: WeatherWind.fromJson(json['wind'] as Map<String, dynamic>),
      clouds: json['clouds'] as num,
      rain: json['rain'] as num?,
      snow: json['snow'] as num?,
      dayTime: DateTime.parse(json['day_time'] as String),
      sunrise: json['sunrise'] == null
          ? null
          : DateTime.parse(json['sunrise'] as String),
      sunset: json['sunset'] == null
          ? null
          : DateTime.parse(json['sunset'] as String),
      moonrise: json['moonrise'] == null
          ? null
          : DateTime.parse(json['moonrise'] as String),
      moonset: json['moonset'] == null
          ? null
          : DateTime.parse(json['moonset'] as String),
    );

Map<String, dynamic> _$$WeatherForecastDayImplToJson(
        _$WeatherForecastDayImpl instance) =>
    <String, dynamic>{
      'temperature': instance.temperature,
      'feels_like': instance.feelsLike,
      'pressure': instance.pressure,
      'humidity': instance.humidity,
      'weather': instance.weather,
      'wind': instance.wind,
      'clouds': instance.clouds,
      'rain': instance.rain,
      'snow': instance.snow,
      'day_time': instance.dayTime.toIso8601String(),
      'sunrise': instance.sunrise?.toIso8601String(),
      'sunset': instance.sunset?.toIso8601String(),
      'moonrise': instance.moonrise?.toIso8601String(),
      'moonset': instance.moonset?.toIso8601String(),
    };
