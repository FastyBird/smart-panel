// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_module_res_location_forecast.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherModuleResLocationForecastImpl
    _$$WeatherModuleResLocationForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$WeatherModuleResLocationForecastImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: WeatherModuleResLocationForecastMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) =>
                  WeatherModuleForecastDay.fromJson(e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$WeatherModuleResLocationForecastImplToJson(
        _$WeatherModuleResLocationForecastImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$WeatherModuleResLocationForecastMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$WeatherModuleResLocationForecastMethodEnumMap = {
  WeatherModuleResLocationForecastMethod.valueGet: 'GET',
  WeatherModuleResLocationForecastMethod.post: 'POST',
  WeatherModuleResLocationForecastMethod.patch: 'PATCH',
  WeatherModuleResLocationForecastMethod.delete: 'DELETE',
  WeatherModuleResLocationForecastMethod.$unknown: r'$unknown',
};
