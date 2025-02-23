import 'package:fastybird_smart_panel/features/settings/presentation/pages/about.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/pages/audio_settings.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/pages/display_settings.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/pages/general_settings.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/pages/language_settings.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/pages/maintenance.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/pages/weather_settings.dart';
import 'package:flutter/material.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onVerticalDragEnd: (details) => _onVerticalSwipe(details, context),
      child: Navigator(
        initialRoute: 'general',
        onGenerateRoute: (settings) {
          WidgetBuilder builder;
          switch (settings.name) {
            case 'general':
              builder = (BuildContext _) => GeneralSettingsPage();
              break;
            case 'display-settings':
              builder = (BuildContext _) => const DisplaySettingsPage();
              break;
            case 'language-settings':
              builder = (BuildContext _) => LanguageSettingsPage();
              break;
            case 'audio-settings':
              builder = (BuildContext _) => AudioSettingsPage();
              break;
            case 'weather-settings':
              builder = (BuildContext _) => const WeatherSettingsPage();
              break;
            case 'about':
              builder = (BuildContext _) => const AboutPage();
              break;
            case 'maintenance':
              builder = (BuildContext _) => MaintenancePage();
              break;
            default:
              throw Exception('Invalid route: ${settings.name}');
          }
          return MaterialPageRoute(builder: builder, settings: settings);
        },
      ),
    );
  }

  void _onVerticalSwipe(DragEndDetails details, BuildContext context) {
    if (details.primaryVelocity != null && details.primaryVelocity! < 0) {
      // Swipe up detected
      Navigator.of(context, rootNavigator: true).pop();
    }
  }
}
