# Task: Give stores an explicit refresh contract
ID: TECH-ADMIN-STORE-REFRESH-CONTRACT
Type: technical
Scope: admin
Size: medium
Parent: BUG-ADMIN-SOCKET-WAKE-RECOVERY
Status: review

## 1. Business goal

In order to stop the reconnect refresh silently skipping stores
As a developer adding or changing a store
I want the store itself to declare whether it holds anything worth re-reading, instead of every
caller having to work it out from the outside

## 2. Context

The reconnect refresh added in BUG-ADMIN-SOCKET-WAKE-RECOVERY had each module describe, from the
outside, how to tell whether its stores were loaded and how to re-read them:

```ts
refreshLoadedStores([
    { loaded: (): boolean => statsStore.data !== null, refresh: (): Promise<unknown> => statsStore.get() },
])
```

That required the caller to know things the stores never advertised, and the stores disagree with
each other:

| assumption | reality |
| --- | --- |
| `firstLoadFinished()` means "loaded" | six `get()`-based stores declare `firstLoad` and never assign it |
| `fetch()` is the only way to load | detail routes populate a single entity through `get()`, which sets no flag |
| collections are plain records | `scenes` is backed by a `Map` |

**Four of the six defects found in review of that PR were the same mistake in different places**:
a caller guessing at a store's state and guessing wrong. Each was fixed by adjusting that module's
predicate, which worked but left the next store free to disagree again.

## 3. Scope

**In scope**

- Add `isLoaded()` and `refresh()` to every store registered for reconnect refresh (16 stores),
  and to their `*StoreActions` interfaces.
- Change `IRefreshableStore` to that pair, so a store satisfies it structurally.
- Reduce the module handlers to a list of stores.

**Out of scope**

- Stores not registered for reconnect refresh. Parameterised stores (channels-by-device,
  properties-by-channel, scene actions, cards, announcements) stay view-driven, as recorded in §8
  of the parent task.
- Any change to what the stores fetch or how.

## 4. Acceptance criteria

- [x] Every registered store exposes `isLoaded()` and `refresh()`, declared in its actions
      interface.
- [x] Singleton stores report loaded from their own data, since `get()` sets no flag.
- [x] Collection stores report loaded from a completed full load **or** any entity present, so a
      detail route that only ran `get()` still refreshes.
- [x] A collection that loaded and came back empty still reports loaded — an entity created during
      sleep has to be picked up.
- [x] `refreshLoadedStores` takes stores directly; no module restates loading rules.
- [x] Contract tests cover a collection store and a singleton store.
- [x] `lint:js`, `type-check` and `test:unit` pass.

## 5. Example scenarios

### Scenario: Detail route only

Given the admin was opened straight at a space detail route, which loads through `get()`
When the socket reconnects
Then the spaces store reports itself loaded and is refreshed

### Scenario: Collection loaded empty

Given a collection was fetched and returned no entities
When the socket reconnects
Then the store still reports itself loaded, so an entity created during the gap is picked up

### Scenario: Store never opened

Given a module's store was never read
When the socket reconnects
Then it reports itself unloaded and no request is made for it

## 6. Result

Module handlers went from restating each store's rules to naming the stores:

```ts
dataRefreshRegistry.register(systemAdminModuleKey, (): Promise<void> =>
    refreshLoadedStores([systemInfoStore, throttleStatusStore]));
```

A store that answers `isLoaded()` wrongly is now wrong in one place, next to the data it describes,
rather than in whichever module happened to register it.

## 7. Technical constraints

- Do not change fetch behaviour; only add the two accessors.
- Tests are expected for the contract itself, not for each of the sixteen stores.
