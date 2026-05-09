export function classifyCore(cpu, caps) {
    if (!caps.isHybrid)
        return null;
    if (caps.pCores.includes(cpu))
        return 'P';
    if (caps.eCores.includes(cpu))
        return 'E';
    return null;
}
