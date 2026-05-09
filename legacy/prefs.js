imports.gi.versions.Gtk = '3.0';

const { Gtk, Gio } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const METRICS = [
    { id: 'usage', label: 'CPU Utilization (%)' },
    { id: 'temp', label: 'Temperature' },
    { id: 'freq', label: 'Frequency (GHz)' },
];

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function makeFrame(title) {
    const frame = new Gtk.Frame({
        label: title,
        margin_top: 8,
        margin_bottom: 4,
    });
    const grid = new Gtk.Grid({
        column_spacing: 12,
        row_spacing: 8,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 12,
        margin_end: 12,
    });
    frame.add(grid);
    return { frame, grid };
}

function addRow(grid, row, labelText, control) {
    const label = new Gtk.Label({
        label: labelText,
        halign: Gtk.Align.START,
        hexpand: true,
    });
    grid.attach(label, 0, row, 1, 1);
    grid.attach(control, 1, row, 1, 1);
}

function buildMetricsRow(settings) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 4,
    });

    const sync = (button, metric) => {
        const current = settings.get_strv('panel-metrics');
        const wanted = button.get_active();
        const has = current.indexOf(metric) !== -1;
        if (wanted === has)
            return;
        let next;
        if (wanted) {
            const order = METRICS.map(m => m.id);
            const merged = current.concat([metric]);
            next = order.filter(id => merged.indexOf(id) !== -1);
        } else {
            next = current.filter(id => id !== metric);
        }
        settings.set_strv('panel-metrics', next);
    };

    const settingsChangedId = settings.connect('changed::panel-metrics', () => {
        const current = settings.get_strv('panel-metrics');
        for (const child of box.get_children()) {
            if (child._metric)
                child.set_active(current.indexOf(child._metric) !== -1);
        }
    });
    box.connect('destroy', () => settings.disconnect(settingsChangedId));

    for (const m of METRICS) {
        const cb = new Gtk.CheckButton({ label: m.label });
        cb._metric = m.id;
        cb.set_active(settings.get_strv('panel-metrics').indexOf(m.id) !== -1);
        cb.connect('toggled', () => sync(cb, m.id));
        box.add(cb);
    }

    return box;
}

function buildPrefsWidget() {
    const settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);

    const root = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 8,
        margin_top: 12,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12,
    });

    // ---- Display ----
    const display = makeFrame('Display');

    const interval = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({
            lower: 1, upper: 10, step_increment: 1, page_increment: 1, value: 2,
        }),
        halign: Gtk.Align.END,
    });
    settings.bind('refresh-interval', interval, 'value', Gio.SettingsBindFlags.DEFAULT);
    addRow(display.grid, 0, 'Refresh interval (seconds)', interval);

    const tempUnit = new Gtk.ComboBoxText({ halign: Gtk.Align.END });
    tempUnit.append('celsius', 'Celsius');
    tempUnit.append('fahrenheit', 'Fahrenheit');
    tempUnit.set_active_id(settings.get_string('temp-unit'));
    tempUnit.connect('changed', () => {
        const id = tempUnit.get_active_id();
        if (id)
            settings.set_string('temp-unit', id);
    });
    const tempUnitChangedId = settings.connect('changed::temp-unit', () => {
        tempUnit.set_active_id(settings.get_string('temp-unit'));
    });
    tempUnit.connect('destroy', () => settings.disconnect(tempUnitChangedId));
    addRow(display.grid, 1, 'Temperature unit', tempUnit);

    const showPerCore = new Gtk.Switch({ halign: Gtk.Align.END, valign: Gtk.Align.CENTER });
    settings.bind('show-per-core-graph', showPerCore, 'active', Gio.SettingsBindFlags.DEFAULT);
    addRow(display.grid, 2, 'Per-core graph in menu', showPerCore);

    const showGov = new Gtk.Switch({ halign: Gtk.Align.END, valign: Gtk.Align.CENTER });
    settings.bind('show-governor', showGov, 'active', Gio.SettingsBindFlags.DEFAULT);
    addRow(display.grid, 3, 'Show governor row', showGov);

    root.add(display.frame);

    // ---- Top-bar metrics ----
    const metrics = makeFrame('Top-bar metrics');
    const metricsLabel = new Gtk.Label({
        label: 'Pick which metrics appear in the panel label',
        halign: Gtk.Align.START,
        wrap: true,
    });
    metrics.grid.attach(metricsLabel, 0, 0, 2, 1);
    metrics.grid.attach(buildMetricsRow(settings), 0, 1, 2, 1);
    root.add(metrics.frame);

    // ---- Intel-specific ----
    const intel = makeFrame('Intel-specific');
    const intelNote = new Gtk.Label({
        label: 'These options have no effect on non-Intel CPUs.',
        halign: Gtk.Align.START,
        wrap: true,
    });
    intel.grid.attach(intelNote, 0, 0, 2, 1);

    const showRapl = new Gtk.Switch({ halign: Gtk.Align.END, valign: Gtk.Align.CENTER });
    settings.bind('show-rapl', showRapl, 'active', Gio.SettingsBindFlags.DEFAULT);
    addRow(intel.grid, 1, 'Show RAPL package power', showRapl);

    const throttle = new Gtk.Switch({ halign: Gtk.Align.END, valign: Gtk.Align.CENTER });
    settings.bind('show-throttle-alerts', throttle, 'active', Gio.SettingsBindFlags.DEFAULT);
    addRow(intel.grid, 2, 'Show thermal-throttle alerts', throttle);

    root.add(intel.frame);

    root.show_all();
    return root;
}
