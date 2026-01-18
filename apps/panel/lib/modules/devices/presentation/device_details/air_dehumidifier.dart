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
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/dehumidifier_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/fan_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class AirDehumidifierDeviceDetail extends StatefulWidget {
  final AirDehumidifierDeviceView _device;
  final VoidCallback? onBack;

  const AirDehumidifierDeviceDetail({
    super.key,
    required AirDehumidifierDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<AirDehumidifierDeviceDetail> createState() =>
      _AirDehumidifierDeviceDetailState();
}

class _AirDehumidifierDeviceDetailState
    extends State<AirDehumidifierDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;

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
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AirDehumidifierDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }
  }

  @override
  void dispose() {
    _speedDebounceTimer?.cancel();
    _devicesService.removeListener(_onDeviceChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onDeviceChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  AirDehumidifierDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is AirDehumidifierDeviceView) {
      return updated;
    }
    return widget._device;
  }

  DehumidifierChannelView? get _dehumidifierChannel =>
      _device.dehumidifierChannel;

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

    final channel = _dehumidifierChannel;
    final isOn = _device.isOn;
    final measuredHumidity = _device.humidityChannel.humidity;
    final isDehumidifying = channel?.computeIsDehumidifying(
          currentHumidity: measuredHumidity,
        ) ??
        false;
    final targetHumidity = channel?.humidity ?? 0;

    String subtitle;
    if (isOn) {
      final statusText = isDehumidifying
          ? localizations.dehumidifier_status_dehumidifying
          : localizations.dehumidifier_status_idle;
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
              Icons.water_drop_outlined,
              color: isOn ? humidityColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
      trailing: GestureDetector(
        onTap: () => _setPropertyValue(channel?.onProp, !isOn),
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
    final channel = _dehumidifierChannel;
    if (channel == null) return const SizedBox.shrink();

    final isOn = _device.isOn;
    final targetHumidity = channel.humidity;

    // Validate min/max - CircularControlDial asserts maxValue > minValue
    var minHumidity = channel.minHumidity;
    var maxHumidity = channel.maxHumidity;
    if (minHumidity >= maxHumidity) {
      // Use safe defaults if API returns malformed data
      minHumidity = 0;
      maxHumidity = 100;
    }

    // Get current humidity from humidity channel
    final humidityChannel = _device.humidityChannel;
    final measuredHumidity = humidityChannel.humidity;
    final currentHumidity = measuredHumidity.toDouble();

    // Use fallback method to determine if actively dehumidifying
    final isDehumidifying = channel.computeIsDehumidifying(
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
      isActive: isDehumidifying,
      enabled: isOn,
      displayFormat: DialDisplayFormat.percentage,
      majorTickCount: 8,
      onChanged: (v) {
        final newHumidity = (v * 100).round();
        _setPropertyValue(channel.humidityProp, newHumidity);
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
    final channel = _dehumidifierChannel;
    if (channel == null || !channel.hasMode) return const SizedBox.shrink();

    final availableModes = channel.availableModes;
    if (availableModes.isEmpty) return const SizedBox.shrink();

    final currentMode = channel.mode;
    if (currentMode == null) return const SizedBox.shrink();

    return ModeSelector<DehumidifierModeValue>(
      modes: availableModes
          .map((mode) => ModeOption(
                value: mode,
                icon: DehumidifierUtils.getModeIcon(mode),
                label: DehumidifierUtils.getModeLabel(localizations, mode),
              ))
          .toList(),
      selectedValue: currentMode,
      onChanged: (mode) => _setPropertyValue(channel.modeProp, mode.value),
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: ModeSelectorColor.teal,
      scrollable: true,
    );
  }

  Widget _buildVerticalModeSelector(Color activeColor) {
    final localizations = AppLocalizations.of(context)!;
    final channel = _dehumidifierChannel;
    if (channel == null || !channel.hasMode) return const SizedBox.shrink();

    final availableModes = channel.availableModes;
    if (availableModes.isEmpty) return const SizedBox.shrink();

    final currentMode = channel.mode;
    if (currentMode == null) return const SizedBox.shrink();

    return ModeSelector<DehumidifierModeValue>(
      modes: availableModes
          .map((mode) => ModeOption(
                value: mode,
                icon: DehumidifierUtils.getModeIcon(mode),
                label: DehumidifierUtils.getModeLabel(localizations, mode),
              ))
          .toList(),
      selectedValue: currentMode,
      onChanged: (mode) => _setPropertyValue(channel.modeProp, mode.value),
      orientation: ModeSelectorOrientation.vertical,
      showLabels: false,
      color: ModeSelectorColor.teal,
      scrollable: true,
    );
  }

  Widget _buildStatus(bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final humidityColor = DeviceColors.humidity(isDark);
    final channel = _dehumidifierChannel;
    final fanChannel = _device.fanChannel;
    final useVerticalLayout = _screenService.isLandscape &&
        (_screenService.isSmallScreen || _screenService.isMediumScreen);

    final infoTiles = <Widget>[];

    // Current humidity from humidity channel (required per spec)
    final currentHumidity = _device.humidityChannel.humidity;
    infoTiles.add(InfoTile(
      label: localizations.device_current_humidity,
      value: NumberFormatUtils.defaultFormat.formatInteger(currentHumidity),
      unit: '%',
      valueColor: humidityColor,
    ));

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

    // Water tank level
    if (channel != null && channel.hasWaterTankLevel) {
      infoTiles.add(InfoTile(
        label: localizations.dehumidifier_water_tank,
        value: NumberFormatUtils.defaultFormat.formatInteger(channel.waterTankLevel),
        unit: '%',
        isWarning: channel.waterTankWarning,
      ));
    } else if (channel != null && channel.hasWaterTankFull) {
      infoTiles.add(InfoTile(
        label: localizations.dehumidifier_water_tank,
        value: channel.waterTankFull
            ? localizations.on_state_on
            : localizations.on_state_off,
        isWarning: channel.waterTankFull,
      ));
    }

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
        // Fan speed control if available
        if (fanChannel != null && fanChannel.hasSpeed)
          _buildFanSpeedControl(localizations, humidityColor, useVerticalLayout),
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
            onTileTap: () => _setPropertyValue(channel.lockedProp, !channel.locked),
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
            .expand((tile) => [Expanded(child: tile), AppSpacings.spacingSmHorizontal])
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
            .expand((tile) => [Expanded(child: tile), AppSpacings.spacingSmHorizontal])
            .take(rowTiles.length * 2 - 1)
            .toList(),
      ));
      if (i + 3 < tiles.length) {
        rows.add(AppSpacings.spacingSmVertical);
      }
    }

    return Column(children: rows);
  }

  Widget _buildFanSpeedControl(
    AppLocalizations localizations,
    Color humidityColor,
    bool useVerticalLayout,
  ) {
    final fanChannel = _device.fanChannel;
    if (fanChannel == null || !fanChannel.hasSpeed) return const SizedBox.shrink();

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

      return Column(
        children: [
          ValueSelectorRow<FanSpeedLevelValue>(
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
                      _setPropertyValue(fanChannel.speedProp, level.value);
                    }
                  }
                : null,
          ),
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
        return Column(
          children: [
            ValueSelectorRow<double>(
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
            ),
            AppSpacings.spacingSmVertical,
          ],
        );
      } else {
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
        );
      }
    }
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
    final channel = _dehumidifierChannel;
    if (channel == null) return const SizedBox.shrink();

    if (channel.isTimerEnum) {
      final options = channel.availableTimerPresets
          .map((preset) => ValueOption(
                value: preset,
                label: DehumidifierUtils.getTimerPresetLabel(localizations, preset),
              ))
          .toList();

      if (options.isEmpty) return const SizedBox.shrink();

      return ValueSelectorRow<DehumidifierTimerPresetValue?>(
        currentValue: channel.timerPreset,
        label: localizations.device_timer,
        icon: Icons.timer_outlined,
        sheetTitle: localizations.device_timer,
        activeColor: humidityColor,
        options: options,
        displayFormatter: (p) => p != null
            ? DehumidifierUtils.getTimerPresetLabel(localizations, p)
            : localizations.dehumidifier_timer_off,
        isActiveValue: (preset) =>
            preset != null && preset != DehumidifierTimerPresetValue.off,
        columns: options.length > 4 ? 4 : options.length,
        layout: useCompactLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        onChanged: (preset) {
          if (preset != null) {
            _setPropertyValue(channel.timerProp, preset.value);
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
            DehumidifierUtils.formatSeconds(localizations, s ?? 0),
        isActiveValue: (seconds) => seconds != null && seconds > 0,
        columns: options.length > 4 ? 4 : options.length,
        layout: useCompactLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        onChanged: (seconds) {
          if (seconds != null) {
            _setPropertyValue(channel.timerProp, seconds);
          }
        },
      );
    }
  }

  List<ValueOption<int>> _getNumericTimerOptions(
    AppLocalizations localizations,
    DehumidifierChannelView channel,
  ) {
    final minTimer = channel.minTimer;
    final maxTimer = channel.maxTimer;

    final options = <ValueOption<int>>[];
    options.add(ValueOption(
      value: 0,
      label: localizations.dehumidifier_timer_off,
    ));

    // Common presets in seconds
    final presets = [1800, 3600, 7200, 14400, 28800, 43200]; // 30m, 1h, 2h, 4h, 8h, 12h
    for (final preset in presets) {
      if (preset >= minTimer && preset <= maxTimer) {
        options.add(ValueOption(
          value: preset,
          label: DehumidifierUtils.formatSeconds(localizations, preset),
        ));
      }
    }

    return options;
  }
}
