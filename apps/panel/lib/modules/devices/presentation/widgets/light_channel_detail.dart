import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_mode_navigation.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_state_display.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart'
    show DeviceControlStateService;
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Full-page detail view for a single light channel.
///
/// Used when tapping on a channel tile in a multi-channel device.
/// Has the same layout pattern as role detail:
/// - Two-column layout with state display on left, slider on right
/// - Bottom navigation for mode switching
class LightChannelDetailPage extends StatefulWidget {
  /// The parent device
  final LightingDeviceView device;

  /// The channel to display
  final LightChannelView channel;

  const LightChannelDetailPage({
    super.key,
    required this.device,
    required this.channel,
  });

  @override
  State<LightChannelDetailPage> createState() => _LightChannelDetailPageState();
}

class _LightChannelDetailPageState extends State<LightChannelDetailPage> {
  final PropertyValueHelper _valueHelper = PropertyValueHelper();
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService = locator<VisualDensityService>();

  DeviceControlStateService? _deviceControlStateService;
  IntentOverlayService? _intentOverlayService;
  ChannelPropertiesRepository? _channelPropertiesRepository;
  DevicesService? _devicesService;

  late List<LightMode> _availableModes;
  late LightMode _currentMode;
  
  // Store fresh views from service
  LightingDeviceView? _currentDevice;
  LightChannelView? _currentChannel;

  @override
  void initState() {
    super.initState();

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightChannelDetailPage] Failed to get DeviceControlStateService: $e');
    }

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightChannelDetailPage] Failed to get IntentOverlayService: $e');
    }

    try {
      _channelPropertiesRepository = locator<ChannelPropertiesRepository>();
      _channelPropertiesRepository?.addListener(_onPropertyValueChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightChannelDetailPage] Failed to get ChannelPropertiesRepository: $e');
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDevicesServiceChanged);
      _updateViewsFromService();
    } catch (e) {
      if (kDebugMode) debugPrint('[LightChannelDetailPage] Failed to get DevicesService: $e');
    }

    _availableModes = LightModeNavigation.createModesList(
      hasBrightness: _getChannel().hasBrightness,
      hasColor: _getChannel().hasColor,
      hasTemperature: _getChannel().hasTemperature,
      hasWhite: _getChannel().hasColorWhite,
    );

    // Start with brightness mode if available, otherwise first available
    if (_availableModes.contains(LightMode.brightness)) {
      _currentMode = LightMode.brightness;
    } else if (_availableModes.length > 1) {
      _currentMode = _availableModes[1];
    } else {
      _currentMode = LightMode.off;
    }
  }

  @override
  void dispose() {
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    _intentOverlayService?.removeListener(_onIntentChanged);
    _channelPropertiesRepository?.removeListener(_onPropertyValueChanged);
    _devicesService?.removeListener(_onDevicesServiceChanged);
    super.dispose();
  }

  /// Get fresh views from service or fall back to widget values
  void _updateViewsFromService() {
    if (_devicesService == null) {
      _currentDevice = widget.device;
      _currentChannel = widget.channel;
      return;
    }

    final device = _devicesService!.getDevice(widget.device.id);
    if (device is LightingDeviceView) {
      _currentDevice = device;
      final channel = device.lightChannels.firstWhere(
        (ch) => ch.id == widget.channel.id,
        orElse: () => widget.channel,
      );
      _currentChannel = channel;
    } else {
      _currentDevice = widget.device;
      _currentChannel = widget.channel;
    }
  }

  /// Get the current channel (from service if available, otherwise from widget)
  LightChannelView _getChannel() {
    return _currentChannel ?? widget.channel;
  }

  /// Get the current device (from service if available, otherwise from widget)
  LightingDeviceView _getDevice() {
    return _currentDevice ?? widget.device;
  }

  void _onDevicesServiceChanged() {
    if (!mounted) return;
    _updateViewsFromService();
    setState(() {});
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _onIntentChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void didUpdateWidget(covariant LightChannelDetailPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Rebuild when channel parameter changes (e.g., when device service rebuilds views)
    if (oldWidget.channel.id != widget.channel.id ||
        oldWidget.device.id != widget.device.id) {
      setState(() {});
    } else {
      // Even if IDs are the same, rebuild to reflect any property value changes
      setState(() {});
    }
  }

  void _onPropertyValueChanged() {
    if (!mounted) return;

    final controlStateService = _deviceControlStateService;
    final channelPropertiesRepository = _channelPropertiesRepository;
    if (controlStateService == null || channelPropertiesRepository == null) {
      setState(() {});
      return;
    }

    final device = _getDevice();
    final channel = _getChannel();
    final deviceId = device.id;
    final channelId = channel.id;

    // Check on/off property - only clear if in SETTLING state and value matches
    final onProp = channel.onProp;
    final onState = controlStateService.getState(deviceId, channelId, onProp.id);
    if (onState != null && onState.isSettling) {
      final property = channelPropertiesRepository.getItem(onProp.id);
      if (property != null) {
        final actualValue = property.value is BooleanValueType
            ? (property.value as BooleanValueType).value
            : (property.value is NumberValueType
                ? (property.value as NumberValueType).value > 0.5
                : false);
        final desiredValue = onState.desiredValue is bool
            ? onState.desiredValue as bool
            : (onState.desiredValue is num ? (onState.desiredValue as num) > 0.5 : false);
        
        if (actualValue == desiredValue) {
          // Value matches during settling, clear the state early
          controlStateService.clear(deviceId, channelId, onProp.id);
        }
      }
    }

    // Check brightness property - only clear if in SETTLING state and value matches
    final brightnessProp = channel.brightnessProp;
    if (brightnessProp != null) {
      final brightnessState = controlStateService.getState(deviceId, channelId, brightnessProp.id);
      if (brightnessState != null && brightnessState.isSettling) {
        final property = channelPropertiesRepository.getItem(brightnessProp.id);
        if (property != null && property.value is NumberValueType) {
          final actualValue = (property.value as NumberValueType).value;
          final desiredValue = brightnessState.desiredValue is num
              ? (brightnessState.desiredValue as num).toDouble()
              : null;
          
          if (desiredValue != null && (actualValue - desiredValue).abs() < 2.0) {
            // Value matches (within 2 unit tolerance for rounding), clear the state
            controlStateService.clear(deviceId, channelId, brightnessProp.id);
          }
        }
      }
    }

    // Check temperature property - only clear if in SETTLING state and value matches
    final temperatureProp = channel.temperatureProp;
    if (temperatureProp != null) {
      final temperatureState = controlStateService.getState(deviceId, channelId, temperatureProp.id);
      if (temperatureState != null && temperatureState.isSettling) {
        final property = channelPropertiesRepository.getItem(temperatureProp.id);
        if (property != null && property.value is NumberValueType) {
          final actualValue = (property.value as NumberValueType).value;
          final desiredValue = temperatureState.desiredValue is num
              ? (temperatureState.desiredValue as num).toDouble()
              : null;
          
          if (desiredValue != null && (actualValue - desiredValue).abs() < 10.0) {
            // Value matches (within 10 unit tolerance for temperature), clear the state
            controlStateService.clear(deviceId, channelId, temperatureProp.id);
          }
        }
      }
    }

    // Check white channel property - only clear if in SETTLING state and value matches
    final whiteProp = channel.colorWhiteProp;
    if (whiteProp != null) {
      final whiteState = controlStateService.getState(deviceId, channelId, whiteProp.id);
      if (whiteState != null && whiteState.isSettling) {
        final property = channelPropertiesRepository.getItem(whiteProp.id);
        if (property != null && property.value is NumberValueType) {
          final actualValue = (property.value as NumberValueType).value;
          final desiredValue = whiteState.desiredValue is num
              ? (whiteState.desiredValue as num).toDouble()
              : null;
          
          if (desiredValue != null && (actualValue - desiredValue).abs() < 2.0) {
            // Value matches, clear the state
            controlStateService.clear(deviceId, channelId, whiteProp.id);
          }
        }
      }
    }

    // Always rebuild to reflect property value changes (even if we didn't clear state)
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final channel = _getChannel();
    final isSimple = !channel.hasBrightness &&
        !channel.hasColor &&
        !channel.hasTemperature &&
        !channel.hasColorWhite;

    final device = _getDevice();
    final localizations = AppLocalizations.of(context);

    // Simple device with single channel: just ON/OFF
    if (isSimple) {
      return Scaffold(
        appBar: AppTopBar(
          title: channel.name,
          icon: buildDeviceIcon(device.category, device.icon),
          actions: _buildHeaderActions(context, device, localizations),
        ),
        body: _buildSimpleDeviceLayout(context),
      );
    }

    // Single channel with capabilities
    return Scaffold(
      appBar: AppTopBar(
        title: channel.name,
        icon: buildDeviceIcon(device.category, device.icon),
        actions: _buildHeaderActions(context, device, localizations),
      ),
      body: _buildSingleChannelLayout(context),
    );
  }

  /// Layout for simple ON/OFF devices with single channel - two-column with large switch
  Widget _buildSimpleDeviceLayout(BuildContext context) {
    final channel = _getChannel();
    final device = _getDevice();

    // Check control state service for optimistic on/off state
    bool isOn = channel.on;
    final controlStateService = _deviceControlStateService;
    final deviceId = device.id;
    final channelId = channel.id;
    final onProp = channel.onProp;

    if (controlStateService != null &&
        controlStateService.isLocked(deviceId, channelId, onProp.id)) {
      // Use desired value from control state service (immediate, no listener delay)
      final desiredValue = controlStateService.getDesiredValue(
        deviceId,
        channelId,
        onProp.id,
      );
      if (desiredValue is bool) {
        isOn = desiredValue;
      } else if (desiredValue is num) {
        isOn = desiredValue > 0.5;
      }
    } else if (_intentOverlayService != null) {
      // Fall back to overlay service (for failures, backend intents, etc.)
      if (_intentOverlayService!.isPropertyLocked(
            deviceId,
            channelId,
            onProp.id,
          )) {
        final overlayValue = _intentOverlayService!.getOverlayValue(
          deviceId,
          channelId,
          onProp.id,
        );
        if (overlayValue is bool) {
          isOn = overlayValue;
        }
      }
    }

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
                      anyOn: isOn, // Use optimistic state
                      hasBrightness: false,
                      useSingular: true,
                    ),
                  ),
                ),
                // Right: Large switch
                ColoredSwitch(
                  switchState: isOn, // Use optimistic state
                  iconOn: MdiIcons.power,
                  iconOff: MdiIcons.power,
                  trackWidth: elementMaxSize,
                  vertical: true,
                  onChanged: (value) => _toggleChannel(value),
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
    final channel = _getChannel();
    final device = _getDevice();

    // Check control state service for optimistic on/off state
    bool isOn = channel.on;
    final controlStateService = _deviceControlStateService;
    final deviceId = device.id;
    final channelId = channel.id;
    final onProp = channel.onProp;

    if (controlStateService != null &&
        controlStateService.isLocked(deviceId, channelId, onProp.id)) {
      // Use desired value from control state service (immediate, no listener delay)
      final desiredValue = controlStateService.getDesiredValue(
        deviceId,
        channelId,
        onProp.id,
      );
      if (desiredValue is bool) {
        isOn = desiredValue;
      } else if (desiredValue is num) {
        isOn = desiredValue > 0.5;
      }
    } else if (_intentOverlayService != null) {
      // Fall back to overlay service (for failures, backend intents, etc.)
      if (_intentOverlayService!.isPropertyLocked(
            deviceId,
            channelId,
            onProp.id,
          )) {
        final overlayValue = _intentOverlayService!.getOverlayValue(
          deviceId,
          channelId,
          onProp.id,
        );
        if (overlayValue is bool) {
          isOn = overlayValue;
        }
      }
    }

    return Column(
      children: [
        Expanded(
          child: SafeArea(
            bottom: false,
            child: LightSingleChannelDetail(
              device: device,
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
              anyOn: isOn, // Use optimistic state
              onModeSelected: (mode) {
                setState(() {
                  _currentMode = mode;
                });
                // Turn on if selecting a control mode while off
                if (!isOn && mode != LightMode.off) {
                  _toggleChannel(true);
                }
              },
              onPowerToggle: () => _toggleChannel(!isOn),
            ),
          ),
      ],
    );
  }

  /// Build header actions (offline indicator and close button)
  List<Widget> _buildHeaderActions(
    BuildContext context,
    LightingDeviceView device,
    AppLocalizations? localizations,
  ) {
    final actions = <Widget>[];

    // Offline indicator
    if (!device.isOnline) {
      actions.add(
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              MdiIcons.alert,
              size: _screenService.scale(
                14,
                density: _visualDensityService.density,
              ),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.warning
                  : AppColorsDark.warning,
            ),
            SizedBox(
              width: _screenService.scale(
                4,
                density: _visualDensityService.density,
              ),
            ),
            Text(
              localizations?.device_status_offline ?? 'Offline',
              style: TextStyle(
                fontSize: _screenService.scale(
                  12,
                  density: _visualDensityService.density,
                ),
                color: Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.warning
                    : AppColorsDark.warning,
              ),
            ),
          ],
        ),
      );
      actions.add(
        SizedBox(
          width: _screenService.scale(
            16,
            density: _visualDensityService.density,
          ),
        ),
      );
    }

    // Close button
    actions.add(
      GestureDetector(
        onTap: () => Navigator.pop(context),
        child: Icon(
          MdiIcons.close,
          size: _screenService.scale(
            16,
            density: _visualDensityService.density,
          ),
          color: Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.regular
              : AppTextColorDark.regular,
        ),
      ),
    );

    return actions;
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

  /// Toggle a single channel with optimistic UI
  Future<void> _toggleChannel(bool newState) async {
    final localizations = AppLocalizations.of(context);
    final controlStateService = _deviceControlStateService;
    final device = _getDevice();
    final channel = _getChannel();
    final deviceId = device.id;
    final channelId = channel.id;
    final propertyId = channel.onProp.id;

    // Set state machine to PENDING - this locks the UI to show desired state
    controlStateService?.setPending(
      deviceId,
      channelId,
      propertyId,
      newState,
    );
    setState(() {});

    // Also create overlay for intent tracking (for failure detection etc)
    _intentOverlayService?.createLocalOverlay(
      deviceId: deviceId,
      channelId: channelId,
      propertyId: propertyId,
      value: newState,
      ttlMs: 5000, // 5 second TTL
    );

    try {
      final success = await _valueHelper.setPropertyValue(
        context,
        channel.onProp,
        newState,
        deviceId: deviceId,
        channelId: channelId,
      );

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          context,
          message: localizations?.action_failed ?? 'Failed to toggle device',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        context,
        message: localizations?.action_failed ?? 'Failed to toggle device',
      );
    } finally {
      // Transition to SETTLING state - suppresses state changes while device syncs
      if (mounted) {
        controlStateService?.setSettling(
          deviceId,
          channelId,
          propertyId,
        );
      }
    }
  }

}
