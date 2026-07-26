import * as Ecs from '../core/ecs.js';

import * as Lib from '../utils/lib.js';
import * as log from '../utils/log.js';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

export interface Executor<T> {
    wake<S extends Ecs.System<T>>(system: S, event: T): void;
}

/** Glib-based event executor */
export class GLibExecutor<T> implements Executor<T> {
    #event_loop: SignalID | null = null;
    #events: Array<T> = [];
    #used_laters: boolean = false;

    /** Creates an idle_add signal that exists only for as long as there are events to process.
     *
     * - If the signal has already been created, the event will be added to the queue.
     * - The signal will continue executing for as long as there are events remaining in the queue.
     * - Events are handled within batches, yielding between each new set of events.
     */
    wake<S extends Ecs.System<T>>(system: S, event: T): void {
        this.#events.unshift(event);

        if (this.#event_loop) return;

        const action = (): boolean => {
            const event = this.#events.pop();
            if (event) {
                try {
                    system.run(event);
                } catch (e) {
                    // Prevent uncaught exceptions from killing the drain loop and causing silent wake() failures (GH#43).
                    log.error(`o-tiling: unhandled exception while processing event: ${e}`);
                }
            }

            if (this.#events.length === 0) {
                this.#event_loop = null;
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        };

        // Prefer Meta.Later for Shell extensions to avoid IN_PAINT crashes
        if ((global as any).compositor?.get_laters()) {
            this.#used_laters = true;
            this.#event_loop = Lib.later_add(Meta.LaterType.BEFORE_REDRAW, action);
        } else {
            this.#used_laters = false;
            this.#event_loop = GLib.idle_add(GLib.PRIORITY_DEFAULT, action);
        }
    }

    stop(): void {
        if (this.#event_loop !== null) {
            // Use the matching removal fn: later_remove for laters, source_remove for idle.
            if (this.#used_laters) {
                Lib.later_remove(this.#event_loop);
            } else {
                GLib.source_remove(this.#event_loop);
            }
            this.#event_loop = null;
        }
        this.#events = [];
    }
}

export class OnceExecutor<X, T extends Iterable<X>> {
    #iterable: T;
    #signal: SignalID | null = null;

    constructor(iterable: T) {
        this.#iterable = iterable;
    }

    start(delay: number, apply: (v: X) => boolean, then?: () => void) {
        this.stop();

        const iterator = this.#iterable[Symbol.iterator]();

        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            const next: X = iterator.next().value;

            if (typeof next === 'undefined') {
                if (then) {
                    const id2 = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                        if (this.#signal === id2) {
                            this.#signal = null;
                        }
                        then();
                        return GLib.SOURCE_REMOVE;
                    });
                    this.#signal = id2;
                } else {
                    if (this.#signal === id) {
                        this.#signal = null;
                    }
                }
                return GLib.SOURCE_REMOVE;
            }

            const res = apply(next);
            if (res === GLib.SOURCE_REMOVE) {
                if (this.#signal === id) {
                    this.#signal = null;
                }
            }
            return res;
        });
        this.#signal = id;
    }

    stop() {
        if (this.#signal !== null) {
            GLib.source_remove(this.#signal);
            this.#signal = null;
        }
    }
}

export class ChannelExecutor<X> {
    #channel: Array<X> = [];

    #signal: null | number = null;

    clear() {
        this.#channel.splice(0);
    }

    get length(): number {
        return this.#channel.length;
    }

    send(v: X) {
        this.#channel.push(v);
    }

    start(delay: number, apply: (v: X) => boolean) {
        this.stop();

        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            const e = this.#channel.shift();

            const res = typeof e === 'undefined' ? true : apply(e);
            if (res === GLib.SOURCE_REMOVE) {
                if (this.#signal === id) {
                    this.#signal = null;
                }
            }
            return res;
        });
        this.#signal = id;
    }

    stop() {
        if (this.#signal !== null) {
            GLib.source_remove(this.#signal);
            this.#signal = null;
        }
        this.#channel.splice(0);
    }
}
