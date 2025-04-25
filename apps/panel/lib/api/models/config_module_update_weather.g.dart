// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_update_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleUpdateWeatherImpl _$$ConfigModuleUpdateWeatherImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleUpdateWeatherImpl(
      type: ConfigModuleUpdateWeatherType.fromJson(json['type'] as String),
      locationType: ConfigModuleUpdateWeatherLocationType.fromJson(
          json['location_type'] as String),
      unit: ConfigModuleUpdateWeatherUnit.fromJson(json['unit'] as String),
      location: json['location'] as String?,
      openWeatherApiKey: json['open_weather_api_key'] as String?,
    );

Map<String, dynamic> _$$ConfigModuleUpdateWeatherImplToJson(
        _$ConfigModuleUpdateWeatherImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleUpdateWeatherTypeEnumMap[instance.type]!,
      'location_type': _$ConfigModuleUpdateWeatherLocationTypeEnumMap[
          instance.locationType]!,
      'unit': _$ConfigModuleUpdateWeatherUnitEnumMap[instance.unit]!,
      'location': instance.location,
      'open_weather_api_key': instance.openWeatherApiKey,
    };

const _$ConfigModuleUpdateWeatherTypeEnumMap = {
  ConfigModuleUpdateWeatherType.weather: 'weather',
  ConfigModuleUpdateWeatherType.$unknown: r'$unknown',
};

const _$ConfigModuleUpdateWeatherLocationTypeEnumMap = {
  ConfigModuleUpdateWeatherLocationType.latLon: 'lat_lon',
  ConfigModuleUpdateWeatherLocationType.cityName: 'city_name',
  ConfigModuleUpdateWeatherLocationType.cityId: 'city_id',
  ConfigModuleUpdateWeatherLocationType.zipCode: 'zip_code',
  ConfigModuleUpdateWeatherLocationType.$unknown: r'$unknown',
};

const _$ConfigModuleUpdateWeatherUnitEnumMap = {
  ConfigModuleUpdateWeatherUnit.celsius: 'celsius',
  ConfigModuleUpdateWeatherUnit.fahrenheit: 'fahrenheit',
  ConfigModuleUpdateWeatherUnit.$unknown: r'$unknown',
};
