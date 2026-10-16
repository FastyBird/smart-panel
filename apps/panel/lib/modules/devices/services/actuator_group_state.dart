import 'dart:async';
import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/api/models/devices_virtual_plugin_data_light_group_configuration.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:flutter/foundation.dart';

typedef ActuatorGroupConfiguration =
    DevicesVirtualPluginDataLightGroupConfiguration;

/// Refresh authority is scoped to the current connection and request. REST is read-only metadata/feedback.
class ActuatorGroupState extends ChangeNotifier {
  final String channelId;
  final SocketService? socket;
  final Future<ActuatorGroupConfiguration> Function()? loader;
  final Dio? dio;
  ActuatorGroupConfiguration? configuration;
  bool connected = true;
  bool pending = false;
  bool needsReload = false;
  String? error;
  int _generation = 0;
  bool _disposed = false;
  Timer? _refreshTimer;
  ActuatorGroupState({
    required this.channelId,
    this.socket,
    this.loader,
    this.dio,
  }) {
    connected = socket?.isConnected ?? true;
    socket?.registerEventHandler(
      'DevicesVirtual.LightGroup.ReportedStateChanged',
      _event,
    );
    socket?.addConnectionListener(_connection);
  }
  bool get commandable =>
      connected &&
      !pending &&
      !needsReload &&
      configuration != null &&
      error == null;
  void _connection(bool value) {
    connected = value;
    ++_generation;
    pending = false;
    error = value ? null : 'disconnected';
    configuration = configuration?.copyWith(
      reportedState: null,
      operations: null,
    );
    notifyListeners();
    if (value) unawaited(refresh());
  }

  void _event(String event, Map<String, dynamic> payload) {
    if (payload['groupChannelId'] != channelId ||
        _disposed ||
        !connected ||
        _refreshTimer != null) {
      return;
    }
    ++_generation;
    pending = true;
    notifyListeners();
    _refreshTimer = Timer(const Duration(milliseconds: 200), () {
      _refreshTimer = null;
      unawaited(refresh());
    });
  }

  Future<void> refresh({bool explicit = false}) async {
    if (_disposed) return;
    final generation = ++_generation;
    pending = true;
    notifyListeners();
    try {
      final next = loader != null
          ? await loader!()
          : ActuatorGroupConfiguration.fromJson(
              ((await (dio ?? locator<Dio>()).get<Map<String, dynamic>>(
                        '/plugins/devices-virtual/producers/light-groups/$channelId',
                      )).data!['data']
                      as Map<String, dynamic>)
                  .cast<String, Object?>(),
            );
      if (_disposed || generation != _generation || !connected) return;
      final previous = configuration;
      if (previous != null &&
          (previous.revision != next.revision ||
              previous.commonCapabilities.toString() !=
                  next.commonCapabilities.toString())) {
        needsReload = true;
      }
      if (explicit) needsReload = false;
      configuration = next;
      error = null;
    } catch (_) {
      if (!_disposed && generation == _generation) {
        error = 'unavailable';
        configuration = configuration?.copyWith(
          reportedState: null,
          operations: null,
        );
      }
    } finally {
      if (!_disposed && generation == _generation) {
        pending = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    _refreshTimer?.cancel();
    socket?.unregisterEventHandler(
      'DevicesVirtual.LightGroup.ReportedStateChanged',
      _event,
    );
    socket?.removeConnectionListener(_connection);
    super.dispose();
  }
}
