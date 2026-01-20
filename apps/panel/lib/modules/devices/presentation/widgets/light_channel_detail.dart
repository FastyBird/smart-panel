import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Full-page detail view for a single light channel.
///
/// Used when tapping on a channel tile in a multi-channel device.
/// Uses LightSingleChannelControlPanel for the actual controls.
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
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  DevicesService? _devicesService;
  DeviceControlStateService? _deviceControlStateService;
  LightChannelController? _controller;

  // Store fresh views from service
  LightingDeviceView? _currentDevice;
  LightChannelView? _currentChannel;

  @override
  void initState() {
    super.initState();

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDevicesServiceChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LightChannelDetailPage] Failed to get DevicesService: $e');
      }
    }

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[LightChannelDetailPage] Failed to get DeviceControlStateService: $e');
      }
    }

    _updateViewsFromService();
    _initController();
  }

  @override
  void dispose() {
    _devicesService?.removeListener(_onDevicesServiceChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    final devicesService = _devicesService;
    final channel = _getChannel();
    final device = _getDevice();

    if (controlState != null && devicesService != null) {
      _controller = LightChannelController(
        deviceId: device.id,
        channel: channel,
        controlState: controlState,
        devicesService: devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint(
          '[LightChannelDetailPage] Controller error for $propertyId: $error');
    }

    final localizations = AppLocalizations.of(context);
    if (mounted && localizations != null) {
      AlertBar.showError(context, message: localizations.action_failed);
    }

    if (mounted) {
      setState(() {});
    }
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
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
    _initController();
    setState(() {});
  }

  @override
  void didUpdateWidget(covariant LightChannelDetailPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Rebuild when channel parameter changes
    if (oldWidget.channel.id != widget.channel.id ||
        oldWidget.device.id != widget.device.id) {
      _updateViewsFromService();
      _initController();
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final device = _getDevice();
    final localizations = AppLocalizations.of(context);
    final controller = _controller;

    // Guard against missing controller
    if (controller == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppTopBar(
        title: controller.channel.name,
        icon: buildDeviceIcon(device.category, device.icon),
        actions: _buildHeaderActions(context, device, localizations),
      ),
      body: SafeArea(
        child: LightSingleChannelControlPanel(
          controller: controller,
          deviceName: device.name,
          showHeader: false,
        ),
      ),
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
}
