// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_module_res_geolocation_city_to_coordinates.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherModuleResGeolocationCityToCoordinatesImpl
    _$$WeatherModuleResGeolocationCityToCoordinatesImplFromJson(
            Map<String, dynamic> json) =>
        _$WeatherModuleResGeolocationCityToCoordinatesImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: WeatherModuleResGeolocationCityToCoordinatesMethod.fromJson(
              json['method'] as String),
          data: WeatherModuleGeolocation.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$WeatherModuleResGeolocationCityToCoordinatesImplToJson(
        _$WeatherModuleResGeolocationCityToCoordinatesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$WeatherModuleResGeolocationCityToCoordinatesMethodEnumMap[
          instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$WeatherModuleResGeolocationCityToCoordinatesMethodEnumMap = {
  WeatherModuleResGeolocationCityToCoordinatesMethod.valueGet: 'GET',
  WeatherModuleResGeolocationCityToCoordinatesMethod.post: 'POST',
  WeatherModuleResGeolocationCityToCoordinatesMethod.patch: 'PATCH',
  WeatherModuleResGeolocationCityToCoordinatesMethod.delete: 'DELETE',
  WeatherModuleResGeolocationCityToCoordinatesMethod.$unknown: r'$unknown',
};
