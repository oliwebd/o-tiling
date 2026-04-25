import * as log from './log.js';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type Meta from 'gi://Meta';

let _failed: boolean = false;
let _checked: boolean = false;   // whether we've checked service existence
let _foreground: number = 0;

export function setForeground(win: Meta.Window) {
    if (_failed) return;

    if (!_checked) {
        _checked = true;
        // Quick sync name-has-owner check; no async needed since this is one-time
        try {
            const hasOwner = Gio.DBus.system.call_sync(
                'org.freedesktop.DBus',
                '/org/freedesktop/DBus',
                'org.freedesktop.DBus',
                'NameHasOwner',
                new GLib.Variant('(s)', ['com.system76.Scheduler']) as any,
                null,
                Gio.DBusCallFlags.NONE,
                500,
                null
            );
            const [owned] = hasOwner.deep_unpack() as [boolean];
            if (!owned) {
                _failed = true;
                return;
            }
        } catch (_) {
            _failed = true;
            return;
        }
    }

    const pid = win.get_pid();
    if (!pid || _foreground === pid) return;
    _foreground = pid;

    try {
        Gio.DBus.system.call(
            'com.system76.Scheduler',
            '/com/system76/Scheduler',
            'com.system76.Scheduler',
            'SetForegroundProcess',
            new GLib.Variant('(u)', [pid]) as any,
            null, // expected reply type
            Gio.DBusCallFlags.NONE,
            -1, // default timeout
            null, // cancellable
            (_connection: any, result: any) => {
                try {
                    Gio.DBus.system.call_finish(result);
                } catch (error) {
                    errorHandler(error);
                }
            },
        );
    } catch (error) {
        errorHandler(error);
    }
}

/** Call from extension disable() to release state. */
export function destroy() {
    _foreground = 0;
    _failed = false;
    _checked = false;
}


function errorHandler(error: any) {
    log.debug(`system76-scheduler may not be installed and running: ${error}`);
    _failed = true;
}
