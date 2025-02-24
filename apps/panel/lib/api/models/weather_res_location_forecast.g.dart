// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_res_location_forecast.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherResLocationForecastImpl _$$WeatherResLocationForecastImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherResLocationForecastImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          WeatherResLocationForecastMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => WeatherForecastDay.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$WeatherResLocationForecastImplToJson(
        _$WeatherResLocationForecastImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$WeatherResLocationForecastMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$WeatherResLocationForecastMethodEnumMap = {
  WeatherResLocationForecastMethod.valueGet: 'GET',
  WeatherResLocationForecastMethod.post: 'POST',
  WeatherResLocationForecastMethod.patch: 'PATCH',
  WeatherResLocationForecastMethod.delete: 'DELETE',
  WeatherResLocationForecastMethod.$unknown: r'$unknown',
};
