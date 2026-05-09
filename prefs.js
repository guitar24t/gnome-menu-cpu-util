import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const METRICS = [
    { id: 'usage', label: 'CPU Utilization (%)' },
    { id: 'temp', label: 'Temperature' },
    { id: 'freq', label: 'Frequency (GHz)' },
];

function createMetricToggle(metric, settings) {
    const row = new Adw.SwitchRow({ title: metric.label });

    const sync = () => {
        const current = settings.get_strv('panel-metrics');
        const wanted = row.get_active();
        const has = current.includes(metric.id);
        if (wanted === has)
            return;
        let next;
        if (wanted) {
            const order = METRICS.map(m => m.id);
            const merged = [...current, metric.id];
            next = order.filter(id => merged.includes(id));
        } else {
            next = current.filter(id => id !== metric.id);
        }
        settings.set_strv('panel-metrics', next);
    };

    row.set_active(settings.get_strv('panel-metrics').includes(metric.id));
    row.connect('notify::active', sync);
    const signalId = settings.connect('changed::panel-metrics', () => {
        row.set_active(settings.get_strv('panel-metrics').includes(metric.id));
    });
    row.connect('destroy', () => settings.disconnect(signalId));

    return row;
}

export default class CpuUtilPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const display = new Adw.PreferencesGroup({ title: 'Display' });
        page.add(display);

        const interval = new Adw.SpinRow({
            title: 'Refresh interval',
            subtitle: 'Seconds between samples',
            adjustment: new Gtk.Adjustment({
                lower: 1, upper: 10, step_increment: 1, page_increment: 1,
            }),
        });
        settings.bind('refresh-interval', interval, 'value', Gio.SettingsBindFlags.DEFAULT);
        display.add(interval);

        const tempUnit = new Adw.ComboRow({
            title: 'Temperature unit',
            model: Gtk.StringList.new(['Celsius', 'Fahrenheit']),
        });
        const updateTempUnitCombo = () => {
            tempUnit.set_selected(settings.get_string('temp-unit') === 'fahrenheit' ? 1 : 0);
        };
        updateTempUnitCombo();
        tempUnit.connect('notify::selected', () => {
            settings.set_string('temp-unit', tempUnit.get_selected() === 1 ? 'fahrenheit' : 'celsius');
        });
        const tempUnitChangedId = settings.connect('changed::temp-unit', updateTempUnitCombo);
        tempUnit.connect('destroy', () => settings.disconnect(tempUnitChangedId));
        display.add(tempUnit);

        const showPerCore = new Adw.SwitchRow({
            title: 'Per-core graph in menu',
            subtitle: 'Show one bar per logical CPU',
        });
        settings.bind('show-per-core-graph', showPerCore, 'active', Gio.SettingsBindFlags.DEFAULT);
        display.add(showPerCore);

        const showGov = new Adw.SwitchRow({
            title: 'Show governor row',
        });
        settings.bind('show-governor', showGov, 'active', Gio.SettingsBindFlags.DEFAULT);
        display.add(showGov);

        const metrics = new Adw.PreferencesGroup({
            title: 'Top-bar metrics',
            description: 'Pick which metrics appear in the panel label',
        });
        page.add(metrics);
        for (const m of METRICS)
            metrics.add(createMetricToggle(m, settings));

        const intel = new Adw.PreferencesGroup({
            title: 'Intel-specific',
            description: 'These options have no effect on non-Intel CPUs.',
        });
        page.add(intel);

        const showRapl = new Adw.SwitchRow({
            title: 'Show RAPL package power',
            subtitle: 'Requires read access to /sys/class/powercap. Run setup/install-rapl-access.sh once.',
        });
        settings.bind('show-rapl', showRapl, 'active', Gio.SettingsBindFlags.DEFAULT);
        intel.add(showRapl);

        const throttle = new Adw.SwitchRow({
            title: 'Show thermal-throttle alerts',
            subtitle: 'Flash the indicator when a core throttles',
        });
        settings.bind('show-throttle-alerts', throttle, 'active', Gio.SettingsBindFlags.DEFAULT);
        intel.add(throttle);
    }
}
