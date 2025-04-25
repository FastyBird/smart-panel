// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Defines the temperature unit for weather data.
@JsonEnum()
enum ConfigModuleUpdateWeatherUnit {
  @JsonValue('celsius')
  celsius('celsius'),
  @JsonValue('fahrenheit')
  fahrenheit('fahrenheit'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const ConfigModuleUpdateWeatherUnit(this.json);

  factory ConfigModuleUpdateWeatherUnit.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
