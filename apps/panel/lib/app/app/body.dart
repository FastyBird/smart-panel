import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/app/routes.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
import 'package:fastybird_smart_panel/core/services/system_actions.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_connection_lost.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/features/overlay/presentation/lock.dart';
import 'package:fastybird_smart_panel/features/overlay/presentation/screen_saver.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/system/models/system.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart';

class AppBody extends StatefulWidget {
  const AppBody({super.key});

  @override
  State<AppBody> createState() => _AppBodyState();
}

class _AppBodyState extends State<AppBody> {
  final DisplayRepository _displayRepository = locator<DisplayRepository>();
  final ConfigModuleService _configModule = locator<ConfigModuleService>();
  late final ModuleConfigRepository<SystemConfigModel> _systemConfigRepository =
      _configModule.getModuleRepository<SystemConfigModel>('system-module');
  final NavigationService _navigator = locator<NavigationService>();
  final DeckService _deckService = locator<DeckService>();
  final SocketService _socketService = locator<SocketService>();
  final EventBus _eventBus = locator<EventBus>();

  bool _hasDarkMode = false;
  Language _language = Language.english;
  int _screenLockDuration = 30;
  bool _hasScreenSaver = true;
  bool _isSocketConnected = true;

  Timer? _inactivityTimer;

  Offset? _swipeStartPosition;
  bool _isSwipingVertically = false;
  bool _swipeActionTriggered = false;
  bool _isSettingsOpen = false;

  @override
  void initState() {
    super.initState();

    _syncStateWithRepository();
    _resetInactivityTimer();
    _initializeDeck();

    _displayRepository.addListener(_syncStateWithRepository);
    _displayRepository.addListener(_onDisplayChanged);
    _systemConfigRepository.addListener(_syncStateWithRepository);
    _socketService.addConnectionListener(_onSocketConnectionChanged);

    locator<SystemActionsService>().init();
  }

  void _onSocketConnectionChanged(bool isConnected) {
    if (mounted) {
      setState(() {
        _isSocketConnected = isConnected;
      });
    }
  }

  void _handleReconnect() {
    // The socket service will automatically attempt to reconnect
    // with exponential backoff. This callback is here for future use
    // if manual reconnection logic is needed.
  }

  void _handleChangeGateway() {
    // Fire event to reset app to discovery state
    _eventBus.fire(ResetToDiscoveryEvent());
  }

  /// Initialize the deck with display settings
  void _initializeDeck() {
    final display = _displayRepository.display;
    if (display != null && !_deckService.isInitialized) {
      _deckService.initialize(display);
    }
  }

  /// Update deck when display settings change
  void _onDisplayChanged() {
    final display = _displayRepository.display;
    if (display != null) {
      if (_deckService.isInitialized) {
        _deckService.updateDisplay(display);
      } else {
        _deckService.initialize(display);
      }
    }
  }

  @override
  void dispose() {
    _inactivityTimer?.cancel();

    _displayRepository.removeListener(_syncStateWithRepository);
    _displayRepository.removeListener(_onDisplayChanged);
    _systemConfigRepository.removeListener(_syncStateWithRepository);
    _socketService.removeConnectionListener(_onSocketConnectionChanged);

    locator<SystemActionsService>().dispose();

    super.dispose();
  }

  void _syncStateWithRepository() {
    final config = _systemConfigRepository.data;
    setState(() {
      _hasDarkMode = _displayRepository.hasDarkMode;
      _language = config?.language ?? Language.english;
      _screenLockDuration = _displayRepository.screenLockDuration;
      _hasScreenSaver = _displayRepository.hasScreenSaver;
    });
  }

  void _resetInactivityTimer() {
    _inactivityTimer?.cancel();

    if (_screenLockDuration > 0) {
      _inactivityTimer = Timer(Duration(seconds: _screenLockDuration), () {
        if (_navigator.getCurrentRouteName() != AppRouteNames.reboot &&
            _navigator.getCurrentRouteName() != AppRouteNames.powerOff &&
            _navigator.getCurrentRouteName() != AppRouteNames.factoryReset) {
          // After configured time of inactivity, navigate to the screen saver
          _navigator.navigatorKey.currentState?.push(
            MaterialPageRoute(
              builder: (context) {
                if (_hasScreenSaver) {
                  return ScreenSaverScreen();
                }

                return LockScreen();
              },
            ),
          ).then((_) {
            // Reset inactivity timer or perform necessary actions
            _resetInactivityTimer();
          });
        } else {
          _resetInactivityTimer();
        }
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
      navigatorKey: _navigator.navigatorKey,
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
        SettingsScreenObserver(
          onSettingsPushed: () {
            // Track that settings is open
            _isSettingsOpen = true;
          },
          onSettingsPopped: () {
            // Reset swipe action flag and track that settings is closed
            _swipeActionTriggered = false;
            _isSettingsOpen = false;
          },
        ),
      ],
      builder: (context, child) {
        return Stack(
          children: [
            GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () => _resetInactivityTimer(),
              onPanDown: (DragDownDetails details) => _resetInactivityTimer(),
              onPanStart: (details) {
                // Reset flag at the start of each new gesture
                _swipeActionTriggered = false;
                _swipeStartPosition = details.globalPosition;
              },
              onPanUpdate: (details) {
                if (_swipeStartPosition == null || _swipeActionTriggered) return;

                final delta = details.globalPosition - _swipeStartPosition!;
                // Check if the swipe is vertical enough
                if (!_isSwipingVertically && delta.dy.abs() > delta.dx.abs()) {
                  _isSwipingVertically = true;
                }

                // Once confirmed vertical, decide swipe direction
                if (_isSwipingVertically) {
                  if (delta.dy > 20) {
                    // Swipe down detected - only trigger once per gesture
                    // Set flag immediately to prevent multiple triggers
                    _swipeActionTriggered = true;
                    // Check if settings is already open to prevent multiple navigations
                    if (!_isSettingsOpen) {
                      _navigator.navigateTo(AppRouteNames.settings);
                    }
                  } else if (delta.dy < -20) {
                    // Swipe up detected
                  }
                }
              },
              onPanEnd: (_) {
                _swipeStartPosition = null;
                _isSwipingVertically = false;
                _swipeActionTriggered = false;
              },
              onPanCancel: () {
                _swipeStartPosition = null;
                _isSwipingVertically = false;
                _swipeActionTriggered = false;
              },
              child: child,
            ),
            // Show connection lost screen when socket is disconnected
            if (!_isSocketConnected)
              ConnectionLostScreen(
                onReconnect: _handleReconnect,
                onChangeGateway: _handleChangeGateway,
              ),
          ],
        );
      },
      initialRoute: AppRouteNames.root,
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

class SettingsScreenObserver extends NavigatorObserver {
  final VoidCallback onSettingsPushed;
  final VoidCallback onSettingsPopped;

  SettingsScreenObserver({
    required this.onSettingsPushed,
    required this.onSettingsPopped,
  });

  @override
  void didPush(Route route, Route? previousRoute) {
    if (route.settings.name == AppRouteNames.settings) {
      onSettingsPushed();
    }

    super.didPush(route, previousRoute);
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    if (route.settings.name == AppRouteNames.settings) {
      onSettingsPopped();
    }

    super.didPop(route, previousRoute);
  }
}
