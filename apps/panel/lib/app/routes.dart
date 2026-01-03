import 'package:fastybird_smart_panel/features/dashboard/presentation/deck_dashboard.dart';
import 'package:fastybird_smart_panel/features/overlay/presentation/power_off.dart';
import 'package:fastybird_smart_panel/features/overlay/presentation/reboot.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/settings.dart';
import 'package:flutter/material.dart';

class AppRouteNames {
  static const String root = '/';
  static const String settings = '/settings';
  static const String reboot = '/settings/reboot';
  static const String powerOff = '/settings/power-off';
  static const String factoryReset = '/settings/reset';
}

final Map<String, WidgetBuilder> appRoutes = {
  AppRouteNames.root: (context) => const DeckDashboardScreen(),
  AppRouteNames.settings: (context) => const SettingsScreen(),
  AppRouteNames.reboot: (context) => const RebootScreen(),
  AppRouteNames.powerOff: (context) => const PowerOffScreen(),
  AppRouteNames.factoryReset: (context) => const PowerOffScreen(),
};
