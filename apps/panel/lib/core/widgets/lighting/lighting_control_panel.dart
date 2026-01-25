import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_portrait_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// ============================================================================
// ENUMS & TYPES
// ============================================================================

/// Light capability types
enum LightCapability {
  power,
  brightness,
  colorTemp,
  color,
  white,
}

/// State of the lighting role/device
enum LightingState {
  /// All values are synced
  synced,

  /// Values are mixed (different across channels)
  mixed,

  /// Values are not synced with device
  unsynced,
}

/// Data model for a lighting channel displayed in tiles
class LightingChannelData {
  final String id;
  final String name;
  final bool isOn;
  final int brightness;
  final bool hasBrightness;
  final bool isOnline;
  final bool isSelected;

  const LightingChannelData({
    required this.id,
    required this.name,
    required this.isOn,
    this.brightness = 100,
    this.hasBrightness = true,
    this.isOnline = true,
    this.isSelected = false,
  });

  /// Get status text for display
  String get statusText {
    if (!isOnline) return 'Offline';
    if (isOn) {
      return hasBrightness ? '$brightness%' : 'On';
    }
    return 'Off';
  }
}

// ============================================================================
// MAIN WIDGET
// ============================================================================

/// Universal lighting control panel widget
///
/// Can be used for:
/// - Domain role detail (multiple channels)
/// - Single device detail (single or multiple channels)
///
/// Features:
/// - Brightness, color temp, color, white controls
/// - Power button for simple devices
/// - Channels list (optional)
/// - State indicators (mixed, unsynced)
class LightingControlPanel extends StatefulWidget {
  // -------------------------
  // Header
  // -------------------------

  /// Title displayed in header
  final String title;

  /// Optional subtitle (e.g., "3 devices", "Living Room")
  final String? subtitle;

  /// Icon displayed in header
  final IconData icon;

  /// Callback when back button is pressed
  final VoidCallback? onBack;

  // -------------------------
  // Current values
  // -------------------------

  /// Current power state
  final bool isOn;

  /// Current brightness (0-100)
  final int brightness;

  /// Current color temperature in Kelvin
  final int colorTemp;

  /// Current color
  final Color? color;

  /// Current saturation (0.0-1.0)
  final double saturation;

  /// Current white channel value (0-100)
  final int? whiteChannel;

  // -------------------------
  // Configuration
  // -------------------------

  /// Set of available capabilities
  final Set<LightCapability> capabilities;

  /// Current state (synced, mixed, unsynced)
  final LightingState state;

  /// List of channels to display (empty = hide channels panel)
  final List<LightingChannelData> channels;

  /// Icon to show in the channels panel header next to "Lights" label
  /// Defaults to lightbulb icon
  final IconData channelsPanelIcon;

  // -------------------------
  // Callbacks
  // -------------------------

  /// Called when power is toggled
  final VoidCallback? onPowerToggle;

  /// Called when brightness changes
  final ValueChanged<int>? onBrightnessChanged;

  /// Called when color temperature changes
  final ValueChanged<int>? onColorTempChanged;

  /// Called when color changes (color, saturation)
  final Function(Color, double)? onColorChanged;

  /// Called when white channel changes
  final ValueChanged<int>? onWhiteChannelChanged;

  /// Called when channel icon is tapped
  final ValueChanged<LightingChannelData>? onChannelIconTap;

  /// Called when channel tile is tapped
  final ValueChanged<LightingChannelData>? onChannelTileTap;

  /// Called when sync button is pressed
  final VoidCallback? onSyncAll;

  /// Whether to show the header (title, back button, etc.)
  /// When false, only the control panel body is rendered (no Scaffold wrapper)
  final bool showHeader;

  const LightingControlPanel({
    super.key,
    required this.title,
    this.subtitle,
    required this.icon,
    this.onBack,
    required this.isOn,
    this.brightness = 100,
    this.colorTemp = 4000,
    this.color,
    this.saturation = 1.0,
    this.whiteChannel,
    required this.capabilities,
    this.state = LightingState.synced,
    this.channels = const [],
    this.channelsPanelIcon = Icons.lightbulb_outline,
    this.onPowerToggle,
    this.onBrightnessChanged,
    this.onColorTempChanged,
    this.onColorChanged,
    this.onWhiteChannelChanged,
    this.onChannelIconTap,
    this.onChannelTileTap,
    this.onSyncAll,
    this.showHeader = true,
  });

  @override
  State<LightingControlPanel> createState() => _LightingControlPanelState();
}

class _LightingControlPanelState extends State<LightingControlPanel> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  LightCapability _selectedCapability = LightCapability.brightness;

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  /// Check if this is a simple device (only power capability)
  bool get _isSimple =>
      widget.capabilities.length == 1 &&
      widget.capabilities.contains(LightCapability.power);

  /// Check if channels panel should be shown
  bool get _showChannelsPanel => widget.channels.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _initSelectedCapability();
  }

  @override
  void didUpdateWidget(LightingControlPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.capabilities != widget.capabilities) {
      _initSelectedCapability();
    }
  }

  void _initSelectedCapability() {
    final caps = _enabledCapabilities;
    if (caps.isNotEmpty && !caps.contains(_selectedCapability)) {
      _selectedCapability = caps.first;
    }
  }

  List<LightCapability> get _enabledCapabilities {
    return [
      LightCapability.brightness,
      LightCapability.colorTemp,
      LightCapability.color,
      LightCapability.white,
    ].where((cap) => widget.capabilities.contains(cap)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? AppBgColorDark.page : AppBgColorLight.page;

    // When showHeader is false, just render the body content without Scaffold
    if (!widget.showHeader) {
      return OrientationBuilder(
        builder: (context, orientation) {
          final isLandscape = orientation == Orientation.landscape;
          return LayoutBuilder(
            builder: (context, constraints) {
              return isLandscape
                  ? _buildLandscapeLayout(context, isDark)
                  : _buildPortraitLayout(context, isDark);
            },
          );
        },
      );
    }

    // Full layout with Scaffold and header
    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: OrientationBuilder(
          builder: (context, orientation) {
            final isLandscape = orientation == Orientation.landscape;
            return LayoutBuilder(
              builder: (context, constraints) {
                return Column(
                  children: [
                    _buildHeader(context, isDark, isLandscape),
                    Expanded(
                      child: isLandscape
                          ? _buildLandscapeLayout(context, isDark)
                          : _buildPortraitLayout(context, isDark),
                    ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  Widget _buildHeader(BuildContext context, bool isDark, bool isLandscape) {
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final inactiveBgColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    final inactiveIconColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return PageHeader(
      title: widget.title,
      subtitle: widget.subtitle,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: widget.onBack,
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: widget.isOn ? primaryBgColor : inactiveBgColor,
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              widget.icon,
              color: widget.isOn ? primaryColor : inactiveIconColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
      trailing: !_isSimple
          ? GestureDetector(
              onTap: widget.onPowerToggle,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: _scale(48),
                height: _scale(32),
                decoration: BoxDecoration(
                  color: widget.isOn
                      ? primaryColor
                      : (isDark
                          ? AppFillColorDark.light
                          : AppFillColorLight.light),
                  borderRadius: BorderRadius.circular(AppBorderRadius.round),
                  border: (!widget.isOn && !isDark)
                      ? Border.all(
                          color: AppBorderColorLight.base, width: _scale(1))
                      : null,
                ),
                child: Icon(
                  Icons.power_settings_new,
                  size: _scale(18),
                  color: widget.isOn
                      ? AppColors.white
                      : (isDark
                          ? AppTextColorDark.secondary
                          : AppTextColorLight.secondary),
                ),
              ),
            )
          : null,
    );
  }

  Color? _getStateColor(bool isDark) {
    switch (widget.state) {
      case LightingState.synced:
        return null;
      case LightingState.mixed:
        // Informational - devices have different values
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case LightingState.unsynced:
        // Yellow/warning - sync was attempted but failed
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
    }
  }

  // --------------------------------------------------------------------------
  // LAYOUTS
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
    return DeviceDetailLandscapeLayout(
      mainContent: _isSimple
          ? _buildPowerButton(context, isDark)
          : _buildControlPanel(context, isDark, isLandscape: true),
      mainContentPadding: EdgeInsets.zero,
      modeSelector: !_isSimple && _enabledCapabilities.length > 1
          ? _buildVerticalModeSelector(context, isDark)
          : null,
      secondaryContent: _isSimple
          ? const SizedBox.shrink()
          : _buildLandscapeSecondaryContent(context, isDark),
    );
  }

  Widget _buildVerticalModeSelector(BuildContext context, bool isDark) {
    final enabledCaps = _enabledCapabilities;

    final modes = enabledCaps.map((cap) {
      return ModeOption<LightCapability>(
        value: cap,
        icon: _getCapabilityIcon(cap),
        label: _getCapabilityLabel(cap),
      );
    }).toList();

    return ModeSelector<LightCapability>(
      modes: modes,
      selectedValue: _selectedCapability,
      onChanged: (value) {
        HapticFeedback.selectionClick();
        setState(() => _selectedCapability = value);
      },
      orientation: ModeSelectorOrientation.vertical,
      showLabels: false,
    );
  }

  IconData _getCapabilityIcon(LightCapability cap) {
    switch (cap) {
      case LightCapability.brightness:
        return Icons.brightness_6;
      case LightCapability.colorTemp:
        return Icons.thermostat;
      case LightCapability.color:
        return Icons.palette;
      case LightCapability.white:
        return Icons.wb_incandescent;
      default:
        return Icons.lightbulb;
    }
  }

  String _getCapabilityLabel(LightCapability cap) {
    switch (cap) {
      case LightCapability.brightness:
        return 'Brightness';
      case LightCapability.colorTemp:
        return 'Temperature';
      case LightCapability.color:
        return 'Color';
      case LightCapability.white:
        return 'White';
      default:
        return '';
    }
  }

  Widget _buildLandscapeSecondaryContent(BuildContext context, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildLandscapePresetsPanel(context, isDark),
        if (_showChannelsPanel) ...[
          AppSpacings.spacingLgVertical,
          _buildLandscapeChannelsList(context, isDark),
        ],
      ],
    );
  }

  Widget _buildLandscapeChannelsList(BuildContext context, bool isDark) {
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final isLargeScreen = _screenService.isLargeScreen;
    final tileHeight = _scale(AppTileHeight.horizontal);
    final stateColor = _getStateColor(isDark);

    // Determine icon based on state
    IconData sectionIcon = MdiIcons.lightbulbGroup;
    if (widget.state == LightingState.mixed) {
      sectionIcon = Icons.tune;
    } else if (widget.state == LightingState.unsynced) {
      sectionIcon = Icons.warning_rounded;
    }

    // Large screens: 2 vertical tiles per row (square)
    // Small/medium: 1 horizontal tile per row with fixed height
    if (isLargeScreen) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildChannelsSectionHeader(isDark, sectionIcon, stateColor),
          AppSpacings.spacingSmVertical,
          GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacings.pMd,
            crossAxisSpacing: AppSpacings.pMd,
            childAspectRatio: AppTileAspectRatio.square,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: widget.channels.map((channel) {
              return UniversalTile(
                layout: TileLayout.vertical,
                icon: Icons.lightbulb_outline,
                activeIcon: Icons.lightbulb,
                name: channel.name,
                status: channel.statusText,
                isActive: channel.isOn && channel.isOnline,
                isOffline: !channel.isOnline,
                isSelected: channel.isSelected,
                activeColor: primaryColor,
                onTileTap: () => widget.onChannelTileTap?.call(channel),
                onIconTap: channel.isOnline
                    ? () => widget.onChannelIconTap?.call(channel)
                    : null,
                showGlow: false,
                showWarningBadge: false,
                showInactiveBorder: true,
                showSelectionIndicator: true,
              );
            }).toList(),
          ),
        ],
      );
    }

    // Small/medium: Column of fixed-height horizontal tiles
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildChannelsSectionHeader(isDark, sectionIcon, stateColor),
        AppSpacings.spacingSmVertical,
        ...widget.channels.asMap().entries.map((entry) {
          final index = entry.key;
          final channel = entry.value;
          final isLast = index == widget.channels.length - 1;

          return Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
            child: SizedBox(
              height: tileHeight,
              child: UniversalTile(
                layout: TileLayout.horizontal,
                icon: Icons.lightbulb_outline,
                activeIcon: Icons.lightbulb,
                name: channel.name,
                status: channel.statusText,
                isActive: channel.isOn && channel.isOnline,
                isOffline: !channel.isOnline,
                isSelected: channel.isSelected,
                activeColor: primaryColor,
                onTileTap: () => widget.onChannelTileTap?.call(channel),
                onIconTap: channel.isOnline
                    ? () => widget.onChannelIconTap?.call(channel)
                    : null,
                showGlow: false,
                showWarningBadge: false,
                showInactiveBorder: true,
                showSelectionIndicator: true,
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildChannelsSectionHeader(
    bool isDark,
    IconData icon,
    Color? stateColor,
  ) {
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final primaryTextColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;

    return SizedBox(
      height: _scale(28),
      child: Row(
        children: [
        Icon(
          icon,
          color: stateColor ?? secondaryColor,
          size: _scale(16),
        ),
        SizedBox(width: AppSpacings.pSm),
        Text(
          'Lights',
          style: TextStyle(
            color: stateColor ?? primaryTextColor,
            fontSize: AppFontSize.small,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(width: AppSpacings.pSm),
        Container(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pSm,
            vertical: _scale(2),
          ),
          decoration: BoxDecoration(
            color: stateColor?.withValues(alpha: 0.2) ??
                (isDark ? AppFillColorDark.light : AppFillColorLight.light),
            borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          ),
          child: Text(
            '${widget.channels.length}',
            style: TextStyle(
              color: stateColor ?? secondaryColor,
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const Spacer(),
        if (widget.state != LightingState.synced)
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              widget.onSyncAll?.call();
            },
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pMd,
                vertical: AppSpacings.pSm,
              ),
              decoration: BoxDecoration(
                color: stateColor,
                borderRadius: BorderRadius.circular(AppBorderRadius.medium),
              ),
              child: Text(
                widget.state == LightingState.mixed ? 'Sync All' : 'Retry',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLandscapePresetsPanel(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final isLargeScreen = _screenService.isLargeScreen;

    // Get presets based on selected capability
    final presets = _getPresetsForCapability(_selectedCapability, localizations);
    if (presets.isEmpty) return const SizedBox.shrink();

    // Special handling for color presets - show color swatches only
    if (_selectedCapability == LightCapability.color) {
      return _buildColorPresetsPanel(context, isDark, presets);
    }

    // Large screens: 2 vertical tiles per row (square)
    // Small/medium: 1 horizontal tile per row with fixed height
    if (isLargeScreen) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          SectionTitle(
            title: localizations.window_covering_presets_label,
            icon: MdiIcons.viewGrid,
          ),
          AppSpacings.spacingSmVertical,
          GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacings.pMd,
            crossAxisSpacing: AppSpacings.pMd,
            childAspectRatio: AppTileAspectRatio.square,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: presets.map((preset) {
              final bool isActive = _isPresetActive(preset);

              return UniversalTile(
                layout: TileLayout.vertical,
                icon: preset.icon,
                name: preset.label,
                isActive: isActive,
                activeColor: primaryColor,
                onTileTap: () => _applyPreset(preset),
                showGlow: false,
                showWarningBadge: false,
                showInactiveBorder: true,
              );
            }).toList(),
          ),
        ],
      );
    }

    // Small/medium: Column of fixed-height horizontal tiles
    final tileHeight = _scale(AppTileHeight.horizontal);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        AppSpacings.spacingSmVertical,
        ...presets.asMap().entries.map((entry) {
          final index = entry.key;
          final preset = entry.value;
          final bool isActive = _isPresetActive(preset);
          final isLast = index == presets.length - 1;

          return Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
            child: SizedBox(
              height: tileHeight,
              child: UniversalTile(
                layout: TileLayout.horizontal,
                icon: preset.icon,
                name: preset.label,
                isActive: isActive,
                activeColor: primaryColor,
                onTileTap: () => _applyPreset(preset),
                showGlow: false,
                showWarningBadge: false,
                showInactiveBorder: true,
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildColorPresetsPanel(
    BuildContext context,
    bool isDark,
    List<_LightPreset> presets,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final swatchSize = _scale(36);
    final borderColor =
        isDark ? AppBorderColorDark.base : AppBorderColorLight.base;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        AppSpacings.spacingSmVertical,
        GridView.count(
          crossAxisCount: 4,
          mainAxisSpacing: AppSpacings.pSm,
          crossAxisSpacing: AppSpacings.pSm,
          childAspectRatio: 1.0,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: presets.map((preset) {
            final bool isActive = _isPresetActive(preset);
            final color = preset.color ?? Colors.white;

            return GestureDetector(
              onTap: () => _applyPreset(preset),
              child: Container(
                width: swatchSize,
                height: swatchSize,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  border: Border.all(
                    color: isActive ? color : borderColor,
                    width: isActive ? _scale(3) : _scale(1),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  List<_LightPreset> _getPresetsForCapability(
    LightCapability capability,
    AppLocalizations localizations,
  ) {
    switch (capability) {
      case LightCapability.brightness:
        return [
          _LightPreset(
            icon: Icons.brightness_low,
            label: '25%',
            value: 25,
            type: _PresetType.brightness,
          ),
          _LightPreset(
            icon: Icons.brightness_medium,
            label: '50%',
            value: 50,
            type: _PresetType.brightness,
          ),
          _LightPreset(
            icon: Icons.brightness_high,
            label: '75%',
            value: 75,
            type: _PresetType.brightness,
          ),
          _LightPreset(
            icon: Icons.wb_sunny,
            label: '100%',
            value: 100,
            type: _PresetType.brightness,
          ),
        ];
      case LightCapability.colorTemp:
        return [
          _LightPreset(
            icon: Icons.local_fire_department,
            label: localizations.light_preset_candle,
            value: 2700,
            type: _PresetType.colorTemp,
          ),
          _LightPreset(
            icon: Icons.nights_stay,
            label: localizations.light_preset_warm,
            value: 3200,
            type: _PresetType.colorTemp,
          ),
          _LightPreset(
            icon: Icons.wb_sunny,
            label: localizations.light_preset_daylight,
            value: 5000,
            type: _PresetType.colorTemp,
          ),
          _LightPreset(
            icon: Icons.ac_unit,
            label: localizations.light_preset_cool,
            value: 6500,
            type: _PresetType.colorTemp,
          ),
        ];
      case LightCapability.color:
        return [
          _LightPreset(
            icon: Icons.circle,
            label: localizations.light_color_red,
            value: 0,
            type: _PresetType.color,
            color: Colors.red,
          ),
          _LightPreset(
            icon: Icons.circle,
            label: localizations.light_color_orange,
            value: 30,
            type: _PresetType.color,
            color: Colors.orange,
          ),
          _LightPreset(
            icon: Icons.circle,
            label: localizations.light_color_yellow,
            value: 60,
            type: _PresetType.color,
            color: Colors.yellow,
          ),
          _LightPreset(
            icon: Icons.circle,
            label: localizations.light_color_green,
            value: 120,
            type: _PresetType.color,
            color: Colors.green,
          ),
          _LightPreset(
            icon: Icons.circle,
            label: localizations.light_color_cyan,
            value: 180,
            type: _PresetType.color,
            color: Colors.cyan,
          ),
          _LightPreset(
            icon: Icons.circle,
            label: localizations.light_color_blue,
            value: 240,
            type: _PresetType.color,
            color: Colors.blue,
          ),
          _LightPreset(
            icon: Icons.circle,
            label: localizations.light_color_purple,
            value: 270,
            type: _PresetType.color,
            color: Colors.purple,
          ),
          _LightPreset(
            icon: Icons.circle,
            label: localizations.light_color_pink,
            value: 330,
            type: _PresetType.color,
            color: Colors.pink,
          ),
        ];
      case LightCapability.white:
        return [
          _LightPreset(
            icon: Icons.brightness_low,
            label: '25%',
            value: 25,
            type: _PresetType.white,
          ),
          _LightPreset(
            icon: Icons.brightness_medium,
            label: '50%',
            value: 50,
            type: _PresetType.white,
          ),
          _LightPreset(
            icon: Icons.brightness_high,
            label: '75%',
            value: 75,
            type: _PresetType.white,
          ),
          _LightPreset(
            icon: Icons.wb_sunny,
            label: '100%',
            value: 100,
            type: _PresetType.white,
          ),
        ];
      default:
        return [];
    }
  }

  bool _isPresetActive(_LightPreset preset) {
    switch (preset.type) {
      case _PresetType.brightness:
        return (widget.brightness - preset.value).abs() < 5;
      case _PresetType.colorTemp:
        return (widget.colorTemp - preset.value).abs() < 200;
      case _PresetType.color:
        if (widget.color == null) return false;
        final hsv = HSVColor.fromColor(widget.color!);
        final hueDiff = (hsv.hue - preset.value).abs();
        return hueDiff < 15 || (360 - hueDiff) < 15;
      case _PresetType.white:
        return ((widget.whiteChannel ?? 0) - preset.value).abs() < 5;
    }
  }

  void _applyPreset(_LightPreset preset) {
    HapticFeedback.selectionClick();
    switch (preset.type) {
      case _PresetType.brightness:
        widget.onBrightnessChanged?.call(preset.value);
        break;
      case _PresetType.colorTemp:
        widget.onColorTempChanged?.call(preset.value);
        break;
      case _PresetType.color:
        final color = HSVColor.fromAHSV(1, preset.value.toDouble(), 1, 1).toColor();
        widget.onColorChanged?.call(color, 1.0);
        break;
      case _PresetType.white:
        widget.onWhiteChannelChanged?.call(preset.value);
        break;
    }
  }

  Widget _buildPortraitLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final presets = _getPresetsForCapability(_selectedCapability, localizations);
    final hasPresets = presets.isNotEmpty && !_isSimple;

    return DeviceDetailPortraitLayout(
      contentPadding: EdgeInsets.zero,
      scrollable: false,
      stickyBottom: _showChannelsPanel
          ? _buildPortraitChannelsList(context, isDark)
          : null,
      useStickyBottomPadding: false,
      content: Column(
        children: [
          if (!_isSimple) _buildHorizontalCapabilityTabs(context, isDark),
          Expanded(
            child: _isSimple
                ? _buildPowerButton(context, isDark)
                : _buildControlPanel(context, isDark, isLandscape: false),
          ),
          if (hasPresets) ...[
            _buildPortraitPresetsPanel(context, isDark, presets),
            SizedBox(height: AppSpacings.pMd),
          ],
        ],
      ),
    );
  }

  Widget _buildPortraitPresetsPanel(
    BuildContext context,
    bool isDark,
    List<_LightPreset> presets,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final tileWidth = _scale(AppTileWidth.horizontalMedium);
    final tileHeight = _scale(AppTileHeight.horizontal);

    // Special handling for color presets - show color swatches
    if (_selectedCapability == LightCapability.color) {
      return _buildPortraitColorPresetsPanel(context, isDark, presets);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            top: AppSpacings.pSm,
          ),
          child: SectionTitle(
            title: localizations.window_covering_presets_label,
            icon: MdiIcons.viewGrid,
          ),
        ),
        AppSpacings.spacingSmVertical,
        Padding(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            bottom: AppSpacings.pSm,
          ),
          child: HorizontalScrollWithGradient(
            height: tileHeight,
            layoutPadding: AppSpacings.pLg,
            itemCount: presets.length,
            separatorWidth: AppSpacings.pMd,
            itemBuilder: (context, index) {
              final preset = presets[index];
              final isActive = _isPresetActive(preset);

              return SizedBox(
                width: tileWidth,
                height: tileHeight,
                child: UniversalTile(
                  layout: TileLayout.horizontal,
                  icon: preset.icon,
                  name: preset.label,
                  isActive: isActive,
                  activeColor: primaryColor,
                  onTileTap: () => _applyPreset(preset),
                  showGlow: false,
                  showWarningBadge: false,
                  showInactiveBorder: true,
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildPortraitColorPresetsPanel(
    BuildContext context,
    bool isDark,
    List<_LightPreset> presets,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final swatchHeight = _scale(AppTileHeight.horizontal);
    final swatchWidth = _screenService.isLargeScreen ? swatchHeight * 2 : swatchHeight;
    final borderColor =
        isDark ? AppBorderColorDark.base : AppBorderColorLight.base;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            top: AppSpacings.pSm,
          ),
          child: SectionTitle(
            title: localizations.window_covering_presets_label,
            icon: MdiIcons.viewGrid,
          ),
        ),
        AppSpacings.spacingSmVertical,
        Padding(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            bottom: AppSpacings.pSm,
          ),
          child: HorizontalScrollWithGradient(
            height: swatchHeight,
            layoutPadding: AppSpacings.pLg,
            itemCount: presets.length,
            separatorWidth: AppSpacings.pMd,
            itemBuilder: (context, index) {
              final preset = presets[index];
              final isActive = _isPresetActive(preset);
              final presetColor = preset.color ?? Colors.white;

              return GestureDetector(
                onTap: () => _applyPreset(preset),
                child: Container(
                  width: swatchWidth,
                  height: swatchHeight,
                  decoration: BoxDecoration(
                    color: presetColor,
                    borderRadius: BorderRadius.circular(AppBorderRadius.small),
                    border: Border.all(
                      color: isActive ? presetColor : borderColor,
                      width: isActive ? 3 : 1,
                    ),
                    boxShadow: isActive
                        ? [
                            BoxShadow(
                              color: presetColor.withValues(alpha: 0.5),
                              blurRadius: 8,
                              spreadRadius: 2,
                            ),
                          ]
                        : null,
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildPortraitChannelsList(BuildContext context, bool isDark) {
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final stateColor = _getStateColor(isDark);
    final dividerColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.base;

    // Determine icon based on state
    IconData sectionIcon = MdiIcons.lightbulbGroup;
    if (widget.state == LightingState.mixed) {
      sectionIcon = Icons.tune;
    } else if (widget.state == LightingState.unsynced) {
      sectionIcon = Icons.warning_rounded;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            top: AppSpacings.pSm,
            bottom: AppSpacings.pSm,
          ),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: dividerColor,
                width: 1,
              ),
            ),
          ),
          child: _buildChannelsSectionHeader(isDark, sectionIcon, stateColor),
        ),
        AppSpacings.spacingMdVertical,
        Padding(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            bottom: AppSpacings.pMd,
          ),
          child: HorizontalScrollWithGradient(
            height: _scale(80),
            layoutPadding: AppSpacings.pLg,
            itemCount: widget.channels.length,
            separatorWidth: AppSpacings.pMd,
            itemBuilder: (context, index) {
              final channel = widget.channels[index];
              final tileWidth = _screenService.isSmallScreen
                  ? AppTileWidth.verticalMedium
                  : AppTileWidth.verticalLarge;

              return SizedBox(
                width: _scale(tileWidth),
                child: UniversalTile(
                  layout: TileLayout.vertical,
                  icon: Icons.lightbulb_outline,
                  activeIcon: Icons.lightbulb,
                  name: channel.name,
                  status: channel.statusText,
                  isActive: channel.isOn && channel.isOnline,
                  isOffline: !channel.isOnline,
                  isSelected: channel.isSelected,
                  activeColor: primaryColor,
                  onTileTap: () => widget.onChannelTileTap?.call(channel),
                  onIconTap: channel.isOnline
                      ? () => widget.onChannelIconTap?.call(channel)
                      : null,
                  showGlow: false,
                  showWarningBadge: false,
                  showInactiveBorder: true,
                  showSelectionIndicator: true,
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // CAPABILITY TABS
  // --------------------------------------------------------------------------

  Widget _buildHorizontalCapabilityTabs(BuildContext context, bool isDark) {
    final enabledCaps = _enabledCapabilities;
    if (enabledCaps.length <= 1) return const SizedBox.shrink();

    final modes = enabledCaps.map((cap) {
      return ModeOption<LightCapability>(
        value: cap,
        icon: _getCapabilityIcon(cap),
        label: _getCapabilityLabel(cap),
      );
    }).toList();

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pLg,
        vertical: AppSpacings.pMd,
      ),
      child: Container(
        padding: AppSpacings.paddingMd,
        decoration: BoxDecoration(
          color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          border: Border.all(
            color: isDark ? AppFillColorDark.light : AppBorderColorLight.light,
            width: 1,
          ),
        ),
        child: ModeSelector<LightCapability>(
          modes: modes,
          selectedValue: _selectedCapability,
          iconPlacement: ModeSelectorIconPlacement.top,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            setState(() => _selectedCapability = value);
          },
          orientation: ModeSelectorOrientation.horizontal,
          showLabels: !_screenService.isSmallScreen,
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // POWER BUTTON (simple mode)
  // --------------------------------------------------------------------------

  Widget _buildPowerButton(BuildContext context, bool isDark) {
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final inactiveBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final inactiveColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final infoText = widget.isOn ? 'Tap to turn off' : 'Tap to turn on';

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.mediumImpact();
              widget.onPowerToggle?.call();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: _scale(160),
              height: _scale(160),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.isOn ? primaryBgColor : inactiveBgColor,
                border: Border.all(
                  color: widget.isOn
                      ? primaryColor
                      : (isDark
                          ? AppColors.blank
                          : AppBorderColorLight.light),
                  width: widget.isOn ? _scale(4) : _scale(1),
                ),
                boxShadow: widget.isOn
                    ? [
                        BoxShadow(
                          color: primaryColor.withValues(alpha: 0.3),
                          blurRadius: _scale(40),
                          spreadRadius: 0,
                        ),
                        BoxShadow(
                          color: AppShadowColor.light,
                          blurRadius: _scale(20),
                          offset: Offset(0, _scale(4)),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: AppShadowColor.light,
                          blurRadius: _scale(20),
                          offset: Offset(0, _scale(4)),
                        ),
                      ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.power_settings_new,
                    size: _scale(44),
                    color: widget.isOn ? primaryColor : inactiveColor,
                  ),
                  AppSpacings.spacingMdVertical,
                  Text(
                    widget.isOn ? 'On' : 'Off',
                    style: TextStyle(
                      fontSize: _scale(26),
                      fontWeight: FontWeight.w300,
                      color: widget.isOn ? primaryColor : inactiveColor,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AppSpacings.spacingLgVertical,
          Text(
            infoText,
            style: TextStyle(
              fontSize: AppFontSize.small,
              color: isDark
                  ? AppTextColorDark.secondary
                  : AppTextColorLight.secondary,
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // CONTROL PANEL
  // --------------------------------------------------------------------------

  Widget _buildControlPanel(
    BuildContext context,
    bool isDark, {
    required bool isLandscape,
  }) {
    // Presets are shown separately (landscape: right column, portrait: bottom section)
    const showPresets = false;

    switch (_selectedCapability) {
      case LightCapability.brightness:
        return _BrightnessPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: widget.brightness,
          showChannelsPanel: _showChannelsPanel,
          showPresets: showPresets,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            widget.onBrightnessChanged?.call(value);
          },
        );
      case LightCapability.colorTemp:
        return _ColorTempPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: widget.colorTemp,
          showChannelsPanel: _showChannelsPanel,
          showPresets: showPresets,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            widget.onColorTempChanged?.call(value);
          },
        );
      case LightCapability.color:
        final color = widget.color ?? Colors.red;
        final hsv = HSVColor.fromColor(color);
        return _ColorPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          hue: hsv.hue,
          saturation: widget.saturation,
          showChannelsPanel: _showChannelsPanel,
          showPresets: showPresets,
          onChanged: (hue, sat) {
            final newColor = HSVColor.fromAHSV(1, hue, sat, 1).toColor();
            widget.onColorChanged?.call(newColor, sat);
          },
        );
      case LightCapability.white:
        return _WhitePanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: widget.whiteChannel ?? 80,
          showChannelsPanel: _showChannelsPanel,
          showPresets: showPresets,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            widget.onWhiteChannelChanged?.call(value);
          },
        );
      default:
        return const SizedBox.shrink();
    }
  }

}

// ============================================================================
// SLIDER PANELS (Brightness, Temp, White)
// ============================================================================

class _BrightnessPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final bool showChannelsPanel;
  final bool showPresets;
  final ValueChanged<int> onChanged;

  const _BrightnessPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.showChannelsPanel,
    required this.showPresets,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 0,
      maxValue: 100,
      displayValue: '$value%',
      showChannelsPanel: showChannelsPanel,
      showPresets: showPresets,
      gradientColors: [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ],
      thumbColor: AppColors.white,
      presets: const [25, 50, 75, 100],
      presetLabels: const ['25%', '50%', '75%', '100%'],
      presetIcons: const [
        Icons.brightness_low,
        Icons.brightness_medium,
        Icons.brightness_high,
        Icons.wb_sunny,
      ],
      onChanged: onChanged,
    );
  }
}

class _ColorTempPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final bool showChannelsPanel;
  final bool showPresets;
  final ValueChanged<int> onChanged;

  const _ColorTempPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.showChannelsPanel,
    required this.showPresets,
    required this.onChanged,
  });

  Color _getColorTempColor(int temp) {
    final t = (temp - 2700) / (6500 - 2700);
    if (t < 0.33) {
      // Segment 1: 0 to 0.33
      return Color.lerp(
          const Color(0xFFFF9800), const Color(0xFFFFFAF0), t / 0.33)!;
    } else if (t < 0.66) {
      // Segment 2: 0.33 to 0.66
      return Color.lerp(
          const Color(0xFFFFFAF0), const Color(0xFFE3F2FD), (t - 0.33) / 0.33)!;
    } else {
      // Segment 3: 0.66 to 1.0 (width 0.34, not 0.33)
      return Color.lerp(
          const Color(0xFFE3F2FD), const Color(0xFF64B5F6), (t - 0.66) / 0.34)!;
    }
  }

  String _getColorTempName(int temp) {
    if (temp <= 2700) return 'Candle';
    if (temp <= 3200) return 'Warm White';
    if (temp <= 4000) return 'Neutral';
    if (temp <= 5000) return 'Daylight';
    return 'Cool White';
  }

  @override
  Widget build(BuildContext context) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 2700,
      maxValue: 6500,
      displayValue: '${value}K',
      sublabel: _getColorTempName(value),
      showChannelsPanel: showChannelsPanel,
      showPresets: showPresets,
      gradientColors: const [
        Color(0xFFFF9800),
        Color(0xFFFFFAF0),
        Color(0xFFE3F2FD),
        Color(0xFF64B5F6),
      ],
      thumbColor: _getColorTempColor(value),
      presets: const [2700, 3200, 5000, 6500],
      presetLabels: const ['Candle', 'Warm', 'Daylight', 'Cool'],
      presetIcons: const [
        Icons.local_fire_department,
        Icons.nights_stay,
        Icons.wb_sunny,
        Icons.ac_unit,
      ],
      onChanged: onChanged,
    );
  }
}

class _WhitePanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final bool showChannelsPanel;
  final bool showPresets;
  final ValueChanged<int> onChanged;

  const _WhitePanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.showChannelsPanel,
    required this.showPresets,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 0,
      maxValue: 100,
      displayValue: '$value%',
      showChannelsPanel: showChannelsPanel,
      showPresets: showPresets,
      gradientColors: [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ],
      thumbColor: AppColors.white,
      presets: const [25, 50, 75, 100],
      presetLabels: const ['25%', '50%', '75%', '100%'],
      presetIcons: const [
        Icons.brightness_low,
        Icons.brightness_medium,
        Icons.brightness_high,
        Icons.wb_sunny,
      ],
      onChanged: onChanged,
    );
  }
}

// ============================================================================
// GENERIC SLIDER PANEL
// ============================================================================

class _SliderPanel extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final bool isLandscape;
  final bool isDark;
  final int value;
  final int minValue;
  final int maxValue;
  final String displayValue;
  final String? sublabel;
  final bool showChannelsPanel;
  final bool showPresets;
  final List<Color> gradientColors;
  final Color thumbColor;
  final List<int>? presets;
  final List<String>? presetLabels;
  final List<IconData>? presetIcons;
  final ValueChanged<int> onChanged;

  _SliderPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.minValue,
    required this.maxValue,
    required this.displayValue,
    this.sublabel,
    required this.showChannelsPanel,
    required this.showPresets,
    required this.gradientColors,
    this.thumbColor = AppColors.white,
    this.presets,
    this.presetLabels,
    this.presetIcons,
    required this.onChanged,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    if (isLandscape) {
      return Padding(
        padding: EdgeInsets.all(AppSpacings.pLg),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: _buildDisplay()),
            AppSpacings.spacingLgHorizontal,
            _buildVerticalSlider(),
            if (presets != null && showPresets) ...[
              AppSpacings.spacingMdHorizontal,
              _buildVerticalPresets(),
            ],
          ],
        ),
      );
    } else {
      return Padding(
        padding: EdgeInsets.only(
          left: AppSpacings.pLg,
          right: AppSpacings.pLg,
          top: AppSpacings.pSm,
          bottom: AppSpacings.pLg,
        ),
        child: Column(
          children: [
            Expanded(child: _buildDisplay()),
            AppSpacings.spacingLgVertical,
            _buildHorizontalSlider(),
            if (presets != null && showPresets) ...[
              AppSpacings.spacingLgVertical,
              _buildHorizontalPresets(),
            ],
          ],
        ),
      );
    }
  }

  Widget _buildDisplay() {
    final match = RegExp(r'^(\d+)(.*)$').firstMatch(displayValue);
    final valueText = match?.group(1) ?? displayValue;
    final unitText = match?.group(2) ?? '';

    return Container(
      padding: EdgeInsets.all(AppSpacings.pSm),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: isDark
            ? null
            : Border.all(
                color: AppBorderColorLight.light,
                width: _scale(1),
              ),
      ),
      child: Center(
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    valueText,
                    style: TextStyle(
                      fontFamily: 'DIN1451',
                      fontSize: _scale(60),
                      fontWeight: FontWeight.w100,
                      height: 1.0,
                      color: isDark
                          ? AppTextColorDark.regular
                          : AppTextColorLight.regular,
                    ),
                  ),
                  if (unitText.isNotEmpty)
                    Text(
                      unitText,
                      style: TextStyle(
                        fontFamily: 'DIN1451',
                        fontSize: _scale(25),
                        fontWeight: FontWeight.w100,
                        height: 1.0,
                        color: isDark
                            ? AppTextColorDark.regular
                            : AppTextColorLight.regular,
                      ),
                    ),
                ],
              ),
              if (sublabel != null) ...[
                AppSpacings.spacingSmVertical,
                Text(
                  sublabel!,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                    fontSize: AppFontSize.extraLarge,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVerticalSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = (value - minValue) / (maxValue - minValue);

    return SizedBox(
      width: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * (1 - progress);

          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newProgress =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            onTapDown: (details) {
              final newProgress =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: gradientColors,
                ),
                borderRadius: BorderRadius.circular(_scale(26)),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(thumbSize),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = (value - minValue) / (maxValue - minValue);

    return SizedBox(
      height: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * progress;

          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: gradientColors,
                ),
                borderRadius: BorderRadius.circular(_scale(26)),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(thumbSize),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildThumb(double size) {
    final borderColor =
        isDark ? AppTextColorDark.primary : AppBorderColorLight.base;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(size / 2),
        border: Border.all(
          color: borderColor,
          width: _scale(3),
        ),
        boxShadow: [
          BoxShadow(
            color: AppShadowColor.medium,
            blurRadius: _scale(8),
            offset: Offset(0, _scale(2)),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: _scale(20),
          height: _scale(20),
          decoration: BoxDecoration(
            color: thumbColor,
            borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          ),
        ),
      ),
    );
  }

  Widget _buildHorizontalPresets() {
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final inactiveColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.primary;
    final inactiveBorderColor =
        isDark ? AppColors.blank : AppBorderColorLight.light;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Use icons on small screens, text on larger screens
        final isSmallScreen = _screenService.isSmallScreen;
        final useIcons = isSmallScreen &&
            presetIcons != null &&
            presetIcons!.length == presets!.length;
        final buttonPadding = isSmallScreen ? AppSpacings.pMd : AppSpacings.pLg;

        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(presets!.length, (index) {
            final preset = presets![index];
            final isActive =
                (value - preset).abs() < (maxValue - minValue) * 0.05;
            final borderWidth = isActive ? _scale(2) : _scale(1);
            final paddingCompensation = isActive ? 0.0 : _scale(1);

            return Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pSm),
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  onChanged(preset);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: EdgeInsets.all(buttonPadding + paddingCompensation),
                  decoration: BoxDecoration(
                    color: isActive
                        ? (isDark
                            ? AppColorsDark.primaryLight9
                            : AppColorsLight.primaryLight9)
                        : (isDark
                            ? AppFillColorDark.light
                            : AppFillColorLight.light),
                    borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                    border: Border.all(
                      color: isActive ? primaryColor : inactiveBorderColor,
                      width: borderWidth,
                    ),
                  ),
                  child: useIcons
                      ? Icon(
                          presetIcons![index],
                          size: _scale(18),
                          color: isActive ? primaryColor : inactiveColor,
                        )
                      : Text(
                          presetLabels![index],
                          style: TextStyle(
                            color: isActive ? primaryColor : inactiveColor,
                            fontSize: AppFontSize.base,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                ),
              ),
            );
          }),
        );
      },
    );
  }

  Widget _buildVerticalPresets() {
    final useIcons =
        presetIcons != null && presetIcons!.length == presets!.length;
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final inactiveColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.primary;
    final inactiveBorderColor =
        isDark ? AppColors.blank : AppBorderColorLight.light;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(presets!.length, (index) {
        final reversedIndex = presets!.length - 1 - index;
        final preset = presets![reversedIndex];
        final isActive = (value - preset).abs() < (maxValue - minValue) * 0.05;
        final borderWidth = isActive ? _scale(2) : _scale(1);
        final paddingCompensation = isActive ? 0.0 : _scale(1);

        return Padding(
          padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
          child: GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              onChanged(preset);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: EdgeInsets.all(AppSpacings.pMd + paddingCompensation),
              decoration: BoxDecoration(
                color: isActive
                    ? (isDark
                        ? AppColorsDark.primaryLight9
                        : AppColorsLight.primaryLight9)
                    : (isDark
                        ? AppFillColorDark.light
                        : AppFillColorLight.light),
                borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                border: Border.all(
                  color: isActive ? primaryColor : inactiveBorderColor,
                  width: borderWidth,
                ),
              ),
              child: useIcons
                  ? Icon(
                      presetIcons![reversedIndex],
                      size: _scale(18),
                      color: isActive ? primaryColor : inactiveColor,
                    )
                  : Text(
                      presetLabels![reversedIndex],
                      style: TextStyle(
                        color: isActive ? primaryColor : inactiveColor,
                        fontSize: AppFontSize.extraSmall,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
            ),
          ),
        );
      }),
    );
  }
}

// ============================================================================
// COLOR PANEL
// ============================================================================

class _ColorPanel extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final bool isLandscape;
  final bool isDark;
  final double hue;
  final double saturation;
  final bool showChannelsPanel;
  final bool showPresets;
  final Function(double hue, double saturation) onChanged;

  _ColorPanel({
    required this.isLandscape,
    required this.isDark,
    required this.hue,
    required this.saturation,
    required this.onChanged,
    this.showChannelsPanel = true,
    this.showPresets = true,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final color = HSVColor.fromAHSV(1, hue, saturation, 1).toColor();

    final presetColors = [
      Colors.red,
      Colors.orange,
      Colors.yellow,
      Colors.green,
      Colors.cyan,
      Colors.blue,
      Colors.purple,
      Colors.pink,
    ];

    if (isLandscape) {
      return Padding(
        padding: EdgeInsets.all(AppSpacings.pLg),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: showPresets
                  ? Column(
                      children: [
                        Expanded(
                          flex: 2,
                          child: _buildDisplay(color),
                        ),
                        AppSpacings.spacingMdVertical,
                        _buildColorPresets(presetColors),
                      ],
                    )
                  : _buildDisplay(color),
            ),
            AppSpacings.spacingLgHorizontal,
            _buildVerticalHueSlider(),
            AppSpacings.spacingMdHorizontal,
            _buildVerticalSatSlider(),
          ],
        ),
      );
    } else {
      final showColorPreview = !_screenService.isSmallScreen;

      return Padding(
        padding: EdgeInsets.only(
          left: AppSpacings.pLg,
          right: AppSpacings.pLg,
          top: AppSpacings.pSm,
          bottom: AppSpacings.pLg,
        ),
        child: Column(
          children: [
            if (showColorPreview) ...[
              Expanded(
                flex: 2,
                child: _buildDisplay(color),
              ),
              AppSpacings.spacingLgVertical,
            ],
            if (showPresets) ...[
              Expanded(child: _buildColorPresets(presetColors)),
              AppSpacings.spacingLgVertical,
            ],
            _buildHorizontalHueSlider(),
            AppSpacings.spacingLgVertical,
            _buildHorizontalSatSlider(),
          ],
        ),
      );
    }
  }

  Widget _buildDisplay(Color color) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.4),
            blurRadius: _scale(20),
            spreadRadius: _scale(2),
          ),
        ],
      ),
    );
  }

  Widget _buildColorPresets(List<Color> presetColors) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: presetColors.sublist(0, 4).map((presetColor) {
            return _buildColorSwatch(presetColor);
          }).toList(),
        ),
        AppSpacings.spacingSmVertical,
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: presetColors.sublist(4, 8).map((presetColor) {
            return _buildColorSwatch(presetColor);
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildColorSwatch(Color presetColor) {
    final presetHsv = HSVColor.fromColor(presetColor);
    // Handle circular hue comparison (0° and 360° are the same)
    final hueDiff = (presetHsv.hue - hue).abs();
    final isSelected = (hueDiff < 15) || (360 - hueDiff < 15);

    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onChanged(presetHsv.hue, saturation);
        },
        child: Container(
          height: _scale(28),
          margin: EdgeInsets.symmetric(horizontal: AppSpacings.pXs),
          decoration: BoxDecoration(
            color: presetColor,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            border: isSelected
                ? Border.all(
                    color: AppColors.white,
                    width: _scale(2),
                  )
                : null,
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: presetColor.withValues(alpha: 0.5),
                      blurRadius: _scale(8),
                      spreadRadius: _scale(1),
                    ),
                  ]
                : null,
          ),
        ),
      ),
    );
  }

  Widget _buildVerticalHueSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = hue / 360;

    return SizedBox(
      width: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * progress;

          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFFF0000),
                    Color(0xFFFFFF00),
                    Color(0xFF00FF00),
                    Color(0xFF00FFFF),
                    Color(0xFF0000FF),
                    Color(0xFFFF00FF),
                    Color(0xFFFF0000),
                  ],
                ),
                borderRadius: BorderRadius.circular(_scale(26)),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(
                        thumbSize, HSVColor.fromAHSV(1, hue, 1, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildVerticalSatSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final currentColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();

    return SizedBox(
      width: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * (1 - saturation);

          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newSat =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            onTapDown: (details) {
              final newSat =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [currentColor, AppColors.white],
                ),
                borderRadius: BorderRadius.circular(_scale(26)),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(thumbSize,
                        HSVColor.fromAHSV(1, hue, saturation, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalHueSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final progress = hue / 360;

    return SizedBox(
      height: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * progress;

          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFFFF0000),
                    Color(0xFFFFFF00),
                    Color(0xFF00FF00),
                    Color(0xFF00FFFF),
                    Color(0xFF0000FF),
                    Color(0xFFFF00FF),
                    Color(0xFFFF0000),
                  ],
                ),
                borderRadius: BorderRadius.circular(_scale(26)),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(
                        thumbSize, HSVColor.fromAHSV(1, hue, 1, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalSatSlider() {
    final thumbSize = _scale(44);
    final padding = AppSpacings.pSm;
    final currentColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();

    return SizedBox(
      height: _scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * saturation;

          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newSat =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            onTapDown: (details) {
              final newSat =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.white, currentColor],
                ),
                borderRadius: BorderRadius.circular(_scale(26)),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: _scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(thumbSize,
                        HSVColor.fromAHSV(1, hue, saturation, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildThumb(double size, Color color) {
    final borderColor =
        isDark ? AppTextColorDark.primary : AppBorderColorLight.base;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(size / 2),
        border: Border.all(
          color: borderColor,
          width: _scale(3),
        ),
        boxShadow: [
          BoxShadow(
            color: AppShadowColor.medium,
            blurRadius: _scale(8),
            offset: Offset(0, _scale(2)),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: _scale(20),
          height: _scale(20),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// PRESET TYPES
// ============================================================================

enum _PresetType {
  brightness,
  colorTemp,
  color,
  white,
}

class _LightPreset {
  final IconData icon;
  final String label;
  final int value;
  final _PresetType type;
  final Color? color;

  const _LightPreset({
    required this.icon,
    required this.label,
    required this.value,
    required this.type,
    this.color,
  });
}

