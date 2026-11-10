# Modbus device templates

A template describes a Modbus device model: its channels, properties and register bindings. Choosing a template in the
add-device wizard expands it into concrete channels and bindings, which are then copied into the new device.

Templates are **declarative only**. There are no formulas and no expressions. The only substitutions are the
placeholders `{i}` and `{n}` (see "Repeated channels"). Every object in the schema rejects unknown keys, so a key such
as `formula` is a load error.

The format is validated by `schema/modbus-templates.schema.json`; the TypeScript shapes are in
`modbus-template.types.ts`. Keys are snake_case.

## Where templates are loaded from

1. **Built-in:** `apps/backend/src/plugins/devices-modbus/templates/definitions/**/*.yaml` (shipped with the app).
2. **User definitions directory** (`FB_CONFIG_PATH`, falling back to `var/data`): flat files named
   `plugin.devices-modbus.*.yaml`.
3. **`FB_MODBUS_TEMPLATES_PATH`**, when set, **instead of** the user definitions directory (the `plugin.devices-modbus.*.yaml`
   files in `FB_CONFIG_PATH` are then not read): every `*.yaml` and `*.yml` file, recursively.

Priority: a user definition with the same `id` overrides the built-in one. A file or template that fails validation is
reported with its load errors and is not offered. Templates are read at startup; call the reload endpoint
(`POST /plugins/devices-modbus/templates/reload`) after editing files.

## File format

```yaml
version: '1.0'
templates:
  - id: my-board                # ^[a-z0-9][a-z0-9_-]{0,63}$
    name: My board              # required: name, manufacturer, model, category, channels
    manufacturer: Acme
    model: B1
    description: Optional text
    category: switcher          # device category
    defaults:                   # all optional; suggested values for the endpoint and device
      framing: tcp              # tcp | rtu_over_tcp
      port: 502
      unit_id: { default: 1, min: 1, max: 247, hint: 'Shown next to the field' }
      poll_interval_ms: 500
      byte_order: big           # big | little
      word_order: big
      max_read_registers: 125
      max_read_bits: 2000
      max_read_gap: 0
    channels:
      - category: switcher
        identifier: relay
        name: Relay
        properties:
          - category: 'on'
            read: { register_type: coil, address: 0, data_type: bool }
```

A property takes `category` plus optional `identifier`, `name`, `data_type`, `permissions`, `unit`, `format`,
`static_value`, and optional `read` / `write` bindings. A binding takes `register_type`
(`coil | discrete_input | input_register | holding_register`), `address`, `data_type`
(`bool | int16 | uint16 | int32 | uint32 | float32`) and optionally `bit`, `byte_order`, `word_order`, `scale`,
`offset`, `invert`, `value_map` (`[{ raw, value }]`), `write_function` (`single | multiple`) and `poll_interval_ms`.
Transformations are limited to those binding fields.

### Property defaults

`data_type` and `permissions` may be omitted. They are then filled in from the Smart Panel spec metadata for the
channel and property category. If the spec has no metadata for that pair and the template gives none, the template is
rejected (`data_type is required for <channel>.<property>`). Device, channel and property categories, data types and
permissions are checked on the expansion, not in the JSON schema.

## Repeated channels

A channel with `repeat: { count: N }` (1 to 256) is expanded into N channels. For item index `i = 0 ... N-1`,
`{i}` is `i` and `{n}` is `i + 1`. Placeholders are substituted in the `identifier` and `name` of the channel and of
its properties. Any other `{word}` is an error (`unknown placeholder {word}`). Without `repeat` there is one item
with `i = 0`.

**Limits.** A file holds at most 64 templates, a template at most 64 channel entries, a channel at most 32 properties,
and a template may expand to at most 512 channels in total (the sum of every `repeat.count`, 1 for a channel without
`repeat`). A template over a limit is rejected with a load error.

- **Address**: an integer, or `{ base, step = 1, every = 1 }`, which gives `base + step * floor(i / every)`.
- **Bit**: an integer, or `{ base = 0, step = 1, modulo = 16 }`, which gives `(base + step * i) mod modulo`.

The computed address must be 0 to 65535 and the bit 0 to 15. This covers one point per coil, discrete input or
register (`address: { base: 0 }`) and one point per bit across consecutive registers.

## Built-in examples

Qingjun 32DI: holding register 4 carries DI1-DI16 and register 5 carries DI17-DI32, least significant bit first.

```yaml
- id: qingjun-32di
  name: Qingjun 32-channel digital input board
  manufacturer: Qingjun
  model: 32DI
  description: 32 dry-contact inputs, Modbus TCP. Unit ID is set by DIP switches.
  category: input_controller
  defaults:
    framing: tcp
    port: 8080
    unit_id: { default: 1, min: 0, max: 31, hint: 'Must match the DIP switches; restart the board after changing them' }
    poll_interval_ms: 250
    byte_order: big
    word_order: big
  channels:
    - repeat: { count: 32 }
      identifier: 'di_{n}'
      name: 'DI {n}'
      category: binary_input
      properties:
        - category: state
          read:
            register_type: holding_register
            address: { base: 4, every: 16 }   # 4 for items 0-15, 5 for items 16-31
            data_type: bool
            bit: { modulo: 16 }               # bit 0-15 within that register
```

Eletechsup N4D8B08: relays at PDU 1-8 read `1`/`0` but are written with `256` (on) and `512` (off); inputs are one
register each.

```yaml
- id: eletechsup-n4d8b08
  name: Eletechsup N4D8B08 8-channel relay board
  manufacturer: Eletechsup
  model: N4D8B08
  description: 8 relays and 8 inputs on RS485 at 9600 8N1, reached through a Modbus TCP gateway. The serial settings are configured on the gateway.
  category: switcher
  defaults:
    framing: rtu_over_tcp
    port: 502
    unit_id: { default: 1, min: 1, max: 247 }
    poll_interval_ms: 500
  channels:
    - repeat: { count: 8 }
      identifier: 'relay_{n}'
      name: 'Relay {n}'
      category: switcher
      properties:
        - category: 'on'
          read:
            register_type: holding_register
            address: { base: 1 }
            data_type: uint16
            value_map: [{ raw: 1, value: true }, { raw: 0, value: false }]
          write:
            register_type: holding_register
            address: { base: 1 }
            data_type: uint16
            value_map: [{ raw: 256, value: true }, { raw: 512, value: false }]
            write_function: single
    # PDU 129-136 (0x0081-0x0088): confirm in hardware acceptance (spec "Open items").
    - repeat: { count: 8 }
      identifier: 'input_{n}'
      name: 'Input {n}'
      category: binary_input
      properties:
        - category: state
          read:
            register_type: holding_register
            address: { base: 129 }
            data_type: uint16
            value_map: [{ raw: 1, value: true }, { raw: 0, value: false }]
```

## Revision and copy-on-create

Each template has a **revision**: the first 16 hex characters of the SHA-256 of its canonical JSON (keys sorted
recursively). Creating a device from a template copies the expanded channels and bindings into the database and
records `template_id` and `template_revision`. Later edits to a template never change existing devices; the admin
only shows that a newer revision exists. On create, a `template_id` requires a `template_revision` and must name a
currently loaded template; the revision itself is not compared.

## Reload

`POST /plugins/devices-modbus/templates/reload` re-reads all locations and returns the load result for every file,
including errors.
