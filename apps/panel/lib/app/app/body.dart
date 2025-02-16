import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/app/routes.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/types/configuration.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/device_detail.dart';
import 'package:fastybird_smart_panel/features/overlay/lock.dart';
import 'package:fastybird_smart_panel/features/overlay/screen_saver.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart';

class AppBody extends StatefulWidget {
  const AppBody({super.key});

  @override
  State<AppBody> createState() => _AppBodyState();
}

class _AppBodyState extends State<AppBody> {
  final ConfigurationRepository _configurationRepository =
      locator<ConfigurationRepository>();

  bool _hasDarkMode = false;
  Language _language = Language.english;
  int _screenLockDuration = 30;

  Timer? _inactivityTimer;

  Offset? _swipeStartPosition;
  bool _isSwipingVertically = false;

  @override
  void initState() {
    super.initState();

    _hasDarkMode = _configurationRepository.displayConfiguration.hasDarkMode;
    _language = _configurationRepository.languageConfiguration.language;
    _screenLockDuration =
        _configurationRepository.displayConfiguration.screenLockDuration;

    _configurationRepository.addListener(_onConfigurationChanged);

    _resetInactivityTimer();
  }

  @override
  void dispose() {
    _inactivityTimer?.cancel();

    _configurationRepository.removeListener(_onConfigurationChanged);

    super.dispose();
  }

  void _onConfigurationChanged() {
    setState(() {
      _hasDarkMode = _configurationRepository.displayConfiguration.hasDarkMode;
      _language = _configurationRepository.languageConfiguration.language;
      _screenLockDuration =
          _configurationRepository.displayConfiguration.screenLockDuration;
    });
  }

  void _resetInactivityTimer() {
    _inactivityTimer?.cancel();

    if (_screenLockDuration > 0) {
      _inactivityTimer = Timer(Duration(seconds: _screenLockDuration), () {
        // After configured time of inactivity, navigate to the screen saver
        locator<NavigationService>().navigatorKey.currentState?.push(
          MaterialPageRoute(
            builder: (context) {
              if (_configurationRepository
                  .displayConfiguration.hasScreenSaver) {
                return ScreenSaverScreen();
              }

              return LockScreen();
            },
          ),
        ).then((_) {
          // Reset inactivity timer or perform necessary actions
          _resetInactivityTimer();
        });
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: _hasDarkMode ? ThemeMode.dark : ThemeMode.light,
      debugShowCheckedModeBanner: false,
      title: 'FastyBird Smart Panel',
      navigatorKey: locator<NavigationService>().navigatorKey,
      navigatorObservers: [
        OverlayScreenObserver(
          onOverlayScreenPushed: () {
            // Stop the screensaver timer
            _inactivityTimer?.cancel();
          },
          onOverlayScreenPopped: () {
            // Restart the screensaver timer
            _resetInactivityTimer();
          },
        ),
      ],
      builder: (context, child) {
        return GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => _resetInactivityTimer(),
          onPanDown: (DragDownDetails details) => _resetInactivityTimer(),
          onPanStart: (details) {
            _swipeStartPosition = details.globalPosition;
          },
          onPanUpdate: (details) {
            if (_swipeStartPosition == null) return;

            final delta = details.globalPosition - _swipeStartPosition!;
            // Check if the swipe is vertical enough
            if (!_isSwipingVertically && delta.dy.abs() > delta.dx.abs()) {
              _isSwipingVertically = true;
            }

            // Once confirmed vertical, decide swipe direction
            if (_isSwipingVertically) {
              if (delta.dy > 20) {
                // Swipe down detected
                locator<NavigationService>()
                    .navigatorKey
                    .currentState
                    ?.pushNamed('/settings');
              } else if (delta.dy < -20) {
                // Swipe up detected
              }
            }
          },
          onPanEnd: (_) {
            _swipeStartPosition = null;
            _isSwipingVertically = false;
          },
          child: child,
        );
      },
      initialRoute: '/',
      routes: appRoutes,
      onGenerateRoute: (settings) {
        if (settings.name != null) {
          final uri = Uri.parse(settings.name!);

          if (uri.pathSegments.length == 2 && uri.pathSegments[0] == 'device') {
            final id = uri.pathSegments[1];

            return MaterialPageRoute(
              builder: (context) => DeviceDetailPage(id),
            );
          }
        }
        return null; // Fallback to default behavior
      },
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: Language.values.map(
        (item) => Locale(item.value.split('_')[0], item.value.split('_')[1]),
      ),
      locale: Locale(
        _language.value.split('_')[0],
        _language.value.split('_')[1],
      ),
      localeResolutionCallback: (locale, supportedLocales) {
        // Synchronize Intl with the app's locale
        Intl.defaultLocale = locale?.toLanguageTag();

        return locale;
      },
    );
  }
}

class OverlayScreenObserver extends NavigatorObserver {
  final VoidCallback onOverlayScreenPushed;
  final VoidCallback onOverlayScreenPopped;

  OverlayScreenObserver({
    required this.onOverlayScreenPushed,
    required this.onOverlayScreenPopped,
  });

  @override
  void didPush(Route route, Route? previousRoute) {
    if (route.settings.name != null &&
        ['reboot', 'power_off', 'reset'].contains(route.settings.name)) {
      onOverlayScreenPushed();
    }

    super.didPush(route, previousRoute);
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    if (route.settings.name != null &&
        ['reboot', 'power_off', 'reset'].contains(route.settings.name)) {
      onOverlayScreenPopped();
    }

    super.didPop(route, previousRoute);
  }
}
