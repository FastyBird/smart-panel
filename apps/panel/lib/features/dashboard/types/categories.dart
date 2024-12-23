import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum DeviceCategoryType {
  generic('generic'),
  airConditioner('air_conditioner'),
  airDehumidifier('air_dehumidifier'),
  airHumidifier('air_humidifier'),
  airPurifier('air_purifier'),
  alarm('alarm'),
  appliance('appliance'),
  audioReceiver('audio_receiver'),
  bridge('bridge'),
  button('button'),
  camera('camera'),
  cookSurface('cook_surface'),
  cooktop('cooktop'),
  dishwasher('dishwasher'),
  doorbell('doorbell'),
  doorLock('door_lock'),
  fan('fan'),
  switcher('switcher'),
  heater('heater'),
  laundryDryer('laundry_dryer'),
  laundryWasher('laundry_washer'),
  lighting('lighting'),
  media('media'),
  microwaveOven('microwave_oven'),
  outlet('outlet'),
  oven('oven'),
  pump('pump'),
  refrigerator('refrigerator'),
  robotic('robotic'),
  sensor('sensor'),
  speaker('speaker'),
  sprinkler('sprinkler'),
  television('television'),
  thermostat('thermostat'),
  valve('valve'),
  windowCovering('window_covering'),
  windowLock('window_lock');

  final String value;

  const DeviceCategoryType(this.value);

  static final utils = StringEnumUtils(
    DeviceCategoryType.values,
    (DeviceCategoryType payload) => payload.value,
  );

  static DeviceCategoryType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum ChannelCategoryType {
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
  generic('generic'),
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

  const ChannelCategoryType(this.value);

  static final utils = StringEnumUtils(
    ChannelCategoryType.values,
    (ChannelCategoryType payload) => payload.value,
  );

  static ChannelCategoryType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum PropertyCategoryType {
  active('active'),
  angle('angle'),
  brightness('brightness'),
  colorBlue('color_blue'),
  colorGreen('color_green'),
  colorRed('color_red'),
  colorTemperature('color_temperature'),
  colorWhite('color_white'),
  consumption('consumption'),
  current('current'),
  density('density'),
  detected('detected'),
  direction('direction'),
  distance('distance'),
  event('event'),
  fault('fault'),
  firmwareRevision('firmware_revision'),
  generic('generic'),
  hardwareRevision('hardware_revision'),
  hue('hue'),
  humidity('humidity'),
  inUse('in_use'),
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
  peakLevel('peak_level'),
  percentage('percentage'),
  position('position'),
  power('power'),
  rate('rate'),
  remoteKey('remote_key'),
  saturation('saturation'),
  serialNumber('serial_number'),
  source('source'),
  speed('speed'),
  status('status'),
  swing('swing'),
  tampered('tampered'),
  temperature('temperature'),
  type('type'),
  units('units'),
  voltage('voltage'),
  volume('volume');

  final String value;

  const PropertyCategoryType(this.value);

  static final utils = StringEnumUtils(
    PropertyCategoryType.values,
    (PropertyCategoryType payload) => payload.value,
  );

  static PropertyCategoryType? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
