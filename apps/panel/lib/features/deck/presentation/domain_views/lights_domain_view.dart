import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// Lights domain page - displays all lighting devices in a room with toggle controls.
///
/// Provides:
/// - List/grid of lighting devices for the assigned room
/// - Per-device on/off toggle with real-time state updates
/// - Long-press to open device detail page for advanced controls
/// - Graceful handling of devices without toggle capability
class LightsDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const LightsDomainViewPage({super.key, required this.viewItem});

  @override
  State<LightsDomainViewPage> createState() => _LightsDomainViewPageState();
}

class _LightsDomainViewPageState extends State<LightsDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  // Track which devices are currently being toggled
  final Set<String> _togglingDevices = {};

  String get _roomId => widget.viewItem.roomId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppTopBar(
        title: widget.viewItem.title,
        icon: DomainType.lights.icon,
      ),
      body: SafeArea(
        child: Consumer<DevicesService>(
          builder: (context, devicesService, _) {
            final devices = _getLightingDevices(devicesService);

            if (devices.isEmpty) {
              return _buildEmptyState(context);
            }

            return _buildDeviceGrid(context, devices, devicesService);
          },
        ),
      ),
    );
  }

  /// Get all lighting devices for this room.
  List<LightingDeviceView> _getLightingDevices(DevicesService devicesService) {
    final allDevices = devicesService.getDevicesForRoomByCategory(
      _roomId,
      DevicesModuleDeviceCategory.lighting,
    );

    // Cast to LightingDeviceView for type-safe access
    return allDevices
        .whereType<LightingDeviceView>()
        .toList()
      ..sort((a, b) => a.name.compareTo(b.name));
  }

  /// Build the device grid/list.
  Widget _buildDeviceGrid(
    BuildContext context,
    List<LightingDeviceView> devices,
    DevicesService devicesService,
  ) {
    return Padding(
      padding: AppSpacings.paddingMd,
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Calculate tile width based on available space
          final tileWidth = _screenService.scale(
            160,
            density: _visualDensityService.density,
          );
          final crossAxisCount = (constraints.maxWidth / tileWidth).floor().clamp(2, 4);

          return GridView.builder(
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossAxisCount,
              crossAxisSpacing: AppSpacings.pMd,
              mainAxisSpacing: AppSpacings.pMd,
              childAspectRatio: 1.0,
            ),
            itemCount: devices.length,
            itemBuilder: (context, index) {
              return _buildDeviceTile(
                context,
                devices[index],
                devicesService,
              );
            },
          );
        },
      ),
    );
  }

  /// Build a single device tile.
  Widget _buildDeviceTile(
    BuildContext context,
    LightingDeviceView device,
    DevicesService devicesService,
  ) {
    final isOn = device.isOn;
    final isToggling = _togglingDevices.contains(device.id);
    final canToggle = _canDeviceToggle(device);

    return GestureDetector(
      onTap: canToggle && !isToggling
          ? () => _toggleDevice(context, device, devicesService)
          : null,
      onLongPress: () => _openDeviceDetail(context, device),
      child: Container(
        decoration: BoxDecoration(
          color: isOn
              ? (Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.warning.withValues(alpha: 0.15)
                  : AppColorsDark.warning.withValues(alpha: 0.2))
              : (Theme.of(context).brightness == Brightness.light
                  ? AppBgColorLight.page.withValues(alpha: 0.5)
                  : AppBgColorDark.overlay.withValues(alpha: 0.5)),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isOn
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.warning.withValues(alpha: 0.3)
                    : AppColorsDark.warning.withValues(alpha: 0.4))
                : Colors.transparent,
            width: 1,
          ),
        ),
        child: Padding(
          padding: AppSpacings.paddingSm,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Device icon with state indicator
              _buildDeviceIcon(context, device, isOn, isToggling),
              AppSpacings.spacingSmVertical,
              // Device name
              Text(
                device.name,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.primary
                      : AppTextColorDark.primary,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              AppSpacings.spacingXsVertical,
              // State text
              _buildStateText(context, device, isOn, canToggle),
            ],
          ),
        ),
      ),
    );
  }

  /// Build the device icon with state indicator.
  Widget _buildDeviceIcon(
    BuildContext context,
    LightingDeviceView device,
    bool isOn,
    bool isToggling,
  ) {
    final iconSize = _screenService.scale(
      40,
      density: _visualDensityService.density,
    );

    if (isToggling) {
      return SizedBox(
        width: iconSize,
        height: iconSize,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: Theme.of(context).colorScheme.primary,
        ),
      );
    }

    return Icon(
      isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
      size: iconSize,
      color: isOn
          ? (Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.warning
              : AppColorsDark.warning)
          : (Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.placeholder
              : AppTextColorDark.placeholder),
    );
  }

  /// Build the state text below the device name.
  Widget _buildStateText(
    BuildContext context,
    LightingDeviceView device,
    bool isOn,
    bool canToggle,
  ) {
    final localizations = AppLocalizations.of(context);

    String stateText;
    if (!canToggle) {
      stateText = localizations?.device_state_read_only ?? 'Read-only';
    } else if (isOn) {
      // Show brightness if available
      if (device.hasBrightness && device.lightChannels.isNotEmpty) {
        final brightness = device.lightChannels.first.brightness;
        stateText = '$brightness%';
      } else {
        stateText = localizations?.device_state_on ?? 'On';
      }
    } else {
      stateText = localizations?.device_state_off ?? 'Off';
    }

    return Text(
      stateText,
      style: TextStyle(
        fontSize: AppFontSize.extraSmall,
        color: isOn
            ? (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.warningDark2
                : AppColorsDark.warningDark2)
            : (Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.placeholder
                : AppTextColorDark.placeholder),
      ),
    );
  }

  /// Check if a device supports toggle control.
  bool _canDeviceToggle(LightingDeviceView device) {
    if (device.lightChannels.isEmpty) {
      return false;
    }

    // Check if any channel has an 'on' property
    return device.lightChannels.any((channel) {
      try {
        // This will throw if onProp is not available
        final _ = channel.onProp;
        return true;
      } catch (_) {
        return false;
      }
    });
  }

  /// Toggle the device on/off state.
  Future<void> _toggleDevice(
    BuildContext context,
    LightingDeviceView device,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);

    setState(() {
      _togglingDevices.add(device.id);
    });

    try {
      final success = await devicesService.toggleDeviceOnState(device.id);

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
        setState(() {
          _togglingDevices.remove(device.id);
        });
      }
    }
  }

  /// Open the device detail page for advanced controls.
  void _openDeviceDetail(BuildContext context, LightingDeviceView device) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(device.id),
      ),
    );
  }

  /// Build the empty state when no devices are found.
  Widget _buildEmptyState(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return Center(
      child: Padding(
        padding: AppSpacings.paddingLg,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.lightbulbOffOutline,
              size: _screenService.scale(
                64,
                density: _visualDensityService.density,
              ),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
            ),
            AppSpacings.spacingMdVertical,
            Text(
              localizations?.lights_empty_state_title ?? 'No Lights',
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
              textAlign: TextAlign.center,
            ),
            AppSpacings.spacingSmVertical,
            Text(
              localizations?.lights_empty_state_description ??
                  'No lighting devices found in this room',
              style: TextStyle(
                fontSize: AppFontSize.small,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.placeholder
                    : AppTextColorDark.placeholder,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
