import { readText } from '../intel.js';

const cpuBase = '/sys/devices/system/cpu';

export class ThrottleSampler {
    constructor() {
        this._prev = new Map();
    }

    sample(cpuCount) {
        let total = 0;
        let delta = 0;
        const events = [];

        for (let i = 0; i < cpuCount; i++) {
            const path = `${cpuBase}/cpu${i}/thermal_throttle/core_throttle_count`;
            const text = readText(path);
            if (!text)
                continue;
            const v = parseInt(text.trim(), 10);
            if (Number.isNaN(v))
                continue;
            total += v;
            const prev = this._prev.get(i);
            this._prev.set(i, v);
            if (prev !== undefined && v > prev) {
                delta += v - prev;
                events.push({ cpu: i, count: v - prev });
            }
        }

        return { totalCount: total, deltaCount: delta, events };
    }
}
