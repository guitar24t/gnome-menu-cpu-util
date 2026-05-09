# CPU Util — GNOME Shell extension

Top-bar CPU monitor for GNOME Shell 45+. Shows live utilization, temperature, frequency, and governor at a glance, with first-class support for Intel-specific telemetry (RAPL package power, hybrid P-core / E-core split, turbo state, thermal-throttle alerts).

Tested target: **Ubuntu 24.04 LTS / GNOME 46**. Should work on any distro running GNOME Shell 45–48.

> **Status:** v1 source written but **not yet runtime-tested** on a real GNOME Shell. First install on a Linux box may need small fixups. Contributors / AI agents picking this up should read [`CLAUDE.md`](./CLAUDE.md) first — it has architecture pointers, gotchas already encountered, and a verification checklist.

## Features

- Configurable panel label: pick any combination of CPU%, °C, GHz
- Popup menu with full breakdown: usage, temperature, frequency, governor, per-core sparkline graph
- **Intel extras** (auto-detected, hidden on non-Intel CPUs):
  - RAPL package / cores / uncore power in watts
  - `intel_pstate` driver state (active/passive/off, turbo on/off, min/max %)
  - Hybrid P-core / E-core grouping (Alder Lake and newer)
  - Thermal throttle detection — flashes the indicator and shows a banner when a core throttles
- Adwaita preferences: refresh rate (1–10s), °C/°F, per-core graph on/off, governor on/off, throttle alerts on/off

## Install

### Prerequisites

- `glib-compile-schemas` (from `libglib2.0-bin`)
- `make`, `zip`
- Optional but recommended: `lm-sensors` package, with `sudo sensors-detect` run once. The extension reads `/sys/class/hwmon` directly, but having lm-sensors set up ensures the `coretemp` driver is loaded.

### From source

```sh
git clone https://github.com/robhilton/gnome-menu-cpu-util
cd gnome-menu-cpu-util
make install
```

Then restart GNOME Shell:
- **Wayland**: log out and back in.
- **X11**: press Alt+F2, type `r`, press Enter.

Enable the extension:
```sh
gnome-extensions enable cpu-util@robhilton.dev
```

Open preferences:
```sh
gnome-extensions prefs cpu-util@robhilton.dev
```

### Uninstall

```sh
make uninstall
```

## RAPL power readings (Intel)

On most kernels, `/sys/class/powercap/intel-rapl/*/energy_uj` is root-only. To let the extension read it without root:

```sh
sudo ./setup/install-rapl-access.sh
```

This creates a `powermon` group, adds your user to it, and installs a udev rule that grants the group read access to RAPL energy files. **Log out and back in** for the group membership to take effect.

If you skip this step, the power row simply shows "N/A — set up required" with a link to the helper script.

## Architecture (for contributors)

- `extension.js` — enable/disable lifecycle. Minimal.
- `lib/indicator.js` — `PanelMenu.Button` subclass; owns the popup menu and the `Poller`.
- `lib/poller.js` — single `GLib.timeout_add_seconds` driving all sampling.
- `lib/intel.js` — runs once at enable; produces a capability cache `{ isIntel, hasIntelPstate, isHybrid, hasRapl, coreTempHwmon, ... }`.
- `lib/stats/*.js` — pure data-collection modules. Each owns its own delta state (previous `/proc/stat`, previous RAPL energy + timestamp, previous throttle counters).
- `prefs.js` — `Adw.PreferencesWindow` UI bound to the GSettings schema.

All file reads are tiny `/proc` and `/sys` reads (a few hundred bytes). No subprocesses are spawned during the poll loop.

### Frequency caveat

Under `intel_pstate active`, `scaling_cur_freq` is the *requested* frequency, not measured. Accurate measurement needs APERF/MPERF MSRs (root). The displayed value is good enough for "is the CPU boosting?" decisions but is not a precise instantaneous frequency.

## License

GPL-2.0-or-later. See `LICENSE`.
