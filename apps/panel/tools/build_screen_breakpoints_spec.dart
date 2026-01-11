import 'dart:convert';
import 'dart:io';

void main() async {
  final inputFile = File(
    Platform.script
        .resolve(
          '../../../spec/displays/screen_breakpoints.json',
        )
        .toFilePath(),
  );
  final outputPath = Platform.script
      .resolve('../lib/spec/screen_breakpoints.g.dart')
      .toFilePath();
  final outputFile = File(outputPath);

  if (!await inputFile.exists()) {
    // ignore: avoid_print
    print('Screen breakpoints config not found: ${inputFile.path}');
    return;
  }

  // Ensure the directory exists
  await Directory(outputFile.parent.path).create(recursive: true);

  final Map<String, dynamic> jsonMap =
      jsonDecode(await inputFile.readAsString()) as Map<String, dynamic>;

  final portrait = jsonMap['portrait'] as Map<String, dynamic>? ?? {};
  final landscape = jsonMap['landscape'] as Map<String, dynamic>? ?? {};

  final buffer = StringBuffer();

  buffer.writeln('// GENERATED CODE - DO NOT MODIFY BY HAND');
  buffer.writeln('// ignore_for_file: constant_identifier_names');
  buffer.writeln();
  buffer.writeln(
      '// Screen size breakpoints for responsive layouts in domain pages.');
  buffer.writeln('//');
  buffer.writeln('// Usage with ScreenService:');
  buffer.writeln('// ```dart');
  buffer.writeln('// final screenService = locator<ScreenService>();');
  buffer.writeln(
      '// final tilesPerRow = screenService.isLargeScreen ? 4 : 3;');
  buffer.writeln('// ```');
  buffer.writeln();

  // Enum for screen sizes
  buffer.writeln('/// Screen size categories.');
  buffer.writeln('enum ScreenSize {');
  buffer.writeln('  /// Small screens (compact layout)');
  buffer.writeln('  small,');
  buffer.writeln();
  buffer.writeln('  /// Medium screens (standard layout)');
  buffer.writeln('  medium,');
  buffer.writeln();
  buffer.writeln('  /// Large screens (expanded layout)');
  buffer.writeln('  large,');
  buffer.writeln('}');
  buffer.writeln();

  // Breakpoints class
  buffer.writeln('/// Screen breakpoint thresholds.');
  buffer.writeln('///');
  buffer.writeln('/// Values represent maximum width for each size category.');
  buffer.writeln('/// - small: width <= small threshold');
  buffer.writeln('/// - medium: width <= medium threshold');
  buffer.writeln('/// - large: width > medium threshold');
  buffer.writeln('class ScreenBreakpoints {');
  buffer.writeln('  ScreenBreakpoints._();');
  buffer.writeln();

  // Portrait breakpoints
  buffer.writeln('  // Portrait orientation breakpoints');
  if (portrait['small'] != null) {
    buffer.writeln(
        '  static const double portraitSmall = ${_asDouble(portrait['small'])};');
  }
  if (portrait['medium'] != null) {
    buffer.writeln(
        '  static const double portraitMedium = ${_asDouble(portrait['medium'])};');
  }
  buffer.writeln();

  // Landscape breakpoints
  buffer.writeln('  // Landscape orientation breakpoints');
  if (landscape['small'] != null) {
    buffer.writeln(
        '  static const double landscapeSmall = ${_asDouble(landscape['small'])};');
  }
  if (landscape['medium'] != null) {
    buffer.writeln(
        '  static const double landscapeMedium = ${_asDouble(landscape['medium'])};');
  }
  buffer.writeln();

  // Helper method to get screen size
  buffer.writeln('  /// Get screen size category based on width and orientation.');
  buffer.writeln(
      '  static ScreenSize getScreenSize(double width, {required bool isPortrait}) {');
  buffer.writeln('    if (isPortrait) {');
  buffer.writeln('      if (width <= portraitSmall) return ScreenSize.small;');
  buffer.writeln('      if (width <= portraitMedium) return ScreenSize.medium;');
  buffer.writeln('      return ScreenSize.large;');
  buffer.writeln('    } else {');
  buffer.writeln('      if (width <= landscapeSmall) return ScreenSize.small;');
  buffer.writeln('      if (width <= landscapeMedium) return ScreenSize.medium;');
  buffer.writeln('      return ScreenSize.large;');
  buffer.writeln('    }');
  buffer.writeln('  }');

  buffer.writeln('}');

  await outputFile.writeAsString('${buffer.toString()}\n');

  // ignore: avoid_print
  print('Generated screen breakpoints to: ${outputFile.path}');
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
