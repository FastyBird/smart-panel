import { createHash } from 'node:crypto';

import {
	REMOTE_DEW_POINT_PROFILE,
	REMOTE_DEW_POINT_PROTOCOL,
	RemoteDewPointTiming,
} from './remote-dew-point-lease.contract';

export interface RemoteDewPointArtifactBinding {
	deviceId: string;
	deviceHardwareId: string;
	endpointHostname: string;
	scriptId: number;
	model: string;
	firmware: '1.7.5';
	physicalActuator: string;
	switchId: number;
	switchConfigurationJson: string;
	controllerRevision: number;
	protectionFingerprint: string;
	localSurface: {
		component: string;
		property: string;
		peripheralFingerprint: string;
		calibrationFingerprint: string;
		configurationJson: string;
		peripheralsJson: string;
		domain: { minimum: number; maximum: number };
		maximumAgeMs: number;
	};
	remoteLineageFingerprint: string;
	formulaVersion: 'magnus-water-17.62-243.12-v1';
	marginC: number;
	recoveryHysteresisC: number;
	absoluteMinimumC: number | null;
	timing: RemoteDewPointTiming;
	writerIsolationEvidenceId: string;
}
export interface RemoteDewPointArtifact {
	profile: typeof REMOTE_DEW_POINT_PROFILE;
	version: 1;
	protocol: typeof REMOTE_DEW_POINT_PROTOCOL;
	artifactId: string;
	sha256: string;
	source: string;
	binding: Readonly<RemoteDewPointArtifactBinding>;
	/** Compilation supplies no installation qualification, script deployment or activation. */
	installationEligibility: 'post_alpha_qualification_required';
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

export function compileRemoteDewPointArtifact(binding: RemoteDewPointArtifactBinding): RemoteDewPointArtifact {
	if (
		!binding || !/^[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/.test(binding.endpointHostname) || !Number.isInteger(binding.scriptId) || binding.scriptId < 1 || binding.scriptId > 100 ||
		!/^[A-Za-z0-9_-]{1,80}$/.test(binding.deviceId) ||
		!binding.model ||
		binding.firmware !== '1.7.5' ||
		!/^[A-F0-9]{12}$/.test(binding.deviceHardwareId) ||
		binding.physicalActuator !== `shelly-ng:${binding.deviceHardwareId}:switch:${binding.switchId}:output` ||
		!Number.isInteger(binding.switchId) ||
		binding.switchId < 0 ||
		binding.switchId > 3 ||
		!Number.isSafeInteger(binding.controllerRevision) ||
		binding.controllerRevision < 1 ||
		!Number.isFinite(binding.marginC) ||
		binding.marginC <= 0 ||
		binding.marginC > 60 ||
		!Number.isFinite(binding.recoveryHysteresisC) ||
		binding.recoveryHysteresisC <= 0 ||
		binding.recoveryHysteresisC > 60 ||
		binding.formulaVersion !== 'magnus-water-17.62-243.12-v1' ||
		![
			binding.protectionFingerprint,
			binding.remoteLineageFingerprint,
			binding.writerIsolationEvidenceId,
			binding.localSurface?.peripheralFingerprint,
			binding.localSurface?.calibrationFingerprint,
		].every((s) => typeof s === 'string' && s.length > 0 && s.length <= 128) ||
		![
			binding.switchConfigurationJson,
			binding.localSurface?.configurationJson,
			binding.localSurface?.peripheralsJson,
		].every((text) => typeof text === 'string' && text.length > 1 && text.length <= 4096) ||
		!/^temperature:\d+$/.test(binding.localSurface.component) ||
		!/^tC$/.test(binding.localSurface.property) ||
		!Number.isFinite(binding.localSurface.domain.minimum) ||
		binding.localSurface.domain.minimum <= -45 ||
		!Number.isFinite(binding.localSurface.domain.maximum) ||
		binding.localSurface.domain.maximum > 60 ||
		binding.localSurface.domain.minimum >= binding.localSurface.domain.maximum ||
		!Number.isSafeInteger(binding.localSurface.maximumAgeMs) ||
		binding.localSurface.maximumAgeMs < 100 ||
		binding.localSurface.maximumAgeMs > 60000 ||
		!Object.values(binding.timing).every((n) => Number.isFinite(n) && n >= 0) ||
		binding.timing.minimumLifetimeMs < 100 ||
		binding.timing.maximumLeaseMs <= binding.timing.minimumLifetimeMs ||
		binding.timing.maximumLeaseMs > 60000 ||
		(binding.absoluteMinimumC !== null &&
			(!Number.isFinite(binding.absoluteMinimumC) || binding.absoluteMinimumC <= -45 || binding.absoluteMinimumC > 60))
	)
		throw new Error('Invalid remote dew point artifact binding');
	for (const text of [binding.switchConfigurationJson, binding.localSurface.configurationJson, binding.localSurface.peripheralsJson]) {
		let parsed: unknown;
		try { parsed = JSON.parse(text); } catch { throw new Error('Invalid component configuration JSON'); }
		const safe = (value: unknown): boolean => value === null || typeof value !== 'object' ||
			Object.entries(value).every(([key, child]) => !/password|credential|authorization|secret/i.test(key) && safe(child));
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !safe(parsed)) throw new Error('Unsafe component configuration JSON');
	}
	const freeze = <T>(value: T): T => {
		if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
		return value;
	};
	const frozen = freeze(JSON.parse(JSON.stringify(binding)) as RemoteDewPointArtifactBinding);
	const artifactId = hash(JSON.stringify({ templateVersion: 1, binding: frozen }));
	const source = remoteDewPointScript({ ...frozen, artifact: artifactId, protocol: REMOTE_DEW_POINT_PROTOCOL });
	return Object.freeze({
		profile: REMOTE_DEW_POINT_PROFILE,
		version: 1,
		protocol: REMOTE_DEW_POINT_PROTOCOL,
		artifactId,
		sha256: hash(source),
		source,
		binding: Object.freeze(frozen),
		installationEligibility: 'post_alpha_qualification_required',
	});
}

/** mJS-compatible, separate script bytes/protocol/KVS key from the heating artifact. */
function remoteDewPointScript(
	configuration: RemoteDewPointArtifactBinding & { artifact: string; protocol: string },
): string {
	return `// sp-remote-dew-point-lease-1; SOFTWARE ONLY until installed qualification
var C = ${JSON.stringify(configuration)};
var KEY = "sp_remote_dew_v1", BLOCK = 256, MAX = 2147483000;
var ready = false, busy = false, epoch = 0, reserved = 0, seq = 0, last = null, lastResult = null;
var pendingOn = 0, offPending = false, drained = false, operation = 0, lease = null, latched = true;
var surfaceAt = -1, lastReserveAt = -60000, storageTag = null;
var metadataAt = -1, metadataBusy = false, metadataValid = false, lastOffId = null, lastOffResult = null;
function uptime() { return Shelly.getUptimeMs(); }
function number(n) { return typeof n === "number" && n === n && n - n === 0; }
function integer(n) { return number(n) && Math.floor(n) === n; }
function identity() {
  var d = Shelly.getDeviceInfo();
  return d.auth_en === true && d.mac === C.deviceHardwareId && d.id === C.deviceId && d.model === C.model && d.ver === C.firmware &&
    JSON.stringify(Shelly.getComponentConfig(C.localSurface.component)) === C.localSurface.configurationJson &&
    JSON.stringify(Shelly.getComponentConfig("switch:"+C.switchId)) === C.switchConfigurationJson;
}
function output() { var s = Shelly.getComponentStatus("switch:" + C.switchId); return s && s.output === true; }
function forceOff() {
  if (!offPending || lease !== null || pendingOn > 0) operation++;
  lease = null; latched = true; drained = false;
  if (offPending) return;
  offPending = true;
  Shelly.call("Switch.Set", {id:C.switchId,on:false}, function(r,e) {
    if (e) { offPending=false; return; }
    var captured=operation, capturedEpoch=epoch;
    Shelly.call("Switch.GetStatus",{id:C.switchId},function(status,error) {
      offPending=false;
      drained=!error && status && status.output === false && pendingOn === 0 && captured === operation && capturedEpoch === epoch;
    });
  });
}
function failure() { ready = false; busy = false; forceOff(); }
function surface() {
  var s = Shelly.getComponentStatus(C.localSurface.component);
  if (!s || (s.errors && s.errors.length) || !number(s[C.localSurface.property])) return null;
  var t = s[C.localSurface.property];
  if (t < C.localSurface.domain.minimum || t > C.localSurface.domain.maximum) return null;
  if (surfaceAt < 0 || uptime() - surfaceAt >= C.localSurface.maximumAgeMs) return null;
  return t;
}
function validLease(p) {
  var left = p.untilDeviceUptimeMs - uptime();
  return identity() && metadataValid && metadataAt >= 0 && uptime()-metadataAt < 2000 && p.protocol === C.protocol && p.artifact === C.artifact && p.epoch === epoch &&
    p.controllerRevision === C.controllerRevision && p.protectionFingerprint === C.protectionFingerprint &&
    number(p.thresholdC) && p.thresholdC > -45 && p.thresholdC <= 60 &&
    (C.absoluteMinimumC === null || p.thresholdC >= C.absoluteMinimumC) &&
    number(p.untilDeviceUptimeMs) && left > 0 && left <= C.timing.maximumLeaseMs;
}
function protection(p) {
  var t = surface();
  if (t === null || !validLease(p)) return false;
  if (t <= p.thresholdC) latched = true;
  else if (t > p.thresholdC + C.recoveryHysteresisC && drained && pendingOn === 0) latched = false;
  return !latched;
}
function reply(response,code,data) { response.code=code; response.headers=[["Content-Type","application/json"]]; response.body=JSON.stringify(data); response.send(); }
function result(p,accepted) { return {protocol:C.protocol,artifact:C.artifact,epoch:epoch,sequence:p.sequence,requestId:p.requestId,untilDeviceUptimeMs:p.untilDeviceUptimeMs,accepted:accepted,output:output(),pendingOn:pendingOn>0,drained:drained}; }
function accept(p,response) {
  if (!ready || !identity() || busy || !integer(p.sequence) || p.sequence <= 0 || p.sequence > MAX ||
      typeof p.requestId !== "string" || p.requestId.length < 1 || p.requestId.length > 80 || !validLease(p)) {
    forceOff(); reply(response,409,{error:"inhibited"}); return;
  }
  var text = JSON.stringify(p);
  if (p.sequence === seq) {
    if (last === text && lastResult !== null) { reply(response,200,lastResult); return; }
    forceOff(); reply(response,409,{error:"duplicate_conflict"}); return;
  }
  if (p.sequence < seq || p.sequence > reserved || (p.action !== "on" && p.action !== "threshold")) {
    forceOff(); reply(response,409,{error:"sequence_or_action"}); return;
  }
  seq=p.sequence; last=text; lastResult=null;
  // A higher-sequence threshold updates current ON protection, but never energizes by itself.
  lease=p;
  if (!protection(p)) { forceOff(); lastResult=result(p,false); reply(response,200,lastResult); return; }
  if (p.action === "threshold") { lastResult=result(p,true); reply(response,200,lastResult); return; }
  if (pendingOn > 0 || offPending || (!drained && !output())) { forceOff(); reply(response,409,{error:"pending_release"}); return; }
  var captured=++operation, capturedEpoch=epoch, capturedSeq=seq;
  pendingOn++; drained=false;
  Shelly.call("Switch.Set",{id:C.switchId,on:true,toggle_after:(p.untilDeviceUptimeMs-uptime())/1000},function(r,e) {
    pendingOn--;
    if (e || captured !== operation || capturedEpoch !== epoch || capturedSeq !== seq || !protection(p)) {
      forceOff(); var failed=result(p,false);
      if (capturedSeq === seq && capturedEpoch === epoch) lastResult=failed;
      reply(response,409,failed); return;
    }
    lastResult=result(p,true); lastResult.wasOn=r && typeof r.was_on === "boolean" ? r.was_on : null; reply(response,200,lastResult);
  });
}
function reserve(p,response) {
  if (reserved > MAX - BLOCK) { failure(); reply(response,503,{error:"sequence_exhausted"}); return; }
  if (busy || !integer(p.sequence) || p.sequence !== reserved + 1 || uptime()-lastReserveAt < 60000) {
    forceOff(); reply(response,409,{error:"reservation_refused"}); return;
  }
  busy=true; var capturedEpoch=epoch, capturedOperation=operation, through=reserved+BLOCK;
  Shelly.call("KVS.Set",{key:KEY,value:{epoch:epoch,reservedThrough:through},etag:storageTag},function(r,e) {
    if (e || capturedEpoch !== epoch) { failure(); reply(response,503,{error:"storage"}); return; }
    Shelly.call("KVS.Get",{key:KEY},function(saved,error) {
      busy=false;
      if (error || !saved || !saved.value || saved.value.epoch !== epoch || saved.value.reservedThrough !== through || typeof saved.etag !== "string" || capturedEpoch !== epoch) {
        failure(); reply(response,503,{error:"storage_readback"}); return;
      }
      reserved=through; storageTag=saved.etag; lastReserveAt=uptime();
      if (capturedOperation !== operation) { forceOff(); reply(response,409,{error:"superseded"}); return; }
      // Awaited persistence never refreshes a threshold's absolute expiry.
      accept(p,response);
    });
  });
}
function fenceOff(p,response) {
  var wasOn=output(); forceOff();
  if (p.requestId && p.requestId === lastOffId && lastOffResult !== null) { reply(response,200,lastOffResult); return; }
  if (busy || storageTag === null || epoch >= MAX) { ready=false; reply(response,409,{error:"off_without_durable_fence"}); return; }
  busy=true; ready=false; epoch++; seq=0; reserved=0; last=null; lastResult=null;
  var capturedEpoch=epoch;
  Shelly.call("KVS.Set",{key:KEY,value:{epoch:epoch,reservedThrough:0},etag:storageTag},function(r,e) {
    if (e || capturedEpoch !== epoch) { failure(); reply(response,503,{error:"off_epoch_storage"}); return; }
    Shelly.call("KVS.Get",{key:KEY},function(check,error) {
      if (error || !check || !check.value || check.value.epoch !== epoch || check.value.reservedThrough !== 0 ||
          typeof check.etag !== "string" || capturedEpoch !== epoch || !identity()) {
        failure(); reply(response,503,{error:"off_epoch_readback"}); return;
      }
      storageTag=check.etag; busy=false; ready=true; lastReserveAt=-60000;
      forceOff(); lastOffId=p.requestId; lastOffResult=result(p,true); lastOffResult.wasOn=wasOn; reply(response,200,lastOffResult);
    });
  });
}
HTTPServer.registerEndpoint("remote-dew-point",function(request,response) {
  if (!identity()) { failure(); reply(response,503,{error:"identity_or_auth"}); return; }
  if (request.method === "GET") {
    reply(response,200,{protocol:C.protocol,artifact:C.artifact,deviceId:C.deviceId,model:C.model,firmware:C.firmware,
      auth_en:true,epoch:epoch,sessionId:C.artifact+":"+epoch,uptimeMs:uptime(),ready:ready&&metadataValid&&metadataAt>=0&&uptime()-metadataAt<2000,output:output(),pendingOn:pendingOn>0,sequence:seq,requestId:lastResult ? lastResult.requestId : null,drained:drained}); return;
  }
  if (request.method !== "POST") { reply(response,405,{error:"method"}); return; }
  var p; try { p=JSON.parse(request.body); } catch(e) { forceOff(); reply(response,400,{error:"json"}); return; }
  // Emergency OFF is never throttled or denied by missing source/qualification/sequence authority.
  if (p && p.action === "off") { fenceOff(p,response); return; }
  if (!p || !ready || !validLease(p)) { forceOff(); reply(response,409,{error:"lease"}); return; }
  if (p.sequence > reserved) { reserve(p,response); return; }
  accept(p,response);
});
Shelly.addStatusHandler(function(event) {
  if (event.component === C.localSurface.component && event.delta) {
    if (event.delta.errors && event.delta.errors.length) { surfaceAt=-1; forceOff(); return; }
    if (number(event.delta[C.localSurface.property])) { surfaceAt=uptime(); }
    if (lease && !protection(lease)) forceOff();
  }
});
function pollMetadata() {
  if (metadataBusy) return;
  metadataBusy=true; var capturedEpoch=epoch;
  Shelly.call("SensorAddon.GetPeripherals",{},function(r,e) {
    metadataBusy=false;
    if (capturedEpoch !== epoch) return;
    metadataValid=!e && JSON.stringify(r) === C.localSurface.peripheralsJson;
    if (metadataValid) metadataAt=uptime(); else forceOff();
  });
}
Timer.set(1000,true,pollMetadata);
Timer.set(100,true,function() {
  if (!identity() || !metadataValid || metadataAt < 0 || uptime()-metadataAt >= 2000 || surface() === null || (lease && !protection(lease)) || (!lease && output())) forceOff();
  if (!lease && (!drained || pendingOn>0 || output())) forceOff();
});
// Existing KVS seed is an installation prerequisite. Missing/erased/corrupt storage never resets epoch to zero.
forceOff();
Shelly.call("KVS.Get",{key:KEY},function(saved,e) {
  if (e || !saved || !saved.value || !integer(saved.value.epoch) || saved.value.epoch < 1 || saved.value.epoch >= MAX ||
      typeof saved.etag !== "string" || !integer(saved.value.reservedThrough) || saved.value.reservedThrough < 0 || saved.value.reservedThrough > MAX) { failure(); return; }
  epoch=saved.value.epoch+1; storageTag=saved.etag;
  Shelly.call("KVS.Set",{key:KEY,value:{epoch:epoch,reservedThrough:0},etag:storageTag},function(r,error) {
    if (error) { failure(); return; }
    Shelly.call("KVS.Get",{key:KEY},function(check,err) {
      if (err || !check || !check.value || check.value.epoch !== epoch || check.value.reservedThrough !== 0 || typeof check.etag !== "string" || !identity()) { failure(); return; }
      storageTag=check.etag; ready=true; forceOff(); pollMetadata();
    });
  });
});
`;
}
