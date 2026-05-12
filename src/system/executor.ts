import * as Ecs from '../core/ecs.js';
import * as utils from '../utils/utils.js';
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
            if (event) system.run(event);

            if (this.#events.length === 0) {
                this.#event_loop = null;
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        };

        // Prefer Meta.Later for Shell extensions to avoid IN_PAINT crashes
        if ((global as any).compositor?.get_laters()) {
            this.#used_laters = true;
            this.#event_loop = utils.later_add(Meta.LaterType.BEFORE_REDRAW, action);
        } else {
            this.#used_laters = false;
            this.#event_loop = GLib.idle_add(GLib.PRIORITY_DEFAULT, action);
        }
    }

    stop(): void {
        if (this.#event_loop !== null) {
            // BUG-01 fix: only call the removal function matching how the loop was created.
            // Calling later_remove on a GLib idle source ID (or vice versa) causes SIGABRT.
            if (this.#used_laters) {
                try { utils.later_remove(this.#event_loop); } catch (_) {}
            } else {
                try { GLib.source_remove(this.#event_loop); } catch (_) {}
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

        this.#signal = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            const next: X = iterator.next().value;

            if (typeof next === 'undefined') {
                if (then) {
                    this.#signal = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                        this.#signal = null;
                        then();
                        return GLib.SOURCE_REMOVE;
                    });
                }
                return GLib.SOURCE_REMOVE;
            }

            return apply(next);
        });
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

        this.#signal = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            const e = this.#channel.shift();

            return typeof e === 'undefined' ? true : apply(e);
        });
    }

    stop() {
        if (this.#signal !== null) {
            GLib.source_remove(this.#signal);
            this.#signal = null;
        }
        this.#channel.splice(0);
    }
}
