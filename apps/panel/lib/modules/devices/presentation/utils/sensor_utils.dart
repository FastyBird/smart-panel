import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart'
    show buildChannelIcon;
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/value.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/material.dart';

/// Unified sensor utilities — single source of truth for value formatting,
/// unit strings, decimal scales, SensorData building, and enum/binary translation.
///
/// Merges the former [SensorValueBuilder] and [SensorEnumUtils] into one class,
/// and adds centralized numeric formatting methods so device detail views and
/// domain views no longer need inline [NumberFormatUtils] calls.
class SensorUtils {
  SensorUtils._();

  static const _formatter = NumberFormatUtils.defaultFormat;

  // ===========================================================================
  // SECTION 1: Units per category
  // ===========================================================================

  /// Canonical display unit for a channel category.
  ///
  /// Returns an empty string for binary/enum-only categories (contact, leak, …).
  static String unitForCategory(DevicesModuleChannelCategory category) {
    switch (category) {
      case DevicesModuleChannelCategory.temperature:
        return '°C';
      case DevicesModuleChannelCategory.humidity:
        return '%';
      case DevicesModuleChannelCategory.pressure:
        return 'kPa';
      case DevicesModuleChannelCategory.illuminance:
        return 'lux';
      case DevicesModuleChannelCategory.carbonDioxide:
        return 'ppm';
      case DevicesModuleChannelCategory.carbonMonoxide:
        return 'ppm';
      case DevicesModuleChannelCategory.gas:
        return 'ppm';
      case DevicesModuleChannelCategory.airParticulate:
      case DevicesModuleChannelCategory.nitrogenDioxide:
      case DevicesModuleChannelCategory.ozone:
      case DevicesModuleChannelCategory.sulphurDioxide:
      case DevicesModuleChannelCategory.volatileOrganicCompounds:
        return 'µg/m³';
      case DevicesModuleChannelCategory.flow:
        return 'm³/h';
      case DevicesModuleChannelCategory.electricalEnergy:
        return 'kWh';
      case DevicesModuleChannelCategory.electricalPower:
        return 'W';
      case DevicesModuleChannelCategory.battery:
      case DevicesModuleChannelCategory.filter:
      case DevicesModuleChannelCategory.humidifier:
      case DevicesModuleChannelCategory.dehumidifier:
        return '%';
      default:
        return '';
    }
  }

  // ===========================================================================
  // SECTION 2: Decimal scale per category
  // ===========================================================================

  /// Number of decimal places for numeric display of a channel category.
  ///
  /// Temperature, carbon monoxide, and pressure use 1 decimal place;
  /// everything else uses 0 (integer display).
  static int scaleForCategory(DevicesModuleChannelCategory category) {
    switch (category) {
      case DevicesModuleChannelCategory.temperature:
      case DevicesModuleChannelCategory.carbonMonoxide:
      case DevicesModuleChannelCategory.pressure:
        return 1;
      default:
        return 0;
    }
  }

  // ===========================================================================
  // SECTION 3: Numeric formatting
  // ===========================================================================

  /// Format a numeric [value] using the scale for [category].
  ///
  /// Returns a locale-formatted string (e.g. "23,5" for temperature,
  /// "1 013" for CO₂).
  static String formatNumericValue(
    num value,
    DevicesModuleChannelCategory category,
  ) {
    final scale = scaleForCategory(category);
    if (scale > 0) {
      return _formatter.formatDecimal(value.toDouble(), decimalPlaces: scale);
    }
    return _formatter.formatInteger(value.toInt());
  }

  /// Format a numeric [value] with its unit appended (e.g. "23,5°C", "45%").
  static String formatNumericValueWithUnit(
    num value,
    DevicesModuleChannelCategory category,
  ) {
    final formatted = formatNumericValue(value, category);
    final unit = unitForCategory(category);
    if (unit.isEmpty) return formatted;
    return '$formatted$unit';
  }

  // ===========================================================================
  // SECTION 4: Value formatter closure (for SensorData / SensorDetailContent)
  // ===========================================================================

  /// Returns a [valueFormatter] closure with the correct decimal places for
  /// [category]. Uses locale-aware [NumberFormatUtils] for numeric values
  /// and delegates to [ValueUtils] for booleans, strings, and validation.
  static String? Function(ChannelPropertyView) valueFormatterForCategory(
    DevicesModuleChannelCategory category,
  ) {
    final scale = scaleForCategory(category);
    return (prop) {
      final value = prop.value;
      if (value is NumberValueType) {
        // Delegate to ValueUtils for range/invalid checks — it returns null
        // when the value is out-of-range and no invalid substitute exists.
        final raw = ValueUtils.formatValue(prop, scale);
        if (raw == null) return null;
        // Re-format the validated number through locale-aware formatter.
        final num parsed = ValueUtils.roundToScale(value.value.toDouble(), scale);
        return scale > 0
            ? _formatter.formatDecimal(parsed.toDouble(), decimalPlaces: scale)
            : _formatter.formatInteger(parsed.toInt());
      }
      return ValueUtils.formatValue(prop, scale);
    };
  }

  // ===========================================================================
  // SECTION 5: Raw value formatting (for domain views)
  // ===========================================================================

  /// Format a raw sensor value for display in domain views where data comes from
  /// [SpaceStateRepository] rather than typed channel views.
  ///
  /// Handles null, boolean, numeric, and fallback-to-string cases.
  static String formatRawValue(
    dynamic value,
    DevicesModuleChannelCategory? category,
  ) {
    if (value == null) return '--';

    // Boolean sensors — store raw state; localized at display time
    if (value is bool) return value ? 'true' : 'false';
    if (value is String) {
      final lower = value.toLowerCase();
      if (lower == 'true' || lower == '1') return 'true';
      if (lower == 'false' || lower == '0') return 'false';
    }

    if (value is num) {
      if (category != null) {
        return formatNumericValue(value, category);
      }
      // No category — use best-effort formatting
      if (value is double) {
        return _formatter.formatDecimal(value, decimalPlaces: 1);
      }
      return _formatter.formatInteger(value.toInt());
    }

    return value.toString();
  }

  // ===========================================================================
  // SECTION 6: SensorData builder (from SensorValueBuilder)
  // ===========================================================================

  /// Builds a complete [SensorData] from a [ChannelView].
  ///
  /// Resolves the best property to display, sets the icon/label/formatter/
  /// detection state automatically based on channel category. All fields can
  /// be overridden for special cases (battery icon, contact icon, alert state).
  ///
  /// When [localizations] is provided, the label is localized via
  /// [translateSensorLabel]. Otherwise the channel name or category json
  /// identifier is used as a fallback.
  static SensorData buildSensorData(
    ChannelView channel, {
    AppLocalizations? localizations,
    String? label,
    IconData? icon,
    ChannelPropertyView? property,
    String? Function(ChannelPropertyView)? valueFormatter,
    bool? isDetection,
    bool? isAlert,
    String? alertLabel,
  }) {
    final category = channel.category;

    // Resolve property: caller override → auto-resolved from channel
    final resolvedProperty = property ?? _resolveProperty(channel);

    // Resolve detection state (pass resolved property so non-detection channels
    // whose best property is `detected` are treated as binary)
    final resolvedIsDetection =
        isDetection ?? _resolveIsDetection(channel, resolvedProperty);

    // Resolve label: caller override → localized → channel name → category json
    final resolvedLabel = label ??
        (localizations != null
            ? translateSensorLabel(localizations, category)
            : (channel.name.isNotEmpty
                ? channel.name
                : category.json ?? category.toString()));

    // Resolve unit: binary/enum/string properties have no unit;
    // otherwise use property from backend → hardcoded fallback by category
    final bool isDiscreteProperty = resolvedIsDetection != null ||
        (resolvedProperty != null &&
            (resolvedProperty.dataType == DevicesModuleDataType.bool ||
                resolvedProperty.dataType == DevicesModuleDataType.valueEnum ||
                resolvedProperty.dataType == DevicesModuleDataType.string));
    final resolvedUnit = isDiscreteProperty
        ? ''
        : (resolvedProperty?.unit ?? unitForCategory(category));

    return SensorData(
      label: resolvedLabel,
      icon: icon ?? buildChannelIcon(category),
      channel: channel,
      property: resolvedProperty,
      unit: resolvedUnit,
      valueFormatter:
          resolvedIsDetection != null
              ? null
              : (valueFormatter ?? valueFormatterForCategory(category)),
      isDetection: resolvedIsDetection,
      isAlert: isAlert,
      alertLabel: alertLabel,
    );
  }

  // ---------------------------------------------------------------------------
  // Property priority resolution (private)
  // ---------------------------------------------------------------------------

  /// Resolves the best property to display for a channel based on its category
  /// and available properties. Returns `null` if no matching property found.
  static ChannelPropertyView? _resolveProperty(ChannelView channel) {
    final category = channel.category;

    switch (category) {
      // Environmental: single dedicated property (numeric)
      case DevicesModuleChannelCategory.temperature:
        return _findProp(channel, DevicesModulePropertyCategory.temperature);
      case DevicesModuleChannelCategory.humidity:
        return _findProp(channel, DevicesModulePropertyCategory.humidity);
      case DevicesModuleChannelCategory.pressure:
        return _findProp(channel, DevicesModulePropertyCategory.pressure);
      case DevicesModuleChannelCategory.illuminance:
        return _findProp(channel, DevicesModulePropertyCategory.illuminance) ??
            _findProp(channel, DevicesModulePropertyCategory.level);
      case DevicesModuleChannelCategory.flow:
        return _findProp(channel, DevicesModulePropertyCategory.rate);

      // Air quality: numeric aqi > enum level
      case DevicesModuleChannelCategory.airQuality:
        return _findProp(channel, DevicesModulePropertyCategory.aqi) ??
            _findProp(channel, DevicesModulePropertyCategory.level);

      // Air quality gases: numeric concentration > enum level > binary detected
      case DevicesModuleChannelCategory.volatileOrganicCompounds:
      case DevicesModuleChannelCategory.ozone:
      case DevicesModuleChannelCategory.sulphurDioxide:
        return _findProp(
                channel, DevicesModulePropertyCategory.concentration) ??
            _findProp(channel, DevicesModulePropertyCategory.level) ??
            _findProp(channel, DevicesModulePropertyCategory.detected);

      // Air quality gases (no level property): numeric concentration > binary detected
      case DevicesModuleChannelCategory.airParticulate:
      case DevicesModuleChannelCategory.carbonDioxide:
      case DevicesModuleChannelCategory.carbonMonoxide:
      case DevicesModuleChannelCategory.nitrogenDioxide:
        return _findProp(
                channel, DevicesModulePropertyCategory.concentration) ??
            _findProp(channel, DevicesModulePropertyCategory.detected);

      // Gas: numeric concentration > enum status > binary detected
      case DevicesModuleChannelCategory.gas:
        return _findProp(
                channel, DevicesModulePropertyCategory.concentration) ??
            _findProp(channel, DevicesModulePropertyCategory.status) ??
            _findProp(channel, DevicesModulePropertyCategory.detected);

      // Alarm: enum state > enum alarmState > binary triggered
      case DevicesModuleChannelCategory.alarm:
        return _findProp(channel, DevicesModulePropertyCategory.state) ??
            _findProp(
                channel, DevicesModulePropertyCategory.alarmState) ??
            _findProp(channel, DevicesModulePropertyCategory.triggered);

      // Detection-only sensors (binary)
      case DevicesModuleChannelCategory.contact:
      case DevicesModuleChannelCategory.leak:
      case DevicesModuleChannelCategory.motion:
      case DevicesModuleChannelCategory.occupancy:
      case DevicesModuleChannelCategory.smoke:
        return _findProp(channel, DevicesModulePropertyCategory.detected);

      // Power & energy: numeric with fallbacks
      case DevicesModuleChannelCategory.electricalEnergy:
        return _findProp(
                channel, DevicesModulePropertyCategory.consumption) ??
            _findProp(channel, DevicesModulePropertyCategory.rate);
      case DevicesModuleChannelCategory.electricalPower:
        return _findProp(channel, DevicesModulePropertyCategory.power) ??
            _findProp(channel, DevicesModulePropertyCategory.voltage) ??
            _findProp(channel, DevicesModulePropertyCategory.current);

      // Device info
      case DevicesModuleChannelCategory.battery:
        return _findProp(channel, DevicesModulePropertyCategory.percentage) ??
            _findProp(channel, DevicesModulePropertyCategory.status);
      case DevicesModuleChannelCategory.filter:
        return _findProp(
                channel, DevicesModulePropertyCategory.lifeRemaining) ??
            _findProp(channel, DevicesModulePropertyCategory.status) ??
            _findProp(channel, DevicesModulePropertyCategory.changeNeeded);

      default:
        return channel.properties.isNotEmpty ? channel.properties.first : null;
    }
  }

  /// Find a property by category in a channel's properties list.
  static ChannelPropertyView? _findProp(
    ChannelView channel,
    DevicesModulePropertyCategory propCategory,
  ) {
    try {
      return channel.properties.firstWhere((p) => p.category == propCategory);
    } catch (_) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Detection state resolution (private)
  // ---------------------------------------------------------------------------

  static const _detectionCategories = {
    DevicesModuleChannelCategory.contact,
    DevicesModuleChannelCategory.leak,
    DevicesModuleChannelCategory.motion,
    DevicesModuleChannelCategory.occupancy,
    DevicesModuleChannelCategory.smoke,
  };

  /// Property categories that represent a boolean (binary) value.
  /// When the resolved best property belongs to one of these categories,
  /// the sensor detail shows an event log instead of a numeric chart.
  static const _binaryPropertyCategories = {
    DevicesModulePropertyCategory.detected,
    DevicesModulePropertyCategory.changeNeeded,
    DevicesModulePropertyCategory.triggered,
  };

  /// Auto-resolves `isDetection` for channels that display a binary property.
  ///
  /// Pure detection channels (contact, leak, motion, …) are always binary.
  /// For other channels (VOC, CO, O₃, …), the sensor is treated as binary
  /// when their best available property is the `detected` boolean property.
  /// Returns `null` when the sensor should use numeric display.
  static bool? _resolveIsDetection(
    ChannelView channel, [
    ChannelPropertyView? resolvedProperty,
  ]) {
    // Pure detection channels — always binary
    if (_detectionCategories.contains(channel.category)) {
      final detectedProp =
          _findProp(channel, DevicesModulePropertyCategory.detected);
      if (detectedProp == null) return null;

      final value = detectedProp.value;
      if (value is BooleanValueType) return value.value;
      if (value is StringValueType) {
        return value.value == 'true' || value.value == '1';
      }

      return false;
    }

    // For other channels: if the resolved (best) property is a known binary
    // category OR has boolean data type, treat as binary.
    // Examples: VOC with only `detected`, filter with only `change_needed`,
    // alarm with only `triggered`, or any property with data_type=bool.
    final prop = resolvedProperty ?? _resolveProperty(channel);
    if (prop != null &&
        (_binaryPropertyCategories.contains(prop.category) ||
            prop.dataType == DevicesModuleDataType.bool)) {
      final value = prop.value;
      if (value is BooleanValueType) return value.value;
      if (value is StringValueType) {
        return value.value == 'true' || value.value == '1';
      }

      return false;
    }

    return null;
  }

  // ===========================================================================
  // SECTION 7: Enum / Binary / Label translation (from SensorEnumUtils)
  // ===========================================================================

  /// Translates sensor enum string values to localized labels.
  ///
  /// Use [short] = true for compact tile display, false for detail/long display.
  /// Returns null if no translation is found.
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
        return isActive ? l.sensor_state_detected : l.sensor_state_clear;
      case DevicesModuleChannelCategory.occupancy:
        return isActive
            ? l.sensor_state_occupied
            : l.sensor_state_unoccupied;
      case DevicesModuleChannelCategory.contact:
      case DevicesModuleChannelCategory.door:
      case DevicesModuleChannelCategory.doorbell:
        return isActive ? l.sensor_state_open : l.sensor_state_closed;
      case DevicesModuleChannelCategory.smoke:
        return isActive
            ? (short
                ? l.sensor_state_detected
                : l.sensor_state_smoke_detected)
            : l.sensor_state_clear;
      case DevicesModuleChannelCategory.gas:
        return isActive
            ? (short
                ? l.sensor_state_detected
                : l.sensor_state_gas_detected)
            : l.sensor_state_clear;
      case DevicesModuleChannelCategory.leak:
        return isActive
            ? (short
                ? l.sensor_state_detected
                : l.sensor_state_leak_detected)
            : l.sensor_state_clear;
      case DevicesModuleChannelCategory.carbonMonoxide:
        return isActive
            ? (short
                ? l.sensor_state_detected
                : l.sensor_state_co_detected)
            : l.sensor_state_clear;
      case DevicesModuleChannelCategory.volatileOrganicCompounds:
      case DevicesModuleChannelCategory.carbonDioxide:
      case DevicesModuleChannelCategory.nitrogenDioxide:
      case DevicesModuleChannelCategory.ozone:
      case DevicesModuleChannelCategory.sulphurDioxide:
      case DevicesModuleChannelCategory.airParticulate:
        return isActive
            ? l.air_quality_unhealthy
            : l.air_quality_healthy;
      case DevicesModuleChannelCategory.filter:
        return isActive
            ? (short
                ? l.sensor_enum_filter_replace_now
                : l.sensor_enum_filter_replace_now_long)
            : (short
                ? l.sensor_enum_filter_good
                : l.sensor_enum_filter_good_long);
      case DevicesModuleChannelCategory.alarm:
        return isActive
            ? (short
                ? l.sensor_enum_alarm_alarm_triggered
                : l.sensor_enum_alarm_alarm_triggered_long)
            : (short
                ? l.sensor_enum_alarm_alarm_idle
                : l.sensor_enum_alarm_alarm_idle_long);
      default:
        return isActive ? l.sensor_state_active : l.sensor_state_inactive;
    }
  }

  /// Translate a [FilterStatusValue] enum to a localized label.
  ///
  /// Returns a placeholder when [status] is null.
  static String translateFilterStatus(
    AppLocalizations l,
    FilterStatusValue? status, {
    bool short = true,
  }) {
    if (status == null) return '--';
    return _filterStatus(l, status.value, short: short) ?? status.value;
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

  // ---------------------------------------------------------------------------
  // Private enum translation methods
  // ---------------------------------------------------------------------------

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
