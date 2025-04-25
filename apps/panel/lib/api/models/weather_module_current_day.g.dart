// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_module_current_day.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherModuleCurrentDayImpl _$$WeatherModuleCurrentDayImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherModuleCurrentDayImpl(
      temperature: json['temperature'] as num,
      feelsLike: json['feels_like'] as num,
      pressure: json['pressure'] as num,
      humidity: json['humidity'] as num,
      weather: WeatherModuleWeather.fromJson(
          json['weather'] as Map<String, dynamic>),
      wind: WeatherModuleWind.fromJson(json['wind'] as Map<String, dynamic>),
      clouds: json['clouds'] as num,
      rain: json['rain'] as num?,
      snow: json['snow'] as num?,
      sunrise: DateTime.parse(json['sunrise'] as String),
      sunset: DateTime.parse(json['sunset'] as String),
      dayTime: DateTime.parse(json['day_time'] as String),
      temperatureMin: json['temperature_min'] as num?,
      temperatureMax: json['temperature_max'] as num?,
    );

Map<String, dynamic> _$$WeatherModuleCurrentDayImplToJson(
        _$WeatherModuleCurrentDayImpl instance) =>
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
      'sunrise': instance.sunrise.toIso8601String(),
      'sunset': instance.sunset.toIso8601String(),
      'day_time': instance.dayTime.toIso8601String(),
      'temperature_min': instance.temperatureMin,
      'temperature_max': instance.temperatureMax,
    };
