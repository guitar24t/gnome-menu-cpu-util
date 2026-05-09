function classifyCore(cpu, caps) {
    if (!caps.isHybrid)
        return null;
    if (caps.pCores.indexOf(cpu) !== -1)
        return 'P';
    if (caps.eCores.indexOf(cpu) !== -1)
        return 'E';
    return null;
}
/* exported classifyCore */
