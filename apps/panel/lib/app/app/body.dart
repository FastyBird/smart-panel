import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/app/routes.dart';
import 'package:fastybird_smart_panel/core/services/connection_state_manager.dart';
import 'package:fastybird_smart_panel/core/services/local_preferences.dart';
import 'package:fastybird_smart_panel/modules/displays/services/inactivity_overlay_provider.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
import 'package:fastybird_smart_panel/modules/system/services/system_actions_overlay_provider.dart';
import 'package:fastybird_smart_panel/core/types/connection_state.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/features/overlay/presentation/overlay_renderer.dart';
import 'package:fastybird_smart_panel/core/services/connection_overlay_provider.dart';
import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_provider.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/repositories/security_status.dart';
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
  final SecurityOverlayController _securityOverlayController = locator<SecurityOverlayController>();
  final SecurityStatusRepository _securityStatusRepository = locator<SecurityStatusRepository>();
  final OverlayManager _overlayManager = locator<OverlayManager>();

  final LocalPreferencesService _localPrefs = locator<LocalPreferencesService>();

  late bool _hasDarkMode = _localPrefs.darkMode;
  late Language _language = _localPrefs.language;

  /// Tracks the effective number format — when it changes, forces route rebuilds
  /// by changing the Navigator key.
  NumberFormatSetting? _lastNumberFormat;

  // Connection state management
  final ConnectionStateManager _connectionManager = ConnectionStateManager();

  // Overlay providers
  late final ConnectionOverlayProvider _connectionOverlayProvider;
  late final SecurityOverlayProvider _securityOverlayProvider;
  late final SystemActionsOverlayProvider _systemActionsOverlayProvider;
  late final InactivityOverlayProvider _inactivityOverlayProvider;

  Offset? _swipeStartPosition;
  bool _isSwipingVertically = false;
  bool _swipeActionTriggered = false;
  bool _isSettingsOpen = false;

  @override
  void initState() {
    super.initState();

    // Initialize overlay providers early — _syncStateWithRepository uses them
    _connectionOverlayProvider = ConnectionOverlayProvider(
      overlayManager: _overlayManager,
      connectionManager: _connectionManager,
      navigationService: _navigator,
      onReconnect: _handleReconnect,
      onChangeGateway: _handleChangeGateway,
    );

    _securityOverlayProvider = SecurityOverlayProvider(
      overlayManager: _overlayManager,
      securityController: _securityOverlayController,
      eventBus: locator<EventBus>(),
    );

    _systemActionsOverlayProvider = SystemActionsOverlayProvider(
      overlayManager: _overlayManager,
      eventBus: locator<EventBus>(),
    );

    _inactivityOverlayProvider = InactivityOverlayProvider(
      overlayManager: _overlayManager,
    );

    // Register overlay entries before any state sync that may start timers
    _connectionOverlayProvider.init();
    _securityOverlayProvider.init();
    _systemActionsOverlayProvider.init();
    _inactivityOverlayProvider.init();

    _syncStateWithRepository();
    _initializeDeck();

    _displayRepository.addListener(_syncStateWithRepository);
    _displayRepository.addListener(_onDisplayChanged);
    _systemConfigRepository.addListener(_syncStateWithRepository);

    // Wire security status to overlay controller
    _onSecurityStatusChanged();
    _securityStatusRepository.addListener(_onSecurityStatusChanged);

    // Listen for socket connection changes
    _socketService.addConnectionListener(_onSocketConnectionChanged);
    _socketService.addErrorTypeListener(_onSocketErrorType);

    // Listen to connection state manager for syncing offline state to security
    _connectionManager.addListener(_onSocketConnectionStateChanged);

    // Initialize connection state based on current socket status
    if (_socketService.isConnected) {
      _connectionManager.onConnected();
    }
  }

  void _onSecurityStatusChanged() {
    _securityOverlayController.updateStatus(_securityStatusRepository.status);
  }

  void _onSocketConnectionChanged(bool isConnected) {
    if (isConnected) {
      _connectionManager.onConnected();
    } else {
      _connectionManager.onDisconnected();
    }
  }

  void _onSocketErrorType(ConnectionErrorType errorType) {
    switch (errorType) {
      case ConnectionErrorType.auth:
        _connectionManager.onAuthError();
        break;
      case ConnectionErrorType.serverUnavailable:
        _connectionManager.onServerUnavailable();
        break;
      case ConnectionErrorType.network:
        _connectionManager.onNetworkUnavailable();
        break;
      case ConnectionErrorType.unknown:
        // For unknown errors, trigger disconnect to start escalation timer.
        // This ensures the UI shows reconnecting state instead of staying
        // stuck in initializing with no feedback to the user.
        _connectionManager.onDisconnected();
        break;
    }
  }

  void _onSocketConnectionStateChanged() {
    if (!mounted) return;

    final currentState = _connectionManager.state;

    // Sync offline state to security overlay controller
    _securityOverlayController.setConnectionOffline(
      currentState != SocketConnectionState.online &&
      currentState != SocketConnectionState.initializing,
    );
  }

  void _handleReconnect() {
    // Check if we're in a full-screen error state before reconnecting
    final wasFullScreen = _connectionManager.uiSeverity == ConnectionUISeverity.fullScreen;

    // Trigger manual reconnection attempt
    _socketService.reconnect();

    // Show banner immediately if coming from full-screen to avoid
    // confusing 2-second gap where no UI is shown
    _connectionManager.onReconnecting(showBannerImmediately: wasFullScreen);
  }

  void _handleChangeGateway() {
    // Reset connection state manager
    _connectionManager.reset();
    // Reset to discovery state with proper cleanup
    // This clears credentials, backend URL, and disposes socket
    locator<StartupManagerService>().resetToDiscovery();
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
    _connectionOverlayProvider.dispose();
    _securityOverlayProvider.dispose();
    _systemActionsOverlayProvider.dispose();
    _inactivityOverlayProvider.dispose();

    _displayRepository.removeListener(_syncStateWithRepository);
    _displayRepository.removeListener(_onDisplayChanged);
    _systemConfigRepository.removeListener(_syncStateWithRepository);
    _securityStatusRepository.removeListener(_onSecurityStatusChanged);
    _socketService.removeConnectionListener(_onSocketConnectionChanged);
    _socketService.removeErrorTypeListener(_onSocketErrorType);
    _connectionManager.removeListener(_onSocketConnectionStateChanged);
    _connectionManager.dispose();

    super.dispose();
  }

  void _syncStateWithRepository() {
    final config = _systemConfigRepository.data;
    final newDarkMode = _displayRepository.hasDarkMode;

    // Only update language when config is loaded from backend.
    // When config is null (not yet fetched), keep the cached value
    // from local preferences to avoid overwriting it with English.
    final newLanguage = config?.language ?? _language;
    final languageChanged = newLanguage != _language;

    // Detect number format changes (display override → system config → default)
    final newNumberFormat = _displayRepository.numberFormat ?? config?.numberFormat;
    final numberFormatChanged = newNumberFormat != _lastNumberFormat;

    setState(() {
      _hasDarkMode = newDarkMode;
      _language = newLanguage;
      _lastNumberFormat = newNumberFormat;
    });

    // Persist to local storage so next startup uses correct values immediately.
    // Only persist language when we have actual backend data.
    if (config != null) {
      _localPrefs.setLanguage(newLanguage);
    }
    _localPrefs.setDarkMode(newDarkMode);

    // Synchronize Intl locale so DeckService._resolveLocalizations() works
    // before MaterialApp renders (initState runs before build).
    // localeResolutionCallback sets the same value during build().
    final parts = _language.value.split('_');
    Intl.defaultLocale = Locale(parts[0], parts[1]).toLanguageTag();

    // Rebuild deck when language or number format changes
    if ((languageChanged || numberFormatChanged) && _deckService.isInitialized) {
      final display = _displayRepository.display;
      if (display != null) {
        _deckService.updateDisplay(display);
      }

      // Pop all routes back to root so the deck rebuilds with new settings.
      // Navigator caches routes, so setState alone doesn't refresh them.
      if (numberFormatChanged && _lastNumberFormat != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _navigator.navigatorKey.currentState?.popUntil((route) => route.isFirst);
        });
      }
    }

    _inactivityOverlayProvider.updateConfig(
      screenLockDuration: _displayRepository.screenLockDuration,
      hasScreenSaver: _displayRepository.hasScreenSaver,
    );
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
              onTap: () => _inactivityOverlayProvider.resetTimer(),
              onPanDown: (DragDownDetails details) => _inactivityOverlayProvider.resetTimer(),
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
            // All overlays rendered through the unified OverlayManager
            const OverlayRenderer(),
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
