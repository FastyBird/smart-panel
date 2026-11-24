import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/app/routes.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/right_drawer.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_scope.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_sections.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app({List<GallerySection> sections = gallerySections}) {
  return MaterialApp(
    theme: AppTheme.lightTheme,
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('en'),
    home: ComponentGalleryScreen(sections: sections),
  );
}

Future<void> _pump(WidgetTester tester, {List<GallerySection> sections = gallerySections}) async {
  tester.view.physicalSize = const Size(1280, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(_app(sections: sections));
  await tester.pumpAndSettle();
}

Future<void> _tap(WidgetTester tester, String key) async {
  await tester.ensureVisible(find.byKey(ValueKey(key)));
  await tester.tap(find.byKey(ValueKey(key)));
  await tester.pumpAndSettle();
}

/// A context inside the preview canvas.
BuildContext _canvasContext(WidgetTester tester, String section) =>
    tester.element(find.byKey(ValueKey('gallery-section-view-$section')));

Size _canvasSize(WidgetTester tester) => tester.getSize(find.byKey(const ValueKey('gallery-canvas')));

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
    // The thermostat dial blocks page swipes through the event bus.
    locator.registerSingleton<EventBus>(EventBus());
  });

  tearDown(() => AppAccents.current = AppAccent.blue);

  tearDownAll(() async {
    await locator.reset();
  });

  test('the route exists in debug builds only', () {
    expect(appRoutes.containsKey(AppRouteNames.gallery), kDebugMode);
  });

  test('has one section per component task, DR-5 to DR-10', () {
    expect(
      gallerySections.map((section) => section.task),
      ['DR-5', 'DR-6', 'DR-7', 'DR-8', 'DR-9', 'DR-10'],
    );
    expect(
      gallerySections.map((section) => section.issue),
      [1715, 1716, 1717, 1718, 1719, 1720],
    );
    // Sections fill as their tasks land.
    expect(
      gallerySections.where((section) => section.entries.isNotEmpty).map((section) => section.task),
      ['DR-5', 'DR-6', 'DR-7', 'DR-8', 'DR-9'],
    );
  });

  testWidgets('shows every section: its entries, or empty until its task fills it', (tester) async {
    await _pump(tester);

    for (final section in gallerySections) {
      await _tap(tester, 'gallery-section-${section.id}');

      expect(find.byKey(ValueKey('gallery-section-view-${section.id}')), findsOneWidget);

      if (section.entries.isEmpty) {
        expect(find.text('No components yet. ${section.task} adds them here.'), findsOneWidget);
      } else {
        expect(find.byKey(const ValueKey('gallery-section-empty')), findsNothing);

        for (final entry in section.entries) {
          await tester.scrollUntilVisible(
            find.text(entry.title),
            100,
            scrollable: find
                .descendant(
                  of: find.byKey(ValueKey('gallery-section-view-${section.id}')),
                  matching: find.byType(Scrollable),
                )
                .first,
          );
          expect(find.text(entry.title), findsOneWidget);
        }
      }
    }
  });

  for (final id in ['controls', 'lists', 'states']) {
  testWidgets('the $id entries fit the Compact portrait and square canvases', (tester) async {
    await _pump(tester);
    await _tap(tester, 'gallery-section-$id');
    final section = gallerySections.firstWhere((section) => section.id == id);

    for (final (canvas, orientation) in [('compact', 'portrait'), ('square', 'landscape')]) {
      await _tap(tester, 'gallery-canvas-$canvas');
      await _tap(tester, 'gallery-orientation-$orientation');

      // Step through the list directly: a drag would be caught by the dial.
      final position = tester
          .state<ScrollableState>(
            find
                .descendant(
                  of: find.byKey(ValueKey('gallery-section-view-$id')),
                  matching: find.byType(Scrollable),
                )
                .first,
          )
          .position;
      position.jumpTo(0);
      final seen = <String>{};
      while (true) {
        await tester.pumpAndSettle();
        // A RenderFlex overflow would surface here.
        expect(tester.takeException(), isNull, reason: 'at ${position.pixels} on $canvas $orientation');
        seen.addAll(section.entries.map((entry) => entry.title).where((title) => find.text(title).evaluate().isNotEmpty));
        if (position.pixels >= position.maxScrollExtent) break;
        position.jumpTo((position.pixels + 100).clamp(0, position.maxScrollExtent).toDouble());
      }
      expect(seen, section.entries.map((entry) => entry.title).toSet(), reason: '$canvas $orientation');
    }
  });
  }

  testWidgets("a sample's close button never closes the gallery", (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    // The gallery is pushed over a home page, as on the panel.
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const ComponentGalleryScreen()),
            ),
            child: const Text('home'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('home'));
    await tester.pumpAndSettle();
    await _tap(tester, 'gallery-section-lists');

    final scrollable = find
        .descendant(of: find.byKey(const ValueKey('gallery-section-view-lists')), matching: find.byType(Scrollable))
        .first;
    for (final title in ['Bottom sheet', 'Right drawer', 'Selection dialog']) {
      await tester.scrollUntilVisible(find.text(title), 100, scrollable: scrollable);
      await tester.pumpAndSettle();
      // Tap where each close button is drawn: a sample may not take it.
      final close = find.byType(SheetCloseButton);
      expect(close, findsWidgets, reason: title);
      for (final center in [for (var i = 0; i < close.evaluate().length; i++) tester.getCenter(close.at(i))]) {
        await tester.tapAt(center);
        await tester.pumpAndSettle();
      }
      expect(find.byType(ComponentGalleryScreen), findsOneWidget, reason: title);
    }
  });

  testWidgets('renders the reference canvas of each class and orientation', (tester) async {
    await _pump(tester);

    expect(_canvasSize(tester), const Size(640, 400));
    expect(GalleryScope.of(_canvasContext(tester, 'header')).sizeClass, ScreenSizeClass.regular);

    await _tap(tester, 'gallery-canvas-expanded');
    expect(_canvasSize(tester), const Size(960, 540));
    expect(GalleryScope.of(_canvasContext(tester, 'header')).sizeClass, ScreenSizeClass.expanded);

    await _tap(tester, 'gallery-orientation-portrait');
    expect(_canvasSize(tester), const Size(540, 960));
    expect(GalleryScope.of(_canvasContext(tester, 'header')).orientation, Orientation.portrait);

    await _tap(tester, 'gallery-canvas-compact');
    expect(_canvasSize(tester), const Size(282, 471));

    await _tap(tester, 'gallery-canvas-square');
    expect(_canvasSize(tester), const Size(282, 282));

    final scope = GalleryScope.of(_canvasContext(tester, 'header'));

    expect(scope.sizeClass, ScreenSizeClass.compact);
    expect(scope.isSquare, isTrue);
    expect(scope.canvasSize, const Size(282, 282));
  });

  testWidgets('previews a theme and accent without changing the panel', (tester) async {
    await _pump(tester);

    var theme = Theme.of(_canvasContext(tester, 'header'));

    expect(theme.brightness, Brightness.light);
    expect(theme.accent.fill, AppAccentPalette.of(AppAccent.blue, Brightness.light).fill);

    await _tap(tester, 'gallery-theme-dark');
    await _tap(tester, 'accent-swatch-rose');

    theme = Theme.of(_canvasContext(tester, 'header'));

    expect(theme.brightness, Brightness.dark);
    expect(theme.accent.fill, AppAccentPalette.of(AppAccent.rose, Brightness.dark).fill);
    expect(theme.colorScheme.primary, AppAccentPalette.of(AppAccent.rose, Brightness.dark).fill);

    final scope = GalleryScope.of(_canvasContext(tester, 'header'));

    expect(scope.brightness, Brightness.dark);
    expect(scope.accent, AppAccent.rose);

    // The gallery's own chrome and the panel accent are untouched.
    expect(AppAccents.current, AppAccent.blue);
    expect(Theme.of(tester.element(find.byType(ComponentGalleryScreen))).brightness, Brightness.light);
  });

  testWidgets('renders entries inside the scope', (tester) async {
    await _pump(tester, sections: [
      GallerySection(
        id: 'sample',
        task: 'DR-0',
        issue: 1,
        title: 'Sample',
        entries: [
          GalleryEntry(
            title: 'Class label',
            builder: (context) => Text(
              GalleryScope.of(context).sizeClass.name,
              key: const ValueKey('sample-entry'),
            ),
          ),
        ],
      ),
    ]);

    expect(find.text('Class label'), findsOneWidget);
    expect(tester.widget<Text>(find.byKey(const ValueKey('sample-entry'))).data, 'regular');
    expect(find.byKey(const ValueKey('gallery-section-empty')), findsNothing);

    await _tap(tester, 'gallery-canvas-expanded');

    expect(tester.widget<Text>(find.byKey(const ValueKey('sample-entry'))).data, 'expanded');
  });

  testWidgets('gives entries the canvas as their MediaQuery', (tester) async {
    await _pump(tester, sections: [
      GallerySection(
        id: 'sample',
        task: 'DR-0',
        issue: 1,
        title: 'Sample',
        entries: [
          GalleryEntry(
            title: 'Media',
            builder: (context) => Text(
              '${MediaQuery.sizeOf(context)} ${MediaQuery.orientationOf(context).name}',
              key: const ValueKey('sample-media'),
            ),
          ),
        ],
      ),
    ]);

    String media() => tester.widget<Text>(find.byKey(const ValueKey('sample-media'))).data!;

    expect(media(), '${const Size(640, 400)} landscape');

    await _tap(tester, 'gallery-canvas-expanded');
    await _tap(tester, 'gallery-orientation-portrait');

    expect(media(), '${const Size(540, 960)} portrait');

    // The gallery's own controls keep the panel's media data.
    final host = tester.element(find.byType(ComponentGalleryScreen));

    expect(MediaQuery.sizeOf(host), const Size(1280, 800));
    expect(MediaQuery.orientationOf(host), Orientation.landscape);
  });

  testWidgets('the outcome details open for the selected canvas, not the host screen', (tester) async {
    // The host is landscape and Regular.
    await _pump(tester);
    await _tap(tester, 'gallery-section-states');

    for (final (canvas, orientation, landscape, sizeClass) in [
      ('compact', 'portrait', false, ScreenSizeClass.compact),
      ('expanded', 'landscape', true, ScreenSizeClass.expanded),
    ]) {
      await _tap(tester, 'gallery-canvas-$canvas');
      await _tap(tester, 'gallery-orientation-$orientation');

      final partial = find.textContaining('1 light did not answer');
      await tester.scrollUntilVisible(
        partial,
        100,
        scrollable: find
            .descendant(
              of: find.byKey(const ValueKey('gallery-section-view-states')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      await tester.tap(partial);
      await tester.pumpAndSettle();

      expect(find.byType(BottomSheetDialog), landscape ? findsNothing : findsOneWidget, reason: canvas);
      expect(find.byType(RightDrawer), landscape ? findsOneWidget : findsNothing, reason: canvas);
      final layerClass = landscape
          ? tester.widget<RightDrawer>(find.byType(RightDrawer)).sizeClass
          : tester.widget<BottomSheetDialog>(find.byType(BottomSheetDialog)).sizeClass;
      expect(layerClass, sizeClass, reason: canvas);

      await tester.tapAt(const Offset(4, 4));
      await tester.pumpAndSettle();
      expect(find.text('Room mode: Relax'), findsNothing, reason: canvas);
    }
  });

  test('the theme for an accent matches the panel theme in that accent', () {
    for (final accent in AppAccent.values) {
      final direct = AppTheme.lightThemeFor(accent);

      AppAccents.current = accent;

      final current = AppTheme.lightTheme;

      expect(direct.colorScheme, current.colorScheme, reason: accent.name);
      expect(direct.accent.fill, current.accent.fill, reason: accent.name);
      expect(AppTheme.darkThemeFor(accent).colorScheme, AppTheme.darkTheme.colorScheme, reason: accent.name);
    }
  });
}
