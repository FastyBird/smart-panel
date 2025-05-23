import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/utils/enum.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/details/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/value.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class LightingDeviceDetailPage extends StatefulWidget {
  final LightingDeviceView _device;

  final bool _supportSwatches = false;

  const LightingDeviceDetailPage({
    super.key,
    required LightingDeviceView device,
  }) : _device = device;

  @override
  State<LightingDeviceDetailPage> createState() =>
      _LightingDeviceDetailPageState();
}

class _LightingDeviceDetailPageState extends State<LightingDeviceDetailPage> {
  LightChannelModeType _colorMode = LightChannelModeType.off;
  final PropertyValueHelper _valueHelper = PropertyValueHelper();
  final List<LightChannelModeType> _lightModes = [];

  late int _currentModeIndex;
  late int _selectedChannel;

  late List<LightChannelView> _channels;

  @override
  void initState() {
    super.initState();

    _initializeWidget();

    _selectedChannel = 0;

    _lightModes.add(LightChannelModeType.off);

    if (widget._device.hasBrightness) {
      _lightModes.add(LightChannelModeType.brightness);
    }
    if (widget._device.hasColor) {
      _lightModes.add(LightChannelModeType.color);
    }
    if (widget._device.hasTemperature) {
      _lightModes.add(LightChannelModeType.temperature);
    }
    if (widget._device.hasWhite) {
      _lightModes.add(LightChannelModeType.white);
    }
    if (widget._supportSwatches) {
      _lightModes.add(LightChannelModeType.swatches);
    }

    if (_lightModes.length >= 2) {
      _colorMode = _lightModes[1];
    }

    if (_channels.isNotEmpty) {
      _currentModeIndex = _channels[_selectedChannel].on ? 1 : 0;
    } else {
      _currentModeIndex = 0;
    }
  }

  @override
  void didUpdateWidget(covariant LightingDeviceDetailPage oldWidget) {
    super.didUpdateWidget(oldWidget);

    _initializeWidget();
  }

  void _initializeWidget() {
    _channels = widget._device.lightChannels;
  }

  @override
  Widget build(BuildContext context) {
    final parentDetailPage =
        context.findAncestorWidgetOfExactType<DeviceDetailPage>();

    if (!widget._device.isSimpleLight &&
        !widget._device.isSingleBrightness &&
        _channels.length > 1) {
      return DefaultTabController(
        initialIndex: 0,
        length: _channels.length,
        child: Scaffold(
          appBar: ScreenAppBar(
            title: widget._device.name,
            icon: parentDetailPage == null
                ? buildDeviceIcon(widget._device.category)
                : null,
            bottom: TabBar(
              tabs: _channels
                  .map(
                    (channel) => Tab(
                      text: channel.name,
                    ),
                  )
                  .toList(),
            ),
          ),
          body: Builder(
            builder: (BuildContext context) {
              final TabController tabController = DefaultTabController.of(
                context,
              );

              tabController.addListener(() {
                if (!tabController.indexIsChanging) {
                  setState(() {
                    _selectedChannel = tabController.index;
                  });
                }
              });

              return TabBarView(
                children: _channels
                    .map(
                      (channel) => LightSingleChannelDetail(
                        device: widget._device,
                        channel: channel,
                        mode: _colorMode,
                      ),
                    )
                    .toList(),
              );
            },
          ),
          bottomNavigationBar: _renderBottomNavigation(
            context,
            _channels,
          ),
        ),
      );
    }

    return Scaffold(
      appBar: ScreenAppBar(
        title: widget._device.name,
        icon: parentDetailPage == null ? widget._device.icon : null,
      ),
      body: LayoutBuilder(builder: (
        BuildContext context,
        BoxConstraints constraints,
      ) {
        if (widget._device.isSimpleLight ||
            (widget._device.isSingleBrightness && _channels.length >= 2)) {
          return LightSimpleDetail(
            device: widget._device,
            withBrightness:
                widget._device.isSingleBrightness && _channels.length >= 2,
          );
        }

        final channel = _channels.first;

        return LightSingleChannelDetail(
          device: widget._device,
          channel: channel,
          mode: _colorMode,
        );
      }),
      bottomNavigationBar: _renderBottomNavigation(
        context,
        _channels,
      ),
    );
  }

  Widget? _renderBottomNavigation(
    BuildContext context,
    List<LightChannelView> channelCapabilities,
  ) {
    final localizations = AppLocalizations.of(context)!;

    if (widget._device.isSimpleLight ||
        (widget._device.isSingleBrightness &&
            channelCapabilities.length >= 2)) {
      return null;
    }

    if (_lightModes.length <= 1) return null;

    return BottomNavigationBar(
      selectedItemColor: Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.primary
          : AppColorsDark.primary,
      currentIndex: _currentModeIndex,
      onTap: (int index) async {
        if (_lightModes[index] == LightChannelModeType.off) {
          if (_channels[_selectedChannel].on) {
            setState(() {
              _currentModeIndex = 0;
              _colorMode = _lightModes[1];
            });
          } else {
            setState(() {
              _currentModeIndex = 1;
              _colorMode = _lightModes[1];
            });
          }

          _valueHelper.setPropertyValue(
            context,
            _channels[_selectedChannel].onProp,
            _channels[_selectedChannel].on ? false : true,
          );
        } else {
          setState(() {
            _currentModeIndex = index;
            _colorMode = _lightModes[index];
          });

          if (_channels[_selectedChannel].on == false) {
            _valueHelper.setPropertyValue(
              context,
              _channels[_selectedChannel].onProp,
              true,
            );
          }
        }
      },
      type: BottomNavigationBarType.fixed,
      items: _lightModes
          .map((mode) {
            switch (mode) {
              case LightChannelModeType.off:
                return BottomNavigationBarItem(
                  icon: Icon(MdiIcons.power),
                  label: localizations.light_mode_off,
                );
              case LightChannelModeType.brightness:
                return BottomNavigationBarItem(
                  icon: Icon(MdiIcons.weatherSunny),
                  label: localizations.light_mode_brightness,
                );
              case LightChannelModeType.color:
                return BottomNavigationBarItem(
                  icon: Icon(MdiIcons.paletteOutline),
                  label: localizations.light_mode_color,
                );
              case LightChannelModeType.temperature:
                return BottomNavigationBarItem(
                  icon: Icon(MdiIcons.thermometer),
                  label: localizations.light_mode_temperature,
                );
              case LightChannelModeType.white:
                return BottomNavigationBarItem(
                  icon: Icon(MdiIcons.lightbulbOutline),
                  label: localizations.light_mode_white,
                );
              case LightChannelModeType.swatches:
                return BottomNavigationBarItem(
                  icon: Icon(MdiIcons.paletteSwatchOutline),
                  label: localizations.light_mode_swatches,
                );
            }
          })
          .whereType<BottomNavigationBarItem>()
          .toList(),
    );
  }
}

class LightSimpleDetail extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
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
        elementMaxSize =
            elementMaxSize - _screenService.scale(45) - AppSpacings.pSm;
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
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) async {
            _valueHelper.setPropertyValue(
              context,
              brightnessProp,
              value,
            );
          },
        );
      }

      if (_mode == LightChannelModeType.color && _channel.hasColor) {
        controlElement = ColorChannel(
          channel: _channel,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (Color value) async {
            final rgbValue = ColorUtils.toRGB(value);
            final hsvValue = ColorUtils.toHSV(value);

            if (_channel.colorRedProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _channel.colorRedProp!,
                rgbValue.red,
              );
            }

            if (_channel.colorGreenProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _channel.colorGreenProp!,
                rgbValue.green,
              );
            }

            if (_channel.colorBlueProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _channel.colorBlueProp!,
                rgbValue.blue,
              );
            }

            if (_channel.hueProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _channel.hueProp!,
                hsvValue.hue,
              );
            }

            if (_channel.saturationProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _channel.saturationProp!,
                hsvValue.saturation,
              );
            }
          },
        );
      }

      final ChannelPropertyView? tempProp = _channel.temperatureProp;

      if (_mode == LightChannelModeType.temperature && tempProp != null) {
        controlElement = TemperatureChannel(
          channel: _channel,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) async {
            _valueHelper.setPropertyValue(
              context,
              tempProp,
              value,
            );
          },
        );
      }

      final ChannelPropertyView? colorWhiteProp = _channel.colorWhiteProp;

      if (_mode == LightChannelModeType.white && colorWhiteProp != null) {
        controlElement = WhiteChannel(
          channel: _channel,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) async {
            _valueHelper.setPropertyValue(
              context,
              colorWhiteProp,
              value,
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
  final double? _elementMaxSize;
  final bool _vertical;
  final bool _showValue;

  final ValueChanged<double>? _onValueChanged;

  const BrightnessChannel({
    super.key,
    required LightChannelView channel,
    double? elementMaxSize,
    bool vertical = false,
    bool showValue = false,
    ValueChanged<double>? onValueChanged,
  })  : _channel = channel,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _showValue = showValue,
        _onValueChanged = onValueChanged;

  @override
  State<BrightnessChannel> createState() => _BrightnessChannelState();
}

class _BrightnessChannelState extends State<BrightnessChannel> {
  final ScreenService _screenService = locator<ScreenService>();

  late ChannelPropertyView? _property;

  late num? _brightness;

  @override
  void initState() {
    super.initState();

    _initializeWidget();
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

    return ColoredSlider(
      value: _brightness ?? min,
      min: min,
      max: max,
      enabled: widget._channel.on,
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
                right: _screenService.scale(5),
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
                            fontSize: _screenService.scale(50),
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
                            fontSize: _screenService.scale(25),
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
          left: _screenService.scale(20),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: widget._vertical ? 1 : 0,
                child: Icon(
                  MdiIcons.weatherSunny,
                  size: _screenService.scale(40),
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
  final double? _elementMaxSize;
  final bool _vertical;

  final ValueChanged<Color>? _onValueChanged;

  const ColorChannel({
    super.key,
    required LightChannelView channel,
    double? elementMaxSize,
    bool vertical = false,
    ValueChanged<Color>? onValueChanged,
  })  : _channel = channel,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _onValueChanged = onValueChanged;

  @override
  State<ColorChannel> createState() => _ColorChannelState();
}

class _ColorChannelState extends State<ColorChannel> {
  late double _color;

  @override
  void initState() {
    super.initState();

    _initializeWidget();
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
    return ColoredSlider(
      value: _color,
      min: 0.0,
      max: 1.0,
      enabled: widget._channel.on,
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
  final double? _elementMaxSize;
  final bool _vertical;

  final ValueChanged<double>? _onValueChanged;

  const TemperatureChannel({
    super.key,
    required LightChannelView channel,
    double? elementMaxSize,
    bool vertical = false,
    ValueChanged<double>? onValueChanged,
  })  : _channel = channel,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _onValueChanged = onValueChanged;

  @override
  State<TemperatureChannel> createState() => _TemperatureChannelState();
}

class _TemperatureChannelState extends State<TemperatureChannel> {
  final ScreenService _screenService = locator<ScreenService>();

  late ChannelPropertyView? _property;

  late num? _temperature;

  @override
  void initState() {
    super.initState();

    _initializeWidget();
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

    return ColoredSlider(
      value: _temperature ?? min,
      min: min,
      max: max,
      enabled: widget._channel.on,
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
          left: _screenService.scale(5),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: widget._vertical ? 1 : 0,
                child: Icon(
                  MdiIcons.thermometer,
                  size: _screenService.scale(40),
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
  final double? _elementMaxSize;
  final bool _vertical;

  final ValueChanged<double>? _onValueChanged;

  const WhiteChannel({
    super.key,
    required LightChannelView channel,
    double? elementMaxSize,
    bool vertical = false,
    ValueChanged<double>? onValueChanged,
  })  : _channel = channel,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _onValueChanged = onValueChanged;

  @override
  State<WhiteChannel> createState() => _WhiteChannelState();
}

class _WhiteChannelState extends State<WhiteChannel> {
  final ScreenService _screenService = locator<ScreenService>();

  late ChannelPropertyView? _property;

  late num? _white;

  @override
  void initState() {
    super.initState();

    _initializeWidget();
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

    return ColoredSlider(
      value: _white ?? min,
      min: min,
      max: max,
      enabled: widget._channel.on,
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
          left: _screenService.scale(20),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: widget._vertical ? 1 : 0,
                child: Icon(
                  MdiIcons.lightbulbOutline,
                  size: _screenService.scale(40),
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
      width: _screenService.scale(widget._vertical ? 45 : 75),
      height: _screenService.scale(widget._vertical ? 75 : 45),
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
              size: _screenService.scale(35),
            ),
          ),
        ),
      ),
    );
  }
}

class ChannelActualBrightness extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

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
        minWidth: _screenService.scale(100),
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
                    fontSize: _screenService.scale(60),
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
                          fontSize: _screenService.scale(25),
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

  final LightChannelView _channel;

  ChannelActualColor({
    super.key,
    required LightChannelView channel,
  }) : _channel = channel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _screenService.scale(75),
      height: _screenService.scale(75),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(
            AppBorderRadius.base,
          ),
          border: Border.all(
            color: Theme.of(context).brightness == Brightness.light
                ? AppBorderColorLight.base
                : AppBorderColorDark.base,
            width: _screenService.scale(1),
          ),
        ),
        child: Padding(
          padding: EdgeInsets.all(_screenService.scale(1)),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(
                AppBorderRadius.base - 2 * _screenService.scale(1),
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

  final LightChannelView _channel;

  ChannelActualTemperature({
    super.key,
    required LightChannelView channel,
  }) : _channel = channel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _screenService.scale(75),
      height: _screenService.scale(75),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(
            AppBorderRadius.base,
          ),
          border: Border.all(
            color: Theme.of(context).brightness == Brightness.light
                ? AppBorderColorLight.base
                : AppBorderColorDark.base,
            width: _screenService.scale(1),
          ),
        ),
        child: Padding(
          padding: EdgeInsets.all(_screenService.scale(1)),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(
                AppBorderRadius.base - 2 * _screenService.scale(1),
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
              contentPadding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pSm,
              ),
              dense: true,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                side: BorderSide(
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppBorderColorLight.base
                      : AppBorderColorDark.base,
                  width: _screenService.scale(1),
                ),
              ),
              textColor: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
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
                  ? SizedBox(
                      width: _screenService.scale(50),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
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
                      ),
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

  Future<bool> setPropertyValue(
    BuildContext context,
    ChannelPropertyView property,
    dynamic value,
  ) async {
    final localizations = AppLocalizations.of(context)!;

    try {
      bool res = await _service.setPropertyValue(
        property.id,
        value,
      );

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
