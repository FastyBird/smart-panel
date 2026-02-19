// =============================================================================
// SETTINGS DOMAIN – COMPLETE IMPLEMENTATION
// =============================================================================
// Refactored settings screens matching the SmartPanel design system.
// All 7 screens: General, Display, Language, Audio, Weather, About, Maintenance.
//
// Supports light/dark themes and portrait/landscape orientations.
// Uses the established design tokens: coral accent, 14px card radius,
// Plus Jakarta Sans typography, colored icon badges per category.
//
// Drop this file into your project. Wire real settings state as needed.
// =============================================================================

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ─────────────────────────────────────────────────────────────────────────────
// THEME & DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

class SettingsColors {
  SettingsColors._();

  // Brand accent
  static const Color coral = Color(0xFFE85A4F);
  static const Color coralBg = Color(0x14E85A4F);
  static const Color coralBorder = Color(0x2EE85A4F);

  // Category colors
  static const Color blue = Color(0xFF4A9EBF);
  static const Color blueBg = Color(0x14499EBF);
  static const Color amber = Color(0xFFCC8833);
  static const Color amberBg = Color(0x14CC8833);
  static const Color green = Color(0xFF5EA05E);
  static const Color greenBg = Color(0x145EA05E);
  static const Color red = Color(0xFFC03030);
  static const Color redBg = Color(0x14C03030);
  static const Color redBorder = Color(0x2EC03030);
}

class SettingsTheme {
  final Brightness brightness;

  const SettingsTheme.light() : brightness = Brightness.light;
  const SettingsTheme.dark() : brightness = Brightness.dark;

  bool get isDark => brightness == Brightness.dark;

  // Backgrounds
  Color get bg => isDark ? const Color(0xFF141414) : const Color(0xFFF5F0EB);
  Color get surface => isDark ? const Color(0xFF1E1E1E) : const Color(0xFFFFFFFF);
  Color get surfaceDim =>
      isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF0EBE5);

  // Text
  Color get text => isDark ? const Color(0xFFF0ECE6) : const Color(0xFF2C2C2C);
  Color get textMid => isDark ? const Color(0xFFAAAAAA) : const Color(0xFF555555);
  Color get textSec => isDark ? const Color(0xFF777777) : const Color(0xFF888888);
  Color get textHint =>
      isDark ? const Color(0xFF555555) : const Color(0xFFBBBBBB);

  // Borders
  Color get border =>
      isDark ? Colors.white.withValues(alpha: 0.07) : Colors.black.withValues(alpha: 0.06);
  Color get borderStrong =>
      isDark ? Colors.white.withValues(alpha: 0.12) : Colors.black.withValues(alpha: 0.10);

  // Interactive
  Color get toggleOffBg =>
      isDark ? const Color(0xFF3A3A3A) : const Color(0xFFD5D0CB);
  Color get sliderTrack =>
      isDark ? const Color(0xFF333333) : const Color(0xFFE0DBD5);
  Color get iconBg => isDark
      ? Colors.white.withValues(alpha: 0.06)
      : Colors.black.withValues(alpha: 0.04);

  // Sidebar
  Color get sidebarBg =>
      isDark ? const Color(0xFF1A1A1A) : const Color(0xFFEDEAE5);
  Color get sidebarIcon =>
      isDark ? const Color(0xFF555555) : const Color(0xFF999999);

  // Shadows
  List<BoxShadow> get cardShadow => isDark
      ? [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 3, offset: const Offset(0, 1))]
      : [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 3, offset: const Offset(0, 1))];

  // Category icon colors (adapt slightly for dark)
  Color get coral => SettingsColors.coral;
  Color get coralBg =>
      isDark ? const Color(0x1FE85A4F) : SettingsColors.coralBg;
  Color get blue => isDark ? const Color(0xFF5BC0DE) : SettingsColors.blue;
  Color get blueBg =>
      isDark ? const Color(0x1A5BC0DE) : SettingsColors.blueBg;
  Color get amber => isDark ? const Color(0xFFDDAA44) : SettingsColors.amber;
  Color get amberBg =>
      isDark ? const Color(0x1ADDAA44) : SettingsColors.amberBg;
  Color get green => isDark ? const Color(0xFF6BBF6B) : SettingsColors.green;
  Color get greenBg =>
      isDark ? const Color(0x1A6BBF6B) : SettingsColors.greenBg;
  Color get red => isDark ? const Color(0xFFEF5350) : SettingsColors.red;
  Color get redBg =>
      isDark ? const Color(0x1AEF5350) : SettingsColors.redBg;
  Color get redBorder =>
      isDark ? const Color(0x38EF5350) : SettingsColors.redBorder;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED WIDGETS
// ─────────────────────────────────────────────────────────────────────────────

/// Standard settings header bar with back button and title.
class SettingsHeader extends StatelessWidget {
  final SettingsTheme theme;
  final String title;
  final VoidCallback? onBack;
  final VoidCallback? onClose;

  const SettingsHeader({
    super.key,
    required this.theme,
    required this.title,
    this.onBack,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: theme.border)),
      ),
      child: Row(
        children: [
          // Back or settings icon
          if (onBack != null)
            GestureDetector(
              onTap: onBack,
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: theme.iconBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.chevron_left, size: 18, color: theme.textSec),
              ),
            )
          else
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: theme.iconBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.settings, size: 16, color: theme.textSec),
            ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: theme.text,
              ),
            ),
          ),
          if (onClose != null)
            GestureDetector(
              onTap: onClose,
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: theme.coralBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.close, size: 14, color: theme.coral),
              ),
            ),
        ],
      ),
    );
  }
}

/// Settings card wrapper with icon badge, label, description, and trailing widget.
class SettingsCard extends StatelessWidget {
  final SettingsTheme theme;
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final String label;
  final String? description;
  final Widget? trailing;
  final Widget? bottom;
  final bool isDanger;
  final double opacity;
  final VoidCallback? onTap;

  const SettingsCard({
    super.key,
    required this.theme,
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    required this.label,
    this.description,
    this.trailing,
    this.bottom,
    this.isDanger = false,
    this.opacity = 1.0,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: opacity,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: theme.surface,
            border: Border(
              top: BorderSide(color: isDanger ? theme.redBorder : theme.border),
              right: BorderSide(color: isDanger ? theme.redBorder : theme.border),
              bottom: BorderSide(color: isDanger ? theme.redBorder : theme.border),
              left: BorderSide(
                color: isDanger ? theme.red : theme.border,
                width: isDanger ? 3 : 1,
              ),
            ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: theme.cardShadow,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  // Icon badge
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: iconBgColor,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 20, color: iconColor),
                  ),
                  const SizedBox(width: 12),
                  // Text
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isDanger ? theme.red : theme.text,
                          ),
                        ),
                        if (description != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 1),
                            child: Text(
                              description!,
                              style: TextStyle(
                                fontSize: 11,
                                color: theme.textSec,
                                height: 1.3,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (trailing != null) ...[
                    const SizedBox(width: 8),
                    trailing!,
                  ],
                ],
              ),
              if (bottom != null) ...[
                const SizedBox(height: 10),
                bottom!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Custom coral toggle switch.
class SettingsToggle extends StatelessWidget {
  final SettingsTheme theme;
  final bool value;
  final ValueChanged<bool>? onChanged;

  const SettingsToggle({
    super.key,
    required this.theme,
    required this.value,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onChanged != null ? () => onChanged!(!value) : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 44,
        height: 26,
        decoration: BoxDecoration(
          color: value ? SettingsColors.coral : theme.toggleOffBg,
          borderRadius: BorderRadius.circular(13),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 200),
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 20,
            height: 20,
            margin: const EdgeInsets.symmetric(horizontal: 3),
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 3,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Custom coral slider.
class SettingsSlider extends StatelessWidget {
  final SettingsTheme theme;
  final double value; // 0.0 – 1.0
  final IconData iconSmall;
  final IconData iconLarge;
  final ValueChanged<double>? onChanged;

  const SettingsSlider({
    super.key,
    required this.theme,
    required this.value,
    required this.iconSmall,
    required this.iconLarge,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(iconSmall, size: 16, color: theme.textHint),
        const SizedBox(width: 8),
        Expanded(
          child: LayoutBuilder(builder: (context, constraints) {
            final trackWidth = constraints.maxWidth;
            final thumbPos = value * trackWidth;
            return GestureDetector(
              onHorizontalDragUpdate: onChanged != null
                  ? (details) {
                      final newVal =
                          (details.localPosition.dx / trackWidth).clamp(0.0, 1.0);
                      onChanged!(newVal);
                    }
                  : null,
              onTapDown: onChanged != null
                  ? (details) {
                      final newVal =
                          (details.localPosition.dx / trackWidth).clamp(0.0, 1.0);
                      onChanged!(newVal);
                    }
                  : null,
              child: SizedBox(
                height: 24,
                child: Stack(
                  alignment: Alignment.centerLeft,
                  children: [
                    // Track background
                    Container(
                      height: 6,
                      decoration: BoxDecoration(
                        color: theme.sliderTrack,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    // Track fill
                    Container(
                      height: 6,
                      width: thumbPos,
                      decoration: BoxDecoration(
                        color: SettingsColors.coral,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    // Thumb
                    Positioned(
                      left: thumbPos - 9,
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          color: SettingsColors.coral,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: SettingsColors.coral.withValues(alpha: 0.35),
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
            );
          }),
        ),
        const SizedBox(width: 8),
        Icon(iconLarge, size: 20, color: theme.textHint),
      ],
    );
  }
}

/// Dropdown value display with chevron.
class SettingsDropdownValue extends StatelessWidget {
  final SettingsTheme theme;
  final String value;

  const SettingsDropdownValue({
    super.key,
    required this.theme,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: SettingsColors.coral,
          ),
        ),
        const SizedBox(width: 3),
        Icon(Icons.expand_more, size: 14, color: theme.textHint),
      ],
    );
  }
}

/// Action button (for maintenance actions).
class SettingsActionButton extends StatelessWidget {
  final Color color;
  final Color bgColor;

  const SettingsActionButton({
    super.key,
    required this.color,
    required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(Icons.play_arrow, size: 16, color: color),
    );
  }
}

/// Section heading label.
class SettingsSectionHeading extends StatelessWidget {
  final SettingsTheme theme;
  final String text;
  final Color? color;

  const SettingsSectionHeading({
    super.key,
    required this.theme,
    required this.text,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color ?? theme.textSec,
          letterSpacing: 1.0,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GENERAL SETTINGS (Main Grid)
// ─────────────────────────────────────────────────────────────────────────────

class _SettingsTileData {
  final String label;
  final String sublabel;
  final IconData icon;
  final Color Function(SettingsTheme) iconColor;
  final Color Function(SettingsTheme) iconBg;
  final Widget Function(BuildContext, SettingsTheme) builder;

  const _SettingsTileData({
    required this.label,
    required this.sublabel,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.builder,
  });
}

class GeneralSettingsScreen extends StatelessWidget {
  final SettingsTheme theme;
  final bool isLandscape;
  final VoidCallback? onClose;

  const GeneralSettingsScreen({
    super.key,
    required this.theme,
    this.isLandscape = false,
    this.onClose,
  });

  static final List<_SettingsTileData> _tiles = [
    _SettingsTileData(
      label: 'Display',
      sublabel: 'Theme, brightness, lock',
      icon: Icons.desktop_mac_outlined,
      iconColor: (t) => t.coral,
      iconBg: (t) => t.coralBg,
      builder: (ctx, t) => DisplaySettingsScreen(theme: t),
    ),
    _SettingsTileData(
      label: 'Language',
      sublabel: 'Language, timezone, format',
      icon: Icons.language,
      iconColor: (t) => t.blue,
      iconBg: (t) => t.blueBg,
      builder: (ctx, t) => LanguageSettingsScreen(theme: t),
    ),
    _SettingsTileData(
      label: 'Audio',
      sublabel: 'Speaker, microphone',
      icon: Icons.volume_up_outlined,
      iconColor: (t) => t.amber,
      iconBg: (t) => t.amberBg,
      builder: (ctx, t) => AudioSettingsScreen(theme: t),
    ),
    _SettingsTileData(
      label: 'Weather',
      sublabel: 'Location source',
      icon: Icons.cloud_outlined,
      iconColor: (t) => t.blue,
      iconBg: (t) => t.blueBg,
      builder: (ctx, t) => WeatherSettingsScreen(theme: t),
    ),
    _SettingsTileData(
      label: 'About',
      sublabel: 'App info, device stats',
      icon: Icons.info_outline,
      iconColor: (t) => t.green,
      iconBg: (t) => t.greenBg,
      builder: (ctx, t) => AboutScreen(theme: t),
    ),
    _SettingsTileData(
      label: 'Maintenance',
      sublabel: 'Restart, power, reset',
      icon: Icons.build_outlined,
      iconColor: (t) => t.red,
      iconBg: (t) => t.redBg,
      builder: (ctx, t) => MaintenanceScreen(theme: t),
    ),
  ];

  void _navigateTo(BuildContext context, _SettingsTileData tile) {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => tile.builder(context, theme),
        transitionsBuilder: (_, animation, __, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 200),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final columns = isLandscape ? 3 : 2;

    return Container(
      color: theme.bg,
      child: Column(
        children: [
          SettingsHeader(
            theme: theme,
            title: 'Settings',
            onClose: onClose,
          ),
          Expanded(
            child: Padding(
              padding: EdgeInsets.all(isLandscape ? 24 : 20),
              child: Align(
                alignment: Alignment.topLeft,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: isLandscape ? 640 : double.infinity,
                  ),
                  child: GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: columns,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: isLandscape ? 1.35 : 1.2,
                    ),
                    itemCount: _tiles.length,
                    itemBuilder: (context, index) {
                      final tile = _tiles[index];
                      return _SettingsTile(
                        theme: theme,
                        label: tile.label,
                        sublabel: tile.sublabel,
                        icon: tile.icon,
                        iconColor: tile.iconColor(theme),
                        iconBgColor: tile.iconBg(theme),
                        onTap: () => _navigateTo(context, tile),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final SettingsTheme theme;
  final String label;
  final String sublabel;
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final VoidCallback? onTap;

  const _SettingsTile({
    required this.theme,
    required this.label,
    required this.sublabel,
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
        decoration: BoxDecoration(
          color: theme.surface,
          border: Border.all(color: theme.border),
          borderRadius: BorderRadius.circular(14),
          boxShadow: theme.cardShadow,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: iconBgColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 22, color: iconColor),
            ),
            const SizedBox(height: 10),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: theme.text,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              sublabel,
              style: TextStyle(
                fontSize: 10,
                color: theme.textSec,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DISPLAY SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

class DisplaySettingsScreen extends StatefulWidget {
  final SettingsTheme theme;

  const DisplaySettingsScreen({super.key, required this.theme});

  @override
  State<DisplaySettingsScreen> createState() => _DisplaySettingsScreenState();
}

class _DisplaySettingsScreenState extends State<DisplaySettingsScreen> {
  bool _darkMode = false;
  bool _screenSaver = true;
  double _brightness = 0.72;
  String _screenLock = 'Never';

  SettingsTheme get theme => widget.theme;

  @override
  Widget build(BuildContext context) {
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    final cards = <Widget>[
      // Theme Mode
      SettingsCard(
        theme: theme,
        icon: Icons.dark_mode_outlined,
        iconColor: theme.coral,
        iconBgColor: theme.coralBg,
        label: 'Theme Mode',
        description: 'Light or dark appearance',
        trailing: SettingsToggle(
          theme: theme,
          value: _darkMode,
          onChanged: (v) => setState(() => _darkMode = v),
        ),
      ),
      // Screen Saver
      SettingsCard(
        theme: theme,
        icon: Icons.desktop_mac_outlined,
        iconColor: theme.coral,
        iconBgColor: theme.coralBg,
        label: 'Screen Saver',
        description: 'Enable screen saver',
        trailing: SettingsToggle(
          theme: theme,
          value: _screenSaver,
          onChanged: (v) => setState(() => _screenSaver = v),
        ),
      ),
      // Brightness
      SettingsCard(
        theme: theme,
        icon: Icons.wb_sunny_outlined,
        iconColor: theme.coral,
        iconBgColor: theme.coralBg,
        label: 'Brightness',
        bottom: SettingsSlider(
          theme: theme,
          value: _brightness,
          iconSmall: Icons.wb_sunny_outlined,
          iconLarge: Icons.wb_sunny,
          onChanged: (v) => setState(() => _brightness = v),
        ),
      ),
      // Screen Lock
      SettingsCard(
        theme: theme,
        icon: Icons.lock_outline,
        iconColor: theme.coral,
        iconBgColor: theme.coralBg,
        label: 'Screen Lock',
        description: 'Auto-lock delay duration',
        trailing: SettingsDropdownValue(theme: theme, value: _screenLock),
      ),
    ];

    return _SubScreen(
      theme: theme,
      title: 'Display',
      isLandscape: isLandscape,
      children: cards,
      landscapeLayout: _TwoColumnLayout(cards: cards, theme: theme),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LANGUAGE SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

class LanguageSettingsScreen extends StatelessWidget {
  final SettingsTheme theme;

  const LanguageSettingsScreen({super.key, required this.theme});

  @override
  Widget build(BuildContext context) {
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    final cards = <Widget>[
      SettingsCard(
        theme: theme,
        icon: Icons.language,
        iconColor: theme.blue,
        iconBgColor: theme.blueBg,
        label: 'Language',
        description: 'Display language',
        trailing: SettingsDropdownValue(theme: theme, value: 'English'),
      ),
      SettingsCard(
        theme: theme,
        icon: Icons.access_time,
        iconColor: theme.blue,
        iconBgColor: theme.blueBg,
        label: 'Timezone',
        description: 'Current timezone',
        trailing: SettingsDropdownValue(theme: theme, value: 'Europe/Prague'),
      ),
      SettingsCard(
        theme: theme,
        icon: Icons.calendar_today_outlined,
        iconColor: theme.blue,
        iconBgColor: theme.blueBg,
        label: 'Time Format',
        description: 'Clock display style',
        trailing: SettingsDropdownValue(theme: theme, value: '24-hour'),
      ),
    ];

    return _SubScreen(
      theme: theme,
      title: 'Language & Region',
      isLandscape: isLandscape,
      children: cards,
      landscapeLayout: _TwoColumnLayout(cards: cards, theme: theme),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AUDIO SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

class AudioSettingsScreen extends StatefulWidget {
  final SettingsTheme theme;

  const AudioSettingsScreen({super.key, required this.theme});

  @override
  State<AudioSettingsScreen> createState() => _AudioSettingsScreenState();
}

class _AudioSettingsScreenState extends State<AudioSettingsScreen> {
  bool _speakerEnabled = false;
  double _speakerVolume = 0.65;
  bool _micEnabled = false;
  double _micVolume = 0.50;

  SettingsTheme get theme => widget.theme;

  @override
  Widget build(BuildContext context) {
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      return _SubScreenScaffold(
        theme: theme,
        title: 'Audio',
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Speaker column
              Expanded(child: _buildSpeakerColumn()),
              const SizedBox(width: 12),
              // Microphone column
              Expanded(child: _buildMicColumn()),
            ],
          ),
        ),
      );
    }

    return _SubScreenScaffold(
      theme: theme,
      title: 'Audio',
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ..._buildSpeakerCards(),
            const SizedBox(height: 16),
            ..._buildMicCards(),
          ],
        ),
      ),
    );
  }

  Widget _buildSpeakerColumn() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: _buildSpeakerCards(),
    );
  }

  Widget _buildMicColumn() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: _buildMicCards(),
    );
  }

  List<Widget> _buildSpeakerCards() {
    return [
      SettingsSectionHeading(theme: theme, text: 'Speaker'),
      SettingsCard(
        theme: theme,
        icon: Icons.volume_up_outlined,
        iconColor: theme.amber,
        iconBgColor: theme.amberBg,
        label: 'Speaker',
        description: 'Enable or disable speaker output',
        trailing: SettingsToggle(
          theme: theme,
          value: _speakerEnabled,
          onChanged: (v) => setState(() => _speakerEnabled = v),
        ),
      ),
      const SizedBox(height: 10),
      SettingsCard(
        theme: theme,
        icon: Icons.volume_mute_outlined,
        iconColor: theme.amber,
        iconBgColor: theme.amberBg,
        label: 'Speaker Volume',
        opacity: _speakerEnabled ? 1.0 : 0.4,
        bottom: SettingsSlider(
          theme: theme,
          value: _speakerVolume,
          iconSmall: Icons.volume_mute,
          iconLarge: Icons.volume_up,
          onChanged: _speakerEnabled
              ? (v) => setState(() => _speakerVolume = v)
              : null,
        ),
      ),
    ];
  }

  List<Widget> _buildMicCards() {
    return [
      SettingsSectionHeading(theme: theme, text: 'Microphone'),
      SettingsCard(
        theme: theme,
        icon: Icons.mic_outlined,
        iconColor: theme.amber,
        iconBgColor: theme.amberBg,
        label: 'Microphone',
        description: 'Enable or disable microphone',
        trailing: SettingsToggle(
          theme: theme,
          value: _micEnabled,
          onChanged: (v) => setState(() => _micEnabled = v),
        ),
      ),
      const SizedBox(height: 10),
      SettingsCard(
        theme: theme,
        icon: Icons.mic_none,
        iconColor: theme.amber,
        iconBgColor: theme.amberBg,
        label: 'Microphone Volume',
        opacity: _micEnabled ? 1.0 : 0.4,
        bottom: SettingsSlider(
          theme: theme,
          value: _micVolume,
          iconSmall: Icons.mic_none,
          iconLarge: Icons.mic,
          onChanged:
              _micEnabled ? (v) => setState(() => _micVolume = v) : null,
        ),
      ),
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. WEATHER SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

class WeatherSettingsScreen extends StatelessWidget {
  final SettingsTheme theme;

  const WeatherSettingsScreen({super.key, required this.theme});

  @override
  Widget build(BuildContext context) {
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    final cards = <Widget>[
      SettingsCard(
        theme: theme,
        icon: Icons.location_on_outlined,
        iconColor: theme.blue,
        iconBgColor: theme.blueBg,
        label: 'Weather Location',
        description: 'Select from locations configured in the administrator app',
        trailing: SettingsDropdownValue(theme: theme, value: 'Home'),
      ),
      SettingsCard(
        theme: theme,
        icon: Icons.thermostat_outlined,
        iconColor: theme.blue,
        iconBgColor: theme.blueBg,
        label: 'Temperature Unit',
        description: 'Celsius or Fahrenheit',
        trailing: SettingsDropdownValue(theme: theme, value: '°C'),
      ),
    ];

    return _SubScreen(
      theme: theme,
      title: 'Weather',
      isLandscape: isLandscape,
      children: cards,
      landscapeLayout: _TwoColumnLayout(cards: cards, theme: theme),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ABOUT APPLICATION
// ─────────────────────────────────────────────────────────────────────────────

class AboutScreen extends StatelessWidget {
  final SettingsTheme theme;

  const AboutScreen({super.key, required this.theme});

  @override
  Widget build(BuildContext context) {
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      return _SubScreenScaffold(
        theme: theme,
        title: 'About',
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Left: branding
              SizedBox(
                width: 220,
                child: _buildBranding(),
              ),
              const SizedBox(width: 24),
              // Right: device info
              Expanded(child: _buildDeviceInfo()),
            ],
          ),
        ),
      );
    }

    return _SubScreenScaffold(
      theme: theme,
      title: 'About',
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            _buildBranding(),
            const SizedBox(height: 20),
            Divider(color: theme.border, height: 1),
            const SizedBox(height: 16),
            _buildDeviceInfo(),
          ],
        ),
      ),
    );
  }

  Widget _buildBranding() {
    return Column(
      children: [
        // Logo
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            color: theme.surfaceDim,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Icon(Icons.settings, size: 30, color: theme.text),
        ),
        const SizedBox(height: 14),
        Text(
          'FastyBird! Smart Panel',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: theme.text,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 2),
        Text(
          'Version 1.0.0',
          style: TextStyle(fontSize: 12, color: theme.textSec),
        ),
        const SizedBox(height: 12),
        Text(
          'A home automation app that enables seamless integration with your smart devices, offering enhanced control and monitoring capabilities.',
          style: TextStyle(
            fontSize: 11,
            color: theme.textMid,
            height: 1.5,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 14),
        // Developer info
        Text(
          'DEVELOPED BY',
          style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w600,
            color: theme.textSec,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          'FastyBird Team',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: theme.text,
          ),
        ),
        const SizedBox(height: 1),
        Text(
          'fastybird.com',
          style: TextStyle(fontSize: 11, color: SettingsColors.coral),
        ),
        const SizedBox(height: 10),
        // License button
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: theme.coralBg,
            border: Border.all(color: SettingsColors.coralBorder),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.description_outlined,
                  size: 14, color: SettingsColors.coral),
              const SizedBox(width: 6),
              Text(
                'View License',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: SettingsColors.coral,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDeviceInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SettingsSectionHeading(theme: theme, text: 'Device Information'),
        Row(
          children: [
            Expanded(child: _infoCard('IP Address', '10.10.0.10', mono: true)),
            const SizedBox(width: 10),
            Expanded(
                child: _infoCard('MAC Address', '7e:ae:f3:e7:08:f2', mono: true)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _infoCard('CPU Usage', '46.91%')),
            const SizedBox(width: 10),
            Expanded(child: _infoCard('Memory', '32,559 MB')),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _infoCard('Uptime', '14d 6h 32m')),
            const SizedBox(width: 10),
            Expanded(child: _infoCard('Storage', '2.1 / 8 GB')),
          ],
        ),
      ],
    );
  }

  Widget _infoCard(String label, String value, {bool mono = false}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.surface,
        border: Border.all(color: theme.border),
        borderRadius: BorderRadius.circular(12),
        boxShadow: theme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: theme.textSec,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: mono ? 11 : 13,
              fontWeight: mono ? FontWeight.w500 : FontWeight.w700,
              color: theme.text,
              fontFamily: mono ? 'monospace' : null,
              letterSpacing: mono ? -0.3 : 0,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MAINTENANCE
// ─────────────────────────────────────────────────────────────────────────────

class MaintenanceScreen extends StatelessWidget {
  final SettingsTheme theme;

  const MaintenanceScreen({super.key, required this.theme});

  @override
  Widget build(BuildContext context) {
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      return _SubScreenScaffold(
        theme: theme,
        title: 'Maintenance',
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // System column
              Expanded(child: _buildSystemColumn()),
              const SizedBox(width: 12),
              // Danger column
              Expanded(child: _buildDangerColumn()),
            ],
          ),
        ),
      );
    }

    return _SubScreenScaffold(
      theme: theme,
      title: 'Maintenance',
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SettingsSectionHeading(theme: theme, text: 'System'),
            _buildRestartCard(),
            const SizedBox(height: 10),
            _buildPowerOffCard(),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Divider(color: theme.border, height: 1),
            ),
            SettingsSectionHeading(theme: theme, text: 'Danger Zone', color: theme.red),
            _buildFactoryResetCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildSystemColumn() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SettingsSectionHeading(theme: theme, text: 'System'),
        _buildRestartCard(),
        const SizedBox(height: 10),
        _buildPowerOffCard(),
      ],
    );
  }

  Widget _buildDangerColumn() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SettingsSectionHeading(theme: theme, text: 'Danger Zone', color: theme.red),
        _buildFactoryResetCard(),
      ],
    );
  }

  Widget _buildRestartCard() {
    return SettingsCard(
      theme: theme,
      icon: Icons.refresh,
      iconColor: theme.coral,
      iconBgColor: theme.coralBg,
      label: 'Restart',
      description: 'Restart to apply changes or resolve issues',
      trailing: SettingsActionButton(
        color: theme.coral,
        bgColor: theme.coralBg,
      ),
    );
  }

  Widget _buildPowerOffCard() {
    return SettingsCard(
      theme: theme,
      icon: Icons.power_settings_new,
      iconColor: theme.coral,
      iconBgColor: theme.coralBg,
      label: 'Power Off',
      description: 'Power off the device completely',
      trailing: SettingsActionButton(
        color: theme.coral,
        bgColor: theme.coralBg,
      ),
    );
  }

  Widget _buildFactoryResetCard() {
    return SettingsCard(
      theme: theme,
      icon: Icons.warning_amber_rounded,
      iconColor: theme.red,
      iconBgColor: theme.redBg,
      label: 'Factory Reset',
      description: 'Restore original factory settings. This cannot be undone.',
      isDanger: true,
      trailing: SettingsActionButton(
        color: theme.red,
        bgColor: theme.redBg,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/// Scaffold for sub-screens with header + back button.
class _SubScreenScaffold extends StatelessWidget {
  final SettingsTheme theme;
  final String title;
  final Widget child;

  const _SubScreenScaffold({
    required this.theme,
    required this.title,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: theme.bg,
      body: Column(
        children: [
          SettingsHeader(
            theme: theme,
            title: title,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

/// Generic sub-screen with portrait list / landscape two-column.
class _SubScreen extends StatelessWidget {
  final SettingsTheme theme;
  final String title;
  final bool isLandscape;
  final List<Widget> children;
  final Widget? landscapeLayout;

  const _SubScreen({
    required this.theme,
    required this.title,
    required this.isLandscape,
    required this.children,
    this.landscapeLayout,
  });

  @override
  Widget build(BuildContext context) {
    if (isLandscape && landscapeLayout != null) {
      return _SubScreenScaffold(
        theme: theme,
        title: title,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: landscapeLayout!,
        ),
      );
    }

    return _SubScreenScaffold(
      theme: theme,
      title: title,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          for (int i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

/// Two-column grid layout for landscape sub-screens.
class _TwoColumnLayout extends StatelessWidget {
  final List<Widget> cards;
  final SettingsTheme theme;

  const _TwoColumnLayout({required this.cards, required this.theme});

  @override
  Widget build(BuildContext context) {
    // Place first two cards side by side, rest go full-span
    if (cards.length <= 2) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (int i = 0; i < cards.length; i++) ...[
            if (i > 0) const SizedBox(width: 12),
            Expanded(child: cards[i]),
          ],
        ],
      );
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 680),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // First row: 2 cards side by side
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: cards[0]),
              const SizedBox(width: 12),
              Expanded(child: cards[1]),
            ],
          ),
          // Remaining cards full-span
          for (int i = 2; i < cards.length; i++) ...[
            const SizedBox(height: 10),
            cards[i],
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO APP (for testing)
// ─────────────────────────────────────────────────────────────────────────────

/// Wrap in a MaterialApp to preview. Toggle `_isDark` to switch themes.
class SettingsDemoApp extends StatefulWidget {
  const SettingsDemoApp({super.key});

  @override
  State<SettingsDemoApp> createState() => _SettingsDemoAppState();
}

class _SettingsDemoAppState extends State<SettingsDemoApp> {
  bool _isDark = false;

  @override
  Widget build(BuildContext context) {
    final theme =
        _isDark ? const SettingsTheme.dark() : const SettingsTheme.light();

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        fontFamily: 'Plus Jakarta Sans',
        brightness: _isDark ? Brightness.dark : Brightness.light,
      ),
      home: Scaffold(
        body: GeneralSettingsScreen(
          theme: theme,
          onClose: () {},
        ),
        floatingActionButton: FloatingActionButton(
          mini: true,
          backgroundColor: SettingsColors.coral,
          onPressed: () => setState(() => _isDark = !_isDark),
          child: Icon(
            _isDark ? Icons.light_mode : Icons.dark_mode,
            size: 18,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
