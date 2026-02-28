// =============================================================================
// WEATHER DETAIL SCREEN — SmartPanel
// =============================================================================
// Full weather view with shared sky background from dashboard.
// Reuses: SkyGradients, SkyConfig, DayPart, SkyCondition, and all sky
// element widgets (Sun, Moon, Stars, Clouds, Rain, Snow, Wind, Lightning, Fog).
//
// In production, extract sky components into a shared file imported by both
// deck_home_screen.dart and this file. For this demo, sky components are
// duplicated to keep the file self-contained.
//
// Layout:
//   Portrait  → sky header (280px) + scrollable content sheet (overlap -18px)
//   Landscape → sky left panel (44%) with hourly + content right (56%)
// =============================================================================

import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

// =============================================================================
// THEME (shared with dashboard)
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

  static const Color success = Color(0xFF66BB6A);
  static const Color warning = Color(0xFFFF9800);
  static const Color info = Color(0xFF42A5F5);

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

  static Color background(bool d) => d ? bgDark : bgLight;
  static Color surface(bool d) => d ? surfaceDark : surfaceLight;
  static Color border(bool d) => d ? borderDark : borderLight;
  static Color text(bool d) => d ? textDark : textLight;
  static Color textSec(bool d) => d ? textSecDark : textSecLight;
  static Color textTer(bool d) => d ? textTerDark : textTerLight;
}

// =============================================================================
// DAY PART + SKY CONDITION (shared)
// =============================================================================

enum DayPart { morning, noon, evening, night }
enum SkyCondition {
  clear, partlyCloudy, cloudy, overcast,
  rainy, heavyRain, stormy, snowy, windy, foggy,
}

DayPart dayPartFromHour(int h) {
  if (h >= 6 && h < 11) return DayPart.morning;
  if (h >= 11 && h < 17) return DayPart.noon;
  if (h >= 17 && h < 21) return DayPart.evening;
  return DayPart.night;
}

bool isDarkPart(DayPart p) => p == DayPart.night || p == DayPart.evening;

// =============================================================================
// SKY GRADIENTS (shared — 4 × 10 matrix)
// =============================================================================

class SkyGradients {
  SkyGradients._();

  static const _clearMorn = [Color(0xFFE8A060), Color(0xFFD4B878), Color(0xFF8CC4D8), Color(0xFF6BB5D8)];
  static const _partlyCloudyMorn = [Color(0xFFD4A070), Color(0xFFC8B488), Color(0xFF90BCD0), Color(0xFF78B0CC)];
  static const _cloudyMorn = [Color(0xFFB8A08C), Color(0xFFACAA98), Color(0xFF98B0B8), Color(0xFF8CA4B0)];
  static const _overcastMorn = [Color(0xFFA09890), Color(0xFF989498), Color(0xFF90989C), Color(0xFF8890A0)];
  static const _rainyMorn = [Color(0xFF807878), Color(0xFF788088), Color(0xFF708890), Color(0xFF688898)];
  static const _heavyRainMorn = [Color(0xFF686468), Color(0xFF607078), Color(0xFF587880), Color(0xFF507888)];
  static const _stormyMorn = [Color(0xFF504848), Color(0xFF485058), Color(0xFF405860), Color(0xFF386068)];
  static const _snowyMorn = [Color(0xFFC0B0A8), Color(0xFFB4B4B4), Color(0xFFA8BCC4), Color(0xFF9CB4C0)];
  static const _windyMorn = [Color(0xFFD4A478), Color(0xFFC0B490), Color(0xFF8CC0D0), Color(0xFF70B0CC)];
  static const _foggyMorn = [Color(0xFFBCB0A4), Color(0xFFB4ACA8), Color(0xFFACACB0), Color(0xFFA8A8AC)];

  static const _clearNoon = [Color(0xFF4A9FCC), Color(0xFF6BB5D8), Color(0xFF92CBE4), Color(0xFFC0DFF0)];
  static const _partlyCloudyNoon = [Color(0xFF5EADD0), Color(0xFF7CC0DC), Color(0xFFA8D4E8), Color(0xFFC8DFEC)];
  static const _cloudyNoon = [Color(0xFF7A9EAE), Color(0xFF93AEBB), Color(0xFFAABFC8), Color(0xFFC2D0D6)];
  static const _overcastNoon = [Color(0xFF7E8E96), Color(0xFF95A2A8), Color(0xFFAAB5BA), Color(0xFFC0C8CC)];
  static const _rainyNoon = [Color(0xFF5C7080), Color(0xFF6E8290), Color(0xFF8496A2), Color(0xFF9CACB6)];
  static const _heavyRainNoon = [Color(0xFF4A5C68), Color(0xFF5A6E7A), Color(0xFF6E828C), Color(0xFF8898A2)];
  static const _stormyNoon = [Color(0xFF2C3840), Color(0xFF3C4C56), Color(0xFF4E606A), Color(0xFF607480)];
  static const _snowyNoon = [Color(0xFF8CA8B8), Color(0xFFA0BAC6), Color(0xFFB8CCD6), Color(0xFFD0DEE4)];
  static const _windyNoon = [Color(0xFF5AA0C4), Color(0xFF72B4D0), Color(0xFF90C6DC), Color(0xFFB0D8E8)];
  static const _foggyNoon = [Color(0xFFA0ACB2), Color(0xFFB0BAC0), Color(0xFFC0C8CC), Color(0xFFD2D8DA)];

  static const _clearEve = [Color(0xFF1C2850), Color(0xFF5C3870), Color(0xFFC06848), Color(0xFFE8A040)];
  static const _partlyCloudyEve = [Color(0xFF242C4C), Color(0xFF583868), Color(0xFFB06850), Color(0xFFD89848)];
  static const _cloudyEve = [Color(0xFF2C3048), Color(0xFF4C3858), Color(0xFF886060), Color(0xFFB08058)];
  static const _overcastEve = [Color(0xFF303040), Color(0xFF44384C), Color(0xFF685858), Color(0xFF8C7060)];
  static const _rainyEve = [Color(0xFF1C2234), Color(0xFF342C40), Color(0xFF504848), Color(0xFF6C5C54)];
  static const _heavyRainEve = [Color(0xFF161C2C), Color(0xFF2C2838), Color(0xFF443C44), Color(0xFF584C4C)];
  static const _stormyEve = [Color(0xFF101420), Color(0xFF201C2C), Color(0xFF342C34), Color(0xFF443C40)];
  static const _snowyEve = [Color(0xFF283050), Color(0xFF4C3C64), Color(0xFF886878), Color(0xFFB09088)];
  static const _windyEve = [Color(0xFF202850), Color(0xFF543868), Color(0xFFB86850), Color(0xFFD89848)];
  static const _foggyEve = [Color(0xFF2C2C3C), Color(0xFF3C3844), Color(0xFF504C50), Color(0xFF686060)];

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

  static final _map = <DayPart, Map<SkyCondition, List<Color>>>{
    DayPart.morning: {
      SkyCondition.clear: _clearMorn, SkyCondition.partlyCloudy: _partlyCloudyMorn,
      SkyCondition.cloudy: _cloudyMorn, SkyCondition.overcast: _overcastMorn,
      SkyCondition.rainy: _rainyMorn, SkyCondition.heavyRain: _heavyRainMorn,
      SkyCondition.stormy: _stormyMorn, SkyCondition.snowy: _snowyMorn,
      SkyCondition.windy: _windyMorn, SkyCondition.foggy: _foggyMorn,
    },
    DayPart.noon: {
      SkyCondition.clear: _clearNoon, SkyCondition.partlyCloudy: _partlyCloudyNoon,
      SkyCondition.cloudy: _cloudyNoon, SkyCondition.overcast: _overcastNoon,
      SkyCondition.rainy: _rainyNoon, SkyCondition.heavyRain: _heavyRainNoon,
      SkyCondition.stormy: _stormyNoon, SkyCondition.snowy: _snowyNoon,
      SkyCondition.windy: _windyNoon, SkyCondition.foggy: _foggyNoon,
    },
    DayPart.evening: {
      SkyCondition.clear: _clearEve, SkyCondition.partlyCloudy: _partlyCloudyEve,
      SkyCondition.cloudy: _cloudyEve, SkyCondition.overcast: _overcastEve,
      SkyCondition.rainy: _rainyEve, SkyCondition.heavyRain: _heavyRainEve,
      SkyCondition.stormy: _stormyEve, SkyCondition.snowy: _snowyEve,
      SkyCondition.windy: _windyEve, SkyCondition.foggy: _foggyEve,
    },
    DayPart.night: {
      SkyCondition.clear: _clearNight, SkyCondition.partlyCloudy: _partlyCloudyNight,
      SkyCondition.cloudy: _cloudyNight, SkyCondition.overcast: _overcastNight,
      SkyCondition.rainy: _rainyNight, SkyCondition.heavyRain: _heavyRainNight,
      SkyCondition.stormy: _stormyNight, SkyCondition.snowy: _snowyNight,
      SkyCondition.windy: _windyNight, SkyCondition.foggy: _foggyNight,
    },
  };

  static List<Color> get(SkyCondition c, DayPart p) => _map[p]![c]!;
}

// =============================================================================
// SKY CONFIG (shared)
// =============================================================================

class SkyConfig {
  final bool showSun, showMoon, showStars;
  final int cloudCount;
  final double cloudOpacity, sunOpacity, starOpacity, sunPosition;
  final bool showRain, showSnow, showWind, showLightning, showFog;
  final int rainIntensity, snowIntensity;

  const SkyConfig({
    this.showSun = false, this.showMoon = false, this.showStars = false,
    this.cloudCount = 0, this.cloudOpacity = 0.3, this.sunOpacity = 1.0,
    this.starOpacity = 1.0, this.sunPosition = 0.5,
    this.showRain = false, this.rainIntensity = 0,
    this.showSnow = false, this.snowIntensity = 0,
    this.showWind = false, this.showLightning = false, this.showFog = false,
  });

  factory SkyConfig.resolve(SkyCondition condition, DayPart part) {
    final cel = _celestial(part);
    final wx = _weather(condition, part);
    return SkyConfig(
      showSun: cel.showSun && wx.sunOpacity > 0,
      showMoon: cel.showMoon, showStars: cel.showStars,
      sunOpacity: cel.sunOpacity * wx.sunOpacity,
      starOpacity: cel.starOpacity, sunPosition: cel.sunPosition,
      cloudCount: wx.cloudCount, cloudOpacity: wx.cloudOpacity,
      showRain: wx.showRain, rainIntensity: wx.rainIntensity,
      showSnow: wx.showSnow, snowIntensity: wx.snowIntensity,
      showWind: wx.showWind, showLightning: wx.showLightning, showFog: wx.showFog,
    );
  }

  static SkyConfig _celestial(DayPart p) {
    switch (p) {
      case DayPart.morning: return const SkyConfig(showSun: true, sunPosition: 0.15, sunOpacity: 0.9, showStars: true, starOpacity: 0.15);
      case DayPart.noon: return const SkyConfig(showSun: true, sunPosition: 0.5, sunOpacity: 1.0);
      case DayPart.evening: return const SkyConfig(showSun: true, sunPosition: 0.85, sunOpacity: 0.8, showStars: true, starOpacity: 0.3);
      case DayPart.night: return const SkyConfig(showMoon: true, showStars: true, starOpacity: 1.0);
    }
  }

  static SkyConfig _weather(SkyCondition c, DayPart part) {
    final isN = part == DayPart.night;
    final isD = part == DayPart.evening || part == DayPart.morning;
    final bco = isN ? 0.25 : (isD ? 0.35 : 0.4);
    switch (c) {
      case SkyCondition.clear: return const SkyConfig(sunOpacity: 1.0);
      case SkyCondition.partlyCloudy: return SkyConfig(cloudCount: 2, cloudOpacity: bco, sunOpacity: 0.9);
      case SkyCondition.cloudy: return SkyConfig(cloudCount: 4, cloudOpacity: bco + 0.15, sunOpacity: 0.5);
      case SkyCondition.overcast: return SkyConfig(cloudCount: 5, cloudOpacity: bco + 0.25, sunOpacity: 0.0);
      case SkyCondition.rainy: return SkyConfig(cloudCount: 4, cloudOpacity: bco + 0.15, showRain: true, rainIntensity: 40, sunOpacity: 0.0);
      case SkyCondition.heavyRain: return SkyConfig(cloudCount: 5, cloudOpacity: bco + 0.25, showRain: true, rainIntensity: 80, sunOpacity: 0.0);
      case SkyCondition.stormy: return SkyConfig(cloudCount: 5, cloudOpacity: bco + 0.3, showRain: true, rainIntensity: 80, showLightning: true, sunOpacity: 0.0);
      case SkyCondition.snowy: return SkyConfig(cloudCount: 3, cloudOpacity: bco + 0.1, showSnow: true, snowIntensity: 40, sunOpacity: 0.2);
      case SkyCondition.windy: return SkyConfig(cloudCount: 2, cloudOpacity: bco, showWind: true, sunOpacity: 1.0);
      case SkyCondition.foggy: return SkyConfig(cloudCount: 2, cloudOpacity: bco - 0.1, showFog: true, sunOpacity: 0.15);
    }
  }
}

// =============================================================================
// WEATHER DATA MODELS
// =============================================================================

class CurrentWeather {
  final double temp, feelsLike, windSpeed, windGust, pressure, humidity, dewPoint;
  final int uvIndex;
  final String condition, windDir, visibilityDesc, pressureTrend;
  final String emoji;
  final SkyCondition skyCondition;

  const CurrentWeather({
    required this.temp, required this.feelsLike, required this.windSpeed,
    this.windGust = 0, required this.pressure, required this.humidity,
    this.dewPoint = 0, this.uvIndex = 0, required this.condition,
    this.windDir = 'NW', this.visibilityDesc = '10 km', this.pressureTrend = '→',
    required this.emoji, required this.skyCondition,
  });
}

class HourlyForecast {
  final String time, emoji;
  final int temp;
  final bool isNow;

  const HourlyForecast({required this.time, required this.emoji, required this.temp, this.isNow = false});
}

class DailyForecast {
  final String day, date, emoji, condition;
  final int low, high, humidity;
  final bool isToday;

  const DailyForecast({
    required this.day, required this.date, required this.emoji,
    required this.condition, required this.low, required this.high,
    required this.humidity, this.isToday = false,
  });
}

class SunTimes {
  final String sunrise, sunset;
  const SunTimes({required this.sunrise, required this.sunset});
}

// =============================================================================
// MOCK DATA
// =============================================================================

class MockWeather {
  static const dayPart = DayPart.noon;

  static const current = CurrentWeather(
    temp: 8.4, feelsLike: 5.9, windSpeed: 4.1, windGust: 6.2,
    pressure: 1024, humidity: 67, dewPoint: 3, uvIndex: 2,
    condition: 'Clear Sky', windDir: 'NW', visibilityDesc: '10 km',
    pressureTrend: '↑', emoji: '☀️', skyCondition: SkyCondition.partlyCloudy,
  );

  static const currentNight = CurrentWeather(
    temp: 2.1, feelsLike: -1.2, windSpeed: 2.8, windGust: 4.1,
    pressure: 1022, humidity: 81, dewPoint: -1, uvIndex: 0,
    condition: 'Clear Night', windDir: 'N', visibilityDesc: '10 km',
    pressureTrend: '→', emoji: '🌙', skyCondition: SkyCondition.clear,
  );

  static const hourlyDay = [
    HourlyForecast(time: 'Now', emoji: '☀️', temp: 8, isNow: true),
    HourlyForecast(time: '17:00', emoji: '🌤️', temp: 7),
    HourlyForecast(time: '18:00', emoji: '🌤️', temp: 6),
    HourlyForecast(time: '19:00', emoji: '🌙', temp: 5),
    HourlyForecast(time: '20:00', emoji: '🌙', temp: 4),
    HourlyForecast(time: '21:00', emoji: '🌙', temp: 4),
    HourlyForecast(time: '22:00', emoji: '🌙', temp: 3),
    HourlyForecast(time: '23:00', emoji: '🌙', temp: 3),
  ];

  static const hourlyNight = [
    HourlyForecast(time: 'Now', emoji: '🌙', temp: 2, isNow: true),
    HourlyForecast(time: '23:00', emoji: '🌙', temp: 1),
    HourlyForecast(time: '00:00', emoji: '🌙', temp: 0),
    HourlyForecast(time: '01:00', emoji: '🌙', temp: 0),
    HourlyForecast(time: '02:00', emoji: '🌙', temp: -1),
    HourlyForecast(time: '03:00', emoji: '🌙', temp: -1),
    HourlyForecast(time: '04:00', emoji: '🌙', temp: -2),
    HourlyForecast(time: '05:00', emoji: '🌙', temp: -2),
  ];

  static const daily = [
    DailyForecast(day: 'Today', date: 'Feb 28', emoji: '☀️', condition: 'Clear', low: 5, high: 10, humidity: 63, isToday: true),
    DailyForecast(day: 'Sun', date: 'Mar 1', emoji: '☀️', condition: 'Clear', low: 4, high: 7, humidity: 81),
    DailyForecast(day: 'Mon', date: 'Mar 2', emoji: '☁️', condition: 'Clouds', low: 6, high: 10, humidity: 88),
    DailyForecast(day: 'Tue', date: 'Mar 3', emoji: '⛅', condition: 'Clouds', low: 6, high: 12, humidity: 82),
    DailyForecast(day: 'Wed', date: 'Mar 4', emoji: '☀️', condition: 'Clear', low: 6, high: 12, humidity: 82),
    DailyForecast(day: 'Thu', date: 'Mar 5', emoji: '☀️', condition: 'Clear', low: 6, high: 8, humidity: 86),
  ];

  static const sun = SunTimes(sunrise: '6:32', sunset: '17:48');
}

// =============================================================================
// MAIN SCREEN
// =============================================================================

class WeatherDetailScreen extends StatefulWidget {
  const WeatherDetailScreen({super.key});
  @override State<WeatherDetailScreen> createState() => _WeatherDetailScreenState();
}

class _WeatherDetailScreenState extends State<WeatherDetailScreen> {
  bool _isNight = false;

  DayPart get _dayPart => _isNight ? DayPart.night : MockWeather.dayPart;
  bool get _isDark => isDarkPart(_dayPart);
  CurrentWeather get _current => _isNight ? MockWeather.currentNight : MockWeather.current;
  List<HourlyForecast> get _hourly => _isNight ? MockWeather.hourlyNight : MockWeather.hourlyDay;

  void _toggle() => setState(() => _isNight = !_isNight);

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final isLandscape = mq.size.width > mq.size.height;
    return Scaffold(
      backgroundColor: DeckHomeTheme.background(_isDark),
      body: SafeArea(child: isLandscape ? _landscape(mq.size) : _portrait(mq.size)),
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PORTRAIT
  // ═════════════════════════════════════════════════════════════════════════

  Widget _portrait(Size size) {
    return Column(children: [
      SizedBox(height: 280, child: _skyHeader(isPortrait: true)),
      Expanded(child: Container(
        decoration: BoxDecoration(
          color: DeckHomeTheme.background(_isDark),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
        ),
        transform: Matrix4.translationValues(0, -18, 0),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
            child: _contentSheet(isPortrait: true),
          ),
        ),
      )),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // LANDSCAPE
  // ═════════════════════════════════════════════════════════════════════════

  Widget _landscape(Size size) {
    return Row(children: [
      SizedBox(width: size.width * 0.44, child: _skyHeader(isPortrait: false)),
      Expanded(child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
        child: _contentSheet(isPortrait: false),
      )),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SKY HEADER — shared sky background + weather overlay
  // ═════════════════════════════════════════════════════════════════════════

  Widget _skyHeader({required bool isPortrait}) {
    final weather = _current;
    final config = SkyConfig.resolve(weather.skyCondition, _dayPart);
    final gradient = SkyGradients.get(weather.skyCondition, _dayPart);

    return GestureDetector(
      onTap: _toggle,
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
          // ── Celestial ──
          if (config.showSun) _positionedSun(config, isPortrait),
          if (config.showMoon) Positioned(
            top: isPortrait ? 16 : 20, right: isPortrait ? 48 : 36,
            child: _MoonWidget(size: 34)),
          if (config.showStars) ..._buildStars(isPortrait, config.starOpacity),
          if (config.cloudCount > 0) ..._buildClouds(config, isPortrait),

          // ── Particles ──
          if (config.showRain) Positioned.fill(child: _RainOverlay(intensity: config.rainIntensity, isDark: _isDark)),
          if (config.showSnow) Positioned.fill(child: _SnowOverlay(intensity: config.snowIntensity, isDark: _isDark)),
          if (config.showWind) Positioned.fill(child: _WindOverlay(isDark: _isDark)),
          if (config.showLightning) const Positioned.fill(child: _LightningOverlay()),
          if (config.showFog) Positioned.fill(child: _FogOverlay(isDark: _isDark)),

          // ── Back button ──
          Positioned(top: 12, left: 12, child: _backButton()),

          // ── Weather content ──
          Positioned.fill(child: Padding(
            padding: isPortrait
                ? const EdgeInsets.fromLTRB(24, 48, 24, 24)
                : const EdgeInsets.fromLTRB(20, 48, 20, 16),
            child: Column(
              mainAxisAlignment: isPortrait ? MainAxisAlignment.center : MainAxisAlignment.start,
              children: [
                if (!isPortrait) const Spacer(flex: 1),
                _currentWeatherBlock(weather),
                if (!isPortrait) ...[
                  const SizedBox(height: 16),
                  _hourlyOnSky(),
                  const Spacer(flex: 1),
                ],
              ],
            ),
          )),

          // ── Demo label ──
          Positioned(bottom: isPortrait ? 4 : 6, right: 10, child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(6)),
            child: Text('Tap sky → toggle day/night', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.5))),
          )),
        ]),
      ),
    );
  }

  Widget _backButton() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          width: 32, height: 32,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
          ),
          child: Icon(Icons.arrow_back_rounded, size: 16, color: Colors.white.withValues(alpha: 0.9)),
        ),
      ),
    );
  }

  Widget _currentWeatherBlock(CurrentWeather w) {
    return Column(children: [
      Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${w.temp.toStringAsFixed(1)}',
            style: TextStyle(fontSize: 72, fontWeight: FontWeight.w200, color: Colors.white.withValues(alpha: _isDark ? 0.9 : 1.0), height: 1.0, letterSpacing: -3)),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('°C', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w300, color: Colors.white.withValues(alpha: 0.65))),
          ),
        ],
      ),
      const SizedBox(height: 4),
      Text(w.condition, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white.withValues(alpha: 0.8))),
      const SizedBox(height: 2),
      Text('Feels like ${w.feelsLike.toStringAsFixed(1)}°C',
        style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.5))),
      const SizedBox(height: 14),
      Wrap(spacing: 6, runSpacing: 6, alignment: WrapAlignment.center, children: [
        _skyPill('💨', '${w.windSpeed} m/s'),
        _skyPill('💧', '${w.humidity.toInt()}%'),
        _skyPill('🌡', '${w.pressure.toInt()} hPa'),
      ]),
    ]);
  }

  Widget _skyPill(String emoji, String text) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: _isDark ? 0.08 : 0.2),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.white.withValues(alpha: _isDark ? 0.1 : 0.25)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(emoji, style: const TextStyle(fontSize: 11)),
            const SizedBox(width: 4),
            Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.9))),
          ]),
        ),
      ),
    );
  }

  // Hourly strip on sky (landscape only)
  Widget _hourlyOnSky() {
    return SizedBox(height: 60, child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: _hourly.length,
      separatorBuilder: (_, __) => const SizedBox(width: 2),
      itemBuilder: (_, i) {
        final h = _hourly[i];
        return Container(
          width: 44,
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 3),
          decoration: BoxDecoration(
            color: h.isNow ? DeckHomeTheme.coral.withValues(alpha: 0.2) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: h.isNow ? Border.all(color: DeckHomeTheme.coral.withValues(alpha: 0.3)) : null,
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(h.time.length > 3 ? h.time.substring(0, 2) : h.time,
              style: TextStyle(fontSize: 9, fontWeight: h.isNow ? FontWeight.w700 : FontWeight.w600,
                color: h.isNow ? const Color(0xFFFFB4AE) : Colors.white.withValues(alpha: 0.6))),
            const SizedBox(height: 3),
            Text(h.emoji, style: const TextStyle(fontSize: 14)),
            const SizedBox(height: 3),
            Text('${h.temp}°', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
          ]),
        );
      },
    ));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CONTENT SHEET
  // ═════════════════════════════════════════════════════════════════════════

  Widget _contentSheet({required bool isPortrait}) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Hourly (portrait only — in landscape it's on the sky)
      if (isPortrait) ...[
        _sectionTitle('Hourly'),
        const SizedBox(height: 6),
        _hourlyRow(),
        const SizedBox(height: 16),
      ],

      // Daily
      _sectionTitle('7-Day Forecast'),
      const SizedBox(height: 6),
      ...MockWeather.daily.map((d) => Padding(
        padding: const EdgeInsets.only(bottom: 3),
        child: _dailyRow(d),
      )),

      // Sunrise / sunset
      const SizedBox(height: 14),
      _sunTimesCard(),

      // Detail grid
      const SizedBox(height: 14),
      _detailGrid(isPortrait),
    ]);
  }

  Widget _sectionTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(left: 2),
      child: Text(text.toUpperCase(),
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
          letterSpacing: 1.2, color: DeckHomeTheme.textTer(_isDark))),
    );
  }

  // ── Hourly row (portrait) ──

  Widget _hourlyRow() {
    return SizedBox(height: 72, child: ListView.builder(
      scrollDirection: Axis.horizontal,
      itemCount: _hourly.length,
      itemBuilder: (_, i) {
        final h = _hourly[i];
        return Container(
          width: 52,
          padding: const EdgeInsets.symmetric(vertical: 8),
          margin: EdgeInsets.only(right: i < _hourly.length - 1 ? 0 : 0),
          decoration: BoxDecoration(
            color: h.isNow ? DeckHomeTheme.coralBg : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: h.isNow ? Border.all(color: DeckHomeTheme.coralBorder) : null,
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(h.time, style: TextStyle(fontSize: 10,
              fontWeight: h.isNow ? FontWeight.w700 : FontWeight.w600,
              color: h.isNow ? DeckHomeTheme.coral : DeckHomeTheme.textSec(_isDark))),
            const SizedBox(height: 6),
            Text(h.emoji, style: const TextStyle(fontSize: 18)),
            const SizedBox(height: 6),
            Text('${h.temp}°', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: DeckHomeTheme.text(_isDark))),
          ]),
        );
      },
    ));
  }

  // ── Daily row ──

  Widget _dailyRow(DailyForecast d) {
    // Temp bar: scale to week's range
    const weekLow = -1;
    const weekHigh = 12;
    const range = weekHigh - weekLow;
    final barLeft = (d.low - weekLow) / range;
    final barWidth = (d.high - d.low) / range;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: DeckHomeTheme.surface(_isDark),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: DeckHomeTheme.border(_isDark)),
      ),
      foregroundDecoration: d.isToday ? BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: const Border(left: BorderSide(color: DeckHomeTheme.coral, width: 3)),
      ) : null,
      child: Row(children: [
        SizedBox(width: 50, child: Text(d.day,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: DeckHomeTheme.text(_isDark)))),
        SizedBox(width: 44, child: Text(d.date,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: DeckHomeTheme.textTer(_isDark)))),
        SizedBox(width: 26, child: Text(d.emoji, style: const TextStyle(fontSize: 18), textAlign: TextAlign.center)),
        Expanded(child: Text(d.condition,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: DeckHomeTheme.textSec(_isDark)))),
        // Temp range
        SizedBox(width: 28, child: Text('${d.low}°',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: DeckHomeTheme.textTer(_isDark)),
          textAlign: TextAlign.right)),
        const SizedBox(width: 6),
        SizedBox(width: 56, height: 4, child: ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: Stack(children: [
            Container(color: _isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.06)),
            FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: barLeft + barWidth,
              child: FractionallySizedBox(
                alignment: Alignment.centerRight,
                widthFactor: barWidth / (barLeft + barWidth),
                child: Container(
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [DeckHomeTheme.climate, DeckHomeTheme.coral]),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
          ]),
        )),
        const SizedBox(width: 6),
        SizedBox(width: 28, child: Text('${d.high}°',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: DeckHomeTheme.text(_isDark)))),
        const SizedBox(width: 8),
        SizedBox(width: 36, child: Text('💧 ${d.humidity}%',
          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600,
            color: _isDark ? const Color(0xFF508CC8).withValues(alpha: 0.7) : const Color(0xFF508CC8)),
          textAlign: TextAlign.right)),
      ]),
    );
  }

  // ── Sun times ──

  Widget _sunTimesCard() {
    const s = MockWeather.sun;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: DeckHomeTheme.surface(_isDark),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: DeckHomeTheme.border(_isDark)),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
        _sunTimeItem('🌅', 'Sunrise', s.sunrise),
        Container(width: 1, height: 28, color: DeckHomeTheme.border(_isDark)),
        _sunTimeItem('🌇', 'Sunset', s.sunset),
      ]),
    );
  }

  Widget _sunTimeItem(String emoji, String label, String value) {
    return Row(children: [
      Text(emoji, style: const TextStyle(fontSize: 18)),
      const SizedBox(width: 8),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
          letterSpacing: 0.5, color: DeckHomeTheme.textTer(_isDark))),
        Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: DeckHomeTheme.text(_isDark))),
      ]),
    ]);
  }

  // ── Detail grid ──

  Widget _detailGrid(bool isPortrait) {
    final w = _current;
    final cards = [
      _DetailCardData('Wind', '${w.windSpeed}', 'm/s', '${w.windDir} · Gusts ${w.windGust}'),
      _DetailCardData('Humidity', '${w.humidity.toInt()}', '%', 'Dew point ${w.dewPoint.toInt()}°C'),
      _DetailCardData('Pressure', '${w.pressure.toInt()}', 'hPa', '${w.pressureTrend == '↑' ? 'Rising' : w.pressureTrend == '↓' ? 'Falling' : 'Stable'} ${w.pressureTrend}'),
      if (_isNight)
        _DetailCardData('Visibility', w.visibilityDesc.split(' ').first, w.visibilityDesc.split(' ').last, 'Clear')
      else
        _DetailCardData('UV Index', '${w.uvIndex}', '', w.uvIndex <= 2 ? 'Low' : w.uvIndex <= 5 ? 'Moderate' : 'High'),
    ];

    return GridView.count(
      crossAxisCount: isPortrait ? 2 : 3,
      childAspectRatio: isPortrait ? 1.7 : 2.0,
      mainAxisSpacing: 6, crossAxisSpacing: 6,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: cards.map((c) => _detailCard(c)).toList(),
    );
  }

  Widget _detailCard(_DetailCardData c) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: DeckHomeTheme.surface(_isDark),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: DeckHomeTheme.border(_isDark)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(c.label.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
          letterSpacing: 0.8, color: DeckHomeTheme.textTer(_isDark))),
        const SizedBox(height: 4),
        Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
          Text(c.value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: DeckHomeTheme.text(_isDark))),
          if (c.unit.isNotEmpty) ...[
            const SizedBox(width: 2),
            Text(c.unit, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: DeckHomeTheme.textSec(_isDark))),
          ],
        ]),
        const SizedBox(height: 2),
        Text(c.subtitle, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: DeckHomeTheme.textSec(_isDark)),
          maxLines: 1, overflow: TextOverflow.ellipsis),
      ]),
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SKY ELEMENT HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  Widget _positionedSun(SkyConfig config, bool isPortrait) {
    final p = config.sunPosition;
    final sunTop = isPortrait
        ? 14.0 + (1.0 - math.sin(p * math.pi)) * 60.0
        : 12.0 + (1.0 - math.sin(p * math.pi)) * 80.0;
    final horizontalT = 1.0 - p;
    final maxW = isPortrait ? 320.0 : 260.0;
    final left = horizontalT * (maxW - 44);

    return Positioned(
      top: sunTop,
      left: isPortrait ? null : left,
      right: isPortrait ? left * 0.3 + 10 : null,
      child: _SunWidget(
        size: config.sunPosition == 0.5 ? 44 : 38,
        opacity: config.sunOpacity,
        isWarm: p < 0.25 || p > 0.75,
      ),
    );
  }

  List<Widget> _buildStars(bool isPortrait, double opacity) {
    final rng = math.Random(42);
    return List.generate(14, (i) => Positioned(
      top: rng.nextDouble() * (isPortrait ? 240 : 380),
      left: rng.nextDouble() * (isPortrait ? 380 : 320),
      child: _StarWidget(delay: Duration(milliseconds: (i * 300) % 3000), maxOpacity: opacity),
    ));
  }

  List<Widget> _buildClouds(SkyConfig config, bool isPortrait) {
    final rng = math.Random(7);
    final maxW = isPortrait ? 360.0 : 280.0;
    final maxH = isPortrait ? 200.0 : 340.0;
    return List.generate(config.cloudCount, (i) {
      final w = 40.0 + rng.nextDouble() * 50;
      return Positioned(
        top: 8 + rng.nextDouble() * (maxH * 0.5),
        left: rng.nextDouble() * (maxW - w),
        child: _CloudWidget(width: w, opacity: config.cloudOpacity * (0.7 + rng.nextDouble() * 0.3), isDark: _isDark),
      );
    });
  }
}

class _DetailCardData {
  final String label, value, unit, subtitle;
  const _DetailCardData(this.label, this.value, this.unit, this.subtitle);
}

// =============================================================================
// SKY ELEMENTS (shared — in production, import from shared file)
// =============================================================================

class _SunWidget extends StatelessWidget {
  final double size, opacity;
  final bool isWarm;
  const _SunWidget({required this.size, this.opacity = 1.0, this.isWarm = false});

  @override Widget build(BuildContext context) {
    final core = isWarm ? const Color(0xFFFFCC44) : const Color(0xFFFFE066);
    final glow = isWarm ? const Color(0xFFFFAA33) : const Color(0xFFFFD93D);
    return Opacity(opacity: opacity, child: Container(width: size, height: size,
      decoration: BoxDecoration(shape: BoxShape.circle,
        gradient: RadialGradient(colors: [core, glow, glow.withValues(alpha: 0.3)], stops: const [0.3, 0.7, 1.0]),
        boxShadow: [BoxShadow(color: glow.withValues(alpha: 0.5), blurRadius: 30, spreadRadius: 5),
          BoxShadow(color: glow.withValues(alpha: 0.2), blurRadius: 60, spreadRadius: 10)])));
  }
}

class _MoonWidget extends StatelessWidget {
  final double size;
  const _MoonWidget({required this.size});

  @override Widget build(BuildContext context) {
    return Container(width: size, height: size,
      decoration: BoxDecoration(shape: BoxShape.circle,
        gradient: const RadialGradient(center: Alignment(-0.3, -0.2), colors: [Color(0xFFE8E4D8), Color(0xFFD8D4C8), Color(0xFFC8C4B8)]),
        boxShadow: [BoxShadow(color: const Color(0xFFC8C8B4).withValues(alpha: 0.25), blurRadius: 20, spreadRadius: 2)]));
  }
}

class _StarWidget extends StatefulWidget {
  final Duration delay;
  final double maxOpacity;
  const _StarWidget({required this.delay, this.maxOpacity = 1.0});
  @override State<_StarWidget> createState() => _StarWidgetState();
}
class _StarWidgetState extends State<_StarWidget> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  @override void initState() { super.initState(); _c = AnimationController(vsync: this, duration: const Duration(seconds: 3));
    Future.delayed(widget.delay, () { if (mounted) _c.repeat(reverse: true); }); }
  @override void dispose() { _c.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => AnimatedBuilder(animation: _c, builder: (_, __) =>
    Opacity(opacity: (0.3 + _c.value * 0.7) * widget.maxOpacity, child: Container(width: 2, height: 2,
      decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white))));
}

class _CloudWidget extends StatelessWidget {
  final double width, opacity;
  final bool isDark;
  const _CloudWidget({required this.width, required this.opacity, this.isDark = false});

  @override Widget build(BuildContext context) {
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
// WEATHER PARTICLES (shared)
// =============================================================================

class _RainOverlay extends StatefulWidget {
  final int intensity; final bool isDark;
  const _RainOverlay({required this.intensity, required this.isDark});
  @override State<_RainOverlay> createState() => _RainOverlayState();
}
class _RainOverlayState extends State<_RainOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final List<_Pt> _d;
  @override void initState() { super.initState(); _c = AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat();
    final r = math.Random(11); _d = List.generate(widget.intensity, (_) => _Pt(r.nextDouble(), r.nextDouble(), 0.6 + r.nextDouble() * 0.8, 8 + r.nextDouble() * 16, 0.15 + r.nextDouble() * 0.35)); }
  @override void dispose() { _c.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => AnimatedBuilder(animation: _c, builder: (_, __) => CustomPaint(painter: _RPaint(_d, _c.value, widget.isDark), size: Size.infinite));
}
class _Pt { final double x, y, s, l, o; const _Pt(this.x, this.y, this.s, this.l, this.o); }
class _RPaint extends CustomPainter {
  final List<_Pt> d; final double t; final bool dk; _RPaint(this.d, this.t, this.dk);
  @override void paint(Canvas c, Size s) { for (final p in d) { final y = ((p.y + t * p.s) % 1.2) * s.height; final x = p.x * s.width;
    c.drawLine(Offset(x, y), Offset(x + p.l * 0.15, y + p.l), Paint()..color = (dk ? const Color(0xFF8899AA) : const Color(0xFFABBFD0)).withValues(alpha: p.o)..strokeWidth = 1.2..strokeCap = StrokeCap.round); }}
  @override bool shouldRepaint(covariant _RPaint o) => o.t != t;
}

class _SnowOverlay extends StatefulWidget {
  final int intensity; final bool isDark;
  const _SnowOverlay({required this.intensity, required this.isDark});
  @override State<_SnowOverlay> createState() => _SnowOverlayState();
}
class _SnowOverlayState extends State<_SnowOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final List<_Sf> _f;
  @override void initState() { super.initState(); _c = AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat();
    final r = math.Random(22); _f = List.generate(widget.intensity, (_) => _Sf(r.nextDouble(), r.nextDouble(), 0.15 + r.nextDouble() * 0.3, 1.5 + r.nextDouble() * 3, (r.nextDouble() - 0.5) * 0.08, 0.3 + r.nextDouble() * 0.5)); }
  @override void dispose() { _c.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => AnimatedBuilder(animation: _c, builder: (_, __) => CustomPaint(painter: _SPaint(_f, _c.value, widget.isDark), size: Size.infinite));
}
class _Sf { final double x, y, sp, sz, dr, o; const _Sf(this.x, this.y, this.sp, this.sz, this.dr, this.o); }
class _SPaint extends CustomPainter {
  final List<_Sf> f; final double t; final bool dk; _SPaint(this.f, this.t, this.dk);
  @override void paint(Canvas c, Size s) { for (final p in f) { final y = ((p.y + t * p.sp) % 1.1) * s.height;
    final sw = math.sin((t + p.x) * math.pi * 4) * 12; final x = (p.x * s.width + sw + t * p.dr * s.width) % s.width;
    c.drawCircle(Offset(x, y), p.sz, Paint()..color = (dk ? const Color(0xFFCCDDEE) : Colors.white).withValues(alpha: p.o)); }}
  @override bool shouldRepaint(covariant _SPaint o) => o.t != t;
}

class _WindOverlay extends StatefulWidget {
  final bool isDark; const _WindOverlay({required this.isDark});
  @override State<_WindOverlay> createState() => _WindOverlayState();
}
class _WindOverlayState extends State<_WindOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final List<_Ws> _s;
  @override void initState() { super.initState(); _c = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat();
    final r = math.Random(33); _s = List.generate(8, (_) => _Ws(r.nextDouble(), 0.4 + r.nextDouble() * 0.6, 30 + r.nextDouble() * 80, 0.08 + r.nextDouble() * 0.18, r.nextDouble())); }
  @override void dispose() { _c.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => AnimatedBuilder(animation: _c, builder: (_, __) => CustomPaint(painter: _WPaint(_s, _c.value, widget.isDark), size: Size.infinite));
}
class _Ws { final double y, sp, l, o, off; const _Ws(this.y, this.sp, this.l, this.o, this.off); }
class _WPaint extends CustomPainter {
  final List<_Ws> s; final double t; final bool dk; _WPaint(this.s, this.t, this.dk);
  @override void paint(Canvas c, Size sz) { for (final p in s) { final x = ((p.off + t * p.sp) % 1.3) * sz.width - p.l; final y = p.y * sz.height;
    c.drawLine(Offset(x, y), Offset(x + p.l, y - 2), Paint()..shader = LinearGradient(colors: [
      Colors.white.withValues(alpha: 0), Colors.white.withValues(alpha: p.o), Colors.white.withValues(alpha: 0)]).createShader(Rect.fromLTWH(x, y, p.l, 2))..strokeWidth = 1.5..strokeCap = StrokeCap.round); }}
  @override bool shouldRepaint(covariant _WPaint o) => o.t != t;
}

class _LightningOverlay extends StatefulWidget {
  const _LightningOverlay();
  @override State<_LightningOverlay> createState() => _LightningOverlayState();
}
class _LightningOverlayState extends State<_LightningOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _c; double _f = 0;
  @override void initState() { super.initState(); _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 100));
    _c.addStatusListener((s) { if (s == AnimationStatus.completed) _c.reverse(); }); _schedule(); }
  void _schedule() { Future.delayed(Duration(milliseconds: 2000 + math.Random().nextInt(5000)), () {
    if (!mounted) return; setState(() => _f = 0.15 + math.Random().nextDouble() * 0.2); _c.forward(); _schedule(); }); }
  @override void dispose() { _c.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => AnimatedBuilder(animation: _c, builder: (_, __) =>
    IgnorePointer(child: Container(color: Colors.white.withValues(alpha: _c.value * _f))));
}

class _FogOverlay extends StatelessWidget {
  final bool isDark; const _FogOverlay({required this.isDark});
  @override Widget build(BuildContext context) {
    final c = isDark ? const Color(0xFF1A2028) : const Color(0xFFD0D4D8);
    return IgnorePointer(child: Container(decoration: BoxDecoration(gradient: LinearGradient(
      begin: Alignment.topCenter, end: Alignment.bottomCenter,
      colors: [c.withValues(alpha: 0), c.withValues(alpha: 0.3), c.withValues(alpha: 0.55), c.withValues(alpha: 0.7)],
      stops: const [0, 0.3, 0.6, 1]))));
  }
}

// =============================================================================
// PREVIEW APP
// =============================================================================

void main() {
  runApp(const MaterialApp(debugShowCheckedModeBanner: false, home: WeatherDetailScreen()));
}
