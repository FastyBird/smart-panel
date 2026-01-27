import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Light capability types
enum LightCapability {
  power,
  brightness,
  colorTemp,
  color,
  white,
}

/// State of the lighting role/device
enum LightingState {
  /// All values are synced
  synced,

  /// Values are mixed (different across channels)
  mixed,

  /// Values are not synced with device
  unsynced,
}

/// Data model for a lighting channel displayed in tiles
class LightingChannelData {
  final String id;
  final String name;
  final bool isOn;
  final int brightness;
  final bool hasBrightness;
  final bool isOnline;
  final bool isSelected;

  const LightingChannelData({
    required this.id,
    required this.name,
    required this.isOn,
    this.brightness = 100,
    this.hasBrightness = true,
    this.isOnline = true,
    this.isSelected = false,
  });

  /// Get status text for display
  String getStatusText(AppLocalizations localizations) {
    if (!isOnline) return localizations.device_status_offline;
    if (isOn) {
      return hasBrightness ? '$brightness%' : localizations.on_state_on;
    }
    return localizations.on_state_off;
  }
}

/// Preset type for lighting presets
enum LightPresetType {
  brightness,
  colorTemp,
  color,
  white,
}

/// Data model for a lighting preset
class LightPreset {
  final dynamic icon;
  final String label;
  final int value;
  final LightPresetType type;
  final dynamic color;

  const LightPreset({
    required this.icon,
    required this.label,
    required this.value,
    required this.type,
    this.color,
  });
}
