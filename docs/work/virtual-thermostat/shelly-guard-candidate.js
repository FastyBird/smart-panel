/* Offline protocol candidate. See shelly-reconciliation.md before using it.
 * SP_GUARD_CONFIG must be prepended by the internal installation qualifier.
 * No default limits, firmware, component, or evidence are supplied here.
 */
let cfg = SP_GUARD_CONFIG;
let epoch = 0;
let ready = false;
let busy = false;
let pendingFence = null;
let pendingOn = null;
let fencePersisted = false;
let emergencyBusy = false;
let until = 0;
let floorLatched = true;
let floorObservedAt = 0;
let floorValue = null;
let fault = null;
let info = Shelly.getDeviceInfo();

/** Reject NaN and infinities using arithmetic supported by the embedded script runtime. */
function finiteNumber(n) {
	return typeof n === 'number' && n === n && n - n === 0;
}
/** Bound epochs and millisecond expiries to the nonnegative integer range used by this protocol. */
function integer(n) {
	return typeof n === 'number' && n === Math.floor(n) && n >= 0 && n < 2147483647;
}
/** Use device uptime for lease and sensor age checks, independent of backend clocks. */
function now() {
	return Shelly.getUptimeMs();
}
/** Return a protocol error without claiming that earlier local ON work has drained. */
function reject(request, reason) {
	request.error(-1, reason);
}
/** Require finite installed Steinhart-Hart parameters before treating raw voltage as floor temperature. */
function conversionQualified() {
	let conversion = cfg.floorConversion;
	return (
		cfg.floorComponentType === 'voltmeter' &&
		cfg.floorAttribute === 'voltage' &&
		conversion &&
		conversion.kind === 'steinhart_hart' &&
		finiteNumber(conversion.referenceVoltage) &&
		conversion.referenceVoltage > 0 &&
		finiteNumber(conversion.seriesResistance) &&
		conversion.seriesResistance > 0 &&
		finiteNumber(conversion.a) &&
		finiteNumber(conversion.b) &&
		finiteNumber(conversion.c) &&
		(conversion.thermistorLeg === 'low' || conversion.thermistorLeg === 'high') &&
		conversion.inputRange && finiteNumber(conversion.inputRange.minimum) && finiteNumber(conversion.inputRange.maximum) && conversion.inputRange.minimum <= conversion.inputRange.maximum &&
		conversion.outputRange && finiteNumber(conversion.outputRange.minimum) && finiteNumber(conversion.outputRange.maximum) && conversion.outputRange.minimum <= conversion.outputRange.maximum
	);
}
/** Convert qualified divider voltage to Celsius; invalid electrical or conversion values yield no sample. */
function floorCelsius(value) {
	if (!finiteNumber(value)) return null;
	if (cfg.floorAttribute !== 'voltage') return value;
	if (!conversionQualified() || value <= 0 || value >= cfg.floorConversion.referenceVoltage) return null;
	let conversion = cfg.floorConversion;
	if (value < conversion.inputRange.minimum || value > conversion.inputRange.maximum) return null;
	let resistance = conversion.thermistorLeg === 'low' ? (conversion.seriesResistance * value) / (conversion.referenceVoltage - value) : (conversion.seriesResistance * (conversion.referenceVoltage - value)) / value;
	if (!finiteNumber(resistance) || resistance <= 0) return null;
	let logarithm = Math.log(resistance);
	let inverse = conversion.a + (conversion.b + conversion.c * logarithm * logarithm) * logarithm;
	if (!finiteNumber(inverse) || inverse <= 0) return null;
	let temperature = 1 / inverse - 273.15;
	return finiteNumber(temperature) && temperature >= conversion.outputRange.minimum && temperature <= conversion.outputRange.maximum ? temperature : null;
}

/** Require unchanged installed sensor configuration, a fresh value and a cleared overtemperature latch. */
function floorSafe() {
	let floorConfig = Shelly.getComponentConfig(cfg.floorComponentType, cfg.floorComponentId);
	let helper = floorConfig && floorConfig[cfg.floorAttribute];
	let celsius =
		conversionQualified() ||
		cfg.floorComponentType === 'temperature' ||
		(helper &&
			typeof helper.expr === 'string' &&
			helper.expr.length > 0 &&
			(helper.unit === 'C' || helper.unit === '°C' || helper.unit === 'Celsius' || helper.unit === 'celsius'));
	return (
		celsius &&
		JSON.stringify(floorConfig) === cfg.floorConfigurationJson &&
		floorValue !== null &&
		!floorLatched &&
		now() - floorObservedAt < cfg.floorMaxAgeMs
	);
}
/** Record an actual floor report and update the fail-closed temperature latch with hysteresis. */
function observeFloor(status) {
	let value = floorCelsius(status && status[cfg.floorAttribute]);
	floorObservedAt = now();
	if (typeof value !== 'number' || !finiteNumber(value) || (status.errors && status.errors.length > 0)) {
		floorValue = null;
		floorLatched = true;
	} else {
		floorValue = value;
		if (value >= cfg.floorLimitC) floorLatched = true;
		else if (value < cfg.floorLimitC - cfg.floorHysteresisC) floorLatched = false;
	}
}
/** Expose current identity, epoch, lease-readiness and output status for backend inspection. */
function view() {
	let output = Shelly.getComponentStatus('switch', cfg.componentId);
	return {
		protocol: 'sp-guard-candidate-1',
		deviceId: info.id,
		firmware: info.fw_id,
		componentId: cfg.componentId,
		evidenceId: cfg.evidenceId,
		epoch: epoch,
		nowMs: now(),
		ready: ready,
		busy: busy,
		fault: fault,
		floorSafe: floorSafe(),
		floorCelsius: floorValue,
		output: output && typeof output.output === 'boolean' ? output.output : null,
	};
}
/** Revoke readiness and the lease, rejecting pending replies without asserting physical OFF or drainage. */
function fail(reason) {
	fault = reason;
	ready = false;
	until = 0;
	if (pendingOn) {
		reject(pendingOn, reason);
		pendingOn = null;
	}
	if (pendingFence) {
		reject(pendingFence, reason);
		pendingFence = null;
	}
}
/** Acknowledge a persisted fence only after matched OFF readback from an OFF cycle in its current epoch. */
function readBack(result, code, message, cycleEpoch) {
	busy = false;
	if (code !== 0 || !result || result.id !== cfg.componentId || result.output !== false) {
		fail('off_readback_unconfirmed');
		return;
	}
	if (pendingFence && fencePersisted && cycleEpoch === epoch) {
		let request = pendingFence;
		pendingFence = null;
		// Covers this script's earlier local IO only. External writer exclusion and
		// script-restart IO drainage still require installed firmware qualification.
		request.result({
			epoch: epoch,
			deviceId: info.id,
			componentId: cfg.componentId,
			output: false,
			localOnDrained: fault === null,
			externalWriterBarrier: false,
			observedAtMs: now(),
			evidenceId: cfg.evidenceId,
		});
	} else if (pendingFence && fencePersisted) {
		driveOff();
	}
}
/** After acknowledged absolute OFF, request status readback; unknown execution faults without minting proof. */
function offDone(result, code, message, cycleEpoch) {
	if (code !== 0 || !result || typeof result.was_on !== 'boolean') {
		busy = false;
		fail('off_execution_unknown');
		return;
	}
	Shelly.call('Switch.GetStatus', { id: cfg.componentId }, readBack, cycleEpoch);
}
/** Allow another best-effort emergency OFF attempt; its callback supplies no serial drainage proof. */
function emergencyDone() {
	emergencyBusy = false;
}
/** Revoke the lease and drive absolute OFF, using emergency attempts while serial work or epoch persistence is pending. */
function driveOff() {
	until = 0;
	if (pendingFence && !fencePersisted) {
		if (!emergencyBusy) {
			emergencyBusy = true;
			Shelly.call('Switch.Set', { id: cfg.componentId, on: false }, emergencyDone);
		}
		return;
	}
	if (busy) {
		// Best-effort emergency OFF does not constitute a drain barrier. Never let a
		// stalled ON callback suppress all OFF attempts. Serial OFF/readback follows
		// only after that ON has genuinely completed; unknown completion stays faulted.
		if ((pendingOn || !ready) && !emergencyBusy) {
			emergencyBusy = true;
			Shelly.call('Switch.Set', { id: cfg.componentId, on: false }, emergencyDone);
		}
		return;
	}
	busy = true;
	// OFF never receives a flip-back timer. Native auto_on must be disabled by qualification.
	Shelly.call('Switch.Set', { id: cfg.componentId, on: false }, offDone, pendingFence && fencePersisted ? epoch : null);
}
/** Acknowledge ON only while its lease and floor remain valid; failed or superseded completion triggers OFF. */
function onDone(result, code) {
	busy = false;
	let request = pendingOn;
	pendingOn = null;
	if (code !== 0 || !result || typeof result.was_on !== 'boolean') {
		if (request) reject(request, 'on_execution_unknown');
		fail('on_execution_unknown');
		driveOff();
		return;
	}
	if (pendingFence || !ready || !floorSafe() || now() >= until) {
		if (request) reject(request, 'on_superseded');
		driveOff();
		return;
	}
	if (request) request.result({ epoch: epoch, accepted: true, untilMs: until });
}
/** Enable serial OFF/readback after durable epoch persistence without stealing an existing IO cycle. */
function persistedFence(result, code) {
	if (code !== 0) {
		busy = false;
		fail('epoch_persistence_failed');
		driveOff();
		return;
	}
	fencePersisted = true;
	// Existing ON/OFF/readback owns busy until completion. Never overwrite its ownership.
	if (!busy) driveOff();
}
/** Advance and persist the epoch before acknowledging correlated OFF and local ON drainage. */
function fence(request) {
	if (!ready || pendingFence || epoch >= 2147483646) {
		reject(request, 'fence_unavailable');
		return;
	}
	epoch = epoch + 1;
	until = 0;
	pendingFence = request;
	fencePersisted = false;
	// Persist before acknowledging the barrier. A concurrently running ON callback
	// must not run OFF/readback before this persistence operation has completed.
	Shelly.call('KVS.Set', { key: cfg.epochKey, value: epoch }, persistedFence);
}
/** Admit one current-epoch ON with a safe floor and bounded absolute expiry, backed by native flip-back. */
function energize(request, params) {
	if (!ready || fault || busy || pendingFence || !params || params.epoch !== epoch || !floorSafe()) {
		reject(request, 'on_not_admitted');
		return;
	}
	let remaining = params.untilMs - now();
	if (!integer(params.untilMs) || remaining < cfg.minLeaseMs || remaining > cfg.maxLeaseMs) {
		reject(request, 'on_expired_or_unqualified');
		return;
	}
	until = params.untilMs;
	pendingOn = request;
	busy = true;
	// Native flip-back remains a second bound if this script crashes after dispatch.
	Shelly.call('Switch.Set', { id: cfg.componentId, on: true, toggle_after: remaining / 1000 }, onDone);
}
/** Drive OFF for revoked or expired leases, unsafe floor data and unknown output while leaving idle confirmed OFF alone. */
function watchdog() {
	if (fault || pendingFence || (pendingOn && until === 0)) {
		driveOff();
		return;
	}
	let hasLease = until > 0;
	if (hasLease && (now() >= until || !floorSafe())) {
		driveOff();
		return;
	}
	let output = Shelly.getComponentStatus('switch', cfg.componentId);
	// Pending ON owns its valid lease even while the cached output is still OFF;
	// revoked pending ON keeps requesting emergency OFF until its callback drains.
	// Unknown output fails closed; idle confirmed OFF needs no serial IO cycle.
	if (!output || typeof output.output !== 'boolean' || (!hasLease && output.output)) driveOff();
}
/** Process reports from the configured floor component and request OFF whenever floor safety is lost. */
function floorUpdate(event) {
	if (event.component !== cfg.floorComponentType + ':' + cfg.floorComponentId) return;
	observeFloor(event.delta);
	if (!floorSafe()) driveOff();
}
/** Enable readiness only after startup status reports the configured switch output as OFF. */
function startupOff(result, code) {
	if (code !== 0 || !result || result.id !== cfg.componentId || result.output !== false) {
		fail('startup_off_unconfirmed');
		return;
	}
	busy = false;
	ready = true;
}
/** Require acknowledged startup OFF before requesting the live status needed to enable readiness. */
function startupSet(result, code) {
	if (code !== 0 || !result || typeof result.was_on !== 'boolean') {
		fail('startup_off_execution_unknown');
		return;
	}
	Shelly.call('Switch.GetStatus', { id: cfg.componentId }, startupOff);
}
/** After persisting the boot epoch, issue absolute OFF before the startup readiness readback. */
function startupPersist(result, code) {
	if (code !== 0) {
		fail('epoch_persistence_failed');
		return;
	}
	busy = true;
	Shelly.call('Switch.Set', { id: cfg.componentId, on: false }, startupSet);
}
/** Require commissioned epoch storage and persist its successor so packets from an earlier boot cannot reuse the epoch. */
function startupEpoch(result, code) {
	// The key must have been initialized during commissioning. Missing/reset storage
	// cannot silently establish a fresh epoch and admit packets from an earlier boot.
	if (code !== 0 || !result || !integer(result.value) || result.value >= 2147483646) {
		fail('epoch_storage_unqualified');
		return;
	}
	epoch = result.value + 1;
	Shelly.call('KVS.Set', { key: cfg.epochKey, value: epoch }, startupPersist);
}
/** Restrict correlation tokens to a bounded alphabet accepted unchanged by the HTTP query parser. */
function validNonce(nonce) {
	if (typeof nonce !== 'string' || nonce.length < 1 || nonce.length > 64) return false;
	let allowed = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
	for (let index = 0; index < nonce.length; index++) if (allowed.indexOf(nonce.charAt(index)) < 0) return false;
	return true;
}

/** Validate unique action parameters and nonce, then route one uncached correlated status, fence or ON reply. */
function handleHttp(request, response) {
	let params = {};
	let reply = {
		/** Correlate a successful action result with the exact request nonce. */
		result: function (value) {
			response.code = 200;
			response.body = JSON.stringify({ result: value, nonce: params.nonce });
			response.send();
		},
		/** Return a correlated protocol error without representing it as successful OFF evidence. */
		error: function (code, reason) {
			response.code = 409;
			response.body = JSON.stringify({ error: reason, nonce: params.nonce });
			response.send();
		},
	};
	response.headers = [
		['Content-Type', 'application/json'],
		['Cache-Control', 'no-store'],
	];
	if (request.method !== 'GET') {
		reject(reply, 'method_not_allowed');
		return;
	}
	let action = null;
	let parts = (request.query || '').split('&');
	try {
		for (let index = 0; index < parts.length; index++) {
			let field = parts[index].split('=');
			if (field.length !== 2) {
				reject(reply, 'invalid_query');
				return;
			}
			if (field[0] === 'action' && action === null) action = field[1];
			else if (field[0] === 'nonce' && params.nonce === undefined) params.nonce = field[1];
			else if (field[0] === 'epoch' && params.epoch === undefined) params.epoch = JSON.parse(field[1]);
			else if (field[0] === 'untilMs' && params.untilMs === undefined) params.untilMs = JSON.parse(field[1]);
			else {
				reject(reply, 'invalid_query');
				return;
			}
		}
	} catch (error) {
		reject(reply, 'invalid_query');
		return;
	}
	if (!validNonce(params.nonce)) {
		reject(reply, 'invalid_nonce');
		return;
	}
	if (action === 'status' && parts.length === 2) reply.result(view());
	else if (action === 'fence' && parts.length === 2) fence(reply);
	else if (action === 'on' && parts.length === 4) energize(reply, params);
	else reject(reply, 'invalid_action');
}

/** Validate device identity, declared installation prerequisites and bounds; declarations alone are not commissioning evidence. */
function validConfig() {
	return (
		cfg &&
		cfg.deviceId === info.id &&
		cfg.model === info.model &&
		cfg.firmware === info.fw_id &&
		cfg.evidenceId &&
		cfg.scriptRestartDrainQualified === true &&
		cfg.nativeWritersExcluded === true &&
		integer(cfg.componentId) &&
		integer(cfg.floorComponentId) &&
		((cfg.floorComponentType === 'temperature' && cfg.floorAttribute === 'tC') ||
			(cfg.floorComponentType === 'voltmeter' && cfg.floorAttribute === 'xvoltage') ||
			conversionQualified() ||
			(cfg.floorComponentType === 'input' && cfg.floorAttribute === 'xpercent')) &&
		typeof cfg.floorConfigurationJson === 'string' &&
		cfg.floorConfigurationJson &&
		typeof cfg.epochKey === 'string' &&
		cfg.epochKey &&
		integer(cfg.minLeaseMs) &&
		cfg.minLeaseMs > 0 &&
		integer(cfg.maxLeaseMs) &&
		cfg.maxLeaseMs >= cfg.minLeaseMs &&
		integer(cfg.watchdogMs) &&
		cfg.watchdogMs > 0 &&
		cfg.watchdogMs < cfg.minLeaseMs &&
		integer(cfg.floorMaxAgeMs) &&
		cfg.floorMaxAgeMs > cfg.watchdogMs &&
		typeof cfg.floorLimitC === 'number' &&
		finiteNumber(cfg.floorLimitC) &&
		typeof cfg.floorHysteresisC === 'number' &&
		finiteNumber(cfg.floorHysteresisC) &&
		cfg.floorHysteresisC > 0
	);
}

if (!validConfig()) {
	fail('installation_qualification_missing');
} else {
	HTTPServer.registerEndpoint('spguard', handleHttp);
	// A cached startup snapshot cannot refresh sensor freshness. Only actual
	// sensor status reports qualify floor input; equal-report behavior needs testing.
	Shelly.addStatusHandler(floorUpdate);
	Timer.set(cfg.watchdogMs, true, watchdog);
	busy = true;
	driveOff();
	Shelly.call('KVS.Get', { key: cfg.epochKey }, startupEpoch);
}
