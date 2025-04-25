// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_module_res_geolocation_coordinates_to_city.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherModuleResGeolocationCoordinatesToCityImpl
    _$$WeatherModuleResGeolocationCoordinatesToCityImplFromJson(
            Map<String, dynamic> json) =>
        _$WeatherModuleResGeolocationCoordinatesToCityImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: WeatherModuleResGeolocationCoordinatesToCityMethod.fromJson(
              json['method'] as String),
          data: WeatherModuleGeolocation.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$WeatherModuleResGeolocationCoordinatesToCityImplToJson(
        _$WeatherModuleResGeolocationCoordinatesToCityImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$WeatherModuleResGeolocationCoordinatesToCityMethodEnumMap[
          instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$WeatherModuleResGeolocationCoordinatesToCityMethodEnumMap = {
  WeatherModuleResGeolocationCoordinatesToCityMethod.valueGet: 'GET',
  WeatherModuleResGeolocationCoordinatesToCityMethod.post: 'POST',
  WeatherModuleResGeolocationCoordinatesToCityMethod.patch: 'PATCH',
  WeatherModuleResGeolocationCoordinatesToCityMethod.delete: 'DELETE',
  WeatherModuleResGeolocationCoordinatesToCityMethod.$unknown: r'$unknown',
};
