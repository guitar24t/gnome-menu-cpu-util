import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import { detectCapabilities } from './intel.js';
import { Poller } from './poller.js';
import { CpuUtilMenu } from './menu.js';

function fmtMetric(kind, sample, tempUnit) {
    switch (kind) {
        case 'usage': {
            const v = sample.usage?.aggregate;
            return v === undefined || v === null ? '' : `${v.toFixed(0)}%`;
        }
        case 'temp': {
            const c = sample.temp?.packageC;
            if (c === null || c === undefined)
                return '';
            return tempUnit === 'fahrenheit'
                ? `${(c * 9 / 5 + 32).toFixed(0)}°F`
                : `${c.toFixed(0)}°C`;
        }
        case 'freq': {
            const m = sample.freq?.avgMhz;
            return m === null || m === undefined ? '' : `${(m / 1000).toFixed(2)}GHz`;
        }
        default:
            return '';
    }
}

export const CpuUtilIndicator = GObject.registerClass(
class CpuUtilIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'CPU Util');

        this._extension = extension;
        this._settings = extension.getSettings();
        this._caps = detectCapabilities();

        this._label = new St.Label({
            style_class: 'cpu-util-panel-label',
            text: '…',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._label);

        this._menuView = new CpuUtilMenu(this.menu, this._caps, this._settings);
        this._menuView.onPrefsClicked(() => {
            this.menu.close();
            extension.openPreferences();
        });

        this._poller = new Poller(
            this._caps,
            this._settings.get_uint('refresh-interval'),
            (sample) => this._onSample(sample),
        );

        this._settingsChangedId = this._settings.connect('changed', (_s, key) => {
            if (key === 'refresh-interval')
                this._poller.setInterval(this._settings.get_uint('refresh-interval'));
        });

        this._poller.start();
    }

    _onSample(sample) {
        const tempUnit = this._settings.get_string('temp-unit');
        const metrics = this._settings.get_strv('panel-metrics');
        const parts = metrics
            .map(m => fmtMetric(m, sample, tempUnit))
            .filter(s => s.length > 0);
        const throttling = this._settings.get_boolean('show-throttle-alerts')
            && sample.throttle && sample.throttle.deltaCount > 0;
        this._label.set_text(parts.length > 0 ? parts.join('  ') : 'CPU');
        if (throttling)
            this._label.add_style_class_name('cpu-util-panel-label-throttling');
        else
            this._label.remove_style_class_name('cpu-util-panel-label-throttling');

        this._menuView.update(sample);
    }

    destroy() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }
        this._poller.stop();
        this._menuView.destroy();
        super.destroy();
    }
});
