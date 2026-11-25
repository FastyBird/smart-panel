import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_nav_tab_data.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_bottom_nav_bar.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_more_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_nav_tab.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_side_dock.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

const _classes = [
  ScreenSizeClass.compact,
  ScreenSizeClass.regular,
  ScreenSizeClass.expanded,
];

const _brightnesses = [Brightness.light, Brightness.dark];

ThemeData _theme(Brightness brightness) => brightness == Brightness.dark
    ? AppTheme.darkThemeFor(AppAccent.blue)
    : AppTheme.lightThemeFor(AppAccent.blue);

AppNeutralPalette _neutrals(Brightness brightness) => AppNeutralPalette.of(brightness);

AppAccentPalette _accent(Brightness brightness) => _theme(brightness).accent;

/// Only [items] is used by the navigation.
class _FakeDeckService extends ChangeNotifier implements DeckService {
  _FakeDeckService(this.items);

  @override
  List<DeckItem> items;

  /// The deck changing under the navigation (a reorder, say).
  void replace(List<DeckItem> next) {
    items = next;
    notifyListeners();
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

final List<DeckItem> _items = [
  const SystemViewItem(id: 'system', viewType: SystemViewType.room, title: 'Room'),
  for (final (i, type) in [DomainType.lights, DomainType.climate, DomainType.shading, DomainType.media].indexed)
    DomainViewItem(id: 'domain-$i', domainType: type, roomId: 'room', title: type.name, deviceCount: 1),
];

const _home = DeckNavTabData(icon: Icons.home, label: 'Home', pageIndex: 0);

const List<DeckNavTabData> _tabs = [
  DeckNavTabData(icon: Icons.lightbulb_outline, label: 'Lights', pageIndex: 1),
  DeckNavTabData(icon: Icons.thermostat, label: 'Climate', pageIndex: 2),
  DeckNavTabData(icon: Icons.blinds, label: 'Shading', pageIndex: 3),
  DeckNavTabData(icon: Icons.play_arrow, label: 'Media', pageIndex: 4),
  DeckNavTabData(icon: Icons.bolt, label: 'Energy', pageIndex: 5),
  DeckNavTabData(icon: Icons.more_horiz, label: 'All pages', pageIndex: -1, isMore: true, badgeCount: 3),
];

BottomNavModeConfig _mode() => BottomNavModeConfig(
  icon: Icons.weekend,
  label: 'Relax',
  title: 'Lights mode',
  color: ThemeColors.lights,
  popupBuilder: (context, dismiss) => const SizedBox.shrink(),
);

Widget _app(Widget child, {Brightness brightness = Brightness.light, List<DeckItem>? items}) {
  final app = MaterialApp(
    theme: _theme(brightness),
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('en'),
    home: Scaffold(body: Align(alignment: Alignment.topLeft, child: child)),
  );

  return MultiProvider(
    providers: [
      ChangeNotifierProvider<DeckService>.value(value: _FakeDeckService(items ?? _items)),
      ChangeNotifierProvider<BottomNavModeNotifier>(create: (_) => BottomNavModeNotifier()),
    ],
    child: app,
  );
}

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.light,
  List<DeckItem>? items,
}) async {
  tester.view.physicalSize = const Size(1280, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(_app(child, brightness: brightness, items: items));
  await tester.pumpAndSettle();
}

Finder _tab(String label) => find.byWidgetPredicate((widget) => widget is DeckNavTab && widget.label == label);

/// Whether the tab lies wholly inside the scroll area of [of].
bool _inView(WidgetTester tester, String label, Finder of) {
  final view = tester.getRect(find.descendant(of: of, matching: find.byType(Scrollable)));
  final tab = tester.getRect(_tab(label));

  return tab.left >= view.left - 0.5 &&
      tab.right <= view.right + 0.5 &&
      tab.top >= view.top - 0.5 &&
      tab.bottom <= view.bottom + 0.5;
}

/// The tab's fill.
Color? _fill(WidgetTester tester, String label) =>
    tester.widget<Material>(find.descendant(of: _tab(label), matching: find.byType(Material)).first).color;

Color? _iconColor(WidgetTester tester, String label) =>
    tester.widget<Icon>(find.descendant(of: _tab(label), matching: find.byType(Icon)).first).color;

DeckBar _bar({
  int current = 0,
  ScreenSizeClass sizeClass = ScreenSizeClass.regular,
  bool square = false,
  BottomNavModeConfig? mode,
  ValueChanged<int>? onNavigate,
  VoidCallback? onMore,
  VoidCallback? onMode,
  VoidCallback? onSettings,
  List<DeckNavTabData> tabs = _tabs,
}) => DeckBar(
  homeTab: _home,
  tabs: tabs,
  currentIndex: current,
  onNavigateToIndex: onNavigate ?? (_) {},
  onMoreTapped: onMore ?? () {},
  mode: mode,
  onModeTapped: onMode ?? () {},
  onSettingsTapped: onSettings,
  sizeClass: sizeClass,
  square: square,
);

DeckDock _dock({
  int current = 0,
  ScreenSizeClass sizeClass = ScreenSizeClass.regular,
  ValueChanged<int>? onNavigate,
  VoidCallback? onMore,
  VoidCallback? onSettings,
  List<DeckNavTabData> tabs = _tabs,
}) => DeckDock(
  homeTab: _home,
  tabs: tabs,
  currentIndex: current,
  onNavigateToIndex: onNavigate ?? (_) {},
  onMoreTapped: onMore ?? () {},
  onSettingsTapped: onSettings,
  sizeClass: sizeClass,
);

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
    locator.registerSingleton<EventBus>(EventBus());
  });

  tearDownAll(() async {
    await locator.reset();
  });

  group('Deck bar', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            SizedBox(width: 600, child: _bar(current: 1, sizeClass: sizeClass, onSettings: () {})),
            brightness: brightness,
          );

          final neutrals = _neutrals(brightness);
          final accent = _accent(brightness);
          final bar = find.byType(DeckBar);
          expect(tester.getSize(bar).height, DeckNavMetrics.barHeightFor(sizeClass));

          final decoration = tester.widget<Container>(find.descendant(of: bar, matching: find.byType(Container)).first).decoration! as BoxDecoration;
          expect(decoration.color, neutrals.surfaceCard);
          expect((decoration.border! as Border).top.color, neutrals.borderLight);

          final extent = DeckNavMetrics.tabFor(sizeClass, landscape: false);
          expect(tester.getSize(_tab('Climate')), Size(extent, extent));
          expect(tester.getSize(_tab('Home')), Size(extent, extent));

          // The current page: the accent's tint and colour.
          expect(_fill(tester, 'Lights'), accent.soft);
          expect(_iconColor(tester, 'Lights'), accent.text);
          expect(tester.getSize(_tab('Lights')).height, extent);
          expect(_fill(tester, 'Climate'), AppColors.blank);
          expect(_iconColor(tester, 'Climate'), neutrals.textSecondary);

          // A label on the current tab, except on Compact.
          final label = find.descendant(of: _tab('Lights'), matching: find.textContaining('Lights'));
          expect(label, sizeClass == ScreenSizeClass.compact ? findsNothing : findsOneWidget);
          expect(find.descendant(of: _tab('Climate'), matching: find.textContaining('Climate')), findsNothing);
          if (sizeClass != ScreenSizeClass.compact) {
            expect(tester.getSize(_tab('Lights')).width, greaterThan(extent));
          }

          // All pages: filled, with its count; the gear at the end.
          expect(_fill(tester, 'All pages'), neutrals.fillBase);
          expect(find.descendant(of: _tab('All pages'), matching: find.text('3')), findsOneWidget);
          expect(tester.getRect(_tab('Settings')).right, greaterThan(tester.getRect(_tab('All pages')).right));
          expect(_iconColor(tester, 'Settings'), neutrals.textSecondary);
          expect(
            tester.getSize(find.descendant(of: _tab('Climate'), matching: find.byType(Icon)).first).width,
            DeckNavMetrics.iconFor(sizeClass),
          );
        });
      }
    }

    testWidgets('the square: a 40 high bar with 36 tabs', (tester) async {
      await _pump(
        tester,
        SizedBox(width: 282, child: _bar(sizeClass: ScreenSizeClass.compact, square: true, onSettings: () {})),
      );

      expect(tester.getSize(find.byType(DeckBar)).height, 40);
      expect(tester.getSize(_tab('Climate')), const Size(36, 36));
      expect(tester.getSize(_tab('Settings')), const Size(36, 36));
    });

    testWidgets('holds at 208 wide with a mode button: the gear gives way so the current tab shows', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 208,
          child: _bar(current: 4, sizeClass: ScreenSizeClass.compact, mode: _mode(), onSettings: () {}),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(_tab('Settings'), findsNothing);
      final bar = tester.getRect(find.byType(DeckBar));
      for (final label in ['Home', 'All pages', 'Lights mode: Relax']) {
        expect(tester.getRect(_tab(label)).right, lessThanOrEqualTo(bar.right + 0.01), reason: label);
      }
      // The current tab is scrolled into view.
      final media = tester.getRect(_tab('Media'));
      final allPages = tester.getRect(_tab('All pages'));
      expect(media.right, lessThanOrEqualTo(allPages.left + 0.01));
      expect(media.left, greaterThanOrEqualTo(tester.getRect(_tab('Home')).right));
    });

    testWidgets('keeps the gear at 208 wide without a mode button', (tester) async {
      await _pump(
        tester,
        SizedBox(width: 208, child: _bar(current: 4, sizeClass: ScreenSizeClass.compact, onSettings: () {})),
      );

      expect(tester.takeException(), isNull);
      expect(_tab('Settings'), findsOneWidget);
      final media = tester.getRect(_tab('Media'));
      expect(media.right, lessThanOrEqualTo(tester.getRect(_tab('All pages')).left + 0.01));
      expect(media.left, greaterThanOrEqualTo(tester.getRect(_tab('Home')).right));
    });

    testWidgets('taps: a page, All pages, the mode button and the gear', (tester) async {
      final pages = <int>[];
      var more = 0, mode = 0, settings = 0;
      await _pump(
        tester,
        SizedBox(
          width: 640,
          child: _bar(
            mode: _mode(),
            onNavigate: pages.add,
            onMore: () => more++,
            onMode: () => mode++,
            onSettings: () => settings++,
          ),
        ),
      );

      await tester.tap(_tab('Climate'));
      await tester.tap(_tab('Home'));
      await tester.tap(_tab('All pages'));
      await tester.tap(_tab('Lights mode: Relax'));
      await tester.tap(_tab('Settings'));
      await tester.pump();

      expect(pages, [2, 0]);
      expect((more, mode, settings), (1, 1, 1));
      expect(_iconColor(tester, 'Lights mode: Relax'), ThemeColorFamily.get(Brightness.light, ThemeColors.lights).base);
    });

    testWidgets('no gear without onSettingsTapped', (tester) async {
      await _pump(tester, SizedBox(width: 640, child: _bar()));

      expect(_tab('Settings'), findsNothing);
      expect(find.byIcon(MdiIcons.cogOutline), findsNothing);
    });

    testWidgets('screen readers hear each tab, the current one selected and the count', (tester) async {
      final handle = tester.ensureSemantics();
      var settings = 0;
      await _pump(tester, SizedBox(width: 640, child: _bar(current: 1, onSettings: () => settings++)));

      expect(
        tester.getSemantics(_tab('Lights')),
        isSemantics(label: 'Lights', isButton: true, isSelected: true, hasTapAction: true),
      );
      expect(tester.getSemantics(_tab('Climate')), isSemantics(label: 'Climate', isSelected: false));
      expect(tester.getSemantics(_tab('All pages')).value, '3');

      tester.semantics.tap(find.semantics.byLabel('Settings'));
      expect(settings, 1);
      handle.dispose();
    });

    testWidgets('keeps the current tab in view when All pages appears and narrows the tabs', (tester) async {
      // 260 wide: the tabs scroll in 157, Energy (the last) is at the end.
      Widget bar(List<DeckNavTabData> tabs) => SizedBox(
        width: 260,
        child: _bar(current: 5, sizeClass: ScreenSizeClass.compact, onSettings: () {}, tabs: tabs),
      );
      final pagesOnly = _tabs.where((tab) => !tab.isMore).toList();

      await _pump(tester, bar(pagesOnly));
      expect(_inView(tester, 'Energy', find.byType(DeckBar)), isTrue);

      // The first dashboard: All pages takes 40 from the tabs' area.
      await tester.pumpWidget(_app(bar(_tabs)));
      await tester.pumpAndSettle();
      expect(_inView(tester, 'Energy', find.byType(DeckBar)), isTrue);
    });

    testWidgets('keeping the current tab in view scrolls only the bar', (tester) async {
      final outer = ScrollController(initialScrollOffset: 40);
      addTearDown(outer.dispose);

      Widget page(int current) => SizedBox(
        width: 240,
        height: 200,
        child: SingleChildScrollView(
          controller: outer,
          child: Column(
            children: [
              const SizedBox(height: 300),
              _bar(current: current, sizeClass: ScreenSizeClass.compact, onSettings: () {}),
              const SizedBox(height: 300),
            ],
          ),
        ),
      );

      await _pump(tester, page(0));
      await tester.pumpWidget(_app(page(5)));
      await tester.pumpAndSettle();

      expect(outer.offset, 40);
      final inner = tester.state<ScrollableState>(
        find.descendant(of: find.byType(DeckBar), matching: find.byType(Scrollable)),
      );
      expect(inner.position.pixels, greaterThan(0));
    });

    testWidgets('the lock badge slot is empty by default and takes a badge', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 640,
          child: _bar(
            tabs: const [
              DeckNavTabData(icon: Icons.shield, label: 'Security', pageIndex: 1, lockBadge: Icon(Icons.lock, key: ValueKey('lock'))),
              DeckNavTabData(icon: Icons.lightbulb_outline, label: 'Lights', pageIndex: 2),
            ],
          ),
        ),
      );

      expect(find.descendant(of: _tab('Security'), matching: find.byKey(const ValueKey('lock'))), findsOneWidget);
      expect(find.descendant(of: _tab('Lights'), matching: find.byType(Positioned)), findsNothing);
    });
  });

  group('Deck dock', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            SizedBox(height: 520, child: _dock(current: 2, sizeClass: sizeClass, onSettings: () {})),
            brightness: brightness,
          );

          final neutrals = _neutrals(brightness);
          final accent = _accent(brightness);
          final inset = DeckNavMetrics.dockInsetFor(sizeClass);
          final width = DeckNavMetrics.dockWidthFor(sizeClass);
          expect(tester.getSize(find.byType(DeckDock)).width, width + inset);

          final surface = find.descendant(
            of: find.byType(DeckDock),
            matching: find.byWidgetPredicate((widget) => widget is Container && widget.decoration != null),
          ).first;
          final decoration = tester.widget<Container>(surface).decoration! as BoxDecoration;
          expect(tester.getSize(surface).width, width);
          expect(decoration.color, neutrals.surfaceCard);
          expect(decoration.borderRadius, BorderRadius.circular(12));
          expect((decoration.border! as Border).top.color, neutrals.borderLight);

          final extent = DeckNavMetrics.tabFor(sizeClass, landscape: true);
          // Inside the dock's padding and its 1 px outline.
          expect(tester.getSize(_tab('Climate')), Size(width - 2 * DeckNavMetrics.dockPadding - 2, extent));
          expect(tester.getSize(_tab('Settings')).height, DeckNavMetrics.settingsFor(sizeClass));
          expect(_fill(tester, 'Climate'), accent.soft);
          expect(_iconColor(tester, 'Climate'), accent.text);
          expect(_iconColor(tester, 'Lights'), neutrals.textSecondary);

          // Labels under every icon on Expanded only.
          final labels = find.descendant(of: _tab('Lights'), matching: find.text('Lights'));
          expect(labels, sizeClass == ScreenSizeClass.expanded ? findsOneWidget : findsNothing);

          // The gear sits at the foot.
          final dock = tester.getRect(surface);
          expect(dock.bottom - tester.getRect(_tab('Settings')).bottom, closeTo(DeckNavMetrics.dockPadding + 1, 0.01));
          expect(tester.takeException(), isNull);
        });
      }
    }

    testWidgets('taps: a page, All pages and the gear', (tester) async {
      final pages = <int>[];
      var more = 0, settings = 0;
      await _pump(
        tester,
        SizedBox(
          height: 520,
          child: _dock(onNavigate: pages.add, onMore: () => more++, onSettings: () => settings++),
        ),
      );

      await tester.tap(_tab('Shading'));
      await tester.tap(_tab('All pages'));
      await tester.tap(_tab('Settings'));
      await tester.pump();

      expect(pages, [3]);
      expect((more, settings), (1, 1));
    });

    testWidgets('a short dock scrolls its page tabs', (tester) async {
      await _pump(tester, SizedBox(height: 240, child: _dock(current: 5, sizeClass: ScreenSizeClass.compact, onSettings: () {})));

      expect(tester.takeException(), isNull);
      final inner = tester.state<ScrollableState>(find.descendant(of: find.byType(DeckDock), matching: find.byType(Scrollable)));
      expect(inner.position.maxScrollExtent, greaterThan(0));
      // And the current tab is scrolled into view.
      expect(_inView(tester, 'Energy', find.byType(DeckDock)), isTrue);
    });

    testWidgets('keeps the current tab in view when All pages appears and shortens the tabs', (tester) async {
      Widget dock(List<DeckNavTabData> tabs) => SizedBox(
        height: 240,
        child: _dock(current: 5, sizeClass: ScreenSizeClass.compact, onSettings: () {}, tabs: tabs),
      );
      final pagesOnly = _tabs.where((tab) => !tab.isMore).toList();

      await _pump(tester, dock(pagesOnly));
      expect(_inView(tester, 'Energy', find.byType(DeckDock)), isTrue);

      await tester.pumpWidget(_app(dock(_tabs)));
      await tester.pumpAndSettle();
      expect(_inView(tester, 'Energy', find.byType(DeckDock)), isTrue);
    });
  });

  group('All pages', () {
    const entries = [
      DeckNavTabData(icon: Icons.home, label: 'Home', pageIndex: 0),
      DeckNavTabData(icon: Icons.lightbulb_outline, label: 'Lights', pageIndex: 1),
      DeckNavTabData(icon: Icons.thermostat, label: 'Climate', pageIndex: 2),
      DeckNavTabData(icon: Icons.blinds, label: 'Shading', pageIndex: 3),
      DeckNavTabData(icon: Icons.shield, label: 'Security', pageIndex: 4, lockBadge: Icon(Icons.lock, key: ValueKey('lock'))),
    ];

    Finder tile(String label) => find.byWidgetPredicate((widget) => widget is Semantics && widget.properties.label == label);

    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('the grid at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            SizedBox(
              width: 400,
              child: DeckAllPagesGrid(
                entries: entries,
                currentIndex: 1,
                onSelect: (_) {},
                onOpenSettings: () {},
                sizeClass: sizeClass,
              ),
            ),
            brightness: brightness,
          );

          final neutrals = _neutrals(brightness);
          final accent = _accent(brightness);
          final minWidth = AllPagesMetrics.tileMinWidthFor(sizeClass);
          final columns = ((400 + 4) / (minWidth + 4)).floor().clamp(3, 100);
          final width = (400 - (columns - 1) * AllPagesMetrics.gap) / columns;

          expect(tester.getSize(tile('Home')), Size(width, AllPagesMetrics.tileHeightFor(sizeClass)));
          // Settings is the last tile.
          final settings = tester.getRect(tile('Settings'));
          expect(settings.top, greaterThanOrEqualTo(tester.getRect(tile('Security')).top));

          final current = tester.widget<Material>(find.descendant(of: tile('Lights'), matching: find.byType(Material)).first);
          expect(current.color, accent.soft);
          expect((current.shape! as RoundedRectangleBorder).side.color, accent.text);
          final other = tester.widget<Material>(find.descendant(of: tile('Climate'), matching: find.byType(Material)).first);
          expect(other.color, neutrals.fillLight);
          expect(tester.widget<Text>(find.text('Climate')).style!.fontSize, AllPagesMetrics.labelFor(sizeClass));
          expect(find.descendant(of: tile('Security'), matching: find.byKey(const ValueKey('lock'))), findsOneWidget);
        });
      }
    }

    testWidgets('never fewer than three columns, and the square sizes', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 150,
          child: DeckAllPagesGrid(
            entries: entries,
            currentIndex: 0,
            onSelect: (_) {},
            sizeClass: ScreenSizeClass.compact,
            square: true,
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(tester.getSize(tile('Home')), Size((150 - 2 * AllPagesMetrics.gap) / 3, 46));
      expect(tile('Settings'), findsNothing);
    });

    testWidgets('the sheet: a page closes it and navigates; Settings closes it and opens Settings', (tester) async {
      final pages = <int>[];
      var settings = 0;

      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showMoreSheet(
              context,
              currentIndex: 0,
              onNavigateToIndex: pages.add,
              onOpenSettings: () => settings++,
            ),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheetDialog), findsOneWidget);
      expect(find.text('All pages'), findsOneWidget);
      expect(find.byType(DeckAllPagesGrid), findsOneWidget);
      await tester.tap(find.text('Shading'));
      await tester.pumpAndSettle();
      expect(pages, [3]);
      expect(find.byType(BottomSheetDialog), findsNothing);

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Settings'));
      await tester.pumpAndSettle();
      expect(settings, 1);
      expect(find.byType(BottomSheetDialog), findsNothing);
    });

    testWidgets('the sheet follows the deck: a tile opens the page it names after a reorder', (tester) async {
      final pages = <int>[];
      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showMoreSheet(context, currentIndex: 0, onNavigateToIndex: pages.add),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      // Shading moves from 3 to 2.
      final deck = tester.element(find.text('open')).read<DeckService>() as _FakeDeckService;
      deck.replace([_items[0], _items[4], _items[3], _items[2], _items[1]]);
      await tester.pumpAndSettle();

      await tester.tap(find.text(DomainType.shading.label));
      await tester.pumpAndSettle();
      expect(pages, [2]);
    });

    testWidgets('an unbounded width (a sideways scroll) gives each tile its narrowest width', (tester) async {
      await _pump(
        tester,
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DeckAllPagesGrid(
            entries: entries,
            currentIndex: 0,
            onSelect: (_) {},
            sizeClass: ScreenSizeClass.compact,
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(tester.getSize(tile('Home')).width, AllPagesMetrics.tileMinWidthFor(ScreenSizeClass.compact));
    });

    test('the entries follow the deck, one per item', () {
      final localizations = lookupAppLocalizations(const Locale('en'));
      final entries = buildAllPagesEntries(_items, localizations);

      expect(entries.map((entry) => entry.pageIndex), [0, 1, 2, 3, 4]);
      expect(entries.first.label, localizations.system_view_master);
      expect(entries[1].label, DomainType.lights.label);
    });
  });

  group('Wired to the deck', () {
    testWidgets('the bar and the dock read the deck and show the gear', (tester) async {
      var settings = 0;
      await _pump(
        tester,
        SizedBox(
          width: 640,
          height: 400,
          child: Column(
            children: [
              Expanded(
                child: DeckSideDock(currentIndex: 0, onNavigateToIndex: (_) {}, onSettingsTapped: () => settings++),
              ),
              DeckBottomNavBar(currentIndex: 0, onNavigateToIndex: (_) {}, onSettingsTapped: () => settings++),
            ],
          ),
        ),
      );

      expect(find.byType(DeckDock), findsOneWidget);
      expect(find.byType(DeckBar), findsOneWidget);
      expect(_tab(DomainType.climate.label), findsNWidgets(2));
      await tester.tap(_tab('Settings').first);
      await tester.tap(_tab('Settings').last);
      expect(settings, 2);
    });

    testWidgets('All pages shows without dashboards, so its Settings entry stays reachable', (tester) async {
      var more = 0;
      await _pump(
        tester,
        SizedBox(
          width: 640,
          height: 400,
          child: Column(
            children: [
              Expanded(
                child: DeckSideDock(currentIndex: 0, onNavigateToIndex: (_) {}, onMoreTapped: () => more++),
              ),
              DeckBottomNavBar(currentIndex: 0, onNavigateToIndex: (_) {}, onMoreTapped: () => more++),
            ],
          ),
        ),
      );

      // _items has no dashboard pages.
      expect(_tab('All pages'), findsNWidgets(2));
      expect(tester.widget<DeckNavTab>(_tab('All pages').first).badgeCount, 0);
      await tester.tap(_tab('All pages').first);
      await tester.tap(_tab('All pages').last);
      expect(more, 2);
    });

    testWidgets('the bar shows the mode button a domain registers', (tester) async {
      await _pump(
        tester,
        SizedBox(width: 640, child: DeckBottomNavBar(currentIndex: 0, onNavigateToIndex: (_) {})),
      );

      expect(_tab('Lights mode: Relax'), findsNothing);
      tester.element(find.byType(DeckBottomNavBar)).read<BottomNavModeNotifier>().setConfig(_mode());
      await tester.pumpAndSettle();
      expect(_tab('Lights mode: Relax'), findsOneWidget);
    });
  });

  group('Pull handle', () {
    for (final brightness in _brightnesses) {
      testWidgets('a 28 × 4 grip in a 56 × 36 zone in ${brightness.name}', (tester) async {
        final handle = tester.ensureSemantics();
        var opened = 0;
        await _pump(tester, DeckPullHandle(label: 'Open settings', onOpen: () => opened++), brightness: brightness);

        expect(tester.getSize(find.byType(DeckPullHandle)), const Size(56, 36));
        final grip = find.descendant(of: find.byType(DeckPullHandle), matching: find.byType(Container));
        expect(tester.getSize(grip), const Size(28, 4));
        expect(tester.getTopLeft(grip).dy - tester.getTopLeft(find.byType(DeckPullHandle)).dy, 3);
        expect((tester.widget<Container>(grip).decoration! as BoxDecoration).color, AppControlColors.handle(brightness));

        // Screen readers get one button that opens Settings.
        tester.semantics.tap(find.semantics.byLabel('Open settings'));
        expect(opened, 1);
        handle.dispose();
      });
    }

    /// The deck's layout: the handle at the top centre, over a 208 wide page
    /// whose header has a button under the handle's zone.
    Widget page({required VoidCallback onButton, required VoidCallback onOpen}) => SizedBox(
      width: 208,
      height: 300,
      child: Stack(
        children: [
          Scaffold(
            body: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.only(top: 6),
                child: SizedBox(
                  width: 120,
                  height: 36,
                  child: TextButton(onPressed: onButton, child: const Text('Remote')),
                ),
              ),
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Center(child: DeckPullHandle(label: 'Open settings', onOpen: onOpen)),
          ),
        ],
      ),
    );

    testWidgets('a tap in its zone reaches the header button under it', (tester) async {
      var button = 0, opened = 0;
      await _pump(tester, page(onButton: () => button++, onOpen: () => opened++));

      final zone = tester.getRect(find.byType(DeckPullHandle));
      expect(zone.overlaps(tester.getRect(find.byType(TextButton))), isTrue);
      await tester.tapAt(zone.center);
      await tester.tapAt(Offset(zone.center.dx, zone.top + 10));
      await tester.pumpAndSettle();

      expect(button, 2);
      expect(opened, 0);
    });

    testWidgets('a pull down from it opens Settings once; sideways or short does not', (tester) async {
      var button = 0, opened = 0;
      await _pump(tester, page(onButton: () => button++, onOpen: () => opened++));
      final start = tester.getRect(find.byType(DeckPullHandle)).center;

      // Exact distances: dragFrom would add the touch slop.
      Future<void> pull(Offset by) async {
        final gesture = await tester.startGesture(start);
        for (var i = 1; i <= 10; i++) {
          await gesture.moveTo(start + by * (i / 10));
        }
        await gesture.up();
        await tester.pumpAndSettle();
      }

      // Under the touch slop it is a tap, and the button under it takes it.
      await pull(const Offset(0, 15));
      expect((opened, button), (0, 1), reason: 'short');
      await pull(const Offset(60, 0));
      expect((opened, button), (0, 1), reason: 'sideways');

      // A pull opens Settings and does not also press the button.
      await pull(const Offset(0, 80));
      expect((opened, button), (1, 1));
    });

    testWidgets('one move just past the pull, then release, opens Settings', (tester) async {
      var button = 0, opened = 0;
      await _pump(tester, page(onButton: () => button++, onOpen: () => opened++));
      final start = tester.getRect(find.byType(DeckPullHandle)).center;

      // The move that wins the arena counts toward the pull.
      final gesture = await tester.startGesture(start);
      await gesture.moveBy(const Offset(0, 24));
      await gesture.up();
      await tester.pumpAndSettle();

      expect((opened, button), (1, 0));
    });

    testWidgets('an upward drag from it scrolls the page under it', (tester) async {
      var opened = 0;
      final list = ScrollController();
      addTearDown(list.dispose);

      await _pump(
        tester,
        SizedBox(
          width: 208,
          height: 300,
          child: Stack(
            children: [
              ListView(
                controller: list,
                children: [for (var i = 0; i < 30; i++) SizedBox(height: 40, child: Text('Row $i'))],
              ),
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Center(child: DeckPullHandle(label: 'Open settings', onOpen: () => opened++)),
              ),
            ],
          ),
        ),
      );

      final start = tester.getRect(find.byType(DeckPullHandle)).center;
      final gesture = await tester.startGesture(start);
      for (var i = 1; i <= 10; i++) {
        await gesture.moveTo(start - Offset(0, 6.0 * i));
      }
      await gesture.up();
      await tester.pumpAndSettle();

      expect(list.offset, greaterThan(0));
      expect(opened, 0);
    });
  });

  test('metrics follow the spec', () {
    expect(_classes.map(DeckNavMetrics.dockWidthFor), [44, 56, 84]);
    expect(_classes.map(DeckNavMetrics.barHeightFor), [44, 52, 56]);
    expect(DeckNavMetrics.barHeightFor(ScreenSizeClass.compact, square: true), 40);
    expect(_classes.map((c) => DeckNavMetrics.tabFor(c, landscape: true)), [38, 44, 56]);
    expect(_classes.map((c) => DeckNavMetrics.tabFor(c, landscape: false)), [38, 44, 44]);
    expect(DeckNavMetrics.tabFor(ScreenSizeClass.compact, landscape: false, square: true), 36);
    expect(_classes.map(DeckNavMetrics.settingsFor), [36, 40, 40]);
  });
}
