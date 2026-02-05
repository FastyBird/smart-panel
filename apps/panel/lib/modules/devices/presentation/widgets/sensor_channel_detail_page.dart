import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_enum_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_detail_content.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Standalone page for viewing a single sensor channel's detail.
///
/// Builds a Scaffold with a header and [SensorDetailContent] body.
/// Use this when navigating to a sensor detail from any device type
/// (e.g. tapping a temperature sensor tile on an air conditioner).
class SensorChannelDetailPage extends StatelessWidget {
  final SensorData sensor;
  final String deviceName;
  final bool isDeviceOnline;

  const SensorChannelDetailPage({
    super.key,
    required this.sensor,
    required this.deviceName,
    required this.isDeviceOnline,
  });

  ThemeColors get _themeColor =>
      SensorColors.themeColorForCategory(sensor.channel.category);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? AppBgColorDark.page : AppBgColorLight.page;
    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: SensorEnumUtils.translateSensorLabel(
                  AppLocalizations.of(context)!, sensor.channel.category),
              subtitle: deviceName,
              leading: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  HeaderIconButton(
                    icon: MdiIcons.arrowLeft,
                    onTap: () => Navigator.pop(context),
                  ),
                  AppSpacings.spacingMdHorizontal,
                  HeaderMainIcon(
                    icon: sensor.icon,
                    color: _themeColor,
                  ),
                ],
              ),
            ),
            Expanded(
              child: SensorDetailContent(
                sensor: sensor,
                deviceName: deviceName,
                isDeviceOnline: isDeviceOnline,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
