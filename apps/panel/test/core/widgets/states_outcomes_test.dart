import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_details_sheet.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_indicator.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/skeleton.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
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

AppNeutralPalette _neutrals(Brightness brightness) => AppNeutralPalette.of(brightness);

AppStatusPalette _status(Brightness brightness, AppStatus status) => AppStatusPalette.of(brightness, status);

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.light,
  Locale locale = const Locale('en'),
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
      locale: locale,
      home: Scaffold(body: Align(alignment: Alignment.topLeft, child: child)),
    ),
  );
}

/// The decoration of the [SkeletonBlock]s, top to bottom.
List<Rect> _blocks(WidgetTester tester, Finder within) {
  final rects = tester
      .elementList(find.descendant(of: within, matching: find.byType(SkeletonBlock)))
      .map((element) => tester.getRect(find.byWidget(element.widget).first))
      .toList();

  return rects;
}

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

  group('Skeleton', () {
    for (final brightness in _brightnesses) {
      testWidgets('a block is fill.base with radius 8 in ${brightness.name}', (tester) async {
        await _pump(tester, const SkeletonBlock(width: 40, height: 20), brightness: brightness);

        final decoration =
            tester.widget<Container>(find.descendant(of: find.byType(SkeletonBlock), matching: find.byType(Container))).decoration!
                as BoxDecoration;
        expect(decoration.color, _neutrals(brightness).fillBase);
        expect(decoration.borderRadius, BorderRadius.circular(8));
        expect(tester.getSize(find.byType(SkeletonBlock)), const Size(40, 20));
      });
    }

    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('the hero at ${sizeClass.name} in ${brightness.name} uses the hero sizes', (tester) async {
          final handle = tester.ensureSemantics();
          await _pump(
            tester,
            SizedBox(width: 360, height: 300, child: HeroSkeleton(sizeClass: sizeClass)),
            brightness: brightness,
          );

          final metrics = HeroCardMetrics.of(sizeClass);
          final neutrals = _neutrals(brightness);
          final card =
              tester.widget<Container>(find.descendant(of: find.byType(HeroSkeleton), matching: find.byType(Container)).first).decoration!
                  as BoxDecoration;
          expect(card.color, neutrals.surfaceCard);
          expect((card.border! as Border).top.color, neutrals.borderLight);

          // Badge, numeral, slider, buttons, top to bottom.
          final blocks = _blocks(tester, find.byType(HeroSkeleton));
          expect(blocks, hasLength(4));
          expect(blocks[0].height, metrics.badgeHeight);
          expect(blocks[2].height, SkeletonMetrics.sliderHeight);
          expect(blocks[3].height, metrics.buttonsHeight);
          expect(blocks[1].height, greaterThanOrEqualTo(HeroCardMetrics.numeralMin));
          for (var i = 1; i < blocks.length; i++) {
            expect(blocks[i].top, greaterThan(blocks[i - 1].bottom - 0.01));
          }

          expect(find.bySemanticsLabel('Loading'), findsOneWidget);
          expect(tester.takeException(), isNull);
          handle.dispose();
        });
      }
    }

    testWidgets('a short hero drops the slider, then the badge, and never overflows', (tester) async {
      for (final height in [140.0, 110.0, 80.0, 40.0]) {
        await _pump(
          tester,
          SizedBox(width: 220, height: height, child: const HeroSkeleton(sizeClass: ScreenSizeClass.regular)),
        );

        expect(tester.takeException(), isNull, reason: 'at $height');
        final card = tester.getRect(find.byType(HeroSkeleton));
        for (final block in _blocks(tester, find.byType(HeroSkeleton))) {
          expect(block.bottom, lessThanOrEqualTo(card.bottom + 0.01), reason: 'at $height');
        }
      }
      expect(_blocks(tester, find.byType(HeroSkeleton)).length, lessThan(4));
    });

    testWidgets('a hero without a height limit takes its natural height', (tester) async {
      await _pump(
        tester,
        const SizedBox(
          width: 300,
          child: SingleChildScrollView(child: HeroSkeleton(sizeClass: ScreenSizeClass.compact)),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(_blocks(tester, find.byType(HeroSkeleton)), hasLength(4));
    });

    for (final sizeClass in _classes) {
      testWidgets('the page at ${sizeClass.name}: header, hero and tiles in place, one Loading', (tester) async {
        final handle = tester.ensureSemantics();
        final header = PageHeaderMetrics.of(sizeClass);

        for (final landscape in [true, false]) {
          await _pump(
            tester,
            SizedBox(
              width: landscape ? 640 : 360,
              height: landscape ? 360 : 640,
              child: PageSkeleton(landscape: landscape, sizeClass: sizeClass),
            ),
          );

          expect(tester.takeException(), isNull);
          expect(find.byType(CircularProgressIndicator), findsNothing);
          expect(find.bySemanticsLabel('Loading'), findsOneWidget);

          // The header's icon tile.
          final iconTile = _blocks(tester, find.byType(PageSkeleton)).first;
          expect(iconTile.size, Size(header.iconTile, header.iconTile));

          final hero = tester.getRect(find.byType(HeroSkeleton));
          final page = tester.getRect(find.byType(PageSkeleton));
          if (landscape) {
            expect(hero.width, closeTo((page.width - 3 * header.padding) * SkeletonMetrics.heroShare, 2));
            expect(hero.top, greaterThan(iconTile.bottom));
          } else {
            expect(hero.width, closeTo(page.width - 2 * header.padding, 0.01));
          }
        }
        handle.dispose();
      });
    }

    testWidgets('the page keeps a real header', (tester) async {
      await _pump(
        tester,
        const SizedBox(
          width: 640,
          height: 360,
          child: PageSkeleton(header: Text('Lights header'), landscape: true, sizeClass: ScreenSizeClass.regular),
        ),
      );

      expect(find.text('Lights header'), findsOneWidget);
      // No header blocks: the first block is the hero's badge.
      final first = _blocks(tester, find.byType(PageSkeleton)).first;
      expect(first.height, HeroCardMetrics.regular.badgeHeight);
    });
  });

  group('State template', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('the four states at ${sizeClass.name} in ${brightness.name}', (tester) async {
          final neutrals = _neutrals(brightness);
          final warning = _status(brightness, AppStatus.warning);
          final lights = ThemeColorFamily.get(brightness, ThemeColors.lights);
          final circle = PageHeaderMetrics.of(sizeClass).iconTile;

          for (final (state, soft, foreground, icon) in [
            (AppScreenState.error, warning.soft, warning.text, MdiIcons.alertOutline),
            (AppScreenState.empty, neutrals.fillBase, neutrals.textSecondary, MdiIcons.inboxOutline),
            (AppScreenState.notConfigured, lights.soft, lights.base, MdiIcons.cogOffOutline),
            (AppScreenState.blocked, neutrals.fillBase, neutrals.textSecondary, MdiIcons.lockOutline),
          ]) {
            await _pump(
              tester,
              SizedBox(
                width: 400,
                child: StateTemplate(
                  state: state,
                  title: 'Title',
                  message: 'One line',
                  domain: ThemeColors.lights,
                  sizeClass: sizeClass,
                ),
              ),
              brightness: brightness,
            );

            final iconFinder = find.byIcon(icon);
            expect(iconFinder, findsOneWidget, reason: state.name);
            expect(tester.widget<Icon>(iconFinder).color, foreground, reason: state.name);
            expect(tester.widget<Icon>(iconFinder).size, PageHeaderMetrics.of(sizeClass).iconSize);
            final circleBox = find.ancestor(of: iconFinder, matching: find.byType(Container)).first;
            expect(tester.getSize(circleBox), Size(circle, circle));
            final decoration = tester.widget<Container>(circleBox).decoration! as BoxDecoration;
            expect(decoration.color, soft, reason: state.name);
            expect(decoration.shape, BoxShape.circle);

            final title = tester.widget<Text>(find.text('Title'));
            expect(title.style!.fontSize, StateTemplateMetrics.titleFor(sizeClass));
            expect(title.style!.fontWeight, FontWeight.w500);
            expect(title.style!.color, neutrals.textPrimary);
            final line = tester.widget<Text>(find.text('One line'));
            expect(line.style!.fontSize, StateTemplateMetrics.messageFor(sizeClass));
            expect(line.style!.color, neutrals.textSecondary);
          }
        });
      }
    }

    testWidgets('an error offers Retry, 36 high on the accent', (tester) async {
      var retried = 0;
      await _pump(
        tester,
        StateTemplate(state: AppScreenState.error, title: 'Lights did not load', onAction: () => retried++),
      );

      final retry = find.text('Retry');
      expect(retry, findsOneWidget);
      final button = find.ancestor(of: retry, matching: find.byType(InkWell));
      expect(tester.getSize(button).height, greaterThanOrEqualTo(36));
      final material = tester.widget<Material>(find.ancestor(of: button, matching: find.byType(Material)).first);
      expect(material.color, AppAccentPalette.of(AppAccent.blue, Brightness.light).fill);
      expect(tester.widget<Text>(retry).style!.color, AppColors.white);
      await tester.tap(retry);
      expect(retried, 1);
    });

    testWidgets('not configured points to the admin and never looks like empty', (tester) async {
      await _pump(
        tester,
        const StateTemplate(state: AppScreenState.notConfigured, title: 'No lighting roles assigned'),
      );
      expect(find.text('Set it up in the admin app.'), findsOneWidget);
      final notConfigured = tester.widget<Icon>(find.byIcon(MdiIcons.cogOffOutline)).color;

      await _pump(tester, const StateTemplate(state: AppScreenState.empty, title: 'Nothing to control here'));
      expect(find.text('Set it up in the admin app.'), findsNothing);
      final empty = tester.widget<Icon>(find.byIcon(MdiIcons.inboxOutline)).color;
      expect(notConfigured, isNot(empty));
    });
  });

  group('DomainStateView', () {
    Widget view(DomainLoadState state, {VoidCallback? onRetry, Widget? header}) => SizedBox(
      width: 640,
      height: 360,
      child: DomainStateView(
        state: state,
        onRetry: onRetry ?? () {},
        domainName: 'Lights',
        notConfiguredIcon: MdiIcons.lightbulbOffOutline,
        notConfiguredTitle: 'No lighting roles assigned',
        domain: ThemeColors.lights,
        header: header,
        child: const Text('content'),
      ),
    );

    testWidgets('loading is the skeleton, not a spinner, and keeps the header', (tester) async {
      await _pump(tester, view(DomainLoadState.loading, header: const Text('header')));

      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.byType(PageSkeleton), findsOneWidget);
      expect(find.text('header'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('error is the error template; Retry retries', (tester) async {
      var retried = 0;
      await _pump(tester, view(DomainLoadState.error, onRetry: () => retried++, header: const Text('header')));

      expect(find.text('Failed to load Lights'), findsOneWidget);
      expect(find.text('header'), findsOneWidget);
      await tester.tap(find.text('Retry'));
      expect(retried, 1);
    });

    testWidgets('not configured is the template in the domain colour', (tester) async {
      await _pump(tester, view(DomainLoadState.notConfigured));

      expect(find.text('No lighting roles assigned'), findsOneWidget);
      expect(find.text('Set it up in the admin app.'), findsOneWidget);
      expect(
        tester.widget<Icon>(find.byIcon(MdiIcons.lightbulbOffOutline)).color,
        ThemeColorFamily.get(Brightness.light, ThemeColors.lights).base,
      );
    });

    testWidgets('loaded and empty show the content', (tester) async {
      for (final state in [DomainLoadState.loaded, DomainLoadState.empty]) {
        await _pump(tester, view(state));
        expect(find.text('content'), findsOneWidget);
      }
    });
  });

  group('Outcome indicator', () {
    for (final brightness in _brightnesses) {
      testWidgets('every outcome takes its icon, colour and look in ${brightness.name}', (tester) async {
        final neutrals = _neutrals(brightness);
        final ok = _status(brightness, AppStatus.ok);
        final warning = _status(brightness, AppStatus.warning);
        final info = _status(brightness, AppStatus.info);

        for (final (outcome, label, icon, color, pill) in [
          (AppOutcome.pending, 'Setting', MdiIcons.refresh, neutrals.textSecondary, null),
          (AppOutcome.completed, 'Completed', MdiIcons.check, ok.text, null),
          (AppOutcome.partial, 'Partial', MdiIcons.alertOutline, warning.text, warning),
          (AppOutcome.failed, 'Failed', MdiIcons.alertOutline, warning.text, warning),
          (AppOutcome.superseded, 'Replaced by a newer request', MdiIcons.informationOutline, info.text, info),
          (AppOutcome.notConfirmed, 'Not confirmed', MdiIcons.alertOutline, warning.text, warning),
          (AppOutcome.conflict, 'Changed elsewhere', MdiIcons.alertOutline, warning.text, warning),
          (AppOutcome.mixed, 'Mixed', null, neutrals.textSecondary, null),
          (AppOutcome.unavailable, 'No data', MdiIcons.clockAlertOutline, warning.text, null),
          (AppOutcome.offline, 'Offline', MdiIcons.alertOutline, warning.text, null),
          (AppOutcome.noDevices, 'No devices', MdiIcons.informationOutline, info.text, null),
          (AppOutcome.notSupported, 'Not supported', MdiIcons.informationOutline, info.text, null),
        ]) {
          await _pump(tester, OutcomeIndicator(outcome: outcome), brightness: brightness);

          final text = find.textContaining(label);
          expect(text, findsOneWidget, reason: outcome.name);
          final paragraph = tester.renderObject<RenderParagraph>(text);
          expect(paragraph.text.style!.color, color, reason: outcome.name);
          if (icon == null) {
            expect(find.byType(Icon), findsNothing, reason: outcome.name);
          } else {
            expect(tester.widget<Icon>(find.byIcon(icon)).color, color, reason: outcome.name);
          }

          final pills = find.descendant(
            of: find.byType(OutcomeIndicator),
            matching: find.byWidgetPredicate(
              (widget) => widget is Container && widget.decoration is BoxDecoration,
            ),
          );
          if (pill == null) {
            expect(pills, findsNothing, reason: outcome.name);
          } else {
            final decoration = tester.widget<Container>(pills).decoration! as BoxDecoration;
            expect(decoration.color, pill.soft, reason: outcome.name);
            expect((decoration.border! as Border).top.color, pill.border, reason: outcome.name);
            expect(tester.getSize(pills).height, OutcomeMetrics.pillHeight);
          }
        }
      });
    }

    testWidgets('never confirmed never looks like settling', (tester) async {
      final theme = _theme(Brightness.light);
      final setting = OutcomeStyle.of(theme, AppOutcome.pending);
      final notConfirmed = OutcomeStyle.of(theme, AppOutcome.notConfirmed);

      expect(notConfirmed.icon, isNot(setting.icon));
      expect(notConfirmed.color, isNot(setting.color));
      expect(notConfirmed.isPill, isTrue);
      expect(setting.isPill, isFalse);
      expect(notConfirmed.opensDetails, isTrue);
      expect(setting.opensDetails, isFalse);
    });

    for (final sizeClass in _classes) {
      testWidgets('the label is ${OutcomeMetrics.fontFor(sizeClass)} at ${sizeClass.name}', (tester) async {
        await _pump(tester, OutcomeIndicator(outcome: AppOutcome.partial, sizeClass: sizeClass));

        final paragraph = tester.renderObject<RenderParagraph>(find.textContaining('Partial'));
        expect(paragraph.text.style!.fontSize, OutcomeMetrics.fontFor(sizeClass));
      });
    }

    testWidgets('with details: a chevron, a 36 px touch zone, and "Show details" for screen readers', (tester) async {
      final handle = tester.ensureSemantics();
      var opened = 0;
      await _pump(tester, OutcomeIndicator(outcome: AppOutcome.partial, onDetails: () => opened++));

      expect(find.byIcon(MdiIcons.chevronRight), findsOneWidget);
      expect(tester.getSize(find.byType(InkWell)).height, greaterThanOrEqualTo(OutcomeMetrics.touch));
      expect(
        tester.getSemantics(find.byType(OutcomeIndicator)),
        matchesSemantics(label: 'Partial. Show details', isButton: true, hasTapAction: true),
      );

      await tester.tap(find.byType(OutcomeIndicator));
      expect(opened, 1);
      tester.semantics.tap(find.semantics.byLabel('Partial. Show details'));
      expect(opened, 2);

      // Without a callback it is plain text for screen readers.
      await _pump(tester, const OutcomeIndicator(outcome: AppOutcome.partial));
      expect(find.byIcon(MdiIcons.chevronRight), findsNothing);
      expect(tester.getSemantics(find.byType(OutcomeIndicator)), matchesSemantics(label: 'Partial'));
      handle.dispose();
    });

    testWidgets('a long line ellipsizes, also in a row without a width to share', (tester) async {
      const long = 'Partial · 3 lights in the living room did not answer';
      await _pump(
        tester,
        const SizedBox(width: 120, child: OutcomeIndicator(outcome: AppOutcome.partial, label: long)),
      );
      expect(tester.takeException(), isNull);
      expect(tester.renderObject<RenderParagraph>(find.textContaining(long)).didExceedMaxLines, isTrue);

      await _pump(
        tester,
        const SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [OutcomeIndicator(outcome: AppOutcome.partial, label: long)]),
        ),
      );
      expect(tester.takeException(), isNull);
    });

    test('outcomeLine joins the parts with a middle dot and skips empty ones', () {
      expect(outcomeLine(['Partial', '1 light did not answer']), 'Partial · 1 light did not answer');
      expect(outcomeLine(['Timed out', null, '', 'refresh before retrying']), 'Timed out · refresh before retrying');
    });

    test('every outcome has a label in all six locales', () {
      expect(AppLocalizations.supportedLocales, hasLength(6));
      for (final locale in AppLocalizations.supportedLocales) {
        final localizations = lookupAppLocalizations(locale);
        for (final outcome in AppOutcome.values) {
          expect(outcomeLabel(localizations, outcome), isNotEmpty, reason: '$locale ${outcome.name}');
        }
        for (final text in [
          localizations.outcome_sent,
          localizations.outcome_refused,
          localizations.outcome_timed_out,
          localizations.outcome_refresh_before_retry,
          localizations.outcome_not_reporting,
          localizations.outcome_last_update('12 min'),
          localizations.outcome_show_details('Partial'),
          localizations.outcome_details_note,
          localizations.state_loading,
          localizations.state_not_configured_hint,
        ]) {
          expect(text, isNotEmpty, reason: '$locale');
        }
      }
      // Translated, not copied.
      expect(
        outcomeLabel(lookupAppLocalizations(const Locale('cs')), AppOutcome.notConfirmed),
        isNot(outcomeLabel(lookupAppLocalizations(const Locale('en')), AppOutcome.notConfirmed)),
      );
    });
  });

  group('Outcome details', () {
    List<OutcomeDetailRow> rows() => const [
      OutcomeDetailRow(icon: Icons.lightbulb_outline, label: 'Lights', outcome: AppOutcome.completed),
      OutcomeDetailRow(icon: Icons.blinds, label: 'Shading', outcome: AppOutcome.partial),
      OutcomeDetailRow(icon: Icons.play_arrow, label: 'Media', outcome: AppOutcome.noDevices),
    ];

    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('rows at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            SizedBox(width: 320, child: OutcomeDetailsList(rows: rows(), sizeClass: sizeClass)),
            brightness: brightness,
          );

          final neutrals = _neutrals(brightness);
          final row = find.ancestor(of: find.text('Lights'), matching: find.byType(Container)).first;
          expect(tester.getSize(row).height, OutcomeDetailsMetrics.rowHeightFor(sizeClass));
          expect((tester.widget<Container>(row).decoration! as BoxDecoration).color, neutrals.fillLight);
          expect(tester.widget<Text>(find.text('Lights')).style!.fontSize, OutcomeDetailsMetrics.label);

          final partial = tester.renderObject<RenderParagraph>(find.textContaining('Partial'));
          expect(partial.text.style!.color, _status(brightness, AppStatus.warning).text);
          expect(partial.text.style!.fontSize, OutcomeDetailsMetrics.statusFor(sizeClass));
          expect(
            tester.renderObject<RenderParagraph>(find.textContaining('Completed')).text.style!.color,
            _status(brightness, AppStatus.ok).text,
          );
          expect(find.textContaining('No devices'), findsOneWidget);

          final note = tester.widget<Text>(find.text('Results of the commands sent, not what the devices are doing now.'));
          expect(note.style!.fontSize, OutcomeDetailsMetrics.note);
          expect(note.style!.color, neutrals.textSecondary);
        });
      }
    }

    testWidgets('a long name ellipsizes and the status keeps its room', (tester) async {
      await _pump(
        tester,
        const SizedBox(
          width: 200,
          child: OutcomeDetailsList(
            note: '',
            rows: [
              OutcomeDetailRow(
                icon: Icons.blinds,
                label: 'Living room shutters on the south side',
                outcome: AppOutcome.partial,
              ),
            ],
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Results of the commands sent, not what the devices are doing now.'), findsNothing);
      expect(tester.getSize(find.textContaining('Partial')).width, greaterThan(40));
    });

    testWidgets('a sheet in portrait, a drawer in landscape; the action closes it and runs', (tester) async {
      for (final landscape in [false, true]) {
        var retried = 0;
        await _pump(
          tester,
          Builder(
            builder: (context) => TextButton(
              onPressed: () => showOutcomeDetailsSheet(
                context,
                title: 'Room mode: Relax',
                subtitle: 'Sent 21:30 · 1 part did not complete',
                rows: rows(),
                actionLabel: 'Retry Relax',
                onAction: () => retried++,
                landscape: landscape,
              ),
              child: const Text('open'),
            ),
          ),
        );

        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        expect(find.byType(landscape ? RightDrawer : BottomSheetDialog), findsOneWidget);
        expect(find.text('Room mode: Relax'), findsOneWidget);
        expect(find.text('Sent 21:30 · 1 part did not complete'), findsOneWidget);
        expect(find.text('Shading'), findsOneWidget);

        await tester.tap(find.text('Retry Relax'));
        await tester.pumpAndSettle();
        expect(retried, 1);
        expect(find.text('Room mode: Relax'), findsNothing);
        expect(find.text('open'), findsOneWidget);
      }
    });
  });
}
