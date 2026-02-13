import 'package:flutter/material.dart';

/// Lights domain hero panel with capability-driven slider switcher.
///
/// Renders the hero control area for a selected light role:
/// - Role badge (name + device count)
/// - Giant value display with optional color swatch
/// - Contextual label line
/// - Mode switcher tabs (only for roles with 2+ capabilities)
/// - Active slider with gradient track, thumb, labels, and presets
/// - On/off toggle variant for roles with no dimmable capabilities
///
/// Designed for SmartPanel tablet layout (landscape right panel / portrait top).
/// Adapts from 1 capability (no switcher) to 5 capabilities (full tab bar).

// ══════════════════════════════════════════════════════════════════
// DATA MODELS
// ══════════════════════════════════════════════════════════════════

/// Capabilities a light role can support.
enum LightCapability { brightness, colorTemp, hue, saturation, whiteChannel }

/// A preset value for a slider mode.
class SliderPreset {
  final String label;
  final double value;
  final bool isActive;

  const SliderPreset({
    required this.label,
    required this.value,
    this.isActive = false,
  });
}

/// A color preset swatch for hue mode.
class ColorPreset {
  final Color color;
  final String name;
  final double hueValue;
  final bool isActive;

  const ColorPreset({
    required this.color,
    required this.name,
    required this.hueValue,
    this.isActive = false,
  });
}

/// Current state of a light role for the hero display.
class LightRoleState {
  final String roleName;
  final int deviceCount;
  final bool isOn;

  /// Which capabilities this role supports (drives tab visibility).
  final Set<LightCapability> capabilities;

  /// Current active slider mode.
  final LightCapability? activeMode;

  /// Current values per capability.
  final double brightness; // 0–100
  final double colorTemp; // Kelvin, e.g. 2700–6500
  final double hue; // 0–360 degrees
  final double saturation; // 0–100
  final double whiteChannel; // 0–100

  /// Current color for the swatch indicator.
  final Color? currentColor;
  final String? colorName;

  const LightRoleState({
    required this.roleName,
    required this.deviceCount,
    this.isOn = true,
    this.capabilities = const {},
    this.activeMode,
    this.brightness = 50,
    this.colorTemp = 3200,
    this.hue = 10,
    this.saturation = 85,
    this.whiteChannel = 40,
    this.currentColor,
    this.colorName,
  });

  /// Whether this role only supports on/off (no sliders at all).
  bool get isOnOffOnly => capabilities.isEmpty;

  /// Whether the mode switcher should be shown (2+ capabilities).
  bool get showModeSwitcher => capabilities.length >= 2;
}

// ══════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════════════════

class _Tok {
  _Tok._();

  // Colors
  static const coral = Color(0xFFE85A4F);
  static const coralBg = Color(0x1AE85A4F);
  static const amber = Color(0xFFFFA726);
  static const amberBg = Color(0x1AFFA726);

  // Surfaces (light theme)
  static const surface = Colors.white;
  static const surfaceDim = Color(0xFFEEEAE5);
  static const surfaceDim2 = Color(0xFFE5DFD8);
  static const border = Color(0x0F000000);

  // Text
  static const textPrimary = Color(0xFF2C2C2C);
  static const textSec = Color(0xFF999999);
  static const textHint = Color(0xFFBBBBBB);
  static const textMid = Color(0xFF666666);

  // Slider
  static const trackHeight = 6.0;
  static const thumbSize = 20.0;
  static const thumbBorder = 3.0;

  // Typography
  static const heroValueSize = 72.0;
  static const heroValueWeight = FontWeight.w200;
  static const heroUnitSize = 24.0;
}

// ══════════════════════════════════════════════════════════════════
// GRADIENT DEFINITIONS
// ══════════════════════════════════════════════════════════════════

class _Gradients {
  _Gradients._();

  static const brightness = LinearGradient(
    colors: [
      Color(0xFF333333),
      Color(0xFF888888),
      Color(0xFFCCCCCC),
      Color(0xFFF0E8DD),
      Color(0xFFFFFAF0),
    ],
    stops: [0.0, 0.3, 0.6, 0.8, 1.0],
  );

  static const colorTemp = LinearGradient(
    colors: [
      Color(0xFFFF8C00),
      Color(0xFFFFB347),
      Color(0xFFFFFAF0),
      Color(0xFFB8D8F0),
      Color(0xFF5DADE2),
    ],
    stops: [0.0, 0.25, 0.5, 0.75, 1.0],
  );

  static const hue = LinearGradient(
    colors: [
      Color(0xFFFF0000),
      Color(0xFFFFFF00),
      Color(0xFF00FF00),
      Color(0xFF00FFFF),
      Color(0xFF0000FF),
      Color(0xFFFF00FF),
      Color(0xFFFF0000),
    ],
    stops: [0.0, 0.17, 0.33, 0.5, 0.67, 0.83, 1.0],
  );

  static LinearGradient saturation(Color targetColor) {
    return LinearGradient(
      colors: [const Color(0xFFCCCCCC), targetColor],
    );
  }

  static const whiteChannel = LinearGradient(
    colors: [Color(0xFF333333), Color(0xFFFFFAF0)],
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN WIDGET
// ══════════════════════════════════════════════════════════════════

class LightsHeroPanel extends StatelessWidget {
  final LightRoleState state;
  final ValueChanged<LightCapability>? onModeChanged;
  final ValueChanged<double>? onSliderChanged;
  final ValueChanged<SliderPreset>? onPresetTap;
  final ValueChanged<ColorPreset>? onColorPresetTap;
  final ValueChanged<bool>? onToggle;

  const LightsHeroPanel({
    super.key,
    required this.state,
    this.onModeChanged,
    this.onSliderChanged,
    this.onPresetTap,
    this.onColorPresetTap,
    this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _Tok.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _Tok.border),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildBadge(),
          const SizedBox(height: 6),
          if (state.isOnOffOnly) ...[
            _buildOnOffHero(),
          ] else ...[
            _buildValueDisplay(),
            const SizedBox(height: 4),
            _buildLabel(),
            const SizedBox(height: 16),
            if (state.showModeSwitcher) ...[
              _buildModeSwitcher(),
              const SizedBox(height: 14),
            ],
            _buildActiveSlider(),
          ],
        ],
      ),
    );
  }

  // ── Badge ──────────────────────────────────────────────────────

  Widget _buildBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: _Tok.coralBg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        '${state.roleName} · ${state.deviceCount} device${state.deviceCount != 1 ? 's' : ''}',
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: _Tok.coral,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  // ── Value Display ─────────────────────────────────────────────

  Widget _buildValueDisplay() {
    final mode = state.activeMode ?? LightCapability.brightness;
    final (value, unit) = _valueForMode(mode);

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: _Tok.heroValueSize,
            fontWeight: _Tok.heroValueWeight,
            color: _Tok.textPrimary,
            height: 1,
            letterSpacing: -3,
          ),
        ),
        const SizedBox(width: 2),
        Text(
          unit,
          style: const TextStyle(
            fontSize: _Tok.heroUnitSize,
            fontWeight: FontWeight.w300,
            color: _Tok.textSec,
          ),
        ),
        if (state.currentColor != null) ...[
          const SizedBox(width: 8),
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: state.currentColor,
              borderRadius: BorderRadius.circular(7),
              border: Border.all(color: _Tok.border, width: 2),
            ),
          ),
        ],
      ],
    );
  }

  (String, String) _valueForMode(LightCapability mode) {
    return switch (mode) {
      LightCapability.brightness => (state.brightness.round().toString(), '%'),
      LightCapability.colorTemp => (state.colorTemp.round().toString(), 'K'),
      LightCapability.hue => (state.brightness.round().toString(), '%'),
      LightCapability.saturation => (state.saturation.round().toString(), '%'),
      LightCapability.whiteChannel =>
        (state.whiteChannel.round().toString(), '%'),
    };
  }

  // ── Label ─────────────────────────────────────────────────────

  Widget _buildLabel() {
    final mode = state.activeMode ?? LightCapability.brightness;
    final parts = <String>[_labelForMode(mode)];

    // Add color name context when relevant
    if (state.colorName != null &&
        mode != LightCapability.hue &&
        mode != LightCapability.saturation) {
      parts.add(state.colorName!);
    }

    // Add color temp context when on brightness
    if (mode == LightCapability.brightness &&
        state.capabilities.contains(LightCapability.colorTemp)) {
      parts.add('${state.colorTemp.round()}K');
    }

    return Text(
      parts.join(' · '),
      style: const TextStyle(
        fontSize: 13,
        color: _Tok.textSec,
      ),
    );
  }

  String _labelForMode(LightCapability mode) {
    return switch (mode) {
      LightCapability.brightness => 'Brightness',
      LightCapability.colorTemp => _colorTempLabel(state.colorTemp),
      LightCapability.hue => 'Hue · ${state.hue.round()}° ${_hueName(state.hue)}',
      LightCapability.saturation => 'Saturation · ${state.saturation.round()}%',
      LightCapability.whiteChannel => 'White Channel · ${state.whiteChannel.round()}%',
    };
  }

  String _colorTempLabel(double kelvin) {
    if (kelvin < 3000) return 'Color Temperature · Warm';
    if (kelvin < 4000) return 'Color Temperature · Warm White';
    if (kelvin < 5000) return 'Color Temperature · Neutral';
    if (kelvin < 5500) return 'Color Temperature · Cool White';
    return 'Color Temperature · Daylight';
  }

  String _hueName(double hue) {
    if (hue < 15 || hue >= 345) return 'Red';
    if (hue < 45) return 'Orange';
    if (hue < 75) return 'Yellow';
    if (hue < 150) return 'Green';
    if (hue < 195) return 'Cyan';
    if (hue < 255) return 'Blue';
    if (hue < 285) return 'Violet';
    if (hue < 345) return 'Pink';
    return 'Red';
  }

  // ── Mode Switcher ─────────────────────────────────────────────

  Widget _buildModeSwitcher() {
    final caps = state.capabilities.toList();
    // Sort in a consistent display order
    caps.sort((a, b) => a.index.compareTo(b.index));

    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 440),
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: _Tok.surfaceDim,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: caps.map((cap) {
          final isActive = cap == (state.activeMode ?? caps.first);
          return Expanded(
            child: _ModeTab(
              capability: cap,
              isActive: isActive,
              onTap: () => onModeChanged?.call(cap),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── Active Slider ─────────────────────────────────────────────

  Widget _buildActiveSlider() {
    final mode = state.activeMode ??
        (state.capabilities.isNotEmpty
            ? state.capabilities.first
            : LightCapability.brightness);

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 440),
      child: Column(
        children: [
          _buildSliderTrack(mode),
          const SizedBox(height: 4),
          _buildTrackLabels(mode),
          const SizedBox(height: 7),
          _buildPresets(mode),
        ],
      ),
    );
  }

  Widget _buildSliderTrack(LightCapability mode) {
    final (gradient, thumbColor, position) = _sliderConfig(mode);

    return SizedBox(
      height: _Tok.thumbSize,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = constraints.maxWidth;
          final thumbLeft = (trackWidth * position) - (_Tok.thumbSize / 2);

          return Stack(
            clipBehavior: Clip.none,
            children: [
              // Track
              Positioned(
                top: (_Tok.thumbSize - _Tok.trackHeight) / 2,
                left: 0,
                right: 0,
                child: Container(
                  height: _Tok.trackHeight,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(_Tok.trackHeight / 2),
                    gradient: gradient,
                  ),
                ),
              ),
              // Thumb
              Positioned(
                left: thumbLeft.clamp(0, trackWidth - _Tok.thumbSize),
                top: 0,
                child: Container(
                  width: _Tok.thumbSize,
                  height: _Tok.thumbSize,
                  decoration: BoxDecoration(
                    color: _Tok.surface,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: thumbColor,
                      width: _Tok.thumbBorder,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.18),
                        blurRadius: 6,
                        offset: const Offset(0, 1),
                      ),
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 0,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Returns (gradient, thumbColor, normalizedPosition 0..1).
  (LinearGradient, Color, double) _sliderConfig(LightCapability mode) {
    return switch (mode) {
      LightCapability.brightness => (
          _Gradients.brightness,
          _Tok.coral,
          state.brightness / 100,
        ),
      LightCapability.colorTemp => (
          _Gradients.colorTemp,
          _Tok.amber,
          (state.colorTemp - 2700) / (6500 - 2700),
        ),
      LightCapability.hue => (
          _Gradients.hue,
          _Tok.coral,
          state.hue / 360,
        ),
      LightCapability.saturation => (
          _Gradients.saturation(state.currentColor ?? _Tok.coral),
          _Tok.coral,
          state.saturation / 100,
        ),
      LightCapability.whiteChannel => (
          _Gradients.whiteChannel,
          _Tok.amber,
          state.whiteChannel / 100,
        ),
    };
  }

  Widget _buildTrackLabels(LightCapability mode) {
    final labels = switch (mode) {
      LightCapability.brightness => ['0%', '25%', '50%', '75%', '100%'],
      LightCapability.colorTemp => ['2700K', '3500K', '4500K', '5500K', '6500K'],
      LightCapability.hue => ['0°', '60°', '120°', '180°', '240°', '300°', '360°'],
      LightCapability.saturation => ['0% Gray', '25%', '50%', '75%', '100% Vivid'],
      LightCapability.whiteChannel => ['Off', '25%', '50%', '75%', '100%'],
    };

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: labels
          .map((l) => Text(
                l,
                style: const TextStyle(
                  fontSize: 8.5,
                  fontWeight: FontWeight.w500,
                  color: _Tok.textHint,
                ),
              ))
          .toList(),
    );
  }

  Widget _buildPresets(LightCapability mode) {
    if (mode == LightCapability.hue) {
      return _buildColorPresets();
    }
    return _buildChipPresets(mode);
  }

  Widget _buildChipPresets(LightCapability mode) {
    final presets = _presetsForMode(mode);

    return Row(
      children: presets.map((p) {
        return Padding(
          padding: const EdgeInsets.only(right: 5),
          child: GestureDetector(
            onTap: () => onPresetTap?.call(p),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(
                color: p.isActive ? _Tok.coralBg : _Tok.surfaceDim,
                borderRadius: BorderRadius.circular(7),
              ),
              child: Text(
                p.label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: p.isActive ? _Tok.coral : _Tok.textMid,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  List<SliderPreset> _presetsForMode(LightCapability mode) {
    return switch (mode) {
      LightCapability.brightness => [
          SliderPreset(label: '10%', value: 10),
          SliderPreset(label: '25%', value: 25),
          SliderPreset(
            label: '50%',
            value: 50,
            isActive: state.brightness == 50,
          ),
          SliderPreset(label: '75%', value: 75),
          SliderPreset(label: '100%', value: 100),
        ],
      LightCapability.colorTemp => [
          SliderPreset(label: '2700K', value: 2700),
          SliderPreset(
            label: '3200K',
            value: 3200,
            isActive: state.colorTemp == 3200,
          ),
          SliderPreset(label: '4000K', value: 4000),
          SliderPreset(label: '5000K', value: 5000),
          SliderPreset(label: '6500K', value: 6500),
        ],
      LightCapability.saturation => [
          SliderPreset(label: '25%', value: 25),
          SliderPreset(label: '50%', value: 50),
          SliderPreset(label: '75%', value: 75),
          SliderPreset(
            label: '85%',
            value: 85,
            isActive: state.saturation == 85,
          ),
          SliderPreset(label: '100%', value: 100),
        ],
      LightCapability.whiteChannel => [
          SliderPreset(label: 'Off', value: 0),
          SliderPreset(label: '25%', value: 25),
          SliderPreset(
            label: '40%',
            value: 40,
            isActive: state.whiteChannel == 40,
          ),
          SliderPreset(label: '75%', value: 75),
          SliderPreset(label: '100%', value: 100),
        ],
      _ => [],
    };
  }

  Widget _buildColorPresets() {
    final presets = [
      ColorPreset(
        color: const Color(0xFFE85A4F),
        name: 'Red',
        hueValue: 10,
        isActive: state.hue < 15,
      ),
      ColorPreset(
        color: const Color(0xFFFF9800),
        name: 'Orange',
        hueValue: 30,
      ),
      ColorPreset(
        color: const Color(0xFFFFEB3B),
        name: 'Yellow',
        hueValue: 60,
      ),
      ColorPreset(
        color: const Color(0xFF4CAF50),
        name: 'Green',
        hueValue: 120,
      ),
      ColorPreset(
        color: const Color(0xFF42A5F5),
        name: 'Blue',
        hueValue: 210,
      ),
      ColorPreset(
        color: const Color(0xFF7B1FA2),
        name: 'Purple',
        hueValue: 280,
      ),
      ColorPreset(
        color: const Color(0xFFE91E63),
        name: 'Pink',
        hueValue: 340,
      ),
      ColorPreset(
        color: const Color(0xFFFFFAF0),
        name: 'White',
        hueValue: 0,
      ),
    ];

    return Row(
      children: presets.map((p) {
        return Padding(
          padding: const EdgeInsets.only(right: 5),
          child: GestureDetector(
            onTap: () => onColorPresetTap?.call(p),
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: p.color,
                borderRadius: BorderRadius.circular(7),
                border: Border.all(
                  color: p.isActive ? _Tok.textPrimary : Colors.transparent,
                  width: 2,
                ),
                boxShadow: p.isActive
                    ? [
                        BoxShadow(
                          color: _Tok.surface,
                          spreadRadius: 2,
                          blurRadius: 0,
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

  // ── On/Off Hero (no slider capabilities) ──────────────────────

  Widget _buildOnOffHero() {
    return Column(
      children: [
        const SizedBox(height: 12),
        Icon(
          Icons.lightbulb_outline,
          size: 56,
          color: state.isOn ? _Tok.coral : _Tok.textHint,
        ),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: () => onToggle?.call(!state.isOn),
          child: Container(
            width: 110,
            height: 56,
            decoration: BoxDecoration(
              color: state.isOn ? _Tok.coral : _Tok.surfaceDim,
              borderRadius: BorderRadius.circular(28),
            ),
            child: Stack(
              children: [
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeInOut,
                  top: 4,
                  left: state.isOn ? 58 : 4,
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          state.isOn ? 'On' : 'Off',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: state.isOn ? _Tok.coral : _Tok.textSec,
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════
// MODE TAB (private helper)
// ══════════════════════════════════════════════════════════════════

class _ModeTab extends StatelessWidget {
  final LightCapability capability;
  final bool isActive;
  final VoidCallback onTap;

  const _ModeTab({
    required this.capability,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 7),
        decoration: BoxDecoration(
          color: isActive ? _Tok.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 3,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 18,
              height: 18,
              child: _icon,
            ),
            const SizedBox(height: 2),
            Text(
              _label,
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w600,
                color: isActive ? _Tok.coral : _Tok.textHint,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String get _label => switch (capability) {
        LightCapability.brightness => 'Bright',
        LightCapability.colorTemp => 'Temp',
        LightCapability.hue => 'Hue',
        LightCapability.saturation => 'Sat',
        LightCapability.whiteChannel => 'White',
      };

  Widget get _icon {
    final color = isActive ? _Tok.coral : _Tok.textHint;

    return switch (capability) {
      LightCapability.brightness => Icon(Icons.wb_sunny_outlined, size: 16, color: color),
      LightCapability.colorTemp => Icon(Icons.thermostat, size: 16, color: color),
      LightCapability.hue => Icon(Icons.palette_outlined, size: 16, color: color),
      LightCapability.saturation => Icon(Icons.opacity, size: 16, color: color),
      LightCapability.whiteChannel => Icon(Icons.square_rounded, size: 16, color: color),
    };
  }
}

// ══════════════════════════════════════════════════════════════════
// USAGE EXAMPLES
// ══════════════════════════════════════════════════════════════════

/// Example: Full capabilities (5 tabs), brightness active.
final exampleFull = LightsHeroPanel(
  state: const LightRoleState(
    roleName: 'Ambient',
    deviceCount: 6,
    capabilities: {
      LightCapability.brightness,
      LightCapability.colorTemp,
      LightCapability.hue,
      LightCapability.saturation,
      LightCapability.whiteChannel,
    },
    activeMode: LightCapability.brightness,
    brightness: 50,
    colorTemp: 3200,
    hue: 10,
    saturation: 85,
    whiteChannel: 40,
    currentColor: Color(0xFFE85A4F),
    colorName: 'Coral Red',
  ),
);

/// Example: Brightness + Color Temp only (2 tabs).
final exampleTwoTabs = LightsHeroPanel(
  state: const LightRoleState(
    roleName: 'Main',
    deviceCount: 1,
    capabilities: {
      LightCapability.brightness,
      LightCapability.colorTemp,
    },
    activeMode: LightCapability.brightness,
    brightness: 50,
    colorTemp: 3200,
  ),
);

/// Example: Brightness only (no switcher).
final exampleBrightnessOnly = LightsHeroPanel(
  state: const LightRoleState(
    roleName: 'Main',
    deviceCount: 1,
    capabilities: {LightCapability.brightness},
    activeMode: LightCapability.brightness,
    brightness: 80,
  ),
);

/// Example: On/off only (big toggle).
final exampleOnOff = LightsHeroPanel(
  state: const LightRoleState(
    roleName: 'Task',
    deviceCount: 1,
    isOn: true,
    capabilities: {},
  ),
);
