// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_module_res_location_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherModuleResLocationWeatherImpl
    _$$WeatherModuleResLocationWeatherImplFromJson(Map<String, dynamic> json) =>
        _$WeatherModuleResLocationWeatherImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: WeatherModuleResLocationWeatherMethod.fromJson(
              json['method'] as String),
          data: WeatherModuleLocationWeather.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$WeatherModuleResLocationWeatherImplToJson(
        _$WeatherModuleResLocationWeatherImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$WeatherModuleResLocationWeatherMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$WeatherModuleResLocationWeatherMethodEnumMap = {
  WeatherModuleResLocationWeatherMethod.valueGet: 'GET',
  WeatherModuleResLocationWeatherMethod.post: 'POST',
  WeatherModuleResLocationWeatherMethod.patch: 'PATCH',
  WeatherModuleResLocationWeatherMethod.delete: 'DELETE',
  WeatherModuleResLocationWeatherMethod.$unknown: r'$unknown',
};
