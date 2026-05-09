const { GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { UsageSampler } = Me.imports.lib.stats.usage;
const { sampleFreq } = Me.imports.lib.stats.freq;
const { TempSampler } = Me.imports.lib.stats.temp;
const { RaplSampler } = Me.imports.lib.stats.rapl;
const { samplePstate } = Me.imports.lib.stats.pstate;
const { ThrottleSampler } = Me.imports.lib.stats.throttle;

var Poller = class Poller {
    constructor(caps, intervalSec, onSample) {
        this._caps = caps;
        this._interval = intervalSec;
        this._onSample = onSample;
        this._timeoutId = 0;

        this._usage = new UsageSampler();
        this._temp = new TempSampler(caps.coreTempHwmon);
        this._rapl = caps.hasRapl ? new RaplSampler() : null;
        this._throttle = new ThrottleSampler();
    }

    setInterval(seconds) {
        if (this._interval === seconds)
            return;
        this._interval = seconds;
        if (this._timeoutId !== 0) {
            this.stop();
            this.start();
        }
    }

    start() {
        if (this._timeoutId !== 0)
            return;
        this._tick();
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this._interval,
            () => {
                this._tick();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    stop() {
        if (this._timeoutId !== 0) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }
    }

    _tick() {
        const sample = {
            usage: this._usage.sample(),
            freq: sampleFreq(this._caps.cpuCount),
            temp: this._temp.sample(),
            rapl: this._rapl ? this._rapl.sample() : null,
            raplAccessible: this._rapl ? this._rapl.isAccessible() : false,
            raplError: this._rapl ? this._rapl.lastError() : null,
            pstate: this._caps.hasIntelPstate ? samplePstate() : null,
            throttle: this._throttle.sample(this._caps.cpuCount),
        };
        try {
            this._onSample(sample);
        } catch (e) {
            logError(e, 'cpu-util: onSample handler threw');
        }
    }
};
/* exported Poller */
