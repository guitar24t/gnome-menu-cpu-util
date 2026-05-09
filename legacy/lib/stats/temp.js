const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { readText, listDir } = Me.imports.lib.intel;

var TempSampler = class TempSampler {
    constructor(coreTempHwmon) {
        this._dir = coreTempHwmon;
        this._inputs = null;
    }

    _discover() {
        if (!this._dir) {
            this._inputs = [];
            return;
        }
        const inputs = [];
        for (const f of listDir(this._dir)) {
            const m = f.match(/^temp(\d+)_input$/);
            if (!m)
                continue;
            const idx = parseInt(m[1], 10);
            const labelText = readText(`${this._dir}/temp${idx}_label`);
            const label = labelText ? labelText.trim() : `Temp ${idx}`;
            inputs.push({ idx, label, path: `${this._dir}/${f}` });
        }
        inputs.sort((a, b) => a.idx - b.idx);
        this._inputs = inputs;
    }

    sample() {
        if (this._inputs === null)
            this._discover();
        if (this._inputs.length === 0)
            return null;

        const readings = [];
        let pkg = null;
        for (const inp of this._inputs) {
            const t = readText(inp.path);
            if (!t)
                continue;
            const milliC = parseInt(t.trim(), 10);
            if (Number.isNaN(milliC))
                continue;
            const c = milliC / 1000;
            readings.push({ label: inp.label, c });
            if (/Package/i.test(inp.label) && pkg === null)
                pkg = c;
        }

        if (pkg === null && readings.length > 0)
            pkg = Math.max.apply(null, readings.map(r => r.c));

        return { packageC: pkg, perInput: readings };
    }
};
/* exported TempSampler */
