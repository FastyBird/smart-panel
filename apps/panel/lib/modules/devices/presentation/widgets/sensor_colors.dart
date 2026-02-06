import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';

/// Standardized sensor colors for consistent UI across all sensor displays.
/// Returns [ThemeColors]; resolve to [Color] via [ThemeColorFamily.get](brightness, color).base where needed.
class SensorColors {
  /// Theme color for a channel category. Use for tile [activeColor], [iconAccentColor],
  /// header icon color, chart line color, etc.
  /// Returns [ThemeColors.neutral] for unknown/unmapped categories.
  static ThemeColors themeColorForCategory(DevicesModuleChannelCategory category) {
    switch (category) {
      case DevicesModuleChannelCategory.temperature:
      case DevicesModuleChannelCategory.pressure:
      case DevicesModuleChannelCategory.illuminance:
        return ThemeColors.info;
      case DevicesModuleChannelCategory.humidity:
        return ThemeColors.success;
      case DevicesModuleChannelCategory.airQuality:
      case DevicesModuleChannelCategory.airParticulate:
      case DevicesModuleChannelCategory.volatileOrganicCompounds:
      case DevicesModuleChannelCategory.ozone:
      case DevicesModuleChannelCategory.nitrogenDioxide:
      case DevicesModuleChannelCategory.sulphurDioxide:
      case DevicesModuleChannelCategory.contact:
      case DevicesModuleChannelCategory.leak:
      case DevicesModuleChannelCategory.smoke:
      case DevicesModuleChannelCategory.motion:
      case DevicesModuleChannelCategory.occupancy:
        return ThemeColors.warning;
      case DevicesModuleChannelCategory.carbonDioxide:
      case DevicesModuleChannelCategory.carbonMonoxide:
        return ThemeColors.error;
      case DevicesModuleChannelCategory.filter:
        return ThemeColors.teal;
      default:
        return ThemeColors.neutral;
    }
  }

  /// Temperature sensor (info/blue)
  static ThemeColors get temperature => ThemeColors.info;

  /// Humidity sensor (success/green)
  static ThemeColors get humidity => ThemeColors.success;

  /// Air quality (warning/orange) - AQI, PM, VOC
  static ThemeColors get airQuality => ThemeColors.warning;

  /// CO2 sensor (error/red)
  static ThemeColors get co2 => ThemeColors.error;

  /// Pressure sensor (info/blue)
  static ThemeColors get pressure => ThemeColors.info;

  /// Contact/leak sensor (warning/orange)
  static ThemeColors get alert => ThemeColors.warning;

  /// Filter sensor (teal)
  static ThemeColors get filter => ThemeColors.teal;

  /// Fallback for unknown sensor types
  static ThemeColors get defaultColor => ThemeColors.neutral;

  /// Danger/alert state (e.g. sensor in alert status)
  static ThemeColors get danger => ThemeColors.danger;
}
