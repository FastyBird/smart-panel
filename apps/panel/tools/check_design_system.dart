// Reports every place in lib/ that breaks the display design system
// (docs/display-ui-design-spec.md §1, §12).
//
// Usage, from apps/panel:
//   dart run tools/check_design_system.dart [--summary] [--format=text|github]
//
// Findings in the folders listed under `strict` in tools/design_system.yaml
// are errors and make the check exit with 1. All other findings are warnings.
//
// ignore_for_file: avoid_print
import 'dart:io';

import 'design_system/checker.dart';

Future<void> main(List<String> args) async {
  final summaryOnly = args.contains('--summary');
  final github = args.contains('--format=github');
  final unknown = args.where(
    (arg) => !const {'--summary', '--format=github', '--format=text'}.contains(arg),
  );

  if (unknown.isNotEmpty) {
    stderr.writeln('Unknown argument: ${unknown.first}');
    stderr.writeln('Usage: dart run tools/check_design_system.dart [--summary] [--format=text|github]');
    exitCode = 2;
    return;
  }

  final root = Directory.fromUri(Platform.script.resolve('..'));
  final configFile = File.fromUri(root.uri.resolve('tools/design_system.yaml'));

  DesignCheckConfig config;

  try {
    config = DesignCheckConfig.parse(await configFile.readAsString());
  } on Object catch (error) {
    stderr.writeln('Cannot read ${configFile.path}: $error');
    exitCode = 2;
    return;
  }

  final lib = Directory.fromUri(root.uri.resolve('lib/'));
  final files = await lib
      .list(recursive: true)
      .where((entity) => entity is File && entity.path.endsWith('.dart'))
      .cast<File>()
      .toList();

  files.sort((a, b) => a.path.compareTo(b.path));

  final findings = <Finding>[];

  for (final file in files) {
    final path = _relative(root, file);

    if (config.isExcluded(path)) {
      continue;
    }

    findings.addAll(checkSource(await file.readAsString(), path: path, config: config));
  }

  if (!summaryOnly) {
    for (final finding in findings) {
      print(finding);

      if (github && finding.strict) {
        print('::error file=apps/panel/${finding.path},line=${finding.line},col=${finding.column},'
            'title=Design system (${finding.rule.id})::${finding.rule.message}');
      }
    }

    if (findings.isNotEmpty) {
      print('');
    }
  }

  final table = _summary(findings);

  print(table);

  final stepSummary = Platform.environment['GITHUB_STEP_SUMMARY'];

  if (github && stepSummary != null && stepSummary.isNotEmpty) {
    await File(stepSummary).writeAsString(
      '## Design system check\n\n$table\n',
      mode: FileMode.append,
    );
  }

  final errors = findings.where((finding) => finding.strict).length;

  if (errors > 0) {
    print('\n$errors finding(s) in strict folders. See docs/display-ui-design-spec.md §1.');
    exitCode = 1;
  }
}

String _relative(Directory root, File file) {
  final rootPath = root.uri.toFilePath();

  return file.uri.toFilePath().substring(rootPath.length).replaceAll(r'\', '/');
}

/// A Markdown table of findings per folder and rule, with a total row.
String _summary(List<Finding> findings) {
  final rules = DesignRule.values;
  final counts = <String, Map<DesignRule, int>>{};
  final strictCounts = <String, int>{};

  for (final finding in findings) {
    final folder = folderOf(finding.path);
    final perRule = counts.putIfAbsent(folder, () => {});

    perRule[finding.rule] = (perRule[finding.rule] ?? 0) + 1;

    if (finding.strict) {
      strictCounts[folder] = (strictCounts[folder] ?? 0) + 1;
    }
  }

  final buffer = StringBuffer()
    ..writeln('| Folder | ${rules.map((rule) => rule.id).join(' | ')} | Total | Mode |')
    ..writeln('|---|${rules.map((_) => '---:').join('|')}|---:|---|');

  final folders = counts.keys.toList()..sort();
  final totals = <DesignRule, int>{};

  for (final folder in folders) {
    final perRule = counts[folder]!;
    final total = perRule.values.fold<int>(0, (sum, count) => sum + count);

    for (final entry in perRule.entries) {
      totals[entry.key] = (totals[entry.key] ?? 0) + entry.value;
    }

    final strict = strictCounts[folder] ?? 0;
    final mode = strict == 0 ? 'warning' : (strict == total ? 'error' : 'mixed');

    buffer.writeln(
      '| `$folder` | ${rules.map((rule) => perRule[rule] ?? 0).join(' | ')} | $total | $mode |',
    );
  }

  final total = totals.values.fold<int>(0, (sum, count) => sum + count);

  buffer.write(
    '| **Total** | ${rules.map((rule) => totals[rule] ?? 0).join(' | ')} | $total | |',
  );

  return buffer.toString();
}
