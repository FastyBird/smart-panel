import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';
import 'package:fastybird_smart_panel/core/services/mdns_discovery.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart'
    show
        AppBorderColorDark,
        AppBorderColorLight,
        AppBorderRadius,
        AppColorsDark,
        AppColorsLight,
        AppFillColorDark,
        AppFillColorLight,
        AppFilledButtonsDarkThemes,
        AppFilledButtonsLightThemes,
        AppFontSize,
        AppSpacings,
        AppTextColorDark,
        AppTextColorLight;
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
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

    // Show AlertBar if there's an error message (connection failed)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.errorMessage != null && mounted) {
        AlertBar.showError(
          context,
          message: widget.errorMessage!,
        );
      }
    });
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
            _state =
                backends.isEmpty ? DiscoveryState.notFound : DiscoveryState.found;
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
      _selectedBackend = backend;
    });
  }

  void _confirmSelection() {
    if (_selectedBackend != null) {
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
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: AppSpacings.paddingLg,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Main content
              Expanded(
                child: _buildContent(context, localizations),
              ),
            ],
          ),
        ),
      ),
      // Fixed bottom actions
      bottomNavigationBar: _state != DiscoveryState.connecting
          ? SafeArea(
              child: Padding(
                padding: AppSpacings.paddingLg,
                child: _buildBottomActions(context, localizations),
              ),
            )
          : null,
    );
  }

  Widget _buildContent(BuildContext context, AppLocalizations localizations) {
    if (_state == DiscoveryState.connecting) {
      return _buildConnectingState(context);
    }

    if (_showManualEntry) {
      return _buildManualEntryForm(context, localizations);
    }

    return _buildDiscoveryContent(context, localizations);
  }

  Widget _buildDiscoveryContent(
    BuildContext context,
    AppLocalizations localizations,
  ) {
    switch (_state) {
      case DiscoveryState.initial:
      case DiscoveryState.searching:
        return _buildSearchingState(context);

      case DiscoveryState.found:
        return _buildFoundState(context);

      case DiscoveryState.notFound:
        return _buildNotFoundState(context);

      case DiscoveryState.error:
        return _buildErrorState(context);

      case DiscoveryState.connecting:
        return _buildConnectingState(context);
    }
  }

  Widget _buildSearchingState(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          MdiIcons.accessPointNetwork,
          size: _screenService.scale(48),
          color: Theme.of(context).primaryColor,
        ),
        AppSpacings.spacingMdVertical,
        Text(
          localizations.discovery_searching_title,
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingSmVertical,
        Text(
          localizations.discovery_searching_description,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingLgVertical,
        SizedBox(
          width: _screenService.scale(32),
          height: _screenService.scale(32),
          child: const CircularProgressIndicator(strokeWidth: 3),
        ),
        if (_backends.isNotEmpty) ...[
          AppSpacings.spacingMdVertical,
          Text(
            localizations.discovery_found_count(_backends.length),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).primaryColor,
                ),
          ),
        ],
      ],
    );
  }

  Widget _buildFoundState(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          MdiIcons.accessPointNetwork,
          size: _screenService.scale(32),
          color: Theme.of(context).primaryColor,
        ),
        AppSpacings.spacingSmVertical,
        Text(
          localizations.discovery_select_title,
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingXsVertical,
        Text(
          localizations.discovery_select_description(_backends.length),
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingMdVertical,
        Expanded(
          child: ListView.separated(
            itemCount: _backends.length,
            separatorBuilder: (_, __) => AppSpacings.spacingSmVertical,
            itemBuilder: (context, index) {
              final backend = _backends[index];
              final isSelected = _selectedBackend == backend;

              return _BackendListItem(
                backend: backend,
                isSelected: isSelected,
                onTap: () => _selectBackend(backend),
                screenService: _screenService,
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildNotFoundState(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          MdiIcons.serverOff,
          size: _screenService.scale(48),
          color: Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.placeholder
              : AppTextColorDark.placeholder,
        ),
        AppSpacings.spacingMdVertical,
        Text(
          localizations.discovery_not_found_title,
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingSmVertical,
        Text(
          localizations.discovery_not_found_description,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildErrorState(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          MdiIcons.alertCircle,
          size: _screenService.scale(48),
          color: Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.danger
              : AppColorsDark.danger,
        ),
        AppSpacings.spacingMdVertical,
        Text(
          localizations.discovery_error_title,
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingSmVertical,
        Text(
          localizations.discovery_error_description,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildConnectingState(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final address = _wasManualEntry
        ? _manualUrlController.text.trim()
        : (_selectedBackend?.name ?? localizations.discovery_connecting_fallback);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          MdiIcons.serverNetwork,
          size: _screenService.scale(48),
          color: Theme.of(context).primaryColor,
        ),
        AppSpacings.spacingMdVertical,
        Text(
          localizations.discovery_connecting_title,
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingSmVertical,
        Text(
          localizations.discovery_connecting_description(address),
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingLgVertical,
        SizedBox(
          width: _screenService.scale(32),
          height: _screenService.scale(32),
          child: const CircularProgressIndicator(strokeWidth: 3),
        ),
      ],
    );
  }

  Widget _buildManualEntryForm(
    BuildContext context,
    AppLocalizations localizations,
  ) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          MdiIcons.keyboard,
          size: _screenService.scale(48),
          color: Theme.of(context).primaryColor,
        ),
        AppSpacings.spacingMdVertical,
        Text(
          localizations.discovery_manual_entry_title,
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingLgVertical,
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
        AppSpacings.spacingMdVertical,
        Text(
          localizations.discovery_manual_entry_help,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.placeholder
                    : AppTextColorDark.placeholder,
              ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildBottomActions(
    BuildContext context,
    AppLocalizations localizations,
  ) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_showManualEntry) ...[
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _backToDiscovery,
                  style: OutlinedButton.styleFrom(
                    padding: AppSpacings.paddingSm,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                    ),
                    textStyle: TextStyle(
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  child: Text(localizations.discovery_button_back),
                ),
              ),
              AppSpacings.spacingMdHorizontal,
              Expanded(
                child: Theme(
                  data: ThemeData(
                    filledButtonTheme:
                        Theme.of(context).brightness == Brightness.light
                            ? AppFilledButtonsLightThemes.primary
                            : AppFilledButtonsDarkThemes.primary,
                  ),
                  child: FilledButton(
                    onPressed: _manualUrlController.text.trim().isNotEmpty
                        ? _submitManualUrl
                        : null,
                    style: FilledButton.styleFrom(
                      padding: AppSpacings.paddingSm,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                      ),
                      textStyle: TextStyle(
                        fontSize: AppFontSize.base,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    child: Text(localizations.discovery_button_connect),
                  ),
                ),
              ),
            ],
          ),
        ] else ...[
          if (_state == DiscoveryState.found && _selectedBackend != null) ...[
            Theme(
              data: ThemeData(
                filledButtonTheme:
                    Theme.of(context).brightness == Brightness.light
                        ? AppFilledButtonsLightThemes.primary
                        : AppFilledButtonsDarkThemes.primary,
              ),
              child: FilledButton(
                onPressed: _confirmSelection,
                style: FilledButton.styleFrom(
                  padding: AppSpacings.paddingSm,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                  ),
                  textStyle: TextStyle(
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                child: Text(localizations.discovery_button_connect_selected),
              ),
            ),
            AppSpacings.spacingSmVertical,
          ],
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _state == DiscoveryState.searching
                      ? null
                      : _startDiscovery,
                  style: OutlinedButton.styleFrom(
                    padding: AppSpacings.paddingSm,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                    ),
                    textStyle: TextStyle(
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  child: Text(localizations.discovery_button_rescan),
                ),
              ),
              AppSpacings.spacingMdHorizontal,
              Expanded(
                child: OutlinedButton(
                  onPressed: _state == DiscoveryState.searching
                      ? null
                      : _showManualEntryForm,
                  style: OutlinedButton.styleFrom(
                    padding: AppSpacings.paddingSm,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                    ),
                    textStyle: TextStyle(
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  child: Text(localizations.discovery_button_manual),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// List item widget for displaying a discovered backend
class _BackendListItem extends StatelessWidget {
  final DiscoveredBackend backend;
  final bool isSelected;
  final VoidCallback onTap;
  final ScreenService screenService;

  const _BackendListItem({
    required this.backend,
    required this.isSelected,
    required this.onTap,
    required this.screenService,
  });

  @override
  Widget build(BuildContext context) {
    final borderColor = isSelected
        ? Theme.of(context).primaryColor
        : Theme.of(context).brightness == Brightness.light
            ? AppBorderColorLight.base
            : AppBorderColorDark.base;

    final bgColor = isSelected
        ? Theme.of(context).brightness == Brightness.light
            ? AppColorsLight.primaryLight9
            : AppColorsDark.primaryLight9
        : Colors.transparent;

    return Material(
      color: bgColor,
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        child: Container(
          padding: AppSpacings.paddingMd,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            border: Border.all(
              color: borderColor,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(
                isSelected ? MdiIcons.checkCircle : MdiIcons.server,
                color: isSelected
                    ? Theme.of(context).primaryColor
                    : Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.secondary
                        : AppTextColorDark.secondary,
                size: screenService.scale(24),
              ),
              AppSpacings.spacingMdHorizontal,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      backend.name,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight:
                                isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                    ),
                    AppSpacings.spacingXsVertical,
                    Text(
                      backend.displayAddress,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.secondary
                                    : AppTextColorDark.secondary,
                          ),
                    ),
                  ],
                ),
              ),
              if (backend.version != null)
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.pSm,
                    vertical: AppSpacings.pXs,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppFillColorLight.light
                        : AppFillColorDark.light,
                    borderRadius: BorderRadius.circular(AppBorderRadius.small),
                  ),
                  child: Text(
                    'v${backend.version}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: AppFontSize.extraSmall,
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.secondary
                                  : AppTextColorDark.secondary,
                        ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
