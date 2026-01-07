import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/utils/enum.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/button_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_switch.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_channel_detail.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_mode_navigation.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_state_display.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/value.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/modules/displays/export.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class LightingDeviceDetail extends StatefulWidget {
  final LightingDeviceView _device;

  const LightingDeviceDetail({
    super.key,
    required LightingDeviceView device,
  }) : _device = device;

  @override
  State<LightingDeviceDetail> createState() => _LightingDeviceDetailState();
}

class _LightingDeviceDetailState extends State<LightingDeviceDetail> {
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  late List<LightMode> _availableModes;
  late LightMode _currentMode;
  late List<LightChannelView> _channels;

  // Track which channels are being toggled
  final Set<String> _togglingChannels = {};

  @override
  void initState() {
    super.initState();
    _initializeWidget();
  }

  @override
  void didUpdateWidget(covariant LightingDeviceDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    _initializeWidget();
  }

  void _initializeWidget() {
    _channels = widget._device.lightChannels;

    _availableModes = LightModeNavigation.createModesList(
      hasBrightness: widget._device.hasBrightness,
      hasColor: widget._device.hasColor,
      hasTemperature: widget._device.hasTemperature,
      hasWhite: widget._device.hasWhite,
    );

    // Start with brightness mode if available
    if (_availableModes.contains(LightMode.brightness)) {
      _currentMode = LightMode.brightness;
    } else if (_availableModes.length > 1) {
      _currentMode = _availableModes[1];
    } else {
      _currentMode = LightMode.off;
    }
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

  /// Layout for simple ON/OFF devices with single channel - two-column with large switch
  Widget _buildSimpleDeviceLayout(BuildContext context) {
    final channel = _channels.first;

    return SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final elementMaxSize = constraints.maxHeight - 2 * AppSpacings.pMd;

          return Padding(
            padding: AppSpacings.paddingMd,
            child: Row(
              children: [
                // Left: State display
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(right: AppSpacings.pLg),
                    child: LightStateDisplay(
                      brightness: 0,
                      anyOn: channel.on,
                      hasBrightness: false,
                      useSingular: true,
                    ),
                  ),
                ),
                // Right: Large switch
                ColoredSwitch(
                  switchState: channel.on,
                  iconOn: MdiIcons.power,
                  iconOff: MdiIcons.power,
                  trackWidth: elementMaxSize,
                  vertical: true,
                  onChanged: (value) => _toggleChannel(channel, value),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  /// Layout for single channel devices with capabilities
  Widget _buildSingleChannelLayout(BuildContext context) {
    final channel = _channels.first;

    return Column(
      children: [
        Expanded(
          child: SafeArea(
            bottom: false,
            child: LightSingleChannelDetail(
              device: widget._device,
              channel: channel,
              mode: _lightModeToChannelMode(_currentMode),
            ),
          ),
        ),
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
                  _toggleChannel(channel, true);
                }
              },
              onPowerToggle: () => _toggleChannel(channel, !channel.on),
            ),
          ),
      ],
    );
  }

  /// Layout for multi-channel devices - tiles grid only
  Widget _buildMultiChannelLayout(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return SafeArea(
      child: Padding(
        padding: AppSpacings.paddingMd,
        child: LayoutBuilder(
          builder: (context, constraints) {
            // 2 tiles per row with spacing
            final spacing = AppSpacings.pMd;
            final tilesPerRow = 2;

            return GridView.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: tilesPerRow,
                crossAxisSpacing: spacing,
                mainAxisSpacing: spacing,
                childAspectRatio: 1.0,
              ),
              itemCount: _channels.length,
              itemBuilder: (context, index) {
                final channel = _channels[index];
                final isOn = channel.on;
                final isToggling = _togglingChannels.contains(channel.id);
                final hasBrightness = channel.hasBrightness;
                final brightness = hasBrightness ? channel.brightness : null;

                // Build subtitle: On/Off state with optional brightness
                final stateText =
                    isOn ? localizations.light_state_on : localizations.light_state_off;
                final showBrightness = hasBrightness && isOn && brightness != null;

                return ButtonTileBox(
                  onTap: isToggling
                      ? null
                      : () => _openChannelDetail(context, channel),
                  isOn: isOn,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          ButtonTileIcon(
                            icon: isOn
                                ? MdiIcons.lightbulbOn
                                : MdiIcons.lightbulbOutline,
                            onTap: isToggling
                                ? null
                                : () => _toggleChannel(channel, !isOn),
                            isOn: isOn,
                            isLoading: isToggling,
                          ),
                          // Offline indicator badge
                          if (!widget._device.isOnline)
                            Positioned(
                              right: -2,
                              bottom: -2,
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: BoxDecoration(
                                  color: Theme.of(context).scaffoldBackgroundColor,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  MdiIcons.alert,
                                  size: AppFontSize.extraSmall,
                                  color: AppColorsLight.warning,
                                ),
                              ),
                            ),
                        ],
                      ),
                      AppSpacings.spacingSmVertical,
                      ButtonTileTitle(
                        title: channel.name,
                        isOn: isOn,
                      ),
                      AppSpacings.spacingXsVertical,
                      ButtonTileSubTitle(
                        subTitle: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(stateText),
                            if (showBrightness) ...[
                              AppSpacings.spacingSmHorizontal,
                              Icon(
                                MdiIcons.weatherSunny,
                                size: AppFontSize.extraSmall,
                                color: Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.placeholder
                                    : AppTextColorDark.placeholder,
                              ),
                              const SizedBox(width: 2),
                              Text('$brightness%'),
                            ],
                          ],
                        ),
                        isOn: isOn,
                      ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
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

  /// Toggle a single channel
  Future<void> _toggleChannel(LightChannelView channel, bool newState) async {
    setState(() {
      _togglingChannels.add(channel.id);
    });

    try {
      await _valueHelper.setPropertyValue(
        context,
        channel.onProp,
        newState,
        deviceId: widget._device.id,
        channelId: channel.id,
      );
    } finally {
      if (mounted) {
        setState(() {
          _togglingChannels.remove(channel.id);
        });
      }
    }
  }

  /// Convert LightMode to LightChannelModeType for compatibility
  LightChannelModeType _lightModeToChannelMode(LightMode mode) {
    switch (mode) {
      case LightMode.off:
        return LightChannelModeType.off;
      case LightMode.brightness:
        return LightChannelModeType.brightness;
      case LightMode.color:
        return LightChannelModeType.color;
      case LightMode.temperature:
        return LightChannelModeType.temperature;
      case LightMode.white:
        return LightChannelModeType.white;
    }
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
            _valueHelper.setPropertyValue(
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

            // Send all color properties in a single batch command
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
            _valueHelper.setPropertyValue(
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
            _valueHelper.setPropertyValue(
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

  late ChannelPropertyView? _property;

  late num? _brightness;

  @override
  void initState() {
    super.initState();
    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (_) {}
    _initializeWidget();
  }

  @override
  void dispose() {
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  void _onIntentChanged() {
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
    final localizations = AppLocalizations.of(context)!;

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

    // Check if property is locked by intent
    final isLocked = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.isPropertyLocked(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            ) ?? false
        : false;

    // Get overlay value if locked
    final overlayValue = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.getOverlayValue(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            )
        : null;

    // Use overlay value if available, otherwise use actual value
    final displayValue = overlayValue is num
        ? overlayValue.toDouble()
        : (_brightness ?? min);

    return ColoredSlider(
      value: displayValue,
      min: min,
      max: max,
      enabled: widget._channel.on && !isLocked,
      vertical: widget._vertical,
      trackWidth: widget._elementMaxSize,
      showThumb: false,
      onValueChanged: (double value) {
        setState(() {
          _brightness = value;
        });

        widget._onValueChanged?.call(value);
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
                              localizations.value_not_available,
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
  late double _color;

  @override
  void initState() {
    super.initState();
    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (_) {}
    _initializeWidget();
  }

  @override
  void dispose() {
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  void _onIntentChanged() {
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
    final isLocked = widget._deviceId != null &&
            widget._channelId != null &&
            hueProp != null
        ? _intentOverlayService?.isPropertyLocked(
              widget._deviceId!,
              widget._channelId!,
              hueProp.id,
            ) ?? false
        : false;

    // Get overlay hue value if locked
    final overlayHue = widget._deviceId != null &&
            widget._channelId != null &&
            hueProp != null
        ? _intentOverlayService?.getOverlayValue(
              widget._deviceId!,
              widget._channelId!,
              hueProp.id,
            )
        : null;

    // Use overlay value if available, otherwise use actual color
    final displayValue = overlayHue is num
        ? (overlayHue.toDouble() / 360.0).clamp(0.0, 1.0)
        : _color;

    return ColoredSlider(
      value: displayValue,
      min: 0.0,
      max: 1.0,
      enabled: widget._channel.on && !isLocked,
      vertical: widget._vertical,
      trackWidth: widget._elementMaxSize,
      onValueChanged: (double value) {
        setState(() {
          _color = value;
        });

        widget._onValueChanged?.call(_getColorFromValue(value));
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

  late ChannelPropertyView? _property;

  late num? _temperature;

  @override
  void initState() {
    super.initState();
    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (_) {}
    _initializeWidget();
  }

  @override
  void dispose() {
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  void _onIntentChanged() {
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

    // Check if property is locked by intent
    final isLocked = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.isPropertyLocked(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            ) ?? false
        : false;

    // Get overlay value if locked
    final overlayValue = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.getOverlayValue(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            )
        : null;

    // Use overlay value if available, otherwise use actual value
    final displayValue = overlayValue is num
        ? overlayValue.toDouble()
        : (_temperature ?? min);

    return ColoredSlider(
      value: displayValue,
      min: min,
      max: max,
      enabled: widget._channel.on && !isLocked,
      vertical: widget._vertical,
      trackWidth: widget._elementMaxSize,
      onValueChanged: (double value) {
        setState(() {
          _temperature = value;
        });

        widget._onValueChanged?.call(value);
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

  late ChannelPropertyView? _property;

  late num? _white;

  @override
  void initState() {
    super.initState();
    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (_) {}
    _initializeWidget();
  }

  @override
  void dispose() {
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  void _onIntentChanged() {
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

    // Check if property is locked by intent
    final isLocked = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.isPropertyLocked(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            ) ?? false
        : false;

    // Get overlay value if locked
    final overlayValue = widget._deviceId != null &&
            widget._channelId != null &&
            widget._propertyId != null
        ? _intentOverlayService?.getOverlayValue(
              widget._deviceId!,
              widget._channelId!,
              widget._propertyId!,
            )
        : null;

    // Use overlay value if available, otherwise use actual value
    final displayValue = overlayValue is num
        ? overlayValue.toDouble()
        : (_white ?? min);

    return ColoredSlider(
      value: displayValue,
      min: min,
      max: max,
      enabled: widget._channel.on && !isLocked,
      vertical: widget._vertical,
      trackWidth: widget._elementMaxSize,
      showThumb: false,
      onValueChanged: (double value) {
        setState(() {
          _white = value;
        });

        widget._onValueChanged?.call(value);
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

class ChannelActualBrightness extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final LightChannelView _channel;
  final bool _showName;

  ChannelActualBrightness({
    super.key,
    required LightChannelView channel,
    showName = false,
  })  : _channel = channel,
        _showName = showName;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final ChannelPropertyView? property = _channel.brightnessProp;

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
                  text: _channel.on
                      ? (property != null
                              ? ValueUtils.formatValue(property)
                              : null) ??
                          localizations.value_not_available
                      : localizations.light_state_off,
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
              _channel.on
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
            _showName
                ? _channel.name
                : _channel.on
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
