// =============================================================================
// DECK HOME / DASHBOARD — VARIANT A: SKY | CONTENT SPLIT
// =============================================================================
// Room-scoped dashboard for SmartPanel wall-mounted tablet.
// Sky panel (time, weather, status, scenes) + solid content (domain cards,
// sensors, alerts). Supports light/dark themes and landscape/portrait.
//
// Drop into your project as a self-contained mockup. Wire real data by
// replacing the mock models and connecting to your state management.
// =============================================================================

import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

// =============================================================================
// THEME
// =============================================================================

class DeckHomeTheme {
  DeckHomeTheme._();

  // Brand accent
  static const Color coral = Color(0xFFE85A4F);
  static const Color coralBg = Color(0x1AE85A4F);
  static const Color coralBorder = Color(0x40E85A4F);

  // Domain colors
  static const Color climate = Color(0xFF2AADCC);
  static const Color lights = Color(0xFFD4882B);
  static const Color media = Color(0xFFC03030);
  static const Color shading = Color(0xFFCC8833);

  // Domain background tints
  static const Color climateBg = Color(0x1A2AADCC);
  static const Color lightsBg = Color(0x1AD4882B);
  static const Color mediaBg = Color(0x1AC03030);
  static const Color shadingBg = Color(0x1ACC8833);

  // Status colors
  static const Color success = Color(0xFF66BB6A);
  static const Color warning = Color(0xFFFF9800);
  static const Color warningBg = Color(0x1AFF9800);
  static const Color warningBorder = Color(0x40FF9800);
  static const Color info = Color(0xFF42A5F5);

  // Security dot
  static const Color secArmedAway = Color(0xFF5E9FE8);
  static const Color secArmedHome = Color(0xFFE85A4F);

  // Light theme
  static const Color bgLight = Color(0xFFF5F0EB);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color borderLight = Color(0x0F000000);
  static const Color textLight = Color(0xFF2C2C2C);
  static const Color textSecLight = Color(0xFF7A7572);
  static const Color textTerLight = Color(0xFFA09A94);

  // Dark theme
  static const Color bgDark = Color(0xFF141414);
  static const Color surfaceDark = Color(0xFF222222);
  static const Color borderDark = Color(0x14FFFFFF);
  static const Color textDark = Color(0xFFF0ECE6);
  static const Color textSecDark = Color(0xFF9A958F);
  static const Color textTerDark = Color(0xFF6A6560);

  // Sky gradients
  static const List<Color> skyDay = [
    Color(0xFF5EADD0),
    Color(0xFF7CC0DC),
    Color(0xFFA8D4E8),
    Color(0xFFC8DFEC),
  ];
  static const List<Color> skyNight = [
    Color(0xFF080E1C),
    Color(0xFF0C1830),
    Color(0xFF112244),
    Color(0xFF182850),
  ];

  // Border radii
  static const double radiusSm = 8.0;
  static const double radiusMd = 12.0;
  static const double radiusLg = 14.0;
  static const double radiusXl = 18.0;

  // Helpers
  static Color background(bool isDark) => isDark ? bgDark : bgLight;
  static Color surface(bool isDark) => isDark ? surfaceDark : surfaceLight;
  static Color border(bool isDark) => isDark ? borderDark : borderLight;
  static Color text(bool isDark) => isDark ? textDark : textLight;
  static Color textSec(bool isDark) => isDark ? textSecDark : textSecLight;
  static Color textTer(bool isDark) => isDark ? textTerDark : textTerLight;
  static List<Color> skyGradient(bool isDark) => isDark ? skyNight : skyDay;
  static Color securityDot(bool isDark) =>
      isDark ? secArmedHome : secArmedAway;
}

// =============================================================================
// MOCK DATA MODELS
// =============================================================================

enum DomainType { climate, lights, shading, media }

class DomainState {
  final DomainType type;
  final String title;
  final String primaryValue;
  final String? targetValue;
  final String subtitle;
  final bool isActive;
  final List<QuickAction> actions;
  final IconData icon;
  final Color color;

  const DomainState({
    required this.type,
    required this.title,
    required this.primaryValue,
    this.targetValue,
    required this.subtitle,
    this.isActive = false,
    required this.actions,
    required this.icon,
    required this.color,
  });
}

class QuickAction {
  final String label;
  final bool isActive;
  final VoidCallback? onTap;

  const QuickAction({
    required this.label,
    this.isActive = false,
    this.onTap,
  });
}

class SceneData {
  final String emoji;
  final String name;
  final bool isActive;

  const SceneData({
    required this.emoji,
    required this.name,
    this.isActive = false,
  });
}

class SensorData {
  final String emoji;
  final String label;
  final String value;
  final Color color;

  const SensorData({
    required this.emoji,
    required this.label,
    required this.value,
    required this.color,
  });
}

class WeatherData {
  final String emoji;
  final String temp;
  final String description;
  final String location;

  const WeatherData({
    required this.emoji,
    required this.temp,
    required this.description,
    required this.location,
  });
}

class RoomStatus {
  final bool systemOk;
  final String securityLabel;
  final Color securityDotColor;

  const RoomStatus({
    required this.systemOk,
    required this.securityLabel,
    required this.securityDotColor,
  });
}

class AnomalyAlert {
  final String emoji;
  final String message;

  const AnomalyAlert({required this.emoji, required this.message});
}

// =============================================================================
// MOCK DATA — LIGHT (DAY) STATE
// =============================================================================

class MockDayData {
  static const time = '14:23';
  static const date = 'Wednesday, 15 January';

  static const weather = WeatherData(
    emoji: '☀️',
    temp: '18°C',
    description: 'Partly cloudy',
    location: 'Ostrava',
  );

  static const status = RoomStatus(
    systemOk: true,
    securityLabel: 'Armed away',
    securityDotColor: DeckHomeTheme.secArmedAway,
  );

  static const anomaly = AnomalyAlert(
    emoji: '⚡',
    message: 'High energy usage — 4.2 kWh',
  );

  static const scenes = [
    SceneData(emoji: '☀️', name: 'Morning'),
    SceneData(emoji: '🏠', name: 'At Home', isActive: true),
    SceneData(emoji: '🌙', name: 'Night'),
    SceneData(emoji: '🎬', name: 'Movie'),
    SceneData(emoji: '🚪', name: 'Away'),
  ];

  static const sensors = [
    SensorData(
        emoji: '🌡', label: 'Temp', value: '22.1°C', color: DeckHomeTheme.climate),
    SensorData(
        emoji: '💧', label: 'Humidity', value: '48%', color: Color(0xFF508CC8)),
    SensorData(
        emoji: '🌬', label: 'Air', value: 'Good', color: Color(0xFF4A9A4A)),
    SensorData(
        emoji: '👤', label: 'Motion', value: 'Motion', color: Color(0xFFA08040)),
  ];

  static const domains = [
    DomainState(
      type: DomainType.climate,
      title: 'Climate',
      primaryValue: '20.3°',
      targetValue: '22°',
      subtitle: 'Heating · 💧 48%',
      isActive: true,
      icon: Icons.thermostat_rounded,
      color: DeckHomeTheme.climate,
      actions: [
        QuickAction(label: '−'),
        QuickAction(label: '+'),
        QuickAction(label: 'Heat', isActive: true),
      ],
    ),
    DomainState(
      type: DomainType.lights,
      title: 'Lights',
      primaryValue: '3 on',
      subtitle: 'Ceiling 80% · Accent 45% · Lamp 60%',
      isActive: true,
      icon: Icons.lightbulb_rounded,
      color: DeckHomeTheme.lights,
      actions: [
        QuickAction(label: 'All Off'),
        QuickAction(label: '50%'),
        QuickAction(label: '100%', isActive: true),
      ],
    ),
    DomainState(
      type: DomainType.shading,
      title: 'Shading',
      primaryValue: '40%',
      subtitle: 'Blinds partially open',
      isActive: true,
      icon: Icons.blinds_rounded,
      color: DeckHomeTheme.shading,
      actions: [
        QuickAction(label: 'Open'),
        QuickAction(label: 'Close'),
        QuickAction(label: '50%', isActive: true),
      ],
    ),
  ];

  // Media is special — shown separately with equalizer
  static const mediaTitle = 'Bohemian Rhapsody';
  static const mediaArtist = 'Queen';
  static const mediaIsPlaying = true;
  static const mediaIsTV = false;
}

// =============================================================================
// MOCK DATA — DARK (NIGHT) STATE
// =============================================================================

class MockNightData {
  static const time = '21:47';
  static const date = 'Wednesday, 15 January';

  static const weather = WeatherData(
    emoji: '🌙',
    temp: '2°C',
    description: 'Clear night',
    location: 'Ostrava',
  );

  static const status = RoomStatus(
    systemOk: true,
    securityLabel: 'Armed home',
    securityDotColor: DeckHomeTheme.secArmedHome,
  );

  static const scenes = [
    SceneData(emoji: '☀️', name: 'Morning'),
    SceneData(emoji: '🏠', name: 'At Home'),
    SceneData(emoji: '🌙', name: 'Night', isActive: true),
    SceneData(emoji: '🎬', name: 'Movie'),
    SceneData(emoji: '🚪', name: 'Away'),
  ];

  static const sensors = [
    SensorData(
        emoji: '🌡', label: 'Temp', value: '21.5°C', color: DeckHomeTheme.climate),
    SensorData(
        emoji: '💧', label: 'Humidity', value: '42%', color: Color(0xFF508CC8)),
    SensorData(
        emoji: '🌬', label: 'Air', value: 'Good', color: Color(0xFF4A9A4A)),
    SensorData(
        emoji: '👤', label: 'Motion', value: 'None', color: Color(0xFFA08040)),
  ];

  static const domains = [
    DomainState(
      type: DomainType.climate,
      title: 'Climate',
      primaryValue: '21.5°',
      subtitle: 'Idle · 💧 42%',
      isActive: false,
      icon: Icons.thermostat_rounded,
      color: DeckHomeTheme.climate,
      actions: [
        QuickAction(label: '−'),
        QuickAction(label: '+'),
        QuickAction(label: 'Heat'),
      ],
    ),
    DomainState(
      type: DomainType.lights,
      title: 'Lights',
      primaryValue: '2 on',
      subtitle: 'Ambient 25% · Reading 40%',
      isActive: true,
      icon: Icons.lightbulb_rounded,
      color: DeckHomeTheme.lights,
      actions: [
        QuickAction(label: 'All Off'),
        QuickAction(label: '25%', isActive: true),
        QuickAction(label: '100%'),
      ],
    ),
    DomainState(
      type: DomainType.shading,
      title: 'Shading',
      primaryValue: 'Closed',
      subtitle: 'Blinds fully closed',
      isActive: false,
      icon: Icons.blinds_rounded,
      color: DeckHomeTheme.shading,
      actions: [
        QuickAction(label: 'Open'),
        QuickAction(label: 'Close'),
        QuickAction(label: '50%'),
      ],
    ),
  ];

  // Media — TV instead of music
  static const mediaTitle = 'Samsung TV';
  static const mediaArtist = 'Netflix';
  static const mediaIsPlaying = true;
  static const mediaIsTV = true;
}

// =============================================================================
// MAIN SCREEN
// =============================================================================

class DeckHomeScreen extends StatefulWidget {
  const DeckHomeScreen({super.key});

  @override
  State<DeckHomeScreen> createState() => _DeckHomeScreenState();
}

class _DeckHomeScreenState extends State<DeckHomeScreen>
    with TickerProviderStateMixin {
  // Toggle dark mode for demo purposes
  bool _isDark = false;

  // Equalizer animation
  late final List<AnimationController> _eqControllers;

  @override
  void initState() {
    super.initState();
    _eqControllers = List.generate(4, (i) {
      final ctrl = AnimationController(
        vsync: this,
        duration: Duration(milliseconds: 500 + (i * 150)),
      )..repeat(reverse: true);
      return ctrl;
    });
  }

  @override
  void dispose() {
    for (final c in _eqControllers) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final isLandscape = mq.size.width > mq.size.height;

    return Scaffold(
      backgroundColor: DeckHomeTheme.background(_isDark),
      body: SafeArea(
        child: isLandscape
            ? _buildLandscape(mq.size)
            : _buildPortrait(mq.size),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LANDSCAPE LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildLandscape(Size size) {
    return Row(
      children: [
        // Sidebar nav (38px)
        _buildSidebar(),

        // Sky panel (44%)
        SizedBox(
          width: (size.width - 38) * 0.44,
          child: _buildSkyPanel(isPortrait: false),
        ),

        // Content panel (56%)
        Expanded(
          child: Container(
            color: DeckHomeTheme.background(_isDark),
            padding: const EdgeInsets.all(12),
            child: _buildContentPanel(isPortrait: false),
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PORTRAIT LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildPortrait(Size size) {
    return Column(
      children: [
        // Sky header (~200px)
        SizedBox(
          height: 200,
          child: _buildSkyPanel(isPortrait: true),
        ),

        // Content sheet slides over sky
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: DeckHomeTheme.background(_isDark),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(18)),
            ),
            transform: Matrix4.translationValues(0, -18, 0),
            padding: const EdgeInsets.fromLTRB(12, 14, 12, 0),
            child: _buildContentPanel(isPortrait: true),
          ),
        ),

        // Bottom nav
        _buildBottomNav(),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDEBAR (38px, landscape only)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildSidebar() {
    final items = [
      _NavItem(Icons.home_rounded, 'Home', isActive: true),
      _NavItem(Icons.thermostat_rounded, 'Climate'),
      _NavItem(Icons.lightbulb_rounded, 'Lights'),
      _NavItem(Icons.music_note_rounded, 'Media'),
      _NavItem(Icons.blinds_rounded, 'Shading'),
      _NavItem(Icons.sensors_rounded, 'Sensors'),
    ];

    return Container(
      width: 38,
      decoration: BoxDecoration(
        color: _isDark
            ? const Color(0xFF1A1A1A).withValues(alpha: 0.9)
            : Colors.white.withValues(alpha: 0.85),
        border: Border(
          right: BorderSide(
            color: DeckHomeTheme.border(_isDark),
          ),
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: 10),
          ...items.map((item) => _buildNavIcon(item)),
          const Spacer(),
          _buildNavIcon(
            _NavItem(Icons.settings_rounded, 'Settings'),
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }

  Widget _buildNavIcon(_NavItem item) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: GestureDetector(
        onTap: item.label == 'Home'
            ? () => setState(() => _isDark = !_isDark)
            : null,
        child: Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: item.isActive ? DeckHomeTheme.coralBg : Colors.transparent,
            borderRadius: BorderRadius.circular(7),
          ),
          child: Icon(
            item.icon,
            size: 15,
            color: item.isActive
                ? DeckHomeTheme.coral
                : DeckHomeTheme.textSec(_isDark),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOTTOM NAV (44px, portrait only)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildBottomNav() {
    final items = [
      _NavItem(Icons.home_rounded, 'Home', isActive: true),
      _NavItem(Icons.thermostat_rounded, 'Climate'),
      _NavItem(Icons.lightbulb_rounded, 'Lights'),
      _NavItem(Icons.music_note_rounded, 'Media'),
      _NavItem(Icons.blinds_rounded, 'Shading'),
      _NavItem(Icons.sensors_rounded, 'Sensors'),
    ];

    return GestureDetector(
      onTap: () => setState(() => _isDark = !_isDark),
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: _isDark
              ? const Color(0xFF1A1A1A).withValues(alpha: 0.95)
              : Colors.white.withValues(alpha: 0.92),
          border: Border(
            top: BorderSide(color: DeckHomeTheme.border(_isDark)),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: items.map((item) {
            final color = item.isActive
                ? DeckHomeTheme.coral
                : DeckHomeTheme.textTer(_isDark);
            return Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(item.icon, size: 16, color: color),
                const SizedBox(height: 2),
                Text(
                  item.label,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w500,
                    color: color,
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SKY PANEL
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildSkyPanel({required bool isPortrait}) {
    final timeStr = _isDark ? MockNightData.time : MockDayData.time;
    final dateStr = _isDark ? MockNightData.date : MockDayData.date;
    final weather = _isDark ? MockNightData.weather : MockDayData.weather;
    final status = _isDark ? MockNightData.status : MockDayData.status;
    final scenes = _isDark ? MockNightData.scenes : MockDayData.scenes;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: isPortrait ? Alignment.topCenter : Alignment.topLeft,
          end: isPortrait ? Alignment.bottomCenter : Alignment.bottomRight,
          colors: DeckHomeTheme.skyGradient(_isDark),
        ),
      ),
      child: Stack(
        children: [
          // Celestial body
          if (!_isDark)
            Positioned(
              top: isPortrait ? 16 : 30,
              right: isPortrait ? 32 : 48,
              child: const _SunWidget(size: 40),
            )
          else ...[
            Positioned(
              top: isPortrait ? 12 : 24,
              right: isPortrait ? 32 : 48,
              child: const _MoonWidget(size: 34),
            ),
            // Stars
            ..._buildStars(isPortrait),
          ],

          // Clouds (day only)
          if (!_isDark) ...[
            Positioned(
              top: isPortrait ? 20 : 80,
              left: isPortrait ? 10 : 40,
              child: _CloudWidget(width: 60, opacity: 0.35),
            ),
            Positioned(
              top: isPortrait ? 60 : 130,
              left: isPortrait ? 140 : 200,
              child: _CloudWidget(width: 45, opacity: 0.25),
            ),
          ],

          // Content
          Positioned.fill(
            child: Padding(
              padding: isPortrait
                  ? const EdgeInsets.symmetric(horizontal: 20, vertical: 16)
                  : const EdgeInsets.fromLTRB(24, 28, 24, 28),
              child: isPortrait
                  ? _buildSkyContentPortrait(
                      timeStr, dateStr, weather, status, scenes)
                  : _buildSkyContentLandscape(
                      timeStr, dateStr, weather, status, scenes),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildStars(bool isPortrait) {
    final rng = math.Random(42);
    return List.generate(12, (i) {
      return Positioned(
        top: rng.nextDouble() * (isPortrait ? 180 : 400),
        left: rng.nextDouble() * (isPortrait ? 360 : 340),
        child: _StarWidget(delay: Duration(milliseconds: (i * 300) % 3000)),
      );
    });
  }

  Widget _buildSkyContentLandscape(
    String time,
    String date,
    WeatherData weather,
    RoomStatus status,
    List<SceneData> scenes,
  ) {
    const skyText = Colors.white;
    final skyDim = Colors.white.withValues(alpha: _isDark ? 0.5 : 0.75);
    final skyMuted = Colors.white.withValues(alpha: _isDark ? 0.4 : 0.65);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Room name
        Text(
          'Living Room',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Colors.white.withValues(alpha: _isDark ? 0.5 : 0.8),
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 4),

        // Large time
        Text(
          time,
          style: TextStyle(
            fontSize: 64,
            fontWeight: FontWeight.w200,
            color: skyText.withValues(alpha: _isDark ? 0.9 : 1.0),
            height: 1.0,
            letterSpacing: -2,
          ),
        ),
        const SizedBox(height: 4),
        Text(date, style: TextStyle(fontSize: 12, color: skyDim)),

        const SizedBox(height: 16),

        // Weather glass card
        _GlassCard(
          isDark: _isDark,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(weather.emoji, style: const TextStyle(fontSize: 22)),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    weather.temp,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    '${weather.description} · ${weather.location}',
                    style: TextStyle(fontSize: 10, color: skyMuted),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Status pills
        Row(
          children: [
            _SkyPill(
              isDark: _isDark,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('✅', style: TextStyle(fontSize: 10)),
                  const SizedBox(width: 4),
                  Text(
                    'System OK',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: skyText.withValues(alpha: 0.85),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            _SkyPill(
              isDark: _isDark,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: status.securityDotColor,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    status.securityLabel,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: skyText.withValues(alpha: 0.85),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),

        const SizedBox(height: 12),

        // Scenes
        Wrap(
          spacing: 5,
          runSpacing: 5,
          children: scenes
              .map((s) => _ScenePill(scene: s, isDark: _isDark, onSky: true))
              .toList(),
        ),
      ],
    );
  }

  Widget _buildSkyContentPortrait(
    String time,
    String date,
    WeatherData weather,
    RoomStatus status,
    List<SceneData> scenes,
  ) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'Living Room',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: Colors.white.withValues(alpha: _isDark ? 0.45 : 0.8),
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          time,
          style: TextStyle(
            fontSize: 48,
            fontWeight: FontWeight.w200,
            color: Colors.white.withValues(alpha: _isDark ? 0.85 : 1.0),
            height: 1.0,
            letterSpacing: -1.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          date,
          style: TextStyle(
            fontSize: 11,
            color: Colors.white.withValues(alpha: _isDark ? 0.35 : 0.7),
          ),
        ),
        const SizedBox(height: 10),
        // Weather pill
        _GlassCard(
          isDark: _isDark,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(weather.emoji, style: const TextStyle(fontSize: 14)),
              const SizedBox(width: 6),
              Text(
                weather.temp,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                weather.description,
                style: TextStyle(
                  fontSize: 9,
                  color: Colors.white.withValues(alpha: 0.8),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT PANEL
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildContentPanel({required bool isPortrait}) {
    final domains = _isDark ? MockNightData.domains : MockDayData.domains;
    final sensors = _isDark ? MockNightData.sensors : MockDayData.sensors;
    final scenes = _isDark ? MockNightData.scenes : MockDayData.scenes;
    final status = _isDark ? MockNightData.status : MockDayData.status;
    final hasAnomaly = !_isDark; // Only show anomaly in light/day variant

    return Column(
      children: [
        // Status + scenes (portrait only, since landscape has them in sky)
        if (isPortrait) ...[
          // Status row
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _StatusPill(
                isDark: _isDark,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('✅', style: TextStyle(fontSize: 9)),
                    const SizedBox(width: 4),
                    Text(
                      'System OK',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: DeckHomeTheme.textSec(_isDark),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 5),
              _StatusPill(
                isDark: _isDark,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: status.securityDotColor,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      status.securityLabel,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: DeckHomeTheme.textSec(_isDark),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Scenes
          SizedBox(
            height: 26,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: scenes.length,
              separatorBuilder: (_, __) => const SizedBox(width: 4),
              itemBuilder: (_, i) => _ScenePill(
                scene: scenes[i],
                isDark: _isDark,
                onSky: false,
                fontSize: 9,
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],

        // Domain card grid
        Expanded(
          child: GridView.count(
            crossAxisCount: 2,
            childAspectRatio: isPortrait ? 0.95 : 1.25,
            mainAxisSpacing: isPortrait ? 7 : 8,
            crossAxisSpacing: isPortrait ? 7 : 8,
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              ...domains.map((d) => _DomainCard(domain: d, isDark: _isDark)),
              _MediaCard(
                isDark: _isDark,
                isPortrait: isPortrait,
                eqControllers: _eqControllers,
              ),
            ],
          ),
        ),

        // Anomaly alert
        if (hasAnomaly) ...[
          const SizedBox(height: 8),
          _AnomalyAlertWidget(
            alert: MockDayData.anomaly,
            isDark: _isDark,
          ),
        ],

        // Sensors
        const SizedBox(height: 8),
        _SensorStrip(sensors: sensors, isDark: _isDark),
      ],
    );
  }
}

// =============================================================================
// DOMAIN CARD
// =============================================================================

class _DomainCard extends StatelessWidget {
  final DomainState domain;
  final bool isDark;

  const _DomainCard({required this.domain, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: DeckHomeTheme.surface(isDark),
        borderRadius: BorderRadius.circular(DeckHomeTheme.radiusLg),
        border: Border.all(color: DeckHomeTheme.border(isDark)),
        // Active domain gets coral left border
      ),
      foregroundDecoration: domain.isActive
          ? BoxDecoration(
              borderRadius: BorderRadius.circular(DeckHomeTheme.radiusLg),
              border: const Border(
                left: BorderSide(color: DeckHomeTheme.coral, width: 3),
              ),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: icon + title + value
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: domain.color,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Icon(domain.icon, size: 14, color: Colors.white),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      domain.title,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: DeckHomeTheme.text(isDark),
                      ),
                    ),
                    Row(
                      children: [
                        Text(
                          domain.primaryValue,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: DeckHomeTheme.text(isDark),
                          ),
                        ),
                        if (domain.targetValue != null) ...[
                          const SizedBox(width: 4),
                          Text(
                            '→ ${domain.targetValue}',
                            style: TextStyle(
                              fontSize: 11,
                              color: DeckHomeTheme.textTer(isDark),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 4),

          // Subtitle
          Text(
            domain.subtitle,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: DeckHomeTheme.textSec(isDark),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),

          const Spacer(),

          // Actions
          Wrap(
            spacing: 4,
            runSpacing: 4,
            children: domain.actions.map((a) {
              return _ActionButton(action: a, isDark: isDark);
            }).toList(),
          ),
        ],
      ),
    );
  }
}

// =============================================================================
// MEDIA CARD (special — with equalizer)
// =============================================================================

class _MediaCard extends StatelessWidget {
  final bool isDark;
  final bool isPortrait;
  final List<AnimationController> eqControllers;

  const _MediaCard({
    required this.isDark,
    required this.isPortrait,
    required this.eqControllers,
  });

  @override
  Widget build(BuildContext context) {
    final isTV = isDark ? MockNightData.mediaIsTV : MockDayData.mediaIsTV;
    final title = isDark ? MockNightData.mediaTitle : MockDayData.mediaTitle;
    final artist = isDark ? MockNightData.mediaArtist : MockDayData.mediaArtist;
    final isPlaying =
        isDark ? MockNightData.mediaIsPlaying : MockDayData.mediaIsPlaying;

    final bg = isTV
        ? DeckHomeTheme.mediaBg
        : const Color(0x0FE85A4F); // coral tint for music

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: DeckHomeTheme.surface(isDark),
        borderRadius: BorderRadius.circular(DeckHomeTheme.radiusLg),
        border: Border.all(color: DeckHomeTheme.border(isDark)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            bg,
            bg.withValues(alpha: 0.02),
          ],
        ),
      ),
      foregroundDecoration: BoxDecoration(
        borderRadius: BorderRadius.circular(DeckHomeTheme.radiusLg),
        border: const Border(
          left: BorderSide(color: DeckHomeTheme.coral, width: 3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  gradient: isTV
                      ? null
                      : const LinearGradient(
                          colors: [Color(0xFFE85A4F), Color(0xFFD27030)],
                        ),
                  color: isTV ? DeckHomeTheme.media : null,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Icon(
                  isTV ? Icons.tv_rounded : Icons.music_note_rounded,
                  size: 14,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isTV ? 'Media' : 'Media',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: DeckHomeTheme.text(isDark),
                      ),
                    ),
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: DeckHomeTheme.text(isDark),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              // Equalizer (music only)
              if (!isTV && isPlaying)
                _EqualizerWidget(controllers: eqControllers),
            ],
          ),

          const SizedBox(height: 4),
          Text(
            '${artist} · Playing',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: DeckHomeTheme.textSec(isDark),
            ),
          ),

          const Spacer(),

          // Actions
          Wrap(
            spacing: 4,
            children: isTV
                ? [
                    _ActionButton(
                        action: const QuickAction(label: '⏸', isActive: true),
                        isDark: isDark),
                    _ActionButton(
                        action: const QuickAction(label: '🔇'),
                        isDark: isDark),
                    _ActionButton(
                        action: const QuickAction(label: 'Vol−'),
                        isDark: isDark),
                    _ActionButton(
                        action: const QuickAction(label: 'Vol+'),
                        isDark: isDark),
                  ]
                : [
                    _ActionButton(
                        action: const QuickAction(label: '⏮'),
                        isDark: isDark),
                    _ActionButton(
                        action: const QuickAction(label: '⏸', isActive: true),
                        isDark: isDark),
                    _ActionButton(
                        action: const QuickAction(label: '⏭'),
                        isDark: isDark),
                  ],
          ),
        ],
      ),
    );
  }
}

// =============================================================================
// EQUALIZER ANIMATION
// =============================================================================

class _EqualizerWidget extends StatelessWidget {
  final List<AnimationController> controllers;

  const _EqualizerWidget({required this.controllers});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 18,
      height: 16,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: controllers.map((ctrl) {
          return AnimatedBuilder(
            animation: ctrl,
            builder: (_, __) {
              return Container(
                width: 3,
                height: 4 + (ctrl.value * 12),
                margin: const EdgeInsets.only(right: 1),
                decoration: BoxDecoration(
                  color: DeckHomeTheme.coral,
                  borderRadius: BorderRadius.circular(1.5),
                ),
              );
            },
          );
        }).toList(),
      ),
    );
  }
}

// =============================================================================
// SKY ELEMENTS
// =============================================================================

class _SunWidget extends StatelessWidget {
  final double size;
  const _SunWidget({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(
          colors: [Color(0xFFFFE066), Color(0xFFFFD93D), Color(0x4DFFD93D)],
          stops: [0.3, 0.7, 1.0],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD93D).withValues(alpha: 0.5),
            blurRadius: 30,
            spreadRadius: 5,
          ),
          BoxShadow(
            color: const Color(0xFFFFD93D).withValues(alpha: 0.2),
            blurRadius: 60,
            spreadRadius: 10,
          ),
        ],
      ),
    );
  }
}

class _MoonWidget extends StatelessWidget {
  final double size;
  const _MoonWidget({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(
          center: Alignment(-0.3, -0.2),
          colors: [Color(0xFFE8E4D8), Color(0xFFD8D4C8), Color(0xFFC8C4B8)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFC8C8B4).withValues(alpha: 0.25),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
    );
  }
}

class _StarWidget extends StatefulWidget {
  final Duration delay;
  const _StarWidget({required this.delay});

  @override
  State<_StarWidget> createState() => _StarWidgetState();
}

class _StarWidgetState extends State<_StarWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );
    Future.delayed(widget.delay, () {
      if (mounted) _ctrl.repeat(reverse: true);
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Opacity(
        opacity: 0.3 + (_ctrl.value * 0.7),
        child: Container(
          width: 2,
          height: 2,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class _CloudWidget extends StatelessWidget {
  final double width;
  final double opacity;

  _CloudWidget({required this.width, required this.opacity});

  @override
  Widget build(BuildContext context) {
    final h = width * 0.35;
    return Opacity(
      opacity: opacity,
      child: SizedBox(
        width: width,
        height: h + 12,
        child: Stack(
          children: [
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                height: h,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(h / 2),
                ),
              ),
            ),
            Positioned(
              bottom: h * 0.4,
              left: width * 0.15,
              child: Container(
                width: width * 0.4,
                height: h * 0.8,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(h),
                ),
              ),
            ),
            Positioned(
              bottom: h * 0.3,
              left: width * 0.4,
              child: Container(
                width: width * 0.35,
                height: h * 0.65,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(h),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// =============================================================================
// GLASS / PILL COMPONENTS
// =============================================================================

class _GlassCard extends StatelessWidget {
  final bool isDark;
  final Widget child;
  final EdgeInsets? padding;

  const _GlassCard({
    required this.isDark,
    required this.child,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: padding ?? const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : Colors.white.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.12)
                  : Colors.white.withValues(alpha: 0.45),
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _SkyPill extends StatelessWidget {
  final bool isDark;
  final Widget child;

  const _SkyPill({required this.isDark, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.08)
            : Colors.white.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.1)
              : Colors.white.withValues(alpha: 0.35),
        ),
      ),
      child: child,
    );
  }
}

class _StatusPill extends StatelessWidget {
  final bool isDark;
  final Widget child;

  const _StatusPill({required this.isDark, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: DeckHomeTheme.border(isDark)),
      ),
      child: child,
    );
  }
}

// =============================================================================
// SCENE PILL
// =============================================================================

class _ScenePill extends StatelessWidget {
  final SceneData scene;
  final bool isDark;
  final bool onSky;
  final double fontSize;

  const _ScenePill({
    required this.scene,
    required this.isDark,
    this.onSky = false,
    this.fontSize = 10,
  });

  @override
  Widget build(BuildContext context) {
    if (scene.isActive) {
      return Container(
        padding: EdgeInsets.symmetric(horizontal: 12, vertical: fontSize < 10 ? 4 : 5),
        decoration: BoxDecoration(
          color: onSky
              ? DeckHomeTheme.coral.withValues(alpha: 0.85)
              : DeckHomeTheme.coral,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          '${scene.emoji} ${scene.name}',
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      );
    }

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: fontSize < 10 ? 4 : 5),
      decoration: BoxDecoration(
        color: onSky
            ? Colors.white.withValues(alpha: isDark ? 0.06 : 0.25)
            : (isDark
                ? Colors.white.withValues(alpha: 0.04)
                : Colors.black.withValues(alpha: 0.04)),
        borderRadius: BorderRadius.circular(8),
        border: onSky
            ? (isDark
                ? Border.all(color: Colors.white.withValues(alpha: 0.08))
                : null)
            : Border.all(color: DeckHomeTheme.border(isDark)),
      ),
      child: Text(
        '${scene.emoji} ${scene.name}',
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
          color: onSky
              ? Colors.white.withValues(alpha: isDark ? 0.5 : 0.9)
              : DeckHomeTheme.textSec(isDark),
        ),
      ),
    );
  }
}

// =============================================================================
// ACTION BUTTON
// =============================================================================

class _ActionButton extends StatelessWidget {
  final QuickAction action;
  final bool isDark;

  const _ActionButton({required this.action, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: action.onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: action.isActive ? DeckHomeTheme.coral : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
          border: action.isActive
              ? null
              : Border.all(color: DeckHomeTheme.border(isDark)),
        ),
        child: Text(
          action.label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: action.isActive
                ? Colors.white
                : DeckHomeTheme.textSec(isDark),
          ),
        ),
      ),
    );
  }
}

// =============================================================================
// ANOMALY ALERT
// =============================================================================

class _AnomalyAlertWidget extends StatelessWidget {
  final AnomalyAlert alert;
  final bool isDark;

  const _AnomalyAlertWidget({required this.alert, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: DeckHomeTheme.warningBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: DeckHomeTheme.warningBorder),
      ),
      child: Row(
        children: [
          Text(alert.emoji, style: const TextStyle(fontSize: 12)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              alert.message,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: isDark ? const Color(0xFFE8A832) : const Color(0xFFC47F17),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// =============================================================================
// SENSOR STRIP
// =============================================================================

class _SensorStrip extends StatelessWidget {
  final List<SensorData> sensors;
  final bool isDark;

  const _SensorStrip({required this.sensors, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: sensors.map((s) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: s.color.withValues(alpha: isDark ? 0.12 : 0.08),
            borderRadius: BorderRadius.circular(7),
            border: Border.all(
              color: s.color.withValues(alpha: isDark ? 0.18 : 0.15),
            ),
          ),
          child: Text(
            '${s.emoji} ${s.value}',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: isDark
                  ? s.color.withValues(alpha: 0.9)
                  : s.color,
            ),
          ),
        );
      }).toList(),
    );
  }
}

// =============================================================================
// NAV ITEM MODEL
// =============================================================================

class _NavItem {
  final IconData icon;
  final String label;
  final bool isActive;

  const _NavItem(this.icon, this.label, {this.isActive = false});
}

// =============================================================================
// PREVIEW APP (run this file standalone)
// =============================================================================

void main() {
  runApp(const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: DeckHomeScreen(),
  ));
}
