const { GLib, Gio } = imports.gi;

const decoder = new TextDecoder();

function readText(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        if (!ok)
            return null;
        return decoder.decode(bytes);
    } catch (_e) {
        return null;
    }
}

function pathExists(path) {
    return GLib.file_test(path, GLib.FileTest.EXISTS);
}

function listDir(path) {
    const out = [];
    const dir = Gio.File.new_for_path(path);
    if (!dir.query_exists(null))
        return out;
    let enumerator;
    try {
        enumerator = dir.enumerate_children('standard::name',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    } catch (_e) {
        return out;
    }
    let info;
    while ((info = enumerator.next_file(null)) !== null)
        out.push(info.get_name());
    enumerator.close(null);
    return out;
}

function parseCpuList(text) {
    const out = [];
    if (!text)
        return out;
    for (const part of text.trim().split(',')) {
        const [a, b] = part.split('-').map(s => parseInt(s, 10));
        if (Number.isNaN(a))
            continue;
        const end = Number.isNaN(b) ? a : b;
        for (let i = a; i <= end; i++)
            out.push(i);
    }
    return out;
}

function findCoreTempHwmon() {
    const dir = '/sys/class/hwmon';
    for (const child of listDir(dir)) {
        const name = readText(`${dir}/${child}/name`);
        if (name && name.trim() === 'coretemp')
            return `${dir}/${child}`;
    }
    return null;
}

function detectCpuCount() {
    const stat = readText('/proc/stat');
    if (!stat)
        return 1;
    let count = 0;
    for (const line of stat.split('\n')) {
        if (/^cpu\d+\s/.test(line))
            count++;
    }
    return Math.max(count, 1);
}

function detectCapabilities() {
    const cpuinfo = readText('/proc/cpuinfo') || '';
    const vendorMatch = cpuinfo.match(/^vendor_id\s*:\s*(\S+)/m);
    const modelMatch = cpuinfo.match(/^model name\s*:\s*(.+)$/m);
    const vendor = vendorMatch ? vendorMatch[1] : 'unknown';
    const isIntel = vendor === 'GenuineIntel';
    const modelName = modelMatch ? modelMatch[1].trim() : 'Unknown CPU';

    const hasIntelPstate = pathExists('/sys/devices/system/cpu/intel_pstate');

    const pCoreList = readText('/sys/devices/cpu_core/cpus');
    const eCoreList = readText('/sys/devices/cpu_atom/cpus');
    const isHybrid = !!(pCoreList && eCoreList);
    const pCores = isHybrid ? parseCpuList(pCoreList) : [];
    const eCores = isHybrid ? parseCpuList(eCoreList) : [];

    const hasRapl = pathExists('/sys/class/powercap/intel-rapl/intel-rapl:0');
    const coreTempHwmon = findCoreTempHwmon();

    return {
        vendor,
        isIntel,
        modelName,
        cpuCount: detectCpuCount(),
        hasIntelPstate,
        isHybrid,
        pCores,
        eCores,
        hasRapl,
        coreTempHwmon,
    };
}

/* exported readText pathExists listDir detectCapabilities */
