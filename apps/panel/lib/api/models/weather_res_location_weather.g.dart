// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_res_location_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherResLocationWeatherImpl _$$WeatherResLocationWeatherImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherResLocationWeatherImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          WeatherResLocationWeatherMethod.fromJson(json['method'] as String),
      data:
          WeatherLocationWeather.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$WeatherResLocationWeatherImplToJson(
        _$WeatherResLocationWeatherImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$WeatherResLocationWeatherMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$WeatherResLocationWeatherMethodEnumMap = {
  WeatherResLocationWeatherMethod.valueGet: 'GET',
  WeatherResLocationWeatherMethod.post: 'POST',
  WeatherResLocationWeatherMethod.patch: 'PATCH',
  WeatherResLocationWeatherMethod.delete: 'DELETE',
  WeatherResLocationWeatherMethod.$unknown: r'$unknown',
};
