import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/source/line_info.dart';
import 'package:yaml/yaml.dart';

/// The design system rules (docs/display-ui-design-spec.md §1).
enum DesignRule {
  /// A hex `Color(0x…)` outside the colour tokens.
  hexColour('hex-colour', 'hex colour; use a colour token from theme.dart'),

  /// A `fontSize:` with a number in it, outside the type scale.
  fontSize('font-size', 'raw font size; use an AppFontSize token'),

  /// A stock Material widget the design replaces.
  stockWidget('stock-widget', 'stock Material widget; use the shared component');

  const DesignRule(this.id, this.message);

  /// The name used in the config and in ignore comments.
  final String id;

  final String message;

  static DesignRule? byId(String id) {
    for (final rule in values) {
      if (rule.id == id) {
        return rule;
      }
    }

    return null;
  }
}

/// Stock widgets that screens do not use; each has a shared replacement.
const Set<String> stockWidgets = {
  'AppBar',
  'ListTile',
  'SwitchListTile',
  'ExpansionTile',
  'FilterChip',
  'ActionChip',
  'AlertDialog',
};

/// One place that breaks the design system.
class Finding {
  const Finding({
    required this.path,
    required this.line,
    required this.column,
    required this.rule,
    required this.detail,
    this.strict = false,
  });

  /// Path relative to apps/panel, with `/` separators.
  final String path;
  final int line;
  final int column;
  final DesignRule rule;

  /// The offending source, shortened.
  final String detail;

  /// Whether the file is in a strict folder, so the finding fails the check.
  final bool strict;

  Finding withStrict(bool value) => Finding(
        path: path,
        line: line,
        column: column,
        rule: rule,
        detail: detail,
        strict: value,
      );

  @override
  String toString() =>
      '${strict ? 'error' : 'warning'} $path:$line:$column ${rule.id}: ${rule.message} ($detail)';
}

/// The per-folder settings from `tools/design_system.yaml`.
class DesignCheckConfig {
  const DesignCheckConfig({
    this.strict = const [],
    this.exclude = const [],
    this.allow = const {},
  });

  /// Folders and files whose findings fail the check.
  final List<String> strict;

  /// Folders, files and `*.suffix` patterns that are never checked.
  final List<String> exclude;

  /// Folders and files where a rule does not apply.
  final Map<DesignRule, List<String>> allow;

  factory DesignCheckConfig.parse(String source) {
    final yaml = loadYaml(source);

    if (yaml != null && yaml is! YamlMap) {
      throw const FormatException('The config must be a map.');
    }

    final map = (yaml as YamlMap?) ?? YamlMap();

    List<String> list(Object? value, String key) {
      if (value == null) {
        return const [];
      }

      if (value is! YamlList || value.any((item) => item is! String)) {
        throw FormatException('`$key` must be a list of paths.');
      }

      return value.cast<String>().toList(growable: false);
    }

    final allow = <DesignRule, List<String>>{};
    final allowYaml = map['allow'];

    if (allowYaml != null) {
      if (allowYaml is! YamlMap) {
        throw const FormatException('`allow` must map rule names to paths.');
      }

      for (final entry in allowYaml.entries) {
        final rule = DesignRule.byId('${entry.key}');

        if (rule == null) {
          throw FormatException('Unknown rule in `allow`: ${entry.key}.');
        }

        allow[rule] = list(entry.value, 'allow.${entry.key}');
      }
    }

    for (final key in map.keys) {
      if (!const {'strict', 'exclude', 'allow'}.contains(key)) {
        throw FormatException('Unknown key: $key.');
      }
    }

    return DesignCheckConfig(
      strict: list(map['strict'], 'strict'),
      exclude: list(map['exclude'], 'exclude'),
      allow: allow,
    );
  }

  bool isExcluded(String path) => exclude.any((pattern) => _matches(pattern, path));

  bool isStrict(String path) => strict.any((pattern) => _matches(pattern, path));

  bool isAllowed(DesignRule rule, String path) =>
      (allow[rule] ?? const []).any((pattern) => _matches(pattern, path));

  static bool _matches(String pattern, String path) {
    if (pattern.startsWith('*')) {
      return path.endsWith(pattern.substring(1));
    }

    if (pattern.endsWith('/')) {
      return path.startsWith(pattern);
    }

    return path == pattern;
  }
}

/// Checks one Dart file. [path] is relative to apps/panel.
///
/// A line can opt out of a rule with `// design-system: ignore <rule>` on the
/// line itself or the line above; give the reason after the rule name.
List<Finding> checkSource(
  String source, {
  required String path,
  DesignCheckConfig config = const DesignCheckConfig(),
}) {
  if (config.isExcluded(path)) {
    return const [];
  }

  final result = parseString(content: source, path: path, throwIfDiagnostics: false);
  final visitor = _Visitor(path, source, result.lineInfo, config);

  result.unit.accept(visitor);

  final strict = config.isStrict(path);

  return [
    for (final finding in visitor.findings) finding.withStrict(strict),
  ];
}

/// The folder a finding is counted under: `lib/<area>/<name>`, or the file's
/// folder when it is shallower.
String folderOf(String path) {
  final parts = path.split('/');

  if (parts.length <= 2) {
    return parts.first;
  }

  return parts.take(parts.length > 3 ? 3 : parts.length - 1).join('/');
}

class _Visitor extends RecursiveAstVisitor<void> {
  _Visitor(this.path, this.source, this.lineInfo, this.config)
      : _lines = source.split('\n');

  final String path;
  final String source;
  final LineInfo lineInfo;
  final DesignCheckConfig config;
  final List<String> _lines;

  final List<Finding> findings = [];

  static final RegExp _ignore = RegExp(r'//\s*design-system:\s*ignore\s+([\w-]+)');

  @override
  void visitInstanceCreationExpression(InstanceCreationExpression node) {
    final type = node.constructorName.type.name.lexeme;

    if (type == 'Color' && node.constructorName.name == null) {
      _checkColour(node, node.argumentList);
    }

    if (stockWidgets.contains(type)) {
      _report(node, DesignRule.stockWidget);
    }

    super.visitInstanceCreationExpression(node);
  }

  /// Without resolution, `Color(…)` and `AppBar(…)` without `new` or `const`
  /// parse as method calls, and `SwitchListTile.adaptive(…)` as a call on a
  /// target.
  @override
  void visitMethodInvocation(MethodInvocation node) {
    final target = node.target;
    final name = node.methodName.name;

    if (target == null) {
      if (name == 'Color') {
        _checkColour(node, node.argumentList);
      }

      if (stockWidgets.contains(name)) {
        _report(node, DesignRule.stockWidget);
      }
    } else if (target is SimpleIdentifier && stockWidgets.contains(target.name)) {
      _report(node, DesignRule.stockWidget);
    }

    super.visitMethodInvocation(node);
  }

  @override
  void visitNamedExpression(NamedExpression node) {
    if (node.name.label.name == 'fontSize' && _hasNumber(node.expression)) {
      _report(node, DesignRule.fontSize);
    }

    super.visitNamedExpression(node);
  }

  void _checkColour(AstNode node, ArgumentList arguments) {
    final first = arguments.arguments.isEmpty ? null : arguments.arguments.first;

    if (first is IntegerLiteral && first.literal.lexeme.toLowerCase().startsWith('0x')) {
      _report(node, DesignRule.hexColour);
    }
  }

  static bool _hasNumber(Expression expression) {
    var found = false;

    expression.accept(_NumberFinder((_) => found = true));

    return found;
  }

  void _report(AstNode node, DesignRule rule) {
    if (config.isAllowed(rule, path)) {
      return;
    }

    final location = lineInfo.getLocation(node.offset);

    if (_isIgnored(location.lineNumber, rule)) {
      return;
    }

    var detail = source.substring(node.offset, node.end).replaceAll(RegExp(r'\s+'), ' ');

    if (detail.length > 60) {
      detail = '${detail.substring(0, 57)}...';
    }

    findings.add(Finding(
      path: path,
      line: location.lineNumber,
      column: location.columnNumber,
      rule: rule,
      detail: detail,
    ));
  }

  bool _isIgnored(int line, DesignRule rule) {
    for (final index in [line - 1, line - 2]) {
      if (index < 0 || index >= _lines.length) {
        continue;
      }

      for (final match in _ignore.allMatches(_lines[index])) {
        if (match.group(1) == rule.id) {
          return true;
        }
      }
    }

    return false;
  }
}

class _NumberFinder extends RecursiveAstVisitor<void> {
  _NumberFinder(this.onFound);

  final void Function(Literal) onFound;

  @override
  void visitIntegerLiteral(IntegerLiteral node) => onFound(node);

  @override
  void visitDoubleLiteral(DoubleLiteral node) => onFound(node);
}
