import 'package:fastybird_smart_panel/features/deck/presentation/deck.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/settings.dart';
import 'package:fastybird_smart_panel/modules/security/presentation/security_screen.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class AppRouteNames {
  static const String root = '/';
  static const String settings = '/settings';
  static const String security = '/security';

  /// The component gallery; registered in debug builds only.
  static const String gallery = '/gallery';
}

final Map<String, WidgetBuilder> appRoutes = {
  AppRouteNames.root: (context) => const DeckDashboardScreen(),
  AppRouteNames.settings: (context) => const SettingsScreen(),
  AppRouteNames.security: (context) => const SecurityScreen(),
  if (kDebugMode)
    AppRouteNames.gallery: (context) => const ComponentGalleryScreen(),
};
