import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_banner.dart';
import 'package:fastybird_smart_panel/core/widgets/app_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/app_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/list_row.dart';
import 'package:fastybird_smart_panel/core/widgets/right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_selection_dialog.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

const _classes = [
  ScreenSizeClass.compact,
  ScreenSizeClass.regular,
  ScreenSizeClass.expanded,
];

const _brightnesses = [Brightness.light, Brightness.dark];

ThemeData _theme(Brightness brightness) => brightness == Brightness.dark
    ? AppTheme.darkThemeFor(AppAccent.blue)
    : AppTheme.lightThemeFor(AppAccent.blue);

AppNeutralPalette _neutrals(Brightness brightness) =>
    AppNeutralPalette.of(brightness);

AppAccentPalette _accent(Brightness brightness) =>
    AppAccentPalette.of(AppAccent.blue, brightness);

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.light,
}) async {
  tester.view.physicalSize = const Size(1280, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
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
    ),
  );
}

/// The decoration of the nearest [Container] with a [BoxDecoration] above
/// [finder].
BoxDecoration _decorationAbove(WidgetTester tester, Finder finder) {
  final containers = tester.widgetList<Container>(
    find.ancestor(of: finder, matching: find.byType(Container)),
  );

  return containers
      .map((c) => c.decoration)
      .whereType<BoxDecoration>()
      .firstWhere((d) => d.color != null);
}

/// The material of the list row titled [title].
Material _rowMaterial(WidgetTester tester, String title) => tester.widget<Material>(
  find
      .ancestor(of: find.text(title), matching: find.byType(Material))
      .first,
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

  group('AppListRow', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('layout at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            SizedBox(
              width: 320,
              child: AppListRow(title: 'Screen saver', sizeClass: sizeClass),
            ),
            brightness: brightness,
          );

          final neutrals = _neutrals(brightness);
          expect(
            tester.getSize(find.byType(AppListRow)).height,
            AppListRowMetrics.heightFor(sizeClass),
          );
          final material = _rowMaterial(tester, 'Screen saver');
          expect(material.color, neutrals.surfaceCard);
          final shape = material.shape! as RoundedRectangleBorder;
          expect(shape.side.color, neutrals.borderLight);
          expect(shape.borderRadius, BorderRadius.circular(8));

          final title = tester.widget<Text>(find.text('Screen saver'));
          expect(title.style!.fontSize, 14);
          expect(title.style!.fontWeight, FontWeight.w500);
          expect(title.style!.color, neutrals.textPrimary);
        });
      }
    }

    testWidgets('a subtitle is 10 in text.secondary and the row grows to hold it', (tester) async {
      // The test font is as wide as it is high: 17 characters a line.
      const text = 'Flip clock after the lock delay';
      await _pump(
        tester,
        const SizedBox(
          width: 200,
          child: AppListRow(title: 'Screen saver', subtitle: text, sizeClass: ScreenSizeClass.compact),
        ),
      );

      final subtitle = tester.widget<Text>(find.text(text));
      expect(subtitle.style!.fontSize, 10);
      expect(subtitle.style!.color, AppNeutralPalette.light.textSecondary);

      // The subtitle wraps to two lines, all shown, and the row grows past
      // its 40 px minimum to hold the title and both lines.
      final paragraph = tester.renderObject<RenderParagraph>(find.text(text));
      expect(paragraph.didExceedMaxLines, isFalse);
      expect(paragraph.size.height, greaterThan(20));
      final row = tester.getRect(find.byType(AppListRow));
      expect(row.height, greaterThan(40));
      expect(row.contains(tester.getRect(find.text('Screen saver')).topLeft), isTrue);
      expect(tester.getRect(find.text(text)).bottom, lessThanOrEqualTo(row.bottom));
    });

    testWidgets('without a bounded width (a horizontal scroll) the row takes its natural width', (tester) async {
      for (final trailing in [null, const Text('5 min')]) {
        await _pump(
          tester,
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: AppListRow(title: 'Screen saver', icon: MdiIcons.monitor, trailing: trailing),
          ),
        );

        expect(tester.takeException(), isNull);
        expect(tester.getSize(find.text('Screen saver')).width, greaterThan(0));
      }
    });

    testWidgets('in a narrow row with an icon, the trailing cap leaves the title room', (tester) async {
      // 65 px inside the padding: the icon and two gaps take 32 px, and the
      // control may take 60 % of the 33 px left.
      await _pump(
        tester,
        SizedBox(
          width: 65 + AppListRowMetrics.paddingStart + AppListRowMetrics.paddingEndControl,
          child: AppListRow(
            title: 'Screen saver',
            icon: MdiIcons.monitor,
            trailing: const Text('Flip clock', maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.text('Screen saver')).width, greaterThan(0));
      expect(tester.getSize(find.text('Flip clock')).width, lessThanOrEqualTo(0.6 * 33 + 0.01));
    });

    testWidgets('a disabled row disables its trailing control: taps, focus and semantics', (tester) async {
      final handle = tester.ensureSemantics();
      var changes = 0;

      Future<void> pumpRow({required bool enabled}) => _pump(
        tester,
        SizedBox(
          width: 320,
          child: AppListRow(
            title: 'Wake word',
            enabled: enabled,
            trailing: AppSwitch(value: false, onChanged: (_) => changes++),
          ),
        ),
      );

      await pumpRow(enabled: false);
      await tester.tap(find.byType(AppSwitch), warnIfMissed: false);
      await tester.pump();
      expect(changes, 0);
      expect(
        tester.getSemantics(find.byType(AppSwitch)).getSemanticsData().hasAction(SemanticsAction.tap),
        isFalse,
      );
      expect(
        tester.widget<ExcludeFocus>(
          find.ancestor(of: find.byType(AppSwitch), matching: find.byType(ExcludeFocus)).first,
        ).excluding,
        isTrue,
      );

      await pumpRow(enabled: true);
      await tester.tap(find.byType(AppSwitch));
      await tester.pump();
      expect(changes, 1);
      handle.dispose();
    });

    for (final brightness in _brightnesses) {
      testWidgets('selected, danger and disabled in ${brightness.name}', (tester) async {
        await _pump(
          tester,
          const SizedBox(
            width: 320,
            child: Column(
              children: [
                AppListRow(title: 'Relax', selected: true),
                AppListRow(title: 'Factory reset', danger: true),
                AppListRow(title: 'Wake word', enabled: false),
              ],
            ),
          ),
          brightness: brightness,
        );

        final accent = _accent(brightness);
        final selected = _rowMaterial(tester, 'Relax');
        expect(selected.color, accent.soft);
        expect((selected.shape! as RoundedRectangleBorder).side.color, accent.text);

        final danger = AppStatusPalette.of(brightness, AppStatus.danger);
        expect(tester.widget<Text>(find.text('Factory reset')).style!.color, danger.text);
        expect(
          (_rowMaterial(tester, 'Factory reset').shape! as RoundedRectangleBorder).side.color,
          danger.border,
        );

        expect(
          tester.widget<Text>(find.text('Wake word')).style!.color,
          _neutrals(brightness).textDisabled,
        );
      });
    }

    testWidgets('a tappable row is one button; a disabled one does not react', (tester) async {
      final handle = tester.ensureSemantics();
      var taps = 0;
      await _pump(
        tester,
        SizedBox(
          width: 320,
          child: Column(
            children: [
              AppListRow(title: 'Screen lock delay', onTap: () => taps++),
              AppListRow(title: 'Off', onTap: () => taps++, enabled: false),
            ],
          ),
        ),
      );

      await tester.tap(find.text('Screen lock delay'));
      await tester.tap(find.text('Off'));
      expect(taps, 1);
      expect(
        tester.getSemantics(find.text('Screen lock delay')),
        matchesSemantics(
          label: 'Screen lock delay',
          isButton: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
          hasFocusAction: true,
          isFocusable: true,
        ),
      );
      handle.dispose();
    });

    testWidgets('a wide trailing control leaves the title room and the title ellipsizes', (tester) async {
      await _pump(
        tester,
        const SizedBox(
          width: 240,
          child: AppListRow(
            title: 'A very long settings row title that cannot fit',
            trailing: SizedBox(width: 400, height: 36),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      // The trailing control takes at most 60 % of the row's content width.
      final trailing = tester.getSize(find.byWidgetPredicate((w) => w is SizedBox && w.width == 400));
      expect(trailing.width, lessThanOrEqualTo(240 * AppListRowMetrics.trailingShare));
    });
  });

  group('Section label', () {
    for (final brightness in _brightnesses) {
      testWidgets('10/700 uppercase in text.secondary in ${brightness.name}', (tester) async {
        final handle = tester.ensureSemantics();
        await _pump(
          tester,
          const SizedBox(width: 320, child: SectionLabel(label: 'Units')),
          brightness: brightness,
        );

        final text = tester.widget<Text>(find.text('UNITS'));
        expect(text.style!.fontSize, 10);
        expect(text.style!.fontWeight, FontWeight.w700);
        expect(text.style!.letterSpacing, closeTo(0.6, 0.001));
        expect(text.style!.color, _neutrals(brightness).textSecondary);
        expect(tester.getSemantics(find.text('UNITS')), matchesSemantics(label: 'UNITS', isHeader: true));
        handle.dispose();
      });
    }

    testWidgets('SectionTitle and SectionHeader draw the one label; a colour brings its icon', (tester) async {
      final danger = AppStatusPalette.of(Brightness.light, AppStatus.danger).text;
      await _pump(
        tester,
        SizedBox(
          width: 320,
          child: Column(
            children: [
              SectionTitle(title: 'Sensors', icon: MdiIcons.eye),
              SectionTitle(title: 'Danger', icon: MdiIcons.alertOutline, color: danger),
              SectionHeader(title: 'Devices', icon: MdiIcons.devices, count: 5),
            ],
          ),
        ),
      );

      expect(find.byType(SectionLabel), findsNWidgets(3));
      // No colour: no icon. With a colour: the icon in that colour.
      expect(find.byIcon(MdiIcons.eye), findsNothing);
      expect(tester.widget<Icon>(find.byIcon(MdiIcons.alertOutline)).color, danger);
      expect(tester.widget<Text>(find.text('DANGER')).style!.color, danger);
      expect(find.text('5'), findsOneWidget);
      expect(find.byIcon(MdiIcons.devices), findsNothing);
    });

    testWidgets('a long action ellipsizes and leaves the heading room', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 200,
          child: SectionLabel(
            label: 'Lights',
            trailing: SectionTitleButton(
              label: 'Turn off every light in this room right now',
              icon: MdiIcons.power,
              onTap: () {},
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.text('LIGHTS')).width, greaterThan(50));
      expect(tester.getSize(find.byType(SectionTitleButton)).width, lessThanOrEqualTo(100));

      // A short action keeps its natural width, also with no width to share.
      await _pump(
        tester,
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SectionTitleButton(label: 'All off', onTap: () {}),
        ),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('a section action is at least 36 high', (tester) async {
      var taps = 0;
      await _pump(
        tester,
        SectionTitleButton(label: 'All off', onTap: () => taps++),
      );

      expect(tester.getSize(find.byType(SectionTitleButton)).height, greaterThanOrEqualTo(36));
      await tester.tap(find.text('All off'));
      expect(taps, 1);
    });
  });

  group('Bottom sheet and right drawer', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('the sheet at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            SizedBox(
              width: 400,
              child: BottomSheetDialog(
                title: 'Light roles',
                subtitle: '3 roles',
                sizeClass: sizeClass,
                content: const SizedBox(height: 40),
              ),
            ),
            brightness: brightness,
          );

          final neutrals = _neutrals(brightness);
          final decoration = _decorationAbove(tester, find.text('Light roles'));
          expect(decoration.color, neutrals.surfaceRaised);
          expect((decoration.border! as Border).top.color, neutrals.borderLight);
          expect(decoration.borderRadius, const BorderRadius.vertical(top: Radius.circular(12)));
          // One soft shadow in light, none in dark.
          expect(decoration.boxShadow, brightness == Brightness.light ? hasLength(1) : isNull);

          // The grab handle: 28 × 4.
          final handle = tester.widget<Container>(
            find.byWidgetPredicate(
              (w) =>
                  w is Container &&
                  w.decoration is BoxDecoration &&
                  (w.decoration! as BoxDecoration).color == AppControlColors.handle(brightness),
            ),
          );
          expect(handle.constraints, BoxConstraints.tightFor(width: 28, height: 4));

          final title = tester.widget<Text>(find.text('Light roles'));
          expect(title.style!.fontSize, SheetMetrics.titleFor(sizeClass));
          expect(title.style!.fontWeight, FontWeight.w500);
          expect(tester.widget<Text>(find.text('3 roles')).style!.color, neutrals.textSecondary);

          // The close button: 36 on fill.base.
          expect(tester.getSize(find.byType(SheetCloseButton)), const Size(36, 36));
          final close = tester.widget<Material>(
            find.descendant(of: find.byType(SheetCloseButton), matching: find.byType(Material)),
          );
          expect(close.color, neutrals.fillBase);
        });

        testWidgets('the drawer at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            SizedBox(
              width: 1000,
              height: 400,
              child: RightDrawer(
                title: 'Light roles',
                sizeClass: sizeClass,
                content: const SizedBox(height: 40),
              ),
            ),
            brightness: brightness,
          );

          final neutrals = _neutrals(brightness);
          final decoration = _decorationAbove(tester, find.text('Light roles'));
          expect(decoration.color, neutrals.surfaceRaised);
          expect(decoration.borderRadius, const BorderRadius.horizontal(left: Radius.circular(12)));
          expect(decoration.boxShadow, brightness == Brightness.light ? hasLength(1) : isNull);

          final panel = find.ancestor(of: find.text('Light roles'), matching: find.byType(Container)).last;
          expect(tester.getSize(panel).width, SheetMetrics.drawerWidthFor(sizeClass));
        });
      }
    }

    testWidgets('a sheet opens over the scrim and its close button closes it', (tester) async {
      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showBottomSheetDialog(
              context,
              title: 'Light roles',
              content: const Text('Main'),
            ),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('Main'), findsOneWidget);
      final barrier = tester.widget<ModalBarrier>(find.byType(ModalBarrier).last);
      expect(barrier.color, AppScrim.color);

      await tester.tap(find.byType(SheetCloseButton));
      await tester.pumpAndSettle();
      expect(find.text('Main'), findsNothing);
    });

    testWidgets('a custom title keeps the subtitle under it', (tester) async {
      await _pump(
        tester,
        const SizedBox(
          width: 400,
          child: BottomSheetDialog(
            titleWidget: Text('Lights'),
            subtitle: '2 devices',
            content: Text('Main'),
          ),
        ),
      );

      expect(find.text('Lights'), findsOneWidget);
      expect(find.text('2 devices'), findsOneWidget);
      expect(tester.getTopLeft(find.text('2 devices')).dy, greaterThan(tester.getTopLeft(find.text('Lights')).dy));
    });

    testWidgets('a screen reader can activate Close: it pops the route, or runs the override', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showBottomSheetDialog(context, title: 'Light roles', content: const Text('Main')),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(
        tester.getSemantics(find.byType(SheetCloseButton)),
        matchesSemantics(label: 'Close', isButton: true, hasTapAction: true),
      );
      tester.semantics.tap(find.semantics.byLabel('Close'));
      await tester.pumpAndSettle();
      expect(find.text('Main'), findsNothing);

      var closed = 0;
      await _pump(tester, SheetCloseButton(onTap: () => closed++));
      tester.semantics.tap(find.semantics.byLabel('Close'));
      expect(closed, 1);
      handle.dispose();
    });

    testWidgets('the close button builds without the app localizations', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: _theme(Brightness.light),
          home: const Scaffold(body: SheetCloseButton()),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(tester.getSemantics(find.byType(SheetCloseButton)).label, 'Close');
    });

    testWidgets('a drawer opens from the right and closes', (tester) async {
      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showRightDrawer<void>(
              context,
              title: 'Lights',
              content: const Text('Ceiling'),
            ),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('Ceiling'), findsOneWidget);
      // At the right edge of the screen.
      expect(tester.getTopRight(find.byType(RightDrawer)).dx, 1280);

      await tester.tap(find.byType(SheetCloseButton));
      await tester.pumpAndSettle();
      expect(find.text('Ceiling'), findsNothing);
    });

    testWidgets('DeckItemSheet lists its items on the raised surface', (tester) async {
      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => DeckItemSheet.showItemSheet(
              context,
              title: 'Lights',
              subtitle: '2 devices',
              itemCount: 2,
              itemBuilder: (context, index) => Text('Item $index'),
            ),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('Item 0'), findsOneWidget);
      expect(find.text('Item 1'), findsOneWidget);
      expect(find.text('2 devices'), findsOneWidget);
    });
  });

  group('Dialogs', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('the dialog at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            AppDialog(
              title: 'Restart this panel?',
              message: 'Only this display restarts.',
              sizeClass: sizeClass,
              actions: Row(
                children: [
                  Expanded(child: AppDialogButton(label: 'Cancel', onTap: () {}, sizeClass: sizeClass)),
                  Expanded(
                    child: AppDialogButton(label: 'Restart', primary: true, onTap: () {}, sizeClass: sizeClass),
                  ),
                ],
              ),
            ),
            brightness: brightness,
          );

          final neutrals = _neutrals(brightness);
          expect(tester.getSize(find.byType(AppDialog)).width, AppDialogMetrics.widthFor(sizeClass));
          final decoration = _decorationAbove(tester, find.text('Restart this panel?'));
          expect(decoration.color, neutrals.surfaceRaised);
          expect(decoration.borderRadius, BorderRadius.circular(12));

          expect(
            tester.widget<Text>(find.text('Restart this panel?')).style!.fontSize,
            AppDialogMetrics.titleFor(sizeClass),
          );
          expect(tester.widget<Text>(find.text('Only this display restarts.')).style!.color, neutrals.textSecondary);

          expect(
            tester.getSize(find.widgetWithText(AppDialogButton, 'Restart')).height,
            AppDialogMetrics.actionFor(sizeClass),
          );
          final confirm = tester.widget<Material>(
            find.descendant(of: find.widgetWithText(AppDialogButton, 'Restart'), matching: find.byType(Material)),
          );
          expect(confirm.color, _accent(brightness).fill);
          final cancel = tester.widget<Material>(
            find.descendant(of: find.widgetWithText(AppDialogButton, 'Cancel'), matching: find.byType(Material)),
          );
          expect(cancel.color, neutrals.surfaceCard);
          expect((cancel.shape! as RoundedRectangleBorder).side.color, neutrals.borderBase);
        });
      }
    }

    testWidgets('a routed dialog keeps its Compact width, below the Material 280 px floor', (tester) async {
      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showAppDialog<void>(
              context: context,
              builder: (_) => const AppDialog(
                title: 'Restart this panel?',
                sizeClass: ScreenSizeClass.compact,
              ),
            ),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(
        tester.getSize(find.byType(AppDialog)).width,
        AppDialogMetrics.widthFor(ScreenSizeClass.compact),
      );
    });

    testWidgets('confirm returns true, cancel and dismiss false', (tester) async {
      final results = <bool>[];
      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () async => results.add(
              await showAppConfirmDialog(
                context: context,
                title: 'Restart this panel?',
                confirmLabel: 'Restart',
              ),
            ),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Restart'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(5, 5));
      await tester.pumpAndSettle();

      expect(results, [true, false, false]);
    });

    for (final brightness in _brightnesses) {
      testWidgets('a danger confirm takes the danger look in ${brightness.name}', (tester) async {
        await _pump(
          tester,
          Builder(
            builder: (context) => TextButton(
              onPressed: () => showAppConfirmDialog(
                context: context,
                title: 'Reset this panel?',
                confirmLabel: 'Reset panel',
                danger: true,
              ),
              child: const Text('open'),
            ),
          ),
          brightness: brightness,
        );

        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();

        final danger = AppStatusPalette.of(brightness, AppStatus.danger);
        final button = tester.widget<Material>(
          find.descendant(of: find.widgetWithText(AppDialogButton, 'Reset panel'), matching: find.byType(Material)),
        );
        expect(button.color, danger.soft);
        expect((button.shape! as RoundedRectangleBorder).side.color, danger.text);
        // An alert icon in the button and one before the title.
        expect(find.byIcon(MdiIcons.alertOutline), findsNWidgets(2));
      });
    }

    testWidgets('the selection dialog has no buttons; a tap selects and closes', (tester) async {
      int? picked;
      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () async => picked = await showSettingsSelectionDialog<int>(
              context: context,
              title: 'Screen lock delay',
              currentValue: 300,
              options: const [
                SelectionOption(value: 30, label: '30 seconds'),
                SelectionOption(value: 300, label: '5 minutes'),
              ],
            ),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.byType(AppDialogButton), findsNothing);
      expect(find.byType(SheetCloseButton), findsOneWidget);

      // The current option on the accent tint.
      final accent = _accent(Brightness.light);
      final current = tester.widget<Material>(
        find.ancestor(of: find.text('5 minutes'), matching: find.byType(Material)).first,
      );
      expect(current.color, accent.soft);
      expect((current.shape! as RoundedRectangleBorder).side.color, accent.text);

      await tester.tap(find.text('30 seconds'));
      await tester.pumpAndSettle();
      expect(picked, 30);
      expect(find.text('Screen lock delay'), findsNothing);
    });

    for (final sizeClass in _classes) {
      testWidgets('selection options at ${sizeClass.name} are at least the touch floor', (tester) async {
        await _pump(
          tester,
          SizedBox(
            width: 300,
            child: AppSelectionList<int>(
              options: const [SelectionOption(value: 1, label: 'One')],
              onSelected: (_) {},
              sizeClass: sizeClass,
            ),
          ),
        );

        final height = tester.getSize(find.ancestor(of: find.text('One'), matching: find.byType(Material)).first).height;
        expect(height, AppDialogMetrics.optionFor(sizeClass));
        expect(height, greaterThanOrEqualTo(36));
      });
    }

    testWidgets('grouped options sit under their section labels, in first-seen order', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 300,
          child: AppSelectionList<int>(
            options: const [
              SelectionOption(value: 1, label: 'Prague', group: 'Europe'),
              SelectionOption(value: 2, label: 'New York', group: 'America'),
              SelectionOption(value: 3, label: 'Berlin', group: 'Europe'),
            ],
            onSelected: (_) {},
          ),
        ),
      );

      double top(String text) => tester.getTopLeft(find.text(text)).dy;
      final order = ['EUROPE', 'Prague', 'Berlin', 'AMERICA', 'New York'];
      for (var i = 1; i < order.length; i++) {
        expect(top(order[i - 1]), lessThan(top(order[i])), reason: '${order[i - 1]} above ${order[i]}');
      }
    });
  });

  group('Toast', () {
    for (final brightness in _brightnesses) {
      testWidgets('an inverted pill with the status icon in ${brightness.name}', (tester) async {
        final other = brightness == Brightness.dark ? Brightness.light : Brightness.dark;
        for (final (type, status) in [
          (ToastType.success, AppStatus.ok),
          (ToastType.info, AppStatus.info),
          (ToastType.warning, AppStatus.warning),
          (ToastType.error, AppStatus.danger),
        ]) {
          await _pump(
            tester,
            SizedBox(
              width: 600,
              height: 200,
              child: Stack(
                children: [
                  ToastView(
                    message: 'Saved',
                    type: type,
                    brightness: brightness,
                    animate: false,
                    portrait: false,
                    sizeClass: ScreenSizeClass.regular,
                    onDismiss: () {},
                  ),
                ],
              ),
            ),
            brightness: brightness,
          );

          final pill = _decorationAbove(tester, find.text('Saved'));
          expect(pill.color, AppNeutralPalette.of(brightness).textPrimary);
          expect(pill.boxShadow, brightness == Brightness.light ? hasLength(1) : isNull);
          final text = tester.widget<Text>(find.text('Saved'));
          expect(
            text.style!.color,
            brightness == Brightness.dark ? AppNeutralPalette.light.textPrimary : AppColors.white,
          );
          expect(text.style!.fontSize, 12);
          final icon = tester.widget<Icon>(find.byType(Icon));
          expect(icon.color, AppStatusPalette.of(other, status).text, reason: type.name);
          expect(tester.getSize(find.byType(Icon)), const Size(16, 16));
        }
      });
    }

    for (final sizeClass in _classes) {
      testWidgets('sits above the portrait bar at ${sizeClass.name}', (tester) async {
        for (final portrait in [true, false]) {
          await _pump(
            tester,
            SizedBox(
              width: 600,
              height: 300,
              child: Stack(
                children: [
                  ToastView(
                    message: 'Saved',
                    type: ToastType.success,
                    brightness: Brightness.light,
                    animate: false,
                    portrait: portrait,
                    sizeClass: sizeClass,
                    onDismiss: () {},
                  ),
                ],
              ),
            ),
          );

          final bottom = 300 - tester.getBottomLeft(find.byType(Container).last).dy;
          expect(
            bottom,
            closeTo(ToastMetrics.bottomFor(sizeClass, portrait: portrait), 0.01),
            reason: 'portrait $portrait',
          );
          expect(tester.getSize(find.byType(Container).last).height, greaterThanOrEqualTo(36));
        }
      });
    }

    testWidgets('Toast.show: screen readers hear it, a tap dismisses it, the action runs', (tester) async {
      final handle = tester.ensureSemantics();
      var retried = 0;
      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => Toast.show(
              context,
              message: 'Floor lamp did not respond',
              type: ToastType.error,
              actionLabel: 'Retry',
              onAction: () => retried++,
            ),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(
        tester.getSemantics(find.text('Floor lamp did not respond')),
        matchesSemantics(label: 'Floor lamp did not respond', isLiveRegion: true, hasTapAction: true),
      );

      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(retried, 1);
      expect(find.text('Floor lamp did not respond'), findsNothing);

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Floor lamp did not respond'));
      await tester.pumpAndSettle();
      expect(find.text('Floor lamp did not respond'), findsNothing);

      Toast.dismiss();
      await tester.pump(const Duration(seconds: 5));
      handle.dispose();
    });
  });

  group('Toast review', () {
    Widget view({
      required VoidCallback onDismiss,
      bool animate = true,
      String? actionLabel,
      VoidCallback? onAction,
      Duration duration = const Duration(seconds: 1),
    }) => SizedBox(
      width: 208,
      height: 200,
      child: Stack(
        children: [
          ToastView(
            message: 'Floor lamp did not respond',
            type: ToastType.error,
            brightness: Brightness.light,
            sizeClass: ScreenSizeClass.compact,
            portrait: false,
            animate: animate,
            duration: duration,
            actionLabel: actionLabel,
            onAction: onAction,
            onDismiss: onDismiss,
          ),
        ],
      ),
    );

    testWidgets('the action runs once, even tapped again while the toast fades out', (tester) async {
      var retried = 0;
      await _pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => Toast.show(
              context,
              message: 'Floor lamp did not respond',
              type: ToastType.error,
              actionLabel: 'Retry',
              onAction: () => retried++,
            ),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Retry'));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.text('Retry'), warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(retried, 1);

      Toast.dismiss();
      await tester.pump(const Duration(seconds: 5));
    });

    testWidgets('a long action ellipsizes on a Compact panel and the message keeps room', (tester) async {
      await _pump(
        tester,
        view(
          animate: false,
          actionLabel: 'Retry downloading the latest configuration from the server',
          onAction: () {},
          onDismiss: () {},
        ),
      );

      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.text('Floor lamp did not respond')).width, greaterThan(40));
      final action = find.ancestor(
        of: find.text('Retry downloading the latest configuration from the server'),
        matching: find.byType(InkWell),
      );
      expect(tester.getSize(action).height, greaterThanOrEqualTo(36));
    });

    testWidgets('the auto-dismiss timer follows animate', (tester) async {
      var dismissed = 0;
      await _pump(tester, view(onDismiss: () => dismissed++));
      // Turned off before the timer: it never dismisses.
      await _pump(tester, view(animate: false, onDismiss: () => dismissed++));
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();
      expect(dismissed, 0);
      expect(find.text('Floor lamp did not respond'), findsOneWidget);

      // Turned on: the timer starts.
      await _pump(tester, view(onDismiss: () => dismissed++));
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
      expect(dismissed, 1);
    });

    testWidgets("a replaced toast's late dismissal leaves its successor", (tester) async {
      await _pump(
        tester,
        Builder(
          builder: (context) => Column(
            children: [
              TextButton(
                onPressed: () => Toast.show(context, message: 'First', type: ToastType.info),
                child: const Text('a'),
              ),
              TextButton(
                onPressed: () => Toast.show(context, message: 'Second', type: ToastType.info),
                child: const Text('b'),
              ),
            ],
          ),
        ),
      );

      await tester.tap(find.text('a'));
      await tester.pumpAndSettle();
      final first = tester.widget<ToastView>(find.byType(ToastView)).onDismiss;

      await tester.tap(find.text('b'));
      await tester.pumpAndSettle();
      expect(find.text('Second'), findsOneWidget);

      // The first toast's exit completes after the second took its place.
      first();
      await tester.pump();
      expect(find.text('Second'), findsOneWidget);

      Toast.dismiss();
      await tester.pump(const Duration(seconds: 5));
    });
  });

  group('AlertBanner', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('status fill and white text at ${sizeClass.name} in ${brightness.name}', (tester) async {
          for (final (color, status) in [
            (ThemeColors.warning, AppStatus.warning),
            (ThemeColors.danger, AppStatus.danger),
            (ThemeColors.success, AppStatus.ok),
            (ThemeColors.info, AppStatus.info),
            (ThemeColors.climate, AppStatus.info),
          ]) {
            await _pump(
              tester,
              SizedBox(
                width: 400,
                child: AlertBanner(text: 'Connection lost', color: color, sizeClass: sizeClass),
              ),
              brightness: brightness,
            );

            final material = tester.widget<Material>(
              find.descendant(of: find.byType(AlertBanner), matching: find.byType(Material)).first,
            );
            expect(material.color, AppStatusPalette.of(brightness, status).fill, reason: color.name);
            expect(tester.widget<Icon>(find.byType(Icon)).color, AppColors.white);
            expect(tester.getSize(find.byType(AlertBanner)).height, greaterThanOrEqualTo(AlertBannerMetrics.heightFor(sizeClass)));
            final text = tester.widget<Text>(find.textContaining('Connection lost'));
            expect(text.style!.color, AppColors.white);
            expect(text.style!.fontSize, AlertBannerMetrics.textFor(sizeClass));
          }
        });
      }
    }

    testWidgets('the title leads in bold; View is a 36 px action', (tester) async {
      var taps = 0;
      await _pump(
        tester,
        SizedBox(
          width: 400,
          child: AlertBanner(
            title: 'High temperature',
            text: 'Kitchen',
            color: ThemeColors.danger,
            onTap: () => taps++,
          ),
        ),
      );

      expect(find.textContaining('High temperature'), findsOneWidget);
      final view = find.text('View');
      expect(tester.getSize(find.ancestor(of: view, matching: find.byType(InkWell))).height, greaterThanOrEqualTo(36));
      await tester.tap(view);
      expect(taps, 1);
    });
  });

  group('AlertBanner review', () {
    testWidgets('a title too long for one line leaves the body its own line', (tester) async {
      await _pump(
        tester,
        const SizedBox(
          width: 220,
          child: AlertBanner(
            title: 'Low battery\nHallway motion sensor by the front door\n',
            text: 'Replace it',
            color: ThemeColors.warning,
            sizeClass: ScreenSizeClass.compact,
          ),
        ),
      );

      final title = tester.renderObject<RenderParagraph>(
        find.text('Low battery Hallway motion sensor by the front door'),
      );
      expect(title.didExceedMaxLines, isTrue);
      final body = tester.renderObject<RenderParagraph>(find.text('Replace it'));
      expect(body.didExceedMaxLines, isFalse);
      expect(
        tester.getRect(find.text('Replace it')).bottom,
        lessThanOrEqualTo(tester.getRect(find.byType(AlertBanner)).bottom),
      );
    });

    testWidgets('a title that fits stays inline, its line breaks folded', (tester) async {
      await _pump(
        tester,
        const SizedBox(
          width: 480,
          child: AlertBanner(title: 'Low battery\nHallway', text: 'Replace it', color: ThemeColors.warning),
        ),
      );

      expect(find.text('Low battery Hallway  Replace it'), findsOneWidget);
    });
  });

  group('Settings tile and row', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('the tile at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            SizedBox(
              width: 160,
              height: 110,
              child: SettingsTile(
                label: 'Display',
                icon: MdiIcons.weatherSunny,
                iconColor: _accent(brightness).text,
                iconBgColor: _accent(brightness).soft,
                sizeClass: sizeClass,
              ),
            ),
            brightness: brightness,
          );

          final neutrals = _neutrals(brightness);
          final material = tester.widget<Material>(
            find.descendant(of: find.byType(SettingsTile), matching: find.byType(Material)).first,
          );
          expect(material.color, neutrals.surfaceCard);
          expect((material.shape! as RoundedRectangleBorder).side.color, neutrals.borderLight);
          final chip = SettingsTileMetrics.chipFor(sizeClass);
          expect(
            tester.getSize(find.ancestor(of: find.byIcon(MdiIcons.weatherSunny), matching: find.byType(Container)).first),
            Size(chip, chip),
          );
          expect(tester.widget<Text>(find.text('Display')).style!.fontSize, SettingsTileMetrics.labelFor(sizeClass));
          expect(tester.takeException(), isNull);
        });
      }
    }

    testWidgets('a screen reader can open a tile; without onTap it is disabled', (tester) async {
      final handle = tester.ensureSemantics();
      var taps = 0;

      Future<void> pumpTile(VoidCallback? onTap) => _pump(
        tester,
        SizedBox(
          width: 160,
          height: 110,
          child: SettingsTile(
            label: 'Display',
            icon: MdiIcons.weatherSunny,
            iconColor: AppColors.white,
            iconBgColor: AppColors.white,
            onTap: onTap,
          ),
        ),
      );

      await pumpTile(() => taps++);
      expect(
        tester.getSemantics(find.byType(SettingsTile)),
        matchesSemantics(label: 'Display', isButton: true, hasEnabledState: true, isEnabled: true, hasTapAction: true),
      );
      tester.semantics.tap(find.semantics.byLabel('Display'));
      expect(taps, 1);

      await pumpTile(null);
      expect(
        tester.getSemantics(find.byType(SettingsTile)),
        matchesSemantics(label: 'Display', isButton: true, hasEnabledState: true),
      );
      handle.dispose();
    });

    testWidgets('SettingsCard is the list row; with a bottom it shares one card', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 320,
          child: Column(
            children: [
              SettingsCard(
                icon: MdiIcons.cog,
                iconColor: AppColors.white,
                iconBgColor: AppColors.white,
                label: 'Restart panel',
                description: 'Only this display restarts',
                isDanger: true,
              ),
              SettingsCard(
                icon: MdiIcons.microphone,
                iconColor: AppColors.white,
                iconBgColor: AppColors.white,
                label: 'Sensitivity',
                bottom: const SizedBox(height: 36, child: Text('slider')),
              ),
            ],
          ),
        ),
      );

      expect(find.byType(AppListRow), findsNWidgets(2));
      expect(find.byIcon(MdiIcons.cog), findsNothing);
      final danger = tester.widget<AppListRow>(find.widgetWithText(AppListRow, 'Restart panel'));
      expect(danger.danger, isTrue);
      expect(danger.subtitle, 'Only this display restarts');
      // The bottom sits in the row's card, under the row.
      final withBottom = tester.widget<AppListRow>(find.widgetWithText(AppListRow, 'Sensitivity'));
      expect(withBottom.surface, isFalse);
      expect(
        tester.getTopLeft(find.text('slider')).dy,
        greaterThan(tester.getBottomLeft(find.text('Sensitivity')).dy),
      );
    });
  });
}
