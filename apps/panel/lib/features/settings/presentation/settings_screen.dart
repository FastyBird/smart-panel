import 'package:fastybird_smart_panel/features/settings/presentation/account_settings_page.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/general_settings_page.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/privacy_settings_page.dart';
import 'package:flutter/material.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  void _onVerticalSwipe(DragEndDetails details, BuildContext context) {
    if (details.primaryVelocity != null && details.primaryVelocity! < 0) {
      // Swipe up detected
      Navigator.of(context, rootNavigator: true)
          .pop(); // Navigate back to HomeScreen
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GestureDetector(
        onVerticalDragEnd: (details) => _onVerticalSwipe(details, context),
        child: Navigator(
          initialRoute: 'general',
          onGenerateRoute: (settings) {
            WidgetBuilder builder;
            switch (settings.name) {
              case 'general':
                builder = (BuildContext _) => const GeneralSettingsPage();
                break;
              case 'account':
                builder = (BuildContext _) => const AccountSettingsPage();
                break;
              case 'privacy':
                builder = (BuildContext _) => const PrivacySettingsPage();
                break;
              default:
                throw Exception('Invalid route: ${settings.name}');
            }
            return MaterialPageRoute(builder: builder, settings: settings);
          },
        ),
      ),
    );
  }
}
