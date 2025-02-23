// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_res_location_current.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherResLocationCurrentImpl _$$WeatherResLocationCurrentImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherResLocationCurrentImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          WeatherResLocationCurrentMethod.fromJson(json['method'] as String),
      data: WeatherCurrentDay.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$WeatherResLocationCurrentImplToJson(
        _$WeatherResLocationCurrentImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$WeatherResLocationCurrentMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$WeatherResLocationCurrentMethodEnumMap = {
  WeatherResLocationCurrentMethod.valueGet: 'GET',
  WeatherResLocationCurrentMethod.post: 'POST',
  WeatherResLocationCurrentMethod.patch: 'PATCH',
  WeatherResLocationCurrentMethod.delete: 'DELETE',
  WeatherResLocationCurrentMethod.$unknown: r'$unknown',
};
