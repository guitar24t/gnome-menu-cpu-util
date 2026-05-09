import { readText } from '../intel.js';

function parseStat(text) {
    const lines = text.split('\n');
    const cpus = new Map();
    for (const line of lines) {
        const m = line.match(/^(cpu\d*)\s+(.+)$/);
        if (!m)
            continue;
        const fields = m[2].trim().split(/\s+/).map(n => parseInt(n, 10));
        const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = fields;
        const active = user + nice + system + irq + softirq + steal;
        const total = active + idle + iowait;
        cpus.set(m[1], { active, total });
    }
    return cpus;
}

export class UsageSampler {
    constructor() {
        this._prev = null;
    }

    reset() {
        this._prev = null;
    }

    sample() {
        const text = readText('/proc/stat');
        if (!text)
            return null;
        const curr = parseStat(text);
        const prev = this._prev;
        this._prev = curr;
        if (!prev)
            return null;

        const result = { aggregate: 0, perCore: [] };
        for (const [key, c] of curr) {
            const p = prev.get(key);
            if (!p)
                continue;
            const dActive = c.active - p.active;
            const dTotal = c.total - p.total;
            const pct = dTotal > 0 ? (dActive / dTotal) * 100 : 0;
            if (key === 'cpu')
                result.aggregate = pct;
            else
                result.perCore.push({ cpu: parseInt(key.slice(3), 10), pct });
        }
        result.perCore.sort((a, b) => a.cpu - b.cpu);
        return result;
    }
}
