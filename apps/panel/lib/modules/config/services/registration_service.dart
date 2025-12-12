import 'package:fastybird_smart_panel/modules/config/models/model.dart';

class ModuleConfigRegistration {
  final String name;
  final Model Function(Map<String, dynamic>) fromJson;
  final Future<bool> Function(String name, Map<String, dynamic> data)? updateHandler;

  ModuleConfigRegistration({
    required this.name,
    required this.fromJson,
    this.updateHandler,
  });
}

class PluginConfigRegistration {
  final String name;
  final Model Function(Map<String, dynamic>) fromJson;
  final Future<bool> Function(String name, Map<String, dynamic> data)? updateHandler;

  PluginConfigRegistration({
    required this.name,
    required this.fromJson,
    this.updateHandler,
  });
}

class ConfigRegistrationService {
  final Map<String, ModuleConfigRegistration> _moduleRegistrations = {};
  final Map<String, PluginConfigRegistration> _pluginRegistrations = {};

  void registerModule<T extends Model>(
    String name,
    T Function(Map<String, dynamic>) fromJson, {
    Future<bool> Function(String name, Map<String, dynamic> data)? updateHandler,
  }) {
    _moduleRegistrations[name] = ModuleConfigRegistration(
      name: name,
      fromJson: fromJson,
      updateHandler: updateHandler,
    );
  }

  void registerPlugin<T extends Model>(
    String name,
    T Function(Map<String, dynamic>) fromJson, {
    Future<bool> Function(String name, Map<String, dynamic> data)? updateHandler,
  }) {
    _pluginRegistrations[name] = PluginConfigRegistration(
      name: name,
      fromJson: fromJson,
      updateHandler: updateHandler,
    );
  }

  List<String> getRegisteredModules() {
    return _moduleRegistrations.keys.toList();
  }

  List<String> getRegisteredPlugins() {
    return _pluginRegistrations.keys.toList();
  }

  bool isRegistered(String name) {
    return _moduleRegistrations.containsKey(name) || _pluginRegistrations.containsKey(name);
  }

  bool isModuleRegistered(String name) {
    return _moduleRegistrations.containsKey(name);
  }

  bool isPluginRegistered(String name) {
    return _pluginRegistrations.containsKey(name);
  }

  ModuleConfigRegistration? getModuleRegistration(String name) {
    return _moduleRegistrations[name];
  }

  PluginConfigRegistration? getPluginRegistration(String name) {
    return _pluginRegistrations[name];
  }
}
