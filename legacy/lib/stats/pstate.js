const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { readText, pathExists } = Me.imports.lib.intel;

const BASE = '/sys/devices/system/cpu/intel_pstate';

function samplePstate() {
    if (!pathExists(BASE))
        return null;

    const noTurbo = readText(`${BASE}/no_turbo`);
    const status = readText(`${BASE}/status`);
    const minPct = readText(`${BASE}/min_perf_pct`);
    const maxPct = readText(`${BASE}/max_perf_pct`);

    return {
        turboEnabled: noTurbo !== null ? noTurbo.trim() === '0' : null,
        status: status ? status.trim() : null,
        minPerfPct: minPct ? parseInt(minPct.trim(), 10) : null,
        maxPerfPct: maxPct ? parseInt(maxPct.trim(), 10) : null,
    };
}
/* exported samplePstate */
