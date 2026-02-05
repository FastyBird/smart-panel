import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

/// Translates sensor enum string values to localized labels.
///
/// Use [short] = true for compact tile display, false for detail/long display.
/// Returns null if no translation is found (caller should fall back to raw value).
class SensorEnumUtils {
  SensorEnumUtils._();

  static String? translate(
    AppLocalizations l,
    DevicesModuleChannelCategory channelCategory,
    DevicesModulePropertyCategory propertyCategory,
    String value, {
    bool short = true,
  }) {
    // Air quality level
    if (channelCategory == DevicesModuleChannelCategory.airQuality &&
        propertyCategory == DevicesModulePropertyCategory.level) {
      return _airQualityLevel(l, value);
    }

    // VOC level
    if (channelCategory == DevicesModuleChannelCategory.volatileOrganicCompounds &&
        propertyCategory == DevicesModulePropertyCategory.level) {
      return _vocLevel(l, value, short: short);
    }

    // Ozone / Sulphur dioxide level
    if ((channelCategory == DevicesModuleChannelCategory.ozone ||
            channelCategory == DevicesModuleChannelCategory.sulphurDioxide) &&
        propertyCategory == DevicesModulePropertyCategory.level) {
      return _ozoneSulphurLevel(l, value);
    }

    // Gas status
    if (channelCategory == DevicesModuleChannelCategory.gas &&
        propertyCategory == DevicesModulePropertyCategory.status) {
      return _gasStatus(l, value, short: short);
    }

    // Gas level (same values as ozone/sulphur)
    if (channelCategory == DevicesModuleChannelCategory.gas &&
        propertyCategory == DevicesModulePropertyCategory.level) {
      return _ozoneSulphurLevel(l, value);
    }

    // Illuminance level
    if (channelCategory == DevicesModuleChannelCategory.illuminance &&
        propertyCategory == DevicesModulePropertyCategory.level) {
      return _illuminanceLevel(l, value, short: short);
    }

    // Leak level
    if (channelCategory == DevicesModuleChannelCategory.leak &&
        propertyCategory == DevicesModulePropertyCategory.level) {
      return _leakLevel(l, value, short: short);
    }

    // Battery level
    if (channelCategory == DevicesModuleChannelCategory.battery &&
        propertyCategory == DevicesModulePropertyCategory.level) {
      return _batteryLevel(l, value, short: short);
    }

    // Battery status
    if (channelCategory == DevicesModuleChannelCategory.battery &&
        propertyCategory == DevicesModulePropertyCategory.status) {
      return _batteryStatus(l, value, short: short);
    }

    // Alarm alarm state
    if (channelCategory == DevicesModuleChannelCategory.alarm &&
        propertyCategory == DevicesModulePropertyCategory.alarmState) {
      return _alarmAlarmState(l, value, short: short);
    }

    // Alarm state
    if (channelCategory == DevicesModuleChannelCategory.alarm &&
        propertyCategory == DevicesModulePropertyCategory.state) {
      return _alarmState(l, value, short: short);
    }

    // Filter status
    if (channelCategory == DevicesModuleChannelCategory.filter &&
        propertyCategory == DevicesModulePropertyCategory.status) {
      return _filterStatus(l, value, short: short);
    }

    // Door status
    if (channelCategory == DevicesModuleChannelCategory.door &&
        propertyCategory == DevicesModulePropertyCategory.status) {
      return _doorStatus(l, value, short: short);
    }

    // Lock status
    if (channelCategory == DevicesModuleChannelCategory.lock &&
        propertyCategory == DevicesModulePropertyCategory.status) {
      return _lockStatus(l, value, short: short);
    }

    // Camera status
    if (channelCategory == DevicesModuleChannelCategory.camera &&
        propertyCategory == DevicesModulePropertyCategory.status) {
      return _cameraStatus(l, value, short: short);
    }

    // Device information status
    if (channelCategory == DevicesModuleChannelCategory.deviceInformation &&
        propertyCategory == DevicesModulePropertyCategory.status) {
      return _deviceInformationStatus(l, value, short: short);
    }

    return null;
  }

  /// Translates a sensor value to a localized label via [translatePrimary] and
  /// [translateBinaryState].
  ///
  /// Returns the original value if no translation is found or if the value is
  /// numeric or a placeholder.
  static String translateSensorValue(
    AppLocalizations l,
    String value,
    DevicesModuleChannelCategory? channelCategory, {
    bool short = true,
  }) {
    if (channelCategory == null) return value;

    // Only translate non-numeric, non-placeholder values
    if (value == '--' || value.isEmpty) return value;
    if (double.tryParse(value.replaceAll(',', '')) != null) return value;

    // Try enum translation first
    final translated = translatePrimary(
      l, channelCategory, value, short: short,
    );
    if (translated != null) return translated;

    // Try binary state translation ("true"/"false")
    final binary = _parseBinaryState(l, channelCategory, value, short: short);
    if (binary != null) return binary;

    return value;
  }

  /// Translates a binary (detected / not-detected) sensor state based on
  /// channel category.
  ///
  /// Call this directly when you already have a [bool] value (e.g. from
  /// timeseries points). For raw string values use [translateSensorValue].
  static String translateBinaryState(
    AppLocalizations l,
    DevicesModuleChannelCategory category,
    bool isActive, {
    bool short = true,
  }) {
    switch (category) {
      case DevicesModuleChannelCategory.motion:
      case DevicesModuleChannelCategory.occupancy:
        return isActive ? l.sensor_state_detected : l.sensor_state_clear;
      case DevicesModuleChannelCategory.contact:
      case DevicesModuleChannelCategory.door:
      case DevicesModuleChannelCategory.doorbell:
        return isActive ? l.sensor_state_open : l.sensor_state_closed;
      case DevicesModuleChannelCategory.smoke:
        return isActive
            ? l.sensor_state_smoke_detected
            : l.sensor_state_clear;
      case DevicesModuleChannelCategory.gas:
        return isActive ? l.sensor_state_gas_detected : l.sensor_state_clear;
      case DevicesModuleChannelCategory.leak:
        return isActive ? l.sensor_state_leak_detected : l.sensor_state_clear;
      case DevicesModuleChannelCategory.carbonMonoxide:
        return isActive ? l.sensor_state_co_detected : l.sensor_state_clear;
      default:
        return isActive ? l.sensor_state_active : l.sensor_state_inactive;
    }
  }

  /// Parses a "true"/"false" string and delegates to [translateBinaryState].
  static String? _parseBinaryState(
    AppLocalizations l,
    DevicesModuleChannelCategory category,
    String value, {
    bool short = true,
  }) {
    final lower = value.toLowerCase();
    if (lower == 'true' || lower == '1') {
      return translateBinaryState(l, category, true, short: short);
    }
    if (lower == 'false' || lower == '0') {
      return translateBinaryState(l, category, false, short: short);
    }
    return null;
  }

  /// Translates sensor type labels (Temperature, Humidity, etc.).
  static String translateSensorLabel(
      AppLocalizations l, DevicesModuleChannelCategory category) {
    switch (category) {
      case DevicesModuleChannelCategory.temperature:
        return l.sensor_label_temperature;
      case DevicesModuleChannelCategory.humidity:
        return l.sensor_label_humidity;
      case DevicesModuleChannelCategory.pressure:
        return l.sensor_label_pressure;
      case DevicesModuleChannelCategory.illuminance:
        return l.sensor_label_illuminance;
      case DevicesModuleChannelCategory.carbonDioxide:
        return l.sensor_label_carbon_dioxide;
      case DevicesModuleChannelCategory.carbonMonoxide:
        return l.sensor_label_carbon_monoxide;
      case DevicesModuleChannelCategory.ozone:
        return l.sensor_label_ozone;
      case DevicesModuleChannelCategory.nitrogenDioxide:
        return l.sensor_label_nitrogen_dioxide;
      case DevicesModuleChannelCategory.sulphurDioxide:
        return l.sensor_label_sulphur_dioxide;
      case DevicesModuleChannelCategory.volatileOrganicCompounds:
        return l.sensor_label_voc;
      case DevicesModuleChannelCategory.airParticulate:
        return l.sensor_label_particulate_matter;
      case DevicesModuleChannelCategory.motion:
        return l.sensor_label_motion;
      case DevicesModuleChannelCategory.occupancy:
        return l.sensor_label_occupancy;
      case DevicesModuleChannelCategory.contact:
        return l.sensor_label_contact;
      case DevicesModuleChannelCategory.leak:
        return l.sensor_label_leak;
      case DevicesModuleChannelCategory.smoke:
        return l.sensor_label_smoke;
      case DevicesModuleChannelCategory.battery:
        return l.sensor_label_battery;
      case DevicesModuleChannelCategory.alarm:
        return l.sensor_label_alarm;
      case DevicesModuleChannelCategory.door:
        return l.sensor_label_door;
      case DevicesModuleChannelCategory.lock:
        return l.sensor_label_lock;
      case DevicesModuleChannelCategory.camera:
        return l.sensor_label_camera;
      case DevicesModuleChannelCategory.filter:
        return l.sensor_label_filter;
      case DevicesModuleChannelCategory.deviceInformation:
        return l.sensor_label_device_info;
      case DevicesModuleChannelCategory.gas:
        return l.sensor_label_gas;
      default:
        return category.json ?? category.toString();
    }
  }

  /// Translates sensor category labels for filters.
  static String translateSensorCategory(
      AppLocalizations l, DevicesModuleChannelCategory category) {
    switch (category) {
      case DevicesModuleChannelCategory.temperature:
        return l.sensor_category_temperature;
      case DevicesModuleChannelCategory.humidity:
        return l.sensor_category_humidity;
      case DevicesModuleChannelCategory.airQuality:
      case DevicesModuleChannelCategory.airParticulate:
      case DevicesModuleChannelCategory.carbonDioxide:
      case DevicesModuleChannelCategory.volatileOrganicCompounds:
      case DevicesModuleChannelCategory.ozone:
      case DevicesModuleChannelCategory.sulphurDioxide:
      case DevicesModuleChannelCategory.nitrogenDioxide:
        return l.sensor_category_air_quality;
      case DevicesModuleChannelCategory.motion:
      case DevicesModuleChannelCategory.occupancy:
      case DevicesModuleChannelCategory.contact:
        return l.sensor_category_motion;
      case DevicesModuleChannelCategory.smoke:
      case DevicesModuleChannelCategory.gas:
      case DevicesModuleChannelCategory.leak:
      case DevicesModuleChannelCategory.carbonMonoxide:
        return l.sensor_category_safety;
      case DevicesModuleChannelCategory.illuminance:
        return l.sensor_category_light;
      case DevicesModuleChannelCategory.electricalEnergy:
      case DevicesModuleChannelCategory.electricalPower:
        return l.sensor_category_energy;
      default:
        return category.json ?? category.toString();
    }
  }

  /// Translates alert labels.
  static String translateAlertLabel(AppLocalizations l, String label) {
    switch (label.toLowerCase()) {
      case 'high level':
        return l.sensor_alert_high_level;
      case 'low battery':
        return l.sensor_alert_low_battery;
      case 'charging':
        return l.sensor_alert_charging;
      default:
        return label;
    }
  }

  /// Translate primary sensor value using channel category only.
  /// For primary readings where propertyCategory is not available,
  /// we infer it from the channel category.
  static String? translatePrimary(
    AppLocalizations l,
    DevicesModuleChannelCategory channelCategory,
    String value, {
    bool short = true,
  }) {
    switch (channelCategory) {
      case DevicesModuleChannelCategory.airQuality:
        return translate(l, channelCategory, DevicesModulePropertyCategory.level,
            value, short: short);
      case DevicesModuleChannelCategory.volatileOrganicCompounds:
        return translate(l, channelCategory, DevicesModulePropertyCategory.level,
            value, short: short);
      case DevicesModuleChannelCategory.ozone:
      case DevicesModuleChannelCategory.sulphurDioxide:
        return translate(l, channelCategory, DevicesModulePropertyCategory.level,
            value, short: short);
      case DevicesModuleChannelCategory.gas:
        return translate(l, channelCategory,
                DevicesModulePropertyCategory.status, value, short: short) ??
            translate(l, channelCategory, DevicesModulePropertyCategory.level,
                value, short: short);
      case DevicesModuleChannelCategory.illuminance:
        return translate(l, channelCategory, DevicesModulePropertyCategory.level,
            value, short: short);
      case DevicesModuleChannelCategory.leak:
        return translate(l, channelCategory, DevicesModulePropertyCategory.level,
            value, short: short);
      case DevicesModuleChannelCategory.battery:
        return translate(l, channelCategory,
                DevicesModulePropertyCategory.status, value, short: short) ??
            translate(l, channelCategory, DevicesModulePropertyCategory.level,
                value, short: short);
      case DevicesModuleChannelCategory.alarm:
        return translate(l, channelCategory,
                DevicesModulePropertyCategory.alarmState, value,
                short: short) ??
            translate(l, channelCategory, DevicesModulePropertyCategory.state,
                value, short: short);
      case DevicesModuleChannelCategory.filter:
        return translate(l, channelCategory,
            DevicesModulePropertyCategory.status, value, short: short);
      case DevicesModuleChannelCategory.door:
        return translate(l, channelCategory,
            DevicesModulePropertyCategory.status, value, short: short);
      case DevicesModuleChannelCategory.lock:
        return translate(l, channelCategory,
            DevicesModulePropertyCategory.status, value, short: short);
      case DevicesModuleChannelCategory.camera:
        return translate(l, channelCategory,
            DevicesModulePropertyCategory.status, value, short: short);
      case DevicesModuleChannelCategory.deviceInformation:
        return translate(l, channelCategory,
            DevicesModulePropertyCategory.status, value, short: short);
      default:
        return null;
    }
  }

  static String? _airQualityLevel(AppLocalizations l, String v) {
    final parsed = AirQualityLevelValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case AirQualityLevelValue.excellent:
        return l.air_quality_level_excellent;
      case AirQualityLevelValue.good:
        return l.air_quality_level_good;
      case AirQualityLevelValue.fair:
        return l.air_quality_level_fair;
      case AirQualityLevelValue.inferior:
        return l.air_quality_level_inferior;
      case AirQualityLevelValue.poor:
        return l.air_quality_level_poor;
      case AirQualityLevelValue.unknown:
        return l.air_quality_level_unknown;
    }
  }

  static String? _vocLevel(AppLocalizations l, String v, {required bool short}) {
    final parsed = VolatileOrganicCompoundsLevelValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case VolatileOrganicCompoundsLevelValue.low:
        return short
            ? l.sensor_enum_voc_level_low
            : l.sensor_enum_voc_level_low_long;
      case VolatileOrganicCompoundsLevelValue.medium:
        return short
            ? l.sensor_enum_voc_level_medium
            : l.sensor_enum_voc_level_medium_long;
      case VolatileOrganicCompoundsLevelValue.high:
        return short
            ? l.sensor_enum_voc_level_high
            : l.sensor_enum_voc_level_high_long;
    }
  }

  static String? _ozoneSulphurLevel(AppLocalizations l, String v) {
    final parsed = OzoneLevelValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case OzoneLevelValue.low:
        return l.gas_level_low;
      case OzoneLevelValue.medium:
        return l.gas_level_medium;
      case OzoneLevelValue.high:
        return l.gas_level_high;
    }
  }

  static String? _gasStatus(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = GasStatusValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case GasStatusValue.normal:
        return short
            ? l.sensor_enum_gas_status_normal
            : l.sensor_enum_gas_status_normal_long;
      case GasStatusValue.warning:
        return short
            ? l.sensor_enum_gas_status_warning
            : l.sensor_enum_gas_status_warning_long;
      case GasStatusValue.alarm:
        return short
            ? l.sensor_enum_gas_status_alarm
            : l.sensor_enum_gas_status_alarm_long;
    }
  }

  static String? _illuminanceLevel(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = IlluminanceLevelValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case IlluminanceLevelValue.bright:
        return short
            ? l.sensor_enum_illuminance_bright
            : l.sensor_enum_illuminance_bright_long;
      case IlluminanceLevelValue.moderate:
        return short
            ? l.sensor_enum_illuminance_moderate
            : l.sensor_enum_illuminance_moderate_long;
      case IlluminanceLevelValue.dusky:
        return short
            ? l.sensor_enum_illuminance_dusky
            : l.sensor_enum_illuminance_dusky_long;
      case IlluminanceLevelValue.dark:
        return short
            ? l.sensor_enum_illuminance_dark
            : l.sensor_enum_illuminance_dark_long;
    }
  }

  static String? _leakLevel(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = LeakLevelValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case LeakLevelValue.low:
        return short
            ? l.sensor_enum_leak_level_low
            : l.sensor_enum_leak_level_low_long;
      case LeakLevelValue.medium:
        return short
            ? l.sensor_enum_leak_level_medium
            : l.sensor_enum_leak_level_medium_long;
      case LeakLevelValue.high:
        return short
            ? l.sensor_enum_leak_level_high
            : l.sensor_enum_leak_level_high_long;
    }
  }

  static String? _batteryLevel(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = BatteryPercentageLevelValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case BatteryPercentageLevelValue.critical:
        return short
            ? l.sensor_enum_battery_level_critical
            : l.sensor_enum_battery_level_critical_long;
      case BatteryPercentageLevelValue.low:
        return short
            ? l.sensor_enum_battery_level_low
            : l.sensor_enum_battery_level_low_long;
      case BatteryPercentageLevelValue.medium:
        return short
            ? l.sensor_enum_battery_level_medium
            : l.sensor_enum_battery_level_medium_long;
      case BatteryPercentageLevelValue.high:
        return short
            ? l.sensor_enum_battery_level_high
            : l.sensor_enum_battery_level_high_long;
      case BatteryPercentageLevelValue.full:
        return short
            ? l.sensor_enum_battery_level_full
            : l.sensor_enum_battery_level_full_long;
    }
  }

  static String? _batteryStatus(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = BatteryStatusValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case BatteryStatusValue.ok:
        return short
            ? l.sensor_enum_battery_status_ok
            : l.sensor_enum_battery_status_ok_long;
      case BatteryStatusValue.low:
        return short
            ? l.sensor_enum_battery_status_low
            : l.sensor_enum_battery_status_low_long;
      case BatteryStatusValue.charging:
        return short
            ? l.sensor_enum_battery_status_charging
            : l.sensor_enum_battery_status_charging_long;
    }
  }

  static String? _alarmAlarmState(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = AlarmAlarmStateValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case AlarmAlarmStateValue.idle:
        return short
            ? l.sensor_enum_alarm_alarm_idle
            : l.sensor_enum_alarm_alarm_idle_long;
      case AlarmAlarmStateValue.pending:
        return short
            ? l.sensor_enum_alarm_alarm_pending
            : l.sensor_enum_alarm_alarm_pending_long;
      case AlarmAlarmStateValue.triggered:
        return short
            ? l.sensor_enum_alarm_alarm_triggered
            : l.sensor_enum_alarm_alarm_triggered_long;
      case AlarmAlarmStateValue.silenced:
        return short
            ? l.sensor_enum_alarm_alarm_silenced
            : l.sensor_enum_alarm_alarm_silenced_long;
    }
  }

  static String? _alarmState(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = AlarmStateValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case AlarmStateValue.disarmed:
        return short
            ? l.sensor_enum_alarm_disarmed
            : l.sensor_enum_alarm_disarmed_long;
      case AlarmStateValue.armedHome:
        return short
            ? l.sensor_enum_alarm_armed_home
            : l.sensor_enum_alarm_armed_home_long;
      case AlarmStateValue.armedAway:
        return short
            ? l.sensor_enum_alarm_armed_away
            : l.sensor_enum_alarm_armed_away_long;
      case AlarmStateValue.armedNight:
        return short
            ? l.sensor_enum_alarm_armed_night
            : l.sensor_enum_alarm_armed_night_long;
    }
  }

  static String? _filterStatus(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = FilterStatusValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case FilterStatusValue.good:
        return short
            ? l.sensor_enum_filter_good
            : l.sensor_enum_filter_good_long;
      case FilterStatusValue.replaceSoon:
        return short
            ? l.sensor_enum_filter_replace_soon
            : l.sensor_enum_filter_replace_soon_long;
      case FilterStatusValue.replaceNow:
        return short
            ? l.sensor_enum_filter_replace_now
            : l.sensor_enum_filter_replace_now_long;
    }
  }

  static String? _doorStatus(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = DoorStatusValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case DoorStatusValue.opened:
        return short
            ? l.sensor_enum_door_opened
            : l.sensor_enum_door_opened_long;
      case DoorStatusValue.closed:
        return short
            ? l.sensor_enum_door_closed
            : l.sensor_enum_door_closed_long;
      case DoorStatusValue.opening:
        return short
            ? l.sensor_enum_door_opening
            : l.sensor_enum_door_opening_long;
      case DoorStatusValue.closing:
        return short
            ? l.sensor_enum_door_closing
            : l.sensor_enum_door_closing_long;
      case DoorStatusValue.stopped:
        return short
            ? l.sensor_enum_door_stopped
            : l.sensor_enum_door_stopped_long;
    }
  }

  static String? _lockStatus(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = LockStatusValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case LockStatusValue.locked:
        return short
            ? l.sensor_enum_lock_locked
            : l.sensor_enum_lock_locked_long;
      case LockStatusValue.unlocked:
        return short
            ? l.sensor_enum_lock_unlocked
            : l.sensor_enum_lock_unlocked_long;
    }
  }

  static String? _cameraStatus(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = CameraStatusValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case CameraStatusValue.available:
        return short
            ? l.sensor_enum_camera_available
            : l.sensor_enum_camera_available_long;
      case CameraStatusValue.inUse:
        return short
            ? l.sensor_enum_camera_in_use
            : l.sensor_enum_camera_in_use_long;
      case CameraStatusValue.unavailable:
        return short
            ? l.sensor_enum_camera_unavailable
            : l.sensor_enum_camera_unavailable_long;
      case CameraStatusValue.offline:
        return short
            ? l.sensor_enum_camera_offline
            : l.sensor_enum_camera_offline_long;
      case CameraStatusValue.initializing:
        return short
            ? l.sensor_enum_camera_initializing
            : l.sensor_enum_camera_initializing_long;
      case CameraStatusValue.error:
        return short
            ? l.sensor_enum_camera_error
            : l.sensor_enum_camera_error_long;
    }
  }

  static String? _deviceInformationStatus(AppLocalizations l, String v,
      {required bool short}) {
    final parsed = DeviceInformationStatusValue.fromValue(v);
    if (parsed == null) return null;
    switch (parsed) {
      case DeviceInformationStatusValue.connected:
        return short
            ? l.sensor_enum_device_info_connected
            : l.sensor_enum_device_info_connected_long;
      case DeviceInformationStatusValue.disconnected:
        return short
            ? l.sensor_enum_device_info_disconnected
            : l.sensor_enum_device_info_disconnected_long;
      case DeviceInformationStatusValue.init:
        return short
            ? l.sensor_enum_device_info_init
            : l.sensor_enum_device_info_init_long;
      case DeviceInformationStatusValue.ready:
        return short
            ? l.sensor_enum_device_info_ready
            : l.sensor_enum_device_info_ready_long;
      case DeviceInformationStatusValue.running:
        return short
            ? l.sensor_enum_device_info_running
            : l.sensor_enum_device_info_running_long;
      case DeviceInformationStatusValue.sleeping:
        return short
            ? l.sensor_enum_device_info_sleeping
            : l.sensor_enum_device_info_sleeping_long;
      case DeviceInformationStatusValue.stopped:
        return short
            ? l.sensor_enum_device_info_stopped
            : l.sensor_enum_device_info_stopped_long;
      case DeviceInformationStatusValue.lost:
        return short
            ? l.sensor_enum_device_info_lost
            : l.sensor_enum_device_info_lost_long;
      case DeviceInformationStatusValue.alert:
        return short
            ? l.sensor_enum_device_info_alert
            : l.sensor_enum_device_info_alert_long;
      case DeviceInformationStatusValue.unknown:
        return short
            ? l.sensor_enum_device_info_unknown
            : l.sensor_enum_device_info_unknown_long;
    }
  }
}
