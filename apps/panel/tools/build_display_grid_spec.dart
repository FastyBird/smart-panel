import 'dart:convert';
import 'dart:io';

void main() async {
  final inputFile = File(
    Platform.script
        .resolve(
          '../../../spec/displays/grid.json',
        )
        .toFilePath(),
  );
  final outputPath =
      Platform.script.resolve('../lib/spec/grid_config.g.dart').toFilePath();
  final outputFile = File(outputPath);

  if (!await inputFile.exists()) {
    print('🚫 Grid config not found: ${inputFile.path}');
    return;
  }

  // Ensure the directory exists
  await Directory(outputFile.parent.path).create(recursive: true);

  final Map<String, dynamic> jsonMap =
      jsonDecode(await inputFile.readAsString()) as Map<String, dynamic>;

  // Pull values (all optional except defaultScalingFactor + breakpoints per your schema)
  final defaultScalingFactor = jsonMap['defaultScalingFactor'];
  final fallbackDivisor = jsonMap['fallbackDivisor'];
  final minUnitSize = jsonMap['minUnitSize'];
  final maxUnitSize = jsonMap['maxUnitSize'];
  final defaultRows = jsonMap['defaultRows'];
  final defaultCols = jsonMap['defaultCols'];

  final scaleAdjustments =
      (jsonMap['scaleAdjustments'] as Map<String, dynamic>?) ?? {};

  final List<dynamic> breakpoints =
      (jsonMap['breakpoints'] as List<dynamic>? ?? []);
  final Map<String, dynamic> orientationOverrides =
      (jsonMap['orientationOverrides'] as Map<String, dynamic>?) ?? {};
  final List<dynamic> dpiBreakpoints =
      (jsonMap['dpiBreakpoints'] as List<dynamic>? ?? []);

  final buffer = StringBuffer();

  buffer.writeln('// GENERATED CODE - DO NOT MODIFY BY HAND');
  buffer.writeln('// ignore_for_file: constant_identifier_names');
  buffer.writeln();
  buffer.writeln('/// Grid configuration generated from JSON.');
  buffer.writeln('class GridConfig {');

  // Scalars
  if (defaultScalingFactor == null) {
    throw StateError('defaultScalingFactor is required in grid.json');
  }
  buffer.writeln(
    '  static const double defaultScalingFactor = ${_asDouble(defaultScalingFactor)};',
  );

  if (fallbackDivisor != null) {
    buffer.writeln(
      '  static const int? fallbackDivisor = ${fallbackDivisor as int};',
    );
  } else {
    buffer.writeln('  static const int? fallbackDivisor = null;');
  }

  if (minUnitSize != null) {
    buffer.writeln(
      '  static const double? minUnitSize = ${_asDouble(minUnitSize)};',
    );
  } else {
    buffer.writeln('  static const double? minUnitSize = null;');
  }

  if (maxUnitSize != null) {
    buffer.writeln(
      '  static const double? maxUnitSize = ${_asDouble(maxUnitSize)};',
    );
  } else {
    buffer.writeln('  static const double? maxUnitSize = null;');
  }

  if (defaultRows != null) {
    buffer.writeln('  static const int? defaultRows = ${defaultRows as int};');
  } else {
    buffer.writeln('  static const int? defaultRows = null;');
  }

  if (defaultCols != null) {
    buffer.writeln('  static const int? defaultCols = ${defaultCols as int};');
  } else {
    buffer.writeln('  static const int? defaultCols = null;');
  }

  // scaleAdjustments
  buffer.writeln('  static const Map<String, double> scaleAdjustments = {');
  for (final entry in scaleAdjustments.entries) {
    buffer.writeln("    '${entry.key}': ${_asDouble(entry.value)},");
  }
  buffer.writeln('  };');

  // Breakpoint type
  buffer.writeln();
  buffer.writeln('  /// Base width breakpoints.');
  buffer.writeln('  static const List<Breakpoint> breakpoints = <Breakpoint>[');
  for (final bp in breakpoints) {
    final m = bp as Map<String, dynamic>;
    final maxW = m['maxWidth'];
    final divisor = m['divisor'];
    buffer.writeln(
      '    Breakpoint(maxWidth: ${_asDouble(maxW)}, divisor: ${divisor as int}),',
    );
  }
  buffer.writeln('  ];');

  // Orientation overrides
  buffer.writeln();
  buffer.writeln('  /// Orientation-specific overrides (optional).');
  final portrait =
      (orientationOverrides['portrait'] as List<dynamic>?) ?? const [];
  final landscape =
      (orientationOverrides['landscape'] as List<dynamic>?) ?? const [];

  buffer.writeln(
    '  static const List<Breakpoint> portraitOverrides = <Breakpoint>[',
  );
  for (final bp in portrait) {
    final m = bp as Map<String, dynamic>;
    buffer.writeln(
      '    Breakpoint(maxWidth: ${_asDouble(m['maxWidth'])}, divisor: ${m['divisor'] as int}),',
    );
  }
  buffer.writeln('  ];');

  buffer.writeln(
      '  static const List<Breakpoint> landscapeOverrides = <Breakpoint>[');
  for (final bp in landscape) {
    final m = bp as Map<String, dynamic>;
    buffer.writeln(
      '    Breakpoint(maxWidth: ${_asDouble(m['maxWidth'])}, divisor: ${m['divisor'] as int}),',
    );
  }
  buffer.writeln('  ];');

  // DPI breakpoints
  buffer.writeln();
  buffer.writeln('  /// DPI-based adjustments (optional).');
  buffer.writeln(
    '  static const List<DpiBreakpoint> dpiBreakpoints = <DpiBreakpoint>[',
  );
  for (final dbp in dpiBreakpoints) {
    final m = dbp as Map<String, dynamic>;

    buffer.writeln(
      '    DpiBreakpoint(minDpi: ${_asDouble(m['minDpi'])}, factor: ${_asDouble(m['factor'])}),',
    );
  }
  buffer.writeln('  ];');

  buffer.writeln('}');

  // Value classes
  buffer.writeln();
  buffer.writeln('class Breakpoint {');
  buffer.writeln('  final double maxWidth;');
  buffer.writeln('  final int divisor;');
  buffer.writeln(
    '  const Breakpoint({required this.maxWidth, required this.divisor});',
  );
  buffer.writeln('}');

  buffer.writeln();
  buffer.writeln('class DpiBreakpoint {');
  buffer.writeln('  final double minDpi;');
  buffer.writeln('  final double factor;');
  buffer.writeln(
    '  const DpiBreakpoint({required this.minDpi, required this.factor});',
  );
  buffer.writeln('}');

  await outputFile.writeAsString('${buffer.toString()}\n');

  print('✅ Generated grid config to: ${outputFile.path}');
}

String _asDouble(dynamic n) {
  if (n is int) {
    return '$n.0';
  }

  if (n is double) {
    return n.toString();
  }

  throw ArgumentError('Expected number, got: $n');
}
