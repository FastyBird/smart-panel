import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_mode_navigation.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_state_display.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Full-page detail view for a single light channel.
///
/// Used when tapping on a channel tile in a multi-channel device.
/// Has the same layout pattern as role detail:
/// - Two-column layout with state display on left, slider on right
/// - Bottom navigation for mode switching
class LightChannelDetailPage extends StatefulWidget {
  /// The parent device
  final LightingDeviceView device;

  /// The channel to display
  final LightChannelView channel;

  const LightChannelDetailPage({
    super.key,
    required this.device,
    required this.channel,
  });

  @override
  State<LightChannelDetailPage> createState() => _LightChannelDetailPageState();
}

class _LightChannelDetailPageState extends State<LightChannelDetailPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  late List<LightMode> _availableModes;
  late LightMode _currentMode;

  @override
  void initState() {
    super.initState();

    _availableModes = LightModeNavigation.createModesList(
      hasBrightness: widget.channel.hasBrightness,
      hasColor: widget.channel.hasColor,
      hasTemperature: widget.channel.hasTemperature,
      hasWhite: widget.channel.hasColorWhite,
    );

    // Start with brightness mode if available, otherwise first available
    if (_availableModes.contains(LightMode.brightness)) {
      _currentMode = LightMode.brightness;
    } else if (_availableModes.length > 1) {
      _currentMode = _availableModes[1];
    } else {
      _currentMode = LightMode.off;
    }
  }

  @override
  Widget build(BuildContext context) {
    final channel = widget.channel;
    final isSimple = !channel.hasBrightness &&
        !channel.hasColor &&
        !channel.hasTemperature &&
        !channel.hasColorWhite;

    return Scaffold(
      appBar: AppTopBar(
        title: channel.name,
      ),
      body: Column(
        children: [
          Expanded(
            child: SafeArea(
              bottom: false,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final elementMaxSize =
                      constraints.maxHeight * 0.75 - 2 * AppSpacings.pMd;

                  return Padding(
                    padding: AppSpacings.paddingMd,
                    child: Row(
                      children: [
                        // Left column: state display and color info
                        Expanded(
                          child: Padding(
                            padding: EdgeInsets.only(right: AppSpacings.pLg),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // State display
                                LightStateDisplay(
                                  brightness: channel.brightness,
                                  anyOn: channel.on,
                                  hasBrightness: channel.hasBrightness,
                                  useSingular: true,
                                ),
                                if (channel.hasColor || channel.hasTemperature)
                                  AppSpacings.spacingMdVertical,
                                // Color and temperature indicators
                                Wrap(
                                  spacing: AppSpacings.pMd,
                                  runSpacing: AppSpacings.pMd,
                                  children: [
                                    if (channel.hasColor)
                                      ChannelActualColor(channel: channel),
                                    if (channel.hasTemperature)
                                      ChannelActualTemperature(channel: channel),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        // Right column: control slider
                        SizedBox(
                          width: _screenService.scale(
                            80,
                            density: _visualDensityService.density,
                          ),
                          child: isSimple
                              ? _buildOnOffSwitch(context, elementMaxSize)
                              : _buildControlSlider(context, elementMaxSize),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
          // Bottom navigation (only if more than just on/off)
          if (_availableModes.length > 1)
            SafeArea(
              top: false,
              child: LightModeNavigation(
                availableModes: _availableModes,
                currentMode: _currentMode,
                anyOn: channel.on,
                onModeSelected: (mode) {
                  setState(() {
                    _currentMode = mode;
                  });
                  // Turn on if selecting a control mode while off
                  if (!channel.on && mode != LightMode.off) {
                    _toggleChannel(true);
                  }
                },
                onPowerToggle: () => _toggleChannel(!channel.on),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOnOffSwitch(BuildContext context, double elementMaxSize) {
    return ColoredSwitch(
      switchState: widget.channel.on,
      iconOn: MdiIcons.power,
      iconOff: MdiIcons.power,
      trackWidth: elementMaxSize,
      vertical: true,
      onChanged: (value) => _toggleChannel(value),
    );
  }

  Widget _buildControlSlider(BuildContext context, double elementMaxSize) {
    final channel = widget.channel;

    switch (_currentMode) {
      case LightMode.off:
      case LightMode.brightness:
        if (channel.brightnessProp != null) {
          return BrightnessChannel(
            channel: channel,
            deviceId: widget.device.id,
            channelId: channel.id,
            propertyId: channel.brightnessProp!.id,
            vertical: true,
            elementMaxSize: elementMaxSize,
            onValueChanged: (value) async {
              _valueHelper.setPropertyValue(
                context,
                channel.brightnessProp!,
                value,
                deviceId: widget.device.id,
                channelId: channel.id,
              );
            },
          );
        }
        // Fallback to on/off switch
        return _buildOnOffSwitch(context, elementMaxSize);

      case LightMode.color:
        if (channel.hasColor) {
          return ColorChannel(
            channel: channel,
            deviceId: widget.device.id,
            channelId: channel.id,
            vertical: true,
            elementMaxSize: elementMaxSize,
            onValueChanged: (Color value) async {
              await _setColorValue(value);
            },
          );
        }
        return const SizedBox.shrink();

      case LightMode.temperature:
        if (channel.temperatureProp != null) {
          return TemperatureChannel(
            channel: channel,
            deviceId: widget.device.id,
            channelId: channel.id,
            propertyId: channel.temperatureProp!.id,
            vertical: true,
            elementMaxSize: elementMaxSize,
            onValueChanged: (value) async {
              _valueHelper.setPropertyValue(
                context,
                channel.temperatureProp!,
                value,
                deviceId: widget.device.id,
                channelId: channel.id,
              );
            },
          );
        }
        return const SizedBox.shrink();

      case LightMode.white:
        if (channel.colorWhiteProp != null) {
          return WhiteChannel(
            channel: channel,
            deviceId: widget.device.id,
            channelId: channel.id,
            propertyId: channel.colorWhiteProp!.id,
            vertical: true,
            elementMaxSize: elementMaxSize,
            onValueChanged: (value) async {
              _valueHelper.setPropertyValue(
                context,
                channel.colorWhiteProp!,
                value,
                deviceId: widget.device.id,
                channelId: channel.id,
              );
            },
          );
        }
        return const SizedBox.shrink();
    }
  }

  Future<void> _toggleChannel(bool newState) async {
    _valueHelper.setPropertyValue(
      context,
      widget.channel.onProp,
      newState,
      deviceId: widget.device.id,
      channelId: widget.channel.id,
    );
  }

  Future<void> _setColorValue(Color value) async {
    final channel = widget.channel;
    final rgbValue = ColorUtils.toRGB(value);
    final hsvValue = ColorUtils.toHSV(value);

    final List<PropertyCommandItem> properties = [];

    if (channel.colorRedProp != null) {
      properties.add(PropertyCommandItem(
        deviceId: widget.device.id,
        channelId: channel.id,
        propertyId: channel.colorRedProp!.id,
        value: rgbValue.red,
      ));
    }

    if (channel.colorGreenProp != null) {
      properties.add(PropertyCommandItem(
        deviceId: widget.device.id,
        channelId: channel.id,
        propertyId: channel.colorGreenProp!.id,
        value: rgbValue.green,
      ));
    }

    if (channel.colorBlueProp != null) {
      properties.add(PropertyCommandItem(
        deviceId: widget.device.id,
        channelId: channel.id,
        propertyId: channel.colorBlueProp!.id,
        value: rgbValue.blue,
      ));
    }

    if (channel.hueProp != null) {
      properties.add(PropertyCommandItem(
        deviceId: widget.device.id,
        channelId: channel.id,
        propertyId: channel.hueProp!.id,
        value: hsvValue.hue,
      ));
    }

    if (channel.saturationProp != null) {
      properties.add(PropertyCommandItem(
        deviceId: widget.device.id,
        channelId: channel.id,
        propertyId: channel.saturationProp!.id,
        value: hsvValue.saturation,
      ));
    }

    if (properties.isNotEmpty) {
      await _valueHelper.setMultiplePropertyValues(context, properties);
    }
  }
}
