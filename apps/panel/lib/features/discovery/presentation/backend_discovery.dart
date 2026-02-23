import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';
import 'package:fastybird_smart_panel/core/services/mdns_discovery.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_container.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Discovery state enum
enum DiscoveryState {
  initial,
  searching,
  found,
  notFound,
  error,
  connecting,
}

/// Screen for discovering and selecting backend servers
class BackendDiscoveryScreen extends StatefulWidget {
  /// Callback when a backend is selected
  final void Function(DiscoveredBackend backend) onBackendSelected;

  /// Callback when manual URL is entered
  final void Function(String url) onManualUrlEntered;

  /// Optional error message to display (e.g., when connection failed)
  final String? errorMessage;

  /// Whether this is a retry after connection failure
  final bool isRetry;

  const BackendDiscoveryScreen({
    required this.onBackendSelected,
    required this.onManualUrlEntered,
    this.errorMessage,
    this.isRetry = false,
    super.key,
  });

  @override
  State<BackendDiscoveryScreen> createState() => _BackendDiscoveryScreenState();
}

class _BackendDiscoveryScreenState extends State<BackendDiscoveryScreen> {
  final ScreenService _screenService = locator<ScreenService>();
  final MdnsDiscoveryService _discoveryService = MdnsDiscoveryService();
  final TextEditingController _manualUrlController = TextEditingController();

  DiscoveryState _state = DiscoveryState.initial;
  List<DiscoveredBackend> _backends = [];
  DiscoveredBackend? _selectedBackend;
  bool _showManualEntry = false;
  bool _wasManualEntry = false;

  // Discovery session tracking to prevent race conditions
  // Each discovery operation gets a unique session ID; only the current session
  // can update state, preventing stale results from cancelled operations
  int _discoverySessionId = 0;

  // Validation patterns
  static final RegExp _ipAddressPattern = RegExp(
    r'^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$',
  );
  static final RegExp _hostnamePattern = RegExp(
    r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$',
  );

  @override
  void initState() {
    super.initState();
    _startDiscovery();
    _manualUrlController.addListener(_onManualUrlChanged);

    // Show error toast if there's an error message
    if (widget.errorMessage != null) {
      // Use post-frame callback to show toast after build
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && widget.errorMessage != null) {
          AppToast.showError(context, message: widget.errorMessage!);
        }
      });
    }
  }

  void _onManualUrlChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _manualUrlController.removeListener(_onManualUrlChanged);
    _discoveryService.dispose();
    _manualUrlController.dispose();
    super.dispose();
  }

  Future<void> _startDiscovery() async {
    // Increment session ID to invalidate any pending discovery operations
    final currentSession = ++_discoverySessionId;

    // Dismiss any existing toast when starting new discovery
    AppToast.dismiss();

    setState(() {
      _state = DiscoveryState.searching;
      _backends = [];
      _selectedBackend = null;
      _showManualEntry = false;
    });

    try {
      final backends = await _discoveryService.discover(
        onBackendFound: (backend) {
          // Only update if this is still the current session
          if (mounted && currentSession == _discoverySessionId) {
            setState(() {
              if (!_backends.contains(backend)) {
                _backends = [..._backends, backend];
              }
            });
          }
        },
      );

      // Skip state update if this session was superseded by a newer one
      if (mounted && currentSession == _discoverySessionId) {
        setState(() {
          _backends = backends;

          // In debug mode on Android emulator, add a mock gateway if none found
          if (backends.isEmpty && kDebugMode && Platform.isAndroid) {
            _backends = [
              const DiscoveredBackend(
                name: 'Emulator Gateway (Debug)',
                host: '10.0.2.2',
                port: 3000,
                version: 'dev',
              ),
            ];
            _state = DiscoveryState.found;
          } else {
            _state = backends.isEmpty
                ? DiscoveryState.notFound
                : DiscoveryState.found;
          }
        });
      }
    } catch (e) {
      // Skip error handling if this session was superseded
      if (mounted && currentSession == _discoverySessionId) {
        setState(() {
          _state = DiscoveryState.error;
        });
        final localizations = AppLocalizations.of(context)!;
        AppToast.showError(
          context,
          message: localizations.discovery_error_failed(e.toString()),
        );
      }
    }
  }

  void _selectBackend(DiscoveredBackend backend) {
    setState(() {
      _selectedBackend = _selectedBackend == backend ? null : backend;
    });
  }

  Future<void> _cancelDiscovery() async {
    // Increment session ID to invalidate the current discovery operation
    _discoverySessionId++;
    await _discoveryService.stop();
    if (mounted) {
      setState(() {
        _state = _backends.isEmpty
            ? DiscoveryState.notFound
            : DiscoveryState.found;
      });
    }
  }

  void _confirmSelection() {
    if (_selectedBackend != null) {
      AppToast.dismiss();
      setState(() {
        _state = DiscoveryState.connecting;
        _wasManualEntry = false;
      });
      widget.onBackendSelected(_selectedBackend!);
    }
  }

  /// Validates the entered address (IP or hostname with optional port)
  bool _isValidAddress(String address) {
    // Remove protocol if present
    String cleanAddress = address.trim();
    if (cleanAddress.toLowerCase().startsWith('http://')) {
      cleanAddress = cleanAddress.substring(7);
    } else if (cleanAddress.toLowerCase().startsWith('https://')) {
      cleanAddress = cleanAddress.substring(8);
    }

    // Remove path if present
    final pathIndex = cleanAddress.indexOf('/');
    if (pathIndex != -1) {
      cleanAddress = cleanAddress.substring(0, pathIndex);
    }

    // Separate host and port
    String host = cleanAddress;
    if (cleanAddress.contains(':')) {
      final parts = cleanAddress.split(':');
      if (parts.length == 2) {
        host = parts[0];
        final port = int.tryParse(parts[1]);
        if (port == null || port < 1 || port > 65535) {
          return false;
        }
      } else {
        return false;
      }
    }

    // Validate host (IP address or hostname)
    if (host.isEmpty) {
      return false;
    }

    return _ipAddressPattern.hasMatch(host) || _hostnamePattern.hasMatch(host);
  }

  void _submitManualUrl() {
    final url = _manualUrlController.text.trim();
    final localizations = AppLocalizations.of(context)!;

    if (url.isEmpty) {
      AppToast.showWarning(
        context,
        message: localizations.discovery_validation_empty,
      );
      return;
    }

    if (!_isValidAddress(url)) {
      AppToast.showError(
        context,
        message: localizations.discovery_validation_invalid,
      );
      return;
    }

    AppToast.dismiss();
    setState(() {
      _state = DiscoveryState.connecting;
      _wasManualEntry = true;
    });

    widget.onManualUrlEntered(url);
  }

  void _showManualEntryForm() {
    setState(() {
      _showManualEntry = true;
    });
  }

  void _backToDiscovery() {
    setState(() {
      _showManualEntry = false;
    });
    // Restart discovery if we were in an error state or not found
    if (_state == DiscoveryState.error ||
        _state == DiscoveryState.notFound ||
        _backends.isEmpty) {
      _startDiscovery();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.base,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isLandscape = constraints.maxWidth > constraints.maxHeight;

            return _buildContent(context, isDark, isLandscape);
          },
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, bool isDark, bool isLandscape) {
    if (_state == DiscoveryState.connecting) {
      return _buildConnectingState(context, isDark, isLandscape);
    }

    if (_showManualEntry) {
      return _buildManualEntryForm(context, isDark, isLandscape);
    }

    switch (_state) {
      case DiscoveryState.initial:
      case DiscoveryState.searching:
        return _buildSearchingState(context, isDark, isLandscape);

      case DiscoveryState.found:
        return _buildFoundState(context, isDark, isLandscape);

      case DiscoveryState.notFound:
        return _buildNotFoundState(context, isDark, isLandscape);

      case DiscoveryState.error:
        return _buildErrorState(context, isDark, isLandscape);

      case DiscoveryState.connecting:
        // Handled by early return above; this case is for exhaustiveness only
        throw StateError('Unreachable: connecting state handled above');
    }
  }

  Widget _buildSearchingState(
    BuildContext context,
    bool isDark,
    bool isLandscape,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final accent = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final isCompact =
        _screenService.isSmallScreen || _screenService.isMediumScreen;
    final isCompactLandscape = isCompact && isLandscape;

    return Center(
      child: Padding(
        padding: EdgeInsets.all(isLandscape
                ? (_screenService.isLargeScreen ? AppSpacings.pXl : AppSpacings.pLg)
                : (_screenService.isSmallScreen ? AppSpacings.pLg : AppSpacings.pXl)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Animated icon with pulse rings
            SizedBox(
              width: AppSpacings.scale(isCompactLandscape ? 70 : 100),
              height: AppSpacings.scale(isCompactLandscape ? 70 : 100),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  PulseRings(
                    size: AppSpacings.scale(isCompactLandscape ? 56 : 80),
                    color: accent,
                  ),
                  Icon(
                    MdiIcons.accessPointNetwork,
                    size: AppSpacings.scale(isCompactLandscape ? 32 : 48),
                    color: accent,
                  ),
                ],
              ),
            ),
            SizedBox(
              height: isCompactLandscape
                  ? AppSpacings.pLg
                  : AppSpacings.pLg + AppSpacings.pMd + AppSpacings.pSm,
            ),
            Text(
              localizations.discovery_searching_title,
              style: TextStyle(
                color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                fontSize: AppFontSize.extraLarge,
                fontWeight: FontWeight.w500,
              ),
            ),
            AppSpacings.spacingMdVertical,
            Text(
              localizations.discovery_searching_description,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                fontSize: AppFontSize.base,
                height: 1.5,
              ),
            ),
            if (_backends.isNotEmpty) ...[
              AppSpacings.spacingLgVertical,
              Text(
                localizations.discovery_found_count(_backends.length),
                style: TextStyle(
                  color: accent,
                  fontSize: AppFontSize.base,
                ),
              ),
            ],
            SizedBox(
              height: isCompactLandscape
                  ? AppSpacings.pLg
                  : AppSpacings.pLg + AppSpacings.pMd,
            ),
            // Cancel button
            _buildSearchingButtons(isDark, isLandscape, localizations),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchingButtons(
    bool isDark,
    bool isLandscape,
    AppLocalizations localizations,
  ) {
    return Center(
      child: Theme(
        data: Theme.of(context).copyWith(
          outlinedButtonTheme: isDark
              ? AppOutlinedButtonsDarkThemes.primary
              : AppOutlinedButtonsLightThemes.primary,
        ),
        child: OutlinedButton.icon(
          onPressed: _cancelDiscovery,
          icon: Icon(
            MdiIcons.close,
            size: AppFontSize.base,
            color: isDark
                ? AppOutlinedButtonsDarkThemes.primaryForegroundColor
                : AppOutlinedButtonsLightThemes.primaryForegroundColor,
          ),
          label: Text(localizations.discovery_button_cancel),
        ),
      ),
    );
  }

  Widget _buildFoundState(
    BuildContext context,
    bool isDark,
    bool isLandscape,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final accent = isDark ? AppColorsDark.primary : AppColorsLight.primary;

    if (isLandscape) {
      return _buildFoundStateLandscape(
        context,
        isDark,
        localizations,
        accent,
      );
    }

    return _buildFoundStatePortrait(
      context,
      isDark,
      localizations,
      accent,
    );
  }

  Widget _buildFoundStatePortrait(
    BuildContext context,
    bool isDark,
    AppLocalizations localizations,
    Color accent,
  ) {
    return Padding(
      padding: EdgeInsets.all(_screenService.isSmallScreen ? AppSpacings.pLg : AppSpacings.pXl),
      child: Column(
        children: [
          // Header
          IconContainer(
            screenService: _screenService,
            icon: MdiIcons.accessPointNetwork,
            color: accent,
            isLandscape: false,
            useContainer: false,
          ),
          SizedBox(height: _screenService.scale(24)),
          Text(
            localizations.discovery_select_title,
            style: TextStyle(
              color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
              fontSize: AppFontSize.extraLarge,
              fontWeight: FontWeight.w500,
            ),
          ),
          AppSpacings.spacingSmVertical,
          Text(
            localizations.discovery_select_description(_backends.length),
            style: TextStyle(
              color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
              fontSize: AppFontSize.small,
            ),
          ),
          SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
          // Gateway list
          Expanded(
            child: ListView.separated(
              itemCount: _backends.length,
              separatorBuilder: (_, __) =>
                  SizedBox(height: AppSpacings.pMd + AppSpacings.pSm),
              itemBuilder: (context, index) {
                final backend = _backends[index];
                return GatewayListItem(
                  backend: backend,
                  isSelected: _selectedBackend == backend,
                  onTap: () => _selectBackend(backend),
                  isDark: isDark,
                );
              },
            ),
          ),
          SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
          // Connect button
          SizedBox(
            width: double.infinity,
            child: Theme(
              data: Theme.of(context).copyWith(
                filledButtonTheme: isDark
                    ? AppFilledButtonsDarkThemes.primary
                    : AppFilledButtonsLightThemes.primary,
              ),
              child: FilledButton.icon(
                onPressed:
                    _selectedBackend != null ? _confirmSelection : null,
                icon: Icon(
                  MdiIcons.arrowRight,
                  size: AppFontSize.base,
                  color: isDark
                      ? AppFilledButtonsDarkThemes.primaryForegroundColor
                      : AppFilledButtonsLightThemes.primaryForegroundColor,
                ),
                label: Text(
                    localizations.discovery_button_connect_selected
                ),
                style: FilledButton.styleFrom(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.pMd,
                    vertical: AppSpacings.pMd,
                  ),
                ),
              ),
            ),
          ),
          AppSpacings.spacingLgVertical,
          // Secondary actions
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Theme(
                data: Theme.of(context).copyWith(
                  textButtonTheme: isDark
                      ? AppTextButtonsDarkThemes.neutral
                      : AppTextButtonsLightThemes.neutral,
                ),
                child: TextButton.icon(
                  onPressed: _startDiscovery,
                  icon: Icon(
                    MdiIcons.cached,
                    size: AppFontSize.base,
                    color: isDark
                        ? AppTextButtonsDarkThemes.neutralForegroundColor
                        : AppTextButtonsLightThemes.neutralForegroundColor,
                  ),
                  label: Text(localizations.discovery_button_rescan),
                  style: FilledButton.styleFrom(
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pMd,
                      vertical: AppSpacings.pMd,
                    ),
                  ),
                ),
              ),
              Theme(
                data: Theme.of(context).copyWith(
                  textButtonTheme: isDark
                      ? AppTextButtonsDarkThemes.neutral
                      : AppTextButtonsLightThemes.neutral,
                ),
                child: TextButton.icon(
                  onPressed: _showManualEntryForm,
                  icon: Icon(
                    MdiIcons.pencilOutline,
                    size: AppFontSize.base,
                    color: isDark
                        ? AppTextButtonsDarkThemes.neutralForegroundColor
                        : AppTextButtonsLightThemes.neutralForegroundColor,
                  ),
                  label: Text(localizations.discovery_button_manual),
                  style: FilledButton.styleFrom(
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pMd,
                      vertical: AppSpacings.pMd,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFoundStateLandscape(
    BuildContext context,
    bool isDark,
    AppLocalizations localizations,
    Color accent,
  ) {
    final isCompact =
        _screenService.isSmallScreen || _screenService.isMediumScreen;

    return Padding(
      padding: EdgeInsets.all(_screenService.isLargeScreen ? AppSpacings.pXl : AppSpacings.pLg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left: Header
          SizedBox(
            width: AppSpacings.scale(isCompact ? 160 : 240),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconContainer(
                  screenService: _screenService,
                  icon: MdiIcons.accessPointNetwork,
                  color: accent,
                  isLandscape: true,
                  useContainer: false,
                ),
                SizedBox(height: _screenService.scale(
                (_screenService.isSmallScreen || _screenService.isMediumScreen) ? 12 : 24,
              )),
                Text(
                  localizations.discovery_select_title,
                  style: TextStyle(
                    color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                    fontSize: AppFontSize.extraLarge,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                AppSpacings.spacingSmVertical,
                Text(
                  localizations.discovery_select_description(_backends.length),
                  style: TextStyle(
                    color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                    fontSize: AppFontSize.small,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: isCompact
                ? AppSpacings.pLg + AppSpacings.pMd
                : AppSpacings.pXl + AppSpacings.pLg,
          ),
          // Right: List and actions
          Expanded(
            child: Column(
              children: [
                // Gateway list
                Expanded(
                  child: ListView.separated(
                    itemCount: _backends.length,
                    separatorBuilder: (_, __) =>
                        SizedBox(height: AppSpacings.pMd + AppSpacings.pSm),
                    itemBuilder: (context, index) {
                      final backend = _backends[index];
                      return GatewayListItem(
                        backend: backend,
                        isSelected: _selectedBackend == backend,
                        onTap: () => _selectBackend(backend),
                        isDark: isDark,
                      );
                    },
                  ),
                ),
                SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
                // Actions
                SizedBox(
                  width: double.infinity,
                  child: Theme(
                    data: Theme.of(context).copyWith(
                      filledButtonTheme: isDark
                          ? AppFilledButtonsDarkThemes.primary
                          : AppFilledButtonsLightThemes.primary,
                    ),
                    child: FilledButton.icon(
                      onPressed:
                          _selectedBackend != null ? _confirmSelection : null,
                      icon: Icon(
                        MdiIcons.arrowRight,
                        size: AppFontSize.base,
                        color: isDark
                            ? AppFilledButtonsDarkThemes
                                .primaryForegroundColor
                            : AppFilledButtonsLightThemes
                                .primaryForegroundColor,
                      ),
                      label: Text(
                          localizations.discovery_button_connect_selected),
                    ),
                  ),
                ),
                AppSpacings.spacingLgVertical,
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Theme(
                      data: Theme.of(context).copyWith(
                        textButtonTheme: isDark
                            ? AppTextButtonsDarkThemes.primary
                            : AppTextButtonsLightThemes.primary,
                      ),
                      child: TextButton.icon(
                        onPressed: _startDiscovery,
                        icon: Icon(
                          MdiIcons.cached,
                          size: AppFontSize.base,
                          color: isDark
                              ? AppTextButtonsDarkThemes
                                  .primaryForegroundColor
                              : AppTextButtonsLightThemes
                                  .primaryForegroundColor,
                        ),
                        label:
                            Text(localizations.discovery_button_rescan),
                      ),
                    ),
                    Theme(
                      data: Theme.of(context).copyWith(
                        textButtonTheme: isDark
                            ? AppTextButtonsDarkThemes.primary
                            : AppTextButtonsLightThemes.primary,
                      ),
                      child: TextButton.icon(
                        onPressed: _showManualEntryForm,
                        icon: Icon(
                          MdiIcons.pencilOutline,
                          size: AppFontSize.base,
                          color: isDark
                              ? AppTextButtonsDarkThemes
                                  .primaryForegroundColor
                              : AppTextButtonsLightThemes
                                  .primaryForegroundColor,
                        ),
                        label:
                            Text(localizations.discovery_button_manual),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotFoundState(
    BuildContext context,
    bool isDark,
    bool isLandscape,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final isCompact =
        _screenService.isSmallScreen || _screenService.isMediumScreen;
    final isCompactLandscape = isCompact && isLandscape;
    return Center(
      child: Padding(
        padding: EdgeInsets.all(isLandscape
                ? (_screenService.isLargeScreen ? AppSpacings.pXl : AppSpacings.pLg)
                : (_screenService.isSmallScreen ? AppSpacings.pLg : AppSpacings.pXl)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Warning icon
            IconContainer(
              screenService: _screenService,
              icon: MdiIcons.serverOff,
              color: isDark ? AppColorsDark.warning : AppColorsLight.warning,
              isLandscape: isLandscape,
            ),
            SizedBox(height: _screenService.scale(
                (_screenService.isSmallScreen || _screenService.isMediumScreen) && isLandscape ? 12 : 24,
              )),
            // Title
            Text(
              localizations.discovery_not_found_title,
              style: TextStyle(
                color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                fontSize: AppFontSize.extraLarge,
                fontWeight: FontWeight.w500,
              ),
            ),
            SizedBox(
              height:
                  isCompactLandscape ? AppSpacings.pSm : AppSpacings.pMd,
            ),
            // Message
            Text(
              localizations.discovery_not_found_description,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                fontSize: AppSpacings.scale(isCompactLandscape ? 12 : 14),
                height: 1.5,
              ),
            ),
            SizedBox(
              height:
                  isCompactLandscape ? AppSpacings.pLg : AppSpacings.pXl,
            ),
            // Buttons
            _buildActionButtons(isDark, isLandscape, localizations),
          ],
        ),
      ),
    );
  }

  /// Builds the action buttons (Rescan + Manual) for not found and error states
  Widget _buildActionButtons(
    bool isDark,
    bool isLandscape,
    AppLocalizations localizations,
  ) {
    if (isLandscape) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Theme(
            data: Theme.of(context).copyWith(
              filledButtonTheme: isDark
                  ? AppFilledButtonsDarkThemes.primary
                  : AppFilledButtonsLightThemes.primary,
            ),
            child: FilledButton.icon(
              onPressed: _startDiscovery,
              icon: Icon(
                MdiIcons.cached,
                size: AppFontSize.base,
                color: isDark
                    ? AppFilledButtonsDarkThemes.primaryForegroundColor
                    : AppFilledButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(localizations.discovery_button_try_again),
            ),
          ),
          AppSpacings.spacingLgHorizontal,
          Theme(
            data: Theme.of(context).copyWith(
              outlinedButtonTheme: isDark
                  ? AppOutlinedButtonsDarkThemes.primary
                  : AppOutlinedButtonsLightThemes.primary,
            ),
            child: OutlinedButton.icon(
              onPressed: _showManualEntryForm,
              icon: Icon(
                MdiIcons.pencilOutline,
                size: AppFontSize.base,
                color: isDark
                    ? AppOutlinedButtonsDarkThemes.primaryForegroundColor
                    : AppOutlinedButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(localizations.discovery_button_manual),
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: Theme(
            data: Theme.of(context).copyWith(
              filledButtonTheme: isDark
                  ? AppFilledButtonsDarkThemes.primary
                  : AppFilledButtonsLightThemes.primary,
            ),
            child: FilledButton.icon(
              onPressed: _startDiscovery,
              icon: Icon(
                MdiIcons.cached,
                size: AppFontSize.base,
                color: isDark
                    ? AppFilledButtonsDarkThemes.primaryForegroundColor
                    : AppFilledButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(localizations.discovery_button_try_again),
            ),
          ),
        ),
        SizedBox(height: AppSpacings.pMd + AppSpacings.pSm),
        SizedBox(
          width: double.infinity,
          child: Theme(
            data: Theme.of(context).copyWith(
              outlinedButtonTheme: isDark
                  ? AppOutlinedButtonsDarkThemes.primary
                  : AppOutlinedButtonsLightThemes.primary,
            ),
            child: OutlinedButton.icon(
              onPressed: _showManualEntryForm,
              icon: Icon(
                MdiIcons.pencilOutline,
                size: AppFontSize.base,
                color: isDark
                    ? AppOutlinedButtonsDarkThemes.primaryForegroundColor
                    : AppOutlinedButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(localizations.discovery_button_manual),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState(
    BuildContext context,
    bool isDark,
    bool isLandscape,
  ) {
    final localizations = AppLocalizations.of(context)!;

    return Center(
      child: Padding(
        padding: EdgeInsets.all(isLandscape
                ? (_screenService.isLargeScreen ? AppSpacings.pXl : AppSpacings.pLg)
                : (_screenService.isSmallScreen ? AppSpacings.pLg : AppSpacings.pXl)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Error icon
            IconContainer(
              screenService: _screenService,
              icon: MdiIcons.alertCircle,
              color: isDark ? AppColorsDark.error : AppColorsLight.error,
              isLandscape: isLandscape,
            ),
            SizedBox(height: _screenService.scale(
                (_screenService.isSmallScreen || _screenService.isMediumScreen) && isLandscape ? 12 : 24,
              )),
            // Title
            Text(
              localizations.discovery_error_title,
              style: TextStyle(
                color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                fontSize: AppFontSize.extraLarge,
                fontWeight: FontWeight.w500,
              ),
            ),
            AppSpacings.spacingMdVertical,
            // Message
            Text(
              localizations.discovery_error_description,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                fontSize: AppFontSize.base,
                height: 1.5,
              ),
            ),
            AppSpacings.spacingXlVertical,
            // Buttons
            _buildActionButtons(isDark, isLandscape, localizations),
          ],
        ),
      ),
    );
  }

  Widget _buildConnectingState(
    BuildContext context,
    bool isDark,
    bool isLandscape,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final accent = isDark ? AppColorsDark.primary : AppColorsLight.primary;

    final address = _wasManualEntry
        ? _manualUrlController.text.trim()
        : (_selectedBackend?.name ??
            localizations.discovery_connecting_fallback);

    return Center(
      child: Padding(
        padding: EdgeInsets.all(isLandscape
                ? (_screenService.isLargeScreen ? AppSpacings.pXl : AppSpacings.pLg)
                : (_screenService.isSmallScreen ? AppSpacings.pLg : AppSpacings.pXl)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconContainer(
              screenService: _screenService,
              icon: MdiIcons.serverNetwork,
              color: accent,
              isLandscape: isLandscape,
              useContainer: false,
            ),
            SizedBox(height: _screenService.scale(
                (_screenService.isSmallScreen || _screenService.isMediumScreen) && isLandscape ? 12 : 24,
              )),
            Text(
              localizations.discovery_connecting_title,
              style: TextStyle(
                color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                fontSize: AppFontSize.extraLarge,
                fontWeight: FontWeight.w500,
              ),
            ),
            AppSpacings.spacingMdVertical,
            Text(
              localizations.discovery_connecting_description(address),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                fontSize: AppFontSize.base,
              ),
            ),
            SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
            LoadingSpinner(
              size: AppSpacings.scale(48),
              color: accent,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildManualEntryForm(
    BuildContext context,
    bool isDark,
    bool isLandscape,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final accent = isDark ? AppColorsDark.primary : AppColorsLight.primary;

    return Center(
      child: Padding(
        padding: EdgeInsets.all(isLandscape
                ? (_screenService.isLargeScreen ? AppSpacings.pXl : AppSpacings.pLg)
                : (_screenService.isSmallScreen ? AppSpacings.pLg : AppSpacings.pXl)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconContainer(
              screenService: _screenService,
              icon: MdiIcons.keyboard,
              color: accent,
              isLandscape: isLandscape,
              useContainer: false,
            ),
            SizedBox(height: _screenService.scale(
                (_screenService.isSmallScreen || _screenService.isMediumScreen) && isLandscape ? 12 : 24,
              )),
            Text(
              localizations.discovery_manual_entry_title,
              style: TextStyle(
                color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                fontSize: AppFontSize.extraLarge,
                fontWeight: FontWeight.w500,
              ),
            ),
            SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
            TextField(
              controller: _manualUrlController,
              decoration: InputDecoration(
                hintText: localizations.discovery_manual_entry_hint,
                labelText: localizations.discovery_manual_entry_label,
                prefixIcon: Icon(MdiIcons.serverNetwork),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
              ),
              keyboardType: TextInputType.url,
              autocorrect: false,
              onSubmitted: (_) => _submitManualUrl(),
            ),
            AppSpacings.spacingLgVertical,
            Text(
              localizations.discovery_manual_entry_help,
              style: TextStyle(
                color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                fontSize: AppFontSize.small,
              ),
              textAlign: TextAlign.center,
            ),
            AppSpacings.spacingXlVertical,
            // Buttons
            _buildManualEntryButtons(isDark, isLandscape, localizations),
          ],
        ),
      ),
    );
  }

  Widget _buildManualEntryButtons(
    bool isDark,
    bool isLandscape,
    AppLocalizations localizations,
  ) {
    final hasText = _manualUrlController.text.trim().isNotEmpty;

    if (isLandscape) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Theme(
            data: Theme.of(context).copyWith(
              outlinedButtonTheme: isDark
                  ? AppOutlinedButtonsDarkThemes.primary
                  : AppOutlinedButtonsLightThemes.primary,
            ),
            child: OutlinedButton.icon(
              onPressed: _backToDiscovery,
              icon: Icon(
                MdiIcons.arrowLeft,
                size: AppFontSize.base,
                color: isDark
                    ? AppOutlinedButtonsDarkThemes.primaryForegroundColor
                    : AppOutlinedButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(localizations.discovery_button_back),
            ),
          ),
          AppSpacings.spacingLgHorizontal,
          Theme(
            data: Theme.of(context).copyWith(
              filledButtonTheme: isDark
                  ? AppFilledButtonsDarkThemes.primary
                  : AppFilledButtonsLightThemes.primary,
            ),
            child: FilledButton.icon(
              onPressed: hasText ? _submitManualUrl : null,
              icon: Icon(
                MdiIcons.arrowRight,
                size: AppFontSize.base,
                color: isDark
                    ? AppFilledButtonsDarkThemes.primaryForegroundColor
                    : AppFilledButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(localizations.discovery_button_connect),
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: Theme(
            data: Theme.of(context).copyWith(
              filledButtonTheme: isDark
                  ? AppFilledButtonsDarkThemes.primary
                  : AppFilledButtonsLightThemes.primary,
            ),
            child: FilledButton.icon(
              onPressed: hasText ? _submitManualUrl : null,
              icon: Icon(
                MdiIcons.arrowRight,
                size: AppFontSize.base,
                color: isDark
                    ? AppFilledButtonsDarkThemes.primaryForegroundColor
                    : AppFilledButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(localizations.discovery_button_connect),
            ),
          ),
        ),
        SizedBox(height: AppSpacings.pMd + AppSpacings.pSm),
        SizedBox(
          width: double.infinity,
          child: Theme(
            data: Theme.of(context).copyWith(
              outlinedButtonTheme: isDark
                  ? AppOutlinedButtonsDarkThemes.primary
                  : AppOutlinedButtonsLightThemes.primary,
            ),
            child: OutlinedButton.icon(
              onPressed: _backToDiscovery,
              icon: Icon(
                MdiIcons.arrowLeft,
                size: AppFontSize.base,
                color: isDark
                    ? AppOutlinedButtonsDarkThemes.primaryForegroundColor
                    : AppOutlinedButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(localizations.discovery_button_back),
            ),
          ),
        ),
      ],
    );
  }
}

/// List item widget for displaying a discovered backend/gateway
class GatewayListItem extends StatelessWidget {
  final DiscoveredBackend backend;
  final bool isSelected;
  final VoidCallback? onTap;
  final bool isDark;

  const GatewayListItem({
    super.key,
    required this.backend,
    this.isSelected = false,
    this.onTap,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    final accent = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final accentLight = isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pMd,
        ),
        decoration: BoxDecoration(
          color: isSelected ? accentLight : isDark ? AppFillColorDark.base : AppFillColorLight.blank,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isSelected ? accent : AppColors.blank,
            width: AppSpacings.pXs,
          ),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                    color: AppColors.black.withValues(alpha: 0.05),
                    blurRadius: AppSpacings.pMd,
                    offset: Offset(0, AppSpacings.pXs),
                  ),
                ],
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: AppSpacings.scale(44),
              height: AppSpacings.scale(44),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isSelected
                    ? accent
                    : isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
              ),
              child: Icon(
                isSelected ? MdiIcons.check : MdiIcons.server,
                color: isSelected
                    ? AppColors.white
                    : isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
                size: AppSpacings.pLg + AppSpacings.pMd,
              ),
            ),
            AppSpacings.spacingMdHorizontal,
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    backend.name,
                    style: TextStyle(
                      color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  AppSpacings.spacingXsVertical,
                  Text(
                    backend.displayAddress,
                    style: TextStyle(
                      color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                      fontSize: AppFontSize.small,
                    ),
                  ),
                ],
              ),
            ),
            // Badge
            if (backend.version != null)
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pSm,
                  vertical: AppSpacings.pXs,
                ),
                decoration: BoxDecoration(
                  color: isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
                  borderRadius: BorderRadius.circular(AppBorderRadius.small),
                ),
                child: Text(
                  'v${backend.version}',
                  style: TextStyle(
                    color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                    letterSpacing: AppSpacings.scale(0.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Animated pulse rings that expand outward from center
/// Used for discovery/searching states
class PulseRings extends StatefulWidget {
  final double size;
  final Color color;
  final int ringCount;

  const PulseRings({
    super.key,
    this.size = 80,
    required this.color,
    this.ringCount = 2,
  });

  @override
  State<PulseRings> createState() => _PulseRingsState();
}

class _PulseRingsState extends State<PulseRings> with TickerProviderStateMixin {
  late List<AnimationController> _controllers;
  late List<Animation<double>> _scaleAnimations;
  late List<Animation<double>> _opacityAnimations;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      widget.ringCount,
      (i) => AnimationController(
        duration: const Duration(milliseconds: 1500),
        vsync: this,
      ),
    );

    _scaleAnimations = _controllers.map((c) {
      return Tween<double>(begin: 1.0, end: 1.6).animate(
        CurvedAnimation(parent: c, curve: Curves.easeOut),
      );
    }).toList();

    _opacityAnimations = _controllers.map((c) {
      return Tween<double>(begin: 0.8, end: 0.0).animate(
        CurvedAnimation(parent: c, curve: Curves.easeOut),
      );
    }).toList();

    // Start animations with staggered delay
    for (int i = 0; i < widget.ringCount; i++) {
      Future.delayed(Duration(milliseconds: i * 500), () {
        if (mounted) {
          _controllers[i].repeat();
        }
      });
    }
  }

  @override
  void dispose() {
    for (var c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: List.generate(widget.ringCount, (i) {
          return AnimatedBuilder(
            animation: _controllers[i],
            builder: (context, child) {
              return Transform.scale(
                scale: _scaleAnimations[i].value,
                child: Opacity(
                  opacity: _opacityAnimations[i].value,
                  child: Container(
                    width: widget.size,
                    height: widget.size,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: widget.color, width: AppSpacings.scale(2)),
                    ),
                  ),
                ),
              );
            },
          );
        }),
      ),
    );
  }
}

/// Custom loading spinner with arc animation
class LoadingSpinner extends StatefulWidget {
  final double size;
  final Color color;
  final double strokeWidth;

  const LoadingSpinner({
    super.key,
    this.size = 48,
    required this.color,
    this.strokeWidth = 3,
  });

  @override
  State<LoadingSpinner> createState() => _LoadingSpinnerState();
}

class _LoadingSpinnerState extends State<LoadingSpinner>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.rotate(
          angle: _controller.value * 2 * math.pi,
          child: CustomPaint(
            size: Size(widget.size, widget.size),
            painter: _SpinnerPainter(
              color: widget.color,
              strokeWidth: widget.strokeWidth,
            ),
          ),
        );
      },
    );
  }
}

class _SpinnerPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;

  _SpinnerPainter({required this.color, required this.strokeWidth});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final rect = Rect.fromLTWH(
      strokeWidth / 2,
      strokeWidth / 2,
      size.width - strokeWidth,
      size.height - strokeWidth,
    );

    canvas.drawArc(rect, 0, math.pi * 1.5, false, paint);
  }

  @override
  bool shouldRepaint(covariant _SpinnerPainter oldDelegate) =>
      color != oldDelegate.color || strokeWidth != oldDelegate.strokeWidth;
}

