// simplified log4j levels
export enum LOG_LEVELS {
    OFF,
    ERROR,
    WARN,
    INFO,
    DEBUG,
}

let _level = 0;

export function init_log_level(settings: any) {
    if (!settings) return;
    _level = settings.get_uint('log-level');
    settings.connect('changed::log-level', () => {
        _level = settings.get_uint('log-level');
    });
}

/**
 * parse level at runtime so we don't have to restart popshell
 */
export function log_level() {
    return _level;
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
