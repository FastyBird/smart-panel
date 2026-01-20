import 'dart:ui';

import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/modules/devices/models/control_state.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';

/// Controller for light channel with optimistic UI support.
///
/// Wraps [LightChannelView] and provides:
/// - Optimistic-aware getters that return desired values when commands are pending
/// - Command methods that manage the optimistic UI state machine
/// - Group API for color properties (RGB/HSV)
class LightChannelController {
  final String deviceId;
  final LightChannelView channel;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;

  /// Group ID for color properties (RGB or HSV).
  static const String colorGroupId = 'color';

  LightChannelController({
    required this.deviceId,
    required this.channel,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
  })  : _controlState = controlState,
        _devicesService = devicesService;

  // ===========================================================================
  // OPTIMISTIC-AWARE GETTERS
  // ===========================================================================

  /// Whether the light is on (optimistic-aware).
  bool get isOn {
    if (_controlState.isLocked(deviceId, channel.id, channel.onProp.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, channel.onProp.id)
              as bool?;
      if (value != null) return value;
    }
    return channel.on;
  }

  /// Brightness level (optimistic-aware).
  int get brightness {
    final prop = channel.brightnessProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toInt();
    }
    return channel.brightness;
  }

  /// Color white level (optimistic-aware).
  int get colorWhite {
    final prop = channel.colorWhiteProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toInt();
    }
    return channel.colorWhite;
  }

  /// Red color component (optimistic-aware, supports group API).
  int get colorRed {
    // First check group API
    final groupValue = _controlState.getGroupPropertyValue(
      deviceId,
      colorGroupId,
      channel.id,
      channel.colorRedProp?.id ?? '',
    );
    if (groupValue is num) return groupValue.toInt();

    // Then check single property API
    final prop = channel.colorRedProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toInt();
    }
    return channel.colorRed;
  }

  /// Green color component (optimistic-aware, supports group API).
  int get colorGreen {
    // First check group API
    final groupValue = _controlState.getGroupPropertyValue(
      deviceId,
      colorGroupId,
      channel.id,
      channel.colorGreenProp?.id ?? '',
    );
    if (groupValue is num) return groupValue.toInt();

    // Then check single property API
    final prop = channel.colorGreenProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toInt();
    }
    return channel.colorGreen;
  }

  /// Blue color component (optimistic-aware, supports group API).
  int get colorBlue {
    // First check group API
    final groupValue = _controlState.getGroupPropertyValue(
      deviceId,
      colorGroupId,
      channel.id,
      channel.colorBlueProp?.id ?? '',
    );
    if (groupValue is num) return groupValue.toInt();

    // Then check single property API
    final prop = channel.colorBlueProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toInt();
    }
    return channel.colorBlue;
  }

  /// Hue value (optimistic-aware, supports group API).
  double get hue {
    // First check group API
    final groupValue = _controlState.getGroupPropertyValue(
      deviceId,
      colorGroupId,
      channel.id,
      channel.hueProp?.id ?? '',
    );
    if (groupValue is num) return groupValue.toDouble();

    // Then check single property API
    final prop = channel.hueProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toDouble();
    }
    return channel.hue;
  }

  /// Saturation value (optimistic-aware, supports group API).
  int get saturation {
    // First check group API
    final groupValue = _controlState.getGroupPropertyValue(
      deviceId,
      colorGroupId,
      channel.id,
      channel.saturationProp?.id ?? '',
    );
    if (groupValue is num) return groupValue.toInt();

    // Then check single property API
    final prop = channel.saturationProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toInt();
    }
    return channel.saturation;
  }

  /// Current color (optimistic-aware, supports both RGB and HSV).
  Color get color {
    if (_controlState.isGroupLocked(deviceId, colorGroupId) ||
        _isAnyColorPropertyLocked()) {
      // Build color from optimistic values
      if (channel.hasColorRed &&
          channel.hasColorGreen &&
          channel.hasColorBlue) {
        return ColorUtils.fromRGB(colorRed, colorGreen, colorBlue);
      } else if (channel.hasHue && channel.hasSaturation) {
        return ColorUtils.fromHSV(
          hue,
          saturation.toDouble(),
          brightness.toDouble(),
        );
      }
    }
    return channel.color;
  }

  // ===========================================================================
  // PASSTHROUGH GETTERS
  // ===========================================================================

  bool get hasBrightness => channel.hasBrightness;
  int get minBrightness => channel.minBrightness;
  int get maxBrightness => channel.maxBrightness;
  bool get hasColor => channel.hasColor;
  bool get hasColorWhite => channel.hasColorWhite;
  int get minColorWhite => channel.minColorWhite;
  int get maxColorWhite => channel.maxColorWhite;
  bool get hasColorRed => channel.hasColorRed;
  int get minColorRed => channel.minColorRed;
  int get maxColorRed => channel.maxColorRed;
  bool get hasColorGreen => channel.hasColorGreen;
  int get minColorGreen => channel.minColorGreen;
  int get maxColorGreen => channel.maxColorGreen;
  bool get hasColorBlue => channel.hasColorBlue;
  int get minColorBlue => channel.minColorBlue;
  int get maxColorBlue => channel.maxColorBlue;
  bool get hasHue => channel.hasHue;
  double get minHue => channel.minHue;
  double get maxHue => channel.maxHue;
  bool get hasSaturation => channel.hasSaturation;
  int get minSaturation => channel.minSaturation;
  int get maxSaturation => channel.maxSaturation;
  bool get hasTemperature => channel.hasTemperature;
  Color get temperature => channel.temperature;

  // ===========================================================================
  // COMMANDS
  // ===========================================================================

  /// Set power state with optimistic UI.
  void setPower(bool value) {
    final prop = channel.onProp;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Toggle power state with optimistic UI.
  void togglePower() {
    setPower(!isOn);
  }

  /// Set brightness with optimistic UI.
  void setBrightness(int value) {
    final prop = channel.brightnessProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set color white level with optimistic UI.
  void setColorWhite(int value) {
    final prop = channel.colorWhiteProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set RGB color with optimistic UI using group API.
  void setColorRGB(int red, int green, int blue) {
    final redProp = channel.colorRedProp;
    final greenProp = channel.colorGreenProp;
    final blueProp = channel.colorBlueProp;

    if (redProp == null || greenProp == null || blueProp == null) return;

    _controlState.setGroupPending(
      deviceId,
      colorGroupId,
      [
        PropertyConfig(
          channelId: channel.id,
          propertyId: redProp.id,
          desiredValue: red,
        ),
        PropertyConfig(
          channelId: channel.id,
          propertyId: greenProp.id,
          desiredValue: green,
        ),
        PropertyConfig(
          channelId: channel.id,
          propertyId: blueProp.id,
          desiredValue: blue,
        ),
      ],
    );

    Future.wait([
      _devicesService.setPropertyValue(redProp.id, red),
      _devicesService.setPropertyValue(greenProp.id, green),
      _devicesService.setPropertyValue(blueProp.id, blue),
    ]).then((_) {
      _controlState.setGroupSettling(deviceId, colorGroupId);
    });
  }

  /// Set HSV color with optimistic UI using group API.
  void setColorHSV(double hue, int saturation, int brightness) {
    final hueProp = channel.hueProp;
    final satProp = channel.saturationProp;
    final brightProp = channel.brightnessProp;

    final List<PropertyConfig> properties = [];
    final List<Future<bool>> futures = [];

    if (hueProp != null) {
      properties.add(PropertyConfig(
        channelId: channel.id,
        propertyId: hueProp.id,
        desiredValue: hue,
      ));
      futures.add(_devicesService.setPropertyValue(hueProp.id, hue));
    }

    if (satProp != null) {
      properties.add(PropertyConfig(
        channelId: channel.id,
        propertyId: satProp.id,
        desiredValue: saturation,
      ));
      futures.add(_devicesService.setPropertyValue(satProp.id, saturation));
    }

    if (brightProp != null) {
      properties.add(PropertyConfig(
        channelId: channel.id,
        propertyId: brightProp.id,
        desiredValue: brightness,
      ));
      futures.add(_devicesService.setPropertyValue(brightProp.id, brightness));
    }

    if (properties.isEmpty) return;

    _controlState.setGroupPending(deviceId, colorGroupId, properties);

    Future.wait(futures).then((_) {
      _controlState.setGroupSettling(deviceId, colorGroupId);
    });
  }

  /// Set color from Color object with optimistic UI.
  void setColor(Color value) {
    if (channel.hasColorRed &&
        channel.hasColorGreen &&
        channel.hasColorBlue) {
      setColorRGB(value.r.toInt(), value.g.toInt(), value.b.toInt());
    } else if (channel.hasHue && channel.hasSaturation) {
      final hsv = ColorUtils.toHSV(value);
      setColorHSV(hsv.hue, hsv.saturation.toInt(), hsv.value.toInt());
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  bool _isAnyColorPropertyLocked() {
    final redProp = channel.colorRedProp;
    final greenProp = channel.colorGreenProp;
    final blueProp = channel.colorBlueProp;
    final hueProp = channel.hueProp;
    final satProp = channel.saturationProp;

    return (redProp != null &&
            _controlState.isLocked(deviceId, channel.id, redProp.id)) ||
        (greenProp != null &&
            _controlState.isLocked(deviceId, channel.id, greenProp.id)) ||
        (blueProp != null &&
            _controlState.isLocked(deviceId, channel.id, blueProp.id)) ||
        (hueProp != null &&
            _controlState.isLocked(deviceId, channel.id, hueProp.id)) ||
        (satProp != null &&
            _controlState.isLocked(deviceId, channel.id, satProp.id));
  }
}
