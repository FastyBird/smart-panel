// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_weather.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigWeatherImpl _$$ConfigWeatherImplFromJson(Map<String, dynamic> json) =>
    _$ConfigWeatherImpl(
      location: json['location'] as String?,
      openWeatherApiKey: json['open_weather_api_key'] as String?,
      type: json['type'] == null
          ? ConfigWeatherType.weather
          : ConfigWeatherType.fromJson(json['type'] as String),
      locationType: json['location_type'] == null
          ? ConfigWeatherLocationType.cityName
          : ConfigWeatherLocationType.fromJson(json['location_type'] as String),
      unit: json['unit'] == null
          ? ConfigWeatherUnit.celsius
          : ConfigWeatherUnit.fromJson(json['unit'] as String),
    );

Map<String, dynamic> _$$ConfigWeatherImplToJson(_$ConfigWeatherImpl instance) =>
    <String, dynamic>{
      'location': instance.location,
      'open_weather_api_key': instance.openWeatherApiKey,
      'type': _$ConfigWeatherTypeEnumMap[instance.type]!,
      'location_type':
          _$ConfigWeatherLocationTypeEnumMap[instance.locationType]!,
      'unit': _$ConfigWeatherUnitEnumMap[instance.unit]!,
    };

const _$ConfigWeatherTypeEnumMap = {
  ConfigWeatherType.weather: 'weather',
  ConfigWeatherType.$unknown: r'$unknown',
};

const _$ConfigWeatherLocationTypeEnumMap = {
  ConfigWeatherLocationType.latLon: 'lat_lon',
  ConfigWeatherLocationType.cityName: 'city_name',
  ConfigWeatherLocationType.cityId: 'city_id',
  ConfigWeatherLocationType.zipCode: 'zip_code',
  ConfigWeatherLocationType.$unknown: r'$unknown',
};

const _$ConfigWeatherUnitEnumMap = {
  ConfigWeatherUnit.celsius: 'celsius',
  ConfigWeatherUnit.fahrenheit: 'fahrenheit',
  ConfigWeatherUnit.$unknown: r'$unknown',
};
