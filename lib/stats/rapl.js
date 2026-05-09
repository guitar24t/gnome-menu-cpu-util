import GLib from 'gi://GLib';
import { readText, listDir, pathExists } from '../intel.js';

const RAPL_BASE = '/sys/class/powercap';

function discoverDomains() {
    const domains = [];
    for (const top of listDir(RAPL_BASE)) {
        if (!top.startsWith('intel-rapl:'))
            continue;
        const path = `${RAPL_BASE}/${top}`;
        const name = (readText(`${path}/name`) ?? top).trim();
        const energyPath = `${path}/energy_uj`;
        const maxText = readText(`${path}/max_energy_range_uj`);
        const max = maxText ? parseInt(maxText.trim(), 10) : Number.MAX_SAFE_INTEGER;
        domains.push({ name, energyPath, max, sub: [] });

        for (const child of listDir(path)) {
            if (!child.startsWith('intel-rapl:'))
                continue;
            const childPath = `${path}/${child}`;
            const childName = (readText(`${childPath}/name`) ?? child).trim();
            const childEnergy = `${childPath}/energy_uj`;
            const childMaxText = readText(`${childPath}/max_energy_range_uj`);
            const childMax = childMaxText ? parseInt(childMaxText.trim(), 10) : Number.MAX_SAFE_INTEGER;
            domains[domains.length - 1].sub.push({
                name: childName,
                energyPath: childEnergy,
                max: childMax,
            });
        }
    }
    return domains;
}

export class RaplSampler {
    constructor() {
        this._domains = null;
        this._prev = new Map();
        this._accessible = pathExists(`${RAPL_BASE}/intel-rapl/intel-rapl:0`);
        this._readError = null;
    }

    isAccessible() {
        return this._accessible && this._readError === null;
    }

    lastError() {
        return this._readError;
    }

    _ensureDiscovered() {
        if (this._domains !== null)
            return;
        this._domains = discoverDomains();
    }

    _readEnergy(path, max) {
        const text = readText(path);
        if (text === null) {
            this._readError = `cannot read ${path} (need group access — run setup/install-rapl-access.sh)`;
            return null;
        }
        const v = parseInt(text.trim(), 10);
        if (Number.isNaN(v))
            return null;
        return { uj: v, max };
    }

    _delta(key, sample, nowUs) {
        const prev = this._prev.get(key);
        this._prev.set(key, { uj: sample.uj, t: nowUs });
        if (!prev)
            return null;
        const dt = nowUs - prev.t;
        if (dt <= 0)
            return null;
        let dE = sample.uj - prev.uj;
        if (dE < 0)
            dE += sample.max;
        return (dE / dt);
    }

    sample() {
        this._ensureDiscovered();
        if (!this._accessible || this._domains.length === 0)
            return null;

        this._readError = null;

        const nowUs = GLib.get_monotonic_time();
        const out = { domains: [] };

        for (const d of this._domains) {
            const energy = this._readEnergy(d.energyPath, d.max);
            if (!energy)
                return null;
            const watts = this._delta(d.energyPath, energy, nowUs);
            const sub = [];
            for (const s of d.sub) {
                const e = this._readEnergy(s.energyPath, s.max);
                if (e) {
                    const w = this._delta(s.energyPath, e, nowUs);
                    sub.push({ name: s.name, watts: w });
                }
            }
            out.domains.push({ name: d.name, watts, sub });
        }
        return out;
    }
}
