// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_res_geolocation_city_to_coordinates.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherResGeolocationCityToCoordinatesImpl
    _$$WeatherResGeolocationCityToCoordinatesImplFromJson(
            Map<String, dynamic> json) =>
        _$WeatherResGeolocationCityToCoordinatesImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: WeatherResGeolocationCityToCoordinatesMethod.fromJson(
              json['method'] as String),
          data:
              WeatherGeolocation.fromJson(json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$WeatherResGeolocationCityToCoordinatesImplToJson(
        _$WeatherResGeolocationCityToCoordinatesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$WeatherResGeolocationCityToCoordinatesMethodEnumMap[
          instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$WeatherResGeolocationCityToCoordinatesMethodEnumMap = {
  WeatherResGeolocationCityToCoordinatesMethod.valueGet: 'GET',
  WeatherResGeolocationCityToCoordinatesMethod.post: 'POST',
  WeatherResGeolocationCityToCoordinatesMethod.patch: 'PATCH',
  WeatherResGeolocationCityToCoordinatesMethod.delete: 'DELETE',
  WeatherResGeolocationCityToCoordinatesMethod.$unknown: r'$unknown',
};
