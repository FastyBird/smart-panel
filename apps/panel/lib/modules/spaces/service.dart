import 'package:fastybird_smart_panel/api/models/spaces_module_data_space.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/spaces.dart';
import 'package:flutter/foundation.dart';

class SpacesService extends ChangeNotifier {
  final SpacesRepository _spacesRepository;

  Map<String, SpacesModuleDataSpace> _spaces = {};

  SpacesService({
    required SpacesRepository spacesRepository,
  }) : _spacesRepository = spacesRepository;

  Future<void> initialize() async {
    await _spacesRepository.fetchAll();

    _spacesRepository.addListener(_updateData);

    _updateData();
  }

  /// All spaces as a map by ID
  Map<String, SpacesModuleDataSpace> get spaces => _spaces;

  /// All spaces as a list
  List<SpacesModuleDataSpace> get spacesList => _spaces.values.toList();

  /// All rooms (spaces with type=room) sorted by display order
  List<SpacesModuleDataSpace> get rooms => _spaces.values
      .where((s) => s.type == SpacesModuleDataSpaceType.room)
      .toList()
    ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

  /// All zones (spaces with type=zone) sorted by display order
  List<SpacesModuleDataSpace> get zones => _spaces.values
      .where((s) => s.type == SpacesModuleDataSpaceType.zone)
      .toList()
    ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

  /// Get a specific space by ID
  SpacesModuleDataSpace? getSpace(String id) {
    return _spaces[id];
  }

  /// Get spaces by list of IDs
  List<SpacesModuleDataSpace> getSpaces(List<String> ids) {
    return _spaces.entries
        .where((entry) => ids.contains(entry.key))
        .map((entry) => entry.value)
        .toList();
  }

  /// Get child rooms of a zone
  List<SpacesModuleDataSpace> getChildRooms(String zoneId) {
    return _spaces.values
        .where((s) => s.parentId == zoneId)
        .toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
  }

  /// Get the parent zone of a room
  SpacesModuleDataSpace? getParentZone(String roomId) {
    final room = _spaces[roomId];
    if (room == null || room.parentId == null) {
      return null;
    }
    return _spaces[room.parentId];
  }

  void _updateData() {
    final newSpaces = {for (var s in _spacesRepository.spaces) s.id: s};

    if (!mapEquals(_spaces, newSpaces)) {
      _spaces = newSpaces;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _spacesRepository.removeListener(_updateData);
    super.dispose();
  }
}
