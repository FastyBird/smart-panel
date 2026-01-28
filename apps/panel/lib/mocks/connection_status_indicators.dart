// ============================================================================
// CONNECTION STATUS INDICATORS - FastyBird Smart Panel
// ============================================================================
// Demo app for testing WebSocket connection UI components.
// Shows all connection states and UI severity levels.
// ============================================================================

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/types/connection_state.dart';
import 'package:fastybird_smart_panel/core/widgets/connection/export.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_connection_lost.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

// ============================================================================
// DEMO APP
// ============================================================================

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Register mock services for demo
  if (!locator.isRegistered<VisualDensityService>()) {
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 2.0),
    );
  }

  if (!locator.isRegistered<ScreenService>()) {
    locator.registerSingleton<ScreenService>(
      ScreenService(
        screenWidth: 1080,
        screenHeight: 1920,
        pixelRatio: 2.0,
      ),
    );
  }

  runApp(const ConnectionStatusDemo());
}

class ConnectionStatusDemo extends StatefulWidget {
  const ConnectionStatusDemo({super.key});

  @override
  State<ConnectionStatusDemo> createState() => _ConnectionStatusDemoState();
}

class _ConnectionStatusDemoState extends State<ConnectionStatusDemo> {
  bool _isDark = true;
  SocketConnectionState _state = SocketConnectionState.reconnecting;
  Duration _disconnectedDuration = const Duration(seconds: 5);
  bool _showRecoveryToast = false;

  Timer? _durationTimer;

  final List<SocketConnectionState> _states = [
    SocketConnectionState.initializing,
    SocketConnectionState.online,
    SocketConnectionState.reconnecting,
    SocketConnectionState.offline,
    SocketConnectionState.authError,
    SocketConnectionState.serverUnavailable,
    SocketConnectionState.networkUnavailable,
  ];

  @override
  void initState() {
    super.initState();
    _startDurationTimer();
  }

  @override
  void dispose() {
    _durationTimer?.cancel();
    super.dispose();
  }

  void _startDurationTimer() {
    _durationTimer?.cancel();
    if (_state == SocketConnectionState.reconnecting) {
      _durationTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        setState(() {
          _disconnectedDuration += const Duration(seconds: 1);
        });
      });
    }
  }

  void _setState(SocketConnectionState state) {
    setState(() {
      _state = state;
      if (state == SocketConnectionState.reconnecting) {
        _disconnectedDuration = Duration.zero;
        _startDurationTimer();
      } else {
        _durationTimer?.cancel();
      }

      // Show recovery toast when transitioning to online
      if (state == SocketConnectionState.online) {
        _showRecoveryToast = true;
      }
    });
  }

  ConnectionUISeverity get _severity {
    switch (_state) {
      case SocketConnectionState.online:
        return ConnectionUISeverity.none;
      case SocketConnectionState.initializing:
        return ConnectionUISeverity.splash;
      case SocketConnectionState.reconnecting:
        if (_disconnectedDuration.inSeconds < 2) {
          return ConnectionUISeverity.none;
        }
        if (_disconnectedDuration.inSeconds < 10) {
          return ConnectionUISeverity.banner;
        }
        return ConnectionUISeverity.overlay;
      case SocketConnectionState.offline:
      case SocketConnectionState.authError:
      case SocketConnectionState.serverUnavailable:
      case SocketConnectionState.networkUnavailable:
        return ConnectionUISeverity.fullScreen;
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: _isDark ? ThemeData.dark() : ThemeData.light(),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en', 'US'),
        Locale('cs', 'CZ'),
      ],
      locale: const Locale('en', 'US'),
      home: Scaffold(
        backgroundColor: _isDark ? const Color(0xFF1A1A1A) : const Color(0xFFF5F5F5),
        appBar: AppBar(
          backgroundColor: _isDark ? const Color(0xFF2A2A2A) : Colors.white,
          title: const Text('Connection Status Demo'),
          actions: [
            IconButton(
              icon: Icon(_isDark ? Icons.light_mode : Icons.dark_mode),
              onPressed: () => setState(() => _isDark = !_isDark),
            ),
          ],
        ),
        body: Column(
          children: [
            // State info
            Container(
              padding: const EdgeInsets.all(16),
              color: _isDark ? const Color(0xFF2A2A2A) : Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'State: ${_state.name}',
                    style: TextStyle(
                      color: _isDark ? Colors.white : Colors.black,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Severity: ${_severity.name}',
                    style: TextStyle(
                      color: _isDark ? Colors.grey : Colors.grey[700],
                    ),
                  ),
                  if (_state == SocketConnectionState.reconnecting)
                    Text(
                      'Disconnected: ${_disconnectedDuration.inSeconds}s',
                      style: TextStyle(
                        color: _isDark ? Colors.grey : Colors.grey[700],
                      ),
                    ),
                ],
              ),
            ),
            // State selector
            Container(
              height: 60,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _states.length,
                itemBuilder: (context, index) {
                  final state = _states[index];
                  final isSelected = state == _state;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(
                      label: Text(_getStateLabel(state)),
                      selected: isSelected,
                      onSelected: (_) => _setState(state),
                      selectedColor: _getColorForState(state),
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.white : Colors.grey,
                        fontSize: 11,
                      ),
                    ),
                  );
                },
              ),
            ),
            // Demo content
            Expanded(
              child: _buildDemo(),
            ),
          ],
        ),
      ),
    );
  }

  String _getStateLabel(SocketConnectionState state) {
    switch (state) {
      case SocketConnectionState.initializing:
        return 'Init';
      case SocketConnectionState.online:
        return 'Online';
      case SocketConnectionState.reconnecting:
        return 'Reconn';
      case SocketConnectionState.offline:
        return 'Offline';
      case SocketConnectionState.authError:
        return 'Auth';
      case SocketConnectionState.serverUnavailable:
        return 'Server';
      case SocketConnectionState.networkUnavailable:
        return 'Network';
    }
  }

  Color _getColorForState(SocketConnectionState state) {
    switch (state) {
      case SocketConnectionState.online:
        return const Color(0xFF66BB6A);
      case SocketConnectionState.initializing:
        return const Color(0xFF42A5F5);
      case SocketConnectionState.reconnecting:
        return const Color(0xFFFF9800);
      case SocketConnectionState.offline:
      case SocketConnectionState.authError:
      case SocketConnectionState.serverUnavailable:
      case SocketConnectionState.networkUnavailable:
        return const Color(0xFFEF5350);
    }
  }

  Widget _buildDemo() {
    final cardColor = _isDark ? const Color(0xFF2A2A2A) : Colors.white;

    return Stack(
      children: [
        // Mock content
        Container(
          color: _isDark ? const Color(0xFF1A1A1A) : const Color(0xFFF5F5F5),
          child: _buildMockContent(cardColor),
        ),
        // Connection UI based on severity
        ..._buildConnectionUI(),
        // Recovery toast
        if (_showRecoveryToast)
          ConnectionRecoveryToast(
            onDismiss: () => setState(() => _showRecoveryToast = false),
          ),
      ],
    );
  }

  List<Widget> _buildConnectionUI() {
    switch (_severity) {
      case ConnectionUISeverity.none:
        return [];
      case ConnectionUISeverity.banner:
        return [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: ConnectionBanner(
              onRetry: () => _setState(SocketConnectionState.reconnecting),
            ),
          ),
        ];
      case ConnectionUISeverity.overlay:
        return [
          Positioned.fill(
            child: ConnectionOverlay(
              disconnectedDuration: _disconnectedDuration,
              onRetry: () {
                setState(() {
                  _disconnectedDuration = Duration.zero;
                });
                _startDurationTimer();
              },
            ),
          ),
        ];
      case ConnectionUISeverity.splash:
        return [
          Positioned.fill(
            child: Container(
              color: _isDark ? const Color(0xFF1A1A1A) : Colors.white,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text('Initializing...'),
                  ],
                ),
              ),
            ),
          ),
        ];
      case ConnectionUISeverity.fullScreen:
        return [
          Positioned.fill(
            child: _buildFullScreenError(),
          ),
        ];
    }
  }

  Widget _buildFullScreenError() {
    switch (_state) {
      case SocketConnectionState.authError:
        return AuthErrorScreen(
          onReset: () => _setState(SocketConnectionState.reconnecting),
        );
      case SocketConnectionState.networkUnavailable:
        return NetworkErrorScreen(
          onRetry: () => _setState(SocketConnectionState.reconnecting),
        );
      case SocketConnectionState.serverUnavailable:
        return ServerErrorScreen(
          onRetry: () => _setState(SocketConnectionState.reconnecting),
        );
      case SocketConnectionState.offline:
      default:
        return ConnectionLostScreen(
          onReconnect: () => _setState(SocketConnectionState.reconnecting),
          onChangeGateway: () {},
        );
    }
  }

  Widget _buildMockContent(Color cardColor) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          _buildMockCard(cardColor, 'Living Room', Icons.living),
          const SizedBox(height: 16),
          _buildMockCard(cardColor, 'Kitchen', Icons.kitchen),
          const SizedBox(height: 16),
          _buildMockCard(cardColor, 'Bedroom', Icons.bed),
        ],
      ),
    );
  }

  Widget _buildMockCard(Color color, String title, IconData icon) {
    return Container(
      height: 80,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(
            icon,
            size: 32,
            color: _isDark ? Colors.white70 : Colors.black54,
          ),
          const SizedBox(width: 16),
          Text(
            title,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              color: _isDark ? Colors.white : Colors.black,
            ),
          ),
        ],
      ),
    );
  }
}
