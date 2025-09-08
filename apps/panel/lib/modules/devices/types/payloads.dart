import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum AirParticulateModeValue {
  pm25('pm2_5'),
  pm10('pm10');

  final String value;

  const AirParticulateModeValue(this.value);

  static final utils = StringEnumUtils(
    AirParticulateModeValue.values,
    (AirParticulateModeValue payload) => payload.value,
  );

  static AirParticulateModeValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum BatteryStateValue {
  ok('ok'),
  charging('charging'),
  low('low');

  final String value;

  const BatteryStateValue(this.value);

  static final utils = StringEnumUtils(
    BatteryStateValue.values,
    (BatteryStateValue payload) => payload.value,
  );

  static BatteryStateValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum CameraStatusValue {
  available('available'),
  inUse('in_use'),
  unavailable('unavailable'),
  offline('offline'),
  initializing('initializing'),
  error('error');

  final String value;

  const CameraStatusValue(this.value);

  static final utils = StringEnumUtils(
    CameraStatusValue.values,
    (CameraStatusValue payload) => payload.value,
  );

  static CameraStatusValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum ConnectionTypeValue {
  wired('wired'),
  wifi('wifi'),
  zigbee('zigbee'),
  bluetooth('bluetooth');

  final String value;

  const ConnectionTypeValue(this.value);

  static final utils = StringEnumUtils(
    ConnectionTypeValue.values,
    (ConnectionTypeValue payload) => payload.value,
  );

  static ConnectionTypeValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum DoorStatusValue {
  open('open'),
  closed('closed'),
  opening('opening'),
  closing('closing'),
  stopped('stopped');

  final String value;

  const DoorStatusValue(this.value);

  static final utils = StringEnumUtils(
    DoorStatusValue.values,
    (DoorStatusValue payload) => payload.value,
  );

  static DoorStatusValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum DoorPositionValue {
  open('open'),
  close('close'),
  stop('stop');

  final String value;

  const DoorPositionValue(this.value);

  static final utils = StringEnumUtils(
    DoorPositionValue.values,
    (DoorPositionValue payload) => payload.value,
  );

  static DoorPositionValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum DoorTypeValue {
  door('door'),
  garage('garage');

  final String value;

  const DoorTypeValue(this.value);

  static final utils = StringEnumUtils(
    DoorTypeValue.values,
    (DoorTypeValue payload) => payload.value,
  );

  static DoorTypeValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum ButtonEventValue {
  singlePress('single_press'),
  doublePress('double_press'),
  longPress('long_press');

  final String value;

  const ButtonEventValue(this.value);

  static final utils = StringEnumUtils(
    ButtonEventValue.values,
    (ButtonEventValue payload) => payload.value,
  );

  static ButtonEventValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum ConnectionStatusValue {
  connected('connected'),
  disconnected('disconnected'),
  init('init'),
  ready('ready'),
  running('running'),
  sleeping('sleeping'),
  stopped('stopped'),
  lost('lost'),
  alert('alert'),
  unknown('unknown');

  final String value;

  const ConnectionStatusValue(this.value);

  static final utils = StringEnumUtils(
    ConnectionStatusValue.values,
    (ConnectionStatusValue payload) => payload.value,
  );

  static ConnectionStatusValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum FanDirectionValue {
  clockwise('clockwise'),
  counterClockwise('counter_clockwise');

  final String value;

  const FanDirectionValue(this.value);

  static final utils = StringEnumUtils(
    FanDirectionValue.values,
    (FanDirectionValue payload) => payload.value,
  );

  static FanDirectionValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum IlluminanceLevelValue {
  bright('bright'),
  moderate('moderate'),
  dusky('dusky'),
  dark('dark');

  final String value;

  const IlluminanceLevelValue(this.value);

  static final utils = StringEnumUtils(
    IlluminanceLevelValue.values,
    (IlluminanceLevelValue payload) => payload.value,
  );

  static IlluminanceLevelValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum LockStatusValue {
  locked('locked'),
  unlocked('unlocked');

  final String value;

  const LockStatusValue(this.value);

  static final utils = StringEnumUtils(
    LockStatusValue.values,
    (LockStatusValue payload) => payload.value,
  );

  static LockStatusValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum MediaPlaybackStatusValue {
  playing('playing'),
  paused('paused'),
  stopped('stopped');

  final String value;

  const MediaPlaybackStatusValue(this.value);

  static final utils = StringEnumUtils(
    MediaPlaybackStatusValue.values,
    (MediaPlaybackStatusValue payload) => payload.value,
  );

  static MediaPlaybackStatusValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum NitrogenDioxideModeValues {
  annual('annual'),
  oneHour('1_hour');

  final String value;

  const NitrogenDioxideModeValues(this.value);

  static final utils = StringEnumUtils(
    NitrogenDioxideModeValues.values,
    (NitrogenDioxideModeValues payload) => payload.value,
  );

  static NitrogenDioxideModeValues? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum OzoneLevelValue {
  low('low'),
  medium('medium'),
  high('high');

  final String value;

  const OzoneLevelValue(this.value);

  static final utils = StringEnumUtils(
    OzoneLevelValue.values,
    (OzoneLevelValue payload) => payload.value,
  );

  static OzoneLevelValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum RobotVacuumStatusValue {
  idle('idle'),
  cleaning('cleaning'),
  vacuuming('vacuuming'),
  mopping('mopping'),
  docking('docking'),
  charging('charging');

  final String value;

  const RobotVacuumStatusValue(this.value);

  static final utils = StringEnumUtils(
    RobotVacuumStatusValue.values,
    (RobotVacuumStatusValue payload) => payload.value,
  );

  static RobotVacuumStatusValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum RobotVacuumModeValue {
  auto('auto'),
  spot('spot'),
  manual('manual');

  final String value;

  const RobotVacuumModeValue(this.value);

  static final utils = StringEnumUtils(
    RobotVacuumModeValue.values,
    (RobotVacuumModeValue payload) => payload.value,
  );

  static RobotVacuumModeValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum SpeakerModeValue {
  stereo('stereo'),
  mono('mono'),
  surround('surround');

  final String value;

  const SpeakerModeValue(this.value);

  static final utils = StringEnumUtils(
    SpeakerModeValue.values,
    (SpeakerModeValue payload) => payload.value,
  );

  static SpeakerModeValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum SulphurDioxideLevelValue {
  low('low'),
  medium('medium'),
  high('high');

  final String value;

  const SulphurDioxideLevelValue(this.value);

  static final utils = StringEnumUtils(
    SulphurDioxideLevelValue.values,
    (SulphurDioxideLevelValue payload) => payload.value,
  );

  static SulphurDioxideLevelValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum TelevisionInputSourceValue {
  tv('tv'),
  hdmi('hdmi'),
  app('app');

  final String value;

  const TelevisionInputSourceValue(this.value);

  static final utils = StringEnumUtils(
    TelevisionInputSourceValue.values,
    (TelevisionInputSourceValue payload) => payload.value,
  );

  static TelevisionInputSourceValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum TelevisionRemoteKeyValue {
  rewind('rewind'),
  fastForward('fast_forward'),
  next('next'),
  previous('previous'),
  arrowUp('arrow_up'),
  arrowDown('arrow_down'),
  arrowLeft('arrow_left'),
  arrowRight('arrow_right'),
  select('select'),
  back('back'),
  exit('exit'),
  info('info'),
  play('play'),
  pause('pause');

  final String value;

  const TelevisionRemoteKeyValue(this.value);

  static final utils = StringEnumUtils(
    TelevisionRemoteKeyValue.values,
    (TelevisionRemoteKeyValue payload) => payload.value,
  );

  static TelevisionRemoteKeyValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum ThermostatModeValue {
  heat('heat'),
  cool('cool'),
  auto('auto'),
  manual('manual');

  final String value;

  const ThermostatModeValue(this.value);

  static final utils = StringEnumUtils(
    ThermostatModeValue.values,
    (ThermostatModeValue payload) => payload.value,
  );

  static ThermostatModeValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum ThermostatUnitsValue {
  celsius('celsius'),
  fahrenheit('fahrenheit');

  final String value;

  const ThermostatUnitsValue(this.value);

  static final utils = StringEnumUtils(
    ThermostatUnitsValue.values,
    (ThermostatUnitsValue payload) => payload.value,
  );

  static ThermostatUnitsValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum ValveTypeValue {
  generic('generic'),
  irrigation('irrigation'),
  showerHead('shower_head'),
  waterFaucet('water_faucet');

  final String value;

  const ValveTypeValue(this.value);

  static final utils = StringEnumUtils(
    ValveTypeValue.values,
    (ValveTypeValue payload) => payload.value,
  );

  static ValveTypeValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum ValveModeValue {
  manual('manual'),
  scheduled('scheduled');

  final String value;

  const ValveModeValue(this.value);

  static final utils = StringEnumUtils(
    ValveModeValue.values,
    (ValveModeValue payload) => payload.value,
  );

  static ValveModeValue? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum VolatileOrganicCompoundsLevelValue {
  low('low'),
  medium('medium'),
  high('high');

  final String value;

  const VolatileOrganicCompoundsLevelValue(this.value);

  static final utils = StringEnumUtils(
    VolatileOrganicCompoundsLevelValue.values,
    (VolatileOrganicCompoundsLevelValue payload) => payload.value,
  );

  static VolatileOrganicCompoundsLevelValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum WindowCoveringStatusValue {
  open('open'),
  closed('closed'),
  opening('opening'),
  closing('closing'),
  stopped('stopped'),
  unknown('unknown');

  final String value;

  const WindowCoveringStatusValue(this.value);

  static final utils = StringEnumUtils(
    WindowCoveringStatusValue.values,
    (WindowCoveringStatusValue payload) => payload.value,
  );

  static WindowCoveringStatusValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum WindowCoveringCommandValue {
  open('open'),
  close('close'),
  stop('stop');

  final String value;

  const WindowCoveringCommandValue(this.value);

  static final utils = StringEnumUtils(
    WindowCoveringCommandValue.values,
    (WindowCoveringCommandValue payload) => payload.value,
  );

  static WindowCoveringCommandValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum WindowCoveringTypeValue {
  curtain('curtain'),
  blind('blind'),
  roller('roller'),
  outdoorBlind('outdoor_blind');

  final String value;

  const WindowCoveringTypeValue(this.value);

  static final utils = StringEnumUtils(
    WindowCoveringTypeValue.values,
    (WindowCoveringTypeValue payload) => payload.value,
  );

  static WindowCoveringTypeValue? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
