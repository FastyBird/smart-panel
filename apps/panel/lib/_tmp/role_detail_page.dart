import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ============================================================================
// DATA MODELS
// ============================================================================

enum LightCapability { power, brightness, colorTemp, color, white }

enum RoleState { synced, mixed, unsynced }

class LightDevice {
  final String id;
  final String name;
  final bool isOn;
  final int brightness;
  final int colorTemp;
  final Color? color;
  final int? whiteChannel;
  final Set<LightCapability> capabilities;
  final bool isOnline;
  final bool isMixed;

  const LightDevice({
    required this.id,
    required this.name,
    this.isOn = false,
    this.brightness = 0,
    this.colorTemp = 4000,
    this.color,
    this.whiteChannel,
    this.capabilities = const {LightCapability.power},
    this.isOnline = true,
    this.isMixed = false,
  });

  LightDevice copyWith({
    String? id,
    String? name,
    bool? isOn,
    int? brightness,
    int? colorTemp,
    Color? color,
    int? whiteChannel,
    Set<LightCapability>? capabilities,
    bool? isOnline,
    bool? isMixed,
  }) {
    return LightDevice(
      id: id ?? this.id,
      name: name ?? this.name,
      isOn: isOn ?? this.isOn,
      brightness: brightness ?? this.brightness,
      colorTemp: colorTemp ?? this.colorTemp,
      color: color ?? this.color,
      whiteChannel: whiteChannel ?? this.whiteChannel,
      capabilities: capabilities ?? this.capabilities,
      isOnline: isOnline ?? this.isOnline,
      isMixed: isMixed ?? this.isMixed,
    );
  }
}

class LightingRole {
  final String id;
  final String name;
  final IconData icon;
  final List<LightDevice> lights;
  final RoleState state;
  final int brightness;
  final int colorTemp;
  final Color? color;
  final double saturation;
  final int? whiteChannel;
  final bool isSimple;
  final bool showLightsPanel;

  const LightingRole({
    required this.id,
    required this.name,
    required this.icon,
    required this.lights,
    this.state = RoleState.synced,
    this.brightness = 65,
    this.colorTemp = 4000,
    this.color,
    this.saturation = 1.0,
    this.whiteChannel,
    this.isSimple = false,
    this.showLightsPanel = true,
  });

  Set<LightCapability> get capabilities {
    final caps = <LightCapability>{};
    for (final light in lights) {
      caps.addAll(light.capabilities);
    }
    return caps;
  }

  int get activeCount => lights.where((l) => l.isOn && l.isOnline).length;
  int get totalCount => lights.length;
  bool get anyOn => lights.any((l) => l.isOn && l.isOnline);

  LightingRole copyWith({
    String? id,
    String? name,
    IconData? icon,
    List<LightDevice>? lights,
    RoleState? state,
    int? brightness,
    int? colorTemp,
    Color? color,
    double? saturation,
    int? whiteChannel,
    bool? isSimple,
    bool? showLightsPanel,
  }) {
    return LightingRole(
      id: id ?? this.id,
      name: name ?? this.name,
      icon: icon ?? this.icon,
      lights: lights ?? this.lights,
      state: state ?? this.state,
      brightness: brightness ?? this.brightness,
      colorTemp: colorTemp ?? this.colorTemp,
      color: color ?? this.color,
      saturation: saturation ?? this.saturation,
      whiteChannel: whiteChannel ?? this.whiteChannel,
      isSimple: isSimple ?? this.isSimple,
      showLightsPanel: showLightsPanel ?? this.showLightsPanel,
    );
  }
}

// ============================================================================
// MAIN PAGE
// ============================================================================

class RoleDetailPage extends StatefulWidget {
  final LightingRole role;
  final VoidCallback? onBack;
  final Function(LightDevice)? onLightTap;

  const RoleDetailPage({
    super.key,
    required this.role,
    this.onBack,
    this.onLightTap,
  });

  @override
  State<RoleDetailPage> createState() => _RoleDetailPageState();
}

class _RoleDetailPageState extends State<RoleDetailPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late LightingRole _role;
  LightCapability _selectedCapability = LightCapability.brightness;

  @override
  void initState() {
    super.initState();
    _role = widget.role;
    if (_role.capabilities.isNotEmpty) {
      _selectedCapability = _role.capabilities.contains(LightCapability.brightness)
          ? LightCapability.brightness
          : _role.capabilities.first;
    }
  }

  @override
  void didUpdateWidget(RoleDetailPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.role != oldWidget.role) {
      setState(() {
        _role = widget.role;
      });
    }
  }

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  void _onBrightnessChanged(int value) {
    HapticFeedback.selectionClick();
    setState(() {
      _role = _role.copyWith(
        brightness: value,
        lights: _role.lights.map((l) {
          if (l.capabilities.contains(LightCapability.brightness)) {
            return l.copyWith(brightness: value);
          }
          return l;
        }).toList(),
      );
    });
  }

  void _onColorTempChanged(int value) {
    HapticFeedback.selectionClick();
    setState(() {
      _role = _role.copyWith(
        colorTemp: value,
        lights: _role.lights.map((l) {
          if (l.capabilities.contains(LightCapability.colorTemp)) {
            return l.copyWith(colorTemp: value);
          }
          return l;
        }).toList(),
      );
    });
  }

  void _onColorChanged(Color value, double saturation) {
    HapticFeedback.selectionClick();
    setState(() {
      _role = _role.copyWith(
        color: value,
        saturation: saturation,
        lights: _role.lights.map((l) {
          if (l.capabilities.contains(LightCapability.color)) {
            return l.copyWith(color: value);
          }
          return l;
        }).toList(),
      );
    });
  }

  void _onWhiteChanged(int value) {
    HapticFeedback.selectionClick();
    setState(() {
      _role = _role.copyWith(
        whiteChannel: value,
        lights: _role.lights.map((l) {
          if (l.capabilities.contains(LightCapability.white)) {
            return l.copyWith(whiteChannel: value);
          }
          return l;
        }).toList(),
      );
    });
  }

  void _onPowerToggle() {
    HapticFeedback.mediumImpact();
    final anyOn = _role.lights.any((l) => l.isOn);
    setState(() {
      _role = _role.copyWith(
        lights: _role.lights.map((l) => l.copyWith(isOn: !anyOn)).toList(),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.base,
      body: SafeArea(
        child: OrientationBuilder(
          builder: (context, orientation) {
            final isLandscape = orientation == Orientation.landscape;
            if (isLandscape) {
              return Column(
                children: [
                  _buildHeader(context, isDark, isLandscape),
                  Expanded(
                    child: _buildLandscapeLayout(context, isDark),
                  ),
                ],
              );
            } else {
              return Column(
                children: [
                  _buildHeader(context, isDark, isLandscape),
                  _buildCapabilityTabs(context, isDark, isLandscape),
                  Expanded(
                    child: _buildPortraitLayout(context, isDark),
                  ),
                ],
              );
            }
          },
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  Widget _buildHeader(BuildContext context, bool isDark, bool isLandscape) {
    final anyOn = _role.anyOn;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: _scale(isLandscape ? 10 : 16),
        vertical: _scale(isLandscape ? 8 : 12),
      ),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
            width: _scale(1),
          ),
        ),
      ),
      child: Row(
        children: [
          _HeaderButton(
            icon: Icons.arrow_back_ios_new,
            onTap: widget.onBack,
            isDark: isDark,
          ),
          SizedBox(width: AppSpacings.pMd),
          Icon(
            _role.icon,
            color: isDark ? AppColorsDark.primary : AppColorsLight.primary,
            size: _scale(24),
          ),
          SizedBox(width: AppSpacings.pMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _role.name,
                  style: TextStyle(
                    color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                    fontSize: AppFontSize.large,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: _scale(1)),
                Text(
                  '${_role.activeCount}/${_role.totalCount} on',
                  style: TextStyle(
                    color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                    fontSize: AppFontSize.small,
                  ),
                ),
              ],
            ),
          ),
          // Power toggle in header (hidden for simple mode)
          if (!_role.isSimple)
            GestureDetector(
              onTap: _onPowerToggle,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: _scale(48),
                height: _scale(32),
                decoration: BoxDecoration(
                  color: anyOn
                      ? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
                      : (isDark ? AppFillColorDark.dark : AppFillColorLight.dark),
                  borderRadius: BorderRadius.circular(AppBorderRadius.round),
                ),
                child: Icon(
                  Icons.power_settings_new,
                  color: anyOn
                      ? AppColors.white
                      : (isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder),
                  size: _scale(18),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // CAPABILITY TABS
  // --------------------------------------------------------------------------

  Widget _buildCapabilityTabs(BuildContext context, bool isDark, bool isLandscape) {
    // Hide tabs for simple mode
    if (_role.isSimple) {
      return const SizedBox.shrink();
    }

    // Only show enabled capabilities
    final enabledCaps = [
      LightCapability.brightness,
      LightCapability.colorTemp,
      LightCapability.color,
      LightCapability.white,
    ].where((cap) => _role.capabilities.contains(cap)).toList();

    // If only one capability, don't show tabs at all
    if (enabledCaps.length <= 1) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: EdgeInsets.all(AppSpacings.pMd),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
            width: _scale(1),
          ),
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
                isEnabled: true,
                isSelected: isSelected,
                isDark: isDark,
                isLandscape: isLandscape,
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

  // --------------------------------------------------------------------------
  // LAYOUTS
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
    return Row(
      children: [
        if (!_role.isSimple) _buildVerticalCapabilityTabs(context, isDark),
        Expanded(
          child: _role.isSimple
              ? _buildPowerButton(context, isDark)
              : _buildControlPanel(context, isDark, isLandscape: true),
        ),
        if (_role.showLightsPanel) _buildLightsPanel(context, isDark, isLandscape: true),
      ],
    );
  }

  Widget _buildVerticalCapabilityTabs(BuildContext context, bool isDark) {
    // Only show enabled capabilities
    final enabledCaps = [
      LightCapability.brightness,
      LightCapability.colorTemp,
      LightCapability.color,
      LightCapability.white,
    ].where((cap) => _role.capabilities.contains(cap)).toList();

    // If only one capability, don't show tabs at all
    if (enabledCaps.length <= 1) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
      decoration: BoxDecoration(
        border: Border(
          right: BorderSide(
            color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
            width: _scale(1),
          ),
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
              isEnabled: true,
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

  Widget _buildPortraitLayout(BuildContext context, bool isDark) {
    return Column(
      children: [
        Expanded(
          child: _role.isSimple
              ? _buildPowerButton(context, isDark)
              : _buildControlPanel(context, isDark, isLandscape: false),
        ),
        if (_role.showLightsPanel) _buildLightsPanel(context, isDark, isLandscape: false),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // POWER BUTTON (for simple mode)
  // --------------------------------------------------------------------------

  Widget _buildPowerButton(BuildContext context, bool isDark) {
    final anyOn = _role.anyOn;
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor = isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final inactiveColor = isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;
    final inactiveBgColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;

    // Info text based on state
    final infoText = anyOn
        ? '${_role.activeCount}/${_role.totalCount} lights on'
        : 'Tap to turn on';

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Power button circle
          GestureDetector(
            onTap: _onPowerToggle,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: _scale(160),
              height: _scale(160),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: anyOn ? primaryBgColor : inactiveBgColor,
                border: Border.all(
                  color: anyOn
                      ? primaryColor
                      : (isDark ? Colors.transparent : AppBorderColorLight.light),
                  width: anyOn ? _scale(4) : _scale(1),
                ),
                boxShadow: anyOn
                    ? [
                        BoxShadow(
                          color: primaryColor.withValues(alpha: 0.25),
                          blurRadius: _scale(40),
                          spreadRadius: 0,
                        ),
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: _scale(20),
                          offset: Offset(0, _scale(4)),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
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
                    color: anyOn ? primaryColor : inactiveColor,
                  ),
                  SizedBox(height: AppSpacings.pMd),
                  Text(
                    anyOn ? 'On' : 'Off',
                    style: TextStyle(
                      fontFamily: 'DIN1451',
                      fontSize: _scale(26),
                      fontWeight: FontWeight.w100,
                      color: anyOn ? primaryColor : inactiveColor,
                    ),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: AppSpacings.pLg),
          // Info text
          Text(
            infoText,
            style: TextStyle(
              fontFamily: 'DIN1451',
              fontSize: AppFontSize.small,
              color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // CONTROL PANEL
  // --------------------------------------------------------------------------

  Widget _buildControlPanel(BuildContext context, bool isDark, {required bool isLandscape}) {
    switch (_selectedCapability) {
      case LightCapability.power:
        return _buildBrightnessPanel(context, isDark, isLandscape);
      case LightCapability.brightness:
        return _buildBrightnessPanel(context, isDark, isLandscape);
      case LightCapability.colorTemp:
        return _buildColorTempPanel(context, isDark, isLandscape);
      case LightCapability.color:
        return _buildColorPanel(context, isDark, isLandscape);
      case LightCapability.white:
        return _buildWhitePanel(context, isDark, isLandscape);
    }
  }

  Widget _buildBrightnessPanel(BuildContext context, bool isDark, bool isLandscape) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: _role.brightness,
      minValue: 0,
      maxValue: 100,
      displayValue: '${_role.brightness}%',
      gradientColors: [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ],
      thumbColor: AppColors.white,
      onChanged: _onBrightnessChanged,
      presets: const [25, 50, 75, 100],
      presetLabels: const ['25%', '50%', '75%', '100%'],
      presetIcons: const [Icons.brightness_low, Icons.brightness_medium, Icons.brightness_high, Icons.brightness_7],
    );
  }

  Widget _buildColorTempPanel(BuildContext context, bool isDark, bool isLandscape) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: _role.colorTemp,
      minValue: 2700,
      maxValue: 6500,
      displayValue: '${_role.colorTemp}K',
      sublabel: _getColorTempName(_role.colorTemp),
      gradientColors: const [
        Color(0xFFFF9800), // Warm
        Color(0xFFFFFAF0),
        Color(0xFFE3F2FD),
        Color(0xFF64B5F6), // Cool
      ],
      thumbColor: _getColorTempColor(_role.colorTemp),
      onChanged: _onColorTempChanged,
      presets: const [2700, 3200, 5000, 6500],
      presetLabels: const ['Warm', 'Soft', 'Day', 'Cool'],
      presetIcons: const [Icons.local_fire_department, Icons.nights_stay, Icons.wb_sunny, Icons.ac_unit],
    );
  }

  String _getColorTempName(int temp) {
    if (temp <= 2700) return 'Candle';
    if (temp <= 3200) return 'Warm White';
    if (temp <= 4000) return 'Neutral';
    if (temp <= 5000) return 'Daylight';
    return 'Cool White';
  }

  Color _getColorTempColor(int temp) {
    final t = (temp - 2700) / (6500 - 2700);
    if (t < 0.33) {
      return Color.lerp(const Color(0xFFFF9800), const Color(0xFFFFFAF0), t * 3)!;
    } else if (t < 0.66) {
      return Color.lerp(const Color(0xFFFFFAF0), const Color(0xFFE3F2FD), (t - 0.33) * 3)!;
    } else {
      return Color.lerp(const Color(0xFFE3F2FD), const Color(0xFF64B5F6), (t - 0.66) * 3)!;
    }
  }

  Widget _buildColorPanel(BuildContext context, bool isDark, bool isLandscape) {
    final color = _role.color ?? Colors.red;
    final hsv = HSVColor.fromColor(color);

    return _ColorPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      hue: hsv.hue,
      saturation: _role.saturation,
      showLightsPanel: _role.showLightsPanel,
      onChanged: (hue, sat) {
        final newColor = HSVColor.fromAHSV(1, hue, sat, 1).toColor();
        _onColorChanged(newColor, sat);
      },
    );
  }

  Widget _buildWhitePanel(BuildContext context, bool isDark, bool isLandscape) {
    final whiteValue = _role.whiteChannel ?? 80;
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: whiteValue,
      minValue: 0,
      maxValue: 100,
      displayValue: '$whiteValue%',
      gradientColors: [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ],
      thumbColor: AppColors.white,
      onChanged: _onWhiteChanged,
      presets: const [25, 50, 75, 100],
      presetLabels: const ['25%', '50%', '75%', '100%'],
      presetIcons: const [Icons.brightness_low, Icons.brightness_medium, Icons.brightness_high, Icons.brightness_7],
    );
  }

  // --------------------------------------------------------------------------
  // LIGHTS PANEL
  // --------------------------------------------------------------------------

  Widget _buildLightsPanel(BuildContext context, bool isDark, {required bool isLandscape}) {
    final dividerColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

    // Get state color for error states
    Color? stateColor;
    switch (_role.state) {
      case RoleState.synced:
        stateColor = null;
        break;
      case RoleState.mixed:
        stateColor = AppColorsLight.secondary;
        break;
      case RoleState.unsynced:
        stateColor = isDark ? AppColorsDark.error : AppColorsLight.error;
        break;
    }

    if (isLandscape) {
      // Build rows of 2 tiles with fixed height
      final tileHeight = _scale(70);
      final rows = <Widget>[];
      for (var i = 0; i < _role.lights.length; i += 2) {
        final rowLights = _role.lights.skip(i).take(2).toList();
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
                      child: j < rowLights.length
                          ? _LightTile(
                              light: rowLights[j],
                              isDark: isDark,
                              onTap: () => widget.onLightTap?.call(rowLights[j]),
                            )
                          : const SizedBox(),
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
            _buildLightsPanelHeader(context, isDark, isLandscape: true),
            Expanded(
              child: ListView(
                padding: EdgeInsets.all(AppSpacings.pMd),
                children: rows,
              ),
            ),
          ],
        ),
      );
    } else {
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
            _buildLightsPanelHeader(context, isDark, isLandscape: false),
            Expanded(
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd, vertical: AppSpacings.pMd),
                itemCount: _role.lights.length,
                itemBuilder: (context, index) {
                  return Padding(
                    padding: EdgeInsets.only(right: AppSpacings.pMd),
                    child: AspectRatio(
                      aspectRatio: 1.0,
                      child: _LightTile(
                        light: _role.lights[index],
                        isDark: isDark,
                        onTap: () => widget.onLightTap?.call(_role.lights[index]),
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
  }

  Widget _buildLightsPanelHeader(BuildContext context, bool isDark, {required bool isLandscape}) {
    // Determine state-based styling
    Color? stateColor;
    late IconData stateIcon;
    String? stateText;
    String? buttonText;

    switch (_role.state) {
      case RoleState.synced:
        stateIcon = Icons.check_circle_outline;
        break;
      case RoleState.mixed:
        stateColor = AppColorsLight.secondary; // Blue works in both themes
        stateIcon = Icons.tune;
        stateText = 'Mixed values';
        buttonText = 'Sync All';
        break;
      case RoleState.unsynced:
        stateColor = isDark ? AppColorsDark.error : AppColorsLight.error;
        stateIcon = Icons.error_outline;
        stateText = 'Sync failed';
        buttonText = 'Retry';
        break;
    }

    return Container(
      height: _scale(36),
      padding: EdgeInsets.symmetric(horizontal: isLandscape ? AppSpacings.pMd : AppSpacings.pLg),
      decoration: BoxDecoration(
        color: stateColor?.withValues(alpha: 0.1),
        border: Border(
          bottom: BorderSide(
            color: stateColor ?? (isDark ? AppBorderColorDark.light : AppBorderColorLight.light),
            width: _scale(1),
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            stateIcon,
            color: stateColor ?? (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
            size: _scale(14),
          ),
          SizedBox(width: isLandscape ? AppSpacings.pSm : AppSpacings.pMd),
          Text(
            'Lights',
            style: TextStyle(
              color: stateColor ?? (isDark ? AppTextColorDark.primary : AppTextColorLight.primary),
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(width: isLandscape ? AppSpacings.pSm : AppSpacings.pMd),
          Container(
            padding: EdgeInsets.symmetric(horizontal: AppSpacings.pSm, vertical: _scale(2)),
            decoration: BoxDecoration(
              color: stateColor?.withValues(alpha: 0.2) ?? (isDark ? AppFillColorDark.light : AppFillColorLight.light),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Text(
              '${_role.lights.length}',
              style: TextStyle(
                color: stateColor ?? (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
                fontSize: AppFontSize.extraSmall,
              ),
            ),
          ),
          // Show state text only in portrait mode
          if (!isLandscape && stateText != null) ...[
            SizedBox(width: AppSpacings.pMd),
            Text(
              '·',
              style: TextStyle(
                color: stateColor,
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(width: AppSpacings.pMd),
            Expanded(
              child: Text(
                stateText,
                style: TextStyle(
                  color: stateColor,
                  fontSize: AppFontSize.small,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ] else
            const Spacer(),
          if (buttonText != null)
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                // Handle sync/retry action
              },
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd, vertical: AppSpacings.pSm),
                decoration: BoxDecoration(
                  color: stateColor,
                  borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                ),
                child: Text(
                  buttonText,
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
}

// ============================================================================
// REUSABLE WIDGETS
// ============================================================================

class _HeaderButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final bool isDark;

  const _HeaderButton({required this.icon, this.onTap, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    double scale(double s) => screenService.scale(s, density: visualDensityService.density);

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
          color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
          size: scale(18),
        ),
      ),
    );
  }
}

class _CapabilityTab extends StatelessWidget {
  final LightCapability capability;
  final bool isEnabled;
  final bool isSelected;
  final bool isDark;
  final bool isLandscape;
  final VoidCallback? onTap;

  const _CapabilityTab({
    required this.capability,
    required this.isEnabled,
    required this.isSelected,
    required this.isDark,
    this.isLandscape = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    double scale(double s) => screenService.scale(s, density: visualDensityService.density);

    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final bgColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final selectedBg = isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;

    // Inactive colors - use darker tones in light mode for better contrast
    final inactiveIconColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.primary;
    final inactiveLabelColor = isDark ? AppTextColorDark.placeholder : AppTextColorLight.secondary;
    final inactiveBorderColor = isDark ? Colors.transparent : AppBorderColorLight.light;

    // Compensate padding for border width difference to prevent jitter
    // Selected: 2px border, unselected: 1px border + 1px extra padding
    final borderWidth = isSelected ? scale(2) : scale(1);
    final paddingCompensation = isSelected ? 0.0 : scale(1);

    final icon = Icon(
      _getIcon(),
      color: isSelected ? primaryColor : inactiveIconColor,
      size: scale(isLandscape ? 16 : 20),
    );

    final label = Text(
      _getLabel(),
      style: TextStyle(
        color: isSelected ? primaryColor : inactiveLabelColor,
        fontSize: AppFontSize.extraSmall,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
      ),
    );

    final content = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: EdgeInsets.symmetric(
        vertical: (isLandscape ? AppSpacings.pMd : scale(8)) + paddingCompensation,
        horizontal: (isLandscape ? AppSpacings.pMd : 0) + paddingCompensation,
      ),
      decoration: BoxDecoration(
        color: isSelected ? selectedBg : bgColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: isSelected ? primaryColor : inactiveBorderColor,
          width: borderWidth,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          icon,
          SizedBox(height: AppSpacings.pSm),
          label,
        ],
      ),
    );

    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: isEnabled ? 1.0 : 0.3,
        // Fixed width for landscape tabs to prevent layout shift
        child: isLandscape
            ? SizedBox(width: scale(52), child: content)
            : content,
      ),
    );
  }

  IconData _getIcon() {
    switch (capability) {
      case LightCapability.power:
        return Icons.power_settings_new;
      case LightCapability.brightness:
        return Icons.wb_sunny_outlined;
      case LightCapability.colorTemp:
        return Icons.thermostat_outlined;
      case LightCapability.color:
        return Icons.palette_outlined;
      case LightCapability.white:
        return Icons.square_outlined;
    }
  }

  String _getLabel() {
    switch (capability) {
      case LightCapability.power:
        return 'Power';
      case LightCapability.brightness:
        return 'Bright';
      case LightCapability.colorTemp:
        return 'Temp';
      case LightCapability.color:
        return 'Color';
      case LightCapability.white:
        return 'White';
    }
  }
}

class _SliderPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final int minValue;
  final int maxValue;
  final String displayValue;
  final String? sublabel;
  final List<Color> gradientColors;
  final Color thumbColor;
  final Function(int) onChanged;
  final List<int>? presets;
  final List<String>? presetLabels;
  final List<IconData>? presetIcons;

  const _SliderPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.minValue,
    required this.maxValue,
    required this.displayValue,
    this.sublabel,
    required this.gradientColors,
    required this.thumbColor,
    required this.onChanged,
    this.presets,
    this.presetLabels,
    this.presetIcons,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    double scale(double s) => screenService.scale(s, density: visualDensityService.density);

    if (isLandscape) {
      return Padding(
        padding: EdgeInsets.all(AppSpacings.pLg),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: _buildDisplay(scale)),
            SizedBox(width: AppSpacings.pLg),
            _buildVerticalSliderExpanded(scale),
            if (presets != null) ...[
              SizedBox(width: AppSpacings.pMd),
              _buildVerticalPresets(scale),
            ],
          ],
        ),
      );
    } else {
      return Padding(
        padding: EdgeInsets.all(AppSpacings.pLg),
        child: Column(
          children: [
            Expanded(child: _buildDisplay(scale)),
            SizedBox(height: AppSpacings.pLg),
            _buildHorizontalSlider(scale),
            if (presets != null) ...[
              SizedBox(height: AppSpacings.pLg),
              _buildHorizontalPresets(scale),
            ],
          ],
        ),
      );
    }
  }

  Widget _buildDisplay(double Function(double) scale) {
    // Parse value and unit from displayValue (e.g., "65%" -> "65" + "%", "4000K" -> "4000" + "K")
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
                width: scale(1),
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
                      color: isDark ? AppTextColorDark.regular : AppTextColorLight.regular,
                      fontSize: scale(60),
                      fontFamily: 'DIN1451',
                      fontWeight: FontWeight.w100,
                      height: 1.0,
                    ),
                  ),
                  if (unitText.isNotEmpty)
                    Text(
                      unitText,
                      style: TextStyle(
                        color: isDark ? AppTextColorDark.regular : AppTextColorLight.regular,
                        fontSize: scale(25),
                        fontFamily: 'DIN1451',
                        fontWeight: FontWeight.w100,
                        height: 1.0,
                      ),
                    ),
                ],
              ),
              if (sublabel != null) ...[
                SizedBox(height: AppSpacings.pSm),
                Text(
                  sublabel!,
                  style: TextStyle(
                    color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
                    fontSize: AppFontSize.small,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVerticalSliderExpanded(double Function(double) scale) {
    final percent = (value - minValue) / (maxValue - minValue);
    final thumbSize = scale(44);
    final padding = AppSpacings.pSm;

    return LayoutBuilder(
      builder: (context, constraints) {
        final trackHeight = constraints.maxHeight;
        return SizedBox(
          width: scale(52),
          child: GestureDetector(
            onVerticalDragUpdate: (details) {
              final newPercent = 1 - (details.localPosition.dy / trackHeight).clamp(0.0, 1.0);
              final newValue = minValue + (newPercent * (maxValue - minValue)).round();
              onChanged(newValue);
            },
            onTapDown: (details) {
              final newPercent = 1 - (details.localPosition.dy / trackHeight).clamp(0.0, 1.0);
              final newValue = minValue + (newPercent * (maxValue - minValue)).round();
              onChanged(newValue);
            },
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(scale(26)),
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: gradientColors,
                ),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: scale(1),
                      ),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    left: padding,
                    right: padding,
                    bottom: padding + (trackHeight - thumbSize - padding * 2) * percent,
                    child: _buildThumb(scale, thumbSize),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildHorizontalSlider(double Function(double) scale) {
    final percent = (value - minValue) / (maxValue - minValue);
    final thumbSize = scale(44);
    final padding = AppSpacings.pSm;

    return LayoutBuilder(
      builder: (context, constraints) {
        final trackWidth = constraints.maxWidth;
        return SizedBox(
          height: scale(52),
          child: GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newPercent = (details.localPosition.dx / trackWidth).clamp(0.0, 1.0);
              final newValue = minValue + (newPercent * (maxValue - minValue)).round();
              onChanged(newValue);
            },
            onTapDown: (details) {
              final newPercent = (details.localPosition.dx / trackWidth).clamp(0.0, 1.0);
              final newValue = minValue + (newPercent * (maxValue - minValue)).round();
              onChanged(newValue);
            },
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(scale(26)),
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: gradientColors,
                ),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: scale(1),
                      ),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    top: padding,
                    left: padding + (trackWidth - thumbSize - padding * 2) * percent,
                    child: _buildThumb(scale, thumbSize),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildThumb(double Function(double) scale, double size) {
    // Use lighter border in light mode for better contrast with white background
    final borderColor = isDark ? AppTextColorDark.primary : AppBorderColorLight.base;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(size / 2),
        border: Border.all(
          color: borderColor,
          width: scale(3),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.black.withValues(alpha: 0.2),
            blurRadius: scale(8),
            offset: Offset(0, scale(2)),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: scale(20),
          height: scale(20),
          decoration: BoxDecoration(
            color: thumbColor,
            borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          ),
        ),
      ),
    );
  }

  Widget _buildHorizontalPresets(double Function(double) scale) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(presets!.length, (index) {
        final preset = presets![index];
        final isActive = (value - preset).abs() < (maxValue - minValue) * 0.05;
        final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
        // Better contrast for inactive state in light mode
        final inactiveTextColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.primary;
        final inactiveBorderColor = isDark ? Colors.transparent : AppBorderColorLight.light;
        // Compensate padding for border width difference
        final borderWidth = isActive ? scale(2) : scale(1);
        final paddingCompensation = isActive ? 0.0 : scale(1);

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
                    ? (isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9)
                    : (isDark ? AppFillColorDark.light : AppFillColorLight.light),
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

  Widget _buildVerticalPresets(double Function(double) scale) {
    final useIcons = presetIcons != null && presetIcons!.length == presets!.length;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(presets!.length, (index) {
        final reversedIndex = presets!.length - 1 - index;
        final preset = presets![reversedIndex];
        final isActive = (value - preset).abs() < (maxValue - minValue) * 0.05;
        final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
        // Better contrast for inactive state in light mode
        final inactiveColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.primary;
        final inactiveBorderColor = isDark ? Colors.transparent : AppBorderColorLight.light;
        // Compensate padding for border width difference
        final borderWidth = isActive ? scale(2) : scale(1);
        final paddingCompensation = isActive ? 0.0 : scale(1);

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
                    ? (isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9)
                    : (isDark ? AppFillColorDark.light : AppFillColorLight.light),
                borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                border: Border.all(
                  color: isActive ? primaryColor : inactiveBorderColor,
                  width: borderWidth,
                ),
              ),
              child: useIcons
                  ? Icon(
                      presetIcons![reversedIndex],
                      size: scale(18),
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
// COLOR PANEL (with Hue + Saturation)
// ============================================================================

class _ColorPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final double hue;
  final double saturation;
  final bool showLightsPanel;
  final Function(double hue, double saturation) onChanged;

  const _ColorPanel({
    required this.isLandscape,
    required this.isDark,
    required this.hue,
    required this.saturation,
    required this.onChanged,
    this.showLightsPanel = true,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    double scale(double s) => screenService.scale(s, density: visualDensityService.density);

    final color = HSVColor.fromAHSV(1, hue, saturation, 1).toColor();

    // Predefined colors for quick selection
    const presetColors = [
      Color(0xFFFF0000), // Red
      Color(0xFFFF9800), // Orange
      Color(0xFFFFEB3B), // Yellow
      Color(0xFF4CAF50), // Green
      Color(0xFF00BCD4), // Cyan
      Color(0xFF2196F3), // Blue
      Color(0xFF9C27B0), // Purple
      Color(0xFFE91E63), // Pink
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
                    child: _buildDisplay(scale, color),
                  ),
                  SizedBox(height: AppSpacings.pMd),
                  _buildColorPresets(scale, presetColors),
                ],
              ),
            ),
            SizedBox(width: AppSpacings.pLg),
            _buildVerticalHueSliderExpanded(scale),
            SizedBox(width: AppSpacings.pMd),
            _buildVerticalSatSliderExpanded(scale),
          ],
        ),
      );
    } else {
      return Padding(
        padding: EdgeInsets.all(AppSpacings.pLg),
        child: Column(
          children: [
            if (!showLightsPanel) ...[
              Expanded(
                flex: 2,
                child: _buildDisplay(scale, color),
              ),
              SizedBox(height: AppSpacings.pLg),
            ],
            Expanded(child: _buildColorPresets(scale, presetColors)),
            SizedBox(height: AppSpacings.pLg),
            _buildHorizontalHueSlider(scale),
            SizedBox(height: AppSpacings.pLg),
            _buildHorizontalSatSlider(scale),
          ],
        ),
      );
    }
  }

  Widget _buildDisplay(double Function(double) scale, Color color) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.3),
            blurRadius: scale(20),
            spreadRadius: scale(2),
          ),
        ],
      ),
    );
  }

  Widget _buildColorPresets(double Function(double) scale, List<Color> colors) {
    final firstRow = colors.sublist(0, 4);
    final secondRow = colors.sublist(4, 8);

    Widget buildRow(List<Color> rowColors) {
      return Row(
        children: rowColors.map((presetColor) {
          final hsv = HSVColor.fromColor(presetColor);
          final isSelected = (hue - hsv.hue).abs() < 15 && (saturation - hsv.saturation).abs() < 0.15;

          return Expanded(
            child: GestureDetector(
              onTap: () {
                HapticFeedback.selectionClick();
                onChanged(hsv.hue, hsv.saturation);
              },
              child: Container(
                height: scale(28),
                margin: EdgeInsets.symmetric(horizontal: AppSpacings.pXs),
                decoration: BoxDecoration(
                  color: presetColor,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  border: isSelected
                      ? Border.all(
                          color: isDark ? AppColors.white : AppColors.black,
                          width: scale(2),
                        )
                      : null,
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: presetColor.withValues(alpha: 0.5),
                            blurRadius: scale(8),
                            spreadRadius: scale(1),
                          ),
                        ]
                      : null,
                ),
              ),
            ),
          );
        }).toList(),
      );
    }

    return Column(
      children: [
        buildRow(firstRow),
        SizedBox(height: AppSpacings.pSm),
        buildRow(secondRow),
      ],
    );
  }

  Widget _buildVerticalHueSliderExpanded(double Function(double) scale) {
    final thumbSize = scale(44);
    final padding = AppSpacings.pSm;
    final percent = hue / 360;

    return LayoutBuilder(
      builder: (context, constraints) {
        final trackHeight = constraints.maxHeight;
        return SizedBox(
          width: scale(52),
          child: GestureDetector(
            onVerticalDragUpdate: (details) {
              final newPercent = 1 - (details.localPosition.dy / trackHeight).clamp(0.0, 1.0);
              onChanged(newPercent * 360, saturation);
            },
            onTapDown: (details) {
              final newPercent = 1 - (details.localPosition.dy / trackHeight).clamp(0.0, 1.0);
              onChanged(newPercent * 360, saturation);
            },
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(scale(26)),
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: List.generate(7, (i) => HSVColor.fromAHSV(1, i * 60.0, 1, 1).toColor()),
                ),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: scale(1),
                      ),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    left: padding,
                    right: padding,
                    bottom: padding + (trackHeight - thumbSize - padding * 2) * percent,
                    child: _buildThumb(scale, thumbSize, HSVColor.fromAHSV(1, hue, 1, 1).toColor()),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildVerticalSatSliderExpanded(double Function(double) scale) {
    final thumbSize = scale(44);
    final padding = AppSpacings.pSm;
    final percent = saturation;
    final hueColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();

    return LayoutBuilder(
      builder: (context, constraints) {
        final trackHeight = constraints.maxHeight;
        return SizedBox(
          width: scale(52),
          child: GestureDetector(
            onVerticalDragUpdate: (details) {
              final newPercent = 1 - (details.localPosition.dy / trackHeight).clamp(0.0, 1.0);
              onChanged(hue, newPercent);
            },
            onTapDown: (details) {
              final newPercent = 1 - (details.localPosition.dy / trackHeight).clamp(0.0, 1.0);
              onChanged(hue, newPercent);
            },
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(scale(26)),
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [AppColors.white, hueColor],
                ),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: scale(1),
                      ),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    left: padding,
                    right: padding,
                    bottom: padding + (trackHeight - thumbSize - padding * 2) * percent,
                    child: _buildThumb(scale, thumbSize, HSVColor.fromAHSV(1, hue, saturation, 1).toColor()),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildHorizontalHueSlider(double Function(double) scale) {
    final thumbSize = scale(44);
    final padding = AppSpacings.pSm;
    final percent = hue / 360;

    return LayoutBuilder(
      builder: (context, constraints) {
        final trackWidth = constraints.maxWidth;
        return SizedBox(
          height: scale(52),
          child: GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newPercent = (details.localPosition.dx / trackWidth).clamp(0.0, 1.0);
              onChanged(newPercent * 360, saturation);
            },
            onTapDown: (details) {
              final newPercent = (details.localPosition.dx / trackWidth).clamp(0.0, 1.0);
              onChanged(newPercent * 360, saturation);
            },
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(scale(26)),
                gradient: LinearGradient(
                  colors: List.generate(7, (i) => HSVColor.fromAHSV(1, i * 60.0, 1, 1).toColor()),
                ),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: scale(1),
                      ),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    top: padding,
                    left: padding + (trackWidth - thumbSize - padding * 2) * percent,
                    child: _buildThumb(scale, thumbSize, HSVColor.fromAHSV(1, hue, 1, 1).toColor()),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildHorizontalSatSlider(double Function(double) scale) {
    final thumbSize = scale(44);
    final padding = AppSpacings.pSm;
    final percent = saturation;
    final hueColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();

    return LayoutBuilder(
      builder: (context, constraints) {
        final trackWidth = constraints.maxWidth;
        return SizedBox(
          height: scale(52),
          child: GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newPercent = (details.localPosition.dx / trackWidth).clamp(0.0, 1.0);
              onChanged(hue, newPercent);
            },
            onTapDown: (details) {
              final newPercent = (details.localPosition.dx / trackWidth).clamp(0.0, 1.0);
              onChanged(hue, newPercent);
            },
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(scale(26)),
                gradient: LinearGradient(
                  colors: [AppColors.white, hueColor],
                ),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.light,
                        width: scale(1),
                      ),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    top: padding,
                    left: padding + (trackWidth - thumbSize - padding * 2) * percent,
                    child: _buildThumb(scale, thumbSize, HSVColor.fromAHSV(1, hue, saturation, 1).toColor()),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildThumb(double Function(double) scale, double size, Color color) {
    // Use lighter border in light mode for better contrast with white background
    final borderColor = isDark ? AppTextColorDark.primary : AppBorderColorLight.base;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(size / 2),
        border: Border.all(
          color: borderColor,
          width: scale(3),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.black.withValues(alpha: 0.2),
            blurRadius: scale(8),
            offset: Offset(0, scale(2)),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: scale(20),
          height: scale(20),
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
// LIGHT TILE
// ============================================================================

class _LightTile extends StatelessWidget {
  final LightDevice light;
  final bool isDark;
  final VoidCallback? onTap;

  const _LightTile({
    required this.light,
    required this.isDark,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    double scale(double s) => screenService.scale(s, density: visualDensityService.density);

    final isOn = light.isOn && light.isOnline;
    final isDisabled = !light.isOnline;

    // Colors matching ButtonTile
    final bgColor = isDisabled
        ? (isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5)
        : isOn
            ? (isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primary)
            : (isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9);

    // In dark mode, inactive tiles have no visible border (matches tabs behavior)
    final borderColor = isDisabled
        ? (isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5)
        : isOn
            ? (isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primary)
            : (isDark ? AppColorsDark.infoLight9 : AppBorderColorLight.light);

    final iconBgColor = isDisabled
        ? (isDark ? const Color.fromRGBO(255, 255, 255, 0.5) : AppColors.white)
        : isOn
            ? AppColorsLight.primaryLight5
            : (isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5);

    final iconColor = isDisabled
        ? (isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5)
        : isOn
            ? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
            : (isDark ? AppColorsDark.info : AppColorsLight.info);

    final titleColor = isDisabled
        ? (isDark ? const Color.fromRGBO(255, 255, 255, 0.5) : AppColors.white)
        : isOn
            ? (isDark ? AppColorsDark.primary : AppColors.white)
            : (isDark ? AppColorsDark.info : AppColorsLight.info);

    // Use warning color for offline status
    final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
    final subtitleColor = isDisabled
        ? warningColor
        : isOn
            ? (isDark ? AppColorsLight.primaryLight5 : AppColorsLight.primaryLight9)
            : (isDark ? AppColorsDark.infoLight3 : AppColorsLight.infoLight3);

    // Compensate padding for border width difference (2px on, 1px off)
    final borderWidth = isOn ? scale(2) : scale(1);
    final paddingCompensation = isOn ? 0.0 : scale(1);

    return GestureDetector(
      onTap: isDisabled
          ? null
          : () {
              HapticFeedback.lightImpact();
              onTap?.call();
            },
      child: Container(
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          border: Border.all(color: borderColor, width: borderWidth),
          boxShadow: isOn
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: scale(4),
                    spreadRadius: scale(1),
                    offset: Offset(0, scale(2)),
                  ),
                ]
              : [],
        ),
        child: Padding(
          padding: EdgeInsets.all(AppSpacings.pMd + paddingCompensation),
          child: Column(
            children: [
              // Icon - takes available space
              Expanded(
                child: Center(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final iconSize = constraints.maxHeight * 0.85;
                      return Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            width: iconSize,
                            height: iconSize,
                            decoration: BoxDecoration(
                              color: iconBgColor,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isOn ? Icons.lightbulb : Icons.lightbulb_outline,
                              color: iconColor,
                              size: iconSize * 0.6,
                            ),
                          ),
                          // Warning badge for offline devices
                          if (isDisabled)
                            Positioned(
                              right: -scale(2),
                              bottom: -scale(2),
                              child: Icon(
                                Icons.warning_rounded,
                                size: scale(14),
                                color: warningColor,
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ),
              ),
              // Title
              Text(
                light.name,
                style: TextStyle(
                  fontFamily: 'DIN1451',
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.bold,
                  color: titleColor,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
                textAlign: TextAlign.center,
              ),
              SizedBox(height: scale(1)),
              // Subtitle (status)
              Text(
                _getStateText(),
                style: TextStyle(
                  fontFamily: 'DIN1451',
                  fontSize: AppFontSize.extraSmall * 0.85,
                  color: subtitleColor,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _getStateText() {
    if (!light.isOnline) return 'Offline';
    if (!light.isOn) return 'Off';
    return '${light.brightness}%';
  }
}
