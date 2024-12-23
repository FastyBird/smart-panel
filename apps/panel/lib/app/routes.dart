import 'package:fastybird_smart_panel/features/dashboard/presentation/dashboard.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/settings.dart';
import 'package:flutter/material.dart';

final Map<String, WidgetBuilder> appRoutes = {
  '/': (context) => const DashboardScreen(),
  '/settings': (context) => const SettingsScreen(),
};
