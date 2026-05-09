import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { classifyCore } from './stats/hybrid.js';

function fmtPct(v) {
    if (v === null || v === undefined || Number.isNaN(v))
        return '—';
    return `${v.toFixed(0)}%`;
}

function fmtTemp(c, unit) {
    if (c === null || c === undefined)
        return '—';
    if (unit === 'fahrenheit')
        return `${(c * 9 / 5 + 32).toFixed(0)} °F`;
    return `${c.toFixed(0)} °C`;
}

function fmtGhz(mhz) {
    if (mhz === null || mhz === undefined)
        return '—';
    return `${(mhz / 1000).toFixed(2)} GHz`;
}

function fmtWatts(w) {
    if (w === null || w === undefined)
        return '—';
    return `${w.toFixed(1)} W`;
}

class StatRow extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass(this);
    }

    constructor(label) {
        super({ reactive: false, can_focus: false });
        this._label = new St.Label({
            text: label,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._value = new St.Label({
            text: '—',
            style_class: 'cpu-util-menu-value',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._label);
        this.add_child(this._value);
    }

    setValue(text) {
        this._value.set_text(text);
    }
}

class CoreBars extends St.BoxLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(caps) {
        super({
            style_class: 'cpu-util-corebars',
            x_expand: true,
            y_expand: false,
            vertical: false,
        });
        this._caps = caps;
        this._barHeight = 28;
        this._bars = [];
        for (let i = 0; i < caps.cpuCount; i++) {
            const wrap = new St.Bin({
                style_class: 'cpu-util-corebar',
                height: this._barHeight,
                y_align: Clutter.ActorAlign.END,
            });
            const fill = new St.Widget({
                style_class: this._fillClass(i),
                height: 1,
                y_align: Clutter.ActorAlign.END,
            });
            wrap.set_child(fill);
            this.add_child(wrap);
            this._bars.push({ wrap, fill });
        }
    }

    _fillClass(cpu) {
        const kind = classifyCore(cpu, this._caps);
        if (kind === 'P')
            return 'cpu-util-corebar-fill cpu-util-corebar-fill-pcore';
        if (kind === 'E')
            return 'cpu-util-corebar-fill cpu-util-corebar-fill-ecore';
        return 'cpu-util-corebar-fill';
    }

    update(perCore) {
        if (!perCore)
            return;
        for (const sample of perCore) {
            const bar = this._bars[sample.cpu];
            if (!bar)
                continue;
            const h = Math.max(1, Math.round((sample.pct / 100) * this._barHeight));
            bar.fill.set_height(h);
            const hot = sample.pct > 85;
            const base = this._fillClass(sample.cpu);
            bar.fill.set_style_class_name(hot ? `${base} cpu-util-corebar-fill-hot` : base);
        }
    }
}

class CoreBarsItem extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass(this);
    }

    constructor(caps) {
        super({ reactive: false, can_focus: false });
        this._bars = new CoreBars(caps);
        this.add_child(this._bars);
    }

    update(perCore) {
        this._bars.update(perCore);
    }
}

export class CpuUtilMenu {
    constructor(menu, caps, settings) {
        this._menu = menu;
        this._caps = caps;
        this._settings = settings;

        this._throttleBanner = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._throttleBanner.label.set_style_class_name('cpu-util-throttle-banner');
        this._throttleBanner.actor.visible = false;
        menu.addMenuItem(this._throttleBanner);

        const header = new PopupMenu.PopupMenuItem(caps.modelName, { reactive: false });
        header.label.set_style_class_name('cpu-util-section-header');
        menu.addMenuItem(header);

        this._usageRow = new StatRow('CPU Usage');
        this._tempRow = new StatRow('Temperature');
        this._freqRow = new StatRow('Frequency');
        this._govRow = new StatRow('Governor');
        menu.addMenuItem(this._usageRow);
        menu.addMenuItem(this._tempRow);
        menu.addMenuItem(this._freqRow);
        menu.addMenuItem(this._govRow);

        if (caps.hasIntelPstate || caps.hasRapl || caps.isHybrid) {
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Intel'));
        }
        if (caps.hasIntelPstate) {
            this._turboRow = new StatRow('Turbo');
            this._pstateRow = new StatRow('P-state driver');
            this._pstatePctRow = new StatRow('Min / Max %');
            menu.addMenuItem(this._turboRow);
            menu.addMenuItem(this._pstateRow);
            menu.addMenuItem(this._pstatePctRow);
        }
        if (caps.hasRapl) {
            this._powerRow = new StatRow('Package power');
            this._powerCoresRow = new StatRow('  Cores');
            this._powerUncoreRow = new StatRow('  Uncore');
            menu.addMenuItem(this._powerRow);
            menu.addMenuItem(this._powerCoresRow);
            menu.addMenuItem(this._powerUncoreRow);
        }

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Per-core'));
        this._coreBars = new CoreBarsItem(caps);
        menu.addMenuItem(this._coreBars);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._prefsItem = new PopupMenu.PopupMenuItem('Preferences…');
        menu.addMenuItem(this._prefsItem);

        this._throttleHideTimeoutId = 0;
    }

    onPrefsClicked(handler) {
        this._prefsItem.connect('activate', handler);
    }

    update(sample) {
        const tempUnit = this._settings.get_string('temp-unit');
        const showGov = this._settings.get_boolean('show-governor');
        const showRapl = this._settings.get_boolean('show-rapl');
        const showPerCore = this._settings.get_boolean('show-per-core-graph');
        const showThrottle = this._settings.get_boolean('show-throttle-alerts');

        if (sample.usage)
            this._usageRow.setValue(fmtPct(sample.usage.aggregate));
        if (sample.temp)
            this._tempRow.setValue(fmtTemp(sample.temp.packageC, tempUnit));
        if (sample.freq)
            this._freqRow.setValue(fmtGhz(sample.freq.avgMhz));

        this._govRow.actor.visible = showGov;
        if (showGov && sample.freq && sample.freq.governor)
            this._govRow.setValue(sample.freq.governor);

        if (this._caps.hasIntelPstate && sample.pstate) {
            this._turboRow.setValue(
                sample.pstate.turboEnabled === null ? '—'
                    : sample.pstate.turboEnabled ? 'on' : 'off');
            this._pstateRow.setValue(sample.pstate.status ?? '—');
            const lo = sample.pstate.minPerfPct;
            const hi = sample.pstate.maxPerfPct;
            this._pstatePctRow.setValue(
                lo !== null && hi !== null ? `${lo}% / ${hi}%` : '—');
        }

        if (this._caps.hasRapl) {
            this._powerRow.actor.visible = showRapl;
            this._powerCoresRow.actor.visible = showRapl;
            this._powerUncoreRow.actor.visible = showRapl;
            if (!sample.raplAccessible) {
                this._powerRow.setValue('N/A — run setup/install-rapl-access.sh');
                this._powerCoresRow.actor.visible = false;
                this._powerUncoreRow.actor.visible = false;
            } else if (sample.rapl) {
                const pkg = sample.rapl.domains.find(d => /package/i.test(d.name));
                this._powerRow.setValue(fmtWatts(pkg ? pkg.watts : null));
                const cores = pkg?.sub.find(s => /core/i.test(s.name));
                const uncore = pkg?.sub.find(s => /uncore|gpu/i.test(s.name));
                this._powerCoresRow.actor.visible = showRapl && !!cores;
                this._powerUncoreRow.actor.visible = showRapl && !!uncore;
                if (cores)
                    this._powerCoresRow.setValue(fmtWatts(cores.watts));
                if (uncore)
                    this._powerUncoreRow.setValue(fmtWatts(uncore.watts));
            }
        }

        this._coreBars.actor.visible = showPerCore;
        if (showPerCore && sample.usage)
            this._coreBars.update(sample.usage.perCore);

        if (showThrottle && sample.throttle && sample.throttle.deltaCount > 0) {
            this._showThrottleBanner(sample.throttle.deltaCount);
        }
    }

    _showThrottleBanner(count) {
        this._throttleBanner.label.set_text(`⚠ Thermal throttle: +${count} event(s)`);
        this._throttleBanner.actor.visible = true;
        if (this._throttleHideTimeoutId !== 0)
            return;
        this._throttleHideTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, 30, () => {
                this._throttleBanner.actor.visible = false;
                this._throttleHideTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            });
    }

    destroy() {
        if (this._throttleHideTimeoutId !== 0) {
            GLib.Source.remove(this._throttleHideTimeoutId);
            this._throttleHideTimeoutId = 0;
        }
    }
}
