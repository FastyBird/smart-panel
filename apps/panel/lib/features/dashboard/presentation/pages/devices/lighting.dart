import 'dart:math';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/utils/enum.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/data_loading_loader.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/channels.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class LightingDeviceDetailPage extends StatefulWidget {
  final DeviceDataModel _device;
  final bool _supportSwatches = false;

  const LightingDeviceDetailPage({
    super.key,
    required DeviceDataModel device,
  }) : _device = device;

  DeviceDataModel get device => _device;

  bool get supportSwatches => _supportSwatches;

  @override
  State<LightingDeviceDetailPage> createState() =>
      _LightingDeviceDetailPageState();
}

class _LightingDeviceDetailPageState extends State<LightingDeviceDetailPage> {
  LightChannelModeType _colorMode = LightChannelModeType.color;

  int _currentModeIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Consumer<ChannelsDataRepository>(
      builder: (
        context,
        channelsRepository,
        _,
      ) {
        List<ChannelDataModel> channels = channelsRepository.getForDevice(
          widget.device.id,
        );

        return Scaffold(
          appBar: ScreenAppBar(
            title: widget.device.name,
            actions: _renderAppBarActions(
              context,
              channels,
            ),
          ),
          body: channelsRepository.isLoading
              ? DataLoadingLoader(
                  heading: 'Preparing device',
                  subHeading: 'Loading device data to display control actions',
                )
              : PageView.builder(
                  itemCount: channels.length,
                  itemBuilder: (context, index) {
                    return LightSingleChannelDetail(
                      device: widget.device,
                      channel: channels[index],
                      mode: _colorMode,
                      isMultichannel: channels.length > 1,
                    );
                  },
                ),
          bottomNavigationBar: _renderBottomNavigation(
            context,
            channels,
          ),
        );
      },
    );
  }

  List<Widget> _renderAppBarActions(
    BuildContext context,
    List<ChannelDataModel> channels,
  ) {
    ChannelsPropertiesDataRepository propertiesRepository =
        Provider.of<ChannelsPropertiesDataRepository>(context);

    List<String> ids = [
      ...channels.expand((channel) => channel.properties),
    ];

    List<ChannelPropertyDataModel> anyLightProperties = propertiesRepository
        .getByIds(ids)
        .where((property) => [
              PropertyCategoryType.colorRed,
              PropertyCategoryType.colorGreen,
              PropertyCategoryType.colorBlue,
              PropertyCategoryType.colorWhite,
              PropertyCategoryType.hue,
              PropertyCategoryType.saturation,
              PropertyCategoryType.brightness,
              PropertyCategoryType.colorTemperature,
            ].contains(property.category))
        .toList();

    if (anyLightProperties.isEmpty) {
      return [];
    }

    return [
      Padding(
        padding: EdgeInsets.only(
          left: AppSpacings.pSm,
          right: AppSpacings.pLg,
        ),
        child: Consumer<ChannelsPropertiesDataRepository>(
          builder: (
            context,
            propertiesRepository,
            _,
          ) {
            List<String> ids = [
              ...channels.expand((channel) => channel.properties),
            ];

            List<ChannelPropertyDataModel> stateProperties =
                propertiesRepository
                    .getByIds(ids)
                    .where((property) =>
                        property.category == PropertyCategoryType.on)
                    .toList();

            bool isOn = stateProperties.isEmpty
                ? false
                : stateProperties.every((property) => property.isActive);

            return IconSwitch(
              switchState: isOn,
              iconOn: Icons.power_settings_new,
              iconOff: Icons.power_settings_new,
              onChanged: (bool value) {
                if (kDebugMode) {
                  print('Set light: ${widget.device.name} state to: ${!isOn}');
                }

                for (var property in stateProperties) {
                  propertiesRepository.toggleValue(property.id);
                }
              },
            );
          },
        ),
      ),
    ];
  }

  Widget? _renderBottomNavigation(
    BuildContext context,
    List<ChannelDataModel> channels,
  ) {
    ChannelsPropertiesDataRepository propertiesRepository =
        Provider.of<ChannelsPropertiesDataRepository>(context);

    List<String> ids = [
      ...channels.expand((channel) => channel.properties),
    ];

    List<ChannelPropertyDataModel> colorProperties = propertiesRepository
        .getByIds(ids)
        .where((property) => [
              PropertyCategoryType.colorRed,
              PropertyCategoryType.colorGreen,
              PropertyCategoryType.colorBlue,
              PropertyCategoryType.hue,
              PropertyCategoryType.saturation,
            ].contains(property.category))
        .toList();

    List<ChannelPropertyDataModel> temperatureProperties = propertiesRepository
        .getByIds(ids)
        .where((property) =>
            property.category == PropertyCategoryType.colorTemperature)
        .toList();

    List<ChannelPropertyDataModel> colorWhiteProperties = propertiesRepository
        .getByIds(ids)
        .where(
            (property) => property.category == PropertyCategoryType.colorWhite)
        .toList();

    if (colorProperties.isEmpty &&
        temperatureProperties.isEmpty &&
        colorWhiteProperties.isEmpty) {
      return null;
    }

    List<BottomNavigationBarItem> items = [];

    List<LightChannelModeType> indexedModes = [];

    if (colorProperties.isNotEmpty) {
      items.add(BottomNavigationBarItem(
        icon: Icon(Icons.palette),
        label: 'Color',
      ));

      indexedModes.add(LightChannelModeType.color);
    }

    if (temperatureProperties.isNotEmpty) {
      items.add(BottomNavigationBarItem(
        icon: Icon(Icons.thermostat),
        label: 'Temperature',
      ));

      indexedModes.add(LightChannelModeType.temperature);
    }

    if (colorWhiteProperties.isNotEmpty) {
      items.add(BottomNavigationBarItem(
        icon: Icon(Icons.lightbulb),
        label: 'White',
      ));

      indexedModes.add(LightChannelModeType.white);
    }

    if (widget.supportSwatches) {
      items.add(BottomNavigationBarItem(
        icon: Icon(Icons.widgets),
        label: 'Swatches',
      ));

      indexedModes.add(LightChannelModeType.swatches);
    }

    if (items.length <= 1) {
      return null;
    }

    return BottomNavigationBar(
      selectedItemColor: Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.primary
          : AppColorsDark.primary,
      currentIndex: _currentModeIndex,
      onTap: (int index) {
        setState(() {
          _currentModeIndex = index;
          _colorMode = indexedModes[index];
        });
      },
      type: BottomNavigationBarType.fixed,
      items: items,
    );
  }
}

class LightSingleChannelDetail extends StatefulWidget {
  final DeviceDataModel _device;
  final ChannelDataModel _channel;
  final LightChannelModeType _mode;
  final bool _isMultichannel;

  const LightSingleChannelDetail({
    super.key,
    required DeviceDataModel device,
    required ChannelDataModel channel,
    required LightChannelModeType mode,
    bool isMultichannel = false,
  })  : _device = device,
        _channel = channel,
        _mode = mode,
        _isMultichannel = isMultichannel;

  DeviceDataModel get device => _device;

  ChannelDataModel get channel => _channel;

  LightChannelModeType get mode => _mode;

  bool get isMultichannel => _isMultichannel;

  @override
  State<LightSingleChannelDetail> createState() =>
      _LightSingleChannelDetailState();
}

class _LightSingleChannelDetailState extends State<LightSingleChannelDetail> {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  final ChannelsPropertiesDataRepository _propertiesRepository =
      locator<ChannelsPropertiesDataRepository>();

  num? _brightness;
  num? _whiteColor;
  num? _colorTemperature;
  Color? _color;

  bool _isOn = true;

  @override
  void initState() {
    super.initState();

    ChannelsPropertiesDataRepository propertiesRepository =
        locator<ChannelsPropertiesDataRepository>();

    ChannelPropertyDataModel? brightnessProperty =
        _getProperty(PropertyCategoryType.brightness);
    ChannelPropertyDataModel? redColorProperty =
        _getProperty(PropertyCategoryType.colorRed);
    ChannelPropertyDataModel? greenColorProperty =
        _getProperty(PropertyCategoryType.colorGreen);
    ChannelPropertyDataModel? blueColorProperty =
        _getProperty(PropertyCategoryType.colorBlue);
    ChannelPropertyDataModel? whiteColorProperty =
        _getProperty(PropertyCategoryType.colorWhite);
    ChannelPropertyDataModel? temperatureProperty =
        _getProperty(PropertyCategoryType.colorTemperature);
    ChannelPropertyDataModel? hueProperty =
        _getProperty(PropertyCategoryType.hue);
    ChannelPropertyDataModel? saturationProperty =
        _getProperty(PropertyCategoryType.saturation);

    List<ChannelPropertyDataModel> stateProperties = propertiesRepository
        .getByIds(widget.channel.properties)
        .where((property) => property.category == PropertyCategoryType.on)
        .toList();

    _brightness = brightnessProperty != null &&
            brightnessProperty.value is NumberValueType
        ? (brightnessProperty.value as NumberValueType).value
        : null;

    _whiteColor = whiteColorProperty != null &&
            whiteColorProperty.value is NumberValueType
        ? (whiteColorProperty.value as NumberValueType).value
        : null;

    if (redColorProperty != null &&
        greenColorProperty != null &&
        blueColorProperty != null) {
      int redColor = redColorProperty.value is NumberValueType
          ? (redColorProperty.value as NumberValueType).value.toInt()
          : 0;

      int greenColor = greenColorProperty.value is NumberValueType
          ? (greenColorProperty.value as NumberValueType).value.toInt()
          : 0;

      int blueColor = blueColorProperty.value is NumberValueType
          ? (blueColorProperty.value as NumberValueType).value.toInt()
          : 0;

      _color = ColorUtils.fromRGB(
        redColor,
        greenColor,
        blueColor,
      );
    } else if (hueProperty != null && saturationProperty != null) {
      double hue = hueProperty.value is NumberValueType
          ? (hueProperty.value as NumberValueType).value.toDouble()
          : 0;

      double saturation = saturationProperty.value is NumberValueType
          ? (saturationProperty.value as NumberValueType).value.toDouble()
          : 0;

      _color = ColorUtils.fromHSV(
        hue,
        saturation,
        _brightness?.toDouble() ?? 0,
      );
    }

    _colorTemperature = temperatureProperty != null &&
            temperatureProperty.value is NumberValueType
        ? (temperatureProperty.value as NumberValueType).value
        : null;

    _isOn = stateProperties.isEmpty
        ? false
        : stateProperties.every((property) => property.isActive);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ChannelsPropertiesDataRepository>(builder: (
      context,
      propertiesRepository,
      _,
    ) {
      if (propertiesRepository.isLoading) {
        return DataLoadingLoader(
          heading: 'Preparing device',
          subHeading: 'Loading device data to display control actions',
        );
      }

      ChannelPropertyDataModel? stateProperty =
          _getProperty(PropertyCategoryType.on);

      ChannelPropertyDataModel? brightnessProperty =
          _getProperty(PropertyCategoryType.brightness);
      ChannelPropertyDataModel? redColorProperty =
          _getProperty(PropertyCategoryType.colorRed);
      ChannelPropertyDataModel? greenColorProperty =
          _getProperty(PropertyCategoryType.colorGreen);
      ChannelPropertyDataModel? blueColorProperty =
          _getProperty(PropertyCategoryType.colorBlue);
      ChannelPropertyDataModel? whiteColorProperty =
          _getProperty(PropertyCategoryType.colorWhite);
      ChannelPropertyDataModel? temperatureProperty =
          _getProperty(PropertyCategoryType.colorTemperature);
      ChannelPropertyDataModel? hueProperty =
          _getProperty(PropertyCategoryType.hue);
      ChannelPropertyDataModel? saturationProperty =
          _getProperty(PropertyCategoryType.saturation);

      List<ChannelPropertyDataModel> stateProperties = propertiesRepository
          .getByIds(widget.channel.properties)
          .where((property) => property.category == PropertyCategoryType.on)
          .toList();

      bool isRepositoryOn = stateProperties.isEmpty
          ? false
          : stateProperties.every((property) => property.isActive);

      return LayoutBuilder(builder: (context, constraints) {
        double elementMaxSize = min(
          constraints.maxHeight * 0.9,
          constraints.maxWidth,
        );
        elementMaxSize = elementMaxSize - 2 * AppSpacings.pMd;

        // Synchronize the local state with the repository state
        if (_isOn != isRepositoryOn) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            setState(() {
              _isOn = isRepositoryOn;
            });
          });
        }

        num brightnessMin = 0;
        num brightnessMax = 100;

        if (brightnessProperty != null) {
          FormatType? format = brightnessProperty.format;

          if (format is NumberListFormatType && format.value.length == 2) {
            brightnessMin = format.value[0];
            brightnessMax = format.value[1];
          }
        }

        num whiteColorMin = 0;
        num whiteColorMax = 255;

        if (whiteColorProperty != null) {
          FormatType? format = whiteColorProperty.format;

          if (format is NumberListFormatType && format.value.length == 2) {
            whiteColorMin = format.value[0];
            whiteColorMax = format.value[1];
          }
        }

        num temperatureMin = 2700;
        num temperatureMax = 6500;

        if (temperatureProperty != null) {
          FormatType? format = temperatureProperty.format;

          if (format is NumberListFormatType && format.value.length == 2) {
            temperatureMin = format.value[0];
            temperatureMax = format.value[1];
          }
        }

        bool forceCenter = false;
        bool singleBrightness = true;

        List<Widget> channelParts = [];

        if (widget.mode == LightChannelModeType.color && _color != null) {
          channelParts.add(
            Padding(
              padding: EdgeInsets.symmetric(
                vertical: AppSpacings.pSm,
                horizontal: AppSpacings.pLg,
              ),
              child: ColorChannel(
                device: widget.device,
                channel: widget.channel,
                color: _color ?? Colors.white,
                isOn: _isOn,
                onValueChanged: (Color value) {
                  if (redColorProperty != null &&
                      greenColorProperty != null &&
                      blueColorProperty != null) {
                    var rgbValue = ColorUtils.toRGB(value);

                    bool res = true;

                    if (kDebugMode) {
                      print(
                        'Set light: ${widget.device.name} red property to: $_isOn',
                      );
                    }

                    res = propertiesRepository.setValue(
                      redColorProperty.id,
                      rgbValue.red,
                    );

                    if (!res) {
                      _showProcessError(context);

                      return;
                    }

                    if (kDebugMode) {
                      print(
                        'Set light: ${widget.device.name} green property to: $_isOn',
                      );
                    }

                    res = propertiesRepository.setValue(
                      greenColorProperty.id,
                      rgbValue.green,
                    );

                    if (!res) {
                      _showProcessError(context);

                      return;
                    }

                    if (kDebugMode) {
                      print(
                        'Set light: ${widget.device.name} blue property to: $_isOn',
                      );
                    }

                    res = propertiesRepository.setValue(
                      blueColorProperty.id,
                      rgbValue.blue,
                    );

                    if (!res) {
                      _showProcessError(context);

                      return;
                    }
                  } else if (hueProperty != null &&
                      saturationProperty != null) {
                    var hsvValue = ColorUtils.toHSV(value);

                    bool res = true;

                    if (kDebugMode) {
                      print(
                        'Set light: ${widget.device.name} hue property to: $_isOn',
                      );
                    }

                    res = propertiesRepository.setValue(
                      hueProperty.id,
                      hsvValue.hue,
                    );

                    if (!res) {
                      _showProcessError(context);

                      return;
                    }

                    if (kDebugMode) {
                      print(
                        'Set light: ${widget.device.name} saturation property to: $_isOn',
                      );
                    }

                    res = propertiesRepository.setValue(
                      saturationProperty.id,
                      hsvValue.saturation,
                    );

                    if (!res) {
                      _showProcessError(context);

                      return;
                    }
                  }
                },
              ),
            ),
          );

          singleBrightness = false;
        }

        if (widget.mode == LightChannelModeType.temperature &&
            _colorTemperature != null) {
          channelParts.add(
            Padding(
              padding: EdgeInsets.symmetric(
                vertical: AppSpacings.pSm,
                horizontal: AppSpacings.pLg,
              ),
              child: TemperatureChannel(
                device: widget.device,
                channel: widget.channel,
                temperature: _colorTemperature ?? 0,
                min: temperatureMin.toDouble(),
                max: temperatureMax.toDouble(),
                isOn: _isOn,
                onValueChanged: (double value) {
                  if (temperatureProperty != null) {
                    if (kDebugMode) {
                      print(
                        'Set light: ${widget.device.name} color temperature property to: $_isOn',
                      );
                    }

                    bool res = propertiesRepository.setValue(
                      temperatureProperty.id,
                      value,
                    );

                    if (!res) {
                      _showProcessError(context);

                      return;
                    }
                  }
                },
              ),
            ),
          );

          singleBrightness = false;
        }

        if (widget.mode == LightChannelModeType.white && _whiteColor != null) {
          channelParts.add(
            Padding(
              padding: EdgeInsets.symmetric(
                vertical: AppSpacings.pSm,
                horizontal: AppSpacings.pLg,
              ),
              child: WhiteChannel(
                device: widget.device,
                channel: widget.channel,
                white: _whiteColor ?? 0,
                min: whiteColorMin.toDouble(),
                max: whiteColorMax.toDouble(),
                isOn: _isOn,
                onValueChanged: (double value) {
                  if (whiteColorProperty != null) {
                    if (kDebugMode) {
                      print(
                        'Set light: ${widget.device.name} white property to: $_isOn',
                      );
                    }

                    bool res = propertiesRepository.setValue(
                      whiteColorProperty.id,
                      value,
                    );

                    if (!res) {
                      _showProcessError(context);

                      return;
                    }
                  }
                },
              ),
            ),
          );

          singleBrightness = false;
        }

        if (widget.mode != LightChannelModeType.swatches &&
            _brightness != null) {
          channelParts.add(Padding(
            padding: EdgeInsets.symmetric(
              vertical: AppSpacings.pSm,
              horizontal: AppSpacings.pLg,
            ),
            child: BrightnessChannel(
              device: widget.device,
              channel: widget.channel,
              brightness: _brightness ?? 0,
              min: brightnessMin.toDouble(),
              max: brightnessMax.toDouble(),
              isOn: _isOn,
              vertical: singleBrightness,
              elementMaxSize: elementMaxSize,
              showButton: widget.isMultichannel,
              onValueChanged: (double value) {
                if (brightnessProperty != null) {
                  if (kDebugMode) {
                    print(
                      'Set light: ${widget.device.name} brightness property to: $_isOn',
                    );
                  }

                  bool res = propertiesRepository.setValue(
                    brightnessProperty.id,
                    value,
                  );

                  if (!res) {
                    _showProcessError(context);

                    return;
                  }
                }
              },
              onStateChanged: (bool state) {
                if (stateProperty != null) {
                  if (kDebugMode) {
                    print('Set light: ${widget.device.name} state to: $_isOn');
                  }

                  bool res = propertiesRepository.toggleValue(
                    stateProperty.id,
                  );

                  if (!res) {
                    _showProcessError(context);

                    return;
                  }
                }
              },
            ),
          ));
        }

        if (channelParts.isEmpty &&
            widget.mode != LightChannelModeType.swatches) {
          channelParts.add(
            Padding(
              padding: EdgeInsets.symmetric(
                vertical: AppSpacings.pSm,
                horizontal: AppSpacings.pLg,
              ),
              child: ColoredSwitch(
                switchState: _isOn,
                iconOn: Icons.power_settings_new,
                iconOff: Icons.power_settings_new,
                trackWidth: elementMaxSize,
                vertical: true,
                onChanged: (bool state) {
                  if (stateProperty != null) {
                    if (kDebugMode) {
                      print(
                        'Set light: ${widget.device.name} state to: $_isOn',
                      );
                    }

                    bool res = propertiesRepository.toggleValue(
                      stateProperty.id,
                    );

                    if (!res) {
                      _showProcessError(context);

                      return;
                    }
                  }
                },
              ),
            ),
          );

          forceCenter = true;
        }

        return Padding(
          padding: EdgeInsets.symmetric(
            vertical: AppSpacings.pMd,
          ),
          child: Column(
            mainAxisAlignment: forceCenter || singleBrightness
                ? MainAxisAlignment.center
                : MainAxisAlignment.start,
            children: channelParts,
          ),
        );
      });
    });
  }

  ChannelPropertyDataModel? _getProperty(PropertyCategoryType category) {
    return _propertiesRepository
        .getByIds(widget.channel.properties)
        .where((property) => property.category == category)
        .cast<ChannelPropertyDataModel?>()
        .firstWhere(
          (property) => true,
          orElse: () => null,
        );
  }

  _showProcessError(BuildContext context) {
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
              'Error',
              style: TextStyle(
                fontSize: AppFontSize.base,
              ),
            ),
          ],
        ),
        content: const Text(
          'Action could not be processed',
        ),
        actions: [
          Theme(
            data: ThemeData(
              filledButtonTheme: AppFilledButtonsDarkThemes.primary,
            ),
            child: FilledButton(
              onPressed: () {
                Navigator.pop(context, 'OK');
              },
              child: const Text('Ok'),
            ),
          ),
        ],
      ),
    );
  }
}

class ColorChannel extends StatefulWidget {
  final DeviceDataModel device;
  final ChannelDataModel channel;
  final Color color;
  final bool isOn;

  final ValueChanged<Color>? onValueChanged;

  const ColorChannel({
    super.key,
    required this.device,
    required this.channel,
    required this.color,
    required this.isOn,
    this.onValueChanged,
  });

  @override
  State<ColorChannel> createState() => _ColorChannelState();
}

class _ColorChannelState extends State<ColorChannel> {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  late double color;

  @override
  void initState() {
    super.initState();

    color = _getValueFromColor(widget.color);
  }

  @override
  Widget build(BuildContext context) {
    return ColoredSlider(
      value: color,
      min: 0.0,
      max: 1.0,
      enabled: widget.isOn,
      onValueChanged: (double value) {
        setState(() {
          color = value;
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
      thumbDividerColor: _getColorFromValue(color),
      inner: [
        Positioned(
          left: scaler.scale(5),
          child: Row(
            children: [
              Icon(
                Icons.palette,
                size: scaler.scale(40),
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
            ],
          ),
        ),
      ],
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
  final DeviceDataModel device;
  final ChannelDataModel channel;
  final num temperature;
  final double min;
  final double max;
  final bool isOn;

  final ValueChanged<double>? onValueChanged;

  const TemperatureChannel({
    super.key,
    required this.device,
    required this.channel,
    required this.temperature,
    this.min = 2700,
    this.max = 6500,
    required this.isOn,
    this.onValueChanged,
  });

  @override
  State<TemperatureChannel> createState() => _TemperatureChannelState();
}

class _TemperatureChannelState extends State<TemperatureChannel> {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  late num temperature;

  @override
  void initState() {
    super.initState();

    temperature = widget.temperature;
  }

  @override
  Widget build(BuildContext context) {
    return ColoredSlider(
      value: temperature,
      min: widget.min,
      max: widget.max,
      enabled: widget.isOn,
      onValueChanged: (double value) {
        setState(() {
          temperature = value;
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
          left: scaler.scale(5),
          child: Row(
            children: [
              Icon(
                Icons.thermostat,
                size: scaler.scale(40),
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class WhiteChannel extends StatefulWidget {
  final DeviceDataModel device;
  final ChannelDataModel channel;
  final num white;
  final double min;
  final double max;
  final bool isOn;

  final ValueChanged<double>? onValueChanged;

  const WhiteChannel({
    super.key,
    required this.device,
    required this.channel,
    required this.white,
    this.min = 0,
    this.max = 255,
    required this.isOn,
    this.onValueChanged,
  });

  @override
  State<WhiteChannel> createState() => _WhiteChannelState();
}

class _WhiteChannelState extends State<WhiteChannel> {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  late num white;

  @override
  void initState() {
    super.initState();

    white = widget.white;
  }

  @override
  Widget build(BuildContext context) {
    return ColoredSlider(
      value: white,
      min: widget.min,
      max: widget.max,
      enabled: widget.isOn,
      showThumb: false,
      onValueChanged: (double value) {
        setState(() {
          white = value;
        });

        widget.onValueChanged?.call(value);
      },
      activeTrackColor: AppColors.white,
      inner: [
        Positioned(
          left: scaler.scale(20),
          child: Row(
            children: [
              Icon(
                Icons.lightbulb,
                size: scaler.scale(40),
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class BrightnessChannel extends StatefulWidget {
  final DeviceDataModel device;
  final ChannelDataModel channel;
  final num brightness;
  final double min;
  final double max;
  final bool isOn;
  final double? elementMaxSize;
  final bool vertical;
  final bool showButton;

  final ValueChanged<double>? onValueChanged;
  final ValueChanged<bool>? onStateChanged;

  const BrightnessChannel({
    super.key,
    required this.device,
    required this.channel,
    required this.brightness,
    this.min = 0,
    this.max = 100,
    required this.isOn,
    this.elementMaxSize,
    this.vertical = false,
    required this.showButton,
    this.onValueChanged,
    this.onStateChanged,
  });

  @override
  State<BrightnessChannel> createState() => _BrightnessChannelState();
}

class _BrightnessChannelState extends State<BrightnessChannel> {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  late num _brightness;
  late bool _isOn;

  @override
  void initState() {
    super.initState();

    _brightness = widget.brightness;
    _isOn = widget.isOn;
  }

  @override
  Widget build(BuildContext context) {
    Widget slider = widget.vertical
        ? Padding(
            padding: EdgeInsets.only(
              bottom: widget.showButton ? AppSpacings.pSm : 0,
            ),
            child: ColoredSlider(
              value: _brightness,
              min: widget.min,
              max: widget.max,
              enabled: widget.isOn,
              vertical: true,
              trackWidth: widget.showButton
                  ? ((widget.elementMaxSize ?? 0) -
                      scaler.scale(75) -
                      AppSpacings.pSm)
                  : widget.elementMaxSize,
              showThumb: false,
              onValueChanged: (double value) {
                setState(() {
                  _brightness = value;
                });

                widget.onValueChanged?.call(value);
              },
              inner: [
                Positioned(
                  left: scaler.scale(20),
                  child: Row(
                    children: [
                      Icon(
                        Icons.light_mode,
                        size: scaler.scale(40),
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.regular
                            : AppTextColorDark.regular,
                      ),
                    ],
                  ),
                ),
                Positioned(
                  right: scaler.scale(5),
                  child: Row(
                    children: [
                      RotatedBox(
                        quarterTurns: 1,
                        child: Text(
                          _brightness.round().toString(),
                          style: TextStyle(
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.regular
                                    : AppTextColorDark.regular,
                            fontSize: scaler.scale(40),
                            fontFamily: 'DIN1451',
                            fontWeight: FontWeight.w100,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        : Expanded(
            child: Padding(
              padding: EdgeInsets.only(
                right: widget.showButton ? AppSpacings.pSm : 0,
              ),
              child: ColoredSlider(
                value: _brightness,
                min: widget.min,
                max: widget.max,
                enabled: widget.isOn,
                showThumb: false,
                onValueChanged: (double value) {
                  setState(() {
                    _brightness = value;
                  });

                  widget.onValueChanged?.call(value);
                },
                inner: [
                  Positioned(
                    left: scaler.scale(20),
                    child: Row(
                      children: [
                        Icon(
                          Icons.light_mode,
                          size: scaler.scale(40),
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.regular
                                  : AppTextColorDark.regular,
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    right: scaler.scale(20),
                    child: Row(
                      children: [
                        Text(
                          _brightness.round().toString(),
                          style: TextStyle(
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.regular
                                    : AppTextColorDark.regular,
                            fontSize: scaler.scale(50),
                            fontFamily: 'DIN1451',
                            fontWeight: FontWeight.w100,
                          ),
                        ),
                        Text(
                          '%',
                          style: TextStyle(
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.regular
                                    : AppTextColorDark.regular,
                            fontSize: scaler.scale(30),
                            fontFamily: 'DIN1451',
                            fontWeight: FontWeight.w100,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );

    Widget switchButton = SizedBox(
      width: scaler.scale(75),
      height: scaler.scale(75),
      child: Theme(
        data: ThemeData(
          filledButtonTheme: _isOn
              ? AppFilledButtonsDarkThemes.primary
              : AppFilledButtonsDarkThemes.base,
        ),
        child: FilledButton(
          onPressed: () {
            setState(() {
              _isOn = !_isOn;
            });

            if (kDebugMode) {
              print(
                'Set light: ${widget.device.name} state to: $_isOn',
              );
            }

            widget.onStateChanged?.call(_isOn);
          },
          style: ButtonStyle(
            padding: WidgetStateProperty.all(EdgeInsets.zero),
          ),
          child: Center(
            // Explicitly centers the icon
            child: Icon(
              Icons.power_settings_new,
              size: scaler.scale(40),
            ),
          ),
        ),
      ),
    );

    if (widget.vertical) {
      return Column(
        children: [
          slider,
          widget.showButton ? switchButton : null,
        ].whereType<Widget>().toList(),
      );
    }

    return Row(
      children: [
        slider,
        widget.showButton ? switchButton : null,
      ].whereType<Widget>().toList(),
    );
  }
}

enum LightChannelModeType {
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
