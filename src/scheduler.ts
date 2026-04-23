import * as log from './log.js';

import Gio from 'gi://Gio';
import type Meta from 'gi://Meta';

const SchedulerInterface =
    '<node>\
<interface name="com.system76.Scheduler"> \
    <method name="SetForegroundProcess"> \
        <arg name="pid" type="u" direction="in"/> \
    </method> \
</interface> \
</node>';

const SchedulerProxy = Gio.DBusProxy.makeProxyWrapper(SchedulerInterface);

// Lazy proxy — created on first use, not at module load time.
let _proxy: any = null;
let _failed: boolean = false;
let _foreground: number = 0;

function getProxy(): any | null {
    if (_failed) return null;
    if (_proxy) return _proxy;

    try {
        _proxy = new (SchedulerProxy as any)(
            Gio.DBus.system,
            'com.system76.Scheduler',
            '/com/system76/Scheduler',
        );
    } catch (e) {
        log.warn(`system76-scheduler: failed to create proxy: ${e}`);
        _failed = true;
        return null;
    }

    return _proxy;
}

export function setForeground(win: Meta.Window) {
    const proxy = getProxy();
    if (!proxy) return;

    const pid = win.get_pid();
    if (!pid || _foreground === pid) return;
    _foreground = pid;

    try {
        proxy.SetForegroundProcessRemote(pid, (_result: any, error: any, _fds: any) => {
            if (error !== null) errorHandler(error);
        });
    } catch (error) {
        errorHandler(error);
    }
}

/** Call from extension disable() to release the D-Bus connection. */
export function destroy() {
    _proxy = null;
    _foreground = 0;
    _failed = false;
}

function errorHandler(error: any) {
    log.warn(`system76-scheduler may not be installed and running: ${error}`);
    _failed = true;
}
