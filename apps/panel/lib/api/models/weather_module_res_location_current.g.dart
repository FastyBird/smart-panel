// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_module_res_location_current.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherModuleResLocationCurrentImpl
    _$$WeatherModuleResLocationCurrentImplFromJson(Map<String, dynamic> json) =>
        _$WeatherModuleResLocationCurrentImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: WeatherModuleResLocationCurrentMethod.fromJson(
              json['method'] as String),
          data: WeatherModuleCurrentDay.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$WeatherModuleResLocationCurrentImplToJson(
        _$WeatherModuleResLocationCurrentImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$WeatherModuleResLocationCurrentMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$WeatherModuleResLocationCurrentMethodEnumMap = {
  WeatherModuleResLocationCurrentMethod.valueGet: 'GET',
  WeatherModuleResLocationCurrentMethod.post: 'POST',
  WeatherModuleResLocationCurrentMethod.patch: 'PATCH',
  WeatherModuleResLocationCurrentMethod.delete: 'DELETE',
  WeatherModuleResLocationCurrentMethod.$unknown: r'$unknown',
};
