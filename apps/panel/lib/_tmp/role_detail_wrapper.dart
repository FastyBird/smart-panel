import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/material.dart';

/// Wrapper that adapts real data to LightingControlPanel for testing
class MockRoleDetailWrapper extends StatefulWidget {
  final LightTargetRole role;
  final String roomId;

  const MockRoleDetailWrapper({
    super.key,
    required this.role,
    required this.roomId,
  });

  @override
  State<MockRoleDetailWrapper> createState() => _MockRoleDetailWrapperState();
}

class _MockRoleDetailWrapperState extends State<MockRoleDetailWrapper> {
  SpacesService? _spacesService;
  DevicesService? _devicesService;

  // Local state for testing callbacks
  bool _isOn = true;
  int _brightness = 65;
  int _colorTemp = 4000;
  Color _color = const Color(0xFFFF9500);
  double _saturation = 1.0;
  int _whiteChannel = 80;

  @override
  void initState() {
    super.initState();

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onDataChanged);
    } catch (e) {
      debugPrint('[MockRoleDetailWrapper] Failed to get SpacesService: $e');
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDataChanged);
    } catch (e) {
      debugPrint('[MockRoleDetailWrapper] Failed to get DevicesService: $e');
    }
  }

  @override
  void dispose() {
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final spacesService = _spacesService;
    final devicesService = _devicesService;

    if (spacesService == null || devicesService == null) {
      return const Scaffold(
        body: Center(child: Text('Services not available')),
      );
    }

    // Build channels list from real data
    final channels = <LightingChannelData>[];
    final allCapabilities = <LightCapability>{};

    final lightTargets = spacesService
        .getLightTargetsForSpace(widget.roomId)
        .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
        .toList();

    for (final target in lightTargets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        channels.add(LightingChannelData(
          id: target.channelId,
          name: target.channelName,
          isOn: channel.on,
          brightness: channel.hasBrightness ? channel.brightness : 100,
          isOnline: device.isOnline,
        ));

        // Collect capabilities
        allCapabilities.add(LightCapability.power);
        if (channel.hasBrightness) allCapabilities.add(LightCapability.brightness);
        if (channel.hasTemperature) allCapabilities.add(LightCapability.colorTemp);
        if (channel.hasColor) allCapabilities.add(LightCapability.color);
        if (channel.hasColorWhite) allCapabilities.add(LightCapability.white);
      }
    }

    // TODO: Remove test state override - for testing error banners
    // Options: LightingState.synced, LightingState.mixed, LightingState.unsynced
    const testState = LightingState.mixed;

    // TODO: Remove - Add mock channels for testing grid layout
    channels.addAll([
      const LightingChannelData(
        id: 'mock-1',
        name: 'Ceiling Light',
        isOn: true,
        brightness: 80,
        isOnline: true,
      ),
      const LightingChannelData(
        id: 'mock-2',
        name: 'Floor Lamp',
        isOn: false,
        brightness: 0,
        isOnline: true,
      ),
      const LightingChannelData(
        id: 'mock-3',
        name: 'Desk Lamp',
        isOn: true,
        brightness: 65,
        isOnline: false,
      ),
      const LightingChannelData(
        id: 'mock-4',
        name: 'Wall Sconce',
        isOn: true,
        brightness: 45,
        isOnline: true,
      ),
      const LightingChannelData(
        id: 'mock-5',
        name: 'Bedside',
        isOn: false,
        brightness: 0,
        isOnline: false,
      ),
    ]);

    // TODO: Remove test capabilities override
    final testCapabilities = <LightCapability>{
      LightCapability.power,
      LightCapability.brightness,
      LightCapability.colorTemp,
      LightCapability.color,
      LightCapability.white,
    };

    // Use test capabilities or real capabilities
    final capabilities = testCapabilities.isNotEmpty ? testCapabilities : allCapabilities;

    return LightingControlPanel(
      // Header
      title: _getRoleName(widget.role),
      subtitle: '${channels.length} channels',
      icon: _getRoleIcon(widget.role),
      onBack: () => Navigator.pop(context),

      // Current values (using local state for testing)
      isOn: _isOn,
      brightness: _brightness,
      colorTemp: _colorTemp,
      color: _color,
      saturation: _saturation,
      whiteChannel: _whiteChannel,

      // Configuration
      capabilities: capabilities,
      state: testState,
      channels: channels,

      // Callbacks
      onPowerToggle: () {
        debugPrint('[Test] Power toggled');
        setState(() => _isOn = !_isOn);
      },
      onBrightnessChanged: (value) {
        debugPrint('[Test] Brightness changed: $value');
        setState(() => _brightness = value);
      },
      onColorTempChanged: (value) {
        debugPrint('[Test] Color temp changed: $value');
        setState(() => _colorTemp = value);
      },
      onColorChanged: (color, saturation) {
        debugPrint('[Test] Color changed: $color, saturation: $saturation');
        setState(() {
          _color = color;
          _saturation = saturation;
        });
      },
      onWhiteChannelChanged: (value) {
        debugPrint('[Test] White channel changed: $value');
        setState(() => _whiteChannel = value);
      },
      onChannelIconTap: (channel) {
        debugPrint('[Test] Channel icon tapped: ${channel.name} (toggle)');
      },
      onChannelTileTap: (channel) {
        debugPrint('[Test] Channel tile tapped: ${channel.name} (navigate)');
      },
      onSyncAll: () {
        debugPrint('[Test] Sync all pressed');
      },
    );
  }

  String _getRoleName(LightTargetRole role) {
    switch (role) {
      case LightTargetRole.main:
        return 'Main';
      case LightTargetRole.task:
        return 'Task';
      case LightTargetRole.ambient:
        return 'Ambient';
      case LightTargetRole.accent:
        return 'Accent';
      case LightTargetRole.night:
        return 'Night';
      case LightTargetRole.other:
        return 'Other';
      case LightTargetRole.hidden:
        return 'Hidden';
    }
  }

  IconData _getRoleIcon(LightTargetRole role) {
    switch (role) {
      case LightTargetRole.main:
        return Icons.light;
      case LightTargetRole.task:
        return Icons.work_outline;
      case LightTargetRole.ambient:
        return Icons.wb_twilight;
      case LightTargetRole.accent:
        return Icons.highlight;
      case LightTargetRole.night:
        return Icons.nightlight_round;
      case LightTargetRole.other:
        return Icons.lightbulb_outline;
      case LightTargetRole.hidden:
        return Icons.visibility_off;
    }
  }
}
