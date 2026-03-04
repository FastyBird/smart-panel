import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class DeviceDetailConfig {
  final String? titleOverride;
  final IconData? iconOverride;
  final bool showBackButton;
  final bool showHeader;
  final Widget? trailing;

  const DeviceDetailConfig({
    this.titleOverride,
    this.iconOverride,
    this.showBackButton = true,
    this.showHeader = true,
    this.trailing,
  });
}

Widget? buildCombinedTrailing({DeviceDetailConfig? config, Widget? deviceTrailing}) {
  final configTrailing = config?.trailing;
  if (configTrailing == null && deviceTrailing == null) return null;
  if (configTrailing == null) return deviceTrailing;
  if (deviceTrailing == null) return configTrailing;
  return Row(
    mainAxisSize: MainAxisSize.min,
    spacing: AppSpacings.pSm,
    children: [configTrailing, deviceTrailing],
  );
}
