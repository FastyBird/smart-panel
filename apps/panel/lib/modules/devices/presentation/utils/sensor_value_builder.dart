import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart'
    show buildChannelIcon;
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_enum_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/value.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/material.dart';

/// Centralized builder for [SensorData] — single source of truth for decimal
/// places, property priority resolution, and default labels per channel category.
///
/// Follows the same pattern as [SensorColors] and [buildChannelIcon].
class SensorValueBuilder {
  // ---------------------------------------------------------------------------
  // Level 1: Decimal places per category
  // ---------------------------------------------------------------------------

  /// Temperature channels display 1 decimal place; everything else uses 0.
  static int scaleForCategory(DevicesModuleChannelCategory category) {
    switch (category) {
      case DevicesModuleChannelCategory.temperature:
        return 1;
      default:
        return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Level 2: Value formatter closure
  // ---------------------------------------------------------------------------

  /// Returns a [valueFormatter] closure with the correct decimal places for
  /// [category]. Equivalent to `(prop) => ValueUtils.formatValue(prop, scale)`.
  static String? Function(ChannelPropertyView) valueFormatterForCategory(
    DevicesModuleChannelCategory category,
  ) {
    final scale = scaleForCategory(category);
    return (prop) => ValueUtils.formatValue(prop, scale);
  }

  // ---------------------------------------------------------------------------
  // Level 3: Full SensorData from a channel
  // ---------------------------------------------------------------------------

  /// Builds a complete [SensorData] from a [ChannelView].
  ///
  /// Resolves the best property to display, sets the icon/label/formatter/
  /// detection state automatically based on channel category. All fields can
  /// be overridden for special cases (battery icon, contact icon, alert state).
  ///
  /// When [localizations] is provided, the label is localized via
  /// [SensorEnumUtils.translateSensorLabel]. Otherwise the channel name or
  /// category json identifier is used as a fallback.
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

    // Resolve detection state
    final resolvedIsDetection = isDetection ?? _resolveIsDetection(channel);

    // Resolve label: caller override → localized → channel name → category json
    final resolvedLabel = label ??
        (localizations != null
            ? SensorEnumUtils.translateSensorLabel(localizations, category)
            : (channel.name.isNotEmpty
                ? channel.name
                : category.json ?? category.toString()));

    return SensorData(
      label: resolvedLabel,
      icon: icon ?? buildChannelIcon(category),
      channel: channel,
      property: resolvedProperty,
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
      // Environmental: single dedicated property
      case DevicesModuleChannelCategory.temperature:
        return _findProp(channel, DevicesModulePropertyCategory.temperature);
      case DevicesModuleChannelCategory.humidity:
        return _findProp(channel, DevicesModulePropertyCategory.humidity);
      case DevicesModuleChannelCategory.pressure:
        return _findProp(channel, DevicesModulePropertyCategory.pressure);
      case DevicesModuleChannelCategory.illuminance:
        return _findProp(channel, DevicesModulePropertyCategory.illuminance);

      // Air quality: concentration > detected
      case DevicesModuleChannelCategory.airParticulate:
      case DevicesModuleChannelCategory.carbonDioxide:
      case DevicesModuleChannelCategory.carbonMonoxide:
      case DevicesModuleChannelCategory.nitrogenDioxide:
        return _findProp(
                channel, DevicesModulePropertyCategory.concentration) ??
            _findProp(channel, DevicesModulePropertyCategory.detected);

      // Gas sensors with level: level > concentration > detected
      case DevicesModuleChannelCategory.volatileOrganicCompounds:
      case DevicesModuleChannelCategory.ozone:
      case DevicesModuleChannelCategory.sulphurDioxide:
        return _findProp(channel, DevicesModulePropertyCategory.level) ??
            _findProp(
                channel, DevicesModulePropertyCategory.concentration) ??
            _findProp(channel, DevicesModulePropertyCategory.detected);

      // Detection-only sensors
      case DevicesModuleChannelCategory.contact:
      case DevicesModuleChannelCategory.leak:
      case DevicesModuleChannelCategory.motion:
      case DevicesModuleChannelCategory.occupancy:
      case DevicesModuleChannelCategory.smoke:
        return _findProp(channel, DevicesModulePropertyCategory.detected);

      // Device info
      case DevicesModuleChannelCategory.battery:
        return _findProp(channel, DevicesModulePropertyCategory.percentage);
      case DevicesModuleChannelCategory.filter:
        return _findProp(
                channel, DevicesModulePropertyCategory.lifeRemaining) ??
            _findProp(channel, DevicesModulePropertyCategory.status);

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

  /// Auto-resolves `isDetection` for detection-type channels by reading the
  /// `detected` property value. Returns `null` for non-detection channels.
  static bool? _resolveIsDetection(ChannelView channel) {
    if (!_detectionCategories.contains(channel.category)) return null;

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
}
