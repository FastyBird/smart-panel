import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_channel_detail.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/models/control_state.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/modules/displays/export.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class LightingDeviceDetail extends StatefulWidget {
  final LightingDeviceView _device;
  final String? initialChannelId;

  const LightingDeviceDetail({
    super.key,
    required LightingDeviceView device,
    this.initialChannelId,
  }) : _device = device;

  @override
  State<LightingDeviceDetail> createState() => _LightingDeviceDetailState();
}

class _LightingDeviceDetailState extends State<LightingDeviceDetail> {
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;
  IntentOverlayService? _intentOverlayService;
  LightingDeviceController? _controller;

  late List<LightChannelView> _channels;

  @override
  void initState() {
    super.initState();

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightingDeviceDetail] Failed to get DeviceControlStateService: $e');
    }

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightingDeviceDetail] Failed to get IntentOverlayService: $e');
    }

    _initController();
    _initializeWidget();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = LightingDeviceController(
        device: widget._device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint('[LightingDeviceDetail] Controller error for $propertyId: $error');
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
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
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
  void didUpdateWidget(covariant LightingDeviceDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    _initController();
    _initializeWidget();
  }

  void _initializeWidget() {
    _channels = widget._device.lightChannels;
  }

  bool get _isSimple => widget._device.isSimpleLight;
  bool get _isMultiChannel => _channels.length > 1;

  @override
  Widget build(BuildContext context) {
    // Guard against empty channels list
    if (_channels.isEmpty) {
      return const SizedBox.shrink();
    }

    // Multi-channel device: tiles grid
    if (_isMultiChannel) {
      return _buildMultiChannelLayout(context);
    }

    // Simple device with single channel: just ON/OFF
    if (_isSimple) {
      return _buildSimpleDeviceLayout(context);
    }

    // Single channel with capabilities
    return _buildSingleChannelLayout(context);
  }

  /// Layout for simple ON/OFF devices with single channel
  Widget _buildSimpleDeviceLayout(BuildContext context) {
    final channel = _channels.first;

    return LightSingleChannelControlPanel(
      device: widget._device,
      channel: channel,
      showHeader: true,
      onBack: () => Navigator.pop(context),
    );
  }

  /// Layout for single channel devices with capabilities
  Widget _buildSingleChannelLayout(BuildContext context) {
    final channel = _channels.first;

    return LightSingleChannelControlPanel(
      device: widget._device,
      channel: channel,
      showHeader: true,
      onBack: () => Navigator.pop(context),
    );
  }

  /// Layout for multi-channel devices using LightMultiChannelControlPanel
  Widget _buildMultiChannelLayout(BuildContext context) {
    return LightMultiChannelControlPanel(
      device: widget._device,
      channels: _channels,
      showHeader: true,
      onBack: () => Navigator.pop(context),
      onChannelTap: (channel) => _openChannelDetail(context, channel),
      initialChannelId: widget.initialChannelId,
    );
  }

  /// Open channel detail page
  void _openChannelDetail(BuildContext context, LightChannelView channel) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => LightChannelDetailPage(
          device: widget._device,
          channel: channel,
        ),
      ),
    );
  }
}

class PropertyValueHelper {
  final DevicesService _service = locator<DevicesService>();
  final DisplayRepository? _displayRepository;

  PropertyValueHelper() : _displayRepository = _tryGetDisplayRepository();

  static DisplayRepository? _tryGetDisplayRepository() {
    try {
      return locator<DisplayRepository>();
    } catch (_) {
      return null;
    }
  }

  Future<bool> setPropertyValue(
    BuildContext context,
    ChannelPropertyView property,
    dynamic value, {
    String? deviceId,
    String? channelId,
  }) async {
    final localizations = AppLocalizations.of(context)!;

    try {
      bool res;

      // Use context-aware method if we have device and channel IDs
      if (deviceId != null && channelId != null) {
        final commandContext = PropertyCommandContext(
          origin: 'panel.device',
          displayId: _displayRepository?.display?.id,
        );

        res = await _service.setPropertyValueWithContext(
          deviceId: deviceId,
          channelId: channelId,
          propertyId: property.id,
          value: value,
          context: commandContext,
        );
      } else {
        // Fallback to simple method without context
        res = await _service.setPropertyValue(
          property.id,
          value,
        );
      }

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

  Future<bool> setMultiplePropertyValues(
    BuildContext context,
    List<PropertyCommandItem> properties,
  ) async {
    final localizations = AppLocalizations.of(context)!;

    try {
      // Build context for batch command
      final commandContext = PropertyCommandContext(
        origin: 'panel.device',
        displayId: _displayRepository?.display?.id,
      );

      // Send batch command
      final success = await _service.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!success && context.mounted) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }

      return success;
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

// ============================================================================
// Single Channel Control Panel
// ============================================================================

/// Single-channel device control using LightingControlPanel.
///
/// Replaces LightSingleChannelDetail for devices with a single light channel.
/// Provides unified UI with the role detail page while maintaining device-level
/// state management.
class LightSingleChannelControlPanel extends StatefulWidget {
  final LightingDeviceView device;
  final LightChannelView channel;

  /// Whether to show the header (title, icon, back button)
  /// Set to false when used inside DeviceDetailPage which has its own AppTopBar
  final bool showHeader;

  /// Callback when back button is pressed (only used if showHeader is true)
  final VoidCallback? onBack;

  const LightSingleChannelControlPanel({
    super.key,
    required this.device,
    required this.channel,
    this.showHeader = false,
    this.onBack,
  });

  @override
  State<LightSingleChannelControlPanel> createState() =>
      _LightSingleChannelControlPanelState();
}

class _LightSingleChannelControlPanelState
    extends State<LightSingleChannelControlPanel> {
  DeviceControlStateService? _deviceControlStateService;
  IntentOverlayService? _intentOverlayService;
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  // Debounce timers for sliders
  Timer? _brightnessDebounceTimer;
  Timer? _colorDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  LightingDeviceView get _device => widget.device;
  LightChannelView get _channel => widget.channel;

  @override
  void initState() {
    super.initState();

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LightSingleChannelControlPanel] Failed to get DeviceControlStateService: $e');
      }
    }

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LightSingleChannelControlPanel] Failed to get IntentOverlayService: $e');
      }
    }
  }

  @override
  void dispose() {
    _brightnessDebounceTimer?.cancel();
    _colorDebounceTimer?.cancel();
    _temperatureDebounceTimer?.cancel();
    _whiteDebounceTimer?.cancel();
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  void _onIntentChanged() {
    if (mounted) setState(() {});
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  Set<LightCapability> _buildCapabilities() {
    final caps = <LightCapability>{LightCapability.power};
    if (_channel.hasBrightness) caps.add(LightCapability.brightness);
    if (_channel.hasColor) caps.add(LightCapability.color);
    if (_channel.hasTemperature) caps.add(LightCapability.colorTemp);
    if (_channel.hasColorWhite) caps.add(LightCapability.white);
    return caps;
  }

  // ============================================================================
  // Optimistic Value Getters
  // ============================================================================

  bool _getIsOn() {
    final onProp = _channel.onProp;
    final controlStateService = _deviceControlStateService;

    if (controlStateService != null &&
        controlStateService.isLocked(_device.id, _channel.id, onProp.id)) {
      final desiredValue = controlStateService.getDesiredValue(
        _device.id,
        _channel.id,
        onProp.id,
      );
      if (desiredValue is bool) return desiredValue;
      if (desiredValue is num) return desiredValue > 0.5;
    }

    // Fall back to overlay service
    if (_intentOverlayService?.isPropertyLocked(
          _device.id,
          _channel.id,
          onProp.id,
        ) ==
        true) {
      final overlayValue = _intentOverlayService!.getOverlayValue(
        _device.id,
        _channel.id,
        onProp.id,
      );
      if (overlayValue is bool) return overlayValue;
    }

    return _channel.on;
  }

  int _getBrightness() {
    final prop = _channel.brightnessProp;
    if (prop == null) return 100;

    final controlStateService = _deviceControlStateService;
    if (controlStateService != null &&
        controlStateService.isLocked(_device.id, _channel.id, prop.id)) {
      final desiredValue = controlStateService.getDesiredValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (desiredValue is num) return desiredValue.toInt();
    }

    // Fall back to overlay service
    if (_intentOverlayService?.isPropertyLocked(
          _device.id,
          _channel.id,
          prop.id,
        ) ==
        true) {
      final overlayValue = _intentOverlayService!.getOverlayValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (overlayValue is num) return overlayValue.toInt();
    }

    return _channel.brightness;
  }

  int _getColorTemp() {
    final prop = _channel.temperatureProp;
    if (prop == null) return 4000;

    final controlStateService = _deviceControlStateService;
    if (controlStateService != null &&
        controlStateService.isLocked(_device.id, _channel.id, prop.id)) {
      final desiredValue = controlStateService.getDesiredValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (desiredValue is num) return desiredValue.toInt();
    }

    // Fall back to overlay service
    if (_intentOverlayService?.isPropertyLocked(
          _device.id,
          _channel.id,
          prop.id,
        ) ==
        true) {
      final overlayValue = _intentOverlayService!.getOverlayValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (overlayValue is num) return overlayValue.toInt();
    }

    // Get from property value
    if (prop.value is NumberValueType) {
      return (prop.value as NumberValueType).value.toInt();
    }
    return 4000;
  }

  Color? _getColor() {
    if (!_channel.hasColor) return null;

    final controlStateService = _deviceControlStateService;

    // Check for color group overlay (RGB/HSV tracked together)
    if (controlStateService != null &&
        controlStateService.isGroupLocked(_device.id, 'color:${_channel.id}')) {
      // Try to get RGB values from group
      final red = controlStateService.getGroupPropertyValue(
        _device.id,
        'color:${_channel.id}',
        _channel.id,
        _channel.colorRedProp?.id ?? '',
      );
      final green = controlStateService.getGroupPropertyValue(
        _device.id,
        'color:${_channel.id}',
        _channel.id,
        _channel.colorGreenProp?.id ?? '',
      );
      final blue = controlStateService.getGroupPropertyValue(
        _device.id,
        'color:${_channel.id}',
        _channel.id,
        _channel.colorBlueProp?.id ?? '',
      );

      if (red is num && green is num && blue is num) {
        return ColorUtils.fromRGB(red.toInt(), green.toInt(), blue.toInt());
      }

      // Try to get hue value from group
      final hue = controlStateService.getGroupPropertyValue(
        _device.id,
        'color:${_channel.id}',
        _channel.id,
        _channel.hueProp?.id ?? '',
      );
      if (hue is num) {
        return HSVColor.fromAHSV(1.0, hue.toDouble(), 1.0, 1.0).toColor();
      }
    }

    // Fallback: check single property for hue
    final hueProp = _channel.hueProp;
    if (hueProp != null) {
      if (controlStateService != null &&
          controlStateService.isLocked(_device.id, _channel.id, hueProp.id)) {
        final desiredValue = controlStateService.getDesiredValue(
          _device.id,
          _channel.id,
          hueProp.id,
        );
        if (desiredValue is num) {
          return HSVColor.fromAHSV(1.0, desiredValue.toDouble(), 1.0, 1.0)
              .toColor();
        }
      }
    }

    // Get color from channel RGB values
    try {
      if (_channel.hasColorRed) {
        return ColorUtils.fromRGB(
          _channel.colorRed,
          _channel.colorGreen,
          _channel.colorBlue,
        );
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[LightSingleChannelControlPanel] Error getting color: $e');
    }

    return null;
  }

  int _getWhiteChannel() {
    final prop = _channel.colorWhiteProp;
    if (prop == null) return 100;

    final controlStateService = _deviceControlStateService;
    if (controlStateService != null &&
        controlStateService.isLocked(_device.id, _channel.id, prop.id)) {
      final desiredValue = controlStateService.getDesiredValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (desiredValue is num) return desiredValue.toInt();
    }

    // Fall back to overlay service
    if (_intentOverlayService?.isPropertyLocked(
          _device.id,
          _channel.id,
          prop.id,
        ) ==
        true) {
      final overlayValue = _intentOverlayService!.getOverlayValue(
        _device.id,
        _channel.id,
        prop.id,
      );
      if (overlayValue is num) return overlayValue.toInt();
    }

    return _channel.colorWhite;
  }

  // ============================================================================
  // Command Methods
  // ============================================================================

  Future<void> _handlePowerToggle() async {
    final localizations = AppLocalizations.of(context);
    final newState = !_getIsOn();
    final propertyId = _channel.onProp.id;

    // Set PENDING state
    _deviceControlStateService?.setPending(
      _device.id,
      _channel.id,
      propertyId,
      newState,
    );
    setState(() {});

    // Create overlay for failure tracking
    _intentOverlayService?.createLocalOverlay(
      deviceId: _device.id,
      channelId: _channel.id,
      propertyId: propertyId,
      value: newState,
      ttlMs: 5000,
    );

    try {
      final success = await _valueHelper.setPropertyValue(
        context,
        _channel.onProp,
        newState,
        deviceId: _device.id,
        channelId: _channel.id,
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
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          _channel.id,
          propertyId,
        );
      }
    }
  }

  void _handleBrightnessChanged(int value) {
    final prop = _channel.brightnessProp;
    if (prop == null) return;

    // Set PENDING state immediately for responsive UI
    _deviceControlStateService?.setPending(
      _device.id,
      _channel.id,
      prop.id,
      value,
    );
    setState(() {});

    // Debounce the actual command
    _brightnessDebounceTimer?.cancel();
    _brightnessDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        // Turn on if off
        if (!_channel.on) {
          await _valueHelper.setPropertyValue(
            context,
            _channel.onProp,
            true,
            deviceId: _device.id,
            channelId: _channel.id,
          );
          if (!mounted) return;
        }

        // Set brightness
        await _valueHelper.setPropertyValue(
          context,
          prop,
          value.toDouble(),
          deviceId: _device.id,
          channelId: _channel.id,
        );

        if (mounted) {
          _deviceControlStateService?.setSettling(
            _device.id,
            _channel.id,
            prop.id,
          );
        }
      },
    );
  }

  void _handleColorTempChanged(int value) {
    final prop = _channel.temperatureProp;
    if (prop == null) return;

    // Set PENDING state immediately
    _deviceControlStateService?.setPending(
      _device.id,
      _channel.id,
      prop.id,
      value,
    );
    setState(() {});

    // Debounce the actual command
    _temperatureDebounceTimer?.cancel();
    _temperatureDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        // Turn on if off
        if (!_channel.on) {
          await _valueHelper.setPropertyValue(
            context,
            _channel.onProp,
            true,
            deviceId: _device.id,
            channelId: _channel.id,
          );
          if (!mounted) return;
        }

        // Set temperature
        await _valueHelper.setPropertyValue(
          context,
          prop,
          value.toDouble(),
          deviceId: _device.id,
          channelId: _channel.id,
        );

        if (mounted) {
          _deviceControlStateService?.setSettling(
            _device.id,
            _channel.id,
            prop.id,
          );
        }
      },
    );
  }

  void _handleColorChanged(Color color, double saturation) {
    final rgbValue = ColorUtils.toRGB(color);
    final hsvValue = ColorUtils.toHSV(color);

    // Build property configs for the color group
    final List<PropertyConfig> colorProperties = [];

    if (_channel.colorRedProp != null) {
      colorProperties.add(PropertyConfig(
        channelId: _channel.id,
        propertyId: _channel.colorRedProp!.id,
        desiredValue: rgbValue.red,
      ));
    }
    if (_channel.colorGreenProp != null) {
      colorProperties.add(PropertyConfig(
        channelId: _channel.id,
        propertyId: _channel.colorGreenProp!.id,
        desiredValue: rgbValue.green,
      ));
    }
    if (_channel.colorBlueProp != null) {
      colorProperties.add(PropertyConfig(
        channelId: _channel.id,
        propertyId: _channel.colorBlueProp!.id,
        desiredValue: rgbValue.blue,
      ));
    }
    if (_channel.hueProp != null) {
      colorProperties.add(PropertyConfig(
        channelId: _channel.id,
        propertyId: _channel.hueProp!.id,
        desiredValue: hsvValue.hue.round(),
      ));
    }
    if (_channel.saturationProp != null) {
      colorProperties.add(PropertyConfig(
        channelId: _channel.id,
        propertyId: _channel.saturationProp!.id,
        desiredValue: (hsvValue.saturation * 100).round(),
      ));
    }

    // Set PENDING state for color group
    if (colorProperties.isNotEmpty) {
      _deviceControlStateService?.setGroupPending(
        _device.id,
        'color:${_channel.id}',
        colorProperties,
      );
    }
    setState(() {});

    // Debounce the actual command
    _colorDebounceTimer?.cancel();
    _colorDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        // Build list of properties to update
        final List<PropertyCommandItem> properties = [];

        // Turn on if off
        if (!_channel.on) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.onProp.id,
            value: true,
          ));
        }

        if (_channel.colorRedProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.colorRedProp!.id,
            value: rgbValue.red,
          ));
        }

        if (_channel.colorGreenProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.colorGreenProp!.id,
            value: rgbValue.green,
          ));
        }

        if (_channel.colorBlueProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.colorBlueProp!.id,
            value: rgbValue.blue,
          ));
        }

        if (_channel.hueProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.hueProp!.id,
            value: hsvValue.hue.round(),
          ));
        }

        if (_channel.saturationProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _channel.id,
            propertyId: _channel.saturationProp!.id,
            value: (hsvValue.saturation * 100).round(),
          ));
        }

        if (properties.isNotEmpty) {
          await _valueHelper.setMultiplePropertyValues(context, properties);
        }

        // Start settling for color group (intent system will also auto-settle)
        if (mounted && colorProperties.isNotEmpty) {
          _deviceControlStateService?.setGroupSettling(
            _device.id,
            'color:${_channel.id}',
          );
        }
      },
    );
  }

  void _handleWhiteChannelChanged(int value) {
    final prop = _channel.colorWhiteProp;
    if (prop == null) return;

    // Set PENDING state immediately
    _deviceControlStateService?.setPending(
      _device.id,
      _channel.id,
      prop.id,
      value,
    );
    setState(() {});

    // Debounce the actual command
    _whiteDebounceTimer?.cancel();
    _whiteDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        // Turn on if off
        if (!_channel.on) {
          await _valueHelper.setPropertyValue(
            context,
            _channel.onProp,
            true,
            deviceId: _device.id,
            channelId: _channel.id,
          );
          if (!mounted) return;
        }

        // Set white channel
        await _valueHelper.setPropertyValue(
          context,
          prop,
          value.toDouble(),
          deviceId: _device.id,
          channelId: _channel.id,
        );

        if (mounted) {
          _deviceControlStateService?.setSettling(
            _device.id,
            _channel.id,
            prop.id,
          );
        }
      },
    );
  }

  // ============================================================================
  // Build
  // ============================================================================

  @override
  Widget build(BuildContext context) {
    final isOn = _getIsOn();
    final brightness = _getBrightness();
    final colorTemp = _getColorTemp();
    final color = _getColor();
    final white = _getWhiteChannel();
    final capabilities = _buildCapabilities();

    // Show subtitle only if device name differs from channel name
    final showSubtitle =
        _channel.name.toLowerCase() != _device.name.toLowerCase();

    return LightingControlPanel(
      // Header configuration
      showHeader: widget.showHeader,
      title: _channel.name,
      subtitle: showSubtitle ? _device.name : null,
      icon: MdiIcons.lightbulb,
      onBack: widget.onBack,

      // Current values (with optimistic state)
      isOn: isOn,
      brightness: brightness,
      colorTemp: colorTemp,
      color: color,
      saturation: 1.0,
      whiteChannel: white,

      // Configuration
      capabilities: capabilities,
      state: LightingState.synced, // Single channel is always "synced"
      channels: const [], // No channels list for single channel control

      // Callbacks
      onPowerToggle: _handlePowerToggle,
      onBrightnessChanged: _handleBrightnessChanged,
      onColorTempChanged: _handleColorTempChanged,
      onColorChanged: _handleColorChanged,
      onWhiteChannelChanged: _handleWhiteChannelChanged,
      // No channel callbacks needed (channels list is empty)
    );
  }
}

// ============================================================================
// Multi-Channel Control Panel
// ============================================================================

/// Multi-channel device control using LightingControlPanel.
///
/// Aggregates values across all channels and shows them in a unified control panel
/// with a channels list at the bottom.
class LightMultiChannelControlPanel extends StatefulWidget {
  final LightingDeviceView device;
  final List<LightChannelView> channels;

  /// Whether to show the header (title, icon, back button)
  /// Set to false when used inside DeviceDetailPage which has its own AppTopBar
  final bool showHeader;

  /// Callback when back button is pressed (only used if showHeader is true)
  final VoidCallback? onBack;

  /// Callback when a channel is tapped to open its detail
  final void Function(LightChannelView channel)? onChannelTap;

  /// Initial channel ID to select (for preselecting a specific channel)
  final String? initialChannelId;

  const LightMultiChannelControlPanel({
    super.key,
    required this.device,
    required this.channels,
    this.showHeader = false,
    this.onBack,
    this.onChannelTap,
    this.initialChannelId,
  });

  @override
  State<LightMultiChannelControlPanel> createState() =>
      _LightMultiChannelControlPanelState();
}

class _LightMultiChannelControlPanelState
    extends State<LightMultiChannelControlPanel> {
  DeviceControlStateService? _deviceControlStateService;
  IntentOverlayService? _intentOverlayService;
  final PropertyValueHelper _valueHelper = PropertyValueHelper();

  // Debounce timers for sliders
  Timer? _brightnessDebounceTimer;
  Timer? _colorDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  // Selected channel index for focused control
  int _selectedChannelIndex = 0;

  LightingDeviceView get _device => widget.device;
  List<LightChannelView> get _channels => widget.channels;
  LightChannelView get _selectedChannel => _channels[_selectedChannelIndex];

  @override
  void initState() {
    super.initState();

    // Initialize selected channel from initialChannelId if provided
    if (widget.initialChannelId != null) {
      final index = _channels.indexWhere((c) => c.id == widget.initialChannelId);
      if (index != -1) {
        _selectedChannelIndex = index;
      }
    }

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[LightMultiChannelControlPanel] Failed to get DeviceControlStateService: $e');
      }
    }

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[LightMultiChannelControlPanel] Failed to get IntentOverlayService: $e');
      }
    }
  }

  @override
  void dispose() {
    _brightnessDebounceTimer?.cancel();
    _colorDebounceTimer?.cancel();
    _temperatureDebounceTimer?.cancel();
    _whiteDebounceTimer?.cancel();
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  void _onIntentChanged() {
    if (mounted) setState(() {});
  }

  // ============================================================================
  // Build Channels List
  // ============================================================================

  List<LightingChannelData> _buildChannelsList() {
    return _channels.asMap().entries.map((entry) {
      final index = entry.key;
      final channel = entry.value;

      // Get optimistic on state
      bool isOn = channel.on;
      final controlState = _deviceControlStateService;
      if (controlState != null &&
          controlState.isLocked(_device.id, channel.id, channel.onProp.id)) {
        final desiredValue = controlState.getDesiredValue(
          _device.id,
          channel.id,
          channel.onProp.id,
        );
        if (desiredValue is bool) {
          isOn = desiredValue;
        } else if (desiredValue is num) {
          isOn = desiredValue > 0.5;
        }
      }

      // Get optimistic brightness
      int brightness = channel.hasBrightness ? channel.brightness : 100;
      final brightnessProp = channel.brightnessProp;
      if (brightnessProp != null &&
          controlState != null &&
          controlState.isLocked(_device.id, channel.id, brightnessProp.id)) {
        final desiredValue = controlState.getDesiredValue(
          _device.id,
          channel.id,
          brightnessProp.id,
        );
        if (desiredValue is num) {
          brightness = desiredValue.round();
        }
      }

      return LightingChannelData(
        id: channel.id,
        name: channel.name,
        isOn: isOn,
        brightness: brightness,
        hasBrightness: channel.hasBrightness,
        isOnline: _device.isOnline,
        isSelected: index == _selectedChannelIndex,
      );
    }).toList();
  }

  void _handleChannelSelect(LightingChannelData channelData) {
    final index = _channels.indexWhere((c) => c.id == channelData.id);
    if (index != -1 && index != _selectedChannelIndex) {
      setState(() {
        _selectedChannelIndex = index;
      });
    }
  }

  // ============================================================================
  // Command Handlers
  // ============================================================================

  void _handleChannelIconTap(LightingChannelData channelData) async {
    // Find the channel and toggle it
    final channel = _channels.firstWhere(
      (c) => c.id == channelData.id,
      orElse: () => _channels.first,
    );

    final newState = !channelData.isOn;

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      channel.onProp.id,
      newState,
    );
    setState(() {});

    try {
      await _valueHelper.setPropertyValue(
        context,
        channel.onProp,
        newState,
        deviceId: _device.id,
        channelId: channel.id,
      );
    } finally {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          channel.onProp.id,
        );
      }
    }
  }

  void _handleChannelTileTap(LightingChannelData channelData) {
    // Change selected channel (tap on tile = select, tap on icon = toggle)
    _handleChannelSelect(channelData);
  }

  // ============================================================================
  // Selected Channel Command Handlers
  // ============================================================================

  void _handleSelectedChannelPowerToggle() async {
    final channel = _selectedChannel;
    final newState = !_getSelectedChannelIsOn();

    _deviceControlStateService?.setPending(
      _device.id,
      channel.id,
      channel.onProp.id,
      newState,
    );
    setState(() {});

    try {
      await _valueHelper.setPropertyValue(
        context,
        channel.onProp,
        newState,
        deviceId: _device.id,
        channelId: channel.id,
      );
    } finally {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channel.id,
          channel.onProp.id,
        );
      }
    }
  }

  void _handleSelectedChannelBrightnessChanged(int value) {
    final channel = _selectedChannel;
    final prop = channel.brightnessProp;
    if (prop == null) return;

    _deviceControlStateService?.setPending(_device.id, channel.id, prop.id, value);
    setState(() {});

    _brightnessDebounceTimer?.cancel();
    _brightnessDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if off
        if (!_getSelectedChannelIsOn()) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: channel.onProp.id,
            value: true,
          ));
        }

        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: channel.id,
          propertyId: prop.id,
          value: value.toDouble(),
        ));

        await _valueHelper.setMultiplePropertyValues(context, commands);

        if (mounted) {
          _deviceControlStateService?.setSettling(_device.id, channel.id, prop.id);
        }
      },
    );
  }

  void _handleSelectedChannelColorTempChanged(int value) {
    final channel = _selectedChannel;
    final prop = channel.temperatureProp;
    if (prop == null) return;

    _deviceControlStateService?.setPending(_device.id, channel.id, prop.id, value);
    setState(() {});

    _temperatureDebounceTimer?.cancel();
    _temperatureDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if off
        if (!_getSelectedChannelIsOn()) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: channel.onProp.id,
            value: true,
          ));
        }

        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: channel.id,
          propertyId: prop.id,
          value: value.toDouble(),
        ));

        await _valueHelper.setMultiplePropertyValues(context, commands);

        if (mounted) {
          _deviceControlStateService?.setSettling(_device.id, channel.id, prop.id);
        }
      },
    );
  }

  void _handleSelectedChannelColorChanged(Color color, double saturation) {
    final channel = _selectedChannel;
    if (!channel.hasColor) return;

    final rgbValue = ColorUtils.toRGB(color);
    final hsv = HSVColor.fromColor(color);

    // Build property configs for the color group
    final List<PropertyConfig> colorProperties = [];

    if (channel.colorRedProp != null) {
      colorProperties.add(PropertyConfig(
        channelId: channel.id,
        propertyId: channel.colorRedProp!.id,
        desiredValue: rgbValue.red,
      ));
    }
    if (channel.colorGreenProp != null) {
      colorProperties.add(PropertyConfig(
        channelId: channel.id,
        propertyId: channel.colorGreenProp!.id,
        desiredValue: rgbValue.green,
      ));
    }
    if (channel.colorBlueProp != null) {
      colorProperties.add(PropertyConfig(
        channelId: channel.id,
        propertyId: channel.colorBlueProp!.id,
        desiredValue: rgbValue.blue,
      ));
    }
    if (channel.hueProp != null) {
      colorProperties.add(PropertyConfig(
        channelId: channel.id,
        propertyId: channel.hueProp!.id,
        desiredValue: hsv.hue.round(),
      ));
    }
    if (channel.saturationProp != null) {
      colorProperties.add(PropertyConfig(
        channelId: channel.id,
        propertyId: channel.saturationProp!.id,
        desiredValue: (saturation * 100).round(),
      ));
    }

    // Set PENDING state for color group
    if (colorProperties.isNotEmpty) {
      _deviceControlStateService?.setGroupPending(
        _device.id,
        'color:${channel.id}',
        colorProperties,
      );
    }
    setState(() {});

    _colorDebounceTimer?.cancel();
    _colorDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if off
        if (!_getSelectedChannelIsOn()) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: channel.onProp.id,
            value: true,
          ));
        }

        // HSV mode
        if (channel.hasHue) {
          if (channel.hueProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.hueProp!.id,
              value: hsv.hue.round(),
            ));
          }
          if (channel.saturationProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.saturationProp!.id,
              value: (saturation * 100).round(),
            ));
          }
        }
        // RGB mode
        else if (channel.hasColorRed) {
          if (channel.colorRedProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.colorRedProp!.id,
              value: rgbValue.red,
            ));
          }
          if (channel.colorGreenProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.colorGreenProp!.id,
              value: rgbValue.green,
            ));
          }
          if (channel.colorBlueProp != null) {
            commands.add(PropertyCommandItem(
              deviceId: _device.id,
              channelId: channel.id,
              propertyId: channel.colorBlueProp!.id,
              value: rgbValue.blue,
            ));
          }
        }

        await _valueHelper.setMultiplePropertyValues(context, commands);

        // Start settling for color group (intent system will also auto-settle)
        if (mounted && colorProperties.isNotEmpty) {
          _deviceControlStateService?.setGroupSettling(
            _device.id,
            'color:${channel.id}',
          );
        }
      },
    );
  }

  void _handleSelectedChannelWhiteChanged(int value) {
    final channel = _selectedChannel;
    final prop = channel.colorWhiteProp;
    if (prop == null) return;

    _deviceControlStateService?.setPending(_device.id, channel.id, prop.id, value);
    setState(() {});

    _whiteDebounceTimer?.cancel();
    _whiteDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () async {
        if (!mounted) return;

        final List<PropertyCommandItem> commands = [];

        // Turn on if off
        if (!_getSelectedChannelIsOn()) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: channel.id,
            propertyId: channel.onProp.id,
            value: true,
          ));
        }

        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: channel.id,
          propertyId: prop.id,
          value: value.toDouble(),
        ));

        await _valueHelper.setMultiplePropertyValues(context, commands);

        if (mounted) {
          _deviceControlStateService?.setSettling(_device.id, channel.id, prop.id);
        }
      },
    );
  }

  // ============================================================================
  // Selected Channel Value Getters
  // ============================================================================

  bool _getSelectedChannelIsOn() {
    final channel = _selectedChannel;
    final controlState = _deviceControlStateService;

    if (controlState != null &&
        controlState.isLocked(_device.id, channel.id, channel.onProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channel.id,
        channel.onProp.id,
      );
      if (desiredValue is bool) return desiredValue;
      if (desiredValue is num) return desiredValue > 0.5;
    }
    return channel.on;
  }

  int _getSelectedChannelBrightness() {
    final channel = _selectedChannel;
    if (!channel.hasBrightness) return 100;

    final controlState = _deviceControlStateService;
    final brightnessProp = channel.brightnessProp;

    if (brightnessProp != null &&
        controlState != null &&
        controlState.isLocked(_device.id, channel.id, brightnessProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channel.id,
        brightnessProp.id,
      );
      if (desiredValue is num) return desiredValue.round();
    }
    return channel.brightness;
  }

  int _getSelectedChannelColorTemp() {
    final channel = _selectedChannel;
    if (!channel.hasTemperature) return 4000;

    final controlState = _deviceControlStateService;
    final tempProp = channel.temperatureProp;

    if (tempProp != null &&
        controlState != null &&
        controlState.isLocked(_device.id, channel.id, tempProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channel.id,
        tempProp.id,
      );
      if (desiredValue is num) return desiredValue.round();
    }

    final value = tempProp?.value;
    if (value is NumberValueType) return value.value.toInt();
    return 4000;
  }

  Color? _getSelectedChannelColor() {
    final channel = _selectedChannel;
    if (!channel.hasColor) return null;

    final controlState = _deviceControlStateService;

    // Check for color group overlay (RGB/HSV tracked together)
    if (controlState != null &&
        controlState.isGroupLocked(_device.id, 'color:${channel.id}')) {
      // Try to get RGB values from group
      final red = controlState.getGroupPropertyValue(
        _device.id,
        'color:${channel.id}',
        channel.id,
        channel.colorRedProp?.id ?? '',
      );
      final green = controlState.getGroupPropertyValue(
        _device.id,
        'color:${channel.id}',
        channel.id,
        channel.colorGreenProp?.id ?? '',
      );
      final blue = controlState.getGroupPropertyValue(
        _device.id,
        'color:${channel.id}',
        channel.id,
        channel.colorBlueProp?.id ?? '',
      );

      if (red is num && green is num && blue is num) {
        return ColorUtils.fromRGB(red.toInt(), green.toInt(), blue.toInt());
      }

      // Try to get hue value from group
      final hue = controlState.getGroupPropertyValue(
        _device.id,
        'color:${channel.id}',
        channel.id,
        channel.hueProp?.id ?? '',
      );
      if (hue is num) {
        return HSVColor.fromAHSV(1.0, hue.toDouble(), 1.0, 1.0).toColor();
      }
    }

    try {
      if (channel.hasColorRed) {
        return ColorUtils.fromRGB(
          channel.colorRed,
          channel.colorGreen,
          channel.colorBlue,
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LightMultiChannelControlPanel] Error getting color: $e');
      }
    }
    return null;
  }

  int _getSelectedChannelWhite() {
    final channel = _selectedChannel;
    if (!channel.hasColorWhite) return 100;

    final controlState = _deviceControlStateService;
    final whiteProp = channel.colorWhiteProp;

    if (whiteProp != null &&
        controlState != null &&
        controlState.isLocked(_device.id, channel.id, whiteProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channel.id,
        whiteProp.id,
      );
      if (desiredValue is num) return desiredValue.round();
    }
    return channel.colorWhite;
  }

  Set<LightCapability> _buildSelectedChannelCapabilities() {
    final channel = _selectedChannel;
    final caps = <LightCapability>{LightCapability.power};
    if (channel.hasBrightness) caps.add(LightCapability.brightness);
    if (channel.hasColor) caps.add(LightCapability.color);
    if (channel.hasTemperature) caps.add(LightCapability.colorTemp);
    if (channel.hasColorWhite) caps.add(LightCapability.white);
    return caps;
  }

  // ============================================================================
  // Build
  // ============================================================================

  @override
  Widget build(BuildContext context) {
    // Get values from selected channel (not aggregated)
    final isOn = _getSelectedChannelIsOn();
    final brightness = _getSelectedChannelBrightness();
    final colorTemp = _getSelectedChannelColorTemp();
    final color = _getSelectedChannelColor();
    final white = _getSelectedChannelWhite();
    final capabilities = _buildSelectedChannelCapabilities();
    final channelsList = _buildChannelsList();

    // Header: channel name as title, device name as subtitle (if different)
    final channelName = _selectedChannel.name;
    final deviceName = _device.name;
    final showSubtitle = channelName.toLowerCase() != deviceName.toLowerCase();

    return LightingControlPanel(
      // Header configuration
      showHeader: widget.showHeader,
      title: channelName,
      subtitle: showSubtitle ? deviceName : null,
      icon: MdiIcons.lightbulb,
      onBack: widget.onBack,

      // Selected channel values
      isOn: isOn,
      brightness: brightness,
      colorTemp: colorTemp,
      color: color,
      saturation: 1.0,
      whiteChannel: white,

      // Configuration
      capabilities: capabilities,
      state: LightingState.synced,
      channels: channelsList,
      channelsPanelIcon: MdiIcons.lightbulbGroup,

      // Callbacks
      onPowerToggle: _handleSelectedChannelPowerToggle,
      onBrightnessChanged: _handleSelectedChannelBrightnessChanged,
      onColorTempChanged: _handleSelectedChannelColorTempChanged,
      onColorChanged: _handleSelectedChannelColorChanged,
      onWhiteChannelChanged: _handleSelectedChannelWhiteChanged,
      onChannelIconTap: _handleChannelIconTap,
      onChannelTileTap: _handleChannelTileTap,
    );
  }
}

