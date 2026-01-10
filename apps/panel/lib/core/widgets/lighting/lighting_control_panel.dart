import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/lighting_channel_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
    final bgColor = isDark ? AppBgColorDark.base : AppBgColorLight.base;

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
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: _scale(isLandscape ? 10 : 16),
        vertical: _scale(isLandscape ? 8 : 12),
      ),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: borderColor,
            width: _scale(1),
          ),
        ),
      ),
      child: Row(
        children: [
          _HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: widget.onBack,
            isDark: isDark,
          ),
          SizedBox(width: AppSpacings.pMd),
          Icon(
            widget.icon,
            color: isDark ? AppColorsDark.primary : AppColorsLight.primary,
            size: _scale(24),
          ),
          SizedBox(width: AppSpacings.pMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.title,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.primary
                        : AppTextColorLight.primary,
                    fontSize: AppFontSize.large,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (widget.subtitle != null)
                  Text(
                    widget.subtitle!,
                    style: TextStyle(
                      color: isDark
                          ? AppTextColorDark.secondary
                          : AppTextColorLight.secondary,
                      fontSize: AppFontSize.small,
                      fontWeight: FontWeight.w400,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          if (!_isSimple) ...[
            SizedBox(width: AppSpacings.pMd),
            GestureDetector(
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
                ),
                child: Icon(
                  Icons.power_settings_new,
                  size: _scale(18),
                  color: widget.isOn
                      ? Colors.white
                      : (isDark
                          ? AppTextColorDark.secondary
                          : AppTextColorLight.secondary),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Color? _getStateColor(bool isDark) {
    switch (widget.state) {
      case LightingState.synced:
        return null;
      case LightingState.mixed:
        // Blue - informational, devices have different values
        return AppColorsLight.secondary;
      case LightingState.unsynced:
        // Yellow/warning - sync was attempted but failed
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
    }
  }

  // --------------------------------------------------------------------------
  // LAYOUTS
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
    return Row(
      children: [
        if (!_isSimple) _buildVerticalCapabilityTabs(context, isDark),
        Expanded(
          child: _isSimple
              ? _buildPowerButton(context, isDark)
              : _buildControlPanel(context, isDark, isLandscape: true),
        ),
        if (_showChannelsPanel)
          _buildChannelsPanel(context, isDark, isLandscape: true),
      ],
    );
  }

  Widget _buildPortraitLayout(BuildContext context, bool isDark) {
    return Column(
      children: [
        if (!_isSimple) _buildHorizontalCapabilityTabs(context, isDark),
        Expanded(
          child: _isSimple
              ? _buildPowerButton(context, isDark)
              : _buildControlPanel(context, isDark, isLandscape: false),
        ),
        if (_showChannelsPanel)
          _buildChannelsPanel(context, isDark, isLandscape: false),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // CAPABILITY TABS
  // --------------------------------------------------------------------------

  Widget _buildHorizontalCapabilityTabs(BuildContext context, bool isDark) {
    final enabledCaps = _enabledCapabilities;
    if (enabledCaps.length <= 1) return const SizedBox.shrink();

    final dividerColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

    return Container(
      padding: EdgeInsets.all(AppSpacings.pMd),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: dividerColor, width: _scale(1)),
        ),
      ),
      child: Row(
        children: enabledCaps.map((cap) {
          final isSelected = _selectedCapability == cap;
          return Expanded(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pSm),
              child: _CapabilityTab(
                capability: cap,
                isSelected: isSelected,
                isDark: isDark,
                isLandscape: false,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _selectedCapability = cap);
                },
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildVerticalCapabilityTabs(BuildContext context, bool isDark) {
    final enabledCaps = _enabledCapabilities;
    if (enabledCaps.length <= 1) return const SizedBox.shrink();

    final dividerColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
      decoration: BoxDecoration(
        border: Border(
          right: BorderSide(color: dividerColor, width: _scale(1)),
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: enabledCaps.map((cap) {
          final isSelected = _selectedCapability == cap;
          return Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacings.pXs),
            child: _CapabilityTab(
              capability: cap,
              isSelected: isSelected,
              isDark: isDark,
              isLandscape: true,
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _selectedCapability = cap);
              },
            ),
          );
        }).toList(),
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
                          ? Colors.transparent
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
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: _scale(20),
                          offset: Offset(0, _scale(4)),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
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
                  SizedBox(height: AppSpacings.pMd),
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
          SizedBox(height: AppSpacings.pLg),
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
    switch (_selectedCapability) {
      case LightCapability.brightness:
        return _BrightnessPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: widget.brightness,
          showChannelsPanel: _showChannelsPanel,
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
          onChanged: (value) {
            HapticFeedback.selectionClick();
            widget.onWhiteChannelChanged?.call(value);
          },
        );
      default:
        return const SizedBox.shrink();
    }
  }

  // --------------------------------------------------------------------------
  // CHANNELS PANEL
  // --------------------------------------------------------------------------

  Widget _buildChannelsPanel(
    BuildContext context,
    bool isDark, {
    required bool isLandscape,
  }) {
    final dividerColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final stateColor = _getStateColor(isDark);

    if (isLandscape) {
      return _buildLandscapeChannelsPanel(
          context, isDark, dividerColor, stateColor);
    } else {
      return _buildPortraitChannelsPanel(
          context, isDark, dividerColor, stateColor);
    }
  }

  Widget _buildLandscapeChannelsPanel(
    BuildContext context,
    bool isDark,
    Color dividerColor,
    Color? stateColor,
  ) {
    final tileHeight = _scale(70);
    final rows = <Widget>[];

    for (var i = 0; i < widget.channels.length; i += 2) {
      final rowChannels = widget.channels.skip(i).take(2).toList();
      rows.add(
        Padding(
          padding: EdgeInsets.only(bottom: AppSpacings.pMd),
          child: SizedBox(
            height: tileHeight,
            child: Row(
              children: [
                for (var j = 0; j < 2; j++) ...[
                  if (j > 0) SizedBox(width: AppSpacings.pMd),
                  Expanded(
                    child: j < rowChannels.length
                        ? LightingChannelTile(
                            channel: rowChannels[j],
                            onIconTap: () => widget.onChannelIconTap
                                ?.call(rowChannels[j]),
                            onTileTap: () => widget.onChannelTileTap
                                ?.call(rowChannels[j]),
                          )
                        : const SizedBox.shrink(),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      width: _scale(180),
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(color: dividerColor, width: _scale(1)),
        ),
      ),
      child: Column(
        children: [
          _buildChannelsPanelHeader(context, isDark, isLandscape: true),
          Expanded(
            child: ListView(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pMd,
                vertical: AppSpacings.pMd,
              ),
              children: rows,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPortraitChannelsPanel(
    BuildContext context,
    bool isDark,
    Color dividerColor,
    Color? stateColor,
  ) {
    return Container(
      height: _scale(140),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: stateColor ?? dividerColor,
            width: _scale(1),
          ),
        ),
      ),
      child: Column(
        children: [
          _buildChannelsPanelHeader(context, isDark, isLandscape: false),
          Expanded(
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pMd,
                vertical: AppSpacings.pMd,
              ),
              itemCount: widget.channels.length,
              itemBuilder: (context, index) {
                return Padding(
                  padding: EdgeInsets.only(right: AppSpacings.pMd),
                  child: AspectRatio(
                    aspectRatio: 1.0,
                    child: LightingChannelTile(
                      channel: widget.channels[index],
                      onIconTap: () =>
                          widget.onChannelIconTap?.call(widget.channels[index]),
                      onTileTap: () =>
                          widget.onChannelTileTap?.call(widget.channels[index]),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChannelsPanelHeader(
    BuildContext context,
    bool isDark, {
    required bool isLandscape,
  }) {
    final stateColor = _getStateColor(isDark);
    final dividerColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

    // Use state-specific icon when not synced, otherwise use configured icon
    IconData panelIcon = widget.channelsPanelIcon;
    if (widget.state == LightingState.mixed) {
      panelIcon = Icons.tune; // Informational - devices have different values
    } else if (widget.state == LightingState.unsynced) {
      panelIcon = Icons.warning_rounded; // Warning - sync failed
    }

    return Container(
      height: _scale(36),
      padding: EdgeInsets.symmetric(
        horizontal: isLandscape ? AppSpacings.pMd : AppSpacings.pLg,
      ),
      decoration: BoxDecoration(
        color: stateColor?.withValues(alpha: 0.1),
        border: Border(
          bottom: BorderSide(
            color: stateColor ?? dividerColor,
            width: _scale(1),
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            panelIcon,
            color: stateColor ??
                (isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary),
            size: _scale(14),
          ),
          SizedBox(width: isLandscape ? AppSpacings.pSm : AppSpacings.pMd),
          Text(
            'Lights',
            style: TextStyle(
              color: stateColor ??
                  (isDark
                      ? AppTextColorDark.primary
                      : AppTextColorLight.primary),
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(width: isLandscape ? AppSpacings.pSm : AppSpacings.pMd),
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
                color: stateColor ??
                    (isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary),
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
                    color: Colors.white,
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
}

// ============================================================================
// CAPABILITY TAB
// ============================================================================

class _CapabilityTab extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final LightCapability capability;
  final bool isSelected;
  final bool isDark;
  final bool isLandscape;
  final VoidCallback onTap;

  _CapabilityTab({
    required this.capability,
    required this.isSelected,
    required this.isDark,
    required this.isLandscape,
    required this.onTap,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  IconData get _icon {
    switch (capability) {
      case LightCapability.brightness:
        return Icons.wb_sunny_outlined;
      case LightCapability.colorTemp:
        return Icons.thermostat_outlined;
      case LightCapability.color:
        return Icons.palette_outlined;
      case LightCapability.white:
        return Icons.light_mode_outlined;
      default:
        return Icons.tune;
    }
  }

  String get _label {
    switch (capability) {
      case LightCapability.brightness:
        return 'Bright';
      case LightCapability.colorTemp:
        return 'Temp';
      case LightCapability.color:
        return 'Color';
      case LightCapability.white:
        return 'White';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final bgColor = isDark ? AppBgColorDark.base : AppBgColorLight.base;
    final inactiveColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final selectedBg =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;

    final borderWidth = isSelected ? _scale(2) : _scale(1);
    final paddingCompensation = isSelected ? 0.0 : _scale(1);

    final content = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: EdgeInsets.symmetric(
        vertical:
            (isLandscape ? AppSpacings.pMd : _scale(8)) + paddingCompensation,
        horizontal: (isLandscape ? AppSpacings.pMd : 0) + paddingCompensation,
      ),
      decoration: BoxDecoration(
        color: isSelected ? selectedBg : bgColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: isSelected
              ? primaryColor
              : (isDark ? AppBorderColorDark.light : AppBorderColorLight.light),
          width: borderWidth,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _icon,
            size: _scale(isLandscape ? 16 : 20),
            color: isSelected ? primaryColor : inactiveColor,
          ),
          SizedBox(height: AppSpacings.pSm),
          Text(
            _label,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              color: isSelected ? primaryColor : inactiveColor,
            ),
          ),
        ],
      ),
    );

    return GestureDetector(
      onTap: onTap,
      child: isLandscape
          ? SizedBox(width: _scale(52), child: content)
          : content,
    );
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
  final ValueChanged<int> onChanged;

  const _BrightnessPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.showChannelsPanel,
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
  final ValueChanged<int> onChanged;

  const _ColorTempPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.showChannelsPanel,
    required this.onChanged,
  });

  Color _getColorTempColor(int temp) {
    final t = (temp - 2700) / (6500 - 2700);
    if (t < 0.33) {
      return Color.lerp(
          const Color(0xFFFF9800), const Color(0xFFFFFAF0), t * 3)!;
    } else if (t < 0.66) {
      return Color.lerp(
          const Color(0xFFFFFAF0), const Color(0xFFE3F2FD), (t - 0.33) * 3)!;
    } else {
      return Color.lerp(
          const Color(0xFFE3F2FD), const Color(0xFF64B5F6), (t - 0.66) * 3)!;
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
  final ValueChanged<int> onChanged;

  const _WhitePanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.showChannelsPanel,
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
            SizedBox(width: AppSpacings.pLg),
            _buildVerticalSlider(),
            if (presets != null) ...[
              SizedBox(width: AppSpacings.pMd),
              _buildVerticalPresets(),
            ],
          ],
        ),
      );
    } else {
      return Padding(
        padding: EdgeInsets.all(AppSpacings.pLg),
        child: Column(
          children: [
            Expanded(child: _buildDisplay()),
            SizedBox(height: AppSpacings.pLg),
            _buildHorizontalSlider(),
            if (presets != null) ...[
              SizedBox(height: AppSpacings.pLg),
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
      padding: EdgeInsets.all(AppSpacings.pLg),
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
                SizedBox(height: AppSpacings.pSm),
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
          final trackHeight = constraints.maxHeight - thumbSize - padding * 2;
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
          final trackWidth = constraints.maxWidth - thumbSize - padding * 2;
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
            color: AppColors.black.withValues(alpha: 0.2),
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
    final inactiveTextColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.primary;
    final inactiveBorderColor =
        isDark ? Colors.transparent : AppBorderColorLight.light;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(presets!.length, (index) {
        final preset = presets![index];
        final isActive = (value - preset).abs() < (maxValue - minValue) * 0.05;
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
              duration: const Duration(milliseconds: 150),
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pMd + paddingCompensation,
                vertical: AppSpacings.pSm + paddingCompensation,
              ),
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
              child: Text(
                presetLabels![index],
                style: TextStyle(
                  color: isActive ? primaryColor : inactiveTextColor,
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildVerticalPresets() {
    final useIcons =
        presetIcons != null && presetIcons!.length == presets!.length;
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final inactiveColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.primary;
    final inactiveBorderColor =
        isDark ? Colors.transparent : AppBorderColorLight.light;

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
              duration: const Duration(milliseconds: 150),
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
  final Function(double hue, double saturation) onChanged;

  _ColorPanel({
    required this.isLandscape,
    required this.isDark,
    required this.hue,
    required this.saturation,
    required this.onChanged,
    this.showChannelsPanel = true,
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
              child: Column(
                children: [
                  Expanded(
                    flex: 2,
                    child: _buildDisplay(color),
                  ),
                  SizedBox(height: AppSpacings.pMd),
                  _buildColorPresets(presetColors),
                ],
              ),
            ),
            SizedBox(width: AppSpacings.pLg),
            _buildVerticalHueSlider(),
            SizedBox(width: AppSpacings.pMd),
            _buildVerticalSatSlider(),
          ],
        ),
      );
    } else {
      return Padding(
        padding: EdgeInsets.all(AppSpacings.pLg),
        child: Column(
          children: [
            if (!showChannelsPanel) ...[
              Expanded(
                flex: 2,
                child: _buildDisplay(color),
              ),
              SizedBox(height: AppSpacings.pLg),
            ],
            Expanded(child: _buildColorPresets(presetColors)),
            SizedBox(height: AppSpacings.pLg),
            _buildHorizontalHueSlider(),
            SizedBox(height: AppSpacings.pLg),
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
        SizedBox(height: AppSpacings.pSm),
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
    final isSelected = (presetHsv.hue - hue).abs() < 15;

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
                    color: Colors.white,
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
          final trackHeight = constraints.maxHeight - thumbSize - padding * 2;
          final thumbOffset = trackHeight * (1 - progress);

          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newProgress =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            onTapDown: (details) {
              final newProgress =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
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
          final trackHeight = constraints.maxHeight - thumbSize - padding * 2;
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
                  colors: [currentColor, Colors.white],
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
          final trackWidth = constraints.maxWidth - thumbSize - padding * 2;
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
          final trackWidth = constraints.maxWidth - thumbSize - padding * 2;
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
                  colors: [Colors.white, currentColor],
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
            color: AppColors.black.withValues(alpha: 0.2),
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
// HEADER ICON BUTTON
// ============================================================================

class _HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final bool isDark;

  const _HeaderIconButton({
    required this.icon,
    this.onTap,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    double scale(double s) =>
        screenService.scale(s, density: visualDensityService.density);

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap?.call();
      },
      child: Container(
        width: scale(36),
        height: scale(36),
        decoration: BoxDecoration(
          color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
          borderRadius: BorderRadius.circular(AppBorderRadius.round),
        ),
        child: Icon(
          icon,
          color:
              isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
          size: scale(18),
        ),
      ),
    );
  }
}
