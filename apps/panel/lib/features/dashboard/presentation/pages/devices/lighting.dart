import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/utils/enum.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/light.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/lighting.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices_module.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/value.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class LightingDeviceDetailPage extends StatefulWidget {
  final LightingDeviceDataModel _device;
  final bool _supportSwatches = false;

  const LightingDeviceDetailPage({
    super.key,
    required LightingDeviceDataModel device,
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

  late List<LightChannelDataModel> _channels;

  @override
  void initState() {
    super.initState();

    _selectedChannel = 0;

    _channels = widget._device.lightChannels;

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
  Widget build(BuildContext context) {
    if (!widget._device.isSimpleLight &&
        !widget._device.isSingleBrightness &&
        _channels.length > 1) {
      return DefaultTabController(
        initialIndex: 0,
        length: _channels.length,
        child: Scaffold(
          appBar: ScreenAppBar(
            title: widget._device.name,
            bottom: TabBar(
              tabs: _channels
                  .map(
                    (channel) => Tab(
                      text: channel.name ?? channel.category.value,
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
      ),
      body: LayoutBuilder(builder: (
        BuildContext context,
        BoxConstraints constraints,
      ) {
        if (widget._device.isSimpleLight ||
            (widget._device.isSingleBrightness && _channels.length >= 2)) {
          return LightSimpleDetail(
            device: widget._device,
            channels: _channels,
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
    List<LightChannelDataModel> channels,
  ) {
    final localizations = AppLocalizations.of(context)!;

    if (widget._device.isSimpleLight ||
        (widget._device.isSingleBrightness && channels.length >= 2)) {
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
            widget._device,
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
              widget._device,
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

  final LightingDeviceDataModel _device;
  final List<LightChannelDataModel> _channels;
  final bool _withBrightness;

  LightSimpleDetail({
    super.key,
    required LightingDeviceDataModel device,
    required List<LightChannelDataModel> channels,
    bool withBrightness = false,
  })  : _device = device,
        _channels = channels,
        _withBrightness = withBrightness;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      double elementMaxSize = constraints.maxHeight * 0.8 - 2 * AppSpacings.pLg;

      if (_withBrightness) {
        elementMaxSize =
            elementMaxSize - _screenService.scale(45) - AppSpacings.pSm;
      }

      final List<Widget> controlElements = _channels
          .map(
            (channel) => _withBrightness
                ? Column(
                    children: [
                      Column(
                        children: [
                          BrightnessChannel(
                            device: _device,
                            channel: channel,
                            elementMaxSize: elementMaxSize,
                            vertical: true,
                            showValue: true,
                            onValueChanged: (double value) {
                              final brightnessProp = channel.brightnessProp;

                              if (brightnessProp == null) {
                                return;
                              }

                              _valueHelper.setPropertyValue(
                                context,
                                _device,
                                brightnessProp,
                                value,
                              );
                            },
                          ),
                          AppSpacings.spacingSmVertical,
                          ChannelSwitch(
                            device: _device,
                            channel: channel,
                            onStateChanged: (bool state) {
                              _valueHelper.setPropertyValue(
                                context,
                                _device,
                                channel.onProp,
                                state,
                              );
                            },
                          ),
                        ],
                      ),
                      _channels.length > 1
                          ? Text(
                              channel.name ?? channel.category.value,
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
                        switchState: channel.on,
                        iconOn: Icons.power_settings_new,
                        iconOff: Icons.power_settings_new,
                        trackWidth: elementMaxSize,
                        vertical: true,
                        onChanged: (bool state) {
                          _valueHelper.setPropertyValue(
                            context,
                            _device,
                            channel.onProp,
                            state,
                          );
                        },
                      ),
                      _channels.length > 1
                          ? Text(
                              channel.name ?? channel.category.value,
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

  final LightingDeviceDataModel _device;
  final LightChannelDataModel _channel;
  final LightChannelModeType _mode;

  LightSingleChannelDetail({
    super.key,
    required LightingDeviceDataModel device,
    required LightChannelDataModel channel,
    required LightChannelModeType mode,
  })  : _device = device,
        _channel = channel,
        _mode = mode;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final double elementMaxSize = constraints.maxHeight - 2 * AppSpacings.pMd;

      late Widget controlElement;

      final ChannelPropertyDataModel? brightnessProp = _channel.brightnessProp;

      if (_mode == LightChannelModeType.brightness && brightnessProp != null) {
        controlElement = BrightnessChannel(
          device: _device,
          channel: _channel,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) {
            _valueHelper.setPropertyValue(
              context,
              _device,
              brightnessProp,
              value,
            );
          },
        );
      }

      if (_mode == LightChannelModeType.color && _channel.hasColor) {
        controlElement = ColorChannel(
          device: _device,
          channel: _channel,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (Color value) {
            final rgbValue = ColorUtils.toRGB(value);
            final hsvValue = ColorUtils.toHSV(value);

            if (_channel.colorRedProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _device,
                _channel.colorRedProp!,
                rgbValue.red,
              );
            }

            if (_channel.colorGreenProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _device,
                _channel.colorGreenProp!,
                rgbValue.green,
              );
            }

            if (_channel.colorBlueProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _device,
                _channel.colorBlueProp!,
                rgbValue.blue,
              );
            }

            if (_channel.hueProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _device,
                _channel.hueProp!,
                hsvValue.hue,
              );
            }

            if (_channel.saturationProp != null) {
              _valueHelper.setPropertyValue(
                context,
                _device,
                _channel.saturationProp!,
                hsvValue.saturation,
              );
            }
          },
        );
      }

      final ChannelPropertyDataModel? tempProp = _channel.temperatureProp;

      if (_mode == LightChannelModeType.temperature && tempProp != null) {
        controlElement = TemperatureChannel(
          device: _device,
          channel: _channel,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) {
            _valueHelper.setPropertyValue(
              context,
              _device,
              tempProp,
              value,
            );
          },
        );
      }

      final ChannelPropertyDataModel? colorWhiteProp = _channel.colorWhiteProp;

      if (_mode == LightChannelModeType.white && colorWhiteProp != null) {
        controlElement = WhiteChannel(
          device: _device,
          channel: _channel,
          vertical: true,
          elementMaxSize: elementMaxSize,
          onValueChanged: (double value) {
            _valueHelper.setPropertyValue(
              context,
              _device,
              colorWhiteProp,
              value,
            );
          },
        );
      }

      return Padding(
        padding: EdgeInsets.symmetric(
          vertical: AppSpacings.pMd,
          horizontal: AppSpacings.pLg,
        ),
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
                              device: _device,
                              channel: _channel,
                            ),
                          AppSpacings.spacingMdVertical,
                          Wrap(
                            spacing: AppSpacings.pMd,
                            runSpacing: AppSpacings.pMd,
                            children: [
                              if (_channel.hasColor)
                                ChannelActualColor(
                                  device: _device,
                                  channel: _channel,
                                ),
                              if (_channel.hasTemperature)
                                ChannelActualTemperature(
                                  device: _device,
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
  final LightingDeviceDataModel device;
  final LightChannelDataModel channel;
  final double? elementMaxSize;
  final bool vertical;
  final bool showValue;

  final ValueChanged<double>? onValueChanged;

  const BrightnessChannel({
    super.key,
    required this.device,
    required this.channel,
    this.elementMaxSize,
    this.vertical = false,
    this.showValue = false,
    this.onValueChanged,
  });

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

    _property = widget.channel.brightnessProp;

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
      enabled: widget.channel.on,
      vertical: widget.vertical,
      trackWidth: widget.elementMaxSize,
      showThumb: false,
      onValueChanged: (double value) {
        setState(() {
          _brightness = value;
        });

        widget.onValueChanged?.call(value);
      },
      inner: [
        widget.showValue
            ? Positioned(
                right: _screenService.scale(5),
                child: RotatedBox(
                  quarterTurns: widget.vertical ? 1 : 0,
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
                quarterTurns: widget.vertical ? 1 : 0,
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
  final LightingDeviceDataModel device;
  final LightChannelDataModel channel;
  final double? elementMaxSize;
  final bool vertical;

  final ValueChanged<Color>? onValueChanged;

  const ColorChannel({
    super.key,
    required this.device,
    required this.channel,
    this.elementMaxSize,
    this.vertical = false,
    this.onValueChanged,
  });

  @override
  State<ColorChannel> createState() => _ColorChannelState();
}

class _ColorChannelState extends State<ColorChannel> {
  late double _color;

  @override
  void initState() {
    super.initState();

    _color = _getValueFromColor(widget.channel.color);
  }

  @override
  Widget build(BuildContext context) {
    return ColoredSlider(
      value: _color,
      min: 0.0,
      max: 1.0,
      enabled: widget.channel.on,
      vertical: widget.vertical,
      trackWidth: widget.elementMaxSize,
      onValueChanged: (double value) {
        setState(() {
          _color = value;
        });

        widget.onValueChanged?.call(_getColorFromValue(value));
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
  final LightingDeviceDataModel device;
  final LightChannelDataModel channel;
  final double? elementMaxSize;
  final bool vertical;

  final ValueChanged<double>? onValueChanged;

  const TemperatureChannel({
    super.key,
    required this.device,
    required this.channel,
    this.elementMaxSize,
    this.vertical = false,
    this.onValueChanged,
  });

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

    _property = widget.channel.temperatureProp;

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
      enabled: widget.channel.on,
      vertical: widget.vertical,
      trackWidth: widget.elementMaxSize,
      onValueChanged: (double value) {
        setState(() {
          _temperature = value;
        });

        widget.onValueChanged?.call(value);
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
                quarterTurns: widget.vertical ? 1 : 0,
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
  final LightingDeviceDataModel device;
  final LightChannelDataModel channel;
  final double? elementMaxSize;
  final bool vertical;

  final ValueChanged<double>? onValueChanged;

  const WhiteChannel({
    super.key,
    required this.device,
    required this.channel,
    this.elementMaxSize,
    this.vertical = false,
    this.onValueChanged,
  });

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

    _property = widget.channel.colorWhiteProp;

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
      enabled: widget.channel.on,
      vertical: widget.vertical,
      trackWidth: widget.elementMaxSize,
      showThumb: false,
      onValueChanged: (double value) {
        setState(() {
          _white = value;
        });

        widget.onValueChanged?.call(value);
      },
      activeTrackColor: AppColors.white,
      inner: [
        Positioned(
          left: _screenService.scale(20),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: widget.vertical ? 1 : 0,
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
  final LightingDeviceDataModel device;
  final LightChannelDataModel channel;
  final bool vertical;

  final ValueChanged<bool>? onStateChanged;

  const ChannelSwitch({
    super.key,
    required this.device,
    required this.channel,
    this.vertical = false,
    this.onStateChanged,
  });

  @override
  State<ChannelSwitch> createState() => _ChannelSwitchState();
}

class _ChannelSwitchState extends State<ChannelSwitch> {
  final ScreenService _screenService = locator<ScreenService>();

  late bool _isOn;

  @override
  void initState() {
    super.initState();

    _isOn = widget.channel.on;
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _screenService.scale(widget.vertical ? 45 : 75),
      height: _screenService.scale(widget.vertical ? 75 : 45),
      child: Theme(
        data: ThemeData(
          filledButtonTheme: Theme.of(context).brightness == Brightness.light
              ? (widget.channel.on
                  ? AppFilledButtonsLightThemes.primary
                  : AppFilledButtonsLightThemes.info)
              : (widget.channel.on
                  ? AppFilledButtonsDarkThemes.primary
                  : AppFilledButtonsDarkThemes.info),
        ),
        child: FilledButton(
          onPressed: () {
            setState(() {
              _isOn = !_isOn;
            });

            widget.onStateChanged?.call(_isOn);
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

  final LightingDeviceDataModel device;
  final LightChannelDataModel channel;
  final bool showName;

  ChannelActualBrightness({
    super.key,
    required this.device,
    required this.channel,
    this.showName = false,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final ChannelPropertyDataModel? property = channel.brightnessProp;

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
                  text: channel.on
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
              channel.on
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
            showName
                ? (channel.name ?? channel.category.value)
                : channel.on
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

  final LightingDeviceDataModel device;
  final LightChannelDataModel channel;

  ChannelActualColor({
    super.key,
    required this.device,
    required this.channel,
  });

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
              color: channel.color,
            ),
          ),
        ),
      ),
    );
  }
}

class ChannelActualTemperature extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final LightingDeviceDataModel device;
  final LightChannelDataModel channel;

  ChannelActualTemperature({
    super.key,
    required this.device,
    required this.channel,
  });

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
              color: channel.temperature,
            ),
          ),
        ),
      ),
    );
  }
}

class LightTiles extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final LightingDeviceDataModel _device;

  LightTiles({
    super.key,
    required LightingDeviceDataModel device,
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
        icon: Icons.bolt,
        title: localizations.electrical_energy_consumption_title,
        subtitle: localizations.electrical_energy_consumption_description,
        trailingText: NumberUtils.formatNumber(
          _device.electricalEnergyConsumption,
          2,
        ),
        unit: 'kWh',
      ),
      LightTileItem(
        icon: Icons.speed,
        title: localizations.electrical_energy_rate_title,
        subtitle: localizations.electrical_energy_rate_description,
        trailingText: NumberUtils.formatNumber(
          _device.electricalEnergyRate,
          2,
        ),
        unit: 'kW',
      ),
    ];

    return _renderTiles(context, items);
  }

  List<Widget> _renderLightingElectricalPower(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (!_device.hasElectricalPower) {
      return [];
    }

    final List<LightTileItem> items = [
      LightTileItem(
        icon: Icons.electrical_services,
        title: localizations.electrical_power_current_title,
        subtitle: localizations.electrical_power_current_description,
        trailingText: NumberUtils.formatNumber(
          _device.electricalPowerCurrent,
          2,
        ),
        unit: 'A',
      ),
      LightTileItem(
        icon: Icons.battery_charging_full,
        title: localizations.electrical_power_voltage_title,
        subtitle: localizations.electrical_power_over_voltage_description,
        trailingText: NumberUtils.formatNumber(
          _device.electricalPowerVoltage,
          2,
        ),
        unit: 'V',
      ),
      LightTileItem(
        icon: Icons.power,
        title: localizations.electrical_power_power_title,
        subtitle: localizations.electrical_power_power_description,
        trailingText: NumberUtils.formatNumber(
          _device.electricalPowerPower,
          2,
        ),
        unit: 'W',
      ),
      LightTileItem(
        icon: Icons.show_chart,
        title: localizations.electrical_power_frequency_title,
        subtitle: localizations.electrical_power_frequency_description,
        trailingText: NumberUtils.formatNumber(
          _device.electricalPowerFrequency,
          1,
        ),
        unit: 'Hz',
      ),
      _device.isElectricalPowerOverCurrent
          ? LightTileItem(
              icon: Icons.electrical_services,
              title: localizations.electrical_power_over_current_title,
              subtitle: localizations.electrical_power_over_current_description,
              trailingIcon: Icons.warning,
            )
          : null,
      _device.isElectricalPowerOverVoltage
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

  void setPropertyValue(
    BuildContext context,
    LightingDeviceDataModel device,
    ChannelPropertyDataModel property,
    dynamic value,
  ) {
    if (kDebugMode) {
      print(
        'Set Lighting: ${device.name} ${property.category} property to: $value',
      );
    }

    bool res = _repository.setPropertyValue(
      property.id,
      value,
    );

    if (!res) {
      _showProcessError(context);

      return;
    }
  }

  void _showProcessError(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    showDialog(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Row(
          children: [
            Icon(
              Icons.error,
              size: AppFontSize.large,
            ),
            AppSpacings.spacingSmHorizontal,
            Text(
              localizations.error,
              style: TextStyle(
                fontSize: AppFontSize.base,
              ),
            ),
          ],
        ),
        content: Text(
          localizations.action_failed,
        ),
        actions: [
          Theme(
            data: ThemeData(
              filledButtonTheme:
                  Theme.of(context).brightness == Brightness.light
                      ? AppFilledButtonsLightThemes.primary
                      : AppFilledButtonsDarkThemes.primary,
            ),
            child: FilledButton(
              onPressed: () {
                Navigator.pop(context, 'OK');
              },
              child: Text(localizations.button_ok),
            ),
          ),
        ],
      ),
    );
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
