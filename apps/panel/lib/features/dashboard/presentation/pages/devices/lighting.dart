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
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/lighting.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/lighting.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices_module.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/value.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class LightingDeviceDetailPage extends StatefulWidget {
  final LightingDeviceDataModel _device;
  final LightingDeviceCapability _capability;
  final bool _supportSwatches = false;

  const LightingDeviceDetailPage({
    super.key,
    required LightingDeviceDataModel device,
    required LightingDeviceCapability capability,
  })  : _device = device,
        _capability = capability;

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

  late List<LightChannelCapability> _channelCapabilities;

  @override
  void initState() {
    super.initState();

    _initializeWidget();

    _selectedChannel = 0;

    _lightModes.add(LightChannelModeType.off);

    if (widget._capability.hasBrightness) {
      _lightModes.add(LightChannelModeType.brightness);
    }
    if (widget._capability.hasColor) {
      _lightModes.add(LightChannelModeType.color);
    }
    if (widget._capability.hasTemperature) {
      _lightModes.add(LightChannelModeType.temperature);
    }
    if (widget._capability.hasWhite) {
      _lightModes.add(LightChannelModeType.white);
    }
    if (widget._supportSwatches) {
      _lightModes.add(LightChannelModeType.swatches);
    }

    if (_lightModes.length >= 2) {
      _colorMode = _lightModes[1];
    }

    if (_channelCapabilities.isNotEmpty) {
      _currentModeIndex = _channelCapabilities[_selectedChannel].on ? 1 : 0;
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
    _channelCapabilities = widget._capability.lightCapabilities;
  }

  @override
  Widget build(BuildContext context) {
    if (!widget._capability.isSimpleLight &&
        !widget._capability.isSingleBrightness &&
        _channelCapabilities.length > 1) {
      return DefaultTabController(
        initialIndex: 0,
        length: _channelCapabilities.length,
        child: Scaffold(
          appBar: ScreenAppBar(
            title: widget._device.name,
            bottom: TabBar(
              tabs: _channelCapabilities
                  .map(
                    (capability) => Tab(
                      text: capability.channel.name ??
                          capability.channel.category.value,
                    ),
                  )
                  .toList(),
            ),
          ),
          body: Builder(
            builder: (BuildContext context) {
              final TabController tabController =
                  DefaultTabController.of(context);

              tabController.addListener(() {
                if (!tabController.indexIsChanging) {
                  setState(() {
                    _selectedChannel = tabController.index;
                  });
                }
              });

              return TabBarView(
                children: _channelCapabilities
                    .map(
                      (capability) => LightSingleChannelDetail(
                        deviceCapability: widget._capability,
                        channelCapability: capability,
                        mode: _colorMode,
                      ),
                    )
                    .toList(),
              );
            },
          ),
          bottomNavigationBar: _renderBottomNavigation(
            context,
            _channelCapabilities,
          ),
        ),
      );
    }

    return Scaffold(
      appBar: ScreenAppBar(
        title: widget._device.name,
      ),
      body: LayoutBuilder(builder: (
        BuildContext context,
        BoxConstraints constraints,
      ) {
        if (widget._capability.isSimpleLight ||
            (widget._capability.isSingleBrightness &&
                _channelCapabilities.length >= 2)) {
          return LightSimpleDetail(
            capability: widget._capability,
            withBrightness: widget._capability.isSingleBrightness &&
                _channelCapabilities.length >= 2,
          );
        }

        final channelCapability = _channelCapabilities.first;

        return LightSingleChannelDetail(
          deviceCapability: widget._capability,
          channelCapability: channelCapability,
          mode: _colorMode,
        );
      }),
      bottomNavigationBar: _renderBottomNavigation(
        context,
        _channelCapabilities,
      ),
    );
  }

  Widget? _renderBottomNavigation(
    BuildContext context,
    List<LightChannelCapability> channelCapabilities,
  ) {
    final localizations = AppLocalizations.of(context)!;

    if (widget._capability.isSimpleLight ||
        (widget._capability.isSingleBrightness &&
            channelCapabilities.length >= 2)) {
      return null;
    }

    if (_lightModes.length <= 1) return null;

    return BottomNavigationBar(
      selectedItemColor: Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.primary
          : AppColorsDark.primary,
      currentIndex: _currentModeIndex,
      onTap: (int index) {
        if (_lightModes[index] == LightChannelModeType.off) {
          if (_channelCapabilities[_selectedChannel].on) {
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
            _channelCapabilities[_selectedChannel].onProp,
            _channelCapabilities[_selectedChannel].on ? false : true,
          );
        } else {
          setState(() {
            _currentModeIndex = index;
            _colorMode = _lightModes[index];
          });

          if (_channelCapabilities[_selectedChannel].on == false) {
            _valueHelper.setPropertyValue(
              context,
              _channelCapabilities[_selectedChannel].onProp,
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
                  icon: Icon(Icons.power_settings_new),
                  label: localizations.light_mode_off,
                );
              case LightChannelModeType.brightness:
                return BottomNavigationBarItem(
                  icon: Icon(Icons.light_mode),
                  label: localizations.light_mode_brightness,
                );
              case LightChannelModeType.color:
                return BottomNavigationBarItem(
                  icon: Icon(Icons.palette),
                  label: localizations.light_mode_color,
                );
              case LightChannelModeType.temperature:
                return BottomNavigationBarItem(
                  icon: Icon(Icons.thermostat),
                  label: localizations.light_mode_temperature,
                );
              case LightChannelModeType.white:
                return BottomNavigationBarItem(
                  icon: Icon(Icons.lightbulb),
                  label: localizations.light_mode_white,
                );
              case LightChannelModeType.swatches:
                return BottomNavigationBarItem(
                  icon: Icon(Icons.widgets),
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

  final LightingDeviceCapability _capability;
  final bool _withBrightness;

  LightSimpleDetail({
    super.key,
    required LightingDeviceCapability capability,
    bool withBrightness = false,
  })  : _capability = capability,
        _withBrightness = withBrightness;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      double elementMaxSize = constraints.maxHeight * 0.8 - 2 * AppSpacings.pLg;

      if (_withBrightness) {
        elementMaxSize =
            elementMaxSize - _screenService.scale(45) - AppSpacings.pSm;
      }

      final List<Widget> controlElements = _capability.lightCapabilities
          .map(
            (lightCapability) => _withBrightness
                ? Column(
                    children: [
                      Column(
                        children: [
                          BrightnessChannel(
                            capability: lightCapability,
                            elementMaxSize: elementMaxSize,
                            vertical: true,
                            showValue: true,
                            onValueChanged: (double value) {
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
                            capability: lightCapability,
                            onStateChanged: (bool state) {
                              _valueHelper.setPropertyValue(
                                context,
                                lightCapability.onProp,
                                state,
                              );
                            },
                          ),
                        ],
                      ),
                      _capability.lightCapabilities.length > 1
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
                        iconOn: Icons.power_settings_new,
                        iconOff: Icons.power_settings_new,
                        trackWidth: elementMaxSize,
                        vertical: true,
                        onChanged: (bool state) {
                          _valueHelper.setPropertyValue(
                            context,
                            lightCapability.onProp,
                            state,
                          );
                        },
                      ),
                      _capability.lightCapabilities.length > 1
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

  final LightingDeviceCapability _deviceCapability;
  final LightChannelCapability _channelCapability;
  final LightChannelModeType _mode;

  LightSingleChannelDetail({
    super.key,
    required LightingDeviceCapability deviceCapability,
    required LightChannelCapability channelCapability,
    required LightChannelModeType mode,
  })  : _deviceCapability = deviceCapability,
        _channelCapability = channelCapability,
        _mode = mode;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final double elementMaxSize = constraints.maxHeight - 2 * AppSpacings.pMd;

      late Widget controlElement;

      final ChannelPropertyDataModel? brightnessProp =
          _channelCapability.brightnessProp;

      if (_mode == LightChannelModeType.brightness && brightnessProp != null) {
        controlElement = BrightnessChannel(
          capability: _channelCapability,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) {
            _valueHelper.setPropertyValue(
              context,
              brightnessProp,
              value,
            );
          },
        );
      }

      if (_mode == LightChannelModeType.color && _channelCapability.hasColor) {
        controlElement = ColorChannel(
          capability: _channelCapability,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (Color value) {
            final rgbValue = ColorUtils.toRGB(value);
            final hsvValue = ColorUtils.toHSV(value);

            if (_channelCapability.colorRedProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _channelCapability.colorRedProp!,
                rgbValue.red,
              );
            }

            if (_channelCapability.colorGreenProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _channelCapability.colorGreenProp!,
                rgbValue.green,
              );
            }

            if (_channelCapability.colorBlueProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _channelCapability.colorBlueProp!,
                rgbValue.blue,
              );
            }

            if (_channelCapability.hueProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _channelCapability.hueProp!,
                hsvValue.hue,
              );
            }

            if (_channelCapability.saturationProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _channelCapability.saturationProp!,
                hsvValue.saturation,
              );
            }
          },
        );
      }

      final ChannelPropertyDataModel? tempProp =
          _channelCapability.temperatureProp;

      if (_mode == LightChannelModeType.temperature && tempProp != null) {
        controlElement = TemperatureChannel(
          capability: _channelCapability,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) {
            _valueHelper.setPropertyValue(
              context,
              tempProp,
              value,
            );
          },
        );
      }

      final ChannelPropertyDataModel? colorWhiteProp =
          _channelCapability.colorWhiteProp;

      if (_mode == LightChannelModeType.white && colorWhiteProp != null) {
        controlElement = WhiteChannel(
          capability: _channelCapability,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) {
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
                          if (_channelCapability.hasBrightness)
                            ChannelActualBrightness(
                              capability: _channelCapability,
                            ),
                          AppSpacings.spacingMdVertical,
                          Wrap(
                            spacing: AppSpacings.pMd,
                            runSpacing: AppSpacings.pMd,
                            children: [
                              if (_channelCapability.hasColor)
                                ChannelActualColor(
                                  capability: _channelCapability,
                                ),
                              if (_channelCapability.hasTemperature)
                                ChannelActualTemperature(
                                  capability: _channelCapability,
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
                          capability: _deviceCapability,
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
  final LightChannelCapability _capability;
  final double? _elementMaxSize;
  final bool _vertical;
  final bool _showValue;

  final ValueChanged<double>? _onValueChanged;

  const BrightnessChannel({
    super.key,
    required LightChannelCapability capability,
    double? elementMaxSize,
    bool vertical = false,
    bool showValue = false,
    ValueChanged<double>? onValueChanged,
  })  : _capability = capability,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _showValue = showValue,
        _onValueChanged = onValueChanged;

  @override
  State<BrightnessChannel> createState() => _BrightnessChannelState();
}

class _BrightnessChannelState extends State<BrightnessChannel> {
  final ScreenService _screenService = locator<ScreenService>();

  late ChannelPropertyDataModel? _property;

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
    _property = widget._capability.brightnessProp;

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
      enabled: widget._capability.on,
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
                  Icons.light_mode,
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
  final LightChannelCapability _capability;
  final double? _elementMaxSize;
  final bool _vertical;

  final ValueChanged<Color>? _onValueChanged;

  const ColorChannel({
    super.key,
    required LightChannelCapability capability,
    double? elementMaxSize,
    bool vertical = false,
    ValueChanged<Color>? onValueChanged,
  })  : _capability = capability,
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
    _color = _getValueFromColor(widget._capability.color);
  }

  @override
  Widget build(BuildContext context) {
    return ColoredSlider(
      value: _color,
      min: 0.0,
      max: 1.0,
      enabled: widget._capability.on,
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
  final LightChannelCapability _capability;
  final double? _elementMaxSize;
  final bool _vertical;

  final ValueChanged<double>? _onValueChanged;

  const TemperatureChannel({
    super.key,
    required LightChannelCapability capability,
    double? elementMaxSize,
    bool vertical = false,
    ValueChanged<double>? onValueChanged,
  })  : _capability = capability,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _onValueChanged = onValueChanged;

  @override
  State<TemperatureChannel> createState() => _TemperatureChannelState();
}

class _TemperatureChannelState extends State<TemperatureChannel> {
  final ScreenService _screenService = locator<ScreenService>();

  late ChannelPropertyDataModel? _property;

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
    _property = widget._capability.temperatureProp;

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
      enabled: widget._capability.on,
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
                  Icons.thermostat,
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
  final LightChannelCapability _capability;
  final double? _elementMaxSize;
  final bool _vertical;

  final ValueChanged<double>? _onValueChanged;

  const WhiteChannel({
    super.key,
    required LightChannelCapability capability,
    double? elementMaxSize,
    bool vertical = false,
    ValueChanged<double>? onValueChanged,
  })  : _capability = capability,
        _elementMaxSize = elementMaxSize,
        _vertical = vertical,
        _onValueChanged = onValueChanged;

  @override
  State<WhiteChannel> createState() => _WhiteChannelState();
}

class _WhiteChannelState extends State<WhiteChannel> {
  final ScreenService _screenService = locator<ScreenService>();

  late ChannelPropertyDataModel? _property;

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
    _property = widget._capability.colorWhiteProp;

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
      enabled: widget._capability.on,
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
                  Icons.lightbulb,
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
  final LightChannelCapability _capability;
  final bool _vertical;

  final ValueChanged<bool>? _onStateChanged;

  const ChannelSwitch({
    super.key,
    required LightChannelCapability capability,
    bool vertical = false,
    ValueChanged<bool>? onStateChanged,
  })  : _capability = capability,
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
    _isOn = widget._capability.on;
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _screenService.scale(widget._vertical ? 45 : 75),
      height: _screenService.scale(widget._vertical ? 75 : 45),
      child: Theme(
        data: ThemeData(
          filledButtonTheme: Theme.of(context).brightness == Brightness.light
              ? (widget._capability.on
                  ? AppFilledButtonsLightThemes.primary
                  : AppFilledButtonsLightThemes.info)
              : (widget._capability.on
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
              Icons.power_settings_new,
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

  final LightChannelCapability _capability;
  final bool _showName;

  ChannelActualBrightness({
    super.key,
    required LightChannelCapability capability,
    showName = false,
  })  : _capability = capability,
        _showName = showName;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final ChannelPropertyDataModel? property = _capability.brightnessProp;

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
                  text: _capability.on
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
              _capability.on
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
                ? _capability.name
                : _capability.on
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

  final LightChannelCapability _capability;

  ChannelActualColor({
    super.key,
    required LightChannelCapability capability,
  }) : _capability = capability;

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
              color: _capability.color,
            ),
          ),
        ),
      ),
    );
  }
}

class ChannelActualTemperature extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final LightChannelCapability _capability;

  ChannelActualTemperature({
    super.key,
    required LightChannelCapability capability,
  }) : _capability = capability;

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
              color: _capability.temperature,
            ),
          ),
        ),
      ),
    );
  }
}

class LightTiles extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final LightingDeviceCapability _capability;

  LightTiles({
    super.key,
    required LightingDeviceCapability capability,
  }) : _capability = capability;

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

    if (!_capability.hasElectricalEnergy) {
      return [];
    }

    final List<LightTileItem> items = [
      LightTileItem(
        icon: Icons.bolt,
        title: localizations.electrical_energy_consumption_title,
        subtitle: localizations.electrical_energy_consumption_description,
        trailingText: NumberUtils.formatNumber(
          _capability.electricalEnergyConsumption,
          2,
        ),
        unit: 'kWh',
      ),
      LightTileItem(
        icon: Icons.speed,
        title: localizations.electrical_energy_rate_title,
        subtitle: localizations.electrical_energy_rate_description,
        trailingText: NumberUtils.formatNumber(
          _capability.electricalEnergyRate,
          2,
        ),
        unit: 'kW',
      ),
    ];

    return _renderTiles(context, items);
  }

  List<Widget> _renderLightingElectricalPower(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (!_capability.hasElectricalPower) {
      return [];
    }

    final List<LightTileItem> items = [
      LightTileItem(
        icon: Icons.electrical_services,
        title: localizations.electrical_power_current_title,
        subtitle: localizations.electrical_power_current_description,
        trailingText: NumberUtils.formatNumber(
          _capability.electricalPowerCurrent,
          2,
        ),
        unit: 'A',
      ),
      LightTileItem(
        icon: Icons.battery_charging_full,
        title: localizations.electrical_power_voltage_title,
        subtitle: localizations.electrical_power_over_voltage_description,
        trailingText: NumberUtils.formatNumber(
          _capability.electricalPowerVoltage,
          2,
        ),
        unit: 'V',
      ),
      LightTileItem(
        icon: Icons.power,
        title: localizations.electrical_power_power_title,
        subtitle: localizations.electrical_power_power_description,
        trailingText: NumberUtils.formatNumber(
          _capability.electricalPowerPower,
          2,
        ),
        unit: 'W',
      ),
      LightTileItem(
        icon: Icons.show_chart,
        title: localizations.electrical_power_frequency_title,
        subtitle: localizations.electrical_power_frequency_description,
        trailingText: NumberUtils.formatNumber(
          _capability.electricalPowerFrequency,
          1,
        ),
        unit: 'Hz',
      ),
      _capability.isElectricalPowerOverCurrent
          ? LightTileItem(
              icon: Icons.electrical_services,
              title: localizations.electrical_power_over_current_title,
              subtitle: localizations.electrical_power_over_current_description,
              trailingIcon: Icons.warning,
            )
          : null,
      _capability.isElectricalPowerOverVoltage
          ? LightTileItem(
              icon: Icons.battery_charging_full,
              title: localizations.electrical_power_over_voltage_title,
              subtitle: localizations.electrical_power_over_voltage_description,
              trailingIcon: Icons.warning,
            )
          : null,
    ].whereType<LightTileItem>().toList();

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
              leading: Icon(
                item.icon,
                size: AppFontSize.large,
              ),
              title: Text(
                item.title,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall * 0.8,
                  fontWeight: FontWeight.w600,
                ),
              ),
              subtitle: item.subtitle != null
                  ? Text(
                      item.subtitle ?? '',
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall * 0.7,
                      ),
                    )
                  : null,
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
  final DevicesModuleRepository _repository =
      locator<DevicesModuleRepository>();

  Future<void> setPropertyValue(
    BuildContext context,
    ChannelPropertyDataModel property,
    dynamic value,
  ) async {
    final localizations = AppLocalizations.of(context)!;

    try {
      bool res = await _repository.setPropertyValue(
        property.id,
        value,
      );

      if (!res && context.mounted) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }
    } catch (e) {
      if (!context.mounted) return;

      AlertBar.showError(
        context,
        message: localizations.action_failed,
      );
    }
  }
}

class LightTileItem {
  final IconData _icon;
  final String _title;
  final String? _subtitle;
  final String? _trailingText;
  final IconData? _trailingIcon;
  final String? _unit;

  LightTileItem({
    required IconData icon,
    required String title,
    String? subtitle,
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

  String? get subtitle => _subtitle;

  String? get trailingText => _trailingText;

  IconData? get trailingIcon => _trailingIcon;

  String? get unit => _unit;
}
