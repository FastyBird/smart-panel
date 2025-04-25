// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weather_module_geolocation.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WeatherModuleGeolocationImpl _$$WeatherModuleGeolocationImplFromJson(
        Map<String, dynamic> json) =>
    _$WeatherModuleGeolocationImpl(
      name: json['name'] as String,
      localNames: Map<String, String>.from(json['local_names'] as Map),
      lat: json['lat'] as String,
      lon: json['lon'] as String,
      country: json['country'] as String,
      state: json['state'] as String,
    );

Map<String, dynamic> _$$WeatherModuleGeolocationImplToJson(
        _$WeatherModuleGeolocationImpl instance) =>
    <String, dynamic>{
      'name': instance.name,
      'local_names': instance.localNames,
      'lat': instance.lat,
      'lon': instance.lon,
      'country': instance.country,
      'state': instance.state,
    };
