const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { readText } = Me.imports.lib.intel;

function parseStat(text) {
    const lines = text.split('\n');
    const cpus = new Map();
    for (const line of lines) {
        const m = line.match(/^(cpu\d*)\s+(.+)$/);
        if (!m)
            continue;
        const fields = m[2].trim().split(/\s+/).map(n => parseInt(n, 10));
        const user = fields[0] || 0;
        const nice = fields[1] || 0;
        const system = fields[2] || 0;
        const idle = fields[3] || 0;
        const iowait = fields[4] || 0;
        const irq = fields[5] || 0;
        const softirq = fields[6] || 0;
        const steal = fields[7] || 0;
        const active = user + nice + system + irq + softirq + steal;
        const total = active + idle + iowait;
        cpus.set(m[1], { active, total });
    }
    return cpus;
}

var UsageSampler = class UsageSampler {
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
};
/* exported UsageSampler */
