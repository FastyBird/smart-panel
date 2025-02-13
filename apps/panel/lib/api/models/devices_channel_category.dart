// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Represents a functional channel inside a device, responsible for a specific type of data or control.
@JsonEnum()
enum DevicesChannelCategory {
  @JsonValue('generic')
  generic('generic'),
  @JsonValue('air_particulate')
  airParticulate('air_particulate'),
  @JsonValue('alarm')
  alarm('alarm'),
  @JsonValue('battery')
  battery('battery'),
  @JsonValue('camera')
  camera('camera'),
  @JsonValue('carbon_dioxide')
  carbonDioxide('carbon_dioxide'),
  @JsonValue('carbon_monoxide')
  carbonMonoxide('carbon_monoxide'),
  @JsonValue('contact')
  contact('contact'),
  @JsonValue('cooler')
  cooler('cooler'),
  @JsonValue('device_information')
  deviceInformation('device_information'),
  @JsonValue('door')
  door('door'),
  @JsonValue('doorbell')
  doorbell('doorbell'),
  @JsonValue('electrical_energy')
  electricalEnergy('electrical_energy'),
  @JsonValue('electrical_power')
  electricalPower('electrical_power'),
  @JsonValue('fan')
  fan('fan'),
  @JsonValue('flow')
  flow('flow'),
  @JsonValue('heater')
  heater('heater'),
  @JsonValue('humidity')
  humidity('humidity'),
  @JsonValue('illuminance')
  illuminance('illuminance'),
  @JsonValue('leak')
  leak('leak'),
  @JsonValue('light')
  light('light'),
  @JsonValue('lock')
  lock('lock'),
  @JsonValue('media_input')
  mediaInput('media_input'),
  @JsonValue('media_playback')
  mediaPlayback('media_playback'),
  @JsonValue('microphone')
  microphone('microphone'),
  @JsonValue('motion')
  motion('motion'),
  @JsonValue('nitrogen_dioxide')
  nitrogenDioxide('nitrogen_dioxide'),
  @JsonValue('occupancy')
  occupancy('occupancy'),
  @JsonValue('outlet')
  outlet('outlet'),
  @JsonValue('ozone')
  ozone('ozone'),
  @JsonValue('pressure')
  pressure('pressure'),
  @JsonValue('robot_vacuum')
  robotVacuum('robot_vacuum'),
  @JsonValue('smoke')
  smoke('smoke'),
  @JsonValue('speaker')
  speaker('speaker'),
  @JsonValue('sulphur_dioxide')
  sulphurDioxide('sulphur_dioxide'),
  @JsonValue('switcher')
  switcher('switcher'),
  @JsonValue('television')
  television('television'),
  @JsonValue('temperature')
  temperature('temperature'),
  @JsonValue('thermostat')
  thermostat('thermostat'),
  @JsonValue('valve')
  valve('valve'),
  @JsonValue('volatile_organic_compounds')
  volatileOrganicCompounds('volatile_organic_compounds'),
  @JsonValue('window_covering')
  windowCovering('window_covering'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const DevicesChannelCategory(this.json);

  factory DevicesChannelCategory.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
