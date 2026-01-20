import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/info_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/speed_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/fan_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/humidifier_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class AirHumidifierDeviceDetail extends StatefulWidget {
  final AirHumidifierDeviceView _device;
  final VoidCallback? onBack;

  const AirHumidifierDeviceDetail({
    super.key,
    required AirHumidifierDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<AirHumidifierDeviceDetail> createState() =>
      _AirHumidifierDeviceDetailState();
}

class _AirHumidifierDeviceDetailState extends State<AirHumidifierDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;
  AirHumidifierDeviceController? _controller;

  // Debounce timer for mist level slider to avoid flooding backend
  Timer? _mistLevelDebounceTimer;
  static const _mistLevelDebounceDuration = Duration(milliseconds: 300);

  // Debounce timer for speed slider to avoid flooding backend
  Timer? _speedDebounceTimer;
  static const _speedDebounceDuration = Duration(milliseconds: 300);

  @override
  void initState() {
    super.initState();
    _devicesService.addListener(_onDeviceChanged);

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
      _initController();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AirHumidifierDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = AirHumidifierDeviceController(
        device: _device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint('[AirHumidifierDeviceDetail] Controller error for $propertyId: $error');
    }
    final localizations = AppLocalizations.of(context);
    if (mounted && localizations != null) {
      AlertBar.showError(context, message: localizations.action_failed);
    }
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _mistLevelDebounceTimer?.cancel();
    _speedDebounceTimer?.cancel();
    _devicesService.removeListener(_onDeviceChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onDeviceChanged() {
    if (mounted) {
      _initController(); // Reinitialize controller with updated device
      setState(() {});
    }
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  AirHumidifierDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is AirHumidifierDeviceView) {
      return updated;
    }
    return widget._device;
  }

  HumidifierChannelView? get _humidifierChannel => _device.humidifierChannel;

  Future<void> _setPropertyValue(
    ChannelPropertyView? property,
    dynamic value,
  ) async {
    if (property == null) return;

    final localizations = AppLocalizations.of(context);

    try {
      bool res = await _devicesService.setPropertyValue(property.id, value);

      if (!res && mounted && localizations != null) {
        AlertBar.showError(context, message: localizations.action_failed);
      }
    } catch (e) {
      if (!mounted) return;
      if (localizations != null) {
        AlertBar.showError(context, message: localizations.action_failed);
      }
    }
  }

  /// Toggle power on/off for humidifier and fan together
  Future<void> _togglePower(bool turnOn) async {
    final channel = _humidifierChannel;
    final fanChannel = _device.fanChannel;

    if (channel == null) return;

    final localizations = AppLocalizations.of(context);

    // Set PENDING state immediately for responsive UI
    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      channel.onProp.id,
      turnOn,
    );
    if (fanChannel != null) {
      _deviceControlStateService?.setPending(
        _device.id,
        fanChannel.id,
        fanChannel.onProp.id,
        turnOn,
      );
    }
    setState(() {});

    // Build batch command list
    final commands = <PropertyCommandItem>[];

    // Humidifier on/off
    commands.add(PropertyCommandItem(
      deviceId: _device.id,
      channelId: channel.id,
      propertyId: channel.onProp.id,
      value: turnOn,
    ));

    // Fan on/off (if fan channel exists)
    if (fanChannel != null) {
      commands.add(PropertyCommandItem(
        deviceId: _device.id,
        channelId: fanChannel.id,
        propertyId: fanChannel.onProp.id,
        value: turnOn,
      ));
    }

    // Send all commands as a single batch
    try {
      bool res = await _devicesService.setMultiplePropertyValues(
        properties: commands,
      );

      if (!res && mounted && localizations != null) {
        AlertBar.showError(context, message: localizations.action_failed);
      }
    } catch (e) {
      if (!mounted) return;
      if (localizations != null) {
        AlertBar.showError(context, message: localizations.action_failed);
      }
    }

    // Transition to settling state
    if (mounted) {
      _deviceControlStateService?.setSettling(
        _device.id,
        channel.id,
        channel.onProp.id,
      );
      if (fanChannel != null) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          fanChannel.onProp.id,
        );
      }
    }
  }

  void _setHumidity(int humidity) {
    final channel = _humidifierChannel;
    final humidityProp = channel?.humidityProp;
    if (channel == null || humidityProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      humidityProp.id,
      humidity,
    );
    setState(() {});

    _setPropertyValue(humidityProp, humidity).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          humidityProp.id,
        );
      }
    });
  }

  void _setHumidifierMode(HumidifierModeValue mode) {
    final channel = _humidifierChannel;
    final modeProp = channel?.modeProp;
    if (channel == null || !channel.hasMode || modeProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      modeProp.id,
      mode.value,
    );
    setState(() {});

    _setPropertyValue(modeProp, mode.value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          modeProp.id,
        );
      }
    });
  }

  void _setFanSwing(bool value) {
    final fanChannel = _device.fanChannel;
    final swingProp = fanChannel?.swingProp;
    if (fanChannel == null || !fanChannel.hasSwing || swingProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      swingProp.id,
      value,
    );
    setState(() {});

    _setPropertyValue(swingProp, value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          swingProp.id,
        );
      }
    });
  }

  void _setFanDirection(FanDirectionValue direction) {
    final fanChannel = _device.fanChannel;
    final directionProp = fanChannel?.directionProp;
    if (fanChannel == null || !fanChannel.hasDirection || directionProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      directionProp.id,
      direction.value,
    );
    setState(() {});

    _setPropertyValue(directionProp, direction.value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          directionProp.id,
        );
      }
    });
  }

  void _setFanNaturalBreeze(bool value) {
    final fanChannel = _device.fanChannel;
    final naturalBreezeProp = fanChannel?.naturalBreezeProp;
    if (fanChannel == null || !fanChannel.hasNaturalBreeze || naturalBreezeProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      naturalBreezeProp.id,
      value,
    );
    setState(() {});

    _setPropertyValue(naturalBreezeProp, value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          naturalBreezeProp.id,
        );
      }
    });
  }

  void _setWarmMist(bool value) {
    final channel = _humidifierChannel;
    final warmMistProp = channel?.warmMistProp;
    if (channel == null || !channel.hasWarmMist || warmMistProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      warmMistProp.id,
      value,
    );
    setState(() {});

    _setPropertyValue(warmMistProp, value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          warmMistProp.id,
        );
      }
    });
  }

  void _setHumidifierLocked(bool value) {
    final channel = _humidifierChannel;
    final lockedProp = channel?.lockedProp;
    if (channel == null || !channel.hasLocked || lockedProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      lockedProp.id,
      value,
    );
    setState(() {});

    _setPropertyValue(lockedProp, value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          lockedProp.id,
        );
      }
    });
  }

  void _setMistLevelEnum(HumidifierMistLevelLevelValue level) {
    final channel = _humidifierChannel;
    final mistLevelProp = channel?.mistLevelProp;
    if (channel == null || !channel.hasMistLevel || !channel.isMistLevelEnum || mistLevelProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      mistLevelProp.id,
      level.value,
    );
    setState(() {});

    _setPropertyValue(mistLevelProp, level.value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          mistLevelProp.id,
        );
      }
    });
  }

  void _setFanSpeedLevel(FanSpeedLevelValue level) {
    final fanChannel = _device.fanChannel;
    final speedProp = fanChannel?.speedProp;
    if (fanChannel == null || !fanChannel.hasSpeed || !fanChannel.isSpeedEnum || speedProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      speedProp.id,
      level.value,
    );
    setState(() {});

    _setPropertyValue(speedProp, level.value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          speedProp.id,
        );
      }
    });
  }

  void _setFanMode(FanModeValue mode) {
    final fanChannel = _device.fanChannel;
    final modeProp = fanChannel?.modeProp;
    if (fanChannel == null || !fanChannel.hasMode || modeProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      modeProp.id,
      mode.value,
    );
    setState(() {});

    _setPropertyValue(modeProp, mode.value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          modeProp.id,
        );
      }
    });
  }

  void _setHumidifierTimerPreset(HumidifierTimerPresetValue preset) {
    final channel = _humidifierChannel;
    final timerProp = channel?.timerProp;
    if (channel == null || !channel.hasTimer || timerProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      timerProp.id,
      preset.value,
    );
    setState(() {});

    _setPropertyValue(timerProp, preset.value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          timerProp.id,
        );
      }
    });
  }

  void _setHumidifierTimerNumeric(int seconds) {
    final channel = _humidifierChannel;
    final timerProp = channel?.timerProp;
    if (channel == null || !channel.hasTimer || timerProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      timerProp.id,
      seconds,
    );
    setState(() {});

    _setPropertyValue(timerProp, seconds).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          timerProp.id,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  return orientation == Orientation.landscape
                      ? _buildLandscape(context, isDark)
                      : _buildPortrait(context, isDark);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final humidityColor = DeviceColors.humidity(isDark);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    final channel = _humidifierChannel;
    final isOn = _device.isOn;
    final measuredHumidity = _device.humidityChannel.humidity;
    final isHumidifying = channel?.computeIsHumidifying(
          currentHumidity: measuredHumidity,
        ) ??
        false;
    final targetHumidity = channel?.humidity ?? 0;

    String subtitle;
    if (isOn) {
      final statusText = isHumidifying
          ? localizations.humidifier_status_humidifying
          : localizations.humidifier_status_idle;
      subtitle = '$targetHumidity% • $statusText';
    } else {
      subtitle = localizations.on_state_off;
    }

    return PageHeader(
      title: _device.name,
      subtitle: subtitle,
      subtitleColor: isOn ? humidityColor : secondaryColor,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: widget.onBack,
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: isOn
                  ? DeviceColors.humidityLight9(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              Icons.water_drop,
              color: isOn ? humidityColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
      trailing: GestureDetector(
        onTap: () => _togglePower(!isOn),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: _scale(48),
          height: _scale(32),
          decoration: BoxDecoration(
            color: isOn
                ? humidityColor
                : (isDark
                    ? AppFillColorDark.light
                    : AppFillColorLight.light),
            borderRadius: BorderRadius.circular(AppBorderRadius.round),
            border: (!isOn && !isDark)
                ? Border.all(color: AppBorderColorLight.base, width: _scale(1))
                : null,
          ),
          child: Icon(
            Icons.power_settings_new,
            size: _scale(18),
            color: isOn
                ? AppColors.white
                : (isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary),
          ),
        ),
      ),
    );
  }

  Widget _buildLandscape(BuildContext context, bool isDark) {
    final humidityColor = DeviceColors.humidity(isDark);
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final isLargeScreen = _screenService.isLargeScreen;

    if (isLargeScreen) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 1,
            child: Padding(
              padding: AppSpacings.paddingLg,
              child: _buildControlCard(isDark, humidityColor),
            ),
          ),
          Container(width: _scale(1), color: borderColor),
          Expanded(
            flex: 1,
            child: Container(
              color: cardColor,
              padding: AppSpacings.paddingLg,
              child: SingleChildScrollView(
                child: _buildStatus(isDark),
              ),
            ),
          ),
        ],
      );
    }

    // Compact layout for small/medium screens
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: 2,
          child: Padding(
            padding: AppSpacings.paddingLg,
            child: _buildCompactControlCard(context, isDark, humidityColor),
          ),
        ),
        Container(width: _scale(1), color: borderColor),
        Expanded(
          flex: 1,
          child: Container(
            color: cardColor,
            padding: AppSpacings.paddingLg,
            child: SingleChildScrollView(
              child: _buildStatus(isDark),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildControlCard(bool isDark, Color humidityColor) {
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final isOn = _device.isOn;
    final controlBorderColor =
        isOn ? DeviceColors.humidityLight7(isDark) : borderColor;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(color: controlBorderColor, width: _scale(1)),
      ),
      child: Column(
        children: [
          _buildHumidityDial(humidityColor, _scale(200)),
          AppSpacings.spacingLgVertical,
          _buildModeSelector(isDark, humidityColor),
        ],
      ),
    );
  }

  Widget _buildCompactControlCard(
    BuildContext context,
    bool isDark,
    Color humidityColor,
  ) {
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final isOn = _device.isOn;
    final controlBorderColor =
        isOn ? DeviceColors.humidityLight7(isDark) : borderColor;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(color: controlBorderColor, width: _scale(1)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final modeIconsWidth = _scale(50);
          final spacing = AppSpacings.pXl;
          final availableForDial =
              constraints.maxWidth - modeIconsWidth - spacing;
          final maxDialHeight = constraints.maxHeight;
          final dialSize =
              math.min(availableForDial, maxDialHeight).clamp(120.0, 400.0);

          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildHumidityDial(humidityColor, dialSize),
              AppSpacings.spacingXlHorizontal,
              _buildVerticalModeSelector(humidityColor),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHumidityDial(Color humidityColor, double size) {
    final channel = _humidifierChannel;
    if (channel == null) return const SizedBox.shrink();

    final isOn = _device.isOn;
    final rawTargetHumidity = channel.humidity;

    // Validate min/max - CircularControlDial asserts maxValue > minValue
    var minHumidity = channel.minHumidity;
    var maxHumidity = channel.maxHumidity;
    if (minHumidity >= maxHumidity) {
      // Use safe defaults if API returns malformed data
      minHumidity = 0;
      maxHumidity = 100;
    }

    // Clamp target humidity to valid range to avoid UI inconsistencies
    final targetHumidity = rawTargetHumidity.clamp(minHumidity, maxHumidity);

    // Get current humidity from humidity sensor channel
    final humidityChannel = _device.humidityChannel;
    final measuredHumidity = humidityChannel.humidity;
    final currentHumidity = measuredHumidity.toDouble();

    // Determine if actively humidifying (must be on AND actively working)
    final isActivelyWorking = channel.computeIsHumidifying(
      currentHumidity: measuredHumidity,
    );

    return CircularControlDial(
      value: targetHumidity / 100.0,
      currentValue: currentHumidity / 100.0,
      minValue: minHumidity / 100.0,
      maxValue: maxHumidity / 100.0,
      step: 0.01,
      size: size,
      accentType: DialAccentColor.teal,
      isActive: isOn && isActivelyWorking,
      enabled: isOn,
      displayFormat: DialDisplayFormat.percentage,
      majorTickCount: 8,
      onChanged: (v) {
        final newHumidity = (v * 100).round();
        _setHumidity(newHumidity);
      },
    );
  }

  Widget _buildPortrait(BuildContext context, bool isDark) {
    final humidityColor = DeviceColors.humidity(isDark);
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final isOn = _device.isOn;
    final controlBorderColor =
        isOn ? DeviceColors.humidityLight7(isDark) : borderColor;

    return SingleChildScrollView(
      padding: AppSpacings.paddingMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: AppSpacings.paddingLg,
            decoration: BoxDecoration(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
              borderRadius: BorderRadius.circular(AppBorderRadius.round),
              border: Border.all(color: controlBorderColor, width: _scale(1)),
            ),
            child: Column(
              children: [
                _buildHumidityDial(humidityColor, _scale(200)),
                AppSpacings.spacingMdVertical,
                _buildModeSelector(isDark, humidityColor),
              ],
            ),
          ),
          AppSpacings.spacingMdVertical,
          _buildStatus(isDark),
        ],
      ),
    );
  }

  Widget _buildModeSelector(bool isDark, Color activeColor) {
    final localizations = AppLocalizations.of(context)!;
    final channel = _humidifierChannel;
    if (channel == null || !channel.hasMode) return const SizedBox.shrink();

    final availableModes = channel.availableModes;
    if (availableModes.isEmpty) return const SizedBox.shrink();

    final currentMode = channel.mode;
    if (currentMode == null) return const SizedBox.shrink();

    return ModeSelector<HumidifierModeValue>(
      modes: availableModes
          .map((mode) => ModeOption(
                value: mode,
                icon: HumidifierUtils.getModeIcon(mode),
                label: HumidifierUtils.getModeLabel(localizations, mode),
              ))
          .toList(),
      selectedValue: currentMode,
      onChanged: _setHumidifierMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: ModeSelectorColor.teal,
      scrollable: true,
    );
  }

  Widget _buildVerticalModeSelector(Color activeColor) {
    final localizations = AppLocalizations.of(context)!;
    final channel = _humidifierChannel;
    if (channel == null || !channel.hasMode) return const SizedBox.shrink();

    final availableModes = channel.availableModes;
    if (availableModes.isEmpty) return const SizedBox.shrink();

    final currentMode = channel.mode;
    if (currentMode == null) return const SizedBox.shrink();

    return ModeSelector<HumidifierModeValue>(
      modes: availableModes
          .map((mode) => ModeOption(
                value: mode,
                icon: HumidifierUtils.getModeIcon(mode),
                label: HumidifierUtils.getModeLabel(localizations, mode),
              ))
          .toList(),
      selectedValue: currentMode,
      onChanged: _setHumidifierMode,
      orientation: ModeSelectorOrientation.vertical,
      showLabels: false,
      color: ModeSelectorColor.teal,
      scrollable: true,
    );
  }

  Widget _buildStatus(bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final humidityColor = DeviceColors.humidity(isDark);
    final channel = _humidifierChannel;
    final fanChannel = _device.fanChannel;
    final useVerticalLayout = _screenService.isLandscape &&
        (_screenService.isSmallScreen || _screenService.isMediumScreen);

    // Build info tiles ordered by priority
    final infoTiles = <Widget>[];

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 1: SAFETY-CRITICAL
    // ═══════════════════════════════════════════════════════════════════════

    // Leak sensor (optional) - water damage prevention
    final leakChannel = _device.leakChannel;
    if (leakChannel != null) {
      final isLeaking = leakChannel.detected;
      infoTiles.add(InfoTile(
        label: localizations.leak_sensor_water,
        value: isLeaking
            ? localizations.leak_sensor_detected
            : localizations.leak_sensor_dry,
        isWarning: isLeaking,
      ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 2: DEVICE STATUS
    // ═══════════════════════════════════════════════════════════════════════

    // Current humidity from humidity sensor channel (required per spec)
    final currentHumidity = _device.humidityChannel.humidity;
    infoTiles.add(InfoTile(
      label: localizations.device_current_humidity,
      value: NumberFormatUtils.defaultFormat.formatInteger(currentHumidity),
      unit: '%',
      valueColor: humidityColor,
    ));

    // Water tank level
    if (channel != null && channel.hasWaterTankLevel) {
      infoTiles.add(InfoTile(
        label: localizations.humidifier_water_tank,
        value: NumberFormatUtils.defaultFormat.formatInteger(channel.waterTankLevel),
        unit: '%',
        isWarning: channel.waterTankWarning,
      ));
    } else if (channel != null && channel.hasWaterTankEmpty) {
      infoTiles.add(InfoTile(
        label: localizations.humidifier_water_tank,
        value: channel.waterTankEmpty
            ? localizations.humidifier_mist_level_off
            : localizations.on_state_on,
        isWarning: channel.waterTankEmpty,
      ));
    }

    // Mist level if using numeric display
    if (channel != null &&
        channel.hasMistLevel &&
        channel.isMistLevelNumeric) {
      infoTiles.add(InfoTile(
        label: localizations.humidifier_mist_level,
        value: NumberFormatUtils.defaultFormat.formatInteger(channel.mistLevel),
        unit: '%',
      ));
    } else if (channel != null &&
        channel.hasMistLevel &&
        channel.isMistLevelEnum) {
      final preset = channel.mistLevelPreset;
      infoTiles.add(InfoTile(
        label: localizations.humidifier_mist_level,
        value: preset != null
            ? HumidifierUtils.getMistLevelLabel(localizations, preset)
            : '-',
      ));
    }

    // Fan speed if available
    if (fanChannel != null && fanChannel.hasSpeed) {
      String speedLabel;
      if (fanChannel.isSpeedEnum) {
        final level = fanChannel.speedLevel;
        speedLabel = level != null
            ? FanUtils.getSpeedLevelLabel(localizations, level)
            : '-';
      } else {
        speedLabel = '${NumberFormatUtils.defaultFormat.formatInteger(fanChannel.speed.toInt())}%';
      }
      infoTiles.add(InfoTile(
        label: localizations.device_fan_speed,
        value: speedLabel,
      ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 3: ENVIRONMENTAL
    // ═══════════════════════════════════════════════════════════════════════

    // Temperature if available
    final tempChannel = _device.temperatureChannel;
    final currentTemp = tempChannel?.temperature;
    if (currentTemp != null) {
      infoTiles.add(InfoTile(
        label: localizations.device_current_temperature,
        value: NumberFormatUtils.defaultFormat.formatDecimal(
          currentTemp,
          decimalPlaces: 1,
        ),
        unit: '°C',
      ));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (infoTiles.isNotEmpty) ...[
          if (useVerticalLayout)
            ...infoTiles
                .expand((tile) => [
                      SizedBox(width: double.infinity, child: tile),
                      AppSpacings.spacingSmVertical,
                    ])
                .take(infoTiles.length * 2 - 1)
          else
            _buildInfoTilesRow(infoTiles),
          AppSpacings.spacingMdVertical,
        ],
        // Fan speed control if available (includes fan mode if present)
        if (fanChannel != null && fanChannel.hasSpeed)
          _buildFanSpeedControl(localizations, isDark, humidityColor, useVerticalLayout),
        // Oscillation / Swing tile - only show if fan has swing property
        if (fanChannel != null && fanChannel.hasSwing) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: Icons.sync,
            name: localizations.device_oscillation,
            status: fanChannel.swing
                ? localizations.on_state_on
                : localizations.on_state_off,
            isActive: fanChannel.swing,
            activeColor: humidityColor,
            onTileTap: () => _setFanSwing(!fanChannel.swing),
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: true,
          ),
          AppSpacings.spacingSmVertical,
        ],
        // Direction tile - only show if fan has direction property
        if (fanChannel != null && fanChannel.hasDirection) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: Icons.swap_vert,
            name: localizations.device_direction,
            status: fanChannel.direction != null
                ? FanUtils.getDirectionLabel(localizations, fanChannel.direction!)
                : '-',
            isActive: fanChannel.direction != null,
            activeColor: humidityColor,
            onTileTap: () {
              // Toggle between clockwise and counter_clockwise
              final newDirection =
                  fanChannel.direction == FanDirectionValue.clockwise
                      ? FanDirectionValue.counterClockwise
                      : FanDirectionValue.clockwise;
              _setFanDirection(newDirection);
            },
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: true,
          ),
          AppSpacings.spacingSmVertical,
        ],
        // Natural breeze tile - only show if fan has natural_breeze property
        if (fanChannel != null && fanChannel.hasNaturalBreeze) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: Icons.air,
            name: localizations.device_natural_breeze,
            status: fanChannel.naturalBreeze
                ? localizations.on_state_on
                : localizations.on_state_off,
            isActive: fanChannel.naturalBreeze,
            activeColor: humidityColor,
            onTileTap: () => _setFanNaturalBreeze(!fanChannel.naturalBreeze),
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: true,
          ),
          AppSpacings.spacingSmVertical,
        ],
        // Mist level control
        if (channel != null && channel.hasMistLevel) ...[
          if (channel.isMistLevelEnum)
            _buildMistLevelEnumControl(localizations, humidityColor, useVerticalLayout)
          else if (channel.isMistLevelNumeric)
            _buildMistLevelNumericControl(localizations, humidityColor, useVerticalLayout),
          AppSpacings.spacingSmVertical,
        ],
        // Warm mist toggle
        if (channel != null && channel.hasWarmMist) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: Icons.local_fire_department,
            name: localizations.humidifier_warm_mist,
            status: channel.warmMist
                ? localizations.on_state_on
                : localizations.on_state_off,
            isActive: channel.warmMist,
            activeColor: humidityColor,
            onTileTap: () =>
                _setWarmMist(!channel.warmMist),
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: true,
          ),
          AppSpacings.spacingSmVertical,
        ],
        // Child Lock
        if (channel != null && channel.hasLocked) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: Icons.lock,
            name: localizations.device_child_lock,
            status: channel.locked
                ? localizations.thermostat_lock_locked
                : localizations.thermostat_lock_unlocked,
            isActive: channel.locked,
            activeColor: humidityColor,
            onTileTap: () =>
                _setHumidifierLocked(!channel.locked),
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: true,
          ),
          AppSpacings.spacingSmVertical,
        ],
        // Timer
        if (channel != null && channel.hasTimer)
          _buildTimerControl(localizations, humidityColor, useVerticalLayout),
      ],
    );
  }

  Widget _buildInfoTilesRow(List<Widget> tiles) {
    if (tiles.isEmpty) return const SizedBox.shrink();

    // Max 3 tiles per row
    if (tiles.length <= 3) {
      return Row(
        children: tiles
            .expand(
                (tile) => [Expanded(child: tile), AppSpacings.spacingSmHorizontal])
            .take(tiles.length * 2 - 1)
            .toList(),
      );
    }

    // Split into rows of 3
    final rows = <Widget>[];
    for (var i = 0; i < tiles.length; i += 3) {
      final rowTiles = tiles.skip(i).take(3).toList();
      rows.add(Row(
        children: rowTiles
            .expand(
                (tile) => [Expanded(child: tile), AppSpacings.spacingSmHorizontal])
            .take(rowTiles.length * 2 - 1)
            .toList(),
      ));
      if (i + 3 < tiles.length) {
        rows.add(AppSpacings.spacingSmVertical);
      }
    }

    return Column(children: rows);
  }

  Widget _buildMistLevelEnumControl(
    AppLocalizations localizations,
    Color humidityColor,
    bool useCompactLayout,
  ) {
    final channel = _humidifierChannel;
    if (channel == null) return const SizedBox.shrink();

    final options = channel.availableMistLevelPresets
        .map((level) => ValueOption(
              value: level,
              label: HumidifierUtils.getMistLevelLabel(localizations, level),
            ))
        .toList();

    if (options.isEmpty) return const SizedBox.shrink();

    return ValueSelectorRow<HumidifierMistLevelLevelValue?>(
      currentValue: channel.mistLevelPreset,
      label: localizations.humidifier_mist_level,
      icon: Icons.water,
      sheetTitle: localizations.humidifier_mist_level,
      activeColor: humidityColor,
      options: options,
      displayFormatter: (l) => l != null
          ? HumidifierUtils.getMistLevelLabel(localizations, l)
          : localizations.humidifier_mist_level_off,
      isActiveValue: (level) =>
          level != null && level != HumidifierMistLevelLevelValue.off,
      columns: options.length > 4 ? 4 : options.length,
      layout: useCompactLayout
          ? ValueSelectorRowLayout.compact
          : ValueSelectorRowLayout.horizontal,
      onChanged: (level) {
        if (level != null) {
          _setMistLevelEnum(level);
        }
      },
    );
  }

  Widget _buildMistLevelNumericControl(
    AppLocalizations localizations,
    Color humidityColor,
    bool useCompactLayout,
  ) {
    final channel = _humidifierChannel;
    if (channel == null) return const SizedBox.shrink();

    final isOn = _device.isOn;
    final minLevel = channel.minMistLevel;
    final maxLevel = channel.maxMistLevel;
    final range = maxLevel - minLevel;
    if (range <= 0) return const SizedBox.shrink();

    // Always use ValueSelectorRow for mist level (simpler than custom slider for 3 levels)
    return ValueSelectorRow<double>(
      currentValue: _normalizedMistLevel,
      label: localizations.humidifier_mist_level,
      icon: Icons.water,
      sheetTitle: localizations.humidifier_mist_level,
      activeColor: humidityColor,
      options: [
        ValueOption(value: 0.0, label: localizations.humidifier_mist_level_low),
        ValueOption(value: 0.5, label: localizations.humidifier_mist_level_medium),
        ValueOption(value: 1.0, label: localizations.humidifier_mist_level_high),
      ],
      displayFormatter: (v) => _formatMistLevel(localizations, v),
      isActiveValue: (v) => v != null && v > 0,
      columns: 3,
      layout: useCompactLayout
          ? ValueSelectorRowLayout.compact
          : ValueSelectorRowLayout.horizontal,
      onChanged: isOn ? (v) => _setMistLevel(v ?? 0) : null,
    );
  }

  double get _normalizedMistLevel {
    final channel = _humidifierChannel;
    if (channel == null || !channel.hasMistLevel || !channel.isMistLevelNumeric) return 0.0;

    final mistLevelProp = channel.mistLevelProp;
    final controlState = _deviceControlStateService;

    double actualLevel = channel.mistLevel.toDouble();

    // Check for pending/optimistic value first
    if (mistLevelProp != null &&
        controlState != null &&
        controlState.isLocked(_device.id, channel.id, mistLevelProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channel.id,
        mistLevelProp.id,
      );
      if (desiredValue is num) {
        actualLevel = desiredValue.toDouble();
      }
    }

    final minLevel = channel.minMistLevel;
    final maxLevel = channel.maxMistLevel;
    final range = maxLevel - minLevel;
    if (range <= 0) return 0.0;
    return (actualLevel - minLevel) / range;
  }

  void _setMistLevel(double normalizedLevel) {
    final channel = _humidifierChannel;
    final mistLevelProp = channel?.mistLevelProp;
    if (channel == null || !channel.hasMistLevel || !channel.isMistLevelNumeric || mistLevelProp == null) return;

    // Convert normalized 0-1 value to actual device level range
    final minLevel = channel.minMistLevel;
    final maxLevel = channel.maxMistLevel;
    final range = maxLevel - minLevel;
    if (range <= 0) return;

    final actualLevel = (minLevel + (normalizedLevel * range)).round();

    // Clamp to valid range
    final clampedLevel = actualLevel.clamp(minLevel, maxLevel);

    // Set PENDING state immediately for responsive UI
    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      mistLevelProp.id,
      clampedLevel,
    );
    setState(() {});

    // Cancel any pending debounce timer
    _mistLevelDebounceTimer?.cancel();

    // Debounce the API call to avoid flooding backend
    _mistLevelDebounceTimer = Timer(_mistLevelDebounceDuration, () async {
      if (!mounted) return;

      await _setPropertyValue(mistLevelProp, clampedLevel);

      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          mistLevelProp.id,
        );
      }
    });
  }

  String _formatMistLevel(AppLocalizations localizations, double? level) {
    if (level == null || level <= 0.33) return localizations.humidifier_mist_level_low;
    if (level <= 0.66) return localizations.humidifier_mist_level;
    return localizations.humidifier_mist_level_high;
  }

  Widget _buildFanSpeedControl(
    AppLocalizations localizations,
    bool isDark,
    Color humidityColor,
    bool useVerticalLayout,
  ) {
    final fanChannel = _device.fanChannel;
    if (fanChannel == null || !fanChannel.hasSpeed) return const SizedBox.shrink();

    final hasMode = fanChannel.hasMode && fanChannel.availableModes.length > 1;

    if (fanChannel.isSpeedEnum) {
      // Enum-based speed (off, low, medium, high, etc.)
      final availableLevels = fanChannel.availableSpeedLevels;
      if (availableLevels.isEmpty) return const SizedBox.shrink();

      final options = availableLevels
          .map((level) => ValueOption(
                value: level,
                label: FanUtils.getSpeedLevelLabel(localizations, level),
              ))
          .toList();

      final speedWidget = ValueSelectorRow<FanSpeedLevelValue>(
        currentValue: fanChannel.speedLevel,
        label: localizations.device_fan_speed,
        icon: Icons.speed,
        sheetTitle: localizations.device_fan_speed,
        activeColor: humidityColor,
        options: options,
        displayFormatter: (level) => level != null
            ? FanUtils.getSpeedLevelLabel(localizations, level)
            : localizations.fan_speed_off,
        isActiveValue: (level) =>
            level != null && level != FanSpeedLevelValue.off,
        columns: availableLevels.length > 4 ? 3 : availableLevels.length,
        layout: useVerticalLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        onChanged: _device.isOn
            ? (level) {
                if (level != null) {
                  _setFanSpeedLevel(level);
                }
              }
            : null,
      );

      // If fan has mode, add mode selector below (always button since speed is button)
      if (hasMode) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            speedWidget,
            AppSpacings.spacingMdVertical,
            _buildFanModeControl(localizations, humidityColor, true),
          ],
        );
      }

      return Column(
        children: [
          speedWidget,
          AppSpacings.spacingSmVertical,
        ],
      );
    } else {
      // Numeric speed (0-100%)
      final minSpeed = fanChannel.minSpeed;
      final maxSpeed = fanChannel.maxSpeed;
      final range = maxSpeed - minSpeed;
      if (range <= 0) return const SizedBox.shrink();

      if (useVerticalLayout) {
        final speedWidget = ValueSelectorRow<double>(
          currentValue: _normalizedFanSpeed,
          label: localizations.device_fan_speed,
          icon: Icons.speed,
          sheetTitle: localizations.device_fan_speed,
          activeColor: humidityColor,
          options: _getFanSpeedOptions(localizations),
          displayFormatter: (v) => _formatFanSpeed(localizations, v),
          isActiveValue: (v) => v != null && v > 0,
          columns: 4,
          layout: ValueSelectorRowLayout.compact,
          onChanged: _device.isOn ? (v) => _setFanSpeed(v ?? 0) : null,
        );

        // If fan has mode, add mode selector below
        if (hasMode) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              speedWidget,
              AppSpacings.spacingMdVertical,
              _buildFanModeControl(localizations, humidityColor, useVerticalLayout),
            ],
          );
        }

        return Column(
          children: [
            speedWidget,
            AppSpacings.spacingSmVertical,
          ],
        );
      } else {
        // Use SpeedSlider widget for landscape layout
        // Mode selector goes inside the slider's bordered box as footer
        return SpeedSlider(
          value: _normalizedFanSpeed,
          activeColor: humidityColor,
          enabled: _device.isOn,
          steps: [
            localizations.fan_speed_off,
            localizations.fan_speed_low,
            localizations.fan_speed_medium,
            localizations.fan_speed_high,
          ],
          onChanged: _setFanSpeed,
          footer: hasMode
              ? _buildFanModeControl(localizations, humidityColor, false)
              : null,
        );
      }
    }
  }

  Widget _buildFanModeControl(
    AppLocalizations localizations,
    Color humidityColor,
    bool useCompactLayout,
  ) {
    final fanChannel = _device.fanChannel;
    if (fanChannel == null || !fanChannel.hasMode) return const SizedBox.shrink();

    final availableModes = fanChannel.availableModes;
    if (availableModes.length <= 1) return const SizedBox.shrink();

    // currentMode can be null if device is reset or sends invalid value
    final currentMode = fanChannel.mode;

    if (useCompactLayout) {
      final options = availableModes
          .map((mode) => ValueOption(
                value: mode,
                label: FanUtils.getModeLabel(localizations, mode),
              ))
          .toList();

      return ValueSelectorRow<FanModeValue>(
        currentValue: currentMode,
        label: localizations.device_fan_mode,
        icon: Icons.tune,
        sheetTitle: localizations.device_fan_mode,
        activeColor: humidityColor,
        options: options,
        displayFormatter: (mode) => mode != null
            ? FanUtils.getModeLabel(localizations, mode)
            : '-',
        isActiveValue: (mode) => mode != null,
        columns: availableModes.length > 4 ? 3 : availableModes.length,
        layout: ValueSelectorRowLayout.compact,
        onChanged: _device.isOn
            ? (mode) {
                if (mode != null) {
                  _setFanMode(mode);
                }
              }
            : null,
      );
    }

    return ModeSelector<FanModeValue>(
      modes: availableModes
          .map((mode) => ModeOption(
                value: mode,
                icon: FanUtils.getModeIcon(mode),
                label: FanUtils.getModeLabel(localizations, mode),
              ))
          .toList(),
      selectedValue: currentMode,
      onChanged: _setFanMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: ModeSelectorColor.teal,
      scrollable: true,
    );
  }

  double get _normalizedFanSpeed {
    final fanChannel = _device.fanChannel;
    if (fanChannel == null || !fanChannel.hasSpeed || !fanChannel.isSpeedNumeric) return 0.0;

    final speedProp = fanChannel.speedProp;
    final controlState = _deviceControlStateService;

    double actualSpeed = fanChannel.speed;

    // Check for pending/optimistic value first
    if (speedProp != null &&
        controlState != null &&
        controlState.isLocked(_device.id, fanChannel.id, speedProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        fanChannel.id,
        speedProp.id,
      );
      if (desiredValue is num) {
        actualSpeed = desiredValue.toDouble();
      }
    }

    final minSpeed = fanChannel.minSpeed;
    final maxSpeed = fanChannel.maxSpeed;
    final range = maxSpeed - minSpeed;
    if (range <= 0) return 0.0;
    return (actualSpeed - minSpeed) / range;
  }

  void _setFanSpeed(double normalizedSpeed) {
    final fanChannel = _device.fanChannel;
    final speedProp = fanChannel?.speedProp;
    if (fanChannel == null || !fanChannel.hasSpeed || !fanChannel.isSpeedNumeric || speedProp == null) return;

    // Convert normalized 0-1 value to actual device speed range
    final minSpeed = fanChannel.minSpeed;
    final maxSpeed = fanChannel.maxSpeed;
    final range = maxSpeed - minSpeed;
    if (range <= 0) return;

    final rawSpeed = minSpeed + (normalizedSpeed * range);

    // Round to step value (guard against division by zero)
    final step = fanChannel.speedStep;
    final steppedSpeed = step > 0 ? (rawSpeed / step).round() * step : rawSpeed;

    // Clamp to valid range
    final actualSpeed = steppedSpeed.clamp(minSpeed, maxSpeed);

    // Set PENDING state immediately for responsive UI
    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      speedProp.id,
      actualSpeed,
    );
    setState(() {});

    // Cancel any pending debounce timer
    _speedDebounceTimer?.cancel();

    // Debounce the API call to avoid flooding backend
    _speedDebounceTimer = Timer(_speedDebounceDuration, () async {
      if (!mounted) return;

      await _setPropertyValue(speedProp, actualSpeed);

      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          speedProp.id,
        );
      }
    });
  }

  List<ValueOption<double>> _getFanSpeedOptions(AppLocalizations localizations) {
    return [
      ValueOption(value: 0.0, label: localizations.fan_speed_off),
      ValueOption(value: 0.33, label: localizations.fan_speed_low),
      ValueOption(value: 0.66, label: localizations.fan_speed_medium),
      ValueOption(value: 1.0, label: localizations.fan_speed_high),
    ];
  }

  String _formatFanSpeed(AppLocalizations localizations, double? speed) {
    if (speed == null || speed == 0) return localizations.fan_speed_off;
    if (speed <= 0.33) return localizations.fan_speed_low;
    if (speed <= 0.66) return localizations.fan_speed_medium;
    return localizations.fan_speed_high;
  }

  Widget _buildTimerControl(
    AppLocalizations localizations,
    Color humidityColor,
    bool useCompactLayout,
  ) {
    final channel = _humidifierChannel;
    if (channel == null) return const SizedBox.shrink();

    if (channel.isTimerEnum) {
      final options = channel.availableTimerPresets
          .map((preset) => ValueOption(
                value: preset,
                label: HumidifierUtils.getTimerPresetLabel(localizations, preset),
              ))
          .toList();

      if (options.isEmpty) return const SizedBox.shrink();

      return ValueSelectorRow<HumidifierTimerPresetValue?>(
        currentValue: channel.timerPreset,
        label: localizations.device_timer,
        icon: Icons.timer_outlined,
        sheetTitle: localizations.device_timer,
        activeColor: humidityColor,
        options: options,
        displayFormatter: (p) => p != null
            ? HumidifierUtils.getTimerPresetLabel(localizations, p)
            : localizations.humidifier_timer_off,
        isActiveValue: (preset) =>
            preset != null && preset != HumidifierTimerPresetValue.off,
        columns: options.length > 4 ? 4 : options.length,
        layout: useCompactLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        onChanged: (preset) {
          if (preset != null) {
            _setHumidifierTimerPreset(preset);
          }
        },
      );
    } else {
      // Numeric timer in seconds
      final options = _getNumericTimerOptions(localizations, channel);
      if (options.isEmpty) return const SizedBox.shrink();

      return ValueSelectorRow<int>(
        currentValue: channel.timer,
        label: localizations.device_timer,
        icon: Icons.timer_outlined,
        sheetTitle: localizations.device_timer,
        activeColor: humidityColor,
        options: options,
        displayFormatter: (s) =>
            HumidifierUtils.formatSeconds(localizations, s ?? 0),
        isActiveValue: (seconds) => seconds != null && seconds > 0,
        columns: options.length > 4 ? 4 : options.length,
        layout: useCompactLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        onChanged: (seconds) {
          if (seconds != null) {
            _setHumidifierTimerNumeric(seconds);
          }
        },
      );
    }
  }

  List<ValueOption<int>> _getNumericTimerOptions(
    AppLocalizations localizations,
    HumidifierChannelView channel,
  ) {
    final minTimer = channel.minTimer;
    final maxTimer = channel.maxTimer;

    final options = <ValueOption<int>>[];
    options.add(ValueOption(
      value: 0,
      label: localizations.humidifier_timer_off,
    ));

    // Common presets in seconds
    final presets = [1800, 3600, 7200, 14400, 28800, 43200]; // 30m, 1h, 2h, 4h, 8h, 12h
    for (final preset in presets) {
      if (preset >= minTimer && preset <= maxTimer) {
        options.add(ValueOption(
          value: preset,
          label: HumidifierUtils.formatSeconds(localizations, preset),
        ));
      }
    }

    return options;
  }
}
