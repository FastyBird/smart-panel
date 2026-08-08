import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class DevicesRepository extends Repository<DeviceModel> {
  final ChannelsRepository _channelsRepository;

  DevicesRepository({
    required super.apiClient,
    required ChannelsRepository channelsRepository,
  }) : _channelsRepository = channelsRepository;

  /// How many `fetchAll` requests are currently in flight, and which devices were hidden while they
  /// were. A response is a snapshot of the moment it was produced: a device hidden after that moment
  /// is still in it, so applying it verbatim puts the device back — and its own eviction cannot undo
  /// that, because the stale response lists it as visible. Remembering what was hidden underneath the
  /// request is what lets the answer be applied without the part of it that is already out of date.
  int _fetchesInFlight = 0;
  final Set<String> _hiddenWhileFetching = {};

  void insert(List<Map<String, dynamic>> json) {
    late Map<String, DeviceModel> insertData = {...data};

    // Collect embedded channels to insert
    List<Map<String, dynamic>> embeddedChannels = [];

    for (var row in json) {
      // A hidden device is one this panel does not show, and the model carries no `hidden` field to
      // filter on downstream — hidden devices simply never arrive from the API, so nothing after this
      // point knows the difference. Handled here rather than at the socket handler because every route
      // in leads through this method: the create/update event, the device embedded in a connection
      // change, and the fetches below. A source device is hidden the moment a virtual device replaces
      // it, and a running panel would otherwise keep rendering the original alongside its replacement —
      // commandable, and duplicated in every space it belongs to — until the process restarted.
      if (row['hidden'] == true) {
        final hiddenId = row['id'];

        if (hiddenId is String) {
          insertData.remove(hiddenId);

          if (_fetchesInFlight > 0) {
            _hiddenWhileFetching.add(hiddenId);
          }
        }

        continue;
      }

      if (!row.containsKey('type')) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][DEVICES] Missing required attribute: "type" for device: "${row['id']}"',
          );
        }

        continue;
      }

      // Extract embedded channels before building the model
      if (row['channels'] is List) {
        for (var channel in row['channels']) {
          if (channel is Map<String, dynamic> && channel.containsKey('id')) {
            embeddedChannels.add(channel);
          }
        }
      }

      try {
        DeviceModel device = buildDeviceModel(row['type'], row);

        insertData[device.id] = device;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][DEVICES] Failed to create device model: ${e.toString()}',
          );
        }

        /// Failed to create new model
      }
    }

    // Insert embedded channels into the channels repository
    // This will also trigger insertion of embedded properties
    if (embeddedChannels.isNotEmpty) {
      _channelsRepository.insert(embeddedChannels);
    }

    if (!mapEquals(data, insertData)) {
      data = insertData;

      notifyListeners();
    }
  }

  /// Removes the devices this panel already knew about that the latest full response left out.
  ///
  /// `known` is deliberately a snapshot taken *before* the request went out rather than the repository's
  /// current keys: a device created while the request was in flight arrives by socket and is absent from
  /// a response produced before it existed, so evicting on absence alone would delete something newer
  /// than the answer being applied — and no further event would bring it back.
  ///
  /// Separated from `fetchAll` so the rule can be tested without standing up an HTTP client.
  /// Whether a row from a full response should still be applied.
  ///
  /// False for a device hidden since the request went out: the response predates the hide, so applying
  /// it verbatim puts the device back — and the eviction cannot undo that, because the same stale
  /// response lists the device as visible.
  ///
  /// Separated from `fetchAll` so the rule can be tested without standing up an HTTP client.
  @visibleForTesting
  bool shouldApply(Map<String, dynamic> row) => !_hiddenWhileFetching.contains(row['id']);

  @visibleForTesting
  void markHiddenWhileFetching(String id) => _hiddenWhileFetching.add(id);

  @visibleForTesting
  void evictMissing(Set<String> known, Set<String> present) {
    for (final id in known) {
      if (!present.contains(id)) {
        delete(id);
      }
    }
  }

  void delete(String id) {
    if (data.containsKey(id) && data.remove(id) != null) {
      if (kDebugMode) {
        debugPrint('[DEVICES MODULE][DEVICES] Removed device: $id');
      }

      notifyListeners();
    }
  }

  Future<void> fetchOne(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleDevice(
          id: id,
        );

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insert([raw]);
      },
      'fetch device',
    );
  }

  Future<void> fetchAll() async {
    return handleApiCall(
      () async {
        // Captured before the request goes out. What this eviction may remove is what this panel knew
        // about *when it asked* — a device created while the request was in flight arrives by socket and
        // is absent from a snapshot taken before it existed, so evicting on absence alone would delete a
        // device newer than the answer being applied, with no further event to bring it back.
        final knownBefore = data.keys.toSet();

        _fetchesInFlight++;

        final List<Map<String, dynamic>> rows;

        try {
          final response = await apiClient.getDevicesModuleDevices();

          final raw = response.response.data['data'] as List;

          // Without the devices hidden since the request went out. They are in the response because it
          // was produced before they were hidden, and re-inserting one puts a source device back on
          // screen next to the virtual device that replaced it — commandable, and past the eviction
          // below, which reads the same stale response as saying the device is visible.
          rows = raw
              .cast<Map<String, dynamic>>()
              .where(shouldApply)
              .toList();
        } finally {
          _fetchesInFlight--;

          if (_fetchesInFlight == 0) {
            _hiddenWhileFetching.clear();
          }
        }

        insert(rows);

        // A device the response omits has to go, and `insert` merges rather than replaces, so nothing
        // else would ever take it out. This endpoint answers with the visible devices only: a source
        // device is hidden the moment a virtual device replaces it, and without this eviction the panel
        // would keep rendering the original alongside its replacement — commandable, and duplicated in
        // every space it belongs to — for the life of the process.
        final visibleIds = rows.map((row) => row['id']).whereType<String>().toSet();

        evictMissing(knownBefore, visibleIds);
      },
      'fetch devices',
    );
  }
}
