import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_backdrop.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_look.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_panel.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

double _contrast(Color a, Color b) {
  final la = a.computeLuminance(), lb = b.computeLuminance();

  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

Widget _app(Widget child) => MaterialApp(
  theme: AppTheme.lightThemeFor(AppAccent.blue),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  locale: const Locale('en'),
  home: Scaffold(
    body: Align(alignment: Alignment.topLeft, child: child),
  ),
);

SkyPanelView _panel({
  required bool landscape,
  required ScreenSizeClass sizeClass,
  SkyLook? look,
  String? readings,
  VoidCallback? onWeatherTap,
}) => SkyPanelView(
  look: look ?? SkyLook.of(SkyDayPart.day, SkyWeather.clear),
  time: '12:11',
  date: 'Saturday 21 November',
  weather: SkyWeatherInfo(
    temperature: '6°',
    label: 'Clear sky',
    icon: MdiIcons.weatherSunny,
  ),
  readings: readings,
  onWeatherTap: onWeatherTap,
  landscape: landscape,
  sizeClass: sizeClass,
);

double _clockSize(WidgetTester tester) =>
    tester.widget<Text>(find.text('12:11')).style!.fontSize!;

void main() {
  setUpAll(() async {
    await locator.reset();
    // DPR 2 at density 1.0: one design px is one logical px.
    locator.registerSingleton<ScreenService>(
      ScreenService(screenWidth: 1280, screenHeight: 800, pixelRatio: 2),
    );
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 2),
    );
    await initializeDateFormatting('en');
  });

  tearDownAll(() async {
    await locator.reset();
  });

  group('the sky rule', () {
    test('the skies drawn first match the spec table', () {
      final day = SkyLook.of(SkyDayPart.day, SkyWeather.clear);
      expect(day.stops, const [
        Color(0xFF7FB4EA),
        Color(0xFFB9D9F5),
        Color(0xFFE4F1FB),
      ]);
      expect(day.text, const Color(0xFF10263F));

      final dusk = SkyLook.of(SkyDayPart.evening, SkyWeather.clear);
      expect(dusk.stops, const [
        Color(0xFF252B55),
        Color(0xFF5A3D6E),
        Color(0xFFA85A55),
      ]);
      expect(dusk.text, const Color(0xFFFFFFFF));

      final night = SkyLook.of(SkyDayPart.night, SkyWeather.clear);
      expect(night.stops, const [
        Color(0xFF0B1026),
        Color(0xFF141C3D),
        Color(0xFF1D2850),
      ]);
      expect(night.text, const Color(0xFFEEF1F8));

      // A thunderstorm is the overcast gradient itself.
      expect(SkyLook.of(SkyDayPart.day, SkyWeather.thunderstorm).stops, const [
        Color(0xFF9AA5B1),
        Color(0xFFC3CAD2),
        Color(0xFFDDE1E6),
      ]);
    });

    test('a condition mixes by its cover factor, as the canvas rounds it', () {
      // Day, rain: 85 % of the way to overcast (Sky.dc.html).
      final rain = SkyLook.of(SkyDayPart.day, SkyWeather.rain);
      expect(rain.stops.first, const Color(0xFF96A7BA));
      expect(SkyWeather.values.map((w) => w.cover), [
        0,
        0.25,
        0.6,
        0.85,
        0.7,
        0.7,
        0.85,
        1,
        0.6,
        0.75,
      ]);
    });

    test('the text passes 4.5:1 on every stop of all forty skies', () {
      var lowest = double.infinity;
      for (final part in SkyDayPart.values) {
        for (final weather in SkyWeather.values) {
          final look = SkyLook.of(part, weather);
          for (final stop in look.stops) {
            lowest = math.min(lowest, _contrast(look.text, stop));
          }
        }
      }

      // The spec quotes 4.9:1 as the lowest.
      expect(lowest, greaterThanOrEqualTo(4.85));
    });

    test('the layers follow the cover', () {
      final clearNight = SkyLook.of(SkyDayPart.night, SkyWeather.clear);
      expect(
        (clearNight.showMoon, clearNight.showStars, clearNight.showSun),
        (true, true, false),
      );
      expect(clearNight.cloudBars, 0);

      final cloudyNight = SkyLook.of(SkyDayPart.night, SkyWeather.cloudy);
      expect((cloudyNight.showMoon, cloudyNight.showStars), (true, false));
      expect(cloudyNight.cloudBars, 2);

      // The sun hides at a cover of 0.7 and above.
      expect(SkyLook.of(SkyDayPart.day, SkyWeather.cloudy).showSun, isTrue);
      expect(SkyLook.of(SkyDayPart.day, SkyWeather.drizzle).showSun, isFalse);

      expect(SkyLook.of(SkyDayPart.day, SkyWeather.partlyCloudy).cloudBars, 1);
      expect(SkyLook.of(SkyDayPart.day, SkyWeather.overcast).cloudBars, 3);

      final fog = SkyLook.of(SkyDayPart.morning, SkyWeather.fog);
      expect((fog.cloudBars, fog.fogBands, fog.rainLines), (0, true, false));

      final sleet = SkyLook.of(SkyDayPart.evening, SkyWeather.sleet);
      expect((sleet.rainLines, sleet.snowDots), (true, true));

      final storm = SkyLook.of(SkyDayPart.day, SkyWeather.thunderstorm);
      expect(
        (storm.lightning, storm.rainLines, storm.rainGap),
        (true, true, 8),
      );
      expect(SkyLook.of(SkyDayPart.day, SkyWeather.drizzle).rainGap, 16);
    });

    test('OpenWeatherMap codes map onto the ten conditions', () {
      final cases = {
        200: SkyWeather.thunderstorm,
        301: SkyWeather.drizzle,
        500: SkyWeather.rain,
        511: SkyWeather.sleet,
        531: SkyWeather.rain,
        600: SkyWeather.snow,
        611: SkyWeather.sleet,
        741: SkyWeather.fog,
        781: SkyWeather.thunderstorm,
        800: SkyWeather.clear,
        801: SkyWeather.partlyCloudy,
        802: SkyWeather.partlyCloudy,
        803: SkyWeather.cloudy,
        804: SkyWeather.overcast,
      };
      for (final MapEntry(:key, :value) in cases.entries) {
        expect(skyWeatherForCode(key), value, reason: '$key');
      }
    });

    test('the day part follows the sun, or the clock without it', () {
      final sunrise = DateTime(2026, 11, 21, 7);
      final sunset = DateTime(2026, 11, 21, 17);

      SkyDayPart at(int hour, [int minute = 0]) => skyDayPartAt(
        DateTime(2026, 11, 21, hour, minute),
        sunrise: sunrise,
        sunset: sunset,
      );

      expect(at(6), SkyDayPart.night);
      expect(at(8), SkyDayPart.morning);
      expect(at(12), SkyDayPart.day);
      expect(at(16), SkyDayPart.evening);
      expect(at(17, 30), SkyDayPart.evening);
      expect(at(18, 30), SkyDayPart.night);

      expect(skyDayPartAt(DateTime(2026, 1, 1, 7)), SkyDayPart.morning);
      expect(skyDayPartAt(DateTime(2026, 1, 1, 12)), SkyDayPart.day);
      expect(skyDayPartAt(DateTime(2026, 1, 1, 19)), SkyDayPart.evening);
      expect(skyDayPartAt(DateTime(2026, 1, 1, 23)), SkyDayPart.night);
    });

    test('the clock follows the 12- or 24-hour setting', () {
      final evening = DateTime(2026, 11, 21, 21, 47);
      expect(skyClock(evening, locale: 'en'), ('21:47', null));
      expect(skyClock(evening, locale: 'en', twelveHour: true), ('9:47', 'PM'));
      expect(
        skyClock(DateTime(2026, 11, 21, 0, 5), locale: 'en', twelveHour: true),
        ('12:05', 'AM'),
      );
    });

    test('the next tick is always ahead, within the minute', () {
      expect(
        skyUntilNextMinute(DateTime(2026, 10, 25, 2, 30, 59, 999)),
        const Duration(milliseconds: 1),
      );
      expect(
        skyUntilNextMinute(DateTime(2026, 10, 25, 2, 30)),
        const Duration(minutes: 1),
      );
      // A UTC time in the hour the clocks go back: never negative.
      final repeated = DateTime.utc(2026, 10, 25, 1, 30, 12, 500);
      final delay = skyUntilNextMinute(repeated);
      expect(delay, greaterThan(Duration.zero));
      expect(delay, const Duration(seconds: 47, milliseconds: 500));
    });

    test('temperatures are whole degrees with a true minus sign', () {
      expect(skyTemperature(6.4), '6°');
      expect(skyTemperature(-2.2), '−2°');
    });
  });

  group('the sky panel', () {
    testWidgets('paints the gradient from its top stop', (tester) async {
      final key = GlobalKey();
      final look = SkyLook.of(SkyDayPart.morning, SkyWeather.clear);
      await tester.pumpWidget(
        _app(
          RepaintBoundary(
            key: key,
            child: SizedBox(
              width: 240,
              height: 150,
              child: SkyBackdrop(look: look),
            ),
          ),
        ),
      );

      final bytes = await tester.runAsync(() async {
        final boundary =
            key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        final image = await boundary.toImage();
        final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
        image.dispose();

        return data!;
      });

      // The top-right pixel: the top stop (the morning sun is bottom left).
      final data = bytes!;
      final offset = (239) * 4;
      final pixel = Color.fromARGB(
        data.getUint8(offset + 3),
        data.getUint8(offset),
        data.getUint8(offset + 1),
        data.getUint8(offset + 2),
      );
      // Within a step of rounding at the gradient's edge.
      final top = look.stops.first;
      for (final (a, b) in [
        (pixel.r, top.r),
        (pixel.g, top.g),
        (pixel.b, top.b),
      ]) {
        expect((a - b).abs(), lessThanOrEqualTo(2 / 255));
      }
    });

    testWidgets('a thunderstorm adds the lightning mark', (tester) async {
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 240,
            height: 150,
            child: SkyBackdrop(
              look: SkyLook.of(SkyDayPart.day, SkyWeather.thunderstorm),
            ),
          ),
        ),
      );
      expect(find.byIcon(MdiIcons.lightningBolt), findsOneWidget);
    });

    for (final (sizeClass, clock) in [
      (ScreenSizeClass.compact, 48.0),
      (ScreenSizeClass.regular, 72.0),
      (ScreenSizeClass.expanded, 96.0),
    ]) {
      testWidgets('the clock is $clock in landscape on ${sizeClass.name}', (
        tester,
      ) async {
        await tester.pumpWidget(
          _app(
            SizedBox(
              width: 300,
              height: 540,
              child: _panel(landscape: true, sizeClass: sizeClass),
            ),
          ),
        );
        expect(_clockSize(tester), clock);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('a 12-hour clock adds AM/PM at 24 % of the clock', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 300,
            height: 540,
            child: SkyPanelView(
              look: SkyLook.of(SkyDayPart.night, SkyWeather.clear),
              time: '9:47',
              meridiem: 'PM',
              date: 'Saturday 21 November',
              landscape: true,
              sizeClass: ScreenSizeClass.regular,
            ),
          ),
        ),
      );

      final clock = tester.widget<Text>(
        find.byWidgetPredicate(
          (widget) =>
              widget is Text &&
              widget.textSpan?.toPlainText().startsWith('9:47') == true,
        ),
      );
      final mark = (clock.textSpan! as TextSpan).children!.single as TextSpan;
      expect(mark.text, ' PM');
      expect(mark.style!.fontSize, 72 * 0.24);
      expect(clock.style!.fontSize, 72);
    });

    testWidgets('in portrait the clock fits beside the weather card', (
      tester,
    ) async {
      // The square's 76 high sky: half its height.
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 240,
            height: 76,
            child: _panel(landscape: false, sizeClass: ScreenSizeClass.compact),
          ),
        ),
      );
      expect(_clockSize(tester), 38);

      // 4″ tall: 208 wide, 91 high.
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 208,
            height: 91,
            child: _panel(
              landscape: false,
              sizeClass: ScreenSizeClass.compact,
              readings: '21.4 °C · 46 %',
            ),
          ),
        ),
      );
      expect(tester.takeException(), isNull);
      expect(_clockSize(tester), 45.5);
    });

    testWidgets('Compact drops the condition and adds the room readings', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 160,
            height: 240,
            child: _panel(
              landscape: true,
              sizeClass: ScreenSizeClass.compact,
              readings: '21.4 °C · 46 %',
            ),
          ),
        ),
      );
      expect(find.text('Clear sky'), findsNothing);
      expect(find.text('21.4 °C · 46 %'), findsOneWidget);

      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 240,
            height: 360,
            child: _panel(landscape: true, sizeClass: ScreenSizeClass.regular),
          ),
        ),
      );
      expect(find.text('Clear sky'), findsOneWidget);
    });

    testWidgets('without weather Compact keeps the room readings', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 160,
            height: 240,
            child: SkyPanelView(
              look: SkyLook.of(SkyDayPart.day, SkyWeather.clear),
              time: '12:11',
              date: 'Sat 21 Nov',
              readings: '21.4 °C · 46 %',
              onWeatherTap: () {},
              landscape: true,
              sizeClass: ScreenSizeClass.compact,
            ),
          ),
        ),
      );

      expect(find.text('21.4 °C · 46 %'), findsOneWidget);
      // Not a forecast button without weather.
      final node = tester.getSemantics(
        find.bySemanticsLabel('In the room: 21.4 °C · 46 %'),
      );
      expect(node.flagsCollection.isButton, isFalse);
      handle.dispose();
    });

    testWidgets('the weather card is one flat button that opens the forecast', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      var opened = 0;
      final look = SkyLook.of(SkyDayPart.evening, SkyWeather.clear);
      await tester.pumpWidget(
        _app(
          SizedBox(
            width: 240,
            height: 360,
            child: _panel(
              landscape: true,
              sizeClass: ScreenSizeClass.regular,
              look: look,
              onWeatherTap: () => opened++,
            ),
          ),
        ),
      );

      // No blur: one translucent fill and its outline.
      expect(find.byType(BackdropFilter), findsNothing);
      final material = tester.widget<Material>(
        find.descendant(
          of: find.byType(SkyWeatherCard),
          matching: find.byType(Material),
        ),
      );
      expect(material.color, look.glass);
      expect(
        (material.shape! as RoundedRectangleBorder).side.color,
        look.glassLine,
      );
      expect(tester.widget<Text>(find.text('12:11')).style!.color, look.text);

      // The temperature is spoken too, not only drawn.
      final node = tester.getSemantics(
        find.bySemanticsLabel('Weather, Clear sky. Open forecast'),
      );
      expect(node.value, '6°');

      await tester.tap(find.byType(SkyWeatherCard));
      expect(opened, 1);
      tester.semantics.tap(
        find.semantics.byLabel('Weather, Clear sky. Open forecast'),
      );
      expect(opened, 2);
      handle.dispose();
    });
  });
}
