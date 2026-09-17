# reTerminal Digital Input Classification Policy

## Overview

The Seeed Studio reTerminal family features distinct hardware variants with differing input capabilities:

- **reTerminal CM4**: Contains 4 front-panel pushbuttons (F1, F2, F3, O), managed via the Linux `gpio_keys` evdev driver.
- **reTerminal DM**: Industrial form-factor panel featuring isolated digital inputs (DI) alongside digital outputs (DO) and serial/CAN interfaces.

## Input Classification Policy

In accordance with RFC-0036 and the Smart Panel hardware input model:

1. **Physical Pushbuttons (`button`)**:
   - reTerminal CM4 buttons are mapped to `ChannelCategory.BUTTON` channels (`btn_f1`, `btn_f2`, `btn_f3`, `btn_o`).
   - Pushbuttons expose a stateful `detected` property (`permissions: [ro]`, boolean) indicating whether the key is physically held down, and an event-only `event` property (`permissions: [ev]`, string) emitting discrete gesture occurrences (`press`, `double_press`, `long_press`) via `ChannelInputOccurrencesService`.

2. **Industrial Control Digital Inputs (`binary_input`)**:
   - Digital inputs intended for non-security, general automation signaling (e.g. wall switch loops, limit switches, machine status flags, dry contacts) are categorized as `ChannelCategory.BINARY_INPUT`.
   - Binary inputs expose a stateful `state` property (`permissions: [ro]`, boolean) and optionally an `active` property. They may also emit toggle occurrences if hardware transitions are event-driven.

3. **Security and Environmental Sensors (`contact`, `motion`)**:
   - Digital inputs wired to security-critical intrusion switches, door/window reeds, or perimeter tamper circuits MUST remain categorized under their domain-specific categories (e.g. `ChannelCategory.CONTACT`).
   - Such channels preserve explicit contact semantics (`contact: true/false`, open/closed) and are never silently converted into control buttons.
