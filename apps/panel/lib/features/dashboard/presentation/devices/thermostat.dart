import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/enum.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_navigation.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/rounded_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/value.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/device_detail.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class ThermostatDeviceDetailPage extends StatefulWidget {
  final ThermostatDeviceView _device;
  final DeviceDetailPageView? _page;

  const ThermostatDeviceDetailPage({
    super.key,
    required ThermostatDeviceView device,
    required DeviceDetailPageView? page,
  })  : _device = device,
        _page = page;

  @override
  State<ThermostatDeviceDetailPage> createState() =>
      _ThermostatDeviceDetailPageState();
}

class _ThermostatDeviceDetailPageState
    extends State<ThermostatDeviceDetailPage> {
  final PropertyValueHelper _valueHelper = PropertyValueHelper();
  final List<ThermostatModeType> _thermostatModes = [];

  late int _currentModeIndex;

  @override
  void initState() {
    super.initState();

    _thermostatModes.add(ThermostatModeType.off);

    if (widget._device.thermostatAvailableModes
        .contains(getValueFromMode(ThermostatModeType.heat))) {
      _thermostatModes.add(ThermostatModeType.heat);
    }

    if (widget._device.thermostatAvailableModes
        .contains(getValueFromMode(ThermostatModeType.cool))) {
      _thermostatModes.add(ThermostatModeType.cool);
    }

    if (widget._device.thermostatAvailableModes
        .contains(getValueFromMode(ThermostatModeType.auto))) {
      _thermostatModes.add(ThermostatModeType.auto);
    }

    if (widget._device.thermostatAvailableModes
        .contains(getValueFromMode(ThermostatModeType.manual))) {
      _thermostatModes.add(ThermostatModeType.manual);
    }

    if (widget._device.isOn == false) {
      _currentModeIndex = 0;
    } else {
      _currentModeIndex = _thermostatModes.indexWhere(
        (mode) =>
            mode ==
            getModeFromValue(
              widget._device.thermostatMode,
            ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: widget._page == null || widget._page?.showTopBar == true
          ? AppTopBar(
              title: widget._device.name,
              icon: widget._page != null
                  ? widget._page?.icon ??
                      buildDeviceIcon(
                        widget._device.category,
                        widget._device.icon,
                      )
                  : null,
            )
          : null,
      body: SafeArea(
        child: LayoutBuilder(builder: (
          BuildContext context,
          BoxConstraints constraints,
        ) {
          if (widget._device.hasCooler && widget._device.hasHeater) {
            return ThermostatDial(
              device: widget._device,
            );
          }

          return ThermostatBar(
            device: widget._device,
          );
        }),
      ),
      bottomNavigationBar: IgnorePointer(
        ignoring: widget._device.isThermostatLocked,
        child: AppBottomNavigationBar(
          currentIndex: _currentModeIndex,
          enableFloatingNavBar: false,
          onTap: _onModeSelect,
          items: _thermostatModes
              .map((mode) {
                switch (mode) {
                  case ThermostatModeType.off:
                    return AppBottomNavigationItem(
                      icon: Icon(MdiIcons.power),
                      label: localizations.thermostat_mode_off,
                    );
                  case ThermostatModeType.heat:
                    return AppBottomNavigationItem(
                      icon: Icon(MdiIcons.heatWave),
                      label: localizations.thermostat_mode_heat,
                    );
                  case ThermostatModeType.cool:
                    return AppBottomNavigationItem(
                      icon: Icon(MdiIcons.snowflake),
                      label: localizations.thermostat_mode_cool,
                    );
                  case ThermostatModeType.auto:
                    return AppBottomNavigationItem(
                      icon: Icon(MdiIcons.thermostatAuto),
                      label: localizations.thermostat_mode_auto,
                    );
                  case ThermostatModeType.manual:
                    return AppBottomNavigationItem(
                      icon: Icon(MdiIcons.gestureTap),
                      label: localizations.thermostat_mode_manual,
                    );
                }
              })
              .whereType<AppBottomNavigationItem>()
              .toList(),
        ),
      ),
    );
  }

  Future<void> _onModeSelect(int index) async {
    setState(() {
      _currentModeIndex = index;
    });

    switch (_thermostatModes[index]) {
      case ThermostatModeType.off:
        _valueHelper.setPropertyValue(
          context,
          widget._device.thermostatChannel.activeProp,
          false,
        );
        break;
      default:
        _valueHelper.setPropertyValue(
          context,
          widget._device.thermostatChannel.modeProp,
          getValueFromMode(_thermostatModes[index])?.value,
        );

        if (widget._device.isOn == false) {
          _valueHelper.setPropertyValue(
            context,
            widget._device.thermostatChannel.activeProp,
            true,
          );
        }
        break;
    }
  }
}

class ThermostatBar extends StatefulWidget {
  final ThermostatDeviceView _device;

  const ThermostatBar({
    super.key,
    required ThermostatDeviceView device,
  }) : _device = device;

  @override
  State<ThermostatBar> createState() => _ThermostatBarState();
}

class _ThermostatBarState extends State<ThermostatBar> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final double elementMaxSize = constraints.maxHeight - 2 * AppSpacings.pMd;

      final HeaterChannelView? heaterChannel = widget._device.heaterChannel;
      final CoolerChannelView? coolerChannel = widget._device.coolerChannel;

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
                          _renderConfiguredTemperature(context),
                          AppSpacings.spacingMdVertical,
                          Wrap(
                            spacing: AppSpacings.pLg,
                            runSpacing: AppSpacings.pLg,
                            alignment: WrapAlignment.start,
                            children: [
                              _renderCurrentTemperature(context),
                              _renderCurrentHumidity(context),
                            ].whereType<Widget>().toList(),
                          ),
                        ],
                      ),
                    ),
                    AppSpacings.spacingSmVertical,
                    Flexible(
                      flex: 1,
                      child: SingleChildScrollView(
                        child: ThermostatTiles(device: widget._device),
                      ),
                    ),
                  ].whereType<Widget>().toList(),
                ),
              ),
            ),
            heaterChannel != null
                ? _renderHeaterControl(
                    context,
                    elementMaxSize,
                    heaterChannel,
                  )
                : null,
            coolerChannel != null
                ? _renderCoolerControl(
                    context,
                    elementMaxSize,
                    coolerChannel,
                  )
                : null,
          ].whereType<Widget>().toList(),
        ),
      );
    });
  }

  Widget _renderConfiguredTemperature(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final ChannelPropertyView? prop =
        widget._device.heaterChannel?.temperatureProp;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            RichText(
              text: TextSpan(
                text: widget._device.isOn
                    ? ((prop != null
                            ? ValueUtils.formatValue(prop, 1)
                            : null) ??
                        localizations.value_not_available)
                    : NumberUtils.formatUnavailableNumber(1),
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
            RichText(
              text: TextSpan(
                text: widget._device.thermostatChannel.showInFahrenheit
                    ? '°F'
                    : '°C',
                style: TextStyle(
                  color: Theme.of(context).brightness == Brightness.light
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
            ),
          ],
        ),
        Text(
          localizations.thermostat_state_configured_temperature_description,
          style: TextStyle(
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.regular
                : AppTextColorDark.regular,
            fontSize: AppFontSize.base,
          ),
        )
      ],
    );
  }

  Widget _renderCurrentTemperature(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final ChannelPropertyView prop =
        widget._device.temperatureChannel.temperatureProp;

    return IntrinsicWidth(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(
                MdiIcons.thermometer,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
                size: _screenService.scale(
                  20,
                  density: _visualDensityService.density,
                ),
              ),
              AppSpacings.spacingXsHorizontal,
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  RichText(
                    text: TextSpan(
                      text: ValueUtils.formatValue(prop, 1) ??
                          localizations.value_not_available,
                      style: TextStyle(
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.secondary
                            : AppTextColorDark.secondary,
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
                  RichText(
                    text: TextSpan(
                      text: widget._device.thermostatChannel.showInFahrenheit
                          ? '°F'
                          : '°C',
                      style: TextStyle(
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.secondary
                            : AppTextColorDark.secondary,
                        fontSize: _screenService.scale(
                          15,
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
            ],
          ),
          Text(
            localizations.thermostat_state_current_temperature_description,
            style: TextStyle(
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
              fontSize: AppFontSize.extraSmall,
            ),
          ),
        ],
      ),
    );
  }

  Widget? _renderCurrentHumidity(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (!widget._device.hasHumidity) {
      return null;
    }

    final ChannelPropertyView? prop =
        widget._device.humidityChannel?.humidityProp;

    if (prop == null) {
      return null;
    }

    return IntrinsicWidth(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(
                MdiIcons.waterOutline,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
                size: _screenService.scale(
                  20,
                  density: _visualDensityService.density,
                ),
              ),
              AppSpacings.spacingXsHorizontal,
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  RichText(
                    text: TextSpan(
                      text: ValueUtils.formatValue(prop) ??
                          localizations.value_not_available,
                      style: TextStyle(
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.secondary
                            : AppTextColorDark.secondary,
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
                  RichText(
                    text: TextSpan(
                      text: '%',
                      style: TextStyle(
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.secondary
                            : AppTextColorDark.secondary,
                        fontSize: _screenService.scale(
                          15,
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
            ],
          ),
          Text(
            localizations.thermostat_state_current_humidity_description,
            style: TextStyle(
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
              fontSize: AppFontSize.extraSmall,
            ),
          ),
        ],
      ),
    );
  }

  Widget _renderHeaterControl(
    BuildContext context,
    double elementMaxSize,
    HeaterChannelView channel,
  ) {
    return ColoredSlider(
      value: channel.temperature,
      min: channel.minTemperature,
      max: channel.maxTemperature,
      enabled: !widget._device.isThermostatLocked && widget._device.isOn,
      vertical: true,
      trackWidth: elementMaxSize,
      showThumb: false,
      onValueChanged: (double value) async {
        _valueHelper.setPropertyValue(
          context,
          channel.temperatureProp,
          value,
        );
      },
      inner: [
        Positioned(
          left: _screenService.scale(
            20,
            density: _visualDensityService.density,
          ),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: 1,
                child: Icon(
                  MdiIcons.thermometerLines,
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
      ],
    );
  }

  Widget _renderCoolerControl(
    BuildContext context,
    double elementMaxSize,
    CoolerChannelView channel,
  ) {
    return ColoredSlider(
      value: channel.temperature,
      min: channel.minTemperature,
      max: channel.maxTemperature,
      enabled: !widget._device.isThermostatLocked,
      vertical: true,
      trackWidth: elementMaxSize,
      showThumb: false,
      onValueChanged: (double value) async {
        _valueHelper.setPropertyValue(
          context,
          channel.temperatureProp,
          value,
        );
      },
      inner: [
        Positioned(
          left: _screenService.scale(
            20,
            density: _visualDensityService.density,
          ),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: 1,
                child: Icon(
                  MdiIcons.thermometerLines,
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
      ],
    );
  }
}

class ThermostatDial extends StatefulWidget {
  final ThermostatDeviceView _device;

  const ThermostatDial({
    super.key,
    required ThermostatDeviceView device,
  }) : _device = device;

  @override
  State<ThermostatDial> createState() => _ThermostatDialState();
}

class _ThermostatDialState extends State<ThermostatDial> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  late bool _isLocked;

  @override
  void initState() {
    super.initState();

    _initializeWidget();
  }

  @override
  void didUpdateWidget(covariant ThermostatDial oldWidget) {
    super.didUpdateWidget(oldWidget);

    _initializeWidget();
  }

  void _initializeWidget() {
    _isLocked = widget._device.isThermostatLocked;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final HeaterChannelView? heaterChannel = widget._device.heaterChannel;
    final CoolerChannelView? coolerChannel = widget._device.coolerChannel;

    final bool isSmall =
        _screenService.screenWidth == _screenService.screenHeight;

    return Padding(
      padding: EdgeInsets.symmetric(
        vertical: AppSpacings.pLg,
        horizontal: AppSpacings.pLg,
      ),
      child: Column(
        children: [
          Expanded(
            child: LayoutBuilder(builder: (
              BuildContext context,
              BoxConstraints constraints,
            ) {
              final availableWidth = constraints.maxWidth;
              final availableHeight = constraints.maxHeight;

              if (heaterChannel != null) {
                return _renderHeaterControl(
                  context,
                  availableWidth,
                  availableHeight,
                  heaterChannel,
                  isSmall,
                );
              }

              if (coolerChannel != null) {
                return _renderCoolerControl(
                  context,
                  availableWidth,
                  availableHeight,
                  coolerChannel,
                  isSmall,
                );
              }

              return Center(
                child: Padding(
                  padding: AppSpacings.paddingMd,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        MdiIcons.alert,
                        color: Theme.of(context).error,
                        size: _screenService.scale(
                          64,
                          density: _visualDensityService.density,
                        ),
                      ),
                      AppSpacings.spacingMdVertical,
                      Text(
                        localizations.error,
                        textAlign: TextAlign.center,
                      ),
                      AppSpacings.spacingSmVertical,
                      Text(
                        localizations.thermostat_with_invalid_configuration,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
          !isSmall ? ThermostatTiles(device: widget._device) : null,
        ].whereType<Widget>().toList(),
      ),
    );
  }

  Widget _renderHeaterControl(
    BuildContext context,
    double availableWidth,
    double availableHeight,
    HeaterChannelView channel,
    bool showStatus,
  ) {
    final localizations = AppLocalizations.of(context)!;

    return RoundedSlider(
      value: channel.temperature,
      min: channel.minTemperature,
      max: channel.maxTemperature,
      enabled: !widget._device.isThermostatLocked && widget._device.isOn,
      availableWidth: availableWidth,
      availableHeight: availableHeight,
      onValueChanged: (num value) async {
        _valueHelper.setPropertyValue(
          context,
          channel.temperatureProp,
          value,
        );
      },
      upperLabel: TextSpan(
        text: localizations.thermostat_max,
        style: TextStyle(
          color: Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.secondary
              : AppTextColorDark.secondary,
          fontSize: AppFontSize.extraSmall,
          fontWeight: FontWeight.w400,
        ),
      ),
      lowerLabel: TextSpan(
        text: localizations.thermostat_min,
        style: TextStyle(
          color: Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.secondary
              : AppTextColorDark.secondary,
          fontSize: AppFontSize.extraSmall,
          fontWeight: FontWeight.w400,
        ),
      ),
      inner: _renderDialInner(
        context,
        showStatus,
        () async {
          _valueHelper.setPropertyValue(
            context,
            channel.temperatureProp,
            channel.temperature + 0.1,
          );
        },
        () async {
          _valueHelper.setPropertyValue(
            context,
            channel.temperatureProp,
            channel.temperature - 0.1,
          );
        },
      ),
    );
  }

  Widget _renderCoolerControl(
    BuildContext context,
    double availableWidth,
    double availableHeight,
    CoolerChannelView channel,
    bool showStatus,
  ) {
    final localizations = AppLocalizations.of(context)!;

    return RoundedSlider(
      value: channel.temperature,
      min: channel.minTemperature,
      max: channel.maxTemperature,
      enabled: !widget._device.isThermostatLocked,
      availableWidth: availableWidth,
      availableHeight: availableHeight,
      onValueChanged: (num value) async {
        _valueHelper.setPropertyValue(
          context,
          channel.temperatureProp,
          value,
        );
      },
      upperLabel: TextSpan(
        text: localizations.thermostat_max,
        style: TextStyle(
          color: Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.secondary
              : AppTextColorDark.secondary,
          fontSize: AppFontSize.extraSmall,
          fontWeight: FontWeight.w400,
        ),
      ),
      lowerLabel: TextSpan(
        text: localizations.thermostat_min,
        style: TextStyle(
          color: Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.secondary
              : AppTextColorDark.secondary,
          fontSize: AppFontSize.extraSmall,
          fontWeight: FontWeight.w400,
        ),
      ),
      inner: _renderDialInner(
        context,
        showStatus,
        () async {
          _valueHelper.setPropertyValue(
            context,
            channel.temperatureProp,
            channel.temperature + 0.1,
          );
        },
        () async {
          _valueHelper.setPropertyValue(
            context,
            channel.temperatureProp,
            channel.temperature - 0.1,
          );
        },
      ),
    );
  }

  Widget _renderDialInner(
    BuildContext context,
    bool showStatus,
    VoidCallback incrementCallback,
    VoidCallback decrementCallback,
  ) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _renderCurrentTemperature(context),
            _renderCurrentHumidity(context),
          ].whereType<Widget>().toList(),
        ),

        AppSpacings.spacingXsVertical,

        // Set Temperature
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Decrease Button
            _buildButton(
              context,
              MdiIcons.minus,
              decrementCallback,
              _isLocked,
            ),

            SizedBox(
              width: _screenService.scale(
                120,
                density: _visualDensityService.density,
              ),
              // Constrain the width of the content
              child: _renderConfiguredTemperature(context),
            ),

            // Increase Button
            _buildButton(
              context,
              MdiIcons.plus,
              incrementCallback,
              _isLocked,
            ),
          ],
        ),
        showStatus
            ? Wrap(
                alignment: WrapAlignment.center,
                spacing: AppSpacings.pMd,
                runSpacing: AppSpacings.pMd,
                children: [
                  widget._device.hasContact
                      ? Icon(
                          MdiIcons.windowOpenVariant,
                          size: _screenService.scale(
                            26,
                            density: _visualDensityService.density,
                          ),
                          color: widget._device.isContactDetected == true
                              ? (Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppColorsLight.primary
                                  : AppColorsDark.primary)
                              : (Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppTextColorLight.placeholder
                                  : AppTextColorDark.placeholder),
                        )
                      : null,
                  widget._device.hasHeater
                      ? Icon(
                          MdiIcons.heatWave,
                          size: _screenService.scale(
                            26,
                            density: _visualDensityService.density,
                          ),
                          color: widget._device.isOn &&
                                  widget._device.isHeaterHeating == true
                              ? (Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppColorsLight.primary
                                  : AppColorsDark.primary)
                              : (Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppTextColorLight.placeholder
                                  : AppTextColorDark.placeholder),
                        )
                      : null,
                  widget._device.hasCooler
                      ? Icon(
                          MdiIcons.snowflake,
                          size: _screenService.scale(
                            26,
                            density: _visualDensityService.density,
                          ),
                          color: widget._device.isOn &&
                                  widget._device.isCoolerCooling == true
                              ? (Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppColorsLight.primary
                                  : AppColorsDark.primary)
                              : (Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppTextColorLight.placeholder
                                  : AppTextColorDark.placeholder),
                        )
                      : null,
                  widget._device.hasThermostatLock
                      ? IconSwitch(
                          switchState: !_isLocked,
                          iconOn: MdiIcons.lockOpen,
                          iconOff: MdiIcons.lock,
                          onChanged: (value) {
                            setState(() {
                              _isLocked = !value;
                            });
                          },
                        )
                      : null,
                ].whereType<Widget>().toList(),
              )
            : null,
      ].whereType<Widget>().toList(),
    );
  }

  Widget _renderConfiguredTemperature(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final ChannelPropertyView? prop =
        widget._device.heaterChannel?.temperatureProp;

    final String? temperature =
        prop != null ? ValueUtils.formatValue(prop, 1) : null;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Main Temperature
        Text(
          widget._device.isOn
              ? temperature != null
                  ? temperature.split('.')[0]
                  : localizations.value_not_available
              : '--',
          style: TextStyle(
            fontFamily: 'DIN1451',
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.primary
                : AppTextColorDark.primary,
            fontSize: _screenService.scale(
              80,
              density: _visualDensityService.density,
            ),
          ),
        ),

        SizedBox(
          height: _screenService.scale(
            80 - 8,
            density: _visualDensityService.density,
          ),
          // Match the height of the main temperature text
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                widget._device.thermostatChannel.showInFahrenheit ? '°F' : '°C',
                style: TextStyle(
                  fontFamily: 'DIN1451',
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.primary
                      : AppTextColorDark.primary,
                  fontSize: _screenService.scale(
                    16,
                    density: _visualDensityService.density,
                  ),
                ),
              ),
              Text(
                widget._device.isOn
                    ? temperature != null
                        ? temperature.split('.')[1]
                        : ''
                    : '.-',
                style: TextStyle(
                  fontFamily: 'DIN1451',
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.primary
                      : AppTextColorDark.primary,
                  fontSize: _screenService.scale(
                    26,
                    density: _visualDensityService.density,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _renderCurrentTemperature(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final ChannelPropertyView prop =
        widget._device.temperatureChannel.temperatureProp;

    return Row(
      children: [
        Icon(
          MdiIcons.thermometerLines,
          color: Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.secondary
              : AppTextColorDark.secondary,
          size: AppFontSize.base,
        ),
        AppSpacings.spacingXsHorizontal,
        Text(
          ValueUtils.formatValue(prop, 1) ?? localizations.value_not_available,
          style: TextStyle(
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
            fontSize: AppFontSize.base,
            fontWeight: FontWeight.w400,
          ),
        ),
        Text(
          widget._device.thermostatChannel.showInFahrenheit ? '°F' : '°C',
          style: TextStyle(
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
            fontSize: AppFontSize.base,
            fontWeight: FontWeight.w400,
          ),
        ),
      ],
    );
  }

  Widget? _renderCurrentHumidity(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (!widget._device.hasHumidity) {
      return null;
    }
    final ChannelPropertyView? prop =
        widget._device.humidityChannel?.humidityProp;

    if (prop == null) {
      return null;
    }

    return Row(
      children: [
        AppSpacings.spacingMdHorizontal,
        Icon(
          MdiIcons.waterOutline,
          color: Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.secondary
              : AppTextColorDark.secondary,
          size: AppFontSize.base,
        ),
        AppSpacings.spacingXsHorizontal,
        Text(
          ValueUtils.formatValue(prop) ?? localizations.value_not_available,
          style: TextStyle(
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
            fontSize: AppFontSize.base,
            fontWeight: FontWeight.w400,
          ),
        ),
        Text(
          '%',
          style: TextStyle(
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
            fontSize: AppFontSize.base,
            fontWeight: FontWeight.w400,
          ),
        ),
      ],
    );
  }

  Widget _buildButton(
    BuildContext context,
    IconData icon,
    VoidCallback? onPressed,
    bool isLocked,
  ) {
    return Theme(
      data: ThemeData(
        iconButtonTheme: Theme.of(context).brightness == Brightness.light
            ? AppIconButtonsLightThemes.info
            : AppIconButtonsDarkThemes.info,
      ),
      child: IconButton(
        icon: Icon(
          icon,
          size: _screenService.scale(
            14,
            density: _visualDensityService.density,
          ),
        ),
        style: ButtonStyle(
          padding: WidgetStateProperty.all(AppSpacings.paddingMd),
        ),
        onPressed: isLocked ? null : onPressed,
      ),
    );
  }
}

class ThermostatTiles extends StatefulWidget {
  final ThermostatDeviceView _device;

  const ThermostatTiles({
    super.key,
    required ThermostatDeviceView device,
  }) : _device = device;

  @override
  State<ThermostatTiles> createState() => _ThermostatTilesState();
}

class _ThermostatTilesState extends State<ThermostatTiles> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  late bool _isLocked;

  @override
  void initState() {
    super.initState();

    _initializeWidget();
  }

  @override
  void didUpdateWidget(covariant ThermostatTiles oldWidget) {
    super.didUpdateWidget(oldWidget);

    _initializeWidget();
  }

  void _initializeWidget() {
    _isLocked = widget._device.isThermostatLocked;
  }

  @override
  Widget build(BuildContext context) {
    return Wrap(
      runSpacing: AppSpacings.pXs,
      children: [
        _renderThermostatState(context),
        _renderLock(context),
      ].whereType<Widget>().toList(),
    );
  }

  Widget? _renderLock(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (!widget._device.hasThermostatLock) {
      return null;
    }

    return Material(
      elevation: 0,
      color: Colors.transparent,
      child: ListTile(
        minTileHeight: _screenService.scale(
          35,
          density: _visualDensityService.density,
        ),
        leading: Tooltip(
          message: _isLocked
              ? localizations.thermostat_lock_locked
              : localizations.thermostat_lock_unlocked,
          triggerMode: TooltipTriggerMode.tap,
          child: Icon(
            _isLocked ? MdiIcons.lock : MdiIcons.lockOpen,
            size: AppFontSize.large,
          ),
        ),
        title: Text(
          localizations.thermostat_child_lock_title,
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            fontWeight: FontWeight.w600,
          ),
        ),
        trailing: IconSwitch(
          iconOn: MdiIcons.lock,
          iconOff: MdiIcons.lockOpen,
          switchState: _isLocked,
          onChanged: (bool state) async {
            setState(() {
              _isLocked = state;
            });

            final ChannelPropertyView? property =
                widget._device.thermostatChannel.lockedProp;

            if (property != null) {
              _valueHelper.setPropertyValue(
                context,
                property,
                _isLocked,
              );
            }
          },
        ),
      ),
    );
  }

  Widget? _renderThermostatState(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    IconData icon = MdiIcons.helpCircle;
    Color? iconColor;
    String? title;
    String? subtitle;

    if (widget._device.isOn == false) {
      icon = MdiIcons.power;
      iconColor = Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.info
          : AppColorsDark.info;
      title = localizations.thermostat_state_title;
      subtitle = localizations.thermostat_state_off;
    } else if (widget._device.isContactDetected == true) {
      icon = MdiIcons.windowOpenVariant;
      iconColor = Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.primary
          : AppColorsDark.primary;
      title = localizations.thermostat_openings_state_title;
      subtitle = localizations.thermostat_openings_state_description;
    } else if (widget._device.isHeaterHeating == true) {
      icon = MdiIcons.heatWave;
      iconColor = Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.primary
          : AppColorsDark.primary;
      title = localizations.thermostat_state_title;
      subtitle = localizations.thermostat_state_heating;
    } else if (widget._device.isCoolerCooling == true) {
      icon = MdiIcons.snowflake;
      iconColor = Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.flutter
          : AppColorsDark.flutter;
      title = localizations.thermostat_state_title;
      subtitle = localizations.thermostat_state_cooling;
    } else {
      icon = MdiIcons.power;
      title = localizations.thermostat_state_title;
      subtitle = localizations.thermostat_state_idling;
    }

    return Material(
      elevation: 0,
      color: Colors.transparent,
      child: ListTile(
        minTileHeight: _screenService.scale(
          25,
          density: _visualDensityService.density,
        ),
        leading: Tooltip(
          message: subtitle,
          triggerMode: TooltipTriggerMode.tap,
          child: Icon(
            icon,
            size: AppFontSize.large,
            color: iconColor,
          ),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

enum ThermostatModeType {
  off('off'),
  heat('heat'),
  cool('cool'),
  auto('auto'),
  manual('manual');

  final String value;

  const ThermostatModeType(this.value);

  static final utils = StringEnumUtils(
    ThermostatModeType.values,
    (ThermostatModeType payload) => payload.value,
  );

  static ThermostatModeType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

final Map<ThermostatModeValue, ThermostatModeType> modeValueMapping = {
  ThermostatModeValue.heat: ThermostatModeType.heat,
  ThermostatModeValue.cool: ThermostatModeType.cool,
  ThermostatModeValue.auto: ThermostatModeType.auto,
  ThermostatModeValue.manual: ThermostatModeType.manual,
};

ThermostatModeType? getModeFromValue(ThermostatModeValue type) {
  return modeValueMapping[type];
}

final Map<ThermostatModeType, ThermostatModeValue> valueModeMapping = {
  ThermostatModeType.heat: ThermostatModeValue.heat,
  ThermostatModeType.cool: ThermostatModeValue.cool,
  ThermostatModeType.auto: ThermostatModeValue.auto,
  ThermostatModeType.manual: ThermostatModeValue.manual,
};

ThermostatModeValue? getValueFromMode(ThermostatModeType type) {
  return valueModeMapping[type];
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
