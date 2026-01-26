import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';
import 'package:fastybird_smart_panel/core/services/mdns_discovery.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
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
  bool _showErrorToast = false;

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
      _showErrorToast = true;
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
    setState(() {
      _state = DiscoveryState.searching;
      _backends = [];
      _selectedBackend = null;
      _showManualEntry = false;
      _showErrorToast = false;
    });

    try {
      final backends = await _discoveryService.discover(
        onBackendFound: (backend) {
          if (mounted) {
            setState(() {
              if (!_backends.contains(backend)) {
                _backends = [..._backends, backend];
              }
            });
          }
        },
      );

      if (mounted) {
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
      if (mounted) {
        setState(() {
          _state = DiscoveryState.error;
        });
        final localizations = AppLocalizations.of(context)!;
        AlertBar.showError(
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
      setState(() {
        _state = DiscoveryState.connecting;
        _wasManualEntry = false;
        _showErrorToast = false;
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
      AlertBar.showWarning(
        context,
        message: localizations.discovery_validation_empty,
      );
      return;
    }

    if (!_isValidAddress(url)) {
      AlertBar.showError(
        context,
        message: localizations.discovery_validation_invalid,
      );
      return;
    }

    setState(() {
      _state = DiscoveryState.connecting;
      _wasManualEntry = true;
      _showErrorToast = false;
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

  void _dismissErrorToast() {
    setState(() {
      _showErrorToast = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: SystemPagesTheme.background(isDark),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isLandscape = constraints.maxWidth > constraints.maxHeight;

            return Stack(
              children: [
                // Main content
                _buildContent(context, isDark, isLandscape),

                // Error toast
                if (_showErrorToast && widget.errorMessage != null)
                  Positioned(
                    left: _screenService.scale(24),
                    right: _screenService.scale(24),
                    bottom: _screenService.scale(isLandscape ? 100 : 160),
                    child: Center(
                      child: _ErrorToast(
                        message: widget.errorMessage!,
                        onDismiss: _dismissErrorToast,
                        isDark: isDark,
                      ),
                    ),
                  ),
              ],
            );
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
    final accent = SystemPagesTheme.accent(isDark);

    return Stack(
      children: [
        // Main content
        Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Animated icon with pulse rings
              SizedBox(
                width: _screenService.scale(100),
                height: _screenService.scale(100),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    PulseRings(
                      size: _screenService.scale(80),
                      color: accent,
                    ),
                    Icon(
                      MdiIcons.accessPointNetwork,
                      size: _screenService.scale(48),
                      color: accent,
                    ),
                  ],
                ),
              ),
              SizedBox(height: _screenService.scale(28)),
              Text(
                localizations.discovery_searching_title,
                style: TextStyle(
                  color: SystemPagesTheme.textPrimary(isDark),
                  fontSize: _screenService.scale(24),
                  fontWeight: FontWeight.w500,
                ),
              ),
              SizedBox(height: _screenService.scale(8)),
              Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: _screenService.scale(40),
                ),
                child: Text(
                  localizations.discovery_searching_description,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: SystemPagesTheme.textMuted(isDark),
                    fontSize: _screenService.scale(14),
                    height: 1.5,
                  ),
                ),
              ),
              SizedBox(height: _screenService.scale(24)),
              LoadingSpinner(
                size: _screenService.scale(48),
                color: accent,
              ),
              if (_backends.isNotEmpty) ...[
                SizedBox(height: _screenService.scale(16)),
                Text(
                  localizations.discovery_found_count(_backends.length),
                  style: TextStyle(
                    color: accent,
                    fontSize: _screenService.scale(14),
                  ),
                ),
              ],
            ],
          ),
        ),

        // Bottom buttons
        Positioned(
          left: 0,
          right: 0,
          bottom: isLandscape
              ? _screenService.scale(32)
              : _screenService.scale(48),
          child: _buildSearchingButtons(isDark, isLandscape, localizations),
        ),
      ],
    );
  }

  Widget _buildSearchingButtons(
    bool isDark,
    bool isLandscape,
    AppLocalizations localizations,
  ) {
    return Center(
      child: SystemPageSecondaryButton(
        label: localizations.discovery_button_cancel,
        icon: Icons.close,
        onPressed: _cancelDiscovery,
        isDark: isDark,
      ),
    );
  }

  Widget _buildFoundState(
    BuildContext context,
    bool isDark,
    bool isLandscape,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final accent = SystemPagesTheme.accent(isDark);

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
    final isCompact =
        _screenService.isSmallScreen || _screenService.isMediumScreen;

    return Padding(
      padding: EdgeInsets.all(
        _screenService.scale(isCompact ? 20 : 40),
      ),
      child: Column(
        children: [
          // Header
          Icon(
            MdiIcons.accessPointNetwork,
            size: _screenService.scale(56),
            color: accent,
          ),
          SizedBox(height: _screenService.scale(20)),
          Text(
            localizations.discovery_select_title,
            style: TextStyle(
              color: SystemPagesTheme.textPrimary(isDark),
              fontSize: _screenService.scale(24),
              fontWeight: FontWeight.w500,
            ),
          ),
          SizedBox(height: _screenService.scale(4)),
          Text(
            localizations.discovery_select_description(_backends.length),
            style: TextStyle(
              color: SystemPagesTheme.textMuted(isDark),
              fontSize: _screenService.scale(13),
            ),
          ),
          SizedBox(height: _screenService.scale(24)),
          // Gateway list
          Expanded(
            child: ListView.separated(
              itemCount: _backends.length,
              separatorBuilder: (_, __) =>
                  SizedBox(height: _screenService.scale(12)),
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
          SizedBox(height: _screenService.scale(24)),
          // Connect button
          SizedBox(
            width: double.infinity,
            child: SystemPagePrimaryButton(
              label: localizations.discovery_button_connect_selected,
              icon: Icons.arrow_forward,
              onPressed: _selectedBackend != null ? _confirmSelection : null,
              minWidth: double.infinity,
              isDark: isDark,
            ),
          ),
          SizedBox(height: _screenService.scale(16)),
          // Secondary actions
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              SystemPageGhostButton(
                label: localizations.discovery_button_rescan,
                icon: Icons.refresh,
                onPressed: _startDiscovery,
                isDark: isDark,
              ),
              SystemPageGhostButton(
                label: localizations.discovery_button_manual,
                icon: Icons.edit_outlined,
                onPressed: _showManualEntryForm,
                isDark: isDark,
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
      padding: EdgeInsets.all(
        _screenService.scale(isCompact ? 16 : 32),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left: Header
          SizedBox(
            width: _screenService.scale(240),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  MdiIcons.accessPointNetwork,
                  size: _screenService.scale(56),
                  color: accent,
                ),
                SizedBox(height: _screenService.scale(20)),
                Text(
                  localizations.discovery_select_title,
                  style: TextStyle(
                    color: SystemPagesTheme.textPrimary(isDark),
                    fontSize: _screenService.scale(24),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: _screenService.scale(4)),
                Text(
                  localizations.discovery_select_description(_backends.length),
                  style: TextStyle(
                    color: SystemPagesTheme.textMuted(isDark),
                    fontSize: _screenService.scale(13),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: _screenService.scale(48)),
          // Right: List and actions
          Expanded(
            child: Column(
              children: [
                // Gateway list
                Expanded(
                  child: ListView.separated(
                    itemCount: _backends.length,
                    separatorBuilder: (_, __) =>
                        SizedBox(height: _screenService.scale(12)),
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
                SizedBox(height: _screenService.scale(24)),
                // Actions
                Row(
                  children: [
                    SystemPagePrimaryButton(
                      label: localizations.discovery_button_connect_selected,
                      icon: Icons.arrow_forward,
                      onPressed:
                          _selectedBackend != null ? _confirmSelection : null,
                      isDark: isDark,
                    ),
                  ],
                ),
                SizedBox(height: _screenService.scale(16)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    SystemPageGhostButton(
                      label: localizations.discovery_button_rescan,
                      icon: Icons.refresh,
                      onPressed: _startDiscovery,
                      isDark: isDark,
                    ),
                    SystemPageGhostButton(
                      label: localizations.discovery_button_manual,
                      icon: Icons.edit_outlined,
                      onPressed: _showManualEntryForm,
                      isDark: isDark,
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

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: isLandscape
              ? _screenService.scale(80)
              : _screenService.scale(40),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Warning WiFi icon
            IconContainer(
              icon: MdiIcons.serverOff,
              color: SystemPagesTheme.warning(isDark),
              size: _screenService.scale(80),
              iconSize: _screenService.scale(40),
            ),
            SizedBox(height: _screenService.scale(24)),
            // Title
            Text(
              localizations.discovery_not_found_title,
              style: TextStyle(
                color: SystemPagesTheme.textPrimary(isDark),
                fontSize: _screenService.scale(24),
                fontWeight: FontWeight.w500,
              ),
            ),
            SizedBox(height: _screenService.scale(8)),
            // Message
            Text(
              localizations.discovery_not_found_description,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: SystemPagesTheme.textMuted(isDark),
                fontSize: _screenService.scale(14),
                height: 1.5,
              ),
            ),
            SizedBox(height: _screenService.scale(32)),
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
          SystemPagePrimaryButton(
            label: localizations.discovery_button_rescan,
            icon: Icons.refresh,
            onPressed: _startDiscovery,
            isDark: isDark,
          ),
          SizedBox(width: _screenService.scale(16)),
          SystemPageSecondaryButton(
            label: localizations.discovery_button_manual,
            icon: Icons.edit_outlined,
            onPressed: _showManualEntryForm,
            isDark: isDark,
          ),
        ],
      );
    }

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: SystemPagePrimaryButton(
            label: localizations.discovery_button_rescan,
            icon: Icons.refresh,
            onPressed: _startDiscovery,
            minWidth: double.infinity,
            isDark: isDark,
          ),
        ),
        SizedBox(height: _screenService.scale(12)),
        SizedBox(
          width: double.infinity,
          child: SystemPageSecondaryButton(
            label: localizations.discovery_button_manual,
            icon: Icons.edit_outlined,
            onPressed: _showManualEntryForm,
            isDark: isDark,
            minWidth: double.infinity,
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
        padding: EdgeInsets.symmetric(
          horizontal: isLandscape
              ? _screenService.scale(80)
              : _screenService.scale(40),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Error icon
            IconContainer(
              icon: MdiIcons.alertCircle,
              color: SystemPagesTheme.error(isDark),
              size: _screenService.scale(80),
              iconSize: _screenService.scale(40),
            ),
            SizedBox(height: _screenService.scale(24)),
            // Title
            Text(
              localizations.discovery_error_title,
              style: TextStyle(
                color: SystemPagesTheme.textPrimary(isDark),
                fontSize: _screenService.scale(24),
                fontWeight: FontWeight.w500,
              ),
            ),
            SizedBox(height: _screenService.scale(8)),
            // Message
            Text(
              localizations.discovery_error_description,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: SystemPagesTheme.textMuted(isDark),
                fontSize: _screenService.scale(14),
                height: 1.5,
              ),
            ),
            SizedBox(height: _screenService.scale(32)),
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
    final accent = SystemPagesTheme.accent(isDark);

    final address = _wasManualEntry
        ? _manualUrlController.text.trim()
        : (_selectedBackend?.name ??
            localizations.discovery_connecting_fallback);

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: isLandscape
              ? _screenService.scale(80)
              : _screenService.scale(40),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.serverNetwork,
              size: _screenService.scale(48),
              color: accent,
            ),
            SizedBox(height: _screenService.scale(16)),
            Text(
              localizations.discovery_connecting_title,
              style: TextStyle(
                color: SystemPagesTheme.textPrimary(isDark),
                fontSize: _screenService.scale(24),
                fontWeight: FontWeight.w500,
              ),
            ),
            SizedBox(height: _screenService.scale(8)),
            Text(
              localizations.discovery_connecting_description(address),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: SystemPagesTheme.textMuted(isDark),
                fontSize: _screenService.scale(14),
              ),
            ),
            SizedBox(height: _screenService.scale(24)),
            LoadingSpinner(
              size: _screenService.scale(48),
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
    final accent = SystemPagesTheme.accent(isDark);

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: isLandscape
              ? _screenService.scale(80)
              : _screenService.scale(40),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.keyboard,
              size: _screenService.scale(48),
              color: accent,
            ),
            SizedBox(height: _screenService.scale(16)),
            Text(
              localizations.discovery_manual_entry_title,
              style: TextStyle(
                color: SystemPagesTheme.textPrimary(isDark),
                fontSize: _screenService.scale(24),
                fontWeight: FontWeight.w500,
              ),
            ),
            SizedBox(height: _screenService.scale(24)),
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
            SizedBox(height: _screenService.scale(16)),
            Text(
              localizations.discovery_manual_entry_help,
              style: TextStyle(
                color: SystemPagesTheme.textMuted(isDark),
                fontSize: _screenService.scale(12),
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: _screenService.scale(32)),
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
          SystemPageSecondaryButton(
            label: localizations.discovery_button_back,
            icon: Icons.arrow_back,
            onPressed: _backToDiscovery,
            isDark: isDark,
          ),
          SizedBox(width: _screenService.scale(16)),
          SystemPagePrimaryButton(
            label: localizations.discovery_button_connect,
            icon: Icons.arrow_forward,
            onPressed: hasText ? _submitManualUrl : null,
            isDark: isDark,
          ),
        ],
      );
    }

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: SystemPagePrimaryButton(
            label: localizations.discovery_button_connect,
            icon: Icons.arrow_forward,
            onPressed: hasText ? _submitManualUrl : null,
            minWidth: double.infinity,
            isDark: isDark,
          ),
        ),
        SizedBox(height: _screenService.scale(12)),
        SizedBox(
          width: double.infinity,
          child: SystemPageSecondaryButton(
            label: localizations.discovery_button_back,
            icon: Icons.arrow_back,
            onPressed: _backToDiscovery,
            isDark: isDark,
            minWidth: double.infinity,
          ),
        ),
      ],
    );
  }
}

/// Error toast widget
class _ErrorToast extends StatelessWidget {
  final String message;
  final VoidCallback? onDismiss;
  final bool isDark;

  const _ErrorToast({
    required this.message,
    this.onDismiss,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pSm,
      ),
      decoration: BoxDecoration(
        color: SystemPagesTheme.error(isDark),
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        boxShadow: [
          BoxShadow(
            color: AppColors.black.withValues(alpha: 0.3),
            blurRadius: 32,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, color: AppColors.white, size: 20),
          SizedBox(width: AppSpacings.pSm),
          Flexible(
            child: Text(
              message,
              style: TextStyle(
                color: AppColors.white,
                fontSize: AppFontSize.small,
              ),
            ),
          ),
          if (onDismiss != null) ...[
            SizedBox(width: AppSpacings.pXs),
            GestureDetector(
              onTap: onDismiss,
              child: Icon(
                Icons.close,
                color: AppColors.white.withValues(alpha: 0.7),
                size: 20,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
