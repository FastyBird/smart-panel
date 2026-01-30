import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/contact.dart';

class EntryPointData {
	final String deviceId;
	final String name;
	final String? room;
	final bool? isOpen;
	final bool isDoor;

	const EntryPointData({
		required this.deviceId,
		required this.name,
		this.room,
		this.isOpen,
		this.isDoor = true,
	});
}

class EntryPointsSummary {
	final List<EntryPointData> all;
	final int openCount;
	final int closedCount;
	final int unknownCount;
	final List<EntryPointData> openItems;

	const EntryPointsSummary({
		required this.all,
		required this.openCount,
		required this.closedCount,
		required this.unknownCount,
		required this.openItems,
	});

	bool get isEmpty => all.isEmpty;
	bool get allClosed => openCount == 0 && unknownCount == 0 && closedCount > 0;
}

/// Extract entry point data from a device with a contact channel.
/// Returns null if the device has no contact channel.
EntryPointData? extractEntryPoint(DeviceView device) {
	final ContactChannelView? contactChannel =
		device.channels.whereType<ContactChannelView>().firstOrNull;

	if (contactChannel == null) return null;

	final bool? isOpen;
	if (!contactChannel.hasDetected) {
		isOpen = null;
	} else {
		final detected = contactChannel.detectedProp;
		isOpen = detected.isDetected;
	}

	return EntryPointData(
		deviceId: device.id,
		name: device.name,
		room: null, // Room name resolution would require SpacesService; using null for now
		isOpen: isOpen,
		isDoor: device.category == DevicesModuleDeviceCategory.door,
	);
}

/// Build a complete entry points summary from the devices service.
EntryPointsSummary buildEntryPointsSummary(
	DevicesService devicesService, {
	int maxOpen = 4,
}) {
	final doors = devicesService.getDevicesByCategory(DevicesModuleDeviceCategory.door);
	final sensors = devicesService.getDevicesByCategory(DevicesModuleDeviceCategory.sensor);

	final List<EntryPointData> all = [];

	for (final device in doors) {
		final ep = extractEntryPoint(device);
		if (ep != null) all.add(ep);
	}

	for (final device in sensors) {
		final ep = extractEntryPoint(device);
		if (ep != null) all.add(ep);
	}

	int openCount = 0;
	int closedCount = 0;
	int unknownCount = 0;

	for (final ep in all) {
		if (ep.isOpen == null) {
			unknownCount++;
		} else if (ep.isOpen!) {
			openCount++;
		} else {
			closedCount++;
		}
	}

	final openItems = all.where((ep) => ep.isOpen == true).toList();
	sortEntryPoints(openItems);

	final limited = openItems.length > maxOpen
		? openItems.sublist(0, maxOpen)
		: openItems;

	return EntryPointsSummary(
		all: all,
		openCount: openCount,
		closedCount: closedCount,
		unknownCount: unknownCount,
		openItems: limited,
	);
}

/// Stable sort: room asc (nulls last), name asc, deviceId asc.
void sortEntryPoints(List<EntryPointData> items) {
	items.sort((a, b) {
		// Room comparison: nulls last
		final roomCmp = _compareNullable(a.room, b.room);
		if (roomCmp != 0) return roomCmp;

		final nameCmp = a.name.compareTo(b.name);
		if (nameCmp != 0) return nameCmp;

		return a.deviceId.compareTo(b.deviceId);
	});
}

int _compareNullable(String? a, String? b) {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	return a.compareTo(b);
}
