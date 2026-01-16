// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Property category
@JsonEnum()
enum DevicesModulePropertyCategory {
  @JsonValue('generic')
  generic('generic'),
  @JsonValue('active')
  active('active'),
  @JsonValue('angle')
  angle('angle'),
  @JsonValue('aqi')
  aqi('aqi'),
  @JsonValue('brightness')
  brightness('brightness'),
  @JsonValue('change_needed')
  changeNeeded('change_needed'),
  @JsonValue('child_lock')
  childLock('child_lock'),
  @JsonValue('color_blue')
  colorBlue('color_blue'),
  @JsonValue('color_green')
  colorGreen('color_green'),
  @JsonValue('color_red')
  colorRed('color_red'),
  @JsonValue('color_temperature')
  colorTemperature('color_temperature'),
  @JsonValue('color_white')
  colorWhite('color_white'),
  @JsonValue('command')
  command('command'),
  @JsonValue('connection_type')
  connectionType('connection_type'),
  @JsonValue('consumption')
  consumption('consumption'),
  @JsonValue('current')
  current('current'),
  @JsonValue('density')
  density('density'),
  @JsonValue('defrost_active')
  defrostActive('defrost_active'),
  @JsonValue('detected')
  detected('detected'),
  @JsonValue('direction')
  direction('direction'),
  @JsonValue('distance')
  distance('distance'),
  @JsonValue('duration')
  duration('duration'),
  @JsonValue('event')
  event('event'),
  @JsonValue('fault')
  fault('fault'),
  @JsonValue('firmware_revision')
  firmwareRevision('firmware_revision'),
  @JsonValue('frequency')
  frequency('frequency'),
  @JsonValue('hardware_revision')
  hardwareRevision('hardware_revision'),
  @JsonValue('hue')
  hue('hue'),
  @JsonValue('humidity')
  humidity('humidity'),
  @JsonValue('in_use')
  inUse('in_use'),
  @JsonValue('infrared')
  infrared('infrared'),
  @JsonValue('input_source')
  inputSource('input_source'),
  @JsonValue('level')
  level('level'),
  @JsonValue('life_remaining')
  lifeRemaining('life_remaining'),
  @JsonValue('link_quality')
  linkQuality('link_quality'),
  @JsonValue('locked')
  locked('locked'),
  @JsonValue('manufacturer')
  manufacturer('manufacturer'),
  @JsonValue('measured')
  measured('measured'),
  @JsonValue('mist_level')
  mistLevel('mist_level'),
  @JsonValue('model')
  model('model'),
  @JsonValue('mode')
  mode('mode'),
  @JsonValue('natural_breeze')
  naturalBreeze('natural_breeze'),
  @JsonValue('obstruction')
  obstruction('obstruction'),
  /// The name has been replaced because it contains a keyword. Original name: `on`.
  @JsonValue('on')
  valueOn('on'),
  @JsonValue('over_current')
  overCurrent('over_current'),
  @JsonValue('over_voltage')
  overVoltage('over_voltage'),
  @JsonValue('over_power')
  overPower('over_power'),
  @JsonValue('pan')
  pan('pan'),
  @JsonValue('peak_level')
  peakLevel('peak_level'),
  @JsonValue('percentage')
  percentage('percentage'),
  @JsonValue('position')
  position('position'),
  @JsonValue('power')
  power('power'),
  @JsonValue('rate')
  rate('rate'),
  @JsonValue('remaining')
  remaining('remaining'),
  @JsonValue('reset')
  reset('reset'),
  @JsonValue('remote_key')
  remoteKey('remote_key'),
  @JsonValue('saturation')
  saturation('saturation'),
  @JsonValue('siren')
  siren('siren'),
  @JsonValue('serial_number')
  serialNumber('serial_number'),
  @JsonValue('source')
  source('source'),
  @JsonValue('speed')
  speed('speed'),
  @JsonValue('status')
  status('status'),
  @JsonValue('state')
  state('state'),
  @JsonValue('swing')
  swing('swing'),
  @JsonValue('tampered')
  tampered('tampered'),
  @JsonValue('temperature')
  temperature('temperature'),
  @JsonValue('tilt')
  tilt('tilt'),
  @JsonValue('timer')
  timer('timer'),
  @JsonValue('triggered')
  triggered('triggered'),
  @JsonValue('track')
  track('track'),
  @JsonValue('type')
  type('type'),
  @JsonValue('units')
  units('units'),
  @JsonValue('voltage')
  voltage('voltage'),
  @JsonValue('volume')
  volume('volume'),
  @JsonValue('warm_mist')
  warmMist('warm_mist'),
  @JsonValue('water_tank_empty')
  waterTankEmpty('water_tank_empty'),
  @JsonValue('water_tank_full')
  waterTankFull('water_tank_full'),
  @JsonValue('water_tank_level')
  waterTankLevel('water_tank_level'),
  @JsonValue('zoom')
  zoom('zoom'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const DevicesModulePropertyCategory(this.json);

  factory DevicesModulePropertyCategory.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<DevicesModulePropertyCategory> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
