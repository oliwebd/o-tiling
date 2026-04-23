// simplified log4j levels
export enum LOG_LEVELS {
    OFF,
    ERROR,
    WARN,
    INFO,
    DEBUG,
}

/**
 * parse level at runtime so we don't have to restart popshell
 */
export function log_level() {
    if (!globalThis.oTilingExtension) return LOG_LEVELS.INFO;
    let settings = globalThis.oTilingExtension.getSettings();
    let log_level = settings.get_uint('log-level');

    return log_level;
}

export function log(text: string) {
    console.log('o-tiling: ' + text);
}

export function error(text: string) {
    if (log_level() > LOG_LEVELS.OFF) console.error('o-tiling: ' + text);
}

export function warn(text: string) {
    if (log_level() > LOG_LEVELS.ERROR) console.warn('o-tiling: ' + text);
}

export function info(text: string) {
    if (log_level() > LOG_LEVELS.WARN) console.info('o-tiling: ' + text);
}

export function debug(text: string) {
    if (log_level() > LOG_LEVELS.INFO) console.debug('o-tiling: ' + text);
}
