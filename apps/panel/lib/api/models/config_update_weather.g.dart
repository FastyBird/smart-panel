// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_update_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigUpdateWeatherImpl _$$ConfigUpdateWeatherImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigUpdateWeatherImpl(
      type: ConfigUpdateWeatherType.fromJson(json['type'] as String),
      locationType: ConfigUpdateWeatherLocationType.fromJson(
          json['location_type'] as String),
      unit: ConfigUpdateWeatherUnit.fromJson(json['unit'] as String),
      location: json['location'] as String?,
      openWeatherApiKey: json['open_weather_api_key'] as String?,
    );

Map<String, dynamic> _$$ConfigUpdateWeatherImplToJson(
        _$ConfigUpdateWeatherImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigUpdateWeatherTypeEnumMap[instance.type]!,
      'location_type':
          _$ConfigUpdateWeatherLocationTypeEnumMap[instance.locationType]!,
      'unit': _$ConfigUpdateWeatherUnitEnumMap[instance.unit]!,
      'location': instance.location,
      'open_weather_api_key': instance.openWeatherApiKey,
    };

const _$ConfigUpdateWeatherTypeEnumMap = {
  ConfigUpdateWeatherType.weather: 'weather',
  ConfigUpdateWeatherType.$unknown: r'$unknown',
};

const _$ConfigUpdateWeatherLocationTypeEnumMap = {
  ConfigUpdateWeatherLocationType.latLon: 'lat_lon',
  ConfigUpdateWeatherLocationType.cityName: 'city_name',
  ConfigUpdateWeatherLocationType.cityId: 'city_id',
  ConfigUpdateWeatherLocationType.zipCode: 'zip_code',
  ConfigUpdateWeatherLocationType.$unknown: r'$unknown',
};

const _$ConfigUpdateWeatherUnitEnumMap = {
  ConfigUpdateWeatherUnit.celsius: 'celsius',
  ConfigUpdateWeatherUnit.fahrenheit: 'fahrenheit',
  ConfigUpdateWeatherUnit.$unknown: r'$unknown',
};
