import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_channel_detail.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
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
  LightingDeviceController? _controller;

  @override
  void initState() {
    super.initState();

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[LightingDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }

    _initController();
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
      debugPrint(
          '[LightingDeviceDetail] Controller error for $propertyId: $error');
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
    super.dispose();
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void didUpdateWidget(covariant LightingDeviceDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    _initController();
  }

  bool get _isMultiChannel => (_controller?.lights.length ?? 0) > 1;

  @override
  Widget build(BuildContext context) {
    final controller = _controller;

    // Guard against missing controller or empty channels
    if (controller == null || controller.lights.isEmpty) {
      return const SizedBox.shrink();
    }

    // Multi-channel device: tiles grid
    if (_isMultiChannel) {
      return _buildMultiChannelLayout(context, controller);
    }

    // Single channel (simple or with capabilities)
    return _buildSingleChannelLayout(context, controller);
  }

  /// Layout for single channel devices (both simple ON/OFF and with capabilities)
  Widget _buildSingleChannelLayout(
      BuildContext context, LightingDeviceController controller) {
    return LightSingleChannelControlPanel(
      controller: controller.light,
      deviceName: widget._device.name,
      showHeader: true,
      onBack: () => Navigator.pop(context),
    );
  }

  /// Layout for multi-channel devices using LightMultiChannelControlPanel
  Widget _buildMultiChannelLayout(
      BuildContext context, LightingDeviceController controller) {
    return LightMultiChannelControlPanel(
      controllers: controller.lights,
      deviceName: widget._device.name,
      isOnline: widget._device.isOnline,
      showHeader: true,
      onBack: () => Navigator.pop(context),
      onChannelTap: (channelController) =>
          _openChannelDetail(context, channelController),
      initialChannelId: widget.initialChannelId,
    );
  }

  /// Open channel detail page
  void _openChannelDetail(
      BuildContext context, LightChannelController channelController) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => LightChannelDetailPage(
          device: widget._device,
          channel: channelController.channel,
        ),
      ),
    );
  }
}

// ============================================================================
// Single Channel Control Panel
// ============================================================================

/// Single-channel device control using LightingControlPanel.
///
/// Uses [LightChannelController] for all optimistic UI state management and
/// device communication, ensuring consistency with tile controllers and
/// eliminating duplicate state management code.
class LightSingleChannelControlPanel extends StatefulWidget {
  final LightChannelController controller;
  final String deviceName;

  /// Whether to show the header (title, icon, back button)
  /// Set to false when used inside DeviceDetailPage which has its own AppTopBar
  final bool showHeader;

  /// Callback when back button is pressed (only used if showHeader is true)
  final VoidCallback? onBack;

  const LightSingleChannelControlPanel({
    super.key,
    required this.controller,
    required this.deviceName,
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

  // Debounce timers for sliders
  Timer? _brightnessDebounceTimer;
  Timer? _colorDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  LightChannelController get _controller => widget.controller;

  @override
  void initState() {
    super.initState();

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[LightSingleChannelControlPanel] Failed to get DeviceControlStateService: $e');
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
    super.dispose();
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  Set<LightCapability> _buildCapabilities() {
    final caps = <LightCapability>{LightCapability.power};
    if (_controller.hasBrightness) caps.add(LightCapability.brightness);
    if (_controller.hasColor) caps.add(LightCapability.color);
    if (_controller.hasTemperature) caps.add(LightCapability.colorTemp);
    if (_controller.hasColorWhite) caps.add(LightCapability.white);
    return caps;
  }

  // ============================================================================
  // Command Methods
  // ============================================================================

  void _handlePowerToggle() {
    _controller.togglePower();
    setState(() {});
  }

  void _handleBrightnessChanged(int value) {
    // Debounce the actual command, but set optimistic state immediately
    _brightnessDebounceTimer?.cancel();
    _brightnessDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        // Turn on if off
        if (!_controller.isOn) {
          _controller.setPower(true);
        }

        _controller.setBrightness(value);
        setState(() {});
      },
    );

    // Trigger rebuild for immediate visual feedback
    setState(() {});
  }

  void _handleColorTempChanged(int value) {
    _temperatureDebounceTimer?.cancel();
    _temperatureDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        // Turn on if off
        if (!_controller.isOn) {
          _controller.setPower(true);
        }

        _controller.setColorTemperature(value);
        setState(() {});
      },
    );

    setState(() {});
  }

  void _handleColorChanged(Color color, double saturation) {
    _colorDebounceTimer?.cancel();
    _colorDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        // Turn on if off
        if (!_controller.isOn) {
          _controller.setPower(true);
        }

        // Controller handles RGB vs HSV mode internally
        _controller.setColor(color);
        setState(() {});
      },
    );

    setState(() {});
  }

  void _handleWhiteChannelChanged(int value) {
    _whiteDebounceTimer?.cancel();
    _whiteDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        // Turn on if off
        if (!_controller.isOn) {
          _controller.setPower(true);
        }

        _controller.setColorWhite(value);
        setState(() {});
      },
    );

    setState(() {});
  }

  // ============================================================================
  // Build
  // ============================================================================

  @override
  Widget build(BuildContext context) {
    final isOn = _controller.isOn;
    final brightness = _controller.brightness;
    final colorTemp = _controller.colorTemperature;
    final color = _controller.hasColor ? _controller.color : null;
    final white = _controller.colorWhite;
    final capabilities = _buildCapabilities();

    // Show subtitle only if device name differs from channel name
    final channelName = _controller.channel.name;
    final showSubtitle =
        channelName.toLowerCase() != widget.deviceName.toLowerCase();

    return LightingControlPanel(
      // Header configuration
      showHeader: widget.showHeader,
      title: channelName,
      subtitle: showSubtitle ? widget.deviceName : null,
      icon: MdiIcons.lightbulb,
      onBack: widget.onBack,

      // Current values (with optimistic state from controller)
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
/// Uses [LightChannelController] instances for all optimistic UI state management
/// and device communication, ensuring consistency with tile controllers and
/// eliminating duplicate state management code.
class LightMultiChannelControlPanel extends StatefulWidget {
  final List<LightChannelController> controllers;
  final String deviceName;
  final bool isOnline;

  /// Whether to show the header (title, icon, back button)
  /// Set to false when used inside DeviceDetailPage which has its own AppTopBar
  final bool showHeader;

  /// Callback when back button is pressed (only used if showHeader is true)
  final VoidCallback? onBack;

  /// Callback when a channel is tapped to open its detail
  final void Function(LightChannelController controller)? onChannelTap;

  /// Initial channel ID to select (for preselecting a specific channel)
  final String? initialChannelId;

  const LightMultiChannelControlPanel({
    super.key,
    required this.controllers,
    required this.deviceName,
    required this.isOnline,
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

  // Debounce timers for sliders
  Timer? _brightnessDebounceTimer;
  Timer? _colorDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  // Selected channel index for focused control
  int _selectedChannelIndex = 0;

  List<LightChannelController> get _controllers => widget.controllers;
  LightChannelController get _selectedController =>
      _controllers[_selectedChannelIndex];

  @override
  void initState() {
    super.initState();

    // Initialize selected channel from initialChannelId if provided
    if (widget.initialChannelId != null) {
      final index = _controllers
          .indexWhere((c) => c.channel.id == widget.initialChannelId);
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
  }

  @override
  void dispose() {
    _brightnessDebounceTimer?.cancel();
    _colorDebounceTimer?.cancel();
    _temperatureDebounceTimer?.cancel();
    _whiteDebounceTimer?.cancel();
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  // ============================================================================
  // Build Channels List
  // ============================================================================

  List<LightingChannelData> _buildChannelsList() {
    return _controllers.asMap().entries.map((entry) {
      final index = entry.key;
      final controller = entry.value;

      return LightingChannelData(
        id: controller.channel.id,
        name: controller.channel.name,
        isOn: controller.isOn,
        brightness: controller.hasBrightness ? controller.brightness : 100,
        hasBrightness: controller.hasBrightness,
        isOnline: widget.isOnline,
        isSelected: index == _selectedChannelIndex,
      );
    }).toList();
  }

  void _handleChannelSelect(LightingChannelData channelData) {
    final index =
        _controllers.indexWhere((c) => c.channel.id == channelData.id);
    if (index != -1 && index != _selectedChannelIndex) {
      setState(() {
        _selectedChannelIndex = index;
      });
    }
  }

  // ============================================================================
  // Command Handlers
  // ============================================================================

  void _handleChannelIconTap(LightingChannelData channelData) {
    // Find the controller and toggle it
    final controller = _controllers.firstWhere(
      (c) => c.channel.id == channelData.id,
      orElse: () => _controllers.first,
    );

    controller.togglePower();
    setState(() {});
  }

  void _handleChannelTileTap(LightingChannelData channelData) {
    // Change selected channel (tap on tile = select, tap on icon = toggle)
    _handleChannelSelect(channelData);
  }

  // ============================================================================
  // Selected Channel Command Handlers
  // ============================================================================

  void _handleSelectedChannelPowerToggle() {
    _selectedController.togglePower();
    setState(() {});
  }

  void _handleSelectedChannelBrightnessChanged(int value) {
    _brightnessDebounceTimer?.cancel();
    _brightnessDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        // Turn on if off
        if (!_selectedController.isOn) {
          _selectedController.setPower(true);
        }

        _selectedController.setBrightness(value);
        setState(() {});
      },
    );

    setState(() {});
  }

  void _handleSelectedChannelColorTempChanged(int value) {
    _temperatureDebounceTimer?.cancel();
    _temperatureDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        // Turn on if off
        if (!_selectedController.isOn) {
          _selectedController.setPower(true);
        }

        _selectedController.setColorTemperature(value);
        setState(() {});
      },
    );

    setState(() {});
  }

  void _handleSelectedChannelColorChanged(Color color, double saturation) {
    _colorDebounceTimer?.cancel();
    _colorDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        // Turn on if off
        if (!_selectedController.isOn) {
          _selectedController.setPower(true);
        }

        // Controller handles RGB vs HSV mode internally
        _selectedController.setColor(color);
        setState(() {});
      },
    );

    setState(() {});
  }

  void _handleSelectedChannelWhiteChanged(int value) {
    _whiteDebounceTimer?.cancel();
    _whiteDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;

        // Turn on if off
        if (!_selectedController.isOn) {
          _selectedController.setPower(true);
        }

        _selectedController.setColorWhite(value);
        setState(() {});
      },
    );

    setState(() {});
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  Set<LightCapability> _buildSelectedChannelCapabilities() {
    final controller = _selectedController;
    final caps = <LightCapability>{LightCapability.power};
    if (controller.hasBrightness) caps.add(LightCapability.brightness);
    if (controller.hasColor) caps.add(LightCapability.color);
    if (controller.hasTemperature) caps.add(LightCapability.colorTemp);
    if (controller.hasColorWhite) caps.add(LightCapability.white);
    return caps;
  }

  // ============================================================================
  // Build
  // ============================================================================

  @override
  Widget build(BuildContext context) {
    final controller = _selectedController;

    // Get values from selected controller (with optimistic state)
    final isOn = controller.isOn;
    final brightness = controller.brightness;
    final colorTemp = controller.colorTemperature;
    final color = controller.hasColor ? controller.color : null;
    final white = controller.colorWhite;
    final capabilities = _buildSelectedChannelCapabilities();
    final channelsList = _buildChannelsList();

    // Header: channel name as title, device name as subtitle (if different)
    final channelName = controller.channel.name;
    final showSubtitle =
        channelName.toLowerCase() != widget.deviceName.toLowerCase();

    return LightingControlPanel(
      // Header configuration
      showHeader: widget.showHeader,
      title: channelName,
      subtitle: showSubtitle ? widget.deviceName : null,
      icon: MdiIcons.lightbulb,
      onBack: widget.onBack,

      // Selected channel values (with optimistic state from controller)
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

