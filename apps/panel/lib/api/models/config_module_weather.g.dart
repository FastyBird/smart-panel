// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleWeatherImpl _$$ConfigModuleWeatherImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleWeatherImpl(
      location: json['location'] as String?,
      openWeatherApiKey: json['open_weather_api_key'] as String?,
      type: json['type'] == null
          ? ConfigModuleWeatherType.weather
          : ConfigModuleWeatherType.fromJson(json['type'] as String),
      locationType: json['location_type'] == null
          ? ConfigModuleWeatherLocationType.cityName
          : ConfigModuleWeatherLocationType.fromJson(
              json['location_type'] as String),
      unit: json['unit'] == null
          ? ConfigModuleWeatherUnit.celsius
          : ConfigModuleWeatherUnit.fromJson(json['unit'] as String),
    );

Map<String, dynamic> _$$ConfigModuleWeatherImplToJson(
        _$ConfigModuleWeatherImpl instance) =>
    <String, dynamic>{
      'location': instance.location,
      'open_weather_api_key': instance.openWeatherApiKey,
      'type': _$ConfigModuleWeatherTypeEnumMap[instance.type]!,
      'location_type':
          _$ConfigModuleWeatherLocationTypeEnumMap[instance.locationType]!,
      'unit': _$ConfigModuleWeatherUnitEnumMap[instance.unit]!,
    };

const _$ConfigModuleWeatherTypeEnumMap = {
  ConfigModuleWeatherType.weather: 'weather',
  ConfigModuleWeatherType.$unknown: r'$unknown',
};

const _$ConfigModuleWeatherLocationTypeEnumMap = {
  ConfigModuleWeatherLocationType.latLon: 'lat_lon',
  ConfigModuleWeatherLocationType.cityName: 'city_name',
  ConfigModuleWeatherLocationType.cityId: 'city_id',
  ConfigModuleWeatherLocationType.zipCode: 'zip_code',
  ConfigModuleWeatherLocationType.$unknown: r'$unknown',
};

const _$ConfigModuleWeatherUnitEnumMap = {
  ConfigModuleWeatherUnit.celsius: 'celsius',
  ConfigModuleWeatherUnit.fahrenheit: 'fahrenheit',
  ConfigModuleWeatherUnit.$unknown: r'$unknown',
};
