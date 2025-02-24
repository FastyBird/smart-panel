import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class SocketService {
  late io.Socket socket;

  void initialize() {
    socket = io.io(
      '${Platform.environment['APP_HOST'] ?? 'http://10.0.2.2'}:${Platform.environment['BACKEND_PORT'] ?? '3000'}',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );

    socket.onConnect((_) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Connected to Socket.IO backend');
      }
    });

    socket.onDisconnect((_) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Disconnected from Socket.IO backend');
      }
    });

    // Connect manually
    socket.connect();
  }

  void sendEvent(String event, dynamic data) {
    socket.emit(event, data);
  }

  void dispose() {
    socket.dispose();
  }
}
