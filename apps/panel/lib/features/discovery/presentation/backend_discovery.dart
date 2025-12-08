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
        AppOutlinedButtonsDarkThemes,
        AppOutlinedButtonsLightThemes,
        AppSpacings,
        AppTextColorDark,
        AppTextColorLight;
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Discovery state enum
enum DiscoveryState {
  initial,
  searching,
  found,
  notFound,
  error,
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
  String? _discoveryError;

  @override
  void initState() {
    super.initState();
    _startDiscovery();
    // Add listener to update button state when text changes
    _manualUrlController.addListener(_onManualUrlChanged);
  }

  void _onManualUrlChanged() {
    // Trigger rebuild when manual URL text changes to update button state
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
      _discoveryError = null;
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
          _state =
              backends.isEmpty ? DiscoveryState.notFound : DiscoveryState.found;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _state = DiscoveryState.error;
          _discoveryError = e.toString();
        });
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
      widget.onBackendSelected(_selectedBackend!);
    }
  }

  void _submitManualUrl() {
    final url = _manualUrlController.text.trim();
    if (url.isNotEmpty) {
      widget.onManualUrlEntered(url);
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
              // Header
              _buildHeader(context, localizations),
              AppSpacings.spacingLgVertical,

              // Error message if retry
              if (widget.errorMessage != null) ...[
                _buildErrorBanner(context),
                AppSpacings.spacingMdVertical,
              ],

              // Main content
              Expanded(
                child: _showManualEntry
                    ? _buildManualEntryForm(context, localizations)
                    : _buildDiscoveryContent(context, localizations),
              ),

              // Bottom actions
              _buildBottomActions(context, localizations),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, AppLocalizations localizations) {
    return Column(
      children: [
        Icon(
          MdiIcons.accessPoint,
          size: _screenService.scale(48),
          color: Theme.of(context).primaryColor,
        ),
        AppSpacings.spacingMdVertical,
        Text(
          widget.isRetry
              ? 'Connection Failed'
              : 'Searching for Backend Server',
          style: Theme.of(context).textTheme.headlineMedium,
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingSmVertical,
        Text(
          widget.isRetry
              ? 'Could not connect to the stored backend. Searching for available servers...'
              : 'Looking for FastyBird Smart Panel backends on your network',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTextColorLight.secondary,
              ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildErrorBanner(BuildContext context) {
    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.light
            ? AppColorsLight.warningLight9
            : AppColorsDark.warningLight9,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.warning
              : AppColorsDark.warning,
        ),
      ),
      child: Row(
        children: [
          Icon(
            MdiIcons.alert,
            color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.warning
                : AppColorsDark.warning,
            size: _screenService.scale(20),
          ),
          AppSpacings.spacingSmHorizontal,
          Expanded(
            child: Text(
              widget.errorMessage ?? 'Connection failed',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.warningDark2
                        : AppColorsDark.warningDark2,
                  ),
            ),
          ),
        ],
      ),
    );
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
    }
  }

  Widget _buildSearchingState(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: _screenService.scale(50),
          height: _screenService.scale(50),
          child: const CircularProgressIndicator(),
        ),
        AppSpacings.spacingLgVertical,
        Text(
          'Searching...',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        if (_backends.isNotEmpty) ...[
          AppSpacings.spacingMdVertical,
          Text(
            'Found ${_backends.length} server(s)',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTextColorLight.secondary,
                ),
          ),
        ],
      ],
    );
  }

  Widget _buildFoundState(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Found ${_backends.length} backend server(s):',
          style: Theme.of(context).textTheme.bodyMedium,
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
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          MdiIcons.serverOff,
          size: _screenService.scale(64),
          color: AppTextColorLight.placeholder,
        ),
        AppSpacings.spacingLgVertical,
        Text(
          'No Backend Found',
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingSmVertical,
        Text(
          'Could not find any FastyBird Smart Panel backend on your network.\n'
          'Make sure the backend is running and on the same network.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTextColorLight.secondary,
              ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildErrorState(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          MdiIcons.alertCircle,
          size: _screenService.scale(64),
          color: Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.danger
              : AppColorsDark.danger,
        ),
        AppSpacings.spacingLgVertical,
        Text(
          'Discovery Error',
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        AppSpacings.spacingSmVertical,
        Text(
          _discoveryError ?? 'An error occurred during discovery',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTextColorLight.secondary,
              ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildManualEntryForm(
    BuildContext context,
    AppLocalizations localizations,
  ) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Enter Backend URL',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          AppSpacings.spacingSmVertical,
          Text(
            'Enter the full URL of your FastyBird Smart Panel backend:',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTextColorLight.secondary,
                ),
          ),
          AppSpacings.spacingLgVertical,
          TextField(
            controller: _manualUrlController,
            decoration: InputDecoration(
              hintText: 'http://192.168.1.100:3000',
              labelText: 'Backend URL',
              prefixIcon: Icon(MdiIcons.web),
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
            'Example: http://192.168.1.100:3000',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTextColorLight.placeholder,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomActions(
    BuildContext context,
    AppLocalizations localizations,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_showManualEntry) ...[
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _showManualEntry = false;
                    });
                  },
                  child: const Text('Back to Discovery'),
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
                    child: const Text('Connect'),
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
                child: const Text('Connect to Selected Server'),
              ),
            ),
            AppSpacings.spacingSmVertical,
          ],
          Row(
            children: [
              Expanded(
                child: Theme(
                  data: ThemeData(
                    outlinedButtonTheme:
                        Theme.of(context).brightness == Brightness.light
                            ? AppOutlinedButtonsLightThemes.base
                            : AppOutlinedButtonsDarkThemes.base,
                  ),
                  child: OutlinedButton.icon(
                    onPressed:
                        _state == DiscoveryState.searching ? null : _startDiscovery,
                    icon: Icon(MdiIcons.refresh),
                    label: const Text('Rescan'),
                  ),
                ),
              ),
              AppSpacings.spacingMdHorizontal,
              Expanded(
                child: Theme(
                  data: ThemeData(
                    outlinedButtonTheme:
                        Theme.of(context).brightness == Brightness.light
                            ? AppOutlinedButtonsLightThemes.base
                            : AppOutlinedButtonsDarkThemes.base,
                  ),
                  child: OutlinedButton.icon(
                    onPressed: () {
                      setState(() {
                        _showManualEntry = true;
                      });
                    },
                    icon: Icon(MdiIcons.keyboard),
                    label: const Text('Enter Manually'),
                  ),
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
                isSelected
                    ? MdiIcons.checkCircle
                    : MdiIcons.server,
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
