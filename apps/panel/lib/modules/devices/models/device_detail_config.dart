import 'package:flutter/material.dart';

class DeviceDetailConfig {
  final String? titleOverride;
  final IconData? iconOverride;
  final bool showBackButton;
  final bool showHeader;

  const DeviceDetailConfig({
    this.titleOverride,
    this.iconOverride,
    this.showBackButton = true,
    this.showHeader = true,
  });
}
