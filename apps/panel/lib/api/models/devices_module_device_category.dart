// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Defines the type of device, categorizing it by its primary function.
@JsonEnum()
enum DevicesModuleDeviceCategory {
  @JsonValue('generic')
  generic('generic'),
  @JsonValue('air_conditioner')
  airConditioner('air_conditioner'),
  @JsonValue('air_dehumidifier')
  airDehumidifier('air_dehumidifier'),
  @JsonValue('air_humidifier')
  airHumidifier('air_humidifier'),
  @JsonValue('air_purifier')
  airPurifier('air_purifier'),
  @JsonValue('alarm')
  alarm('alarm'),
  @JsonValue('camera')
  camera('camera'),
  @JsonValue('door')
  door('door'),
  @JsonValue('doorbell')
  doorbell('doorbell'),
  @JsonValue('fan')
  fan('fan'),
  @JsonValue('heater')
  heater('heater'),
  @JsonValue('lighting')
  lighting('lighting'),
  @JsonValue('lock')
  lock('lock'),
  @JsonValue('media')
  media('media'),
  @JsonValue('outlet')
  outlet('outlet'),
  @JsonValue('pump')
  pump('pump'),
  @JsonValue('robot_vacuum')
  robotVacuum('robot_vacuum'),
  @JsonValue('sensor')
  sensor('sensor'),
  @JsonValue('speaker')
  speaker('speaker'),
  @JsonValue('sprinkler')
  sprinkler('sprinkler'),
  @JsonValue('switcher')
  switcher('switcher'),
  @JsonValue('television')
  television('television'),
  @JsonValue('thermostat')
  thermostat('thermostat'),
  @JsonValue('valve')
  valve('valve'),
  @JsonValue('window_covering')
  windowCovering('window_covering'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const DevicesModuleDeviceCategory(this.json);

  factory DevicesModuleDeviceCategory.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
