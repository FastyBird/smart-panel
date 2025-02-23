import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum DeviceCategory {
  generic('generic'),
  airConditioner('air_conditioner'),
  airDehumidifier('air_dehumidifier'),
  airHumidifier('air_humidifier'),
  airPurifier('air_purifier'),
  alarm('alarm'),
  camera('camera'),
  door('door'),
  doorbell('doorbell'),
  fan('fan'),
  heater('heater'),
  lighting('lighting'),
  lock('lock'),
  media('media'),
  outlet('outlet'),
  pump('pump'),
  robotVacuum('robot_vacuum'),
  sensor('sensor'),
  speaker('speaker'),
  sprinkler('sprinkler'),
  switcher('switcher'),
  television('television'),
  thermostat('thermostat'),
  valve('valve'),
  windowCovering('window_covering');

  final String value;

  const DeviceCategory(this.value);

  static final utils = StringEnumUtils(
    DeviceCategory.values,
    (DeviceCategory payload) => payload.value,
  );

  static DeviceCategory? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum ChannelCategory {
  generic('generic'),
  airParticulate('air_particulate'),
  alarm('alarm'),
  battery('battery'),
  camera('camera'),
  carbonDioxide('carbon_dioxide'),
  carbonMonoxide('carbon_monoxide'),
  contact('contact'),
  cooler('cooler'),
  deviceInformation('device_information'),
  door('door'),
  doorbell('doorbell'),
  electricalEnergy('electrical_energy'),
  electricalPower('electrical_power'),
  fan('fan'),
  flow('flow'),
  heater('heater'),
  humidity('humidity'),
  illuminance('illuminance'),
  leak('leak'),
  light('light'),
  lock('lock'),
  mediaInput('media_input'),
  mediaPlayback('media_playback'),
  microphone('microphone'),
  motion('motion'),
  nitrogenDioxide('nitrogen_dioxide'),
  occupancy('occupancy'),
  outlet('outlet'),
  ozone('ozone'),
  pressure('pressure'),
  robotVacuum('robot_vacuum'),
  smoke('smoke'),
  speaker('speaker'),
  sulphurDioxide('sulphur_dioxide'),
  switcher('switcher'),
  television('television'),
  temperature('temperature'),
  thermostat('thermostat'),
  valve('valve'),
  volatileOrganicCompounds('volatile_organic_compounds'),
  windowCovering('window_covering');

  final String value;

  const ChannelCategory(this.value);

  static final utils = StringEnumUtils(
    ChannelCategory.values,
    (ChannelCategory payload) => payload.value,
  );

  static ChannelCategory? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum PropertyCategory {
  generic('generic'),
  active('active'),
  angle('angle'),
  brightness('brightness'),
  colorBlue('color_blue'),
  colorGreen('color_green'),
  colorRed('color_red'),
  colorTemperature('color_temperature'),
  colorWhite('color_white'),
  connectionType('connection_type'),
  consumption('consumption'),
  current('current'),
  density('density'),
  detected('detected'),
  direction('direction'),
  distance('distance'),
  duration('duration'),
  event('event'),
  fault('fault'),
  firmwareRevision('firmware_revision'),
  frequency('frequency'),
  hardwareRevision('hardware_revision'),
  hue('hue'),
  humidity('humidity'),
  inUse('in_use'),
  infrared('infrared'),
  inputSource('input_source'),
  level('level'),
  linkQuality('link_quality'),
  locked('locked'),
  manufacturer('manufacturer'),
  measured('measured'),
  model('model'),
  mode('mode'),
  obstruction('obstruction'),
  on('on'),
  overCurrent('over_current'),
  overVoltage('over_voltage'),
  pan('pan'),
  peakLevel('peak_level'),
  percentage('percentage'),
  position('position'),
  power('power'),
  rate('rate'),
  remaining('remaining'),
  remoteKey('remote_key'),
  saturation('saturation'),
  serialNumber('serial_number'),
  source('source'),
  speed('speed'),
  status('status'),
  swing('swing'),
  tampered('tampered'),
  temperature('temperature'),
  tilt('tilt'),
  track('track'),
  type('type'),
  units('units'),
  voltage('voltage'),
  volume('volume'),
  zoom('zoom');

  final String value;

  const PropertyCategory(this.value);

  static final utils = StringEnumUtils(
    PropertyCategory.values,
    (PropertyCategory payload) => payload.value,
  );

  static PropertyCategory? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
