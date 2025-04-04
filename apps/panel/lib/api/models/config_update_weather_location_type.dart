// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Specifies the method used to determine the location for weather updates.
@JsonEnum()
enum ConfigUpdateWeatherLocationType {
  @JsonValue('lat_lon')
  latLon('lat_lon'),
  @JsonValue('city_name')
  cityName('city_name'),
  @JsonValue('city_id')
  cityId('city_id'),
  @JsonValue('zip_code')
  zipCode('zip_code'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const ConfigUpdateWeatherLocationType(this.json);

  factory ConfigUpdateWeatherLocationType.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
