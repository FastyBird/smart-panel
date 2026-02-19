// =============================================================================
// DECK HOME / DASHBOARD — VARIANT A: SKY | CONTENT SPLIT
// =============================================================================
// Weather-aware sky system: gradients, particles, and celestial elements
// change dynamically based on weather condition + day/night.
//
// Supported conditions: clear, partlyCloudy, cloudy, overcast,
//                       rainy, heavyRain, stormy, snowy, windy, foggy
// =============================================================================

import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

// =============================================================================
// THEME
// =============================================================================

class DeckHomeTheme {
  DeckHomeTheme._();

  static const Color coral = Color(0xFFE85A4F);
  static const Color coralBg = Color(0x1AE85A4F);
  static const Color coralBorder = Color(0x40E85A4F);

  static const Color climate = Color(0xFF2AADCC);
  static const Color lights = Color(0xFFD4882B);
  static const Color media = Color(0xFFC03030);
  static const Color shading = Color(0xFFCC8833);

  static const Color climateBg = Color(0x1A2AADCC);
  static const Color lightsBg = Color(0x1AD4882B);
  static const Color mediaBg = Color(0x1AC03030);
  static const Color shadingBg = Color(0x1ACC8833);

  static const Color success = Color(0xFF66BB6A);
  static const Color warning = Color(0xFFFF9800);
  static const Color warningBg = Color(0x1AFF9800);
  static const Color warningBorder = Color(0x40FF9800);
  static const Color info = Color(0xFF42A5F5);

  static const Color secArmedAway = Color(0xFF5E9FE8);
  static const Color secArmedHome = Color(0xFFE85A4F);

  static const Color bgLight = Color(0xFFF5F0EB);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color borderLight = Color(0x0F000000);
  static const Color textLight = Color(0xFF2C2C2C);
  static const Color textSecLight = Color(0xFF7A7572);
  static const Color textTerLight = Color(0xFFA09A94);

  static const Color bgDark = Color(0xFF141414);
  static const Color surfaceDark = Color(0xFF222222);
  static const Color borderDark = Color(0x14FFFFFF);
  static const Color textDark = Color(0xFFF0ECE6);
  static const Color textSecDark = Color(0xFF9A958F);
  static const Color textTerDark = Color(0xFF6A6560);

  static const double radiusSm = 8.0;
  static const double radiusMd = 12.0;
  static const double radiusLg = 14.0;
  static const double radiusXl = 18.0;

  static Color background(bool isDark) => isDark ? bgDark : bgLight;
  static Color surface(bool isDark) => isDark ? surfaceDark : surfaceLight;
  static Color border(bool isDark) => isDark ? borderDark : borderLight;
  static Color text(bool isDark) => isDark ? textDark : textLight;
  static Color textSec(bool isDark) => isDark ? textSecDark : textSecLight;
  static Color textTer(bool isDark) => isDark ? textTerDark : textTerLight;
}

// =============================================================================
// SKY CONDITION + CONFIG
// =============================================================================

enum SkyCondition {
  clear, partlyCloudy, cloudy, overcast,
  rainy, heavyRain, stormy, snowy, windy, foggy,
}

class SkyGradients {
  SkyGradients._();

  static const _clearDay = [Color(0xFF4A9FCC), Color(0xFF6BB5D8), Color(0xFF92CBE4), Color(0xFFC0DFF0)];
  static const _partlyCloudyDay = [Color(0xFF5EADD0), Color(0xFF7CC0DC), Color(0xFFA8D4E8), Color(0xFFC8DFEC)];
  static const _cloudyDay = [Color(0xFF7A9EAE), Color(0xFF93AEBB), Color(0xFFAABFC8), Color(0xFFC2D0D6)];
  static const _overcastDay = [Color(0xFF7E8E96), Color(0xFF95A2A8), Color(0xFFAAB5BA), Color(0xFFC0C8CC)];
  static const _rainyDay = [Color(0xFF5C7080), Color(0xFF6E8290), Color(0xFF8496A2), Color(0xFF9CACB6)];
  static const _heavyRainDay = [Color(0xFF4A5C68), Color(0xFF5A6E7A), Color(0xFF6E828C), Color(0xFF8898A2)];
  static const _stormyDay = [Color(0xFF2C3840), Color(0xFF3C4C56), Color(0xFF4E606A), Color(0xFF607480)];
  static const _snowyDay = [Color(0xFF8CA8B8), Color(0xFFA0BAC6), Color(0xFFB8CCD6), Color(0xFFD0DEE4)];
  static const _windyDay = [Color(0xFF5AA0C4), Color(0xFF72B4D0), Color(0xFF90C6DC), Color(0xFFB0D8E8)];
  static const _foggyDay = [Color(0xFFA0ACB2), Color(0xFFB0BAC0), Color(0xFFC0C8CC), Color(0xFFD2D8DA)];

  static const _clearNight = [Color(0xFF060A14), Color(0xFF0A1428), Color(0xFF0E1E3C), Color(0xFF142850)];
  static const _partlyCloudyNight = [Color(0xFF080E1C), Color(0xFF0C1830), Color(0xFF112244), Color(0xFF182850)];
  static const _cloudyNight = [Color(0xFF0C1018), Color(0xFF141C28), Color(0xFF1C2838), Color(0xFF283444)];
  static const _overcastNight = [Color(0xFF101418), Color(0xFF181C22), Color(0xFF22282E), Color(0xFF2E3438)];
  static const _rainyNight = [Color(0xFF0A0E14), Color(0xFF101820), Color(0xFF18222C), Color(0xFF222E38)];
  static const _heavyRainNight = [Color(0xFF080A10), Color(0xFF0E1218), Color(0xFF141C24), Color(0xFF1C2630)];
  static const _stormyNight = [Color(0xFF06080C), Color(0xFF0A0E14), Color(0xFF10161E), Color(0xFF181E28)];
  static const _snowyNight = [Color(0xFF0E1620), Color(0xFF162030), Color(0xFF1E2C40), Color(0xFF283848)];
  static const _windyNight = [Color(0xFF080E1C), Color(0xFF0C1830), Color(0xFF102040), Color(0xFF162850)];
  static const _foggyNight = [Color(0xFF121618), Color(0xFF1A2024), Color(0xFF242A2E), Color(0xFF303638)];

  static List<Color> get(SkyCondition c, bool isNight) {
    final map = isNight ? _nightMap : _dayMap;
    return map[c]!;
  }

  static const _dayMap = {
    SkyCondition.clear: _clearDay, SkyCondition.partlyCloudy: _partlyCloudyDay,
    SkyCondition.cloudy: _cloudyDay, SkyCondition.overcast: _overcastDay,
    SkyCondition.rainy: _rainyDay, SkyCondition.heavyRain: _heavyRainDay,
    SkyCondition.stormy: _stormyDay, SkyCondition.snowy: _snowyDay,
    SkyCondition.windy: _windyDay, SkyCondition.foggy: _foggyDay,
  };
  static const _nightMap = {
    SkyCondition.clear: _clearNight, SkyCondition.partlyCloudy: _partlyCloudyNight,
    SkyCondition.cloudy: _cloudyNight, SkyCondition.overcast: _overcastNight,
    SkyCondition.rainy: _rainyNight, SkyCondition.heavyRain: _heavyRainNight,
    SkyCondition.stormy: _stormyNight, SkyCondition.snowy: _snowyNight,
    SkyCondition.windy: _windyNight, SkyCondition.foggy: _foggyNight,
  };
}

/// Visual element config per condition.
class SkyConfig {
  final bool showSun, showMoon, showStars;
  final int cloudCount;
  final double cloudOpacity;
  final double sunOpacity;
  final bool showRain, showSnow, showWind, showLightning, showFog;
  final int rainIntensity, snowIntensity;

  const SkyConfig({
    this.showSun = false, this.showMoon = false, this.showStars = false,
    this.cloudCount = 0, this.cloudOpacity = 0.3, this.sunOpacity = 1.0,
    this.showRain = false, this.rainIntensity = 0,
    this.showSnow = false, this.snowIntensity = 0,
    this.showWind = false, this.showLightning = false, this.showFog = false,
  });

  factory SkyConfig.fromCondition(SkyCondition c, bool isNight) {
    switch (c) {
      case SkyCondition.clear:
        return isNight
            ? const SkyConfig(showMoon: true, showStars: true)
            : const SkyConfig(showSun: true);
      case SkyCondition.partlyCloudy:
        return isNight
            ? const SkyConfig(showMoon: true, showStars: true, cloudCount: 2, cloudOpacity: 0.2)
            : const SkyConfig(showSun: true, cloudCount: 2, cloudOpacity: 0.35, sunOpacity: 0.9);
      case SkyCondition.cloudy:
        return isNight
            ? const SkyConfig(showMoon: true, cloudCount: 4, cloudOpacity: 0.3)
            : const SkyConfig(showSun: true, cloudCount: 4, cloudOpacity: 0.5, sunOpacity: 0.5);
      case SkyCondition.overcast:
        return isNight
            ? const SkyConfig(cloudCount: 5, cloudOpacity: 0.45)
            : const SkyConfig(cloudCount: 5, cloudOpacity: 0.6, sunOpacity: 0.0);
      case SkyCondition.rainy:
        return isNight
            ? const SkyConfig(cloudCount: 4, cloudOpacity: 0.35, showRain: true, rainIntensity: 40)
            : const SkyConfig(cloudCount: 4, cloudOpacity: 0.5, showRain: true, rainIntensity: 40);
      case SkyCondition.heavyRain:
        return isNight
            ? const SkyConfig(cloudCount: 5, cloudOpacity: 0.45, showRain: true, rainIntensity: 80)
            : const SkyConfig(cloudCount: 5, cloudOpacity: 0.6, showRain: true, rainIntensity: 80);
      case SkyCondition.stormy:
        return isNight
            ? const SkyConfig(cloudCount: 5, cloudOpacity: 0.5, showRain: true, rainIntensity: 80, showLightning: true)
            : const SkyConfig(cloudCount: 5, cloudOpacity: 0.65, showRain: true, rainIntensity: 80, showLightning: true);
      case SkyCondition.snowy:
        return isNight
            ? const SkyConfig(cloudCount: 3, cloudOpacity: 0.25, showSnow: true, snowIntensity: 40)
            : const SkyConfig(cloudCount: 3, cloudOpacity: 0.4, showSnow: true, snowIntensity: 40);
      case SkyCondition.windy:
        return isNight
            ? const SkyConfig(showMoon: true, showStars: true, cloudCount: 2, cloudOpacity: 0.2, showWind: true)
            : const SkyConfig(showSun: true, cloudCount: 2, cloudOpacity: 0.35, showWind: true);
      case SkyCondition.foggy:
        return isNight
            ? const SkyConfig(cloudCount: 2, cloudOpacity: 0.15, showFog: true)
            : const SkyConfig(cloudCount: 2, cloudOpacity: 0.25, showFog: true);
    }
  }
}

// =============================================================================
// DATA MODELS
// =============================================================================

enum DomainType { climate, lights, shading, media }

class DomainState {
  final DomainType type;
  final String title, primaryValue, subtitle;
  final String? targetValue;
  final bool isActive;
  final List<QuickAction> actions;
  final IconData icon;
  final Color color;
  const DomainState({required this.type, required this.title, required this.primaryValue,
    this.targetValue, required this.subtitle, this.isActive = false,
    required this.actions, required this.icon, required this.color});
}

class QuickAction {
  final String label;
  final bool isActive;
  final VoidCallback? onTap;
  const QuickAction({required this.label, this.isActive = false, this.onTap});
}

class SceneData {
  final String emoji, name;
  final bool isActive;
  const SceneData({required this.emoji, required this.name, this.isActive = false});
}

class SensorData {
  final String emoji, label, value;
  final Color color;
  const SensorData({required this.emoji, required this.label, required this.value, required this.color});
}

class WeatherData {
  final String emoji, temp, description, location;
  final SkyCondition condition;
  const WeatherData({required this.emoji, required this.temp, required this.description,
    required this.location, required this.condition});
}

class RoomStatus {
  final bool systemOk;
  final String securityLabel;
  final Color securityDotColor;
  const RoomStatus({required this.systemOk, required this.securityLabel, required this.securityDotColor});
}

class AnomalyAlert {
  final String emoji, message;
  const AnomalyAlert({required this.emoji, required this.message});
}

// =============================================================================
// MOCK DATA
// =============================================================================

class MockDayData {
  static const time = '14:23';
  static const date = 'Wednesday, 15 January';
  static const weather = WeatherData(emoji: '☀️', temp: '18°C', description: 'Partly cloudy', location: 'Ostrava', condition: SkyCondition.partlyCloudy);
  static const status = RoomStatus(systemOk: true, securityLabel: 'Armed away', securityDotColor: DeckHomeTheme.secArmedAway);
  static const anomaly = AnomalyAlert(emoji: '⚡', message: 'High energy usage — 4.2 kWh');
  static const scenes = [
    SceneData(emoji: '☀️', name: 'Morning'),
    SceneData(emoji: '🏠', name: 'At Home', isActive: true),
    SceneData(emoji: '🌙', name: 'Night'),
    SceneData(emoji: '🎬', name: 'Movie'),
    SceneData(emoji: '🚪', name: 'Away'),
  ];
  static const sensors = [
    SensorData(emoji: '🌡', label: 'Temp', value: '22.1°C', color: DeckHomeTheme.climate),
    SensorData(emoji: '💧', label: 'Humidity', value: '48%', color: Color(0xFF508CC8)),
    SensorData(emoji: '🌬', label: 'Air', value: 'Good', color: Color(0xFF4A9A4A)),
    SensorData(emoji: '👤', label: 'Motion', value: 'Motion', color: Color(0xFFA08040)),
  ];
  static const domains = [
    DomainState(type: DomainType.climate, title: 'Climate', primaryValue: '20.3°', targetValue: '22°',
      subtitle: 'Heating · 💧 48%', isActive: true, icon: Icons.thermostat_rounded, color: DeckHomeTheme.climate,
      actions: [QuickAction(label: '−'), QuickAction(label: '+'), QuickAction(label: 'Heat', isActive: true)]),
    DomainState(type: DomainType.lights, title: 'Lights', primaryValue: '3 on',
      subtitle: 'Ceiling 80% · Accent 45% · Lamp 60%', isActive: true, icon: Icons.lightbulb_rounded, color: DeckHomeTheme.lights,
      actions: [QuickAction(label: 'All Off'), QuickAction(label: '50%'), QuickAction(label: '100%', isActive: true)]),
    DomainState(type: DomainType.shading, title: 'Shading', primaryValue: '40%',
      subtitle: 'Blinds partially open', isActive: true, icon: Icons.blinds_rounded, color: DeckHomeTheme.shading,
      actions: [QuickAction(label: 'Open'), QuickAction(label: 'Close'), QuickAction(label: '50%', isActive: true)]),
  ];
  static const mediaTitle = 'Bohemian Rhapsody';
  static const mediaArtist = 'Queen';
  static const mediaIsPlaying = true;
  static const mediaIsTV = false;
}

class MockNightData {
  static const time = '21:47';
  static const date = 'Wednesday, 15 January';
  static const weather = WeatherData(emoji: '🌙', temp: '2°C', description: 'Clear night', location: 'Ostrava', condition: SkyCondition.clear);
  static const status = RoomStatus(systemOk: true, securityLabel: 'Armed home', securityDotColor: DeckHomeTheme.secArmedHome);
  static const scenes = [
    SceneData(emoji: '☀️', name: 'Morning'),
    SceneData(emoji: '🏠', name: 'At Home'),
    SceneData(emoji: '🌙', name: 'Night', isActive: true),
    SceneData(emoji: '🎬', name: 'Movie'),
    SceneData(emoji: '🚪', name: 'Away'),
  ];
  static const sensors = [
    SensorData(emoji: '🌡', label: 'Temp', value: '21.5°C', color: DeckHomeTheme.climate),
    SensorData(emoji: '💧', label: 'Humidity', value: '42%', color: Color(0xFF508CC8)),
    SensorData(emoji: '🌬', label: 'Air', value: 'Good', color: Color(0xFF4A9A4A)),
    SensorData(emoji: '👤', label: 'Motion', value: 'None', color: Color(0xFFA08040)),
  ];
  static const domains = [
    DomainState(type: DomainType.climate, title: 'Climate', primaryValue: '21.5°',
      subtitle: 'Idle · 💧 42%', icon: Icons.thermostat_rounded, color: DeckHomeTheme.climate,
      actions: [QuickAction(label: '−'), QuickAction(label: '+'), QuickAction(label: 'Heat')]),
    DomainState(type: DomainType.lights, title: 'Lights', primaryValue: '2 on',
      subtitle: 'Ambient 25% · Reading 40%', isActive: true, icon: Icons.lightbulb_rounded, color: DeckHomeTheme.lights,
      actions: [QuickAction(label: 'All Off'), QuickAction(label: '25%', isActive: true), QuickAction(label: '100%')]),
    DomainState(type: DomainType.shading, title: 'Shading', primaryValue: 'Closed',
      subtitle: 'Blinds fully closed', icon: Icons.blinds_rounded, color: DeckHomeTheme.shading,
      actions: [QuickAction(label: 'Open'), QuickAction(label: 'Close'), QuickAction(label: '50%')]),
  ];
  static const mediaTitle = 'Samsung TV';
  static const mediaArtist = 'Netflix';
  static const mediaIsPlaying = true;
  static const mediaIsTV = true;
}

/// Demo weather presets — tap sky to cycle through all 10.
class WeatherPresets {
  static const all = [
    WeatherData(emoji: '☀️', temp: '24°C', description: 'Clear sky', location: 'Ostrava', condition: SkyCondition.clear),
    WeatherData(emoji: '⛅', temp: '18°C', description: 'Partly cloudy', location: 'Ostrava', condition: SkyCondition.partlyCloudy),
    WeatherData(emoji: '☁️', temp: '14°C', description: 'Cloudy', location: 'Ostrava', condition: SkyCondition.cloudy),
    WeatherData(emoji: '🌥️', temp: '10°C', description: 'Overcast', location: 'Ostrava', condition: SkyCondition.overcast),
    WeatherData(emoji: '🌧️', temp: '8°C', description: 'Light rain', location: 'Ostrava', condition: SkyCondition.rainy),
    WeatherData(emoji: '🌧️', temp: '6°C', description: 'Heavy rain', location: 'Ostrava', condition: SkyCondition.heavyRain),
    WeatherData(emoji: '⛈️', temp: '5°C', description: 'Thunderstorm', location: 'Ostrava', condition: SkyCondition.stormy),
    WeatherData(emoji: '❄️', temp: '-2°C', description: 'Snowfall', location: 'Ostrava', condition: SkyCondition.snowy),
    WeatherData(emoji: '💨', temp: '12°C', description: 'Windy', location: 'Ostrava', condition: SkyCondition.windy),
    WeatherData(emoji: '🌫️', temp: '4°C', description: 'Foggy', location: 'Ostrava', condition: SkyCondition.foggy),
  ];
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
  bool _isNight = false;
  int _weatherIndex = 1; // partly cloudy

  late final List<AnimationController> _eqControllers;

  WeatherData get _weather => WeatherPresets.all[_weatherIndex];

  @override
  void initState() {
    super.initState();
    _eqControllers = List.generate(4, (i) {
      return AnimationController(vsync: this, duration: Duration(milliseconds: 500 + (i * 150)))
        ..repeat(reverse: true);
    });
  }

  @override
  void dispose() {
    for (final c in _eqControllers) c.dispose();
    super.dispose();
  }

  void _cycleWeather() => setState(() => _weatherIndex = (_weatherIndex + 1) % WeatherPresets.all.length);
  void _toggleNight() => setState(() => _isNight = !_isNight);

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final isLandscape = mq.size.width > mq.size.height;
    return Scaffold(
      backgroundColor: DeckHomeTheme.background(_isNight),
      body: SafeArea(child: isLandscape ? _buildLandscape(mq.size) : _buildPortrait(mq.size)),
    );
  }

  // ── LANDSCAPE ──
  Widget _buildLandscape(Size size) {
    return Row(children: [
      _buildSidebar(),
      SizedBox(width: (size.width - 38) * 0.44, child: _buildSkyPanel(isPortrait: false)),
      Expanded(child: Container(
        color: DeckHomeTheme.background(_isNight),
        padding: const EdgeInsets.all(12),
        child: _buildContentPanel(isPortrait: false),
      )),
    ]);
  }

  // ── PORTRAIT ──
  Widget _buildPortrait(Size size) {
    return Column(children: [
      SizedBox(height: 200, child: _buildSkyPanel(isPortrait: true)),
      Expanded(child: Container(
        decoration: BoxDecoration(
          color: DeckHomeTheme.background(_isNight),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
        ),
        transform: Matrix4.translationValues(0, -18, 0),
        padding: const EdgeInsets.fromLTRB(12, 14, 12, 0),
        child: _buildContentPanel(isPortrait: true),
      )),
      _buildBottomNav(),
    ]);
  }

  // ── SIDEBAR 38px ──
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
        color: _isNight ? const Color(0xFF1A1A1A).withValues(alpha: 0.9) : Colors.white.withValues(alpha: 0.85),
        border: Border(right: BorderSide(color: DeckHomeTheme.border(_isNight))),
      ),
      child: Column(children: [
        const SizedBox(height: 10),
        ...items.map(_buildNavIcon),
        const Spacer(),
        _buildNavIcon(_NavItem(Icons.settings_rounded, 'Settings')),
        const SizedBox(height: 10),
      ]),
    );
  }

  Widget _buildNavIcon(_NavItem item) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: GestureDetector(
        onTap: item.label == 'Home' ? _toggleNight : null,
        child: Container(
          width: 28, height: 28,
          decoration: BoxDecoration(
            color: item.isActive ? DeckHomeTheme.coralBg : Colors.transparent,
            borderRadius: BorderRadius.circular(7),
          ),
          child: Icon(item.icon, size: 15,
            color: item.isActive ? DeckHomeTheme.coral : DeckHomeTheme.textSec(_isNight)),
        ),
      ),
    );
  }

  // ── BOTTOM NAV 44px ──
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
      onTap: _toggleNight,
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: _isNight ? const Color(0xFF1A1A1A).withValues(alpha: 0.95) : Colors.white.withValues(alpha: 0.92),
          border: Border(top: BorderSide(color: DeckHomeTheme.border(_isNight))),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: items.map((item) {
            final c = item.isActive ? DeckHomeTheme.coral : DeckHomeTheme.textTer(_isNight);
            return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(item.icon, size: 16, color: c),
              const SizedBox(height: 2),
              Text(item.label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w500, color: c)),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SKY PANEL — WEATHER AWARE
  // ═════════════════════════════════════════════════════════════════════════

  Widget _buildSkyPanel({required bool isPortrait}) {
    final timeStr = _isNight ? MockNightData.time : MockDayData.time;
    final dateStr = _isNight ? MockNightData.date : MockDayData.date;
    final weather = _weather;
    final status = _isNight ? MockNightData.status : MockDayData.status;
    final scenes = _isNight ? MockNightData.scenes : MockDayData.scenes;
    final config = SkyConfig.fromCondition(weather.condition, _isNight);
    final gradient = SkyGradients.get(weather.condition, _isNight);

    return GestureDetector(
      onTap: _cycleWeather,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 800),
        curve: Curves.easeInOut,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: isPortrait ? Alignment.topCenter : Alignment.topLeft,
            end: isPortrait ? Alignment.bottomCenter : Alignment.bottomRight,
            colors: gradient,
          ),
        ),
        child: Stack(children: [
          // ── Celestial bodies ──
          if (config.showSun)
            Positioned(
              top: isPortrait ? 16 : 30, right: isPortrait ? 32 : 48,
              child: _SunWidget(size: 40, opacity: config.sunOpacity),
            ),
          if (config.showMoon)
            Positioned(
              top: isPortrait ? 12 : 24, right: isPortrait ? 32 : 48,
              child: _MoonWidget(size: 34),
            ),

          // ── Stars ──
          if (config.showStars) ..._buildStars(isPortrait),

          // ── Clouds ──
          if (config.cloudCount > 0) ..._buildClouds(config, isPortrait),

          // ── Rain ──
          if (config.showRain) Positioned.fill(child: _RainOverlay(intensity: config.rainIntensity, isNight: _isNight)),

          // ── Snow ──
          if (config.showSnow) Positioned.fill(child: _SnowOverlay(intensity: config.snowIntensity, isNight: _isNight)),

          // ── Wind ──
          if (config.showWind) Positioned.fill(child: _WindOverlay(isNight: _isNight)),

          // ── Lightning ──
          if (config.showLightning) const Positioned.fill(child: _LightningOverlay()),

          // ── Fog ──
          if (config.showFog) Positioned.fill(child: _FogOverlay(isNight: _isNight)),

          // ── Content ──
          Positioned.fill(
            child: Padding(
              padding: isPortrait
                  ? const EdgeInsets.symmetric(horizontal: 20, vertical: 16)
                  : const EdgeInsets.fromLTRB(24, 28, 24, 28),
              child: isPortrait
                  ? _skyPortrait(timeStr, dateStr, weather, status, scenes)
                  : _skyLandscape(timeStr, dateStr, weather, status, scenes),
            ),
          ),

          // ── Demo label ──
          Positioned(
            bottom: isPortrait ? 4 : 8, right: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(6)),
              child: Text('Tap sky → ${weather.condition.name}',
                style: TextStyle(fontSize: 8, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.6))),
            ),
          ),
        ]),
      ),
    );
  }

  List<Widget> _buildStars(bool isPortrait) {
    final rng = math.Random(42);
    return List.generate(14, (i) => Positioned(
      top: rng.nextDouble() * (isPortrait ? 180 : 400),
      left: rng.nextDouble() * (isPortrait ? 360 : 340),
      child: _StarWidget(delay: Duration(milliseconds: (i * 300) % 3000)),
    ));
  }

  List<Widget> _buildClouds(SkyConfig config, bool isPortrait) {
    final rng = math.Random(7);
    final maxW = isPortrait ? 320.0 : 300.0;
    final maxH = isPortrait ? 160.0 : 380.0;
    return List.generate(config.cloudCount, (i) {
      final w = 40.0 + rng.nextDouble() * 50;
      return Positioned(
        top: 8 + rng.nextDouble() * (maxH * 0.6),
        left: rng.nextDouble() * (maxW - w),
        child: _CloudWidget(width: w, opacity: config.cloudOpacity * (0.7 + rng.nextDouble() * 0.3), isDark: _isNight),
      );
    });
  }

  // ── Sky text: landscape ──
  Widget _skyLandscape(String time, String date, WeatherData weather, RoomStatus status, List<SceneData> scenes) {
    final dim = Colors.white.withValues(alpha: _isNight ? 0.5 : 0.75);
    final muted = Colors.white.withValues(alpha: _isNight ? 0.4 : 0.65);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
      Text('Living Room', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: _isNight ? 0.5 : 0.8), letterSpacing: 1.5)),
      const SizedBox(height: 4),
      Text(time, style: TextStyle(fontSize: 64, fontWeight: FontWeight.w200, color: Colors.white.withValues(alpha: _isNight ? 0.9 : 1.0), height: 1.0, letterSpacing: -2)),
      const SizedBox(height: 4),
      Text(date, style: TextStyle(fontSize: 12, color: dim)),
      const SizedBox(height: 16),
      _GlassCard(isDark: _isNight, child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(weather.emoji, style: const TextStyle(fontSize: 22)),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(weather.temp, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
          Text('${weather.description} · ${weather.location}', style: TextStyle(fontSize: 10, color: muted)),
        ]),
      ])),
      const SizedBox(height: 12),
      Row(children: [
        _SkyPill(isDark: _isNight, child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Text('✅', style: TextStyle(fontSize: 10)), const SizedBox(width: 4),
          Text('System OK', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.85))),
        ])),
        const SizedBox(width: 6),
        _SkyPill(isDark: _isNight, child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: status.securityDotColor)),
          const SizedBox(width: 4),
          Text(status.securityLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.85))),
        ])),
      ]),
      const SizedBox(height: 12),
      Wrap(spacing: 5, runSpacing: 5, children: scenes.map((s) => _ScenePill(scene: s, isDark: _isNight, onSky: true)).toList()),
    ]);
  }

  // ── Sky text: portrait ──
  Widget _skyPortrait(String time, String date, WeatherData weather, RoomStatus status, List<SceneData> scenes) {
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Text('Living Room', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: _isNight ? 0.45 : 0.8), letterSpacing: 1.5)),
      const SizedBox(height: 2),
      Text(time, style: TextStyle(fontSize: 48, fontWeight: FontWeight.w200, color: Colors.white.withValues(alpha: _isNight ? 0.85 : 1.0), height: 1.0, letterSpacing: -1.5)),
      const SizedBox(height: 4),
      Text(date, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: _isNight ? 0.35 : 0.7))),
      const SizedBox(height: 10),
      _GlassCard(isDark: _isNight, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(weather.emoji, style: const TextStyle(fontSize: 14)),
        const SizedBox(width: 6),
        Text(weather.temp, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
        const SizedBox(width: 6),
        Text(weather.description, style: TextStyle(fontSize: 9, color: Colors.white.withValues(alpha: 0.8))),
      ])),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CONTENT PANEL
  // ═════════════════════════════════════════════════════════════════════════

  Widget _buildContentPanel({required bool isPortrait}) {
    final domains = _isNight ? MockNightData.domains : MockDayData.domains;
    final sensors = _isNight ? MockNightData.sensors : MockDayData.sensors;
    final scenes = _isNight ? MockNightData.scenes : MockDayData.scenes;
    final status = _isNight ? MockNightData.status : MockDayData.status;
    final hasAnomaly = !_isNight;

    return Column(children: [
      if (isPortrait) ...[
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _StatusPill(isDark: _isNight, child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Text('✅', style: TextStyle(fontSize: 9)), const SizedBox(width: 4),
            Text('System OK', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: DeckHomeTheme.textSec(_isNight))),
          ])),
          const SizedBox(width: 5),
          _StatusPill(isDark: _isNight, child: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 5, height: 5, decoration: BoxDecoration(shape: BoxShape.circle, color: status.securityDotColor)),
            const SizedBox(width: 4),
            Text(status.securityLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: DeckHomeTheme.textSec(_isNight))),
          ])),
        ]),
        const SizedBox(height: 8),
        SizedBox(height: 26, child: ListView.separated(
          scrollDirection: Axis.horizontal, itemCount: scenes.length,
          separatorBuilder: (_, __) => const SizedBox(width: 4),
          itemBuilder: (_, i) => _ScenePill(scene: scenes[i], isDark: _isNight, onSky: false, fontSize: 9),
        )),
        const SizedBox(height: 8),
      ],
      Expanded(child: GridView.count(
        crossAxisCount: 2,
        childAspectRatio: isPortrait ? 0.95 : 1.25,
        mainAxisSpacing: isPortrait ? 7 : 8, crossAxisSpacing: isPortrait ? 7 : 8,
        padding: EdgeInsets.zero, physics: const NeverScrollableScrollPhysics(),
        children: [
          ...domains.map((d) => _DomainCard(domain: d, isDark: _isNight)),
          _MediaCard(isDark: _isNight, isPortrait: isPortrait, eqControllers: _eqControllers),
        ],
      )),
      if (hasAnomaly) ...[const SizedBox(height: 8), _AnomalyAlertWidget(alert: MockDayData.anomaly, isDark: _isNight)],
      const SizedBox(height: 8),
      _SensorStrip(sensors: sensors, isDark: _isNight),
    ]);
  }
}

// =============================================================================
// WEATHER PARTICLES — RAIN
// =============================================================================

class _RainOverlay extends StatefulWidget {
  final int intensity;
  final bool isNight;
  const _RainOverlay({required this.intensity, required this.isNight});
  @override State<_RainOverlay> createState() => _RainOverlayState();
}

class _RainOverlayState extends State<_RainOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final List<_RainDrop> _drops;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat();
    final rng = math.Random(11);
    _drops = List.generate(widget.intensity, (_) => _RainDrop(
      x: rng.nextDouble(), y: rng.nextDouble(),
      speed: 0.6 + rng.nextDouble() * 0.8,
      length: 8 + rng.nextDouble() * 16,
      opacity: 0.15 + rng.nextDouble() * 0.35,
    ));
  }

  @override void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(animation: _ctrl, builder: (_, __) =>
      CustomPaint(painter: _RainPainter(_drops, _ctrl.value, widget.isNight), size: Size.infinite));
  }
}

class _RainDrop {
  final double x, y, speed, length, opacity;
  const _RainDrop({required this.x, required this.y, required this.speed, required this.length, required this.opacity});
}

class _RainPainter extends CustomPainter {
  final List<_RainDrop> drops;
  final double t;
  final bool isNight;
  _RainPainter(this.drops, this.t, this.isNight);

  @override
  void paint(Canvas canvas, Size size) {
    for (final d in drops) {
      final y = ((d.y + t * d.speed) % 1.2) * size.height;
      final x = d.x * size.width;
      final dx = d.length * 0.15;
      canvas.drawLine(Offset(x, y), Offset(x + dx, y + d.length),
        Paint()..color = (isNight ? const Color(0xFF8899AA) : const Color(0xFFABBFD0)).withValues(alpha: d.opacity)
          ..strokeWidth = 1.2 ..strokeCap = StrokeCap.round);
    }
  }

  @override bool shouldRepaint(covariant _RainPainter old) => old.t != t;
}

// =============================================================================
// WEATHER PARTICLES — SNOW
// =============================================================================

class _SnowOverlay extends StatefulWidget {
  final int intensity;
  final bool isNight;
  const _SnowOverlay({required this.intensity, required this.isNight});
  @override State<_SnowOverlay> createState() => _SnowOverlayState();
}

class _SnowOverlayState extends State<_SnowOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final List<_SnowFlake> _flakes;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat();
    final rng = math.Random(22);
    _flakes = List.generate(widget.intensity, (_) => _SnowFlake(
      x: rng.nextDouble(), y: rng.nextDouble(),
      speed: 0.15 + rng.nextDouble() * 0.3, size: 1.5 + rng.nextDouble() * 3,
      drift: (rng.nextDouble() - 0.5) * 0.08, opacity: 0.3 + rng.nextDouble() * 0.5,
    ));
  }

  @override void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(animation: _ctrl, builder: (_, __) =>
      CustomPaint(painter: _SnowPainter(_flakes, _ctrl.value, widget.isNight), size: Size.infinite));
  }
}

class _SnowFlake {
  final double x, y, speed, size, drift, opacity;
  const _SnowFlake({required this.x, required this.y, required this.speed, required this.size, required this.drift, required this.opacity});
}

class _SnowPainter extends CustomPainter {
  final List<_SnowFlake> flakes;
  final double t;
  final bool isNight;
  _SnowPainter(this.flakes, this.t, this.isNight);

  @override
  void paint(Canvas canvas, Size size) {
    for (final f in flakes) {
      final y = ((f.y + t * f.speed) % 1.1) * size.height;
      final sway = math.sin((t + f.x) * math.pi * 4) * 12;
      final x = (f.x * size.width + sway + (t * f.drift * size.width)) % size.width;
      canvas.drawCircle(Offset(x, y), f.size,
        Paint()..color = (isNight ? const Color(0xFFCCDDEE) : Colors.white).withValues(alpha: f.opacity));
    }
  }

  @override bool shouldRepaint(covariant _SnowPainter old) => old.t != t;
}

// =============================================================================
// WEATHER PARTICLES — WIND
// =============================================================================

class _WindOverlay extends StatefulWidget {
  final bool isNight;
  const _WindOverlay({required this.isNight});
  @override State<_WindOverlay> createState() => _WindOverlayState();
}

class _WindOverlayState extends State<_WindOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final List<_WindStreak> _streaks;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat();
    final rng = math.Random(33);
    _streaks = List.generate(8, (_) => _WindStreak(
      y: rng.nextDouble(), speed: 0.4 + rng.nextDouble() * 0.6,
      length: 30 + rng.nextDouble() * 80, opacity: 0.08 + rng.nextDouble() * 0.18,
      offset: rng.nextDouble(),
    ));
  }

  @override void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(animation: _ctrl, builder: (_, __) =>
      CustomPaint(painter: _WindPainter(_streaks, _ctrl.value, widget.isNight), size: Size.infinite));
  }
}

class _WindStreak {
  final double y, speed, length, opacity, offset;
  const _WindStreak({required this.y, required this.speed, required this.length, required this.opacity, required this.offset});
}

class _WindPainter extends CustomPainter {
  final List<_WindStreak> streaks;
  final double t;
  final bool isNight;
  _WindPainter(this.streaks, this.t, this.isNight);

  @override
  void paint(Canvas canvas, Size size) {
    for (final s in streaks) {
      final x = ((s.offset + t * s.speed) % 1.3) * size.width - s.length;
      final y = s.y * size.height;
      canvas.drawLine(Offset(x, y), Offset(x + s.length, y - 2),
        Paint()..shader = LinearGradient(colors: [
          Colors.white.withValues(alpha: 0), Colors.white.withValues(alpha: s.opacity), Colors.white.withValues(alpha: 0),
        ]).createShader(Rect.fromLTWH(x, y, s.length, 2))
          ..strokeWidth = 1.5 ..strokeCap = StrokeCap.round);
    }
  }

  @override bool shouldRepaint(covariant _WindPainter old) => old.t != t;
}

// =============================================================================
// WEATHER OVERLAYS — LIGHTNING
// =============================================================================

class _LightningOverlay extends StatefulWidget {
  const _LightningOverlay();
  @override State<_LightningOverlay> createState() => _LightningOverlayState();
}

class _LightningOverlayState extends State<_LightningOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  double _flashOpacity = 0;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 100));
    _ctrl.addStatusListener((s) { if (s == AnimationStatus.completed) _ctrl.reverse(); });
    _scheduleFlash();
  }

  void _scheduleFlash() {
    Future.delayed(Duration(milliseconds: 2000 + math.Random().nextInt(5000)), () {
      if (!mounted) return;
      setState(() => _flashOpacity = 0.15 + math.Random().nextDouble() * 0.2);
      _ctrl.forward();
      _scheduleFlash();
    });
  }

  @override void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(animation: _ctrl, builder: (_, __) =>
      IgnorePointer(child: Container(color: Colors.white.withValues(alpha: _ctrl.value * _flashOpacity))));
  }
}

// =============================================================================
// WEATHER OVERLAYS — FOG
// =============================================================================

class _FogOverlay extends StatelessWidget {
  final bool isNight;
  const _FogOverlay({required this.isNight});

  @override
  Widget build(BuildContext context) {
    final c = isNight ? const Color(0xFF1A2028) : const Color(0xFFD0D4D8);
    return IgnorePointer(child: Container(
      decoration: BoxDecoration(gradient: LinearGradient(
        begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [c.withValues(alpha: 0), c.withValues(alpha: 0.3), c.withValues(alpha: 0.55), c.withValues(alpha: 0.7)],
        stops: const [0, 0.3, 0.6, 1],
      )),
    ));
  }
}

// =============================================================================
// SKY ELEMENTS
// =============================================================================

class _SunWidget extends StatelessWidget {
  final double size;
  final double opacity;
  const _SunWidget({required this.size, this.opacity = 1.0});

  @override
  Widget build(BuildContext context) {
    return Opacity(opacity: opacity, child: Container(
      width: size, height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(colors: [Color(0xFFFFE066), Color(0xFFFFD93D), Color(0x4DFFD93D)], stops: [0.3, 0.7, 1.0]),
        boxShadow: [
          BoxShadow(color: const Color(0xFFFFD93D).withValues(alpha: 0.5), blurRadius: 30, spreadRadius: 5),
          BoxShadow(color: const Color(0xFFFFD93D).withValues(alpha: 0.2), blurRadius: 60, spreadRadius: 10),
        ],
      ),
    ));
  }
}

class _MoonWidget extends StatelessWidget {
  final double size;
  final double opacity;
  const _MoonWidget({required this.size, this.opacity = 1.0});

  @override
  Widget build(BuildContext context) {
    return Opacity(opacity: opacity, child: Container(
      width: size, height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(center: Alignment(-0.3, -0.2), colors: [Color(0xFFE8E4D8), Color(0xFFD8D4C8), Color(0xFFC8C4B8)]),
        boxShadow: [BoxShadow(color: const Color(0xFFC8C8B4).withValues(alpha: 0.25), blurRadius: 20, spreadRadius: 2)],
      ),
    ));
  }
}

class _StarWidget extends StatefulWidget {
  final Duration delay;
  const _StarWidget({required this.delay});
  @override State<_StarWidget> createState() => _StarWidgetState();
}

class _StarWidgetState extends State<_StarWidget> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 3));
    Future.delayed(widget.delay, () { if (mounted) _ctrl.repeat(reverse: true); });
  }

  @override void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(animation: _ctrl, builder: (_, __) =>
      Opacity(opacity: 0.3 + (_ctrl.value * 0.7), child: Container(
        width: 2, height: 2, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
      )));
  }
}

class _CloudWidget extends StatelessWidget {
  final double width, opacity;
  final bool isDark;
  const _CloudWidget({required this.width, required this.opacity, this.isDark = false});

  @override
  Widget build(BuildContext context) {
    final h = width * 0.35;
    final c = isDark ? Colors.white.withValues(alpha: opacity * 0.5) : Colors.white.withValues(alpha: opacity);
    return SizedBox(width: width, height: h + 12, child: Stack(children: [
      Positioned(bottom: 0, left: 0, right: 0, child: Container(height: h, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(h / 2)))),
      Positioned(bottom: h * 0.4, left: width * 0.15, child: Container(width: width * 0.4, height: h * 0.8, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(h)))),
      Positioned(bottom: h * 0.3, left: width * 0.4, child: Container(width: width * 0.35, height: h * 0.65, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(h)))),
    ]));
  }
}

// =============================================================================
// UI COMPONENTS
// =============================================================================

class _GlassCard extends StatelessWidget {
  final bool isDark;
  final Widget child;
  final EdgeInsets? padding;
  const _GlassCard({required this.isDark, required this.child, this.padding});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(borderRadius: BorderRadius.circular(12), child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
      child: Container(
        padding: padding ?? const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.12) : Colors.white.withValues(alpha: 0.45)),
        ),
        child: child,
      ),
    ));
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
        color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.white.withValues(alpha: 0.35)),
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
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: DeckHomeTheme.border(isDark)),
      ),
      child: child,
    );
  }
}

class _ScenePill extends StatelessWidget {
  final SceneData scene;
  final bool isDark, onSky;
  final double fontSize;
  const _ScenePill({required this.scene, required this.isDark, this.onSky = false, this.fontSize = 10});

  @override
  Widget build(BuildContext context) {
    if (scene.isActive) {
      return Container(
        padding: EdgeInsets.symmetric(horizontal: 12, vertical: fontSize < 10 ? 4 : 5),
        decoration: BoxDecoration(color: onSky ? DeckHomeTheme.coral.withValues(alpha: 0.85) : DeckHomeTheme.coral, borderRadius: BorderRadius.circular(8)),
        child: Text('${scene.emoji} ${scene.name}', style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w600, color: Colors.white)),
      );
    }
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: fontSize < 10 ? 4 : 5),
      decoration: BoxDecoration(
        color: onSky ? Colors.white.withValues(alpha: isDark ? 0.06 : 0.25) : (isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.04)),
        borderRadius: BorderRadius.circular(8),
        border: onSky ? (isDark ? Border.all(color: Colors.white.withValues(alpha: 0.08)) : null) : Border.all(color: DeckHomeTheme.border(isDark)),
      ),
      child: Text('${scene.emoji} ${scene.name}',
        style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w600,
          color: onSky ? Colors.white.withValues(alpha: isDark ? 0.5 : 0.9) : DeckHomeTheme.textSec(isDark))),
    );
  }
}

class _DomainCard extends StatelessWidget {
  final DomainState domain;
  final bool isDark;
  const _DomainCard({required this.domain, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: DeckHomeTheme.surface(isDark), borderRadius: BorderRadius.circular(DeckHomeTheme.radiusLg),
        border: Border.all(color: DeckHomeTheme.border(isDark)),
      ),
      foregroundDecoration: domain.isActive ? BoxDecoration(
        borderRadius: BorderRadius.circular(DeckHomeTheme.radiusLg),
        border: const Border(left: BorderSide(color: DeckHomeTheme.coral, width: 3)),
      ) : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 26, height: 26, decoration: BoxDecoration(color: domain.color, borderRadius: BorderRadius.circular(7)),
            child: Icon(domain.icon, size: 14, color: Colors.white)),
          const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(domain.title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: DeckHomeTheme.text(isDark))),
            Row(children: [
              Text(domain.primaryValue, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: DeckHomeTheme.text(isDark))),
              if (domain.targetValue != null) ...[const SizedBox(width: 4),
                Text('→ ${domain.targetValue}', style: TextStyle(fontSize: 11, color: DeckHomeTheme.textTer(isDark)))],
            ]),
          ])),
        ]),
        const SizedBox(height: 4),
        Text(domain.subtitle, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: DeckHomeTheme.textSec(isDark)), maxLines: 1, overflow: TextOverflow.ellipsis),
        const Spacer(),
        Wrap(spacing: 4, runSpacing: 4, children: domain.actions.map((a) => _ActionButton(action: a, isDark: isDark)).toList()),
      ]),
    );
  }
}

class _MediaCard extends StatelessWidget {
  final bool isDark, isPortrait;
  final List<AnimationController> eqControllers;
  const _MediaCard({required this.isDark, required this.isPortrait, required this.eqControllers});

  @override
  Widget build(BuildContext context) {
    final isTV = isDark ? MockNightData.mediaIsTV : MockDayData.mediaIsTV;
    final title = isDark ? MockNightData.mediaTitle : MockDayData.mediaTitle;
    final artist = isDark ? MockNightData.mediaArtist : MockDayData.mediaArtist;
    final playing = isDark ? MockNightData.mediaIsPlaying : MockDayData.mediaIsPlaying;
    final bg = isTV ? DeckHomeTheme.mediaBg : const Color(0x0FE85A4F);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: DeckHomeTheme.surface(isDark), borderRadius: BorderRadius.circular(DeckHomeTheme.radiusLg),
        border: Border.all(color: DeckHomeTheme.border(isDark)),
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [bg, bg.withValues(alpha: 0.02)]),
      ),
      foregroundDecoration: BoxDecoration(
        borderRadius: BorderRadius.circular(DeckHomeTheme.radiusLg),
        border: const Border(left: BorderSide(color: DeckHomeTheme.coral, width: 3)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 26, height: 26,
            decoration: BoxDecoration(
              gradient: isTV ? null : const LinearGradient(colors: [Color(0xFFE85A4F), Color(0xFFD27030)]),
              color: isTV ? DeckHomeTheme.media : null, borderRadius: BorderRadius.circular(7)),
            child: Icon(isTV ? Icons.tv_rounded : Icons.music_note_rounded, size: 14, color: Colors.white)),
          const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Media', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: DeckHomeTheme.text(isDark))),
            Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: DeckHomeTheme.text(isDark)), maxLines: 1, overflow: TextOverflow.ellipsis),
          ])),
          if (!isTV && playing) _EqualizerWidget(controllers: eqControllers),
        ]),
        const SizedBox(height: 4),
        Text('$artist · Playing', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: DeckHomeTheme.textSec(isDark))),
        const Spacer(),
        Wrap(spacing: 4, children: isTV
          ? [_ActionButton(action: const QuickAction(label: '⏸', isActive: true), isDark: isDark),
             _ActionButton(action: const QuickAction(label: '🔇'), isDark: isDark),
             _ActionButton(action: const QuickAction(label: 'Vol−'), isDark: isDark),
             _ActionButton(action: const QuickAction(label: 'Vol+'), isDark: isDark)]
          : [_ActionButton(action: const QuickAction(label: '⏮'), isDark: isDark),
             _ActionButton(action: const QuickAction(label: '⏸', isActive: true), isDark: isDark),
             _ActionButton(action: const QuickAction(label: '⏭'), isDark: isDark)]),
      ]),
    );
  }
}

class _EqualizerWidget extends StatelessWidget {
  final List<AnimationController> controllers;
  const _EqualizerWidget({required this.controllers});

  @override
  Widget build(BuildContext context) {
    return SizedBox(width: 18, height: 16, child: Row(crossAxisAlignment: CrossAxisAlignment.end,
      children: controllers.map((c) => AnimatedBuilder(animation: c, builder: (_, __) =>
        Container(width: 3, height: 4 + (c.value * 12), margin: const EdgeInsets.only(right: 1),
          decoration: BoxDecoration(color: DeckHomeTheme.coral, borderRadius: BorderRadius.circular(1.5))))).toList()));
  }
}

class _ActionButton extends StatelessWidget {
  final QuickAction action;
  final bool isDark;
  const _ActionButton({required this.action, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(onTap: action.onTap, child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: action.isActive ? DeckHomeTheme.coral : Colors.transparent,
        borderRadius: BorderRadius.circular(7),
        border: action.isActive ? null : Border.all(color: DeckHomeTheme.border(isDark)),
      ),
      child: Text(action.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
        color: action.isActive ? Colors.white : DeckHomeTheme.textSec(isDark))),
    ));
  }
}

class _AnomalyAlertWidget extends StatelessWidget {
  final AnomalyAlert alert;
  final bool isDark;
  const _AnomalyAlertWidget({required this.alert, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: DeckHomeTheme.warningBg, borderRadius: BorderRadius.circular(10),
        border: Border.all(color: DeckHomeTheme.warningBorder)),
      child: Row(children: [
        Text(alert.emoji, style: const TextStyle(fontSize: 12)),
        const SizedBox(width: 6),
        Expanded(child: Text(alert.message, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
          color: isDark ? const Color(0xFFE8A832) : const Color(0xFFC47F17)))),
      ]),
    );
  }
}

class _SensorStrip extends StatelessWidget {
  final List<SensorData> sensors;
  final bool isDark;
  const _SensorStrip({required this.sensors, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Wrap(spacing: 6, runSpacing: 4, children: sensors.map((s) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: s.color.withValues(alpha: isDark ? 0.12 : 0.08), borderRadius: BorderRadius.circular(7),
        border: Border.all(color: s.color.withValues(alpha: isDark ? 0.18 : 0.15)),
      ),
      child: Text('${s.emoji} ${s.value}', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600,
        color: isDark ? s.color.withValues(alpha: 0.9) : s.color)),
    )).toList());
  }
}

class _NavItem {
  final IconData icon;
  final String label;
  final bool isActive;
  const _NavItem(this.icon, this.label, {this.isActive = false});
}

// =============================================================================
// PREVIEW APP
// =============================================================================

void main() {
  runApp(const MaterialApp(debugShowCheckedModeBanner: false, home: DeckHomeScreen()));
}
