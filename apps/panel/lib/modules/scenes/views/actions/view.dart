class ActionView {
  final String _id;
  final String _type;
  final String _scene;
  final int _order;
  final bool _enabled;
  final Map<String, dynamic> _configuration;

  ActionView({
    required String id,
    required String type,
    required String scene,
    required int order,
    required bool enabled,
    Map<String, dynamic> configuration = const {},
  })  : _id = id,
        _type = type,
        _scene = scene,
        _order = order,
        _enabled = enabled,
        _configuration = configuration;

  String get id => _id;

  /// Action type identifier (e.g., "scenes-local")
  String get type => _type;

  String get scene => _scene;

  int get order => _order;

  bool get enabled => _enabled;

  /// Raw configuration for actions
  Map<String, dynamic> get configuration => _configuration;
}
