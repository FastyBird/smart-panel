import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/button_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/fixed_grid_size_grid.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart'
    hide IntentOverlayService;
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// ============================================================================
// Climate Device Type Classification
// ============================================================================

/// Classification of climate devices for UI rendering
enum ClimateDeviceType {
  thermostat,
  heater,
  cooler,
  fan,
  humidifier,
  dehumidifier,
  purifier,
}

/// Get the climate device type from a device view
ClimateDeviceType? getClimateDeviceType(DeviceView device) {
  if (device is ThermostatDeviceView) return ClimateDeviceType.thermostat;
  if (device is HeaterDeviceView) return ClimateDeviceType.heater;
  if (device is AirConditionerDeviceView) return ClimateDeviceType.cooler;
  if (device is FanDeviceView) return ClimateDeviceType.fan;
  if (device is AirHumidifierDeviceView) return ClimateDeviceType.humidifier;
  if (device is AirDehumidifierDeviceView) return ClimateDeviceType.dehumidifier;
  if (device is AirPurifierDeviceView) return ClimateDeviceType.purifier;
  return null;
}

/// Get icon for climate device type
IconData getClimateDeviceIcon(ClimateDeviceType type) {
  switch (type) {
    case ClimateDeviceType.thermostat:
      return MdiIcons.thermostat;
    case ClimateDeviceType.heater:
      return MdiIcons.fireCircle;
    case ClimateDeviceType.cooler:
      return MdiIcons.snowflake;
    case ClimateDeviceType.fan:
      return MdiIcons.fan;
    case ClimateDeviceType.humidifier:
      return MdiIcons.airHumidifier;
    case ClimateDeviceType.dehumidifier:
      return MdiIcons.airHumidifierOff;
    case ClimateDeviceType.purifier:
      return MdiIcons.airPurifier;
  }
}

// ============================================================================
// Climate Domain Page
// ============================================================================

/// Climate domain page - displays climate devices with temperature controls.
///
/// Features:
/// - Device tiles showing current temperature and status
/// - Toggle controls for on/off devices (fans, etc.)
/// - Temperature setpoint adjustment for thermostats/heaters
/// - Tap to open device detail page
class ClimateDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const ClimateDomainViewPage({super.key, required this.viewItem});

  @override
  State<ClimateDomainViewPage> createState() => _ClimateDomainViewPageState();
}

class _ClimateDomainViewPageState extends State<ClimateDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  DeckService? _deckService;
  DevicesService? _devicesService;
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;

  // Track which devices are currently being toggled (prevents double-taps)
  final Set<String> _togglingDevices = {};

  String get _roomId => widget.viewItem.roomId;

  /// Climate device categories
  static const List<DevicesModuleDeviceCategory> _climateCategories = [
    DevicesModuleDeviceCategory.thermostat,
    DevicesModuleDeviceCategory.heater,
    DevicesModuleDeviceCategory.airConditioner,
    DevicesModuleDeviceCategory.fan,
    DevicesModuleDeviceCategory.airHumidifier,
    DevicesModuleDeviceCategory.airDehumidifier,
    DevicesModuleDeviceCategory.airPurifier,
  ];

  @override
  void initState() {
    super.initState();

    try {
      _deckService = locator<DeckService>();
    } catch (e) {
      if (kDebugMode) debugPrint('[ClimateDomainView] Failed to get DeckService: $e');
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDevicesDataChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[ClimateDomainView] Failed to get DevicesService: $e');
    }

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentDataChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[ClimateDomainView] Failed to get IntentOverlayService: $e');
    }

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[ClimateDomainView] Failed to get DeviceControlStateService: $e');
    }
  }

  @override
  void dispose() {
    _devicesService?.removeListener(_onDevicesDataChanged);
    _intentOverlayService?.removeListener(_onIntentDataChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);

    super.dispose();
  }

  void _onDevicesDataChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _onIntentDataChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  /// Get climate devices for the current room
  List<DeviceView> _getClimateDevices() {
    final devicesService = _devicesService;
    if (devicesService == null) return [];

    return devicesService
        .getDevicesForRoom(_roomId)
        .where((device) => _climateCategories.contains(device.category))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final devicesService = _devicesService;

    return Scaffold(
      appBar: AppTopBar(
        title: widget.viewItem.title,
        icon: DomainType.climate.icon,
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final bodyHeight = constraints.maxHeight;

            if (devicesService == null) {
              return _buildEmptyState(context);
            }

            final climateDevices = _getClimateDevices();

            if (climateDevices.isEmpty) {
              return _buildEmptyState(context);
            }

            return SingleChildScrollView(
              padding: AppSpacings.paddingMd,
              child: _buildDeviceGrid(
                context,
                climateDevices,
                devicesService,
                bodyHeight,
              ),
            );
          },
        ),
      ),
    );
  }

  /// Build empty state when no climate devices
  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.thermometerOff,
            size: _screenService.scale(
              80,
              density: _visualDensityService.density,
            ),
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5),
          ),
          AppSpacings.spacingLgVertical,
          Text(
            'No climate devices',
            style: TextStyle(
              fontSize: AppFontSize.extraLarge,
              fontWeight: FontWeight.bold,
            ),
          ),
          AppSpacings.spacingSmVertical,
          Text(
            'Add climate devices to this room to control them here',
            style: TextStyle(
              fontSize: AppFontSize.base,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  /// Build grid of device tiles
  Widget _buildDeviceGrid(
    BuildContext context,
    List<DeviceView> devices,
    DevicesService devicesService,
    double bodyHeight,
  ) {
    final display = _deckService?.display;
    final cols = (display?.cols ?? 4).clamp(2, 100);
    final rows = (display?.rows ?? 6).clamp(1, 100);

    // Calculate cell height based on body height and display rows
    final cellHeight = bodyHeight / rows;

    // Tile sizing: 2x2 default
    const int tileColSpan = 2;
    const int tileRowSpan = 2;
    final int tilesPerRow = (cols / 2).floor().clamp(1, cols);

    // Calculate how many rows we need for the device tiles
    final totalRows = (devices.length / tilesPerRow).ceil();
    final gridRows = totalRows * tileRowSpan;

    // Build grid items
    final List<FixedGridSizeGridItem> gridItems = [];
    for (int i = 0; i < devices.length; i++) {
      final row = i ~/ tilesPerRow;
      final col = i % tilesPerRow;

      gridItems.add(
        FixedGridSizeGridItem(
          mainAxisIndex: row * tileRowSpan + 1,
          crossAxisIndex: col * tileColSpan + 1,
          mainAxisCellCount: tileRowSpan,
          crossAxisCellCount: tileColSpan,
          child: _buildDeviceTile(
            context,
            devices[i],
            devicesService,
          ),
        ),
      );
    }

    // Calculate grid height
    final gridHeight = gridRows * cellHeight;

    return SizedBox(
      height: gridHeight,
      child: FixedGridSizeGrid(
        mainAxisSize: gridRows,
        crossAxisSize: cols,
        children: gridItems,
      ),
    );
  }

  /// Build a single device tile
  Widget _buildDeviceTile(
    BuildContext context,
    DeviceView device,
    DevicesService devicesService,
  ) {
    final deviceType = getClimateDeviceType(device);
    final isToggling = _togglingDevices.contains(device.id);

    // Determine if device is "on" based on type
    final bool isOn = _getDeviceOnState(device);

    // Get status text based on device type
    final String statusText = _getDeviceStatusText(context, device);

    // Get temperature display if available
    final String? temperatureText = _getTemperatureDisplay(device);

    return ButtonTileBox(
      onTap: isToggling ? null : () => _openDeviceDetail(context, device),
      isOn: isOn,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final iconSize = (constraints.maxHeight / 2) - AppSpacings.pSm;

          return Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Icon with toggle on tap for toggleable devices
              _buildDeviceIcon(
                context,
                device,
                deviceType,
                iconSize,
                isOn,
                isToggling,
                devicesService,
              ),
              AppSpacings.spacingSmVertical,
              // Device name
              ButtonTileTitle(
                title: device.name,
                isOn: isOn,
              ),
              AppSpacings.spacingXsVertical,
              // Status / temperature
              ButtonTileSubTitle(
                subTitle: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (temperatureText != null) ...[
                      Icon(
                        MdiIcons.thermometer,
                        size: AppFontSize.extraSmall,
                      ),
                      SizedBox(width: 2),
                      Text(temperatureText),
                      if (statusText.isNotEmpty) ...[
                        AppSpacings.spacingSmHorizontal,
                      ],
                    ],
                    if (statusText.isNotEmpty) Text(statusText),
                  ],
                ),
                isOn: isOn,
              ),
            ],
          );
        },
      ),
    );
  }

  /// Build device icon with optional toggle behavior
  Widget _buildDeviceIcon(
    BuildContext context,
    DeviceView device,
    ClimateDeviceType? deviceType,
    double iconSize,
    bool isOn,
    bool isToggling,
    DevicesService devicesService,
  ) {
    final icon = deviceType != null
        ? getClimateDeviceIcon(deviceType)
        : MdiIcons.thermometer;

    // Check if device can be toggled
    final canToggle = _canToggleDevice(device);

    return ButtonTileIcon(
      icon: icon,
      onTap: (canToggle && !isToggling)
          ? () => _toggleDevice(context, device, devicesService)
          : null,
      isOn: isOn,
      rawIconSize: iconSize,
    );
  }

  /// Check if device can be toggled on/off
  bool _canToggleDevice(DeviceView device) {
    if (device is FanDeviceView) {
      return device.fanChannel.onProp?.isWritable ?? false;
    }
    if (device is AirHumidifierDeviceView) {
      // AirHumidifier uses switcherChannel for on/off
      return device.switcherChannel.onProp?.isWritable ?? false;
    }
    if (device is AirPurifierDeviceView) {
      // AirPurifier uses fanChannel for on/off
      return device.fanChannel.onProp?.isWritable ?? false;
    }
    // AirDehumidifier, thermostats, heaters, and coolers typically don't have simple on/off
    return false;
  }

  /// Get the on/off state of a device
  bool _getDeviceOnState(DeviceView device) {
    // Check device control state service for optimistic UI state first
    final controlStateService = _deviceControlStateService;

    if (device is ThermostatDeviceView) {
      return device.isOn;
    }
    if (device is HeaterDeviceView) {
      return device.isOn;
    }
    if (device is AirConditionerDeviceView) {
      return device.isOn;
    }
    if (device is FanDeviceView) {
      final onProp = device.fanChannel.onProp;
      if (onProp != null && controlStateService != null) {
        if (controlStateService.isLocked(
          device.id,
          device.fanChannel.id,
          onProp.id,
        )) {
          final desiredValue = controlStateService.getDesiredValue(
            device.id,
            device.fanChannel.id,
            onProp.id,
          );
          if (desiredValue is bool) return desiredValue;
        }
      }
      return device.isOn;
    }
    if (device is AirHumidifierDeviceView) {
      // Check optimistic UI state for switcher channel
      final onProp = device.switcherChannel.onProp;
      if (onProp != null && controlStateService != null) {
        if (controlStateService.isLocked(
          device.id,
          device.switcherChannel.id,
          onProp.id,
        )) {
          final desiredValue = controlStateService.getDesiredValue(
            device.id,
            device.switcherChannel.id,
            onProp.id,
          );
          if (desiredValue is bool) return desiredValue;
        }
      }
      return device.isOn;
    }
    if (device is AirDehumidifierDeviceView) {
      return device.isOn;
    }
    if (device is AirPurifierDeviceView) {
      // Check optimistic UI state for fan channel
      final onProp = device.fanChannel.onProp;
      if (onProp != null && controlStateService != null) {
        if (controlStateService.isLocked(
          device.id,
          device.fanChannel.id,
          onProp.id,
        )) {
          final desiredValue = controlStateService.getDesiredValue(
            device.id,
            device.fanChannel.id,
            onProp.id,
          );
          if (desiredValue is bool) return desiredValue;
        }
      }
      return device.isOn;
    }

    return false;
  }

  /// Get status text for device
  String _getDeviceStatusText(BuildContext context, DeviceView device) {
    final localizations = AppLocalizations.of(context);

    if (device is ThermostatDeviceView) {
      final mode = device.thermostatMode;
      return mode.name;
    }
    if (device is HeaterDeviceView) {
      return device.isOn
          ? (localizations?.thermostat_state_heating ?? 'Heating')
          : (localizations?.thermostat_state_idling ?? 'Idle');
    }
    if (device is AirConditionerDeviceView) {
      return device.isOn
          ? (localizations?.thermostat_state_cooling ?? 'Cooling')
          : (localizations?.thermostat_state_idling ?? 'Idle');
    }
    if (device is FanDeviceView) {
      return device.isOn
          ? (localizations?.on_state_on ?? 'On')
          : (localizations?.on_state_off ?? 'Off');
    }
    if (device is AirHumidifierDeviceView) {
      return device.isOn
          ? (localizations?.on_state_on ?? 'On')
          : (localizations?.on_state_off ?? 'Off');
    }
    if (device is AirDehumidifierDeviceView) {
      return device.isOn
          ? (localizations?.on_state_on ?? 'On')
          : (localizations?.on_state_off ?? 'Off');
    }
    if (device is AirPurifierDeviceView) {
      return device.isOn
          ? (localizations?.on_state_on ?? 'On')
          : (localizations?.on_state_off ?? 'Off');
    }

    return '';
  }

  /// Get temperature display text
  String? _getTemperatureDisplay(DeviceView device) {
    double? temperature;
    String unit = '°C';

    if (device is ThermostatDeviceView) {
      temperature = device.temperatureChannel.temperature;
      if (device.thermostatChannel.showInFahrenheit) {
        unit = '°F';
      }
    } else if (device is HeaterDeviceView) {
      temperature = device.heaterChannel.temperature;
    } else if (device is AirConditionerDeviceView) {
      temperature = device.temperatureChannel.temperature;
    }

    if (temperature != null) {
      return '${temperature.toStringAsFixed(1)}$unit';
    }

    return null;
  }

  /// Toggle device on/off state
  Future<void> _toggleDevice(
    BuildContext context,
    DeviceView device,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);
    final controlStateService = _deviceControlStateService;

    // Get the property to toggle
    String? channelId;
    String? propertyId;
    bool currentState = false;

    if (device is FanDeviceView) {
      final onProp = device.fanChannel.onProp;
      if (onProp != null && onProp.isWritable) {
        channelId = device.fanChannel.id;
        propertyId = onProp.id;
        currentState = device.fanChannel.on;
      }
    } else if (device is AirHumidifierDeviceView) {
      // AirHumidifier uses switcherChannel for on/off
      final onProp = device.switcherChannel.onProp;
      if (onProp != null && onProp.isWritable) {
        channelId = device.switcherChannel.id;
        propertyId = onProp.id;
        currentState = device.switcherChannel.on;
      }
    } else if (device is AirPurifierDeviceView) {
      // AirPurifier uses fanChannel for on/off
      final onProp = device.fanChannel.onProp;
      if (onProp != null && onProp.isWritable) {
        channelId = device.fanChannel.id;
        propertyId = onProp.id;
        currentState = device.fanChannel.on;
      }
    }

    if (channelId == null || propertyId == null) return;

    final newState = !currentState;

    // Set pending state for optimistic UI
    if (kDebugMode) {
      debugPrint(
        '[CLIMATE DOMAIN] _toggleDevice: Setting PENDING state for ${device.name} to $newState',
      );
    }
    controlStateService?.setPending(
      device.id,
      channelId,
      propertyId,
      newState,
    );
    setState(() {
      _togglingDevices.add(device.id);
    });

    // Create local optimistic overlay
    _intentOverlayService?.createLocalOverlay(
      deviceId: device.id,
      channelId: channelId,
      propertyId: propertyId,
      value: newState,
      ttlMs: 5000,
    );

    try {
      // Get display ID
      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: _roomId,
      );

      final success = await devicesService.setMultiplePropertyValues(
        properties: [
          PropertyCommandItem(
            deviceId: device.id,
            channelId: channelId,
            propertyId: propertyId,
            value: newState,
          ),
        ],
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          this.context,
          message: localizations?.action_failed ?? 'Failed to toggle device',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        this.context,
        message: localizations?.action_failed ?? 'Failed to toggle device',
      );
    } finally {
      setState(() {
        _togglingDevices.remove(device.id);
      });

      if (mounted) {
        if (kDebugMode) {
          debugPrint(
            '[CLIMATE DOMAIN] _toggleDevice: Transitioning to SETTLING state for ${device.name}',
          );
        }
        controlStateService?.setSettling(
          device.id,
          channelId,
          propertyId,
        );
      }
    }
  }

  /// Open device detail page
  void _openDeviceDetail(BuildContext context, DeviceView device) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(device.id),
      ),
    );
  }
}
