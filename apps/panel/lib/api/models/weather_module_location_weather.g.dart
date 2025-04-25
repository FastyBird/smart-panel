// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_module_location_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherModuleLocationWeatherImpl _$$WeatherModuleLocationWeatherImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherModuleLocationWeatherImpl(
      current: WeatherModuleCurrentDay.fromJson(
          json['current'] as Map<String, dynamic>),
      forecast: (json['forecast'] as List<dynamic>)
          .map((e) =>
              WeatherModuleForecastDay.fromJson(e as Map<String, dynamic>))
          .toList(),
      location: WeatherModuleLocation.fromJson(
          json['location'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$WeatherModuleLocationWeatherImplToJson(
        _$WeatherModuleLocationWeatherImpl instance) =>
    <String, dynamic>{
      'current': instance.current,
      'forecast': instance.forecast,
      'location': instance.location,
    };
