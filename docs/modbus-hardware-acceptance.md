# Modbus hardware acceptance

Manual acceptance of the `devices-modbus` plugin on real hardware. It is recorded, not run in CI. User documentation:
`apps/website/app/docs/extensions/modbus/page.mdx`. Design: `docs/superpowers/specs/2026-11-09-modbus-devices-design.md`.

Run the checklist on both setups. Record every run in the results table at the end.

## Before you start

Record these for the Waveshare RS485 TO WIFI/ETH gateway (the vendor documentation does not list the defaults):

- [ ] Gateway firmware version: ______
- [ ] Gateway IP address: ______
- [ ] TCP port in transparent mode (`rtu_over_tcp`): ______
- [ ] TCP port in Modbus TCP to RTU conversion mode (`tcp`): ______
- [ ] Serial side set to 9600 baud, 8 data bits, no parity, 1 stop bit (9600 8N1)
- [ ] The gateway accepts one client connection reliably (Smart Panel opens exactly one connection per endpoint)
- [ ] Unit ID of the Eletechsup N4D8B08 relay board: ______
- [ ] Qingjun 32DI board: unit ID (DIP switches, board restarted after changing them) ______, port (template default 8080) ______

Nothing else (test tools, a second master) may talk to the gateway or the boards while a run is in progress.

## 1. Qingjun 32-DI board over Modbus TCP

Endpoint framing `tcp`. Add the board from the built-in **Qingjun 32-channel digital input board** template.

- [ ] The wizard's **Test connection** succeeds and the device is created in under a minute.
- [ ] **Read now** in the points step shows plausible values for all 32 inputs.
- [ ] Every input DI 1 to DI 32 is driven in turn (closed, then open) and its state is correct on the panel, with no
      two inputs swapped (this verifies bit order across holding registers 4 and 5).
- [ ] Add button points (or create a device with button channels) and use a poll interval of 100 to 250 ms. Check the
      events `down`, `up` and `press` for a short press and `long_press` for a press longer than the threshold
      (default 800 ms, `long_press_ms`).
- [ ] A press shorter than one poll interval may be missed; note the shortest press that is reliably detected: ______
- [ ] After restarting Smart Panel or reconnecting the board with a button held, no event is produced for the
      initial reading (baseline).
- [ ] Unplug the board: the device becomes `lost` and its values are invalid. Restore it: the device recovers.

## 2. Eletechsup N4D8B08 behind the Waveshare gateway

Add the board from the built-in **Eletechsup N4D8B08 8-channel relay board** template. Run the whole list **twice**:

- transparent mode, endpoint framing `rtu_over_tcp`;
- Modbus TCP to RTU conversion mode, endpoint framing `tcp`.

For each run:

- [ ] **Test connection** succeeds with the unit ID recorded above.
- [ ] Relays at PDU 1 to 8: each relay is switched on and off from the panel, the relay clicks, and the state is
      confirmed by read-back (it is read as `1`/`0` and written as `256` on and `512` off).
- [ ] Inputs at PDU 81 to 88: **confirm that the inputs are at PDU 81 to 88** (the template reads them as one register
      each). Drive each input in turn and check the state of `Input 1` to `Input 8`. If they are elsewhere, note the
      real addresses: ______
- [ ] A burst of commands across all eight relays (toggle all relays quickly several times) ends with every relay in
      the commanded state, without lost or misattributed replies and without the endpoint reporting a failure.
- [ ] Unplug the **gateway**: the endpoint shows back-off and the devices become `lost`. Restore it: the endpoint
      reconnects and the devices recover.
- [ ] Unplug the **relay board** (gateway stays up): only the device becomes `lost`, the endpoint stays connected.
      Restore it: the device recovers.
- [ ] No device is created or written to by anything other than the actions above.

## Results

| Date | Setup | Firmware | Gateway mode | Result | Notes |
|------|-------|----------|--------------|--------|-------|
|      | Qingjun 32DI | | n/a (Modbus TCP) | | |
|      | N4D8B08 + Waveshare | | transparent (`rtu_over_tcp`) | | |
|      | N4D8B08 + Waveshare | | Modbus TCP to RTU (`tcp`) | | |
