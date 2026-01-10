import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/utils/enum.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/export.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_switch.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_channel_detail.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart'
    show DeviceControlStateService, ControlUIState;
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/value.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/modules/displays/export.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class LightingDeviceDetail extends StatefulWidget {
  final LightingDeviceView _device;
  final String? initialChannelId;

  const LightingDeviceDetail({
    super.key,
    required LightingDeviceView device,
    this.initialChannelId,
  }) : _device = device;

  @override
  State<LightingDeviceDetail> createState() => _LightingDeviceDetailState();
}

class _LightingDeviceDetailState extends State<LightingDeviceDetail> {
  DeviceControlStateService? _deviceControlStateService;
  IntentOverlayService? _intentOverlayService;

  late List<LightChannelView> _channels;

  @override
  void initState() {
    super.initState();

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightingDeviceDetail] Failed to get DeviceControlStateService: $e');
    }

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightingDeviceDetail] Failed to get IntentOverlayService: $e');
    }

    _initializeWidget();
  }

  @override
  void dispose() {
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _onIntentChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void didUpdateWidget(covariant LightingDeviceDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    _initializeWidget();
  }

  void _initializeWidget() {
    _channels = widget._device.lightChannels;
  }

  bool get _isSimple => widget._device.isSimpleLight;
  bool get _isMultiChannel => _channels.length > 1;

  @override
  Widget build(BuildContext context) {
    // Multi-channel device: tiles grid
    if (_isMultiChannel) {
      return _buildMultiChannelLayout(context);
    }

    // Simple device with single channel: just ON/OFF
    if (_isSimple) {
      return _buildSimpleDeviceLayout(context);
    }

    // Single channel with capabilities
    return _buildSingleChannelLayout(context);
  }

  /// Layout for simple ON/OFF devices with single channel
  Widget _buildSimpleDeviceLayout(BuildContext context) {
    final channel = _channels.first;

    return LightSingleChannelControlPanel(
      device: widget._device,
      channel: channel,
      showHeader: true,
      onBack: () => Navigator.pop(context),
    );
  }

  /// Layout for single channel devices with capabilities
  Widget _buildSingleChannelLayout(BuildContext context) {
    final channel = _channels.first;

    return LightSingleChannelControlPanel(
      device: widget._device,
      channel: channel,
      showHeader: true,
      onBack: () => Navigator.pop(context),
    );
  }

  /// Layout for multi-channel devices using LightMultiChannelControlPanel
  Widget _buildMultiChannelLayout(BuildContext context) {
    return LightMultiChannelControlPanel(
      device: widget._device,
      channels: _channels,
      showHeader: true,
      onBack: () => Navigator.pop(context),
      onChannelTap: (channel) => _openChannelDetail(context, channel),
      initialChannelId: widget.initialChannelId,
    );
  }

  /// Open channel detail page
  void _openChannelDetail(BuildContext context, LightChannelView channel) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => LightChannelDetailPage(
          device: widget._device,
          channel: channel,
        ),
      ),
    );
  }
}

class LightSimpleDetail extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  final LightingDeviceView _device;
  final bool _withBrightness;

  LightSimpleDetail({
    super.key,
    required LightingDeviceView device,
    bool withBrightness = false,
  })  : _device = device,
        _withBrightness = withBrightness;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      double elementMaxSize = constraints.maxHeight * 0.8 - 2 * AppSpacings.pLg;

      if (_withBrightness) {
        elementMaxSize = elementMaxSize -
            _screenService.scale(
              45,
              density: _visualDensityService.density,
            ) -
            AppSpacings.pSm;
      }

      final List<Widget> controlElements = _device.lightChannels
          .map(
            (lightCapability) => _withBrightness
                ? Column(
                    children: [
                      Column(
                        children: [
                          BrightnessChannel(
                            channel: lightCapability,
                            elementMaxSize: elementMaxSize,
                            vertical: true,
                            showValue: true,
                            onValueChanged: (double value) async {
                              final brightnessProp =
                                  lightCapability.brightnessProp;

                              if (brightnessProp == null) {
                                return;
                              }

                              _valueHelper.setPropertyValue(
                                context,
                                brightnessProp,
                                value,
                                deviceId: _device.id,
                                channelId: lightCapability.id,
                              );
                            },
                          ),
                          AppSpacings.spacingSmVertical,
                          ChannelSwitch(
                            channel: lightCapability,
                            onStateChanged: (bool state) async {
                              _valueHelper.setPropertyValue(
                                context,
                                lightCapability.onProp,
                                state,
                                deviceId: _device.id,
                                channelId: lightCapability.id,
                              );
                            },
                          ),
                        ],
                      ),
                      _device.lightChannels.length > 1
                          ? Text(
                              lightCapability.name,
                              style: TextStyle(
                                fontSize: AppFontSize.base,
                              ),
                            )
                          : null,
                    ].whereType<Widget>().toList(),
                  )
                : Column(
                    children: [
                      ColoredSwitch(
                        switchState: lightCapability.on,
                        iconOn: MdiIcons.power,
                        iconOff: MdiIcons.power,
                        trackWidth: elementMaxSize,
                        vertical: true,
                        onChanged: (bool state) async {
                          _valueHelper.setPropertyValue(
                            context,
                            lightCapability.onProp,
                            state,
                            deviceId: _device.id,
                            channelId: lightCapability.id,
                          );
                        },
                      ),
                      _device.lightChannels.length > 1
                          ? Text(
                              lightCapability.name,
                              style: TextStyle(
                                fontSize: AppFontSize.base,
                              ),
                            )
                          : null,
                    ].whereType<Widget>().toList(),
                  ),
          )
          .toList();

      return Padding(
        padding: EdgeInsets.symmetric(
          vertical: AppSpacings.pMd,
          horizontal: AppSpacings.pLg,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Wrap(
                  direction: Axis.horizontal,
                  spacing: AppSpacings.pMd,
                  runSpacing: AppSpacings.pMd,
                  children: controlElements,
                ),
              ],
            ),
          ],
        ),
      );
    });
  }
}

class LightSingleChannelDetail extends StatelessWidget {
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  final LightingDeviceView _device;
  final LightChannelView _channel;
  final LightChannelModeType _mode;

  LightSingleChannelDetail({
    super.key,
    required LightingDeviceView device,
    required LightChannelView channel,
    required LightChannelModeType mode,
  })  : _device = device,
        _channel = channel,
        _mode = mode;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final double elementMaxSize = constraints.maxHeight - 2 * AppSpacings.pMd;

      late Widget controlElement;

      final ChannelPropertyView? brightnessProp = _channel.brightnessProp;

      if (_mode == LightChannelModeType.brightness && brightnessProp != null) {
        controlElement = BrightnessChannel(
          channel: _channel,
          deviceId: _device.id,
          channelId: _channel.id,
          propertyId: brightnessProp.id,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) async {
            // If device is off, turn it on first
            if (!_channel.on) {
              await _valueHelper.setPropertyValue(
                context,
                _channel.onProp,
                true,
                deviceId: _device.id,
                channelId: _channel.id,
              );
              if (!context.mounted) return;
            }
            // Set brightness value
            await _valueHelper.setPropertyValue(
              context,
              brightnessProp,
              value,
              deviceId: _device.id,
              channelId: _channel.id,
            );
          },
        );
      }

      if (_mode == LightChannelModeType.color && _channel.hasColor) {
        controlElement = ColorChannel(
          channel: _channel,
          deviceId: _device.id,
          channelId: _channel.id,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (Color value) async {
            final rgbValue = ColorUtils.toRGB(value);
            final hsvValue = ColorUtils.toHSV(value);

            // Build list of all color properties to update in a single batch
            final List<PropertyCommandItem> properties = [];

            // If device is off, turn it on first
            if (!_channel.on) {
              properties.add(PropertyCommandItem(
                deviceId: _device.id,
                channelId: _channel.id,
                propertyId: _channel.onProp.id,
                value: true,
              ));
            }

            if (_channel.colorRedProp != null) {
              properties.add(PropertyCommandItem(
                deviceId: _device.id,
                channelId: _channel.id,
                propertyId: _channel.colorRedProp!.id,
                value: rgbValue.red,
              ));
            }

            if (_channel.colorGreenProp != null) {
              properties.add(PropertyCommandItem(
                deviceId: _device.id,
                channelId: _channel.id,
                propertyId: _channel.colorGreenProp!.id,
                value: rgbValue.green,
              ));
            }

            if (_channel.colorBlueProp != null) {
              properties.add(PropertyCommandItem(
                deviceId: _device.id,
                channelId: _channel.id,
                propertyId: _channel.colorBlueProp!.id,
                value: rgbValue.blue,
              ));
            }

            if (_channel.hueProp != null) {
              properties.add(PropertyCommandItem(
                deviceId: _device.id,
                channelId: _channel.id,
                propertyId: _channel.hueProp!.id,
                value: hsvValue.hue,
              ));
            }

            if (_channel.saturationProp != null) {
              properties.add(PropertyCommandItem(
                deviceId: _device.id,
                channelId: _channel.id,
                propertyId: _channel.saturationProp!.id,
                value: hsvValue.saturation,
              ));
            }

            // Send all properties in a single batch command
            if (properties.isNotEmpty) {
              await _valueHelper.setMultiplePropertyValues(
                context,
                properties,
              );
            }
          },
        );
      }

      final ChannelPropertyView? tempProp = _channel.temperatureProp;

      if (_mode == LightChannelModeType.temperature && tempProp != null) {
        controlElement = TemperatureChannel(
          channel: _channel,
          deviceId: _device.id,
          channelId: _channel.id,
          propertyId: tempProp.id,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) async {
            // If device is off, turn it on first
            if (!_channel.on) {
              await _valueHelper.setPropertyValue(
                context,
                _channel.onProp,
                true,
                deviceId: _device.id,
                channelId: _channel.id,
              );
              if (!context.mounted) return;
            }
            // Set temperature value
            await _valueHelper.setPropertyValue(
              context,
              tempProp,
              value,
              deviceId: _device.id,
              channelId: _channel.id,
            );
          },
        );
      }

      final ChannelPropertyView? colorWhiteProp = _channel.colorWhiteProp;

      if (_mode == LightChannelModeType.white && colorWhiteProp != null) {
        controlElement = WhiteChannel(
          channel: _channel,
          deviceId: _device.id,
          channelId: _channel.id,
          propertyId: colorWhiteProp.id,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) async {
            // If device is off, turn it on first
            if (!_channel.on) {
              await _valueHelper.setPropertyValue(
                context,
                _channel.onProp,
                true,
                deviceId: _device.id,
                channelId: _channel.id,
              );
              if (!context.mounted) return;
            }
            // Set white channel value
            await _valueHelper.setPropertyValue(
              context,
              colorWhiteProp,
              value,
              deviceId: _device.id,
              channelId: _channel.id,
            );
          },
        );
      }

      return Padding(
        padding: AppSpacings.paddingMd,
        child: Row(
          children: [
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(
                  right: AppSpacings.pLg,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Flexible(
                      flex: 0,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_channel.hasBrightness)
                            ChannelActualBrightness(
                              channel: _channel,
                              deviceId: _device.id,
                              channelId: _channel.id,
                            ),
                          AppSpacings.spacingMdVertical,
                          Wrap(
                            spacing: AppSpacings.pMd,
                            runSpacing: AppSpacings.pMd,
                            children: [
                              if (_channel.hasColor)
                                ChannelActualColor(
                                  channel: _channel,
                                ),
                              if (_channel.hasTemperature)
                                ChannelActualTemperature(
                                  channel: _channel,
                                ),
                            ],
                          ),
                        ].whereType<Widget>().toList(),
                      ),
                    ),
                    AppSpacings.spacingSmVertical,
                    Flexible(
                      flex: 1,
                      child: SingleChildScrollView(
                        child: LightTiles(
                          device: _device,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            controlElement,
          ],
        ),
      );
    });
  }
}

class BrightnessChannel extends StatefulWidget {
  final LightChannelView _channel;
  final String? _deviceId;
  final String? _channelId;
  final String? _propertyId;
  final double? _elementMaxSize;
  final bool _vertical;
  final bool _showValue;

  final ValueChanged<double>? _onValueChanged;

  const BrightnessChannel({
    super.key,
    required LightChannelView channel,
    String? deviceId,
    String? channelId,
    String? propertyId,
    double? elementMaxSize,
    bool vertical = false,
    bool showValue = false,
    ValueChanged<double>? onValueChanged,
  })  : _channel = channel,
        _deviceId = deviceId,
        _channelId = channelId,
        _propertyId = propertyId,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _showValue = showValue,
        _onValueChanged = onValueChanged;

  @override
  State<BrightnessChannel> createState() => _BrightnessChannelState();
}

class _BrightnessChannelState extends State<BrightnessChannel> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;

  late ChannelPropertyView? _property;

  late num? _brightness;

  // Debounce timer for API calls (prevents overwhelming backend during rapid dragging)
  Timer? _debounceTimer;

  // Track previous intent lock state to detect when command completes
  bool _wasIntentLocked = false;

  @override
  void initState() {
    super.initState();
    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (_) {}
    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (_) {}
    _initializeWidget();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _intentOverlayService?.removeListener(_onIntentChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onIntentChanged() {
    if (!mounted) return;

    final propertyId = widget._propertyId;
    if (propertyId == null ||
        widget._deviceId == null ||
        widget._channelId == null) {
      setState(() {});
      return;
    }

    // Check current intent lock state
    final isIntentLocked = _intentOverlayService?.isPropertyLocked(
          widget._deviceId!,
          widget._channelId!,
          propertyId,
        ) ?? false;

    setState(() {
      // If intent was locked and is now unlocked, command completed - transition to settling
      if (_wasIntentLocked && !isIntentLocked) {
        final state = _deviceControlStateService?.getState(
          widget._deviceId!,
          widget._channelId!,
          propertyId,
        );
        if (state?.state == ControlUIState.pending) {
          // Command completed, transition to settling
          _deviceControlStateService?.setSettling(
            widget._deviceId!,
            widget._channelId!,
            propertyId,
          );
        }
      }

      _wasIntentLocked = isIntentLocked;
    });
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void didUpdateWidget(covariant BrightnessChannel oldWidget) {
    super.didUpdateWidget(oldWidget);

    _initializeWidget();
  }

  void _initializeWidget() {
    _property = widget._channel.brightnessProp;

    final property = _property;

    _brightness = property != null && property.value is NumberValueType
        ? (property.value as NumberValueType).value
        : null;
  }

  @override
  Widget build(BuildContext context) {
    num min = 0;
    num max = 255;

    final property = _property;

    if (property != null) {
      FormatType? format = property.format;

      if (format is NumberListFormatType && format.value.length == 2) {
        min = format.value[0];
        max = format.value[1];
      }
    }

    // Check if property is locked by control state service (state machine)
    final isControlStateLocked = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? (_deviceControlStateService?.isLocked(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            ) ?? false)
        : false;

    // Check if property is locked by intent overlay
    final isIntentLocked = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.isPropertyLocked(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            ) ?? false
        : false;

    // Get desired value from control state service if locked
    final controlStateValue = isControlStateLocked && widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _deviceControlStateService?.getDesiredValue(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            )
        : null;

    // Get overlay value if locked by intent
    final overlayValue = isIntentLocked && widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.getOverlayValue(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            )
        : null;

    // Priority: control state desired value > overlay value > actual value
    final displayValue = controlStateValue is num
        ? controlStateValue.toDouble()
        : (overlayValue is num
            ? overlayValue.toDouble()
            : (_brightness ?? min));

    return ColoredSlider(
      value: displayValue,
      min: min,
      max: max,
      enabled: true, // Always enabled - don't disable during state machine to prevent blinking
      vertical: widget._vertical,
      trackWidth: widget._elementMaxSize,
      showThumb: false,
      onValueChanged: (double value) {
        // Cancel any existing debounce timer
        _debounceTimer?.cancel();

        // Update state immediately for instant UI feedback (including brightness display)
        setState(() {
          _brightness = value;
        });

        // Set pending state in control state service for optimistic UI
        // This ensures the brightness display updates immediately
        if (widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null) {
          // Cancel any existing settling timer
          final currentState = _deviceControlStateService?.getState(
            widget._deviceId!,
            widget._channelId!,
            widget._propertyId!,
          );
          currentState?.cancelTimer();

          _deviceControlStateService?.setPending(
            widget._deviceId!,
            widget._channelId!,
            widget._propertyId!,
            value,
          );

          // If device is off, also set on/off state to pending for optimistic UI
          if (!widget._channel.on) {
            final onProp = widget._channel.onProp;
            final onState = _deviceControlStateService?.getState(
              widget._deviceId!,
              widget._channelId!,
              onProp.id,
            );
            onState?.cancelTimer();

            _deviceControlStateService?.setPending(
              widget._deviceId!,
              widget._channelId!,
              onProp.id,
              true,
            );
          }
        }

        // Debounce the API call to prevent overwhelming the backend
        _debounceTimer = Timer(
          const Duration(milliseconds: 300),
          () {
            if (!mounted) return;
            widget._onValueChanged?.call(value);
          },
        );
      },
      inner: [
        widget._showValue
            ? Positioned(
                right: _screenService.scale(
                  5,
                  density: _visualDensityService.density,
                ),
                child: RotatedBox(
                  quarterTurns: widget._vertical ? 1 : 0,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      RichText(
                        text: TextSpan(
                          text: (property != null
                                  ? ValueUtils.formatValue(property)
                                  : null) ??
                              '-',
                          style: TextStyle(
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.placeholder
                                    : AppTextColorDark.regular,
                            fontSize: _screenService.scale(
                              50,
                              density: _visualDensityService.density,
                            ),
                            fontFamily: 'DIN1451',
                            fontWeight: FontWeight.w100,
                            height: 1.0,
                          ),
                        ),
                        textAlign: TextAlign.center,
                      ),
                      RichText(
                        text: TextSpan(
                          text: '%',
                          style: TextStyle(
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.placeholder
                                    : AppTextColorDark.regular,
                            fontSize: _screenService.scale(
                              25,
                              density: _visualDensityService.density,
                            ),
                            fontFamily: 'DIN1451',
                            fontWeight: FontWeight.w100,
                            height: 1.0,
                          ),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              )
            : null,
        Positioned(
          left: _screenService.scale(
            20,
            density: _visualDensityService.density,
          ),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: widget._vertical ? 1 : 0,
                child: Icon(
                  MdiIcons.weatherSunny,
                  size: _screenService.scale(
                    40,
                    density: _visualDensityService.density,
                  ),
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.placeholder
                      : AppTextColorDark.regular,
                ),
              ),
            ],
          ),
        ),
      ].whereType<Widget>().toList(),
    );
  }
}

class ColorChannel extends StatefulWidget {
  final LightChannelView _channel;
  final String? _deviceId;
  final String? _channelId;
  final double? _elementMaxSize;
  final bool _vertical;

  final ValueChanged<Color>? _onValueChanged;

  const ColorChannel({
    super.key,
    required LightChannelView channel,
    String? deviceId,
    String? channelId,
    double? elementMaxSize,
    bool vertical = false,
    ValueChanged<Color>? onValueChanged,
  })  : _channel = channel,
        _deviceId = deviceId,
        _channelId = channelId,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _onValueChanged = onValueChanged;

  @override
  State<ColorChannel> createState() => _ColorChannelState();
}

class _ColorChannelState extends State<ColorChannel> {
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;
  late double _color;

  // Debounce timer for API calls
  Timer? _debounceTimer;

  // Track previous intent lock state to detect when command completes
  bool _wasIntentLocked = false;

  @override
  void initState() {
    super.initState();
    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (_) {}
    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (_) {}
    _initializeWidget();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _intentOverlayService?.removeListener(_onIntentChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onIntentChanged() {
    if (!mounted) return;

    final hueProp = widget._channel.hueProp;
    if (hueProp == null ||
        widget._deviceId == null ||
        widget._channelId == null) {
      setState(() {});
      return;
    }

    // Check current intent lock state
    final isIntentLocked = _intentOverlayService?.isPropertyLocked(
          widget._deviceId!,
          widget._channelId!,
          hueProp.id,
        ) ?? false;

    setState(() {
      // If intent was locked and is now unlocked, command completed - transition to settling
      if (_wasIntentLocked && !isIntentLocked) {
        final isPending = _deviceControlStateService?.getState(
              widget._deviceId!,
              widget._channelId!,
              hueProp.id,
            )?.state == ControlUIState.pending;

        if (isPending) {
          // Command completed, transition to settling
          _deviceControlStateService?.setSettling(
            widget._deviceId!,
            widget._channelId!,
            hueProp.id,
          );
        }
      }

      _wasIntentLocked = isIntentLocked;
    });
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void didUpdateWidget(covariant ColorChannel oldWidget) {
    super.didUpdateWidget(oldWidget);

    _initializeWidget();
  }

  void _initializeWidget() {
    _color = _getValueFromColor(widget._channel.color);
  }

  @override
  Widget build(BuildContext context) {
    // Check if any color property is locked (hue is the main one)
    final hueProp = widget._channel.hueProp;
    
    // Check if property is locked by control state service (state machine)
    final isControlStateLocked = widget._deviceId != null &&
            widget._channelId != null &&
            hueProp != null
        ? (_deviceControlStateService?.isLocked(
              widget._deviceId!,
              widget._channelId!,
              hueProp.id,
            ) ?? false)
        : false;

    // Check if property is locked by intent overlay
    final isIntentLocked = widget._deviceId != null &&
            widget._channelId != null &&
            hueProp != null
        ? _intentOverlayService?.isPropertyLocked(
              widget._deviceId!,
              widget._channelId!,
              hueProp.id,
            ) ?? false
        : false;

    // Get desired value from control state service if locked
    // Note: isControlStateLocked already ensures hueProp is non-null
    final controlStateHue = isControlStateLocked
        ? _deviceControlStateService?.getDesiredValue(
              widget._deviceId!,
              widget._channelId!,
              hueProp.id,
            )
        : null;

    // Get overlay hue value if locked by intent
    // Note: isIntentLocked already ensures hueProp is non-null
    final overlayHue = isIntentLocked
        ? _intentOverlayService?.getOverlayValue(
              widget._deviceId!,
              widget._channelId!,
              hueProp.id,
            )
        : null;

    // Priority: control state desired value > overlay value > actual color
    final displayValue = controlStateHue is num
        ? (controlStateHue.toDouble() / 360.0).clamp(0.0, 1.0)
        : (overlayHue is num
            ? (overlayHue.toDouble() / 360.0).clamp(0.0, 1.0)
            : _color);

    return ColoredSlider(
      value: displayValue,
      min: 0.0,
      max: 1.0,
      enabled: true, // Always enabled - don't disable during state machine to prevent blinking
      vertical: widget._vertical,
      trackWidth: widget._elementMaxSize,
      onValueChanged: (double value) {
        final hueProp = widget._channel.hueProp;
        
        // Cancel any existing debounce timer
        _debounceTimer?.cancel();

        // Update state immediately for instant UI feedback
        setState(() {
          _color = value;
        });

        // Set pending state in control state service for optimistic UI
        if (widget._deviceId != null &&
            widget._channelId != null &&
            hueProp != null) {
          // Convert slider value (0-1) to hue (0-360)
          final hueValue = value * 360.0;
          
          // Cancel any existing settling timer
          final currentState = _deviceControlStateService?.getState(
            widget._deviceId!,
            widget._channelId!,
            hueProp.id,
          );
          currentState?.cancelTimer();

          _deviceControlStateService?.setPending(
            widget._deviceId!,
            widget._channelId!,
            hueProp.id,
            hueValue,
          );

          // If device is off, also set on/off state to pending for optimistic UI
          if (!widget._channel.on) {
            final onProp = widget._channel.onProp;
            final onState = _deviceControlStateService?.getState(
              widget._deviceId!,
              widget._channelId!,
              onProp.id,
            );
            onState?.cancelTimer();

            _deviceControlStateService?.setPending(
              widget._deviceId!,
              widget._channelId!,
              onProp.id,
              true,
            );
          }

          // Update intent lock tracking state
          final isIntentLocked = _intentOverlayService?.isPropertyLocked(
                widget._deviceId!,
                widget._channelId!,
                hueProp.id,
              ) ?? false;
          _wasIntentLocked = isIntentLocked;
        }

        // Debounce the API call
        _debounceTimer = Timer(
          const Duration(milliseconds: 300),
          () {
            if (!mounted) return;
            widget._onValueChanged?.call(_getColorFromValue(value));
          },
        );
      },
      background: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFFFF0000), // Red
            Color(0xFFFFFF00), // Yellow
            Color(0xFF00FF00), // Green
            Color(0xFF00FFFF), // Cyan
            Color(0xFF0000FF), // Blue
            Color(0xFFFF00FF), // Magenta
            Color(0xFFFF0000), // Red (wrap back)
          ],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
      thumbDividerColor: _getColorFromValue(_color),
    );
  }

  // Map slider value (0 to 1) to a color
  Color _getColorFromValue(double value) {
    double hue = value * 360; // Map value to hue range (0-360)
    return HSVColor.fromAHSV(1.0, hue, 1.0, 1.0).toColor();
  }

  double _getValueFromColor(Color color) {
    // Convert to HSV
    final HSVColor hsvColor = HSVColor.fromColor(color);

    // Normalize hue (0-360) to range 0-1
    return hsvColor.hue / 360.0;
  }
}

class TemperatureChannel extends StatefulWidget {
  final LightChannelView _channel;
  final String? _deviceId;
  final String? _channelId;
  final String? _propertyId;
  final double? _elementMaxSize;
  final bool _vertical;

  final ValueChanged<double>? _onValueChanged;

  const TemperatureChannel({
    super.key,
    required LightChannelView channel,
    String? deviceId,
    String? channelId,
    String? propertyId,
    double? elementMaxSize,
    bool vertical = false,
    ValueChanged<double>? onValueChanged,
  })  : _channel = channel,
        _deviceId = deviceId,
        _channelId = channelId,
        _propertyId = propertyId,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _onValueChanged = onValueChanged;

  @override
  State<TemperatureChannel> createState() => _TemperatureChannelState();
}

class _TemperatureChannelState extends State<TemperatureChannel> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;

  late ChannelPropertyView? _property;

  late num? _temperature;

  // Debounce timer for API calls
  Timer? _debounceTimer;

  // Track previous intent lock state to detect when command completes
  bool _wasIntentLocked = false;

  @override
  void initState() {
    super.initState();
    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (_) {}
    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (_) {}
    _initializeWidget();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _intentOverlayService?.removeListener(_onIntentChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onIntentChanged() {
    if (!mounted) return;

    final propertyId = widget._propertyId;
    if (propertyId == null ||
        widget._deviceId == null ||
        widget._channelId == null) {
      setState(() {});
      return;
    }

    // Check current intent lock state
    final isIntentLocked = _intentOverlayService?.isPropertyLocked(
          widget._deviceId!,
          widget._channelId!,
          propertyId,
        ) ?? false;

    setState(() {
      // If intent was locked and is now unlocked, command completed - transition to settling
      if (_wasIntentLocked && !isIntentLocked) {
        final isPending = _deviceControlStateService?.getState(
              widget._deviceId!,
              widget._channelId!,
              propertyId,
            )?.state == ControlUIState.pending;

        if (isPending) {
          // Command completed, transition to settling
          _deviceControlStateService?.setSettling(
            widget._deviceId!,
            widget._channelId!,
            propertyId,
          );
        }
      }

      _wasIntentLocked = isIntentLocked;
    });
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void didUpdateWidget(covariant TemperatureChannel oldWidget) {
    super.didUpdateWidget(oldWidget);

    _initializeWidget();
  }

  void _initializeWidget() {
    _property = widget._channel.temperatureProp;

    final property = _property;

    _temperature = property != null && property.value is NumberValueType
        ? (property.value as NumberValueType).value
        : null;
  }

  @override
  Widget build(BuildContext context) {
    num min = 2700;
    num max = 6500;

    final property = _property;

    if (property != null) {
      FormatType? format = property.format;

      if (format is NumberListFormatType && format.value.length == 2) {
        min = format.value[0];
        max = format.value[1];
      }
    }

    // Check if property is locked by control state service (state machine)
    final isControlStateLocked = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? (_deviceControlStateService?.isLocked(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            ) ?? false)
        : false;

    // Check if property is locked by intent overlay
    final isIntentLocked = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.isPropertyLocked(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            ) ?? false
        : false;

    // Get desired value from control state service if locked
    final controlStateValue = isControlStateLocked && widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _deviceControlStateService?.getDesiredValue(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            )
        : null;

    // Get overlay value if locked by intent
    final overlayValue = isIntentLocked && widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.getOverlayValue(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            )
        : null;

    // Priority: control state desired value > overlay value > actual value
    final displayValue = controlStateValue is num
        ? controlStateValue.toDouble()
        : (overlayValue is num
            ? overlayValue.toDouble()
            : (_temperature ?? min));

    return ColoredSlider(
      value: displayValue,
      min: min,
      max: max,
      enabled: true, // Always enabled - don't disable during state machine to prevent blinking
      vertical: widget._vertical,
      trackWidth: widget._elementMaxSize,
      onValueChanged: (double value) {
        // Cancel any existing debounce timer
        _debounceTimer?.cancel();

        // Update state immediately for instant UI feedback
        setState(() {
          _temperature = value;
        });

        // Set pending state in control state service for optimistic UI
        if (widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null) {
          // Cancel any existing settling timer
          final currentState = _deviceControlStateService?.getState(
            widget._deviceId!,
            widget._channelId!,
            widget._propertyId!,
          );
          currentState?.cancelTimer();

          _deviceControlStateService?.setPending(
            widget._deviceId!,
            widget._channelId!,
            widget._propertyId!,
            value,
          );

          // If device is off, also set on/off state to pending for optimistic UI
          if (!widget._channel.on) {
            final onProp = widget._channel.onProp;
            final onState = _deviceControlStateService?.getState(
              widget._deviceId!,
              widget._channelId!,
              onProp.id,
            );
            onState?.cancelTimer();

            _deviceControlStateService?.setPending(
              widget._deviceId!,
              widget._channelId!,
              onProp.id,
              true,
            );
          }

          // Update intent lock tracking state
          final isIntentLocked = _intentOverlayService?.isPropertyLocked(
                widget._deviceId!,
                widget._channelId!,
                widget._propertyId!,
              ) ?? false;
          _wasIntentLocked = isIntentLocked;
        }

        // Debounce the API call
        _debounceTimer = Timer(
          const Duration(milliseconds: 300),
          () {
            if (!mounted) return;
            widget._onValueChanged?.call(value);
          },
        );
      },
      background: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFFFFAA55), // Warm white
            Color(0xFFB3D9FF), // Cool white
          ],
        ),
      ),
      thumbDividerColor: AppBorderColorDark.base,
      inner: [
        Positioned(
          left: _screenService.scale(
            5,
            density: _visualDensityService.density,
          ),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: widget._vertical ? 1 : 0,
                child: Icon(
                  MdiIcons.thermometer,
                  size: _screenService.scale(
                    40,
                    density: _visualDensityService.density,
                  ),
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class WhiteChannel extends StatefulWidget {
  final LightChannelView _channel;
  final String? _deviceId;
  final String? _channelId;
  final String? _propertyId;
  final double? _elementMaxSize;
  final bool _vertical;

  final ValueChanged<double>? _onValueChanged;

  const WhiteChannel({
    super.key,
    required LightChannelView channel,
    String? deviceId,
    String? channelId,
    String? propertyId,
    double? elementMaxSize,
    bool vertical = false,
    ValueChanged<double>? onValueChanged,
  })  : _channel = channel,
        _deviceId = deviceId,
        _channelId = channelId,
        _propertyId = propertyId,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _onValueChanged = onValueChanged;

  @override
  State<WhiteChannel> createState() => _WhiteChannelState();
}

class _WhiteChannelState extends State<WhiteChannel> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;

  late ChannelPropertyView? _property;

  late num? _white;

  // Debounce timer for API calls
  Timer? _debounceTimer;

  // Track previous intent lock state to detect when command completes
  bool _wasIntentLocked = false;

  @override
  void initState() {
    super.initState();
    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (_) {}
    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (_) {}
    _initializeWidget();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _intentOverlayService?.removeListener(_onIntentChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onIntentChanged() {
    if (!mounted) return;

    final propertyId = widget._propertyId;
    if (propertyId == null ||
        widget._deviceId == null ||
        widget._channelId == null) {
      setState(() {});
      return;
    }

    // Check current intent lock state
    final isIntentLocked = _intentOverlayService?.isPropertyLocked(
          widget._deviceId!,
          widget._channelId!,
          propertyId,
        ) ?? false;

    setState(() {
      // If intent was locked and is now unlocked, command completed - transition to settling
      if (_wasIntentLocked && !isIntentLocked) {
        final isPending = _deviceControlStateService?.getState(
              widget._deviceId!,
              widget._channelId!,
              propertyId,
            )?.state == ControlUIState.pending;

        if (isPending) {
          // Command completed, transition to settling
          _deviceControlStateService?.setSettling(
            widget._deviceId!,
            widget._channelId!,
            propertyId,
          );
        }
      }

      _wasIntentLocked = isIntentLocked;
    });
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void didUpdateWidget(covariant WhiteChannel oldWidget) {
    super.didUpdateWidget(oldWidget);

    _initializeWidget();
  }

  void _initializeWidget() {
    _property = widget._channel.colorWhiteProp;

    final property = _property;

    _white = property != null && property.value is NumberValueType
        ? (property.value as NumberValueType).value
        : null;
  }

  @override
  Widget build(BuildContext context) {
    num min = 0;
    num max = 255;

    final property = _property;

    if (property != null) {
      FormatType? format = property.format;

      if (format is NumberListFormatType && format.value.length == 2) {
        min = format.value[0];
        max = format.value[1];
      }
    }

    // Check if property is locked by control state service (state machine)
    final isControlStateLocked = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? (_deviceControlStateService?.isLocked(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            ) ?? false)
        : false;

    // Check if property is locked by intent overlay
    final isIntentLocked = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.isPropertyLocked(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            ) ?? false
        : false;

    // Get desired value from control state service if locked
    final controlStateValue = isControlStateLocked && widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _deviceControlStateService?.getDesiredValue(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            )
        : null;

    // Get overlay value if locked by intent
    final overlayValue = isIntentLocked && widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.getOverlayValue(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            )
        : null;

    // Priority: control state desired value > overlay value > actual value
    final displayValue = controlStateValue is num
        ? controlStateValue.toDouble()
        : (overlayValue is num
            ? overlayValue.toDouble()
            : (_white ?? min));

    return ColoredSlider(
      value: displayValue,
      min: min,
      max: max,
      enabled: true, // Always enabled - don't disable during state machine to prevent blinking
      vertical: widget._vertical,
      trackWidth: widget._elementMaxSize,
      showThumb: false,
      onValueChanged: (double value) {
        // Cancel any existing debounce timer
        _debounceTimer?.cancel();

        // Update state immediately for instant UI feedback
        setState(() {
          _white = value;
        });

        // Set pending state in control state service for optimistic UI
        if (widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null) {
          // Cancel any existing settling timer
          final currentState = _deviceControlStateService?.getState(
            widget._deviceId!,
            widget._channelId!,
            widget._propertyId!,
          );
          currentState?.cancelTimer();

          _deviceControlStateService?.setPending(
            widget._deviceId!,
            widget._channelId!,
            widget._propertyId!,
            value,
          );

          // If device is off, also set on/off state to pending for optimistic UI
          if (!widget._channel.on) {
            final onProp = widget._channel.onProp;
            final onState = _deviceControlStateService?.getState(
              widget._deviceId!,
              widget._channelId!,
              onProp.id,
            );
            onState?.cancelTimer();

            _deviceControlStateService?.setPending(
              widget._deviceId!,
              widget._channelId!,
              onProp.id,
              true,
            );
          }

          // Update intent lock tracking state
          final isIntentLocked = _intentOverlayService?.isPropertyLocked(
                widget._deviceId!,
                widget._channelId!,
                widget._propertyId!,
              ) ?? false;
          _wasIntentLocked = isIntentLocked;
        }

        // Debounce the API call
        _debounceTimer = Timer(
          const Duration(milliseconds: 300),
          () {
            if (!mounted) return;
            widget._onValueChanged?.call(value);
          },
        );
      },
      activeTrackColor: AppColors.white,
      inner: [
        Positioned(
          left: _screenService.scale(
            20,
            density: _visualDensityService.density,
          ),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: widget._vertical ? 1 : 0,
                child: Icon(
                  MdiIcons.lightbulbOutline,
                  size: _screenService.scale(
                    40,
                    density: _visualDensityService.density,
                  ),
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ChannelSwitch extends StatefulWidget {
  final LightChannelView _channel;
  final bool _vertical;

  final ValueChanged<bool>? _onStateChanged;

  const ChannelSwitch({
    super.key,
    required LightChannelView channel,
    bool vertical = false,
    ValueChanged<bool>? onStateChanged,
  })  : _channel = channel,
        _vertical = vertical,
        _onStateChanged = onStateChanged;

  @override
  State<ChannelSwitch> createState() => _ChannelSwitchState();
}

class _ChannelSwitchState extends State<ChannelSwitch> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late bool _isOn;

  @override
  void initState() {
    super.initState();

    _initializeWidget();
  }

  @override
  void didUpdateWidget(covariant ChannelSwitch oldWidget) {
    super.didUpdateWidget(oldWidget);

    _initializeWidget();
  }

  void _initializeWidget() {
    _isOn = widget._channel.on;
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _screenService.scale(
        widget._vertical ? 45 : 75,
        density: _visualDensityService.density,
      ),
      height: _screenService.scale(
        widget._vertical ? 75 : 45,
        density: _visualDensityService.density,
      ),
      child: Theme(
        data: ThemeData(
          filledButtonTheme: Theme.of(context).brightness == Brightness.light
              ? (widget._channel.on
                  ? AppFilledButtonsLightThemes.primary
                  : AppFilledButtonsLightThemes.info)
              : (widget._channel.on
                  ? AppFilledButtonsDarkThemes.primary
                  : AppFilledButtonsDarkThemes.info),
        ),
        child: FilledButton(
          onPressed: () {
            setState(() {
              _isOn = !_isOn;
            });

            widget._onStateChanged?.call(_isOn);
          },
          style: ButtonStyle(
            padding: WidgetStateProperty.all(EdgeInsets.zero),
            shape: WidgetStateProperty.all(
              RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
              ),
            ),
          ),
          child: Center(
            // Explicitly centers the icon
            child: Icon(
              MdiIcons.power,
              size: _screenService.scale(
                35,
                density: _visualDensityService.density,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ChannelActualBrightness extends StatefulWidget {
  final LightChannelView _channel;
  final String? _deviceId;
  final String? _channelId;
  final bool _showName;

  const ChannelActualBrightness({
    super.key,
    required LightChannelView channel,
    String? deviceId,
    String? channelId,
    showName = false,
  })  : _channel = channel,
        _deviceId = deviceId,
        _channelId = channelId,
        _showName = showName;

  @override
  State<ChannelActualBrightness> createState() => _ChannelActualBrightnessState();
}

class _ChannelActualBrightnessState extends State<ChannelActualBrightness> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  DeviceControlStateService? _deviceControlStateService;

  @override
  void initState() {
    super.initState();
    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (_) {}
  }

  @override
  void dispose() {
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final ChannelPropertyView? property = widget._channel.brightnessProp;

    // Check if property is locked by control state service
    final isLocked = widget._deviceId != null &&
            widget._channelId != null &&
            property != null
        ? (_deviceControlStateService?.isLocked(
              widget._deviceId!,
              widget._channelId!,
              property.id,
            ) ?? false)
        : false;

    // Get desired value from control state service if locked
    // Note: isLocked already ensures property is non-null
    final desiredValue = isLocked
        ? _deviceControlStateService?.getDesiredValue(
              widget._deviceId!,
              widget._channelId!,
              property.id,
            )
        : null;

    // Check on/off state with optimistic UI
    bool isOn = widget._channel.on;
    final onProp = widget._channel.onProp;
    
    if (widget._deviceId != null && widget._channelId != null) {
      // Check control state service first (most reliable for optimistic UI)
      final isOnOffLocked = _deviceControlStateService?.isLocked(
            widget._deviceId!,
            widget._channelId!,
            onProp.id,
          ) ?? false;

      if (isOnOffLocked) {
        // Use desired value from control state service for optimistic on/off state
        final onOffDesiredValue = _deviceControlStateService?.getDesiredValue(
              widget._deviceId!,
              widget._channelId!,
              onProp.id,
            );
        if (onOffDesiredValue is bool) {
          isOn = onOffDesiredValue;
        } else if (onOffDesiredValue is num) {
          isOn = onOffDesiredValue > 0.5;
        }
      } else {
        // Check intent overlay as fallback
        try {
          final intentOverlayService = locator<IntentOverlayService>();
          if (intentOverlayService.isPropertyLocked(
                widget._deviceId!,
                widget._channelId!,
                onProp.id,
              )) {
            final overlayValue = intentOverlayService.getOverlayValue(
              widget._deviceId!,
              widget._channelId!,
              onProp.id,
            );
            if (overlayValue is bool) {
              isOn = overlayValue;
            }
          }
        } catch (_) {
          // IntentOverlayService not available, use actual state
        }
      }
    }

    // Determine display value: desired value if locked, otherwise actual property value
    final String displayText;
    if (isOn) {
      if (isLocked && desiredValue is num) {
        // Show desired value immediately when user is dragging
        displayText = desiredValue.round().toString();
      } else if (property != null) {
        displayText = ValueUtils.formatValue(property) ?? '-';
      } else {
        displayText = '-';
      }
    } else {
      displayText = localizations.light_state_off;
    }

    return ConstrainedBox(
      constraints: BoxConstraints(
        minWidth: _screenService.scale(
          100,
          density: _visualDensityService.density,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              RichText(
                text: TextSpan(
                  text: displayText,
                  style: TextStyle(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
                    fontSize: _screenService.scale(
                      60,
                      density: _visualDensityService.density,
                    ),
                    fontFamily: 'DIN1451',
                    fontWeight: FontWeight.w100,
                    height: 1.0,
                  ),
                ),
                textAlign: TextAlign.center,
              ),
              isOn
                  ? RichText(
                      text: TextSpan(
                        text: '%',
                        style: TextStyle(
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.regular
                                  : AppTextColorDark.regular,
                          fontSize: _screenService.scale(
                            25,
                            density: _visualDensityService.density,
                          ),
                          fontFamily: 'DIN1451',
                          fontWeight: FontWeight.w100,
                          height: 1.0,
                        ),
                      ),
                      textAlign: TextAlign.center,
                    )
                  : null,
            ].whereType<Widget>().toList(),
          ),
          Text(
            widget._showName
                ? widget._channel.name
                : isOn
                    ? localizations.light_state_brightness_description
                    : localizations.light_state_off_description,
            style: TextStyle(
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
              fontSize: AppFontSize.base,
            ),
          ),
        ],
      ),
    );
  }
}

class ChannelActualColor extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final LightChannelView _channel;

  ChannelActualColor({
    super.key,
    required LightChannelView channel,
  }) : _channel = channel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _screenService.scale(
        75,
        density: _visualDensityService.density,
      ),
      height: _screenService.scale(
        75,
        density: _visualDensityService.density,
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(
            AppBorderRadius.base,
          ),
          border: Border.all(
            color: Theme.of(context).brightness == Brightness.light
                ? AppBorderColorLight.base
                : AppBorderColorDark.base,
            width: _screenService.scale(
              1,
              density: _visualDensityService.density,
            ),
          ),
        ),
        child: Padding(
          padding: EdgeInsets.all(_screenService.scale(
            1,
            density: _visualDensityService.density,
          )),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(
                AppBorderRadius.base -
                    2 *
                        _screenService.scale(
                          1,
                          density: _visualDensityService.density,
                        ),
              ),
              color: _channel.color,
            ),
          ),
        ),
      ),
    );
  }
}

class ChannelActualTemperature extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final LightChannelView _channel;

  ChannelActualTemperature({
    super.key,
    required LightChannelView channel,
  }) : _channel = channel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _screenService.scale(
        75,
        density: _visualDensityService.density,
      ),
      height: _screenService.scale(
        75,
        density: _visualDensityService.density,
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(
            AppBorderRadius.base,
          ),
          border: Border.all(
            color: Theme.of(context).brightness == Brightness.light
                ? AppBorderColorLight.base
                : AppBorderColorDark.base,
            width: _screenService.scale(
              1,
              density: _visualDensityService.density,
            ),
          ),
        ),
        child: Padding(
          padding: EdgeInsets.all(_screenService.scale(
            1,
            density: _visualDensityService.density,
          )),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(
                AppBorderRadius.base -
                    2 *
                        _screenService.scale(
                          1,
                          density: _visualDensityService.density,
                        ),
              ),
              color: _channel.temperature,
            ),
          ),
        ),
      ),
    );
  }
}

class LightTiles extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final LightingDeviceView _device;

  LightTiles({
    super.key,
    required LightingDeviceView device,
  }) : _device = device;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      runSpacing: AppSpacings.pSm,
      children: [
        ..._renderLightingElectricalEnergy(context),
        ..._renderLightingElectricalPower(context),
      ].whereType<Widget>().toList(),
    );
  }

  List<Widget> _renderLightingElectricalEnergy(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (!_device.hasElectricalEnergy) {
      return [];
    }

    final List<LightTileItem> items = [
      LightTileItem(
        icon: MdiIcons.meterElectric,
        title: localizations.electrical_energy_consumption_title,
        subtitle: localizations.electrical_energy_consumption_description,
        trailingText: NumberUtils.formatNumber(
          _device.electricalEnergyConsumption,
          2,
        ),
        unit: 'kWh',
      ),
    ];

    if (_device.hasElectricalEnergyRate == true) {
      items.add(
        LightTileItem(
          icon: MdiIcons.gauge,
          title: localizations.electrical_energy_rate_title,
          subtitle: localizations.electrical_energy_rate_description,
          trailingText: NumberUtils.formatNumber(
            _device.electricalEnergyRate ?? 0.0,
            2,
          ),
          unit: 'kW',
        ),
      );
    }

    return _renderTiles(context, items);
  }

  List<Widget> _renderLightingElectricalPower(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (!_device.hasElectricalPower) {
      return [];
    }

    final List<LightTileItem> items = [];

    if (_device.hasElectricalPowerCurrent) {
      items.add(
        LightTileItem(
          icon: MdiIcons.powerPlug,
          title: localizations.electrical_power_current_title,
          subtitle: localizations.electrical_power_current_description,
          trailingText: NumberUtils.formatNumber(
            _device.electricalPowerCurrent,
            2,
          ),
          unit: 'A',
        ),
      );
    }

    if (_device.hasElectricalPowerVoltage) {
      items.add(
        LightTileItem(
          icon: MdiIcons.batteryCharging,
          title: localizations.electrical_power_voltage_title,
          subtitle: localizations.electrical_power_over_voltage_description,
          trailingText: NumberUtils.formatNumber(
            _device.electricalPowerVoltage,
            2,
          ),
          unit: 'V',
        ),
      );
    }

    if (_device.hasElectricalPowerPower) {
      items.add(
        LightTileItem(
          icon: MdiIcons.lightningBolt,
          title: localizations.electrical_power_power_title,
          subtitle: localizations.electrical_power_power_description,
          trailingText: NumberUtils.formatNumber(
            _device.electricalPowerPower,
            2,
          ),
          unit: 'W',
        ),
      );
    }

    if (_device.hasElectricalPowerFrequency) {
      items.add(
        LightTileItem(
          icon: MdiIcons.chartLineVariant,
          title: localizations.electrical_power_frequency_title,
          subtitle: localizations.electrical_power_frequency_description,
          trailingText: NumberUtils.formatNumber(
            _device.electricalPowerFrequency,
            1,
          ),
          unit: 'Hz',
        ),
      );
    }

    if (_device.hasElectricalPowerOverCurrent &&
        _device.isElectricalPowerOverCurrent) {
      items.add(
        LightTileItem(
          icon: MdiIcons.powerPlug,
          title: localizations.electrical_power_over_current_title,
          subtitle: localizations.electrical_power_over_current_description,
          trailingIcon: MdiIcons.alert,
        ),
      );
    }

    if (_device.hasElectricalPowerOverVoltage &&
        _device.isElectricalPowerOverVoltage) {
      items.add(
        LightTileItem(
          icon: MdiIcons.batteryCharging,
          title: localizations.electrical_power_over_voltage_title,
          subtitle: localizations.electrical_power_over_voltage_description,
          trailingIcon: MdiIcons.alert,
        ),
      );
    }

    if (_device.hasElectricalPowerOverPower &&
        _device.isElectricalPowerOverPower) {
      items.add(
        LightTileItem(
          icon: MdiIcons.lightningBolt,
          title: localizations.electrical_power_over_power_title,
          subtitle: localizations.electrical_power_over_power_description,
          trailingIcon: MdiIcons.alert,
        ),
      );
    }

    return _renderTiles(context, items);
  }

  List<Widget> _renderTiles(BuildContext context, List<LightTileItem> items) {
    return items
        .map(
          (item) => Material(
            elevation: 0,
            color: Colors.transparent,
            child: ListTile(
              minTileHeight: _screenService.scale(
                25,
                density: _visualDensityService.density,
              ),
              leading: Tooltip(
                message: item.subtitle,
                triggerMode: TooltipTriggerMode.tap,
                child: Icon(
                  item.icon,
                  size: AppFontSize.large,
                ),
              ),
              title: Text(
                item.title,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall * 0.8,
                  fontWeight: FontWeight.w600,
                ),
              ),
              trailing: item.trailingText != null
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          item.trailingText!,
                          style: TextStyle(
                            fontSize: AppFontSize.extraSmall,
                          ),
                        ),
                        item.unit != null
                            ? Text(
                                item.unit ?? '',
                                style: TextStyle(
                                  fontSize: AppFontSize.extraSmall * 0.6,
                                ),
                              )
                            : null,
                      ].whereType<Widget>().toList(),
                    )
                  : (item.trailingIcon != null
                      ? Icon(
                          item.trailingIcon,
                        )
                      : null),
            ),
          ),
        )
        .toList();
  }
}

enum LightChannelModeType {
  off('off'),
  brightness('brightness'),
  color('color'),
  temperature('temperature'),
  white('white'),
  swatches('swatches');

  final String value;

  const LightChannelModeType(this.value);

  static final utils = StringEnumUtils(
    LightChannelModeType.values,
    (LightChannelModeType payload) => payload.value,
  );

  static LightChannelModeType? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

class PropertyValueHelper {
  final DevicesService _service = locator<DevicesService>();
  final DisplayRepository? _displayRepository;

  PropertyValueHelper() : _displayRepository = _tryGetDisplayRepository();

  static DisplayRepository? _tryGetDisplayRepository() {
    try {
      return locator<DisplayRepository>();
    } catch (_) {
      return null;
    }
  }

  Future<bool> setPropertyValue(
    BuildContext context,
    ChannelPropertyView property,
    dynamic value, {
    String? deviceId,
    String? channelId,
  }) async {
    final localizations = AppLocalizations.of(context)!;

    try {
      bool res;

      // Use context-aware method if we have device and channel IDs
      if (deviceId != null && channelId != null) {
        final commandContext = PropertyCommandContext(
          origin: 'panel.device',
          displayId: _displayRepository?.display?.id,
        );

        res = await _service.setPropertyValueWithContext(
          deviceId: deviceId,
          channelId: channelId,
          propertyId: property.id,
          value: value,
          context: commandContext,
        );
      } else {
        // Fallback to simple method without context
        res = await _service.setPropertyValue(
          property.id,
          value,
        );
      }

      if (!res && context.mounted) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }

      return res;
    } catch (e) {
      if (!context.mounted) return false;

      AlertBar.showError(
        context,
        message: localizations.action_failed,
      );
    }

    return false;
  }

  Future<bool> setMultiplePropertyValues(
    BuildContext context,
    List<PropertyCommandItem> properties,
  ) async {
    final localizations = AppLocalizations.of(context)!;

    try {
      // Build context for batch command
      final commandContext = PropertyCommandContext(
        origin: 'panel.device',
        displayId: _displayRepository?.display?.id,
      );

      // Send batch command
      final success = await _service.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!success && context.mounted) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }

      return success;
    } catch (e) {
      if (!context.mounted) return false;

      AlertBar.showError(
        context,
        message: localizations.action_failed,
      );
    }

    return false;
  }
}

// ============================================================================
// Single Channel Control Panel
// ============================================================================

/// Single-channel device control using LightingControlPanel.
///
/// Replaces LightSingleChannelDetail for devices with a single light channel.
/// Provides unified UI with the role detail page while maintaining device-level
/// state management.
class LightSingleChannelControlPanel extends StatefulWidget {
  final LightingDeviceView device;
  final LightChannelView channel;

  /// Whether to show the header (title, icon, back button)
  /// Set to false when used inside DeviceDetailPage which has its own AppTopBar
  final bool showHeader;

  /// Callback when back button is pressed (only used if showHeader is true)
  final VoidCallback? onBack;

  const LightSingleChannelControlPanel({
    super.key,
    required this.device,
    required this.channel,
    this.showHeader = false,
    this.onBack,
  });

  @override
  State<LightSingleChannelControlPanel> createState() =>
      _LightSingleChannelControlPanelState();
}

class _LightSingleChannelControlPanelState
    extends State<LightSingleChannelControlPanel> {
  DeviceControlStateService? _deviceControlStateService;
  IntentOverlayService? _intentOverlayService;
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  // Debounce timers for sliders
  Timer? _brightnessDebounceTimer;
  Timer? _colorDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  LightingDeviceView get _device => widget.device;
  LightChannelView get _channel => widget.channel;

  @override
  void initState() {
    super.initState();

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LightSingleChannelControlPanel] Failed to get DeviceControlStateService: $e');
      }
    }

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LightSingleChannelControlPanel] Failed to get IntentOverlayService: $e');
      }
    }
  }

  @override
  void dispose() {
    _brightnessDebounceTimer?.cancel();
    _colorDebounceTimer?.cancel();
    _temperatureDebounceTimer?.cancel();
    _whiteDebounceTimer?.cancel();
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  void _onIntentChanged() {
    if (mounted) setState(() {});
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  Set<LightCapability> _buildCapabilities() {
    final caps = <LightCapability>{LightCapability.power};
    if (_channel.hasBrightness) caps.add(LightCapability.brightness);
    if (_channel.hasColor) caps.add(LightCapability.color);
    if (_channel.hasTemperature) caps.add(LightCapability.colorTemp);
    if (_channel.hasColorWhite) caps.add(LightCapability.white);
    return caps;
  }

  // ============================================================================
  // Optimistic Value Getters
  // ============================================================================

  bool _getIsOn() {
    final onProp = _channel.onProp;
    final controlStateService = _deviceControlStateService;

    if (controlStateService != null &&
        controlStateService.isLocked(_device.id, _channel.id, onProp.id)) {
      final desiredValue = controlStateService.getDesiredValue(
        _device.id,
        _channel.id,
        onProp.id,
      );
      if (desiredValue is bool) return desiredValue;
      if (desiredValue is num) return desiredValue > 0.5;
    }

    // Fall back to overlay service
    if (_intentOverlayService?.isPropertyLocked(
          _device.id,
          _channel.id,
          onProp.id,
        ) ==
        true) {
      final overlayValue = _intentOverlayService!.getOverlayValue(
        _device.id,
        _channel.id,
        onProp.id,
      );
      if (overlayValue is bool) return overlayValue;
    }

    return _channel.on;
  }

  int _getBrightness() {
    final prop = _channel.brightnessProp;
    if (prop == null) return 100;

    final controlStateService = _deviceControlStateService;
    if (controlStateService != null &&
        controlStateService.isLocked(_device.id, _channel.id, prop.id)) {
      final desiredValue = controlStateService.getDesiredValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (desiredValue is num) return desiredValue.toInt();
    }

    // Fall back to overlay service
    if (_intentOverlayService?.isPropertyLocked(
          _device.id,
          _channel.id,
          prop.id,
        ) ==
        true) {
      final overlayValue = _intentOverlayService!.getOverlayValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (overlayValue is num) return overlayValue.toInt();
    }

    return _channel.brightness;
  }

  int _getColorTemp() {
    final prop = _channel.temperatureProp;
    if (prop == null) return 4000;

    final controlStateService = _deviceControlStateService;
    if (controlStateService != null &&
        controlStateService.isLocked(_device.id, _channel.id, prop.id)) {
      final desiredValue = controlStateService.getDesiredValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (desiredValue is num) return desiredValue.toInt();
    }

    // Fall back to overlay service
    if (_intentOverlayService?.isPropertyLocked(
          _device.id,
          _channel.id,
          prop.id,
        ) ==
        true) {
      final overlayValue = _intentOverlayService!.getOverlayValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (overlayValue is num) return overlayValue.toInt();
    }

    // Get from property value
    if (prop.value is NumberValueType) {
      return (prop.value as NumberValueType).value.toInt();
    }
    return 4000;
  }

  Color? _getColor() {
    if (!_channel.hasColor) return null;

    // Check for overlay value
    final hueProp = _channel.hueProp;
    if (hueProp != null) {
      final controlStateService = _deviceControlStateService;
      if (controlStateService != null &&
          controlStateService.isLocked(_device.id, _channel.id, hueProp.id)) {
        final desiredValue = controlStateService.getDesiredValue(
          _device.id,
          _channel.id,
          hueProp.id,
        );
        if (desiredValue is num) {
          return HSVColor.fromAHSV(1.0, desiredValue.toDouble(), 1.0, 1.0)
              .toColor();
        }
      }
    }

    // Get color from channel RGB values
    try {
      if (_channel.hasColorRed) {
        return ColorUtils.fromRGB(
          _channel.colorRed,
          _channel.colorGreen,
          _channel.colorBlue,
        );
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[LightSingleChannelControlPanel] Error getting color: $e');
    }

    return null;
  }

  int _getWhiteChannel() {
    final prop = _channel.colorWhiteProp;
    if (prop == null) return 100;

    final controlStateService = _deviceControlStateService;
    if (controlStateService != null &&
        controlStateService.isLocked(_device.id, _channel.id, prop.id)) {
      final desiredValue = controlStateService.getDesiredValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (desiredValue is num) return desiredValue.toInt();
    }

    // Fall back to overlay service
    if (_intentOverlayService?.isPropertyLocked(
          _device.id,
          _channel.id,
          prop.id,
        ) ==
        true) {
      final overlayValue = _intentOverlayService!.getOverlayValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (overlayValue is num) return overlayValue.toInt();
    }

    return _channel.colorWhite;
  }

  // ============================================================================
  // Command Methods
  // ============================================================================

  Future<void> _handlePowerToggle() async {
    final localizations = AppLocalizations.of(context);
    final newState = !_getIsOn();
    final propertyId = _channel.onProp.id;

    // Set PENDING state
    _deviceControlStateService?.setPending(
      _device.id,
      _channel.id,
      propertyId,
      newState,
    );
    setState(() {});

    // Create overlay for failure tracking
    _intentOverlayService?.createLocalOverlay(
      deviceId: _device.id,
      channelId: _channel.id,
      propertyId: propertyId,
      value: newState,
      ttlMs: 5000,
    );

    try {
      final success = await _valueHelper.setPropertyValue(
        context,
        _channel.onProp,
        newState,
        deviceId: _device.id,
        channelId: _channel.id,
      );

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          context,
          message: localizations?.action_failed ?? 'Failed to toggle device',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        context,
        message: localizations?.action_failed ?? 'Failed to toggle device',
      );
    } finally {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          _channel.id,
          propertyId,
        );
      }
    }
  }

  void _handleBrightnessChanged(int value) {
    final prop = _channel.brightnessProp;
    if (prop == null) return;

    // Set PENDING state immediately for responsive UI
    _deviceControlStateService?.setPending(
      _device.id,
      _channel.id,
      prop.id,
      value,
    );
    setState(() {});

    // Debounce the actual command
    _brightnessDebounceTimer?.cancel();
    _brightnessDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        // Turn on if off
        if (!_channel.on) {
          await _valueHelper.setPropertyValue(
            context,
            _channel.onProp,
            true,
            deviceId: _device.id,
            channelId: _channel.id,
          );
          if (!mounted) return;
        }

        // Set brightness
        await _valueHelper.setPropertyValue(
          context,
          prop,
          value.toDouble(),
          deviceId: _device.id,
          channelId: _channel.id,
        );

        if (mounted) {
          _deviceControlStateService?.setSettling(
            _device.id,
            _channel.id,
            prop.id,
          );
        }
      },
    );
  }

  void _handleColorTempChanged(int value) {
    final prop = _channel.temperatureProp;
    if (prop == null) return;

    // Set PENDING state immediately
    _deviceControlStateService?.setPending(
      _device.id,
      _channel.id,
      prop.id,
      value,
    );
    setState(() {});

    // Debounce the actual command
    _temperatureDebounceTimer?.cancel();
    _temperatureDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        // Turn on if off
        if (!_channel.on) {
          await _valueHelper.setPropertyValue(
            context,
            _channel.onProp,
            true,
            deviceId: _device.id,
            channelId: _channel.id,
          );
          if (!mounted) return;
        }

        // Set temperature
        await _valueHelper.setPropertyValue(
          context,
          prop,
          value.toDouble(),
          deviceId: _device.id,
          channelId: _channel.id,
        );

        if (mounted) {
          _deviceControlStateService?.setSettling(
            _device.id,
            _channel.id,
            prop.id,
          );
        }
      },
    );
  }

  void _handleColorChanged(Color color, double saturation) {
    final hueProp = _channel.hueProp;
    final hue = HSVColor.fromColor(color).hue;

    // Set PENDING state for hue if available
    if (hueProp != null) {
      _deviceControlStateService?.setPending(
        _device.id,
        _channel.id,
        hueProp.id,
        hue.round(),
      );
    }
    setState(() {});

    // Debounce the actual command
    _colorDebounceTimer?.cancel();
    _colorDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final rgbValue = ColorUtils.toRGB(color);
        final hsvValue = ColorUtils.toHSV(color);

        // Build list of properties to update
        final List<PropertyCommandItem> properties = [];

        // Turn on if off
        if (!_channel.on) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.onProp.id,
            value: true,
          ));
        }

        if (_channel.colorRedProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.colorRedProp!.id,
            value: rgbValue.red,
          ));
        }

        if (_channel.colorGreenProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.colorGreenProp!.id,
            value: rgbValue.green,
          ));
        }

        if (_channel.colorBlueProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.colorBlueProp!.id,
            value: rgbValue.blue,
          ));
        }

        if (_channel.hueProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.hueProp!.id,
            value: hsvValue.hue.round(),
          ));
        }

        if (_channel.saturationProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.saturationProp!.id,
            value: (hsvValue.saturation * 100).round(),
          ));
        }

        if (properties.isNotEmpty) {
          await _valueHelper.setMultiplePropertyValues(context, properties);
        }

        if (mounted && hueProp != null) {
          _deviceControlStateService?.setSettling(
            _device.id,
            _channel.id,
            hueProp.id,
          );
        }
      },
    );
  }

  void _handleWhiteChannelChanged(int value) {
    final prop = _channel.colorWhiteProp;
    if (prop == null) return;

    // Set PENDING state immediately
    _deviceControlStateService?.setPending(
      _device.id,
      _channel.id,
      prop.id,
      value,
    );
    setState(() {});

    // Debounce the actual command
    _whiteDebounceTimer?.cancel();
    _whiteDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        // Turn on if off
        if (!_channel.on) {
          await _valueHelper.setPropertyValue(
            context,
            _channel.onProp,
            true,
            deviceId: _device.id,
            channelId: _channel.id,
          );
          if (!mounted) return;
        }

        // Set white channel
        await _valueHelper.setPropertyValue(
          context,
          prop,
          value.toDouble(),
          deviceId: _device.id,
          channelId: _channel.id,
        );

        if (mounted) {
          _deviceControlStateService?.setSettling(
            _device.id,
            _channel.id,
            prop.id,
          );
        }
      },
    );
  }

  // ============================================================================
  // Build
  // ============================================================================

  @override
  Widget build(BuildContext context) {
    final isOn = _getIsOn();
    final brightness = _getBrightness();
    final colorTemp = _getColorTemp();
    final color = _getColor();
    final white = _getWhiteChannel();
    final capabilities = _buildCapabilities();

    // Show subtitle only if device name differs from channel name
    final showSubtitle =
        _channel.name.toLowerCase() != _device.name.toLowerCase();

    return LightingControlPanel(
      // Header configuration
      showHeader: widget.showHeader,
      title: _channel.name,
      subtitle: showSubtitle ? _device.name : null,
      icon: MdiIcons.lightbulb,
      onBack: widget.onBack,

      // Current values (with optimistic state)
      isOn: isOn,
      brightness: brightness,
      colorTemp: colorTemp,
      color: color,
      saturation: 1.0,
      whiteChannel: white,

      // Configuration
      capabilities: capabilities,
      state: LightingState.synced, // Single channel is always "synced"
      channels: const [], // No channels list for single channel control

      // Callbacks
      onPowerToggle: _handlePowerToggle,
      onBrightnessChanged: _handleBrightnessChanged,
      onColorTempChanged: _handleColorTempChanged,
      onColorChanged: _handleColorChanged,
      onWhiteChannelChanged: _handleWhiteChannelChanged,
      // No channel callbacks needed (channels list is empty)
    );
  }
}

// ============================================================================
// Multi-Channel Control Panel
// ============================================================================

/// Multi-channel device control using LightingControlPanel.
///
/// Aggregates values across all channels and shows them in a unified control panel
/// with a channels list at the bottom.
class LightMultiChannelControlPanel extends StatefulWidget {
  final LightingDeviceView device;
  final List<LightChannelView> channels;

  /// Whether to show the header (title, icon, back button)
  /// Set to false when used inside DeviceDetailPage which has its own AppTopBar
  final bool showHeader;

  /// Callback when back button is pressed (only used if showHeader is true)
  final VoidCallback? onBack;

  /// Callback when a channel is tapped to open its detail
  final void Function(LightChannelView channel)? onChannelTap;

  /// Initial channel ID to select (for preselecting a specific channel)
  final String? initialChannelId;

  const LightMultiChannelControlPanel({
    super.key,
    required this.device,
    required this.channels,
    this.showHeader = false,
    this.onBack,
    this.onChannelTap,
    this.initialChannelId,
  });

  @override
  State<LightMultiChannelControlPanel> createState() =>
      _LightMultiChannelControlPanelState();
}

class _LightMultiChannelControlPanelState
    extends State<LightMultiChannelControlPanel> {
  DeviceControlStateService? _deviceControlStateService;
  IntentOverlayService? _intentOverlayService;
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  // Debounce timers for sliders
  Timer? _brightnessDebounceTimer;
  Timer? _colorDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  // Selected channel index for focused control
  int _selectedChannelIndex = 0;

  LightingDeviceView get _device => widget.device;
  List<LightChannelView> get _channels => widget.channels;
  LightChannelView get _selectedChannel => _channels[_selectedChannelIndex];

  @override
  void initState() {
    super.initState();

    // Initialize selected channel from initialChannelId if provided
    if (widget.initialChannelId != null) {
      final index = _channels.indexWhere((c) => c.id == widget.initialChannelId);
      if (index != -1) {
        _selectedChannelIndex = index;
      }
    }

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[LightMultiChannelControlPanel] Failed to get DeviceControlStateService: $e');
      }
    }

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[LightMultiChannelControlPanel] Failed to get IntentOverlayService: $e');
      }
    }
  }

  @override
  void dispose() {
    _brightnessDebounceTimer?.cancel();
    _colorDebounceTimer?.cancel();
    _temperatureDebounceTimer?.cancel();
    _whiteDebounceTimer?.cancel();
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  void _onIntentChanged() {
    if (mounted) setState(() {});
  }

  // ============================================================================
  // Aggregated Capabilities
  // ============================================================================

  Set<LightCapability> _buildCapabilities() {
    final caps = <LightCapability>{LightCapability.power};
    for (final channel in _channels) {
      if (channel.hasBrightness) caps.add(LightCapability.brightness);
      if (channel.hasColor) caps.add(LightCapability.color);
      if (channel.hasTemperature) caps.add(LightCapability.colorTemp);
      if (channel.hasColorWhite) caps.add(LightCapability.white);
    }
    return caps;
  }

  // ============================================================================
  // Aggregated Value Getters
  // ============================================================================

  bool _getAnyOn() {
    for (final channel in _channels) {
      final controlState = _deviceControlStateService;
      if (controlState != null &&
          controlState.isLocked(_device.id, channel.id, channel.onProp.id)) {
        final desiredValue = controlState.getDesiredValue(
          _device.id,
          channel.id,
          channel.onProp.id,
        );
        if (desiredValue is bool && desiredValue) return true;
        if (desiredValue is num && desiredValue > 0.5) return true;
      } else if (channel.on) {
        return true;
      }
    }
    return false;
  }

  int _getAverageBrightness() {
    int total = 0;
    int count = 0;
    for (final channel in _channels) {
      if (!channel.hasBrightness) continue;
      final prop = channel.brightnessProp;
      if (prop == null) continue;

      final controlState = _deviceControlStateService;
      if (controlState != null &&
          controlState.isLocked(_device.id, channel.id, prop.id)) {
        final desiredValue = controlState.getDesiredValue(
          _device.id,
          channel.id,
          prop.id,
        );
        if (desiredValue is num) {
          total += desiredValue.round();
          count++;
        }
      } else {
        total += channel.brightness;
        count++;
      }
    }
    return count > 0 ? (total / count).round() : 100;
  }

  int _getAverageColorTemp() {
    int total = 0;
    int count = 0;
    for (final channel in _channels) {
      if (!channel.hasTemperature) continue;
      final prop = channel.temperatureProp;
      if (prop == null) continue;

      final controlState = _deviceControlStateService;
      if (controlState != null &&
          controlState.isLocked(_device.id, channel.id, prop.id)) {
        final desiredValue = controlState.getDesiredValue(
          _device.id,
          channel.id,
          prop.id,
        );
        if (desiredValue is num) {
          total += desiredValue.round();
          count++;
        }
      } else if (prop.value is NumberValueType) {
        total += (prop.value as NumberValueType).value.toInt();
        count++;
      }
    }
    return count > 0 ? (total / count).round() : 4000;
  }

  Color? _getFirstColor() {
    for (final channel in _channels) {
      if (!channel.hasColor) continue;
      try {
        if (channel.hueProp != null) {
          final hue = channel.hue.toDouble();
          return HSVColor.fromAHSV(1.0, hue, 1.0, 1.0).toColor();
        }
        if (channel.colorRedProp != null) {
          return Color.fromARGB(
            255,
            channel.colorRed,
            channel.colorGreen,
            channel.colorBlue,
          );
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  int? _getAverageWhite() {
    int total = 0;
    int count = 0;
    for (final channel in _channels) {
      if (!channel.hasColorWhite) continue;
      final prop = channel.colorWhiteProp;
      if (prop == null) continue;

      final controlState = _deviceControlStateService;
      if (controlState != null &&
          controlState.isLocked(_device.id, channel.id, prop.id)) {
        final desiredValue = controlState.getDesiredValue(
          _device.id,
          channel.id,
          prop.id,
        );
        if (desiredValue is num) {
          total += desiredValue.round();
          count++;
        }
      } else {
        total += channel.colorWhite;
        count++;
      }
    }
    return count > 0 ? (total / count).round() : null;
  }

  // ============================================================================
  // Build Channels List
  // ============================================================================

  List<LightingChannelData> _buildChannelsList() {
    return _channels.asMap().entries.map((entry) {
      final index = entry.key;
      final channel = entry.value;

      // Get optimistic on state
      bool isOn = channel.on;
      final controlState = _deviceControlStateService;
      if (controlState != null &&
          controlState.isLocked(_device.id, channel.id, channel.onProp.id)) {
        final desiredValue = controlState.getDesiredValue(
          _device.id,
          channel.id,
          channel.onProp.id,
        );
        if (desiredValue is bool) {
          isOn = desiredValue;
        } else if (desiredValue is num) {
          isOn = desiredValue > 0.5;
        }
      }

      // Get optimistic brightness
      int brightness = channel.hasBrightness ? channel.brightness : 100;
      final brightnessProp = channel.brightnessProp;
      if (brightnessProp != null &&
          controlState != null &&
          controlState.isLocked(_device.id, channel.id, brightnessProp.id)) {
        final desiredValue = controlState.getDesiredValue(
          _device.id,
          channel.id,
          brightnessProp.id,
        );
        if (desiredValue is num) {
          brightness = desiredValue.round();
        }
      }

      return LightingChannelData(
        id: channel.id,
        name: channel.name,
        isOn: isOn,
        brightness: brightness,
        hasBrightness: channel.hasBrightness,
        isOnline: _device.isOnline,
        isSelected: index == _selectedChannelIndex,
      );
    }).toList();
  }

  void _handleChannelSelect(LightingChannelData channelData) {
    final index = _channels.indexWhere((c) => c.id == channelData.id);
    if (index != -1 && index != _selectedChannelIndex) {
      setState(() {
        _selectedChannelIndex = index;
      });
    }
  }

  // ============================================================================
  // Command Handlers
  // ============================================================================

  void _handlePowerToggle() async {
    final newState = !_getAnyOn();
    final List<PropertyCommandItem> commands = [];

    for (final channel in _channels) {
      // Set PENDING state
      _deviceControlStateService?.setPending(
        _device.id,
        channel.id,
        channel.onProp.id,
        newState,
      );

      commands.add(PropertyCommandItem(
        deviceId: _device.id,
        channelId: channel.id,
        propertyId: channel.onProp.id,
        value: newState,
      ));
    }
    setState(() {});

    try {
      await _valueHelper.setMultiplePropertyValues(context, commands);
    } finally {
      if (mounted) {
        for (final channel in _channels) {
          _deviceControlStateService?.setSettling(
            _device.id,
            channel.id,
            channel.onProp.id,
          );
        }
      }
    }
  }

  void _handleBrightnessChanged(int value) {
    // Set PENDING state for all channels with brightness
    for (final channel in _channels) {
      final prop = channel.brightnessProp;
      if (prop == null) continue;
      _deviceControlStateService?.setPending(
        _device.id,
        channel.id,
        prop.id,
        value,
      );
    }
    setState(() {});

    // Debounce the actual command
    _brightnessDebounceTimer?.cancel();
    _brightnessDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if any is off
        if (!_getAnyOn()) {
          for (final channel in _channels) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.onProp.id,
              value: true,
            ));
          }
        }

        // Set brightness for all channels
        for (final channel in _channels) {
          final prop = channel.brightnessProp;
          if (prop == null) continue;
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: prop.id,
            value: value.toDouble(),
          ));
        }

        await _valueHelper.setMultiplePropertyValues(context, commands);

        if (mounted) {
          for (final channel in _channels) {
            final prop = channel.brightnessProp;
            if (prop == null) continue;
            _deviceControlStateService?.setSettling(
              _device.id,
              channel.id,
              prop.id,
            );
          }
        }
      },
    );
  }

  void _handleColorTempChanged(int value) {
    // Set PENDING state for all channels with temperature
    for (final channel in _channels) {
      final prop = channel.temperatureProp;
      if (prop == null) continue;
      _deviceControlStateService?.setPending(
        _device.id,
        channel.id,
        prop.id,
        value,
      );
    }
    setState(() {});

    // Debounce the actual command
    _temperatureDebounceTimer?.cancel();
    _temperatureDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if any is off
        if (!_getAnyOn()) {
          for (final channel in _channels) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.onProp.id,
              value: true,
            ));
          }
        }

        // Set temperature for all channels
        for (final channel in _channels) {
          final prop = channel.temperatureProp;
          if (prop == null) continue;
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: prop.id,
            value: value.toDouble(),
          ));
        }

        await _valueHelper.setMultiplePropertyValues(context, commands);

        if (mounted) {
          for (final channel in _channels) {
            final prop = channel.temperatureProp;
            if (prop == null) continue;
            _deviceControlStateService?.setSettling(
              _device.id,
              channel.id,
              prop.id,
            );
          }
        }
      },
    );
  }

  void _handleColorChanged(Color color, double saturation) {
    // Debounce the actual command
    _colorDebounceTimer?.cancel();
    _colorDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final hsvColor = HSVColor.fromColor(color);
        final rgbValue = ColorUtils.toRGB(color);
        final List<PropertyCommandItem> commands = [];

        // Turn on if any is off
        if (!_getAnyOn()) {
          for (final channel in _channels) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.onProp.id,
              value: true,
            ));
          }
        }

        // Set color for all channels
        for (final channel in _channels) {
          if (!channel.hasColor) continue;

          if (channel.hueProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.hueProp!.id,
              value: hsvColor.hue,
            ));
          }
          if (channel.colorRedProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.colorRedProp!.id,
              value: rgbValue.red,
            ));
          }
          if (channel.colorGreenProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.colorGreenProp!.id,
              value: rgbValue.green,
            ));
          }
          if (channel.colorBlueProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.colorBlueProp!.id,
              value: rgbValue.blue,
            ));
          }
        }

        await _valueHelper.setMultiplePropertyValues(context, commands);
      },
    );
  }

  void _handleWhiteChannelChanged(int value) {
    // Set PENDING state for all channels with white
    for (final channel in _channels) {
      final prop = channel.colorWhiteProp;
      if (prop == null) continue;
      _deviceControlStateService?.setPending(
        _device.id,
        channel.id,
        prop.id,
        value,
      );
    }
    setState(() {});

    // Debounce the actual command
    _whiteDebounceTimer?.cancel();
    _whiteDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if any is off
        if (!_getAnyOn()) {
          for (final channel in _channels) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.onProp.id,
              value: true,
            ));
          }
        }

        // Set white for all channels
        for (final channel in _channels) {
          final prop = channel.colorWhiteProp;
          if (prop == null) continue;
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: prop.id,
            value: value.toDouble(),
          ));
        }

        await _valueHelper.setMultiplePropertyValues(context, commands);

        if (mounted) {
          for (final channel in _channels) {
            final prop = channel.colorWhiteProp;
            if (prop == null) continue;
            _deviceControlStateService?.setSettling(
              _device.id,
              channel.id,
              prop.id,
            );
          }
        }
      },
    );
  }

  void _handleChannelIconTap(LightingChannelData channelData) async {
    // Find the channel and toggle it
    final channel = _channels.firstWhere(
      (c) => c.id == channelData.id,
      orElse: () => _channels.first,
    );

    final newState = !channelData.isOn;

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      channel.onProp.id,
      newState,
    );
    setState(() {});

    try {
      await _valueHelper.setPropertyValue(
        context,
        channel.onProp,
        newState,
        deviceId: _device.id,
        channelId: channel.id,
      );
    } finally {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          channel.onProp.id,
        );
      }
    }
  }

  void _handleChannelTileTap(LightingChannelData channelData) {
    // Change selected channel (tap on tile = select, tap on icon = toggle)
    _handleChannelSelect(channelData);
  }

  // ============================================================================
  // Selected Channel Command Handlers
  // ============================================================================

  void _handleSelectedChannelPowerToggle() async {
    final channel = _selectedChannel;
    final newState = !_getSelectedChannelIsOn();

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      channel.onProp.id,
      newState,
    );
    setState(() {});

    try {
      await _valueHelper.setPropertyValue(
        context,
        channel.onProp,
        newState,
        deviceId: _device.id,
        channelId: channel.id,
      );
    } finally {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          channel.onProp.id,
        );
      }
    }
  }

  void _handleSelectedChannelBrightnessChanged(int value) {
    final channel = _selectedChannel;
    final prop = channel.brightnessProp;
    if (prop == null) return;

    _deviceControlStateService?.setPending(_device.id, channel.id, prop.id, value);
    setState(() {});

    _brightnessDebounceTimer?.cancel();
    _brightnessDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if off
        if (!_getSelectedChannelIsOn()) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: channel.onProp.id,
            value: true,
          ));
        }

        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: channel.id,
          propertyId: prop.id,
          value: value.toDouble(),
        ));

        await _valueHelper.setMultiplePropertyValues(context, commands);

        if (mounted) {
          _deviceControlStateService?.setSettling(_device.id, channel.id, prop.id);
        }
      },
    );
  }

  void _handleSelectedChannelColorTempChanged(int value) {
    final channel = _selectedChannel;
    final prop = channel.temperatureProp;
    if (prop == null) return;

    _deviceControlStateService?.setPending(_device.id, channel.id, prop.id, value);
    setState(() {});

    _temperatureDebounceTimer?.cancel();
    _temperatureDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if off
        if (!_getSelectedChannelIsOn()) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: channel.onProp.id,
            value: true,
          ));
        }

        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: channel.id,
          propertyId: prop.id,
          value: value.toDouble(),
        ));

        await _valueHelper.setMultiplePropertyValues(context, commands);

        if (mounted) {
          _deviceControlStateService?.setSettling(_device.id, channel.id, prop.id);
        }
      },
    );
  }

  void _handleSelectedChannelColorChanged(Color color, double saturation) {
    final channel = _selectedChannel;
    if (!channel.hasColor) return;

    _colorDebounceTimer?.cancel();
    _colorDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if off
        if (!_getSelectedChannelIsOn()) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: channel.onProp.id,
            value: true,
          ));
        }

        // HSV mode
        if (channel.hasHue) {
          final hsv = HSVColor.fromColor(color);
          if (channel.hueProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.hueProp!.id,
              value: hsv.hue.round(),
            ));
          }
          if (channel.saturationProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.saturationProp!.id,
              value: (saturation * 100).round(),
            ));
          }
        }
        // RGB mode
        else if (channel.hasColorRed) {
          final rgbValue = ColorUtils.toRGB(color);
          if (channel.colorRedProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.colorRedProp!.id,
              value: rgbValue.red,
            ));
          }
          if (channel.colorGreenProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.colorGreenProp!.id,
              value: rgbValue.green,
            ));
          }
          if (channel.colorBlueProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.colorBlueProp!.id,
              value: rgbValue.blue,
            ));
          }
        }

        await _valueHelper.setMultiplePropertyValues(context, commands);
      },
    );
  }

  void _handleSelectedChannelWhiteChanged(int value) {
    final channel = _selectedChannel;
    final prop = channel.colorWhiteProp;
    if (prop == null) return;

    _deviceControlStateService?.setPending(_device.id, channel.id, prop.id, value);
    setState(() {});

    _whiteDebounceTimer?.cancel();
    _whiteDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if off
        if (!_getSelectedChannelIsOn()) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: channel.onProp.id,
            value: true,
          ));
        }

        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: channel.id,
          propertyId: prop.id,
          value: value.toDouble(),
        ));

        await _valueHelper.setMultiplePropertyValues(context, commands);

        if (mounted) {
          _deviceControlStateService?.setSettling(_device.id, channel.id, prop.id);
        }
      },
    );
  }

  // ============================================================================
  // Selected Channel Value Getters
  // ============================================================================

  bool _getSelectedChannelIsOn() {
    final channel = _selectedChannel;
    final controlState = _deviceControlStateService;

    if (controlState != null &&
        controlState.isLocked(_device.id, channel.id, channel.onProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channel.id,
        channel.onProp.id,
      );
      if (desiredValue is bool) return desiredValue;
      if (desiredValue is num) return desiredValue > 0.5;
    }
    return channel.on;
  }

  int _getSelectedChannelBrightness() {
    final channel = _selectedChannel;
    if (!channel.hasBrightness) return 100;

    final controlState = _deviceControlStateService;
    final brightnessProp = channel.brightnessProp;

    if (brightnessProp != null &&
        controlState != null &&
        controlState.isLocked(_device.id, channel.id, brightnessProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channel.id,
        brightnessProp.id,
      );
      if (desiredValue is num) return desiredValue.round();
    }
    return channel.brightness;
  }

  int _getSelectedChannelColorTemp() {
    final channel = _selectedChannel;
    if (!channel.hasTemperature) return 4000;

    final controlState = _deviceControlStateService;
    final tempProp = channel.temperatureProp;

    if (tempProp != null &&
        controlState != null &&
        controlState.isLocked(_device.id, channel.id, tempProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channel.id,
        tempProp.id,
      );
      if (desiredValue is num) return desiredValue.round();
    }

    final value = tempProp?.value;
    if (value is NumberValueType) return value.value.toInt();
    return 4000;
  }

  Color? _getSelectedChannelColor() {
    final channel = _selectedChannel;
    if (!channel.hasColor) return null;

    try {
      if (channel.hasColorRed) {
        return ColorUtils.fromRGB(
          channel.colorRed,
          channel.colorGreen,
          channel.colorBlue,
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LightMultiChannelControlPanel] Error getting color: $e');
      }
    }
    return null;
  }

  int _getSelectedChannelWhite() {
    final channel = _selectedChannel;
    if (!channel.hasColorWhite) return 100;

    final controlState = _deviceControlStateService;
    final whiteProp = channel.colorWhiteProp;

    if (whiteProp != null &&
        controlState != null &&
        controlState.isLocked(_device.id, channel.id, whiteProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channel.id,
        whiteProp.id,
      );
      if (desiredValue is num) return desiredValue.round();
    }
    return channel.colorWhite;
  }

  Set<LightCapability> _buildSelectedChannelCapabilities() {
    final channel = _selectedChannel;
    final caps = <LightCapability>{LightCapability.power};
    if (channel.hasBrightness) caps.add(LightCapability.brightness);
    if (channel.hasColor) caps.add(LightCapability.color);
    if (channel.hasTemperature) caps.add(LightCapability.colorTemp);
    if (channel.hasColorWhite) caps.add(LightCapability.white);
    return caps;
  }

  // ============================================================================
  // Build
  // ============================================================================

  @override
  Widget build(BuildContext context) {
    // Get values from selected channel (not aggregated)
    final isOn = _getSelectedChannelIsOn();
    final brightness = _getSelectedChannelBrightness();
    final colorTemp = _getSelectedChannelColorTemp();
    final color = _getSelectedChannelColor();
    final white = _getSelectedChannelWhite();
    final capabilities = _buildSelectedChannelCapabilities();
    final channelsList = _buildChannelsList();

    // Header: channel name as title, device name as subtitle (if different)
    final channelName = _selectedChannel.name;
    final deviceName = _device.name;
    final showSubtitle = channelName.toLowerCase() != deviceName.toLowerCase();

    return LightingControlPanel(
      // Header configuration
      showHeader: widget.showHeader,
      title: channelName,
      subtitle: showSubtitle ? deviceName : null,
      icon: MdiIcons.lightbulb,
      onBack: widget.onBack,

      // Selected channel values
      isOn: isOn,
      brightness: brightness,
      colorTemp: colorTemp,
      color: color,
      saturation: 1.0,
      whiteChannel: white,

      // Configuration
      capabilities: capabilities,
      state: LightingState.synced,
      channels: channelsList,
      channelsPanelIcon: MdiIcons.lightbulbGroup,

      // Callbacks
      onPowerToggle: _handleSelectedChannelPowerToggle,
      onBrightnessChanged: _handleSelectedChannelBrightnessChanged,
      onColorTempChanged: _handleSelectedChannelColorTempChanged,
      onColorChanged: _handleSelectedChannelColorChanged,
      onWhiteChannelChanged: _handleSelectedChannelWhiteChanged,
      onChannelIconTap: _handleChannelIconTap,
      onChannelTileTap: _handleChannelTileTap,
    );
  }
}

class LightTileItem {
  final IconData _icon;
  final String _title;
  final String _subtitle;
  final String? _trailingText;
  final IconData? _trailingIcon;
  final String? _unit;

  LightTileItem({
    required IconData icon,
    required String title,
    required String subtitle,
    String? trailingText,
    IconData? trailingIcon,
    String? unit,
  })  : _icon = icon,
        _title = title,
        _subtitle = subtitle,
        _trailingText = trailingText,
        _trailingIcon = trailingIcon,
        _unit = unit;

  IconData get icon => _icon;

  String get title => _title;

  String get subtitle => _subtitle;

  String? get trailingText => _trailingText;

  IconData? get trailingIcon => _trailingIcon;

  String? get unit => _unit;
}
