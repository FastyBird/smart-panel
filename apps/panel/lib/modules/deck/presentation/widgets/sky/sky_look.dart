import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The four day parts of the sky (docs/display-ui-design-spec.md §2, Sky).
enum SkyDayPart { morning, day, evening, night }

/// The ten conditions of the sky, each with its cover factor: how far the sky
/// mixes from its day part's clear gradient towards the overcast one.
enum SkyWeather {
  clear(0),
  partlyCloudy(0.25),
  cloudy(0.6),
  overcast(0.85),
  fog(0.7),
  drizzle(0.7),
  rain(0.85),
  thunderstorm(1),
  snow(0.6),
  sleet(0.75);

  const SkyWeather(this.cover);

  final double cover;

  /// Rain lines.
  bool get wet =>
      this == drizzle || this == rain || this == thunderstorm || this == sleet;

  /// Snow dots.
  bool get snowy => this == snow || this == sleet;
}

/// The sky's condition for an OpenWeatherMap condition code.
SkyWeather skyWeatherForCode(int code) {
  if (code >= 200 && code < 300) return SkyWeather.thunderstorm;
  if (code >= 300 && code < 400) return SkyWeather.drizzle;
  if (code == 511) return SkyWeather.sleet;
  if (code >= 500 && code < 600) return SkyWeather.rain;
  if (code >= 611 && code <= 616) return SkyWeather.sleet;
  if (code >= 600 && code < 700) return SkyWeather.snow;
  if (code == 771 || code == 781) return SkyWeather.thunderstorm;
  if (code >= 700 && code < 800) return SkyWeather.fog;
  if (code == 801 || code == 802) return SkyWeather.partlyCloudy;
  if (code == 803) return SkyWeather.cloudy;
  if (code == 804) return SkyWeather.overcast;

  return SkyWeather.clear;
}

/// The day part at [now]. With the day's [sunrise] and [sunset] the parts
/// follow the sun: morning is the first 30 % of the daylight, evening runs
/// from the last 20 % until an hour after sunset. Without them the clock
/// decides: morning 6–11, day 11–17, evening 17–21.
SkyDayPart skyDayPartAt(DateTime now, {DateTime? sunrise, DateTime? sunset}) {
  if (sunrise != null && sunset != null && sunset.isAfter(sunrise)) {
    if (now.isBefore(sunrise)) return SkyDayPart.night;

    final daylight = sunset.difference(sunrise);

    if (now.isBefore(sunrise.add(daylight * 0.3))) return SkyDayPart.morning;
    if (now.isBefore(sunset.subtract(daylight * 0.2))) return SkyDayPart.day;
    if (now.isBefore(sunset.add(const Duration(hours: 1)))) {
      return SkyDayPart.evening;
    }

    return SkyDayPart.night;
  }

  final hour = now.hour;

  if (hour >= 6 && hour < 11) return SkyDayPart.morning;
  if (hour >= 11 && hour < 17) return SkyDayPart.day;
  if (hour >= 17 && hour < 21) return SkyDayPart.evening;

  return SkyDayPart.night;
}

/// The weather card's icon for a condition.
IconData skyWeatherIcon(SkyWeather weather, SkyDayPart part) {
  final night = part == SkyDayPart.night;

  return switch (weather) {
    SkyWeather.clear => night ? MdiIcons.weatherNight : MdiIcons.weatherSunny,
    SkyWeather.partlyCloudy =>
      night ? MdiIcons.weatherNightPartlyCloudy : MdiIcons.weatherPartlyCloudy,
    SkyWeather.cloudy || SkyWeather.overcast => MdiIcons.weatherCloudy,
    SkyWeather.fog => MdiIcons.weatherFog,
    SkyWeather.drizzle || SkyWeather.rain => MdiIcons.weatherRainy,
    SkyWeather.thunderstorm => MdiIcons.weatherLightning,
    SkyWeather.snow => MdiIcons.weatherSnowy,
    SkyWeather.sleet => MdiIcons.weatherSnowyRainy,
  };
}

/// One of the forty skies (spec §2): the gradient and the text colour mixed
/// from the day part's clear and overcast values by the condition's cover
/// factor, and which flat layers sit on top.
///
/// - Sun or moon below a cover of 0.7.
/// - Stars at night below a cover of 0.5.
/// - One to three cloud bars as the cover grows; fog draws three bands
///   instead.
/// - One precipitation layer: rain lines or snow dots (sleet has both), and
///   a lightning mark in a thunderstorm.
@immutable
class SkyLook {
  const SkyLook._({
    required this.part,
    required this.weather,
    required this.stops,
    required this.text,
    required this.light,
    required this.glass,
    required this.glassLine,
  });

  factory SkyLook.of(SkyDayPart part, SkyWeather weather) {
    final palette = paletteOf(part);
    final cover = weather.cover;

    return SkyLook._(
      part: part,
      weather: weather,
      stops: [
        for (var i = 0; i < 3; i++)
          mix(palette.clear[i], palette.overcast[i], cover),
      ],
      text: mix(palette.text, palette.overcastText, cover),
      light: palette.light,
      glass: palette.glass,
      glassLine: palette.glassLine,
    );
  }

  static AppSkyPart paletteOf(SkyDayPart part) => switch (part) {
    SkyDayPart.morning => AppSkyColors.morning,
    SkyDayPart.day => AppSkyColors.day,
    SkyDayPart.evening => AppSkyColors.evening,
    SkyDayPart.night => AppSkyColors.night,
  };

  /// Mixes two opaque colours channel by channel, rounding each channel the
  /// way the design canvas does.
  static Color mix(Color a, Color b, double k) {
    int channel(double x, double y) =>
        (x * 255 * (1 - k) + y * 255 * k).round().clamp(0, 255);

    return Color.fromARGB(
      255,
      channel(a.r, b.r),
      channel(a.g, b.g),
      channel(a.b, b.b),
    );
  }

  /// Where the three stops sit, top to bottom.
  static const List<double> stopPositions = [0, 0.62, 1];

  final SkyDayPart part;
  final SkyWeather weather;

  /// Top, middle and bottom.
  final List<Color> stops;

  /// The clock, the date and the weather card's text.
  final Color text;

  /// Whether the sky is light (morning and day).
  final bool light;

  /// The weather card's and the scene pills' flat fill and outline.
  final Color glass;
  final Color glassLine;

  double get cover => weather.cover;

  bool get showSun => cover < 0.7 && part != SkyDayPart.night;
  bool get showMoon => cover < 0.7 && part == SkyDayPart.night;
  bool get showStars => cover < 0.5 && part == SkyDayPart.night;

  /// Cloud bars: none when clear or foggy, then one, two or three.
  int get cloudBars {
    if (weather == SkyWeather.fog || cover <= 0) return 0;
    if (cover < 0.5) return 1;
    if (cover < 0.8) return 2;

    return 3;
  }

  bool get fogBands => weather == SkyWeather.fog;
  bool get rainLines => weather.wet;
  bool get snowDots => weather.snowy;
  bool get lightning => weather == SkyWeather.thunderstorm;

  /// The space between rain lines: wider in drizzle, tighter in a storm.
  double get rainGap => switch (weather) {
    SkyWeather.drizzle => 16,
    SkyWeather.thunderstorm => 8,
    _ => 11,
  };

  Color get cloudColor =>
      light ? AppSkyColors.cloudOnLight : AppSkyColors.cloudOnDark;
  Color get fogColor =>
      light ? AppSkyColors.fogOnLight : AppSkyColors.fogOnDark;
  Color get rainColor =>
      light ? AppSkyColors.rainOnLight : AppSkyColors.rainOnDark;
  Color get snowColor =>
      light ? AppSkyColors.snowOnLight : AppSkyColors.snowOnDark;

  @override
  bool operator ==(Object other) =>
      other is SkyLook && other.part == part && other.weather == weather;

  @override
  int get hashCode => Object.hash(part, weather);
}
