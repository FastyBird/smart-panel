// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_res_geolocation_coordinates_to_city.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherResGeolocationCoordinatesToCityImpl
    _$$WeatherResGeolocationCoordinatesToCityImplFromJson(
            Map<String, dynamic> json) =>
        _$WeatherResGeolocationCoordinatesToCityImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: WeatherResGeolocationCoordinatesToCityMethod.fromJson(
              json['method'] as String),
          data:
              WeatherGeolocation.fromJson(json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$WeatherResGeolocationCoordinatesToCityImplToJson(
        _$WeatherResGeolocationCoordinatesToCityImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$WeatherResGeolocationCoordinatesToCityMethodEnumMap[
          instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$WeatherResGeolocationCoordinatesToCityMethodEnumMap = {
  WeatherResGeolocationCoordinatesToCityMethod.valueGet: 'GET',
  WeatherResGeolocationCoordinatesToCityMethod.post: 'POST',
  WeatherResGeolocationCoordinatesToCityMethod.patch: 'PATCH',
  WeatherResGeolocationCoordinatesToCityMethod.delete: 'DELETE',
  WeatherResGeolocationCoordinatesToCityMethod.$unknown: r'$unknown',
};
