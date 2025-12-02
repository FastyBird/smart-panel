import 'dart:convert';
import 'dart:io';

void main() async {
  final inputFile = File(Platform.script
      .resolve('../../../spec/devices/channels.json')
      .toFilePath());
  final outputPath =
      Platform.script.resolve('../lib/spec/channel_spec.g.dart').toFilePath();
  final outputFile = File(outputPath);

  if (!await inputFile.exists()) {
    // ignore: avoid_print
    print('🚫 Spec file not found: ${inputFile.path}');

    return;
  }

  // Ensure the directory exists
  await Directory(outputFile.parent.path).create(recursive: true);

  final json =
      jsonDecode(await inputFile.readAsString()) as Map<String, dynamic>;

  final buffer = StringBuffer();

  buffer.writeln('// GENERATED CODE - DO NOT MODIFY BY HAND');
  buffer.writeln('// ignore_for_file: constant_identifier_names\n');
  buffer.writeln();
  buffer.writeln(
      'import \'package:fastybird_smart_panel/modules/devices/types/categories.dart\';\n');
  buffer.writeln('class ChannelPropertiesSpecification {');
  buffer.writeln('  final List<ChannelPropertyCategory> required;');
  buffer.writeln('  final List<ChannelPropertyCategory> optional;\n');
  buffer.writeln('  const ChannelPropertiesSpecification({');
  buffer.writeln('    required this.required,');
  buffer.writeln('    required this.optional,');
  buffer.writeln('  });\n');
  buffer.writeln('  List<ChannelPropertyCategory> get all => [');
  buffer.writeln('        ...required,');
  buffer.writeln('        ...optional,');
  buffer.writeln('      ];');
  buffer.writeln('}\n');
  buffer.writeln(
      'const Map<ChannelCategory, ChannelPropertiesSpecification> channelPropertiesSpecificationMappers = {');

  for (final entry in json.entries) {
    final category = entry.key;
    final categoryData = entry.value as Map<String, dynamic>;

    final properties =
        (categoryData['properties'] as Map<String, dynamic>? ?? {});

    final required = <String>[];
    final optional = <String>[];

    for (final property in properties.values) {
      final isRequired = property['required'] == true;
      final category = property['category'];

      if (category != null) {
        (isRequired ? required : optional)
            .add('ChannelPropertyCategory.${_camelToEnum(category)}');
      }
    }

    buffer.writeln(
        '  ChannelCategory.${_camelToEnum(category)}: ChannelPropertiesSpecification(');
    buffer.writeln('    required: [${required.join(', ')}],');
    buffer.writeln('    optional: [${optional.join(', ')}],');
    buffer.writeln('  ),');
  }

  buffer.writeln('};\n');

  buffer.writeln(
      'ChannelPropertiesSpecification buildChannelPropertiesSpecification(');
  buffer.writeln('  ChannelCategory category,');
  buffer.writeln(') {');
  buffer.writeln('  return channelPropertiesSpecificationMappers[category] ??');
  buffer.writeln('      ChannelPropertiesSpecification(');
  buffer.writeln('        required: [],');
  buffer.writeln('        optional: [],');
  buffer.writeln('      );');
  buffer.writeln('}');

  await outputFile.writeAsString(buffer.toString());

  // ignore: avoid_print
  print('✅ Generated channel specification to: ${outputFile.path}');
}

String _camelToEnum(String input) => input.replaceAllMapped(
    RegExp(r'_([a-z])'), (m) => m.group(1)!.toUpperCase());
