import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// The check is a dev tool outside lib/, so it is imported by path.
import '../../tools/design_system/checker.dart';

List<Finding> _check(
  String body, {
  String path = 'lib/modules/example/widget.dart',
  DesignCheckConfig config = const DesignCheckConfig(),
}) =>
    checkSource(body, path: path, config: config);

List<String> _rules(String body, {String path = 'lib/modules/example/widget.dart'}) =>
    _check(body, path: path).map((finding) => finding.rule.id).toList();

void main() {
  group('hex colours', () {
    test('reports Color(0x…) with or without const', () {
      expect(
        _rules('''
final a = Color(0xFF112233);
const b = Color(0xff445566);
final c = new Color(0x80112233);
final d = Color((0xFF112233));
const e = Color(((0xFF112233)));
'''),
        ['hex-colour', 'hex-colour', 'hex-colour', 'hex-colour', 'hex-colour'],
      );
    });

    test('ignores other colour constructors and variables', () {
      expect(
        _rules('''
final a = Color.fromARGB(255, 1, 2, 3);
final b = Color(value);
final c = AppColors.white;
final d = Color(123);
'''),
        isEmpty,
      );
    });

    test('is allowed in the colour tokens', () {
      const config = DesignCheckConfig(allow: {
        DesignRule.hexColour: ['lib/core/utils/theme.dart'],
      });

      expect(
        _check('const a = Color(0xFF112233);', path: 'lib/core/utils/theme.dart', config: config),
        isEmpty,
      );
    });
  });

  group('font sizes', () {
    test('reports a number in fontSize:', () {
      expect(
        _rules('''
final a = TextStyle(fontSize: 14);
final b = TextStyle(fontSize: AppSpacings.scale(12));
final c = style.copyWith(fontSize: size * 0.6);
final d = TextStyle(fontSize: isCompact ? 12.0 : AppFontSize.base);
'''),
        ['font-size', 'font-size', 'font-size', 'font-size'],
      );
    });

    test('accepts the type scale tokens', () {
      expect(
        _rules('''
final a = TextStyle(fontSize: AppFontSize.base);
final b = TextStyle(fontSize: isCompact ? AppFontSize.small : AppFontSize.base);
final c = TextStyle(fontSize: widget.fontSize);
final d = TextStyle(height: 1.2, letterSpacing: 0.5);
'''),
        isEmpty,
      );
    });
  });

  group('stock widgets', () {
    test('reports each stock widget the design replaces', () {
      for (final widget in stockWidgets) {
        expect(_rules('final w = $widget(title: x);'), ['stock-widget'], reason: widget);
        expect(_rules('final w = const $widget();'), ['stock-widget'], reason: 'const $widget');
      }
    });

    test('reports named constructors', () {
      expect(_rules('final w = SwitchListTile.adaptive(value: true);'), ['stock-widget']);
    });

    test('reports constructors called through an import prefix', () {
      expect(
        _rules('''
import 'dart:ui' as ui;
import 'package:flutter/material.dart' as material;

final a = ui.Color(0xFF112233);
const b = ui.Color(0xFF112233);
final c = material.AppBar();
final d = material.SwitchListTile.adaptive(value: true);
'''),
        ['hex-colour', 'hex-colour', 'stock-widget', 'stock-widget'],
      );
    });

    test('takes prefixes from the imports, whatever their case', () {
      expect(
        _rules('''
import 'dart:ui' as _ui;
import 'package:flutter/material.dart' as UI;

final a = _ui.Color(0xFF112233);
final b = UI.AppBar();
final c = UI.SwitchListTile.adaptive(value: true);
'''),
        ['hex-colour', 'stock-widget', 'stock-widget'],
      );
    });

    test('ignores methods that share a name on other targets', () {
      expect(
        _rules('''
import 'dart:ui' as ui;

final a = palette.Color(value);
final b = Colors.white.withValues(alpha: 0.5);
final c = AppColors.fromHex(0xFF112233);
final d = palette.Color(0xFF112233);
final e = factory.AppBar();
final f = factory.SwitchListTile.adaptive(value: true);
final g = palette..Color(0xFF112233);
final h = factory?..AppBar()..ListTile();
'''),
        isEmpty,
      );
    });

    test('ignores calls on a name that hides an import prefix', () {
      expect(
        _rules('''
import 'dart:ui' as ui;
import 'package:flutter/material.dart' as material;

void parameter(dynamic ui) => ui.Color(0xFF112233);
void local() { final ui = palette; ui.Color(0xFF112233); }
void loop(List items, List<(Object, int)> pairs) {
  for (final ui in items) { ui.Color(0xFF112233); }
  for (final (ui, _) in pairs) { ui.Color(0xFF112233); }
  final list = [for (final ui in items) ui.Color(0xFF112233)];
}
void pattern(Object x) {
  if (x case final ui) { ui.Color(0xFF112233); }
  if (x case final ui when ui.Color(0xFF112233)) {}
  final list = [if (x case final ui when ui.Color(0xFF112233)) ui.Color(0xFF112233)];
  switch (x) { case final material: material.AppBar(); }
}
final closure = (ui) => ui.Color(0xFF112233);
void caught() { try {} catch (material) { material.SwitchListTile.adaptive(value: true); } }
class Holder {
  final ui = palette;
  void member() => ui.Color(0xFF112233);
}
'''),
        isEmpty,
      );
    });

    test('still reports the prefix outside the scope that hides it', () {
      expect(
        _rules('''
import 'dart:ui' as ui;

void parameter(dynamic ui) => ui.Color(0xFF112233);
void other() => ui.Color(0xFF112233);
void pattern(Object x) {
  if (x case final ui) {} else { ui.Color(0xFF112233); }
  if (ui.Color(0xFF112233) case final ui) {}
}
void loops() {
  for (final ui in [ui.Color(0xFF112233)]) {}
  for (final (ui, _) in [(ui.Color(0xFF112233), 1)]) {}
  final list = [for (final ui in [ui.Color(0xFF112233)]) ui];
}
'''),
        List.filled(6, 'hex-colour'),
      );
    });

    test('ignores other widgets, types, comments and strings', () {
      expect(
        _rules('''
// An AppBar(title: x) would be wrong here.
/// Replaces ListTile(…).
final a = SliverAppBar(title: x);
final b = CheckboxListTile(value: true);
AppBar? bar;
final c = 'ListTile(';
final d = AlertDialogBuilder();
'''),
        isEmpty,
      );
    });
  });

  group('findings', () {
    test('carry the path, line, column and a short detail', () {
      final findings = _check('''
void build() {
  final w = TextStyle(fontSize: 14);
}
''');

      expect(findings, hasLength(1));
      expect(findings.single.path, 'lib/modules/example/widget.dart');
      expect(findings.single.line, 2);
      expect(findings.single.column, 23);
      expect(findings.single.detail, 'fontSize: 14');
      expect(findings.single.strict, isFalse);
      expect(findings.single.toString(), startsWith('warning lib/modules/example/widget.dart:2:23 font-size'));
    });

    test('can be ignored on the line or the line above, per rule', () {
      expect(
        _rules('''
final a = Color(0xFF000000); // design-system: ignore hex-colour (sky photo tint)
// design-system: ignore font-size
final b = TextStyle(fontSize: 14);
// design-system: ignore font-size
final c = Color(0xFF000000);
'''),
        ['hex-colour'],
      );
    });

    test('are read from comments only, not from strings', () {
      expect(
        _rules('''
final note = '// design-system: ignore hex-colour';
final a = Color(0xFF112233);
final b = TextStyle(fontSize: 14); final tip = "// design-system: ignore font-size";
'''),
        ['hex-colour', 'font-size'],
      );
    });

    test('work in a trailing comment at the end of the file', () {
      expect(_rules('final a = Color(0xFF112233); // design-system: ignore hex-colour'), isEmpty);
    });
  });

  group('config', () {
    const source = '''
strict:
  - lib/features/gallery/
  - lib/modules/weather/presentation/weather_detail.dart
exclude:
  - lib/api/
  - '*.g.dart'
allow:
  font-size:
    - lib/core/utils/theme.dart
''';

    test('makes findings in strict folders and files errors', () {
      final config = DesignCheckConfig.parse(source);

      expect(
        _check('final a = Color(0xFF000000);', path: 'lib/features/gallery/x.dart', config: config).single.strict,
        isTrue,
      );
      expect(
        _check('final a = Color(0xFF000000);',
                path: 'lib/modules/weather/presentation/weather_detail.dart', config: config)
            .single
            .strict,
        isTrue,
      );
      expect(
        _check('final a = Color(0xFF000000);', path: 'lib/features/galleryx/x.dart', config: config).single.strict,
        isFalse,
      );
      expect(
        _check('final a = Color(0xFF000000);', path: 'lib/features/gallery/x.dart', config: config)
            .single
            .toString(),
        startsWith('error '),
      );
    });

    test('skips excluded folders and suffixes', () {
      final config = DesignCheckConfig.parse(source);

      expect(_check('final a = Color(0xFF000000);', path: 'lib/api/x.dart', config: config), isEmpty);
      expect(_check('final a = Color(0xFF000000);', path: 'lib/modules/x.g.dart', config: config), isEmpty);
    });

    test('allows a rule only where listed', () {
      final config = DesignCheckConfig.parse(source);
      const body = 'final a = TextStyle(fontSize: 14); final b = Color(0xFF000000);';

      expect(
        _check(body, path: 'lib/core/utils/theme.dart', config: config).map((f) => f.rule),
        [DesignRule.hexColour],
      );
    });

    test('rejects unknown keys and rules', () {
      expect(() => DesignCheckConfig.parse('stric: []'), throwsFormatException);
      expect(() => DesignCheckConfig.parse('allow:\n  colours: [a]'), throwsFormatException);
      expect(() => DesignCheckConfig.parse('strict: lib/'), throwsFormatException);
      expect(() => DesignCheckConfig.parse('- a'), throwsFormatException);
    });

    test('accepts an empty file', () {
      expect(DesignCheckConfig.parse('').strict, isEmpty);
    });
  });

  test('counts findings per lib/<area>/<name> folder', () {
    expect(folderOf('lib/main.dart'), 'lib');
    expect(folderOf('lib/app/routes.dart'), 'lib/app');
    expect(folderOf('lib/core/widgets/hero_card.dart'), 'lib/core/widgets');
    expect(folderOf('lib/modules/devices/presentation/widgets/x.dart'), 'lib/modules/devices');
  });

  group('the shipped config', () {
    final root = Directory.current.path;
    final config = DesignCheckConfig.parse(File('$root/tools/design_system.yaml').readAsStringSync());

    test('keeps generated code out and the token file allowed', () {
      for (final path in ['lib/api/x.dart', 'lib/spec/x.dart', 'lib/l10n/app_localizations.dart', 'lib/x.g.dart']) {
        expect(config.isExcluded(path), isTrue, reason: path);
      }

      expect(config.isAllowed(DesignRule.hexColour, 'lib/core/utils/theme.dart'), isTrue);
      expect(config.isAllowed(DesignRule.fontSize, 'lib/core/utils/theme.dart'), isTrue);
      expect(config.isStrict('lib/features/gallery/gallery.dart'), isTrue);
    });

    test('the strict folders have no findings', () {
      final files = Directory('$root/lib')
          .listSync(recursive: true)
          .whereType<File>()
          .where((file) => file.path.endsWith('.dart'))
          .map((file) => file.path.substring(root.length + 1))
          .where(config.isStrict)
          .toList();

      expect(files, isNotEmpty);

      for (final path in files) {
        expect(
          checkSource(File('$root/$path').readAsStringSync(), path: path, config: config),
          isEmpty,
          reason: path,
        );
      }
    });
  });
}
