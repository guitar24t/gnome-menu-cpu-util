const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { readText } = Me.imports.lib.intel;

const cpuBase = '/sys/devices/system/cpu';

function sampleFreq(cpuCount) {
    const perCore = [];
    let sum = 0;
    let n = 0;
    let governor = null;

    for (let i = 0; i < cpuCount; i++) {
        const freqText = readText(`${cpuBase}/cpu${i}/cpufreq/scaling_cur_freq`);
        if (freqText) {
            const khz = parseInt(freqText.trim(), 10);
            if (!Number.isNaN(khz)) {
                perCore.push({ cpu: i, mhz: khz / 1000 });
                sum += khz;
                n++;
            }
        }
        if (governor === null) {
            const g = readText(`${cpuBase}/cpu${i}/cpufreq/scaling_governor`);
            if (g)
                governor = g.trim();
        }
    }

    return {
        avgMhz: n > 0 ? (sum / n) / 1000 : null,
        perCore,
        governor,
    };
}
/* exported sampleFreq */
