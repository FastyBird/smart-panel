import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/enum.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/rounded_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/heater.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/thermostat.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices_module.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/value.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class ThermostatDeviceDetailPage extends StatefulWidget {
  final ThermostatDeviceDataModel _device;
  final ThermostatDeviceCapability _capability;

  const ThermostatDeviceDetailPage({
    super.key,
    required ThermostatDeviceDataModel device,
    required ThermostatDeviceCapability capability,
  })  : _device = device,
        _capability = capability;

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

    if (widget._capability.thermostatAvailableModes
        .contains(getValueFromMode(ThermostatModeType.heat))) {
      _thermostatModes.add(ThermostatModeType.heat);
    }

    if (widget._capability.thermostatAvailableModes
        .contains(getValueFromMode(ThermostatModeType.cool))) {
      _thermostatModes.add(ThermostatModeType.cool);
    }

    if (widget._capability.thermostatAvailableModes
        .contains(getValueFromMode(ThermostatModeType.auto))) {
      _thermostatModes.add(ThermostatModeType.auto);
    }

    if (widget._capability.thermostatAvailableModes
        .contains(getValueFromMode(ThermostatModeType.manual))) {
      _thermostatModes.add(ThermostatModeType.manual);
    }

    if (widget._capability.isOn == false) {
      _currentModeIndex = 0;
    } else {
      _currentModeIndex = _thermostatModes.indexWhere(
        (mode) =>
            mode ==
            getModeFromValue(
              widget._capability.thermostatMode,
            ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: ScreenAppBar(
        title: widget._device.name,
      ),
      body: SafeArea(
        child: LayoutBuilder(builder: (
          BuildContext context,
          BoxConstraints constraints,
        ) {
          if (widget._capability.hasCooler && widget._capability.hasHeater) {
            return ThermostatDial(
              capability: widget._capability,
            );
          }

          return ThermostatBar(
            capability: widget._capability,
          );
        }),
      ),
      bottomNavigationBar: IgnorePointer(
        ignoring: widget._capability.isThermostatLocked,
        child: BottomNavigationBar(
          selectedItemColor: Theme.of(context).brightness == Brightness.light
              ? (widget._capability.isThermostatLocked
                  ? AppColorsLight.primaryLight3
                  : AppColorsLight.primary)
              : (widget._capability.isThermostatLocked
                  ? AppColorsDark.primaryLight3
                  : AppColorsDark.primary),
          currentIndex: _currentModeIndex,
          onTap: _onModeSelect,
          type: BottomNavigationBarType.fixed,
          items: _thermostatModes
              .map((mode) {
                switch (mode) {
                  case ThermostatModeType.off:
                    return BottomNavigationBarItem(
                      icon: Icon(Icons.power_settings_new),
                      label: localizations.thermostat_mode_off,
                    );
                  case ThermostatModeType.heat:
                    return BottomNavigationBarItem(
                      icon: Icon(Icons.whatshot),
                      label: localizations.thermostat_mode_heat,
                    );
                  case ThermostatModeType.cool:
                    return BottomNavigationBarItem(
                      icon: Icon(Icons.ac_unit),
                      label: localizations.thermostat_mode_cool,
                    );
                  case ThermostatModeType.auto:
                    return BottomNavigationBarItem(
                      icon: Icon(Icons.thermostat_auto),
                      label: localizations.thermostat_mode_auto,
                    );
                  case ThermostatModeType.manual:
                    return BottomNavigationBarItem(
                      icon: Icon(Icons.touch_app),
                      label: localizations.thermostat_mode_manual,
                    );
                }
              })
              .whereType<BottomNavigationBarItem>()
              .toList(),
        ),
      ),
    );
  }

  void _onModeSelect(int index) {
    setState(() {
      _currentModeIndex = index;
    });

    switch (_thermostatModes[index]) {
      case ThermostatModeType.off:
        _valueHelper.setPropertyValue(
          context,
          widget._capability.thermostatCapability.activeProp,
          false,
        );
        break;
      default:
        _valueHelper.setPropertyValue(
          context,
          widget._capability.thermostatCapability.modeProp,
          getValueFromMode(_thermostatModes[index])?.value,
        );

        if (widget._capability.isOn == false) {
          _valueHelper.setPropertyValue(
            context,
            widget._capability.thermostatCapability.activeProp,
            true,
          );
        }
        break;
    }
  }
}

class ThermostatBar extends StatefulWidget {
  final ThermostatDeviceCapability _capability;

  const ThermostatBar({
    super.key,
    required ThermostatDeviceCapability capability,
  }) : _capability = capability;

  @override
  State<ThermostatBar> createState() => _ThermostatBarState();
}

class _ThermostatBarState extends State<ThermostatBar> {
  final ScreenService _screenService = locator<ScreenService>();
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final double elementMaxSize = constraints.maxHeight - 2 * AppSpacings.pMd;

      final HeaterChannelCapability? heaterCapability =
          widget._capability.heaterCapability;
      final CoolerChannelCapability? coolerCapability =
          widget._capability.coolerCapability;

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
                        child: ThermostatTiles(capability: widget._capability),
                      ),
                    ),
                  ].whereType<Widget>().toList(),
                ),
              ),
            ),
            heaterCapability != null
                ? _renderHeaterControl(
                    context,
                    elementMaxSize,
                    heaterCapability,
                  )
                : null,
            coolerCapability != null
                ? _renderCoolerControl(
                    context,
                    elementMaxSize,
                    coolerCapability,
                  )
                : null,
          ].whereType<Widget>().toList(),
        ),
      );
    });
  }

  Widget _renderConfiguredTemperature(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final ChannelPropertyDataModel? prop =
        widget._capability.heaterCapability?.temperatureProp;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            RichText(
              text: TextSpan(
                text: widget._capability.isOn
                    ? ((prop != null
                            ? ValueUtils.formatValue(prop, 1)
                            : null) ??
                        localizations.value_not_available)
                    : NumberUtils.formatUnavailableNumber(),
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
            RichText(
              text: TextSpan(
                text: widget._capability.thermostatCapability.showInFahrenheit
                    ? '°F'
                    : '°C',
                style: TextStyle(
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
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

    final ChannelPropertyDataModel prop =
        widget._capability.temperatureCapability.temperatureProp;

    return IntrinsicWidth(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(
                Icons.device_thermostat,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
                size: _screenService.scale(20),
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
                        fontSize: _screenService.scale(25),
                        fontFamily: 'DIN1451',
                        fontWeight: FontWeight.w100,
                        height: 1.0,
                      ),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  RichText(
                    text: TextSpan(
                      text: widget
                              ._capability.thermostatCapability.showInFahrenheit
                          ? '°F'
                          : '°C',
                      style: TextStyle(
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.secondary
                            : AppTextColorDark.secondary,
                        fontSize: _screenService.scale(15),
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

    if (!widget._capability.hasHumidity) {
      return null;
    }

    final ChannelPropertyDataModel? prop =
        widget._capability.humidityCapability?.humidityProp;

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
                Icons.water_drop,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
                size: _screenService.scale(20),
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
                        fontSize: _screenService.scale(25),
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
                        fontSize: _screenService.scale(15),
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
    HeaterChannelCapability capability,
  ) {
    return ColoredSlider(
      value: capability.temperature,
      min: capability.minTemperature,
      max: capability.maxTemperature,
      enabled:
          !widget._capability.isThermostatLocked && widget._capability.isOn,
      vertical: true,
      trackWidth: elementMaxSize,
      showThumb: false,
      onValueChanged: (double value) {
        _valueHelper.setPropertyValue(
          context,
          capability.temperatureProp,
          value,
        );
      },
      inner: [
        Positioned(
          left: _screenService.scale(20),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: 1,
                child: Icon(
                  Icons.thermostat,
                  size: _screenService.scale(40),
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
    CoolerChannelCapability capability,
  ) {
    return ColoredSlider(
      value: capability.temperature,
      min: capability.minTemperature,
      max: capability.maxTemperature,
      enabled: !widget._capability.isThermostatLocked,
      vertical: true,
      trackWidth: elementMaxSize,
      showThumb: false,
      onValueChanged: (double value) {
        _valueHelper.setPropertyValue(
          context,
          capability.temperatureProp,
          value,
        );
      },
      inner: [
        Positioned(
          left: _screenService.scale(20),
          child: Row(
            children: [
              RotatedBox(
                quarterTurns: 1,
                child: Icon(
                  Icons.thermostat,
                  size: _screenService.scale(40),
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
  final ThermostatDeviceCapability _capability;

  const ThermostatDial({
    super.key,
    required ThermostatDeviceCapability capability,
  }) : _capability = capability;

  @override
  State<ThermostatDial> createState() => _ThermostatDialState();
}

class _ThermostatDialState extends State<ThermostatDial> {
  final ScreenService _screenService = locator<ScreenService>();
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
    _isLocked = widget._capability.isThermostatLocked;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final HeaterChannelCapability? heaterCapability =
        widget._capability.heaterCapability;
    final CoolerChannelCapability? coolerCapability =
        widget._capability.coolerCapability;

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

              if (heaterCapability != null) {
                return _renderHeaterControl(
                  context,
                  availableWidth,
                  availableHeight,
                  heaterCapability,
                  isSmall,
                );
              }

              if (coolerCapability != null) {
                return _renderCoolerControl(
                  context,
                  availableWidth,
                  availableHeight,
                  coolerCapability,
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
                        Icons.error,
                        color: Theme.of(context).error,
                        size: _screenService.scale(64),
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
          !isSmall ? ThermostatTiles(capability: widget._capability) : null,
        ].whereType<Widget>().toList(),
      ),
    );
  }

  Widget _renderHeaterControl(
    BuildContext context,
    double availableWidth,
    double availableHeight,
    HeaterChannelCapability capability,
    bool showStatus,
  ) {
    final localizations = AppLocalizations.of(context)!;

    return RoundedSlider(
      value: capability.temperature,
      min: capability.minTemperature,
      max: capability.maxTemperature,
      enabled:
          !widget._capability.isThermostatLocked && widget._capability.isOn,
      availableWidth: availableWidth,
      availableHeight: availableHeight,
      onValueChanged: (num value) {
        _valueHelper.setPropertyValue(
          context,
          capability.temperatureProp,
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
        () {
          _valueHelper.setPropertyValue(
            context,
            capability.temperatureProp,
            capability.temperature + 0.1,
          );
        },
        () {
          _valueHelper.setPropertyValue(
            context,
            capability.temperatureProp,
            capability.temperature - 0.1,
          );
        },
      ),
    );
  }

  Widget _renderCoolerControl(
    BuildContext context,
    double availableWidth,
    double availableHeight,
    CoolerChannelCapability capability,
    bool showStatus,
  ) {
    final localizations = AppLocalizations.of(context)!;

    return RoundedSlider(
      value: capability.temperature,
      min: capability.minTemperature,
      max: capability.maxTemperature,
      enabled: !widget._capability.isThermostatLocked,
      availableWidth: availableWidth,
      availableHeight: availableHeight,
      onValueChanged: (num value) {
        _valueHelper.setPropertyValue(
          context,
          capability.temperatureProp,
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
        () {
          _valueHelper.setPropertyValue(
            context,
            capability.temperatureProp,
            capability.temperature + 0.1,
          );
        },
        () {
          _valueHelper.setPropertyValue(
            context,
            capability.temperatureProp,
            capability.temperature - 0.1,
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
              Icons.remove,
              decrementCallback,
              _isLocked,
            ),

            SizedBox(
              width: _screenService.scale(120),
              // Constrain the width of the content
              child: _renderConfiguredTemperature(context),
            ),

            // Increase Button
            _buildButton(
              context,
              Icons.add,
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
                  widget._capability.hasContact
                      ? Icon(
                          Icons.window,
                          size: _screenService.scale(26),
                          color: widget._capability.isContactDetected == true
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
                  widget._capability.hasHeater
                      ? Icon(
                          Icons.whatshot,
                          size: _screenService.scale(26),
                          color: widget._capability.isOn &&
                                  widget._capability.isHeaterHeating == true
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
                  widget._capability.hasCooler
                      ? Icon(
                          Icons.ac_unit,
                          size: _screenService.scale(26),
                          color: widget._capability.isOn &&
                                  widget._capability.isCoolerCooling == true
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
                  widget._capability.hasThermostatLock
                      ? IconSwitch(
                          switchState: !_isLocked,
                          iconOn: Icons.lock_open,
                          iconOff: Icons.lock,
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

    final ChannelPropertyDataModel? prop =
        widget._capability.heaterCapability?.temperatureProp;

    final String? temperature =
        prop != null ? ValueUtils.formatValue(prop, 1) : null;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Main Temperature
        Text(
          widget._capability.isOn
              ? temperature != null
                  ? temperature.split('.')[0]
                  : localizations.value_not_available
              : '--',
          style: TextStyle(
            fontFamily: 'DIN1451',
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.primary
                : AppTextColorDark.primary,
            fontSize: _screenService.scale(80),
          ),
        ),

        SizedBox(
          height: _screenService.scale(80 - 8),
          // Match the height of the main temperature text
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                widget._capability.thermostatCapability.showInFahrenheit
                    ? '°F'
                    : '°C',
                style: TextStyle(
                  fontFamily: 'DIN1451',
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.primary
                      : AppTextColorDark.primary,
                  fontSize: _screenService.scale(16),
                ),
              ),
              Text(
                widget._capability.isOn
                    ? temperature != null
                        ? temperature.split('.')[1]
                        : ''
                    : '.-',
                style: TextStyle(
                  fontFamily: 'DIN1451',
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.primary
                      : AppTextColorDark.primary,
                  fontSize: _screenService.scale(26),
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

    final ChannelPropertyDataModel prop =
        widget._capability.temperatureCapability.temperatureProp;

    return Row(
      children: [
        Icon(
          Icons.device_thermostat,
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
          widget._capability.thermostatCapability.showInFahrenheit
              ? '°F'
              : '°C',
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

    if (!widget._capability.hasHumidity) {
      return null;
    }
    final ChannelPropertyDataModel? prop =
        widget._capability.humidityCapability?.humidityProp;

    if (prop == null) {
      return null;
    }

    return Row(
      children: [
        AppSpacings.spacingMdHorizontal,
        Icon(
          Icons.water_drop,
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
          size: _screenService.scale(14),
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
  final ThermostatDeviceCapability _capability;

  const ThermostatTiles({
    super.key,
    required ThermostatDeviceCapability capability,
  }) : _capability = capability;

  @override
  State<ThermostatTiles> createState() => _ThermostatTilesState();
}

class _ThermostatTilesState extends State<ThermostatTiles> {
  final ScreenService _screenService = locator<ScreenService>();
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
    _isLocked = widget._capability.isThermostatLocked;
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

    if (!widget._capability.hasThermostatLock) {
      return null;
    }

    return Material(
      elevation: 0,
      color: Colors.transparent,
      child: ListTile(
        contentPadding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pSm,
        ),
        dense: true,
        onTap: () {
          setState(() {
            _isLocked = !_isLocked;
          });

          final ChannelPropertyDataModel? property =
              widget._capability.thermostatCapability.lockedProp;

          if (property != null) {
            _valueHelper.setPropertyValue(
              context,
              property,
              _isLocked,
            );
          }
        },
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
          _isLocked ? Icons.lock : Icons.lock_open,
          size: AppFontSize.large,
        ),
        title: Text(
          localizations.thermostat_child_lock_title,
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(
          _isLocked
              ? localizations.thermostat_lock_locked
              : localizations.thermostat_lock_unlocked,
          style: TextStyle(
            fontSize: _screenService.scale(8),
          ),
        ),
        trailing: Switch(
          value: _isLocked,
          onChanged: (bool value) {
            setState(() {
              _isLocked = value;
            });

            final ChannelPropertyDataModel? property =
                widget._capability.thermostatCapability.lockedProp;

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

    IconData icon = Icons.question_mark;
    Color? iconColor;
    String? title;
    String? subtitle;

    if (widget._capability.isOn == false) {
      icon = Icons.power_settings_new;
      iconColor = Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.info
          : AppColorsDark.info;
      title = localizations.thermostat_state_title;
      subtitle = localizations.thermostat_state_off;
    } else if (widget._capability.isContactDetected == true) {
      icon = Icons.window;
      iconColor = Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.primary
          : AppColorsDark.primary;
      title = localizations.thermostat_openings_state_title;
      subtitle = localizations.thermostat_openings_state_description;
    } else if (widget._capability.isHeaterHeating == true) {
      icon = Icons.whatshot;
      iconColor = Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.primary
          : AppColorsDark.primary;
      title = localizations.thermostat_state_title;
      subtitle = localizations.thermostat_state_heating;
    } else if (widget._capability.isCoolerCooling == true) {
      icon = Icons.ac_unit;
      iconColor = Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.flutter
          : AppColorsDark.flutter;
      title = localizations.thermostat_state_title;
      subtitle = localizations.thermostat_state_cooling;
    } else {
      icon = Icons.power_settings_new;
      title = localizations.thermostat_state_title;
      subtitle = localizations.thermostat_state_idling;
    }

    return Material(
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
          icon,
          size: AppFontSize.large,
          color: iconColor,
        ),
        title: Text(
          title,
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(
            fontSize: _screenService.scale(8),
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
