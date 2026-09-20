import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart'
    show buildDeviceIcon;
import 'package:fastybird_smart_panel/modules/devices/models/device_detail_config.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/input_controller.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class InputControllerDeviceDetail extends StatelessWidget {
  final InputControllerDeviceView device;
  final DeviceDetailConfig? config;

  const InputControllerDeviceDetail({
    super.key,
    required this.device,
    this.config,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final buttons = device.buttonChannels;
    final binaryInputs = device.binaryInputChannels;
    final analogInputs = device.analogInputChannels;
    final battery = device.batteryChannel;

    final body = SingleChildScrollView(
      padding: AppSpacings.paddingMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.pMd,
        children: [
          for (final button in buttons)
            UniversalTile(
              layout: TileLayout.horizontal,
              icon: MdiIcons.gestureTapButton,
              name: button.name,
              status: button.event ?? (button.detected ? 'Detected' : 'Idle'),
              isActive: button.detected,
              showGlow: false,
              showDoubleBorder: false,
              showInactiveBorder: false,
            ),
          for (final binaryInput in binaryInputs)
            UniversalTile(
              layout: TileLayout.horizontal,
              icon: MdiIcons.toggleSwitch,
              name: binaryInput.name,
              status: binaryInput.state == true
                  ? 'ON'
                  : binaryInput.state == false
                      ? 'OFF'
                      : '-',
              isActive: binaryInput.state == true,
              showGlow: false,
              showDoubleBorder: false,
              showInactiveBorder: false,
            ),
          for (final analogInput in analogInputs)
            UniversalTile(
              layout: TileLayout.horizontal,
              icon: MdiIcons.tuneVertical,
              name: analogInput.name,
              status: analogInput.value != null
                  ? '${analogInput.value}${analogInput.unit != null ? ' ${analogInput.unit}' : ''}'
                  : '-',
              showGlow: false,
              showDoubleBorder: false,
              showInactiveBorder: false,
            ),
          if (battery != null)
            UniversalTile(
              layout: TileLayout.horizontal,
              icon: MdiIcons.battery,
              name: battery.name,
              status: '${battery.percentage}%',
              showGlow: false,
              showDoubleBorder: false,
              showInactiveBorder: false,
            ),
        ],
      ),
    );

    if (!(config?.showHeader ?? true)) return body;

    final showBack = config?.showBackButton ?? true;
    final iconData =
        config?.iconOverride ?? buildDeviceIcon(device.category, device.icon);

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: config?.titleOverride ?? device.name,
              leading: showBack
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      spacing: AppSpacings.pMd,
                      children: [
                        HeaderIconButton(
                          icon: MdiIcons.arrowLeft,
                          onTap: () => Navigator.of(context).pop(),
                        ),
                        HeaderMainIcon(icon: iconData),
                      ],
                    )
                  : HeaderMainIcon(icon: iconData),
              trailing: config?.trailing,
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
