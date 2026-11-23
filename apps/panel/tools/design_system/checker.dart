import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/token.dart';
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

/// The named constructors of [stockWidgets] (Flutter 3.41.5). Other calls on
/// these classes, such as `ListTile.divideTiles(…)` or
/// `AppBar.preferredHeightFor(…)`, are static helpers that build none of them.
const Map<String, Set<String>> stockWidgetNamedConstructors = {
  'SwitchListTile': {'adaptive'},
  'FilterChip': {'elevated'},
  'ActionChip': {'elevated'},
  'AlertDialog': {'adaptive'},
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
  final visitor = _Visitor(
    path,
    source,
    result.lineInfo,
    config,
    _ignoredRules(result.unit.beginToken, result.lineInfo),
    {
      for (final directive in result.unit.directives)
        if (directive is ImportDirective && directive.prefix != null)
          directive.prefix!.name,
    },
  );

  result.unit.accept(visitor);

  final strict = config.isStrict(path);

  return [
    for (final finding in visitor.findings) finding.withStrict(strict),
  ];
}

final RegExp _ignoreDirective = RegExp(r'^//\s*design-system:\s*ignore\s+([\w-]+)');

/// The rules each line opts out of, from `// design-system: ignore <rule>`
/// comments. Only real comments count, never text inside a string.
Map<int, Set<String>> _ignoredRules(Token first, LineInfo lineInfo) {
  final ignored = <int, Set<String>>{};
  Token? token = first;

  while (token != null) {
    Token? comment = token.precedingComments;

    while (comment != null) {
      final match = _ignoreDirective.firstMatch(comment.lexeme);

      if (match != null) {
        ignored
            .putIfAbsent(lineInfo.getLocation(comment.offset).lineNumber, () => {})
            .add(match.group(1)!);
      }

      comment = comment.next;
    }

    if (token.type == TokenType.EOF) {
      break;
    }

    token = token.next;
  }

  return ignored;
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
  _Visitor(
    this.path,
    this.source,
    this.lineInfo,
    this.config,
    this.ignored,
    this.importPrefixes,
  );

  final String path;
  final String source;
  final LineInfo lineInfo;
  final DesignCheckConfig config;

  /// Rules ignored per line number.
  final Map<int, Set<String>> ignored;

  /// The `as` prefixes of this file's imports.
  final Set<String> importPrefixes;

  final List<Finding> findings = [];

  @override
  void visitInstanceCreationExpression(InstanceCreationExpression node) {
    final namedType = node.constructorName.type;
    final prefix = namedType.importPrefix?.name.lexeme;
    var type = namedType.name.lexeme;
    var constructor = node.constructorName.name?.name;

    // Without resolution, `const SwitchListTile.adaptive()` reads as the type
    // `adaptive` behind a prefix `SwitchListTile`. A prefix the file does not
    // import is the class.
    final isImported = prefix != null && importPrefixes.contains(prefix);

    if (constructor == null && prefix != null && !isImported) {
      constructor = type;
      type = prefix;
    }

    // An unprefixed type the file declares itself is not the Flutter one:
    // `const Color(…)` may build a file-local `Color` class.
    final isOwn = !isImported && _isShadowed(type, node);

    if (!isOwn && type == 'Color' && constructor == null) {
      _checkColour(node, node.argumentList);
    }

    if (!isOwn && stockWidgets.contains(type)) {
      _report(node, DesignRule.stockWidget);
    }

    super.visitInstanceCreationExpression(node);
  }

  /// Without resolution, a constructor call without `new` or `const` parses
  /// as a method call:
  ///
  /// - `Color(…)`, `AppBar(…)`: no target.
  /// - `ui.Color(…)`, `material.AppBar(…)`: the import prefix is the target.
  ///   Only prefixes this file declares count, so `palette.Color(…)` on an
  ///   object is not a constructor. Nor is `ui.Color(…)` where a parameter,
  ///   local or member named `ui` hides the prefix.
  /// - `SwitchListTile.adaptive(…)`: the class is the target.
  /// - `material.SwitchListTile.adaptive(…)`: the prefixed class is the
  ///   target.
  @override
  void visitMethodInvocation(MethodInvocation node) {
    final target = node.target;
    final name = node.methodName.name;

    // `palette..Color(…)` has no target either, but calls a method on
    // `palette`. A bare `Color(…)` is a local function or member when one
    // of that name is in scope.
    final isConstructor = !node.isCascaded &&
        switch (target) {
          null => !_isShadowed(name, node),
          SimpleIdentifier(name: final prefix) => _isPrefix(prefix, node),
          _ => false,
        };
    // A target is a class only when it is neither an import prefix nor a
    // parameter, local or member: `ListTile.isReady()` on a variable named
    // `ListTile` is a method call.
    final namedConstructorOf = switch (target) {
      SimpleIdentifier(name: final type)
          when !importPrefixes.contains(type) && !_isShadowed(type, node) =>
        type,
      PrefixedIdentifier(:final prefix, :final identifier)
          when _isPrefix(prefix.name, node) =>
        identifier.name,
      _ => null,
    };

    if (isConstructor && name == 'Color') {
      _checkColour(node, node.argumentList);
    }

    if ((isConstructor && stockWidgets.contains(name)) ||
        (stockWidgetNamedConstructors[namedConstructorOf]?.contains(name) ?? false)) {
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

  /// Whether [name] means an import prefix at [node]: an import declares it
  /// and nothing in scope hides it.
  bool _isPrefix(String name, AstNode node) =>
      importPrefixes.contains(name) && !_isShadowed(name, node);

  /// Whether a scope around [node] declares [name]. Without resolution this
  /// is lexical: parameters, locals, loop, catch and pattern variables, local
  /// functions, and the enclosing type's own members. Inherited members are
  /// not seen.
  static bool _isShadowed(String name, AstNode node) {
    AstNode child = node;
    AstNode? scope = node.parent;

    while (scope != null) {
      if (_declares(scope, child, name)) {
        return true;
      }

      child = scope;
      scope = scope.parent;
    }

    return false;
  }

  static bool _declares(AstNode scope, AstNode child, String name) {
    bool named(Token? token) => token?.lexeme == name;
    bool inParameters(FormalParameterList? list) =>
        list?.parameters.any((parameter) => named(parameter.name)) ?? false;
    bool inVariables(VariableDeclarationList list) =>
        list.variables.any((variable) => named(variable.name));
    bool inMembers(List<ClassMember> members) => members.any((member) => switch (member) {
          MethodDeclaration(:final name) => named(name),
          FieldDeclaration(:final fields) => inVariables(fields),
          _ => false,
        });
    // A local is in scope in its whole block; using it earlier is an error.
    bool inStatements(List<Statement> statements) => statements.any((statement) => switch (statement) {
          VariableDeclarationStatement(:final variables) => inVariables(variables),
          FunctionDeclarationStatement(:final functionDeclaration) => named(functionDeclaration.name),
          PatternVariableDeclarationStatement(:final declaration) =>
            _patternDeclares(declaration.pattern, name),
          _ => false,
        });
    // A for-in variable is in scope in the body only, not in the iterable.
    // A classic for variable is in scope in the whole loop; its own
    // initialiser cannot use it.
    bool inLoop(ForLoopParts parts, bool inBody) => switch (parts) {
          ForEachPartsWithDeclaration(:final loopVariable) => inBody && named(loopVariable.name),
          ForEachPartsWithPattern(:final pattern) => inBody && _patternDeclares(pattern, name),
          ForPartsWithDeclarations(:final variables) => inVariables(variables),
          ForPartsWithPattern(:final variables) => _patternDeclares(variables.pattern, name),
          _ => false,
        };

    return switch (scope) {
      FunctionExpression(:final parameters) => inParameters(parameters),
      MethodDeclaration(:final parameters) => inParameters(parameters),
      ConstructorDeclaration(:final parameters) => inParameters(parameters),
      Block(:final statements) => inStatements(statements),
      ForStatement(:final forLoopParts, :final body) => inLoop(forLoopParts, child == body),
      ForElement(:final forLoopParts, :final body) => inLoop(forLoopParts, child == body),
      CatchClause(:final exceptionParameter, :final stackTraceParameter) =>
        named(exceptionParameter?.name) || named(stackTraceParameter?.name),
      // `if (x case final ui when …)` binds `ui` in the guard and the then
      // branch, not in `x` or the else branch.
      GuardedPattern(:final pattern, :final whenClause?) when child == whenClause =>
        _patternDeclares(pattern, name),
      IfStatement(:final caseClause?, :final thenStatement) =>
        child == thenStatement && _patternDeclares(caseClause.guardedPattern.pattern, name),
      IfElement(:final caseClause?, :final thenElement) =>
        child == thenElement && _patternDeclares(caseClause.guardedPattern.pattern, name),
      // A case body declares locals without a block: `case 0: final ui = …;`.
      SwitchPatternCase(:final guardedPattern, :final statements) =>
        _patternDeclares(guardedPattern.pattern, name) || inStatements(statements),
      SwitchMember(:final statements) => inStatements(statements),
      SwitchExpressionCase(:final guardedPattern) => _patternDeclares(guardedPattern.pattern, name),
      ClassDeclaration(:final members) ||
      MixinDeclaration(:final members) ||
      ExtensionDeclaration(:final members) =>
        inMembers(members),
      // Enum values are implicit static fields: `enum Palette { ui; … }`.
      EnumDeclaration(:final constants, :final members) =>
        constants.any((constant) => named(constant.name)) || inMembers(members),
      // The representation field is in scope in the members:
      // `extension type Palette(dynamic ui) { … }`.
      ExtensionTypeDeclaration(:final representation, :final members) =>
        named(representation.fieldName) || inMembers(members),
      // The file's own functions, variables and types: `Color(…)` calls a
      // top-level `Color` declared here, not the dart:ui class.
      CompilationUnit(:final declarations) => declarations.any((declaration) => switch (declaration) {
            NamedCompilationUnitMember(:final name) => named(name),
            TopLevelVariableDeclaration(:final variables) => inVariables(variables),
            _ => false,
          }),
      _ => false,
    };
  }

  static bool _patternDeclares(DartPattern pattern, String name) {
    var found = false;

    pattern.accept(_PatternVariableFinder(name, () => found = true));

    return found;
  }

  void _checkColour(AstNode node, ArgumentList arguments) {
    // `Color((0xFF112233))` is the same colour.
    final first = arguments.arguments.isEmpty ? null : arguments.arguments.first.unParenthesized;

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

  /// A directive on the line itself or the line above.
  bool _isIgnored(int line, DesignRule rule) =>
      (ignored[line]?.contains(rule.id) ?? false) ||
      (ignored[line - 1]?.contains(rule.id) ?? false);
}

class _PatternVariableFinder extends RecursiveAstVisitor<void> {
  _PatternVariableFinder(this.name, this.onFound);

  final String name;
  final void Function() onFound;

  @override
  void visitDeclaredVariablePattern(DeclaredVariablePattern node) {
    if (node.name.lexeme == name) {
      onFound();
    }

    super.visitDeclaredVariablePattern(node);
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
