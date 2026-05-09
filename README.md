# CPU Util — GNOME Shell extension

Top-bar CPU monitor for GNOME Shell 45+. Shows live utilization, temperature, frequency, and governor at a glance, with first-class support for Intel-specific telemetry (RAPL package power, hybrid P-core / E-core split, turbo state, thermal-throttle alerts).

Tested target: **Ubuntu 24.04 LTS / GNOME 46**. Modern build supports **GNOME Shell 45–48**; a separate legacy build under `legacy/` supports **GNOME Shell 40–44** (covers RHEL 9, Ubuntu 22.04).

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

### From a release (recommended)

1. **Check your GNOME Shell version** to pick the right build:

    ```sh
    gnome-shell --version
    ```

    - **45 or newer** → modern zip
    - **40–44** (RHEL 9, Ubuntu 22.04) → legacy zip

2. **Download** the matching asset from the [latest release](https://github.com/guitar24t/gnome-menu-cpu-util/releases/latest):

    - `cpu-util@robhilton.dev.shell-extension.zip` — modern (GNOME Shell 45+)
    - `cpu-util@robhilton.dev.legacy.shell-extension.zip` — legacy (GNOME Shell 40–44)

3. **Install** the zip (use `--force` to overwrite an existing install on upgrade):

    ```sh
    gnome-extensions install --force ~/Downloads/cpu-util@robhilton.dev.shell-extension.zip
    ```

    Substitute the legacy filename if you downloaded that one.

4. **Restart GNOME Shell:**

    - Wayland: log out and back in.
    - X11: press Alt+F2, type `r`, press Enter.

5. **Enable** the extension:

    ```sh
    gnome-extensions enable cpu-util@robhilton.dev
    ```

6. **(Intel only) Grant RAPL power access.** Without this, the package power row reads `N/A`. The setup script ships inside the zip; run it once and then log out and back in:

    ```sh
    sudo ~/.local/share/gnome-shell/extensions/cpu-util@robhilton.dev/setup/install-rapl-access.sh
    ```

    The script creates a `powermon` group, adds your user to it, and installs a udev rule that grants the group read access to `/sys/class/powercap/intel-rapl:*/energy_uj` (root-only by default on most kernels). The log-out/in is required for the group membership to take effect.

> **Tip:** Optional but recommended — `sudo apt install lm-sensors && sudo sensors-detect`. The extension reads `/sys/class/hwmon` directly, but having lm-sensors set up ensures the `coretemp` driver is loaded for temperatures.

### From source

Build prerequisites: `glib-compile-schemas` (from `libglib2.0-bin`), `make`, `zip`.

```sh
git clone https://github.com/guitar24t/gnome-menu-cpu-util
cd gnome-menu-cpu-util
make install
```

`make install` auto-detects your `gnome-shell --version` and installs the modern build for 45+ or the legacy build for 40–44. To force one explicitly: `make install-modern` or `make install-legacy`. To check what would be picked: `make which`.

Then restart GNOME Shell, enable, and (on Intel) run the RAPL setup as in steps 4–6 above. The setup script is also at `./setup/install-rapl-access.sh` in the source tree.

Open preferences:
```sh
gnome-extensions prefs cpu-util@robhilton.dev
```

### Uninstall

```sh
gnome-extensions uninstall cpu-util@robhilton.dev
```

(Or `make uninstall` if installed from source.)

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
