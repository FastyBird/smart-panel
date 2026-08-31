# Smart Panel Homey local test app

This private development app creates disposable synthetic devices for the guarded SHS lifecycle and thermostat probes.
It is not a Smart Panel runtime dependency, must not be published, and must never be used for household equipment.

## Fixed allowlist values

```text
FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER=fbsp-lifecycle-disposable-device
FB_HOMEY_SHS_LIFECYCLE_OWNER_URI=homey:app:com.fastybird.smartpanel.lifecycletest
FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID=homey:app:com.fastybird.smartpanel.lifecycletest:lifecycle-test-device
FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME=FBSP Lifecycle Initial
FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME=FBSP Lifecycle Renamed
```

The probe still requires two distinct private zone IDs and the separately scoped lifecycle API key. Do not record those
values in Git.

## Run the lifecycle observation

1. Start Docker. From the repository root, enter the test-app directory, run the app, and select only the subscribed
   test SHS instance:

   ```bash
   cd apps/backend/test/support/homey-lifecycle-test-app
   npx --yes homey@4.4.2 app run --clean
   ```

2. In a separate terminal, configure the lifecycle probe exactly as described in
   `docs/homey-shs-compatibility.md`, using the fixed values above and the private source/destination zone IDs. Run:

   ```bash
   cd apps/backend
   export FB_HOMEY_SHS_LIFECYCLE_ADD_WINDOW_MS=90000
   export FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS=10000
   pnpm run homey:probe-lifecycle
   ```

   The add window gives the operator 90 seconds to pair, while each post-read-back event check remains bounded to 10
   seconds.

3. Wait until the probe prints that the add window is open. In Homey, add `Lifecycle Test Device`, keep its generated
   name unchanged, and place it in the configured source zone. Do not pair it before the add window opens.
4. The probe renames and moves the bound device. Only after each corresponding event listener is active, it changes the
   test driver's fixed lifecycle setting to make the device unavailable and then available again. Do not perform either
   transition manually.
5. The probe removes the device and verifies its final absence. After the sanitized report is written, stop `homey app
run`; development mode then uninstalls the test app. Unset the lifecycle variables and revoke the lifecycle key.

The setting-based coordination is enabled only when every fixed marker, driver, owner, initial-name, and renamed-name
value above matches. Other dedicated drivers remain operator-controlled. If the probe fails after pairing, remove only
the device whose complete identity matches the guarded values. Never broaden cleanup to another app or device.

## Run the thermostat control observation

The additional `Thermostat Test Device` driver exposes `measure_temperature`, `target_temperature`, and
`thermostat_mode`. Pair it only for thermostat mapping-control evidence. It uses the fixed marker
`fbsp-thermostat-disposable-device`, starts at 21 °C with a 22 °C target in `off` mode, accepts target/mode commands,
and contains no actual heating/cooling activity capability.

Do not keep this thermostat paired while running the lifecycle probe: that probe intentionally requires the dedicated
test app to own exactly one device. Follow the climate mapping-control instructions in `docs/homey-shs-compatibility.md`
and remove the thermostat after the sanitized evidence is captured.

## Local verification

```bash
pnpm test:unit
npx --yes homey@4.4.2 app validate --level debug
```
