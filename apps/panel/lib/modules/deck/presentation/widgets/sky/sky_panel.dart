import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_backdrop.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_look.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/openweather.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The sky panel's sizes (docs/display-ui-design-spec.md §4, design canvas
/// "Room overview").
class SkyPanelMetrics {
  SkyPanelMetrics._();

  /// The panel's padding: 8 / 12 / 20; portrait adds 2 on top.
  static double paddingFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 8,
    ScreenSizeClass.regular => 12,
    ScreenSizeClass.expanded => 20,
  };

  static const double portraitTopExtra = 2;

  /// The clock: 48 / 72 / 96 (the glance numeral floor is 48).
  static double clockFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 48,
    ScreenSizeClass.regular => 72,
    ScreenSizeClass.expanded => 96,
  };

  /// In portrait the clock also stays within these shares of the panel's
  /// width and height, so it fits beside the weather card.
  static const double portraitClockWidthShare = 0.23;
  static const double portraitClockHeightShare = 0.5;

  /// The clock's line height.
  static const double clockLineHeight = 0.86;

  /// The date: 10 / 12 / 14.
  static double dateFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 10,
    ScreenSizeClass.regular => 12,
    ScreenSizeClass.expanded => 14,
  };

  static const double clockDateGap = 4;

  /// The gap between the clock, the weather card and the footer: the page
  /// gap, 6 / 8 / 12.
  static double gapFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 6,
    ScreenSizeClass.regular => 8,
    ScreenSizeClass.expanded => 12,
  };

  /// The weather card: padding (vertical, horizontal), icon and temperature.
  static (double, double) cardPaddingFor(ScreenSizeClass sizeClass) =>
      switch (sizeClass) {
        ScreenSizeClass.compact => (5, 8),
        ScreenSizeClass.regular => (8, 10),
        ScreenSizeClass.expanded => (10, 14),
      };

  static double cardIconFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 16,
    ScreenSizeClass.regular => 18,
    ScreenSizeClass.expanded => 24,
  };

  static double cardTemperatureFor(ScreenSizeClass sizeClass) =>
      switch (sizeClass) {
        ScreenSizeClass.compact => 18,
        ScreenSizeClass.regular => 22,
        ScreenSizeClass.expanded => 28,
      };

  /// The card is a button, so it keeps the touch floor.
  static const double cardMinHeight = 36;
  static const double cardGap = 6;
  static const double cardLineGap = 3;

  /// Compact's room readings line inside the card.
  static const double readingsFont = 10;
  static const double readingsIcon = 11;
  static const double readingsGap = 4;
}

/// What the weather card shows.
@immutable
class SkyWeatherInfo {
  const SkyWeatherInfo({
    required this.temperature,
    required this.label,
    required this.icon,
  });

  /// "6°", "−2°".
  final String temperature;

  /// "Partly cloudy".
  final String label;
  final IconData icon;
}

/// The sky panel (spec §2, §4, §6): the sky, the clock and date, and a flat
/// weather card that opens the forecast.
///
/// - Landscape stacks them on the left of the page; [footer] (the scene
///   pills on Regular and up, drawn in the sky's colours) sits at the
///   panel's foot.
/// - Portrait puts the clock and the weather card side by side.
/// - Compact shows the weather without its label and adds [readings] (the
///   room's temperature and humidity) as a line inside the card.
///
/// This is the view; [SkyPanel] feeds it from the clock and the weather.
class SkyPanelView extends StatelessWidget {
  const SkyPanelView({
    super.key,
    required this.look,
    required this.time,
    required this.date,
    this.weather,
    this.readings,
    this.onWeatherTap,
    required this.landscape,
    this.sizeClass,
    this.footer,
  });

  final SkyLook look;

  /// "12:11".
  final String time;

  /// "Saturday 21 November", "Sat 21 Nov" on Compact.
  final String date;

  /// Null hides the weather card (no weather location).
  final SkyWeatherInfo? weather;

  /// Compact's room readings line: "21.4° · 46 %".
  final String? readings;

  final VoidCallback? onWeatherTap;

  final bool landscape;

  /// The class to size for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// Laid out at the foot of the panel in landscape, given the sky.
  final Widget Function(BuildContext context, SkyLook look)? footer;

  @override
  Widget build(BuildContext context) {
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final padding = AppSpacings.scale(
      SkyPanelMetrics.paddingFor(resolvedClass),
    );
    final gap = AppSpacings.scale(SkyPanelMetrics.gapFor(resolvedClass));

    return ClipRect(
      child: Stack(
        fit: StackFit.expand,
        children: [
          SkyBackdrop(look: look),
          Padding(
            padding: EdgeInsets.fromLTRB(
              padding,
              padding +
                  (landscape
                      ? 0
                      : AppSpacings.scale(SkyPanelMetrics.portraitTopExtra)),
              padding,
              padding,
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final clock = _Clock(
                  time: time,
                  date: date,
                  color: look.text,
                  size: _clockSize(resolvedClass, constraints, padding),
                  sizeClass: resolvedClass,
                );
                final card = weather == null
                    ? null
                    : SkyWeatherCard(
                        look: look,
                        weather: weather!,
                        readings: readings,
                        showLabel: resolvedClass != ScreenSizeClass.compact,
                        onTap: onWeatherTap,
                        sizeClass: resolvedClass,
                      );

                if (!landscape) {
                  return Row(
                    spacing: gap,
                    children: [
                      Expanded(
                        child: Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: clock,
                        ),
                      ),
                      if (card != null) Flexible(child: card),
                    ],
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: gap,
                  children: [
                    clock,
                    if (card != null) card,
                    if (footer != null)
                      Expanded(
                        // Reversed, so the footer sits at the foot and
                        // scrolls if the panel is too short for it.
                        child: SingleChildScrollView(
                          reverse: true,
                          child: SizedBox(
                            width: constraints.maxWidth,
                            child: footer!(context, look),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  /// The class's clock; in portrait it also fits beside the weather card.
  double _clockSize(
    ScreenSizeClass sizeClass,
    BoxConstraints constraints,
    double padding,
  ) {
    final size = AppSpacings.scale(SkyPanelMetrics.clockFor(sizeClass));

    if (landscape || !constraints.hasBoundedHeight) return size;

    // The panel's own size, before its padding.
    final width = constraints.maxWidth + 2 * padding;
    final height =
        constraints.maxHeight +
        2 * padding +
        AppSpacings.scale(SkyPanelMetrics.portraitTopExtra);

    return [
      size,
      width * SkyPanelMetrics.portraitClockWidthShare,
      height * SkyPanelMetrics.portraitClockHeightShare,
    ].reduce(math.min);
  }
}

/// The clock and the date.
class _Clock extends StatelessWidget {
  const _Clock({
    required this.time,
    required this.date,
    required this.color,
    required this.size,
    required this.sizeClass,
  });

  final String time;
  final String date;
  final Color color;
  final double size;
  final ScreenSizeClass sizeClass;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.scale(SkyPanelMetrics.clockDateGap),
      children: [
        // Never wraps: on the narrowest panels it scales down instead.
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: AlignmentDirectional.centerStart,
          child: Text(
            time,
            maxLines: 1,
            softWrap: false,
            style: TextStyle(
              color: color,
              fontFamily: AppNumeralFont.family,
              fontSize: size,
              fontWeight: AppNumeralFont.display,
              height: SkyPanelMetrics.clockLineHeight,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
        Text(
          date,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: AppSpacings.scale(SkyPanelMetrics.dateFor(sizeClass)),
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

/// The weather card (spec §2): one flat translucent fill, no blur. A button
/// that opens the forecast.
class SkyWeatherCard extends StatelessWidget {
  const SkyWeatherCard({
    super.key,
    required this.look,
    required this.weather,
    this.readings,
    this.showLabel = true,
    this.onTap,
    this.sizeClass,
  });

  final SkyLook look;
  final SkyWeatherInfo weather;

  /// Compact's room readings line.
  final String? readings;

  /// The condition's label after the temperature; off on Compact.
  final bool showLabel;

  final VoidCallback? onTap;
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final (vertical, horizontal) = SkyPanelMetrics.cardPaddingFor(
      resolvedClass,
    );
    final radius = BorderRadius.circular(AppBorderRadius.base);
    final caption = AppSpacings.scale(SkyPanelMetrics.dateFor(resolvedClass));

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.scale(SkyPanelMetrics.cardLineGap),
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          spacing: AppSpacings.scale(SkyPanelMetrics.cardGap),
          children: [
            Icon(
              weather.icon,
              size: AppSpacings.scale(
                SkyPanelMetrics.cardIconFor(resolvedClass),
              ),
              color: look.text,
            ),
            Text(
              weather.temperature,
              maxLines: 1,
              softWrap: false,
              style: TextStyle(
                color: look.text,
                fontFamily: AppNumeralFont.family,
                fontSize: AppSpacings.scale(
                  SkyPanelMetrics.cardTemperatureFor(resolvedClass),
                ),
                fontWeight: AppNumeralFont.value,
                height: 1,
              ),
            ),
            if (showLabel)
              Flexible(
                child: Text(
                  weather.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: look.text, fontSize: caption),
                ),
              ),
          ],
        ),
        if (readings != null && readings!.isNotEmpty)
          Row(
            mainAxisSize: MainAxisSize.min,
            spacing: AppSpacings.scale(SkyPanelMetrics.readingsGap),
            children: [
              Icon(
                MdiIcons.homeOutline,
                size: AppSpacings.scale(SkyPanelMetrics.readingsIcon),
                color: look.text,
              ),
              Flexible(
                child: Text(
                  readings!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: look.text,
                    fontSize: AppSpacings.scale(SkyPanelMetrics.readingsFont),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
      ],
    );

    return Semantics(
      container: true,
      button: onTap != null,
      label: localizations.sky_weather_open(weather.label),
      value: readings,
      onTap: onTap,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: AppSpacings.scale(SkyPanelMetrics.cardMinHeight),
        ),
        child: Material(
          color: look.glass,
          shape: RoundedRectangleBorder(
            borderRadius: radius,
            side: BorderSide(
              color: look.glassLine,
              width: AppSpacings.scale(1),
            ),
          ),
          child: InkWell(
            onTap: onTap,
            borderRadius: radius,
            child: Padding(
              padding: EdgeInsets.symmetric(
                vertical: AppSpacings.scale(vertical),
                horizontal: AppSpacings.scale(horizontal),
              ),
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}

/// The live sky panel: follows the clock and the display's weather
/// location, and falls back to a clear sky by the hour without weather.
class SkyPanel extends StatefulWidget {
  const SkyPanel({
    super.key,
    required this.landscape,
    this.sizeClass,
    this.readings,
    this.onWeatherTap,
    this.footer,
  });

  final bool landscape;
  final ScreenSizeClass? sizeClass;
  final String? readings;
  final VoidCallback? onWeatherTap;
  final Widget Function(BuildContext context, SkyLook look)? footer;

  @override
  State<SkyPanel> createState() => _SkyPanelState();
}

class _SkyPanelState extends State<SkyPanel> {
  WeatherService? _weatherService;
  DisplayRepository? _displayRepository;
  Timer? _clockTimer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();

    if (locator.isRegistered<WeatherService>()) {
      _weatherService = locator<WeatherService>()..addListener(_changed);
    }

    if (locator.isRegistered<DisplayRepository>()) {
      _displayRepository = locator<DisplayRepository>()..addListener(_changed);
    }

    _scheduleTick();
  }

  @override
  void dispose() {
    _weatherService?.removeListener(_changed);
    _displayRepository?.removeListener(_changed);
    _clockTimer?.cancel();
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() => _now = DateTime.now());
  }

  /// Ticks on the minute, so the clock turns over when the minute does.
  void _scheduleTick() {
    final now = DateTime.now();
    final next = DateTime(
      now.year,
      now.month,
      now.day,
      now.hour,
      now.minute,
    ).add(const Duration(minutes: 1));

    _clockTimer = Timer(next.difference(now), () {
      if (!mounted) return;
      setState(() => _now = DateTime.now());
      _scheduleTick();
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final sizeClass = widget.sizeClass ?? locator<ScreenService>().sizeClass;
    final locale = localizations.localeName;
    final currentDay = _weatherService?.getCurrentDayByLocation(
      _displayRepository?.weatherLocationId,
    );

    final part = skyDayPartAt(
      _now,
      sunrise: currentDay?.sunrise,
      sunset: currentDay?.sunset,
    );
    final condition = currentDay == null
        ? SkyWeather.clear
        : skyWeatherForCode(currentDay.weatherCode);

    final weather = currentDay == null
        ? null
        : SkyWeatherInfo(
            temperature: skyTemperature(currentDay.temperature),
            label: WeatherConditionMapper.getDescription(
              currentDay.weatherCode,
              context,
            ),
            icon: skyWeatherIcon(condition, part),
          );

    return SkyPanelView(
      look: SkyLook.of(part, condition),
      time: DateFormat('HH:mm', locale).format(_now),
      date: DateFormat(
        sizeClass == ScreenSizeClass.compact ? 'EEE d MMM' : 'EEEE d MMMM',
        locale,
      ).format(_now),
      weather: weather,
      readings: widget.readings,
      onWeatherTap: widget.onWeatherTap,
      landscape: widget.landscape,
      sizeClass: sizeClass,
      footer: widget.footer,
    );
  }
}

/// A whole-degree temperature with a true minus sign: "6°", "−2°".
String skyTemperature(double value) {
  final text = NumberUtils.formatDecimal(value, decimalPlaces: 0);

  return '${text.replaceFirst('-', '−')}°';
}
