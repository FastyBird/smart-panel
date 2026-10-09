# Recorded Tailscale CLI compatibility fixtures

These are unauthenticated Linux ARM64 captures from the official **1.66.0** minimum
supported release and **1.102.5**, installed on the alpha.58 acceptance Pi. Each CLI
was paired with its own matching daemon in a disposable container on 2026-10-09.
The Pi and its tailnet were not changed.

The archives and their SHA-256 checksums came from the
[official package server](https://pkgs.tailscale.com/stable/). Each JSON records the
exact archive URL, verified digest, capture time, container image ID and commands.
The base image was `python:3.12-slim` on Linux ARM64; the recorded image ID pins the
local image actually used, not a portable registry digest.

## Capture procedure

Download the archive URL and checksum URL recorded in the fixture, compare the
archive's SHA-256, and extract only the regular files `tailscale` and `tailscaled`
from `tailscale_<version>_arm64/`. For each version, use a new container with:

- `--rm --network none --cap-drop ALL --security-opt no-new-privileges`;
- a read-only bind mount containing only those two binaries at `/opt/tailscale`;
- a private output directory and fresh `/tmp/compatibility` state;
- no privileged mode, host networking, host credentials or Docker socket mount.

Start the matching daemon as UID 0:

```sh
/opt/tailscale/tailscaled --tun=userspace-networking \
  --socket=/tmp/compatibility/tailscaled.sock \
  --statedir=/tmp/compatibility --no-logs-no-support
```

Wait for `status --json` to report `NeedsLogin`. Invoke every recorded `args` array
with `/opt/tailscale/tailscale --socket=/tmp/compatibility/tailscaled.sock`, preserving
stdout, stderr and exit code. Each command had a 15-second timeout. Baseline reads
precede `set --operator=nobody`; subsequent reads are marked `operator-change`.
`nobody` is the disposable container's existing account, not a host or Pi account.
Also capture `up`, `set`, `serve` and `funnel` with `--help`; the provenance records
the selected plugin flags that were present; this is not an exhaustive flag audit. Help text was retained in the private receipt,
not duplicated in the fixtures. Terminate and reap the daemon, then remove the
container and its state. Both capture runs completed and no task container remained.

## Projection and limits

Version, preferences, empty Serve/Funnel configuration, stderr and exit codes are
unchanged CLI output. Status JSON is reserialized, with only `Self` projected to
the seven booleans listed in `statusSelfProjection`; generated identity, hostname,
addresses and timing fields are excluded. All other status fields are preserved.
No login, auth key or tailnet data was used.

Both versions returned exit code **0** with `NeedsLogin`, omitted `OperatorUser`
before configuration, returned it as `nobody` after the successful setter, and
returned `{}` for unconfigured Serve/Funnel. The adapter tests replay these real
responses through the `execFile` boundary. Requirement tests stub platform/systemd
facts; they do not run systemd in these containers.

This checks the JSON adapter and the recorded unauthenticated operator setter.
Help flag presence does not prove authenticated command behavior. These captures
do not certify service-user permissions, authenticated adoption or preference
mismatch recovery, login, Serve/Funnel reachability, kernel networking, other
architectures, or full minimum-version hardware acceptance. Existing synthetic
tests still cover nonzero status exits; that case did not occur in these captures.

Original archives, raw output, daemon logs and container receipts are retained
privately under `remote-access-r4/minimum-cli-compatibility/`.
