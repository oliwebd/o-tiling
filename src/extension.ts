import * as Config from './system/config.js';
import * as Forest from './engine/forest.js';
import * as Ecs from './core/ecs.js';
import * as Events from './core/events.js';
import * as Focus from './window/focus.js';
import * as Geom from './utils/geom.js';
import * as GrabOp from './window/grab_op.js';
import * as Keybindings from './system/keybindings.js';
import * as Lib from './utils/lib.js';
import * as log from './utils/log.js';
import * as PanelSettings from './ui/panel_settings.js';
import * as Rect from './utils/rectangle.js';
import * as Settings from './system/settings.js';
import * as Tiling from './engine/tiling.js';
import * as Window from './window/window.js';
import * as auto_tiler from './engine/auto_tiler.js';
import * as node from './engine/node.js';
import * as utils from './utils/utils.js';
import * as add_exception from './ui/dialog_add_exception.js';
import * as Executor from './system/executor.js';
const exec = Executor;
import * as movement from './window/movement.js';
import * as stack from './engine/stack.js';
import { WindowButtonsManager } from './system/window_buttons.js';


import * as dbus_service from './system/dbus_service.js';
import * as scheduler from './system/scheduler.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import type { Entity } from './core/ecs.js';
import type { ExtEvent } from './core/events.js';
import { Rectangle } from './utils/rectangle.js';
import type { Indicator } from './ui/panel_settings.js';
import type { WorkspaceNumberIndicator } from './ui/panel_settings.js';
import { WorkspaceSwitcherStyle, isGnome50 } from './ui/workspace_switcher_style.js';
import { WorkspaceAnimationManager } from './ui/workspace_animation.js';
import type { AnimationStyle } from './ui/workspace_animation.js';
import { WindowAnimationManager } from './ui/window_animation.js';
import type { WindowAnimationStyle } from './ui/window_animation.js';
import { ThemeConsistencyManager } from './ui/theme_consistency/index.js';
import { PanelTransparencyManager } from './ui/panel_transparency.js';
import { OverviewLayoutManager } from './ui/overview_layout.js';
import { applyThemeConsistency, restoreGtkDefaults } from './ui/theme_consistency/apply.js';



import { Fork } from './engine/fork.js';

const display = (global as any).display;
const wim = (global as any).window_manager;
const wom = (global as any).workspace_manager;

const Movement = movement.Movement;

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
// Mtk is available in GNOME 45+; all our supported versions (46-50) have it
import Mtk from 'gi://Mtk';
const { GlobalEvent, WindowEvent } = Events;

export let ext: Ext | null = null;
export let indicator: Indicator | null = null;
export let workspace_number_indicator: WorkspaceNumberIndicator | null = null;
export let quick_settings_indicator: any = null;

const { cursor_rect, is_keyboard_op, is_resize_op, is_move_op } = Lib;
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const {
    layoutManager,
    overview,
    sessionMode,
    windowAttentionHandler,
} = Main;

import { WindowSwitcherPopup } from 'resource:///org/gnome/shell/ui/altTab.js';
import { Workspace } from 'resource:///org/gnome/shell/ui/workspace.js';
// @ts-ignore
import { WorkspaceThumbnail } from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import { WindowPreview } from 'resource:///org/gnome/shell/ui/windowPreview.js';
import { PACKAGE_VERSION } from 'resource:///org/gnome/shell/misc/config.js';
import * as Tags from './utils/tags.js';
import { get_current_path } from './utils/paths.js';

const STYLESHEET_PATH = stylesheet_path('stylesheet');
const STYLESHEET = Gio.File.new_for_path(STYLESHEET_PATH);
const GNOME_VERSION = PACKAGE_VERSION;

interface Display {
    area: Rectangle;
    ws: Rectangle;
}

interface Monitor extends Rectangle {
    index: number;
}

interface Injection {
    object: any;
    method: string;
    func: any;
}

export class Ext extends Ecs.System<ExtEvent> {
    keybindings!: Keybindings.Keybindings; // Mechanism for managing keybindings
    settings!: Settings.ExtensionSettings; // Manage interactions with GSettings

    // Widgets

    overlay!: St.Widget; // An overlay which shows a preview of where a window will be moved
    dbus!: dbus_service.Service; // DBus

    // State



    button: any = null;
    button_gio_icon_auto_on: any = null;
    button_gio_icon_auto_off: any = null;

    conf: Config.Config = new Config.Config();

    conf_watch: null | [any, SignalID] = null;

    column_size: number = 32; // Column sizes in snap-to-grid


    _timeouts: { [key: string]: number | null } = {};

    row_size: number = 32; // Row size in snap-to-grid

    suspended: boolean = false;
    was_locked: boolean = false;
    private _resuming: boolean = false;
    private _signals_attached: boolean = false;
    _ext_soft_disabled: boolean = false; // True when the user has soft-disabled the extension from the panel
    private _focused_signal_connected: boolean = false;
    private _restack_source: number | null = null;
    private _schedule_idle_sources: Set<number> = new Set();
    private _settings_signal_ids: Array<[any, number]> = [];
    private _log_level_cleanup: (() => void) | null = null;


    displays: [number, Map<number, Display>] = [0, new Map()]; // The known display configuration, for tracking monitor removals and changes

    disabled_workspaces: Set<number> = new Set(); // Workspaces where tiling is manually disabled

    dpi: number = St.ThemeContext.get_for_stage(((global as any).stage as any)).scale_factor; // The current scaling factor in GNOME Shell

    drag_signal: null | SignalID = null;

    exception_selecting: boolean = false; // If set, the user is currently selecting a window to add to floating exceptions
    gap_inner: number = 0; // The number of pixels between windows

    gap_inner_half: number = 0; // Exactly half of the value of the inner gap

    gap_inner_prev: number = 0; // Previously-set value of the inner gap

    gap_outer: number = 0; // The number of pixels around a display's work area

    gap_outer_prev: number = 0; // Previously-set value of the outer gap

    /**
     * Effective top-side outer gap. When the panel is fully transparent
     * (panel-transparency enabled AND opacity == 0) this equals the
     * panel-top-gap setting; otherwise it equals gap_outer.
     */
    gap_top: number = 0;

    grab_op: GrabOp.GrabOp | null = null; // Information about a current possible grab operation

    ignore_display_update: boolean = false; // A display config update is triggered on a workspace addition

    injections: Array<Injection> = []; // Functions replaced in GNOME

    prev_focused: [null | Entity, null | Entity] = [null, null]; // The window that was focused before the last window

    init: boolean = true; // Initially set to true when the extension is initializing

    moved_by_mouse: boolean = false; // Set when a window is being moved by the mouse

    private workareas_update: null | SignalID = null;

    private signals: Map<GObject.Object, Array<SignalID>> = new Map(); // Record of misc. global objects and their attached signals

    private workspace_signals: Map<any, Array<SignalID>> = new Map(); // Signals specifically attached to workspaces, for easy cleanup

    private size_requests: Map<GObject.Object, SignalID> = new Map();

    /** Stores windows that were focused on a workspace */
    private workspace_active: Map<number, null | Entity> = new Map();

    // Entity-component associations

    ids: Ecs.Storage<number> = this.register_storage(); // Store for stable sequences of each registered window

    monitors: Ecs.Storage<[number, number]> = this.register_storage(); // Store for keeping track of which monitor + workspace a window is on

    movements: Ecs.Storage<Rect.Rectangle> = this.register_storage(); // Stores movements that have been queued

    names: Ecs.Storage<string> = this.register_storage(); // Store for names associated with windows

    size_changed_signal: SignalID = 0; // Signal ID which handles size-changed signals

    size_signals: Ecs.Storage<SignalID[]> = this.register_storage(); // Store for size-changed signals attached to each window

    snapped: Ecs.Storage<boolean> = this.register_storage(); // Set to true if a window is snapped to the grid

    windows: Ecs.Storage<Window.ShellWindow> = this.register_storage(); // Primary storage for the window entities, containing the actual window

    window_signals: Ecs.Storage<Array<SignalID>> = this.register_storage(); // Signals which have been registered for each window

    // Systems

    auto_tiler: auto_tiler.AutoTiler | null = null; // Manages automatic tiling behaviors in the shell

    workspace_switcher_style_handler: WorkspaceSwitcherStyle | null = null; // Optional workspace-switcher re-style (GNOME 50+ only)
    workspace_animation_handler: WorkspaceAnimationManager | null = null; // Optional static-wallpaper + window-swing animation
    window_animation_handler: WindowAnimationManager = new WindowAnimationManager();

    focus_selector: Focus.FocusSelector = new Focus.FocusSelector(); // Performs focus selections

    tiler: Tiling.Tiler = new Tiling.Tiler(this); // Calculates window placements when tiling and focus-switching



    theme_consistency_handler: ThemeConsistencyManager | null = null; // Manages theme consistency (session injection)

    panel_transparency_handler: PanelTransparencyManager | null = null; // Manages panel transparency CSS injection

    overview_layout_manager: OverviewLayoutManager | null = null; // Manages overview window positioning to match tiling

    window_buttons_manager: WindowButtonsManager | null = null; // Manages window management buttons (min/max/close)


    _indicator_updating: boolean = false;
    _resume_timeout_source: number | null = null;
    _bordered_entity: Entity | null = null;
    private _border_cleanup_pending: boolean = false;
    private _original_focus_change_on_pointer_rest: boolean | null = null;
    private _destroyed: boolean = false;
    private _startup_complete_id: number = 0;
    executor: Executor.GLibExecutor<ExtEvent>;

    constructor() {
        const executor = new Executor.GLibExecutor<ExtEvent>();
        super(executor);
        this.executor = executor;
    }

    register(event: ExtEvent): void {
        super.register(event);
    }

    _first_startup: boolean = true;

    setup() {
        this._first_startup = true;
        this.keybindings = new Keybindings.Keybindings(this);
        this.settings = new Settings.ExtensionSettings();

        // Prevent GNOME Shell Wayland crashes inside focus_on_pointer_rest_callback
        this._original_focus_change_on_pointer_rest = null;
        if (utils.is_wayland() && this.settings.mutter) {
            try {
                const keys = this.settings.mutter.list_keys();
                if (keys.includes('focus-change-on-pointer-rest')) {
                    const original = this.settings.focus_change_on_pointer_rest();
                    if (original) {
                        this._original_focus_change_on_pointer_rest = true;
                        this.settings.set_focus_change_on_pointer_rest(false);
                        log.info('Auto-disabled Mutter focus-change-on-pointer-rest to prevent Wayland compositor crashes');
                    }
                }
            } catch (e) {
                log.error(`Failed to handle focus-change-on-pointer-rest: ${e}`);
            }
        }
        this._log_level_cleanup = log.init_log_level(this.settings.ext);
        this.overlay = new St.BoxLayout({
            style_class: "o-tiling-overlay",
            visible: false,
            reactive: false,
        });
        this.dbus = new dbus_service.Service();

        this.displays[0] = display.get_primary_monitor();

        this.load_settings();
        load_theme();

        this.conf.reload().catch((e: any) => log.error(e));

        if (this.settings.int) {
            const id1 = this.settings.int.connect("changed::gtk-theme", () => {
                this.register(Events.global(GlobalEvent.GtkThemeChanged));
            });
            this._settings_signal_ids.push([this.settings.int, id1]);

            const id2 = this.settings.int.connect("changed::accent-color", () => {
                this.register(Events.global(GlobalEvent.GtkThemeChanged));
            });
            this._settings_signal_ids.push([this.settings.int, id2]);
        }

        if (this.settings.shell) {
            const id3 = this.settings.shell.connect("changed::name", () => {
                this.register(Events.global(GlobalEvent.GtkShellChanged));
            });
            this._settings_signal_ids.push([this.settings.shell, id3]);
        }

        // Workspace switcher style — react to toggle and accent-color changes
        const id_ws_style = this.settings.ext.connect('changed::workspace-switcher-style', () => {
            this.toggle_workspace_switcher_style(this.settings.workspace_switcher_style());
        });
        this._settings_signal_ids.push([this.settings.ext, id_ws_style]);

        const id_ws_accent = this.settings.ext.connect('changed::hint-color-rgba', () => {
            this.workspace_switcher_style_handler?.updateAccentColor(this.settings.hint_color_rgba());
        });
        this._settings_signal_ids.push([this.settings.ext, id_ws_accent]);



        const id_theme_style = this.settings.ext.connect('changed::theme-consistency-style', () => {
            this.toggle_theme_consistency(this.settings.theme_consistency_style());
        });
        this._settings_signal_ids.push([this.settings.ext, id_theme_style]);

        // Panel transparency settings signals
        const id_panel_trans = this.settings.ext.connect('changed::panel-transparency', () => {
            this.toggle_panel_transparency(this.settings.panel_transparency());
            // Recompute top gap when transparency is toggled on/off
            this.on_gap_top();
        });
        this._settings_signal_ids.push([this.settings.ext, id_panel_trans]);

        const id_panel_opacity = this.settings.ext.connect('changed::panel-transparency-opacity', () => {
            this.panel_transparency_handler?.updateOpacity(
                this.settings.panel_transparency_opacity()
            );
            // Recompute top gap — opacity=0 enables the smart top gap
            this.on_gap_top();
        });
        this._settings_signal_ids.push([this.settings.ext, id_panel_opacity]);

        const id_panel_top_gap = this.settings.ext.connect('changed::panel-top-gap', () => {
            this.on_gap_top();
        });
        this._settings_signal_ids.push([this.settings.ext, id_panel_top_gap]);

        const id_ws_num = this.settings.ext.connect('changed::workspace-number-indicator', () => {
            _toggle_workspace_number_indicator(this.settings.workspace_number_indicator());
        });
        this._settings_signal_ids.push([this.settings.ext, id_ws_num]);

        const id_hide_panel = this.settings.ext.connect('changed::hide-panel-icon', () => {
            if (indicator) {
                const sessionMode = (Main as any).sessionMode;
                const isLocked = sessionMode ? sessionMode.isLocked : false;
                indicator.button.visible = !isLocked && !this.settings.hide_panel_icon();
            }
        });
        this._settings_signal_ids.push([this.settings.ext, id_hide_panel]);

        const id_qs_toggle = this.settings.ext.connect('changed::quick-settings-toggle', () => {
            _toggle_quick_settings_indicator(this.settings.quick_settings_toggle());
        });
        this._settings_signal_ids.push([this.settings.ext, id_qs_toggle]);

        // Workspace animation style — static wallpaper + window swing
        const id_ws_anim = this.settings.ext.connect('changed::workspace-animation-style', () => {
            this.toggle_workspace_animation(this.settings.workspace_animation_style() as AnimationStyle);
        });
        this._settings_signal_ids.push([this.settings.ext, id_ws_anim]);

        const id_win_anim = this.settings.ext.connect('changed::window-animation-style', () => {
            this.toggle_window_animation(this.settings.window_animation_style() as WindowAnimationStyle);
        });
        this._settings_signal_ids.push([this.settings.ext, id_win_anim]);

        const id_win_anim_dur = this.settings.ext.connect('changed::window-animation-duration', () => {
            this.window_animation_handler.setDuration(this.settings.window_animation_duration());
        });
        this._settings_signal_ids.push([this.settings.ext, id_win_anim_dur]);

        // Initial application
        this.toggle_workspace_switcher_style(this.settings.workspace_switcher_style(), false);
        this.toggle_workspace_animation(this.settings.workspace_animation_style() as AnimationStyle, false);
        this.window_animation_handler = new WindowAnimationManager(
            this.settings.window_animation_style() as WindowAnimationStyle,
            this.settings.window_animation_duration(),
        );
        this.window_animation_handler.enable();
        this.toggle_theme_consistency(this.settings.theme_consistency_style(), false);
        this.toggle_panel_transparency(this.settings.panel_transparency(), false);



        this.overview_layout_manager = new OverviewLayoutManager(this);
        this.overview_layout_manager.enable();

        this.window_buttons_manager = new WindowButtonsManager(this.settings);
        this.window_buttons_manager.enable();

        if (this.settings.skip_overview()) {
            // Direct skip: try hiding immediately if it's already visible
            if (Main.overview.visible) Main.overview.hide();

            if ((Main.layoutManager as any)._startingUp) {
                // Intercept any show attempts during the rest of the startup process
                const showingId = Main.overview.connect('showing', () => {
                    if ((Main.layoutManager as any)._startingUp) {
                        Main.overview.hide();
                    }
                });

                this._startup_complete_id = Main.layoutManager.connect('startup-complete', () => {
                    // Final hide check in case it managed to show up
                    if (Main.overview.visible) Main.overview.hide();

                    // Cleanup the showing interceptor
                    Main.overview.disconnect(showingId);
                    Main.layoutManager.disconnect(this._startup_complete_id);
                    this._startup_complete_id = 0;
                });
            }
        }

        this.dbus.FocusUp = () => this.focus_up();
        this.dbus.FocusDown = () => this.focus_down();
        this.dbus.FocusLeft = () => this.focus_left();
        this.dbus.FocusRight = () => this.focus_right();
        this.dbus.WindowFocus = (window: [number, number]) => {
            const target_window = this.windows.get(window);
            if (target_window) {
                target_window.activate();
                this.on_focused(target_window);
            }
        };

        this.dbus.WindowHighlight = (window: [number, number]) => {
            const target_window = this.windows.get(window);
            if (target_window) {
                this.on_focused(target_window);
            }
        };

        this.dbus.WindowList = (): Array<[[number, number], string, string, string]> => {
            const wins: Array<[[number, number], string, string, string]> = [];

            for (const window of this.tab_list(Meta.TabList.NORMAL, null)) {
                const string = window.window_app.get_id();
                wins.push([window.entity, window.title(), window.name(this), string ? string : '']);
            }

            return wins;
        };

        this.dbus.WindowQuit = (win: [number, number]) => {
            const target = this.windows.get(win);
            // D-Bus input: caller may reference a window that already closed
            if (target) target.meta.delete(Clutter.get_current_event_time());
        };
    }

    /** Disconnects all tracked meta-window signals (window_signals + size_signals) for
     * an entity and destroys its ShellWindow. Shared by destroy() and ext_soft_disable()
     * so the two teardown paths can't drift out of sync with each other. */
    private teardown_window(entity: Entity) {
        const win = this.windows.get(entity);
        if (!win) return;

        const win_sigs = this.window_signals.get(entity);
        if (win_sigs) {
            for (const sig of win_sigs) {
                if (sig) win.meta.disconnect(sig);
            }
        }

        const size_sigs = this.size_signals.get(entity);
        if (size_sigs) {
            for (const sig of size_sigs) {
                if (sig) win.meta.disconnect(sig);
            }
        }

        win.destroy();
    }

    destroy() {
        this.unset_grab_op();
        this.executor.stop();
        this._destroyed = true;

        if (this._original_focus_change_on_pointer_rest !== null && this.settings.mutter) {
            try {
                this.settings.set_focus_change_on_pointer_rest(this._original_focus_change_on_pointer_rest);
                log.info('Restored Mutter focus-change-on-pointer-rest setting');
            } catch (e) {
                log.error(`Failed to restore focus-change-on-pointer-rest: ${e}`);
            }
            this._original_focus_change_on_pointer_rest = null;
        }


        for (const key of Object.keys(this._timeouts)) {
            const id = this._timeouts[key];
            if (id !== null) {
                utils.source_remove(id);
                this._timeouts[key] = null;
            }
        }

        this.dbus.destroy();
        this.injections_remove();
        this.signals_remove();
        this.exit_modes();
        this.hide_all_borders();
        this.keybindings.disable(this.keybindings.global).disable(this.keybindings.window_focus);

        for (const [obj, id] of this._settings_signal_ids) {
            obj.disconnect(id);
        }
        this._settings_signal_ids = [];

        if (this._log_level_cleanup) {
            this._log_level_cleanup();
            this._log_level_cleanup = null;
        }

        if (this.auto_tiler) {
            this.auto_tiler.destroy(this);
            this.auto_tiler = null;
        }

        if (this.workspace_switcher_style_handler) {
            this.workspace_switcher_style_handler.disable();
            this.workspace_switcher_style_handler = null;
        }

        if (this.workspace_animation_handler) {
            this.workspace_animation_handler.disable();
            this.workspace_animation_handler = null;
        }

        this.window_animation_handler.disable();

        if (this.theme_consistency_handler) {
            this.theme_consistency_handler.disable();
            this.theme_consistency_handler = null;
        }

        if (this.panel_transparency_handler) {
            this.panel_transparency_handler.disable();
            this.panel_transparency_handler = null;
        }

        if (this.overview_layout_manager) {
            this.overview_layout_manager.disable();
            this.overview_layout_manager = null;
        }

        if (this.window_buttons_manager) {
            this.window_buttons_manager.disable();
            this.window_buttons_manager = null;
        }

        const entities = Array.from(this.windows.iter()).map(([e]) => e);
        for (const entity of entities) {
            this.teardown_window(entity);
        }

        // Clean up all generic timeouts tracked in the property map
        for (const id of Object.values(this._timeouts)) {
            utils.source_remove(id);
        }
        this._timeouts = {};

        // Clean up schedule_idle timeout sources
        for (const src of this._schedule_idle_sources) {
            utils.source_remove(src);
        }
        this._schedule_idle_sources.clear();

        // Clean up pending size request timers
        for (const [, src] of this.size_requests) {
            utils.source_remove(src);
        }
        this.size_requests.clear();

        if (this._startup_complete_id) {
            Main.layoutManager.disconnect(this._startup_complete_id);
            this._startup_complete_id = 0;
        }
    }

    // System interface

    /** Registers a generic callback to be executed in the event loop. */
    register_fn(callback: () => void, name?: string) {
        this.register({ tag: 1, callback, name });
    }

    /** Executes an event on the system */
    run(event: ExtEvent) {
        switch (event.tag) {
            /** Callback Event */
            case 1:
                event.callback();
                break;

            /** Window Event */
            case 2:
                const win = event.window;

                /** Validate that the window's actor still exists. */
                if (!win.actor_exists()) return;

                if (event.kind.tag === 1) {
                    const { window } = event;

                    const movement = this.movements.remove(window.entity);
                    if (!movement) return;

                    const actor = window.meta.get_compositor_private();
                    if (!actor) {
                        this.auto_tiler?.detach_window(this, window.entity);
                        return;
                    }

                    const { x, y, width, height } = movement;

                    this.window_animation_handler.applyMove(actor as any, x, y, width, height, () =>
                        window.meta.move_resize_frame(true, x, y, width, height),
                    );

                    this.monitors.insert(window.entity, [win.meta.get_monitor(), win.workspace_id()]);

                    if (win.activate_after_move) {
                        win.activate_after_move = false;
                        win.activate();
                    }

                    return;
                }

                switch (event.kind.event) {
                    case WindowEvent.Maximize:
                        this.unset_grab_op();
                        this.on_maximize(win);
                        break;

                    case WindowEvent.Minimize:
                        this.unset_grab_op();
                        this.on_minimize(win);
                        break;

                    case WindowEvent.Size:
                        if (this.auto_tiler && !win.is_maximized() && !win.meta.is_fullscreen()) {
                            this.auto_tiler.reflow(this, win.entity);
                        }
                        break;

                    case WindowEvent.Workspace:
                        this.on_workspace_changed(win);
                        break;

                    case WindowEvent.Fullscreen:
                        if (this.auto_tiler) {
                            const attachment = this.auto_tiler.attached.get(win.entity);
                            if (attachment) {
                                if (!win.meta.is_fullscreen()) {
                                    const fork = this.auto_tiler.forest.forks.get(win.entity);
                                    if (fork) {
                                        this.auto_tiler.reflow(this, win.entity);
                                    }
                                    if (win.stack !== null) {
                                        this.auto_tiler.forest.stacks.get(win.stack)?.set_visible(true);
                                    }
                                } else {
                                    // window IS now fullscreen — hide its stack tabs
                                    if (win.stack !== null) {
                                        this.auto_tiler.forest.stacks.get(win.stack)?.set_visible(false);
                                    }
                                }
                            }
                        }

                        break;
                }

                break;

            /** Window Create Event */
            case 3:
                const actor = event.window.get_compositor_private() as Clutter.Actor;
                if (!actor) return;

                this.on_window_create(event.window, actor);
                break;

            /** Stateless global events */
            case 4:
                switch (event.event) {
                    case GlobalEvent.GtkShellChanged:
                        this.on_gtk_shell_changed();
                        break;

                    case GlobalEvent.GtkThemeChanged:
                        this.on_gtk_theme_change();
                        break;

                    case GlobalEvent.MonitorsChanged:
                        this.update_display_configuration(false);
                        break;

                    case GlobalEvent.OverviewShown:
                        this.on_overview_shown();
                        break;

                    case GlobalEvent.OverviewHidden:
                        this.on_overview_hidden();
                        break;
                }

                break;
        }
    }

    // Extension methods

    activate_window(window: Window.ShellWindow | null) {
        if (window) {
            window.activate();
        }
    }

    active_monitor(): number {
        return Lib.active_monitor_index();
    }

    active_window_list(): Array<Window.ShellWindow> {
        const workspace = wom.get_active_workspace();
        return this.tab_list(Meta.TabList.NORMAL_ALL, workspace);
    }

    active_workspace(): number {
        return wom.get_active_workspace_index();
    }

    actor_of(entity: Entity): null | Clutter.Actor {
        const window = this.windows.get(entity);
        return window ? window.meta.get_compositor_private() : null;
    }

    /// Connects a callback signal to a GObject, and records the signal.
    connect(object: GObject.Object, property: string, callback: (...args: any) => boolean | void): SignalID {
        const signal = object.connect(property, callback);
        const entry = this.signals.get(object);
        if (entry) {
            entry.push(signal);
        } else {
            this.signals.set(object, [signal]);
        }

        return signal;
    }

    /** Connects a callback signal to a workspace, and records it for later removal. */
    connect_workspace(ws: any, property: string, callback: (...args: any) => boolean | void): SignalID {
        const signal = ws.connect(property, callback);
        const entry = this.workspace_signals.get(ws);
        if (entry) {
            entry.push(signal);
        } else {
            this.workspace_signals.set(ws, [signal]);
        }

        return signal;
    }

    connect_meta(win: Window.ShellWindow, signal: string, callback: (...args: any[]) => void): number {
        const id = win.meta.connect(signal, () => {
            if (win.actor_exists()) callback();
        });

        this.window_signals.get_or(win.entity, () => []).push(id);

        return id;
    }

    connect_size_signal(win: Window.ShellWindow, signal: string, func: () => void): number {
        return this.connect_meta(win, signal, () => {
            if (!this.contains_tag(win.entity, Tags.Blocked)) func();
        });
    }

    connect_window(win: Window.ShellWindow) {
        const size_event = () => {
            if (Window.clutter_focus_is_shell_panel()) return;

            const old = this.size_requests.get(win.meta);

            if (old) {
                utils.source_remove(old);
            }

            const new_s = GLib.timeout_add(GLib.PRIORITY_LOW, 500, () => {
                this.register(Events.window_event(win, WindowEvent.Size));
                if (this.size_requests.get(win.meta) === new_s) {
                    this.size_requests.delete(win.meta);
                }
                return false;
            });

            this.size_requests.set(win.meta, new_s);
        };

        this.connect_meta(win, 'workspace-changed', () => {
            this.register(Events.window_event(win, WindowEvent.Workspace));
        });

        this.size_signals.insert(win.entity, [
            this.connect_size_signal(win, 'size-changed', size_event),

            this.connect_size_signal(win, 'position-changed', size_event),

            this.connect_size_signal(win, 'notify::minimized', () => {
                this.register(Events.window_event(win, WindowEvent.Minimize));
            }),
        ]);
    }

    exception_add(win: Window.ShellWindow) {
        this.exception_selecting = false;
        let d = new add_exception.AddExceptionDialog(
            // Cancel
            () => this.exception_dialog(),
            // this_app
            () => {
                let wmclass = win.meta.get_wm_class();
                if (wmclass !== null && wmclass.length === 0) {
                    wmclass = win.name(this);
                }

                if (wmclass) this.conf.add_app_exception(wmclass);
                this.exception_dialog();
            },
            // current-window
            () => {
                let wmclass = win.meta.get_wm_class();
                if (wmclass) this.conf.add_window_exception(wmclass, win.title());
                this.exception_dialog();
            },
            // Reload the tiling config on dialog close
            () => {
                this.conf.reload().then(() => {
                    this.tiling_config_reapply();
                }).catch((e: any) => log.error(e));
            },
        );
        d.open();
    }

    exception_dialog() {
        let path = get_current_path() + '/floating_exceptions/main.js';

        const event_handler = (event: string): boolean => {
            switch (event) {
                case 'MODIFIED':
                    this.register_fn(() => {
                        this.conf.reload().then(() => {
                            this.tiling_config_reapply();
                        }).catch((e: any) => log.error(e));
                    });
                    break;
                case 'SELECT':
                    this.register_fn(() => this.exception_select());
                    return false;
            }

            return true;
        };

        const ipc = utils.async_process_ipc(['gjs', '--module', path]);

        if (ipc) {
            const generator = (stdout: any, res: any) => {
                try {
                    const [bytes] = stdout.read_line_finish(res);
                    if (bytes) {
                        if (event_handler((new TextDecoder().decode(bytes) as string).trim())) {
                            ipc.stdout.read_line_async(0, ipc.cancellable, generator);
                        }
                    }
                } catch (why) {
                    log.error(`failed to read response from floating exceptions dialog: ${why}`);
                }
            };

            ipc.stdout.read_line_async(0, ipc.cancellable, generator);
        }
    }


    exception_select() {
        if (this._timeouts['exception_select_timeout'] != null) {
            utils.source_remove(this._timeouts['exception_select_timeout']);
        }
        const id = GLib.timeout_add(GLib.PRIORITY_LOW, 500, () => {
            this.exception_selecting = true;
            (Main as any).overview.show();
            if (this._timeouts['exception_select_timeout'] === id) {
                this._timeouts['exception_select_timeout'] = null;
            }
            return false;
        });
        this._timeouts['exception_select_timeout'] = id;
    }

    exit_modes() {
        this.tiler.exit(this);
        this.overlay.visible = false;
    }

    find_monitor_to_retach(width: number, height: number): [number, Display] {
        if (!this.settings.workspaces_only_on_primary()) {
            for (const [index, display] of this.displays[1]) {
                if (display.area.width == width && display.area.height == height) {
                    return [index, display];
                }
            }
        }

        const primary = display.get_primary_monitor();
        return [primary, this.displays[1].get(primary) as Display];
    }

    find_unused_workspace(monitor: number): [number, any] {
        if (!this.auto_tiler) return [0, wom.get_workspace_by_index(0)];

        let id = 0;

        const tiled_windows = new Array<Window.ShellWindow>();

        for (const [window] of this.auto_tiler.attached.iter()) {
            const win = this.windows.get(window);

            if (win && !win.reassignment && win.meta.get_monitor() === monitor) tiled_windows.push(win);
        }

        cancel: while (true) {
            for (const window of tiled_windows) {
                if (window.workspace_id() === id) {
                    id += 1;
                    continue cancel;
                }
            }

            break;
        }

        let new_work;

        if (id + 1 === wom.get_n_workspaces()) {
            id += 1;
            new_work = wom.append_new_workspace(true, Clutter.get_current_event_time());
        } else {
            new_work = wom.get_workspace_by_index(id);
        }

        return [id, new_work];
    }

    focus_left() {
        this.stack_select(
            (id, stack) => (id === 0 ? null : stack.tabs[id - 1].entity),
            () => this.activate_window(this.focus_selector.left(this, null)),
        );
    }

    focus_right() {
        this.stack_select(
            (id, stack) => (stack.tabs.length > id + 1 ? stack.tabs[id + 1].entity : null),
            () => this.activate_window(this.focus_selector.right(this, null)),
        );
    }

    focus_down() {
        this.activate_window(this.focus_selector.down(this, null));
    }

    focus_up() {
        this.activate_window(this.focus_selector.up(this, null));
    }

    focus_window(): Window.ShellWindow | null {
        return this.get_window(display.get_focus_window());
    }

    stack_select(select: (id: number, stack: stack.Stack) => Entity | null, focus_shift: () => void) {
        const switched = this.stack_switch((stack: any) => {
            if (!stack) return false;

            const stack_con = this.auto_tiler?.forest.stacks.get(stack.idx);
            if (stack_con) {
                const id = stack_con.active_id;
                if (id !== -1) {
                    const next = select(id, stack_con);
                    if (next) {
                        stack_con.activate(next);
                        const window = this.windows.get(next);
                        if (window) {
                            window.activate();
                            return true;
                        }
                    }
                }
            }

            return false;
        });

        if (!switched) {
            focus_shift();
        }
    }

    stack_switch(apply: (stack: node.NodeStack) => boolean) {
        const window = this.focus_window();
        if (window) {
            if (this.auto_tiler) {
                const node = this.auto_tiler.find_stack(window.entity);
                return node ? apply(node[1].inner as node.NodeStack) : false;
            }
        }
    }

    /// Fetches the window component from the entity associated with the metacity window metadata.
    get_window(meta: Meta.Window | null): Window.ShellWindow | null {
        const entity = this.window_entity(meta);
        return entity ? this.windows.get(entity) : null;
    }

    inject(object: any, method: string, func: any) {
        const prev = object[method];
        this.injections.push({ object, method, func: prev });
        object[method] = func;
    }

    _unlock_signal_id: number | null = null;

    injections_add() {
        const sessionMode = (Main as any).sessionMode;
        if (sessionMode) {
            this._unlock_signal_id = sessionMode.connect('updated', () => {
                if (indicator) {
                    indicator.button.visible = !sessionMode.isLocked && !this.settings.hide_panel_icon();
                }

                if (sessionMode.isLocked) {
                    this.suspend();
                } else {
                    this.resume();
                }
            });
        }
    }

    injections_remove() {
        if (this._unlock_signal_id !== null) {
            (Main as any).sessionMode.disconnect(this._unlock_signal_id);
            this._unlock_signal_id = null;
        }
        for (const { object, method, func } of this.injections.splice(0)) {
            object[method] = func;
        }
    }

    load_settings() {
        this.set_gap_inner(this.settings.gap_inner());
        this.set_gap_outer(this.settings.gap_outer());
        this.gap_inner_prev = this.gap_inner;
        this.gap_outer_prev = this.gap_outer;

        this.column_size = this.settings.column_size() * this.dpi;
        this.row_size = this.settings.row_size() * this.dpi;

        // Recompute the effective top gap after loading all gap settings
        this.compute_gap_top();
    }

    monitor_work_area(monitor: number): Rectangle {
        const meta = wom.get_active_workspace().get_work_area_for_monitor(monitor);

        return Rect.Rectangle.from_meta(meta as any);
    }

    monitor_area(monitor: number): Rectangle | null {
        const mm = (global as any).backend.get_monitor_manager();
        const lm = mm ? mm.get_logical_monitors().find((m: any) => m.get_number() === monitor) : null;
        const rect = lm ? { x: lm.x, y: lm.y, width: lm.width, height: lm.height } : null;
        return rect ? Rect.Rectangle.from_meta(rect as any) : null;
    }

    on_active_workspace_changed() {
        this.register_fn(() => {
            this.exit_modes();
            this.hide_all_borders(true);
            this.restack();

            // Always update the workspace tiling toggle when switching workspaces
            if (indicator) {
                indicator.update_workspace_tiling_state();
            }

            const activate_window = (window: Window.ShellWindow) => {
                this.on_focused(window);
                window.activate(true);
                this.prev_focused = [null, window.entity];
            };

            const focused = this.focus_window();
            if (focused && focused.same_workspace()) {
                activate_window(focused);
                return;
            }

            // Activate the last-active window on workspace.
            const workspace_id = this.active_workspace();
            const active = this.workspace_active.get(workspace_id);
            if (active) {
                const win = this.windows.get(active);
                if (win && win.actor_exists() && win.same_workspace()) {
                    activate_window(win);
                    return;
                }
            }

            // If window was not found, activate the first window on workspace.
            const workspace = wom.get_workspace_by_index(workspace_id);
            if (workspace) {
                for (const win of workspace.list_windows()) {
                    const window = this.get_window(win);
                    if (window && !window.meta.minimized) {
                        activate_window(window);
                        return;
                    }
                }
            }
        });
    }

    is_workspace_tiled(id: number): boolean {
        return !this.disabled_workspaces.has(id);
    }

    workspace_tiling_set(id: number, tiled: boolean) {
        if (tiled) {
            this.disabled_workspaces.delete(id);
            if (this.auto_tiler) {
                for (const window of this.windows.values()) {
                    if (window.workspace_id() === id && window.is_tilable(this)) {
                        if (!this.auto_tiler.attached.contains(window.entity)) {
                            this.auto_tiler.auto_tile(this, window);
                        }
                    }
                }
            }
        } else {
            this.disabled_workspaces.add(id);
            if (this.auto_tiler) {
                for (const window of this.windows.values()) {
                    if (window.workspace_id() === id) {
                        this.auto_tiler.detach_window(this, window.entity);
                    }
                }
            }
        }

        if (indicator) {
            indicator.update_workspace_tiling_state();
        }
    }

    on_destroy(win: Entity) {
        // Exit tiling adjustment mode on window destroy.
        if (this.tiler.window !== null && win == this.tiler.window) this.tiler.exit(this);

        const [prev_a, prev_b] = this.prev_focused;

        if (prev_a && Ecs.entity_eq(win, prev_a)) {
            this.prev_focused[0] = null;
        } else if (prev_b && Ecs.entity_eq(win, prev_b)) {
            this.prev_focused[1] = this.prev_focused[0];
            this.prev_focused[0] = null;
        }

        const window = this.windows.get(win);
        if (!window) return;

        const old_size_request = this.size_requests.get(window.meta);
        if (old_size_request) {
            utils.source_remove(old_size_request);
            this.size_requests.delete(window.meta);
        }

        const stack = window.stack;


        this.window_signals.take_with(win, (signals) => {
            for (const signal of signals) {
                if (window.meta && signal) {
                    try {
                        window.meta.disconnect(signal);
                    } catch (e) {
                        log.warn(`Failed to disconnect window signal in untrack: ${e}`);
                    }
                }
            }
        });

        window.destroy();

        if (this.auto_tiler) {
            const entity = this.auto_tiler.attached.get(win);
            if (entity) {
                const fork = this.auto_tiler.forest.forks.get(entity);
                if (fork?.right?.is_window(win)) {
                    const entity = fork.right.inner.kind === 3 ? fork.right.inner.entities[0] : fork.right.inner.entity;

                    this.windows.with(entity, (sibling) => sibling.activate());
                }
            }
        }

        if (this.auto_tiler) this.auto_tiler.detach_window(this, win);

        // If the destroyed window was in a stack, ensure the next focused window comes from that same stack.
        if (this.auto_tiler && stack !== null) {
            const stack_object = this.auto_tiler.forest.stacks.get(stack);
            const prev = this.prev_focused[1];
            if (stack_object && prev) {
                const prev_window = this.windows.get(prev);
                if (prev_window) {
                    if (prev_window.stack !== stack) {
                        stack_object.auto_activate();
                        this.prev_focused = [null, stack_object.active];
                        this.windows.get(stack_object.active)?.activate();
                    }
                }
            }
        }

        this.movements.remove(win);
        this.windows.remove(win);
        this.delete_entity(win);
    }

    on_display_move(_from_id: number, _to_id: number) {
        if (!this.auto_tiler) return;
    }

    /** Triggered when a window has been focused */
    on_focused(win: Window.ShellWindow) {
        this.workspace_active.set(this.active_workspace(), win.entity);
        scheduler.setForeground(win.meta);

        this.size_signals_unblock(win);

        if (this.exception_selecting) {
            this.exception_add(win);
        }

        // Track history of focused windows, but do not permit duplicates.
        if (this.prev_focused[1] !== win.entity) {
            this.prev_focused[0] = this.prev_focused[1];
            this.prev_focused[1] = win.entity;
        }

        // Update the active tab in the stack.
        if (this.auto_tiler !== null && win.stack !== null) {
            this.auto_tiler.forest.stacks.get(win.stack)?.activate(win.entity);
        }

        this.unmaximize_workspace(win);

        this.show_border_on_focused();

        if (this.auto_tiler && win.is_tilable(this) && this.prev_focused[0] !== null) {
            const prev = this.windows.get(this.prev_focused[0]);
            const is_attached = this.auto_tiler.attached.contains(this.prev_focused[0]);

            if (
                prev &&
                prev !== win &&
                is_attached &&
                prev.actor_exists() &&
                prev.name(this) !== win.name(this) &&
                prev.workspace_id() === win.workspace_id()
            ) {
                if (prev.rect().contains(win.rect())) {
                    if (prev.is_maximized()) {
                        Lib.unmaximize(prev.meta);
                    }
                } else if (prev.stack) {
                    Lib.unmaximize(prev.meta);
                    this.auto_tiler.forest.stacks.get(prev.stack)?.restack();
                }
            }
        }

        if (this.conf.log_on_focus) {
            win.cmdline().then((cmd: any) => {
                let msg =
                    `focused Window(${win.entity}) {\n` +
                    `  class: "${win.meta.get_wm_class()}",\n` +
                    `  cmdline: ${cmd},\n` +
                    `  monitor: ${win.meta.get_monitor()},\n` +
                    `  name: ${win.name(this)},\n` +
                    `  rect: ${win.rect().fmt()},\n` +
                    `  workspace: ${win.workspace_id()},\n` +
                    `  xid: ${win.xid()},\n` +
                    `  stack: ${win.stack},\n`;

                if (this.auto_tiler) {
                    msg += `  fork: (${this.auto_tiler.attached.get(win.entity)}),\n`;
                }

                log.debug(msg + '}');
            });
        }
    }

    on_tile_attach(entity: Entity, window: Entity) {
        if (this.auto_tiler) {
            if (!this.auto_tiler.attached.contains(window)) {
                this.windows.with(window, (w) => {
                    if (w.prev_rect === null) {
                        w.prev_rect = Rectangle.from_meta(w.meta.get_frame_rect());
                    }
                });
            }

            this.auto_tiler.attached.insert(window, entity);
        }
    }

    on_tile_detach(win: Entity) {
        this.windows.with(win, (window) => {
            if (window.prev_rect && !window.ignore_detach) {
                this.register(Events.window_move(this, window, window.prev_rect));
                window.prev_rect = null;
            }
        });
    }

    show_border_on_focused() {
        const overlay_all = this.settings.active_hint_overlay_all_windows();
        if (overlay_all) {
            for (const window of this.windows.values()) {
                if (window.same_workspace()) {
                    window.show_border();
                } else {
                    window.hide_border();
                }
            }
            this._bordered_entity = this.focus_window()?.entity ?? null;
        } else {
            const focus = this.focus_window();

            // No focused window but a shell panel/popup holds key-focus — preserve existing border.
            if (!focus && Window.clutter_focus_is_shell_panel()) {
                return;
            }

            // Same window already bordered, or panel hover with an active border — skip redraw.
            if (focus && this._bordered_entity === focus.entity) {
                const b = focus.border;
                if (b && b.visible) return;
            }
            if (focus && Window.clutter_focus_is_shell_panel() &&
                this._bordered_entity !== null) {
                return;
            }

            this.hide_all_borders();
            if (focus && focus.same_workspace()) {
                focus.show_border();
                this._bordered_entity = focus.entity;
            }
        }
    }

    hide_all_borders(instant: boolean = false) {
        for (const window of this.windows.values()) {
            window.hide_border();
        }
        this._bordered_entity = null;
        Window.cleanup_main_loop_sources();
    }

    maximized_on_active_display(): boolean {
        const aws = this.workspace_id();
        for (const window of this.windows.values()) {
            if (!window.actor_exists()) continue;

            const wws = this.workspace_id(window);
            if (aws[0] === wws[0] && aws[1] === wws[1]) {
                if (window.is_maximized()) return true;
            }
        }

        return false;
    }

    on_gap_inner() {
        const current = this.settings.gap_inner();
        this.set_gap_inner(current);
        const prev_gap = this.gap_inner_prev / 4 / this.dpi;

        if (current != prev_gap) {
            this.update_inner_gap();
        }
    }

    update_inner_gap() {
        if (this.auto_tiler) {
            for (const [entity] of this.auto_tiler.forest.toplevel.values()) {
                const fork = this.auto_tiler.forest.forks.get(entity);
                if (fork) {
                    this.auto_tiler.tile(this, fork, fork.area);
                }
            }
        } else {
            this.update_snapped();
        }
    }

    /** Unmaximize any maximized windows on the same workspace. */
    unmaximize_workspace(win: Window.ShellWindow) {
        if (this.auto_tiler) {
            let mon;
            let work;

            if (!win.is_tilable(this)) {
                return;
            }

            mon = win.meta.get_monitor();
            work = win.meta.get_workspace().index();

            for (const [, compare] of this.windows.iter()) {
                const is_same_space =
                    compare.meta.get_monitor() === mon && compare.meta.get_workspace().index() === work;

                if (
                    is_same_space &&
                    !this.contains_tag(compare.entity, Tags.Floating) &&
                    compare.is_maximized() &&
                    win.entity[0] !== compare.entity[0]
                ) {
                    Lib.unmaximize(compare.meta);
                }
            }
        }
    }

    on_gap_outer() {
        const current = this.settings.gap_outer();
        this.set_gap_outer(current);

        const prev_gap = this.gap_outer_prev / 4 / this.dpi;
        const diff = current - prev_gap;

        if (diff != 0) {
            this.set_gap_outer(current);
            this.compute_gap_top();
            this.update_outer_gap(diff);
        }
    }

    /** Recompute gap_top based on panel transparency state */
    compute_gap_top() {
        const is_fully_transparent = this.settings.panel_transparency()
            && this.settings.panel_transparency_opacity() === 0;
        if (is_fully_transparent) {
            this.gap_top = this.settings.panel_top_gap() * 4 * this.dpi;
        } else {
            this.gap_top = this.gap_outer;
        }
    }

    /** Called when panel-top-gap setting changes */
    on_gap_top() {
        const was = this.gap_top;
        this.compute_gap_top();
        const diff_top = (this.gap_top - was) / 4 / this.dpi;
        if (diff_top !== 0) {
            this.update_top_gap(diff_top);
        }
    }

    /** Re-tile all toplevel forks to apply a changed top-side gap */
    update_top_gap(_diff: number) {
        if (this.auto_tiler) {
            for (const [entity] of this.auto_tiler.forest.toplevel.values()) {
                const fork = this.auto_tiler.forest.forks.get(entity);
                if (fork) {
                    this.auto_tiler.update_toplevel(
                        this, fork, fork.monitor, this.settings.smart_gaps()
                    );
                }
            }
        }
    }

    update_outer_gap(diff: number) {
        if (this.auto_tiler) {
            for (const [entity] of this.auto_tiler.forest.toplevel.values()) {
                const fork = this.auto_tiler.forest.forks.get(entity);

                if (fork) {
                    fork.area.array[0] += diff * 4;
                    fork.area.array[1] += diff * 4;
                    fork.area.array[2] -= diff * 8;
                    fork.area.array[3] -= diff * 8;

                    this.auto_tiler.tile(this, fork, fork.area);
                }
            }
        } else {
            this.update_snapped();
        }
    }

    /** Triggered when a grab operation has been ended */
    on_grab_end(meta: Meta.Window, op?: any, drop_cursor?: Rect.Rectangle) {
        // Guard: Skip if grab_op is null on a non-overview drag to prevent handling a double-fired drop.
        if (this.grab_op === null && op !== undefined) {
            return;
        }

        // Capture cursor NOW, before any deferred execution moves it.
        if (!drop_cursor) {
            drop_cursor = cursor_rect();
        }

        const win = this.get_window(meta);

        if (win !== null) {
            win.grab = false;
        }

        if (null === win || (!win.is_tilable(this) && !win.is_eligible_for_tiling(this))) {
            this.unset_grab_op();
            return;
        }

        this.on_grab_end_(win, op, drop_cursor);
        this.unset_grab_op();
    }

    on_grab_end_(win: Window.ShellWindow, op?: any, drop_cursor?: Rect.Rectangle) {
        this.moved_by_mouse = true;
        this.size_signals_unblock(win);

        if (win.meta && win.meta.minimized) {
            this.on_minimize(win);
            return;
        }

        if (win.is_maximized()) {
            return;
        }

        const grab_op = this.grab_op;

        if (this.auto_tiler && op === undefined) {
            const is_floating = this.contains_tag(win.entity, Tags.Floating);
            const mon = this.monitors.get(win.entity);
            if (mon) {
                const rect = win.meta.get_work_area_for_monitor(mon[0]);
                const drop_cur = drop_cursor ?? cursor_rect();
                if (rect && Rect.Rectangle.from_meta(rect as any).contains(drop_cur)) {
                    if (is_floating) {
                        if (this.settings.snap_to_grid()) {
                            this.tiler.snap(this, win);
                        }
                    } else {
                        this.auto_tiler.reflow(this, win.entity);
                    }
                } else {
                    this.auto_tiler.on_drop(this, win, true, drop_cursor);
                }
            }

            return;
        }

        if (!(grab_op && Ecs.entity_eq(grab_op.entity, win.entity))) {
            log.error(`grabbed entity is not the same as the one that was dropped`);
            return;
        }

        if (this.auto_tiler) {
            const crect = win.rect();
            const rect = grab_op.rect;
            const is_floating = this.contains_tag(win.entity, Tags.Floating);

            if (is_move_op(op)) {
                const cmon = win.meta.get_monitor();
                const prev_mon = this.monitors.get(win.entity);
                const mon_drop = prev_mon ? prev_mon[0] !== cmon : false;

                this.monitors.insert(win.entity, [win.meta.get_monitor(), win.workspace_id()]);

                if (rect.x != crect.x || rect.y != crect.y) {
                    if (rect.contains(drop_cursor ?? cursor_rect())) {
                        if (this.auto_tiler.attached.contains(win.entity)) {
                            this.auto_tiler.on_drop(this, win, mon_drop, drop_cursor);
                        } else if (is_floating) {
                            if (this.settings.snap_to_grid()) {
                                this.tiler.snap(this, win);
                            }
                        } else {
                            this.auto_tiler.reflow(this, win.entity);
                        }
                    } else {
                        this.auto_tiler.on_drop(this, win, mon_drop, drop_cursor);
                    }
                }
            } else {
                const fork_entity = this.auto_tiler.attached.get(win.entity);
                if (fork_entity) {
                    const forest = this.auto_tiler.forest;
                    const fork = forest.forks.get(fork_entity);
                    if (fork) {
                        if (win.stack) {
                            const tab_dimension = this.dpi * stack.TAB_HEIGHT;
                            crect.height += tab_dimension;
                            crect.y -= tab_dimension;
                        }

                        const top_level = forest.find_toplevel(this.workspace_id());
                        if (top_level) {
                            crect.clamp((forest.forks.get(top_level) as Fork).area);
                        }

                        const movement = grab_op.operation(crect);

                        if (this.movement_is_valid(win, movement)) {
                            forest.resize(this, fork_entity, fork, win.entity, movement, crect);
                            forest.arrange(this, fork.workspace);
                        } else {
                            forest.tile(this, fork, fork.area);
                        }
                    } else {
                        log.error(`no fork component found`);
                    }
                } else if (is_floating && this.settings.snap_to_grid()) {
                    this.tiler.snap(this, win);
                } else {
                    if (!this.auto_tiler) log.debug('on_grab_end_: no fork entity for ' + win.name(this));
                }
            }
        } else if (this.settings.snap_to_grid()) {
            this.tiler.snap(this, win);
        }
    }

    previously_focused(active: Window.ShellWindow): null | Ecs.Entity {
        for (const id of [1, 0]) {
            const prev = this.prev_focused[id];
            if (prev && !Ecs.entity_eq(active.entity, prev)) {
                return prev;
            }
        }

        return null;
    }

    movement_is_valid(win: Window.ShellWindow, movement: movement.Movement) {
        if ((movement & Movement.SHRINK) !== 0) {
            if ((movement & Movement.DOWN) !== 0) {
                const w = this.focus_selector.up(this, win);
                if (!w) return false;
                const r = w.rect();
                if (r.y + r.height > win.rect().y) return false;
            } else if ((movement & Movement.UP) !== 0) {
                const w = this.focus_selector.down(this, win);
                if (!w) return false;
                const r = w.rect();
                if (r.y + r.height < win.rect().y) return false;
            } else if ((movement & Movement.LEFT) !== 0) {
                const w = this.focus_selector.right(this, win);
                if (!w) return false;
                const r = w.rect();
                if (r.x + r.width < win.rect().x) return false;
            } else if ((movement & Movement.RIGHT) !== 0) {
                const w = this.focus_selector.left(this, win);
                if (!w) return false;
                const r = w.rect();
                if (r.x + r.width > win.rect().x) return false;
            }
        }

        return true;
    }

    workspace_window_move(win: Window.ShellWindow, prev_monitor: number, next_monitor: number) {
        const prev_area = win.meta.get_work_area_for_monitor(prev_monitor);
        const next_area = win.meta.get_work_area_for_monitor(next_monitor);

        if (prev_area && next_area && prev_area.width > 0 && prev_area.height > 0) {
            // get the current window rect
            const rect = win.rect();

            let h_ratio: number = 1;
            let w_ratio: number = 1;

            h_ratio = next_area.height / prev_area.height;
            rect.height = rect.height * h_ratio;

            w_ratio = next_area.width / prev_area.width;
            rect.width = rect.width * w_ratio;

            if (next_area.x < prev_area.x) {
                rect.x = ((next_area.x + rect.x - prev_area.x) / prev_area.width) * next_area.width;
            } else if (next_area.x > prev_area.x) {
                rect.x = (rect.x / prev_area.width) * next_area.width + next_area.x;
            }

            if (next_area.y < prev_area.y) {
                rect.y = ((next_area.y + rect.y - prev_area.y) / prev_area.height) * next_area.height;
            } else if (next_area.y > prev_area.y) {
                rect.y = (rect.y / prev_area.height) * next_area.height + next_area.y;
            }

            if (this.auto_tiler) {
                if (this.is_floating(win)) {
                    Lib.unmaximize(win.meta);
                }

                this.register(Events.window_move(this, win, rect));
            } else {
                win.move(this, rect, () => { });
                // if the resulting dimensions of rect == next
                if (rect.width == next_area.width && rect.height == next_area.height) {
                    Lib.maximize(win.meta);
                }
            }
        }
    }

    move_monitor(direction: Meta.DisplayDirection) {
        const win = this.focus_window();
        if (!win) return;

        const prev_monitor = win.meta.get_monitor();
        const next_monitor = Tiling.locate_monitor(win, direction);

        if (next_monitor !== null) {
            if (this.auto_tiler && !this.is_floating(win)) {
                win.ignore_detach = true;
                this.auto_tiler.detach_window(this, win.entity);
                this.auto_tiler.attach_to_workspace(this, win, [next_monitor[0], win.workspace_id()]);
            } else {
                this.workspace_window_move(win, prev_monitor, next_monitor[0]);
            }
        }

        win.activate_after_move = true;
    }

    /** Moves the focused window across workspaces and displays */
    move_workspace(direction: Meta.DisplayDirection) {
        const win = this.focus_window();
        if (!win) return;

        /** Move a window between workspaces */
        const workspace_move = (direction: Meta.MotionDirection) => {
            const ws = win.meta.get_workspace();
            let neighbor = ws.get_neighbor(direction);

            const last_window = (): boolean => {
                const last = wom.get_n_workspaces() - 2 === ws.index() && ws.n_windows === 1;
                return last;
            };

            /** Places window onto the nearest window of a given workspace */
            const place_on_nearest_window = (auto_tiler: auto_tiler.AutoTiler, ws: Meta.Workspace, monitor: number) => {
                const src = win.meta.get_frame_rect();

                auto_tiler.detach_window(this, win.entity);

                const index = ws.index();
                const coord: [number, number] = [src.x, src.y];

                let nearest_window = null;
                let nearest_distance = null;

                for (const [entity, window] of this.windows.iter()) {
                    const other_monitor = window.meta.get_monitor();
                    const other_index = window.meta.get_workspace().index();
                    if (
                        !this.contains_tag(entity, Tags.Floating) &&
                        other_monitor == monitor &&
                        other_index === index &&
                        !Ecs.entity_eq(win.entity, window.entity)
                    ) {
                        const other_rect = window.rect();
                        const other_coord: [number, number] = [other_rect.x, other_rect.y];
                        const distance = Geom.distance(coord, other_coord);
                        if (nearest_distance === null || nearest_distance > distance) {
                            nearest_window = window;
                            nearest_distance = distance;
                        }
                    }
                }

                if (nearest_window === null) {
                    auto_tiler.attach_to_workspace(this, win, [monitor, index]);
                } else {
                    auto_tiler.attach_to_window(this, nearest_window, win, { src }, false);
                }
            };

            const move_to_neighbor = (neighbor: Meta.Workspace) => {
                const monitor = win.meta.get_monitor();
                if (this.auto_tiler && win.is_tilable(this)) {
                    win.ignore_detach = true;

                    place_on_nearest_window(this.auto_tiler, neighbor, monitor);

                    if (win.meta.minimized) {
                        this.size_signals_block(win);
                        win.meta.change_workspace_by_index(neighbor.index(), false);
                        this.size_signals_unblock(win);
                    }
                } else {
                    this.workspace_window_move(win, monitor, monitor);
                }

                this.workspace_active.set(neighbor.index(), win.entity);

                win.activate_after_move = true;
            };

            if (neighbor && neighbor.index() !== ws.index()) {
                move_to_neighbor(neighbor);
            } else if (direction === Meta.MotionDirection.DOWN && !last_window()) {
                if (this.settings.dynamic_workspaces()) {
                    neighbor = wom.append_new_workspace(false, Clutter.get_current_event_time());
                } else {
                    return;
                }
            } else if (direction === Meta.MotionDirection.UP && ws.index() === 0) {
                if (this.settings.dynamic_workspaces()) {
                    // Add a new workspace, to push everyone to free up the first one
                    wom.append_new_workspace(false, Clutter.get_current_event_time());

                    // Move everything one workspace down
                    this.on_workspace_modify(
                        () => true,
                        (current) => current + 1,
                        true,
                    );

                    neighbor = wom.get_workspace_by_index(0) as any;

                    if (!neighbor) return;

                    move_to_neighbor(neighbor);
                } else {
                    return;
                }
            } else {
                return;
            }

            this.size_signals_block(win);
            win.meta.change_workspace_by_index(neighbor.index(), true);
            neighbor.activate_with_focus(win.meta, Clutter.get_current_event_time());
            this.size_signals_unblock(win);
        };

        switch (direction) {
            case Meta.DisplayDirection.DOWN:
                workspace_move(Meta.MotionDirection.DOWN);
                break;

            case Meta.DisplayDirection.UP:
                workspace_move(Meta.MotionDirection.UP);
                break;
        }

        if (this.auto_tiler) this.restack();
    }

    /** Triggered when a grab operation has been started */
    on_grab_start(meta: null | Meta.Window, op: any) {
        if (!meta) return;
        const win = this.get_window(meta);
        if (win) {
            win.grab = true;

            if (win.is_tilable(this)) {
                const entity = win.entity;
                const rect = win.rect();

                this.unset_grab_op();

                this.grab_op = new GrabOp.GrabOp(entity, rect);

                this.size_signals_block(win);

                /** Display an overlay indicating where the window will be placed if dropped */

                if (overview.visible || !win || is_keyboard_op(op) || is_resize_op(op)) return;

                const workspace = this.active_workspace();

                this._timeouts['drag_signal'] = GLib.timeout_add(GLib.PRIORITY_LOW, 200, () => {
                    this.overlay.visible = false;

                    if (!win || !this.auto_tiler || !this.grab_op || this.grab_op.entity !== entity) {
                        this._timeouts['drag_signal'] = null;
                        return false;
                    }

                    const [cursor, monitor] = this.cursor_status();

                    let attach_to = null;
                    for (const found of this.windows_at_pointer(cursor, monitor, workspace)) {
                        if (found != win && this.auto_tiler.attached.contains(found.entity)) {
                            attach_to = found;
                            break;
                        }
                    }

                    const fork = this.auto_tiler.get_parent_fork(entity);
                    if (!fork) return true;

                    const windowless = this.auto_tiler.largest_on_workspace(this, monitor, workspace) === null;

                    if (attach_to === null) {
                        if (fork.left.inner.kind === 2 && fork.right?.inner.kind === 2) {
                            const attaching = fork.left.is_window(entity)
                                ? fork.right.inner.entity
                                : fork.left.inner.entity;

                            attach_to = this.windows.get(attaching);
                        }
                    }

                    let area, monitor_attachment;

                    if (windowless) {
                        [area, monitor_attachment] = [this.monitor_work_area(monitor), true];
                        area.x += this.gap_outer;
                        area.y += this.gap_top;
                        area.width -= this.gap_outer * 2;
                        area.height -= this.gap_outer + this.gap_top;
                    } else if (attach_to) {
                        const is_sibling = this.auto_tiler.windows_are_siblings(entity, attach_to.entity);

                        [area, monitor_attachment] =
                            (win.stack === null && attach_to.stack === null && is_sibling) ||
                                (win.stack === null && is_sibling)
                                ? [fork.area, false]
                                : [attach_to.meta.get_frame_rect(), false];
                    } else {
                        return true;
                    }

                    const result = monitor_attachment ? null : auto_tiler.cursor_placement(this, area, cursor);

                    if (!result) {
                        this.overlay.x = area.x;
                        this.overlay.y = area.y;
                        this.overlay.width = area.width;
                        this.overlay.height = area.height;

                        this.overlay.visible = true;

                        return true;
                    }

                    const { orientation, swap } = result;

                    const is_snap = this.settings.snap_to_grid();
                    const grid_w = this.column_size;
                    const grid_h = this.row_size;

                    let half_width = area.width / 2;
                    let half_height = area.height / 2;

                    if (is_snap) {
                        half_width = Lib.round_increment(half_width, grid_w);
                        half_height = Lib.round_increment(half_height, grid_h);
                    }

                    const new_area: [number, number, number, number] =
                        orientation === Lib.Orientation.HORIZONTAL
                            ? swap
                                ? [area.x, area.y, half_width, area.height]
                                : [area.x + area.width - half_width, area.y, half_width, area.height]
                            : swap
                                ? [area.x, area.y, area.width, half_height]
                                : [area.x, area.y + area.height - half_height, area.width, half_height];

                    this.overlay.x = new_area[0];
                    this.overlay.y = new_area[1];
                    this.overlay.width = new_area[2];
                    this.overlay.height = new_area[3];

                    this.overlay.visible = true;

                    return true;
                });
            }
        }
    }

    on_gtk_shell_changed() {
        load_theme();
    }

    on_gtk_theme_change() {
        load_theme();
    }

    /** Handle window maximization notifications */
    on_maximize(win: Window.ShellWindow) {
        if (win.is_maximized()) {
            // Raise maximized to top so stacks won't appear over them.
            const actor = win.meta.get_compositor_private();
            if (actor) (global as any).window_group.set_child_above_sibling(actor as any, null);

            this.on_monitor_changed(win, (_cfrom, cto, workspace) => {
                if (win) {
                    win.ignore_detach = true;
                    this.monitors.insert(win.entity, [cto, workspace]);
                    this.auto_tiler?.detach_window(this, win.entity);
                }
            });
        } else {
            // Retile on unmaximize after waiting for other events to complete, such as animations
            this.register_fn(() => {
                if (this.auto_tiler) {
                    const fork_ent = this.auto_tiler.attached.get(win.entity);
                    if (fork_ent) {
                        const fork = this.auto_tiler.forest.forks.get(fork_ent);
                        if (fork) this.auto_tiler.tile(this, fork, fork.area);
                    } else if (
                        win.is_tilable(this) &&
                        !this.contains_tag(win.entity, Tags.Floating) &&
                        this.is_workspace_tiled(win.workspace_id())
                    ) {
                        // Window was detached during maximize — re-tile it
                        this.auto_tiler.auto_tile(this, win, false);
                    }
                }
            });
        }
    }

    /** Handle window minimization notifications */
    on_minimize(win: Window.ShellWindow) {
        if (this.focus_window() == win && this.settings.active_hint()) {
            if (win.meta.minimized) {
                win.hide_border();
            } else {
                this.show_border_on_focused();
            }
        }

        if (this.auto_tiler) {
            if (win.meta.minimized) {
                const attached = this.auto_tiler.attached.get(win.entity);
                if (!attached) return;

                const fork = this.auto_tiler.forest.forks.get(attached);
                if (!fork) return;

                let attachment: boolean | number;
                if (win.stack !== null) {
                    attachment = win.stack;
                } else {
                    attachment = fork.left.is_window(win.entity);
                }

                win.was_attached_to = [attached, attachment];
                this.auto_tiler.detach_window(this, win.entity);
            } else if (!this.contains_tag(win.entity, Tags.Floating)) {
                if (win.was_attached_to) {
                    const [entity, attachment] = win.was_attached_to;
                    delete win.was_attached_to;

                    const tiler = this.auto_tiler;

                    const fork = tiler.forest.forks.get(entity);
                    if (fork) {
                        if (typeof attachment === 'boolean') {
                            tiler.forest.attach_fork(this, fork, win.entity, attachment);
                            tiler.tile(this, fork, fork.area);
                            return;
                        } else {
                            const stack = tiler.forest.stacks.get(attachment);
                            if (stack) {
                                const stack_info = tiler.find_stack(stack.active);
                                if (stack_info) {
                                    const node = stack_info[1].inner as node.NodeStack;

                                    win.stack = attachment;
                                    node.entities.push(win.entity);
                                    tiler.update_stack(this, node);
                                    tiler.forest.on_attach(fork.entity, win.entity);
                                    stack.activate(win.entity);
                                    tiler.tile(this, fork, fork.area);
                                    return;
                                }
                            }
                        }
                    }
                }

                this.auto_tiler.auto_tile(this, win, false);
            }
        }
    }

    /** Handles the event of a window moving from one monitor to another. */
    on_monitor_changed(
        win: Window.ShellWindow,
        func: (exp_mon: null | number, act_mon: number, act_work: number) => void,
    ) {
        const actual_monitor = win.meta.get_monitor();
        const actual_workspace = win.workspace_id();
        const monitor = this.monitors.get(win.entity);

        if (monitor) {
            const [expected_monitor, expected_workspace] = monitor;
            if (expected_monitor != actual_monitor || actual_workspace != expected_workspace) {
                func(expected_monitor, actual_monitor, actual_workspace);
            }
        } else {
            func(null, actual_monitor, actual_workspace);
        }
    }

    on_overview_shown() {
        this.exit_modes();
        this.unset_grab_op();
    }

    on_overview_hidden() {
        // Restore prev_focused so first-frame handler tiles the next window correctly.
        if (this.auto_tiler) {
            const ws_id = this.active_workspace();
            const mon = this.active_monitor();
            const entity = this.workspace_active.get(ws_id);
            if (entity) {
                const win = this.windows.get(entity);
                if (win && win.is_tilable(this) && this.auto_tiler.attached.contains(entity)) {
                    // Rehydrate prev_focused so fetch_mode() will find it.
                    if (this.prev_focused[1] !== entity) {
                        this.prev_focused[0] = this.prev_focused[1];
                        this.prev_focused[1] = entity;
                    }
                }
            }
        }
    }

    on_show_window_titles() {
        const show_title = this.settings.show_title();


        for (const window of this.windows.values()) {
            if (window.is_client_decorated()) continue;

            if (show_title) {
                window.decoration_show(this);
            } else {
                window.decoration_hide(this);
            }
        }
    }

    on_smart_gap() {
        if (this.auto_tiler) {
            const smart_gaps = this.settings.smart_gaps();
            for (const [entity, [mon]] of this.auto_tiler.forest.toplevel.values()) {
                const node = this.auto_tiler.forest.forks.get(entity);
                if (node?.right === null) {
                    this.auto_tiler.update_toplevel(this, node, mon, smart_gaps);
                }
            }
        }
    }

    on_window_create(window: Meta.Window, actor: Clutter.Actor) {
        const win = this.get_window(window);
        if (win) {
            const entity = win.entity;



            actor.connect('destroy', () => {
                this.on_destroy(entity);

                return false;
            });

            if (win.is_tilable(this)) {
                this.connect_window(win);
            }
        }
    }

    on_workspace_added(workspace: any) {
        this.ignore_display_update = true;
        const index = typeof workspace === 'number' ? workspace : workspace.index();

        if (typeof workspace !== 'number') {
            this.setup_workspace_signals(workspace);
        }
    }

    setup_workspace_signals(ws: any) {
        let index = ws.index();
        this.connect_workspace(ws, 'notify::workspace-index', () => {
            if (ws !== null) {
                const new_index = ws.index();
                this.on_workspace_index_changed(index, new_index);
                index = new_index;
            }
        });
    }

    /** Handle workspace change events */
    on_workspace_changed(win: Window.ShellWindow) {
        if (this.auto_tiler && !this.contains_tag(win.entity, Tags.Floating)) {
            const id = this.workspace_id(win);
            const prev_id = this.monitors.get(win.entity);
            if (!prev_id || id[0] != prev_id[0] || id[1] != prev_id[1]) {
                win.ignore_detach = true;
                this.monitors.insert(win.entity, id);
                if (win.is_tilable(this)) {
                    this.auto_tiler.detach_window(this, win.entity);
                    this.auto_tiler.attach_to_workspace(this, win, id);
                }
            }

            if (win.meta.minimized) {
                this.size_signals_block(win);
                win.meta.unminimize();
                this.size_signals_unblock(win);
            }
        }
    }

    on_workspace_index_changed(prev: number, next: number) {
        this.on_workspace_modify(
            (current) => current == prev,
            (_) => next,
        );
    }

    on_workspace_modify(
        condition: (current: number) => boolean,
        modify: (current: number) => number,
        change_workspace: boolean = false,
    ) {
        function window_move(ext: Ext, entity: Entity, ws: WorkspaceID) {
            if (change_workspace) {
                const window = ext.windows.get(entity);
                if (!window || !window.actor_exists() || window.meta.is_on_all_workspaces()) return;

                ext.size_signals_block(window);
                window.meta.change_workspace_by_index(ws, false);
                ext.size_signals_unblock(window);
            }
        }

        if (this.auto_tiler) {
            for (const [entity, monitor] of this.auto_tiler.forest.toplevel.values()) {
                if (condition(monitor[1])) {
                    const value = modify(monitor[1]);
                    monitor[1] = value;
                    let fork = this.auto_tiler.forest.forks.get(entity);
                    if (fork) {
                        fork.workspace = value;
                        for (const child of this.auto_tiler.forest.iter(entity)) {
                            if (child.inner.kind === 1) {
                                fork = this.auto_tiler.forest.forks.get(child.inner.entity);
                                if (fork) fork.workspace = value;
                            } else if (child.inner.kind === 2) {
                                window_move(this, child.inner.entity, value);
                            } else if (child.inner.kind === 3) {
                                const stack = this.auto_tiler.forest.stacks.get(child.inner.idx);
                                if (stack) {
                                    stack.workspace = value;

                                    for (const entity of child.inner.entities) {
                                        window_move(this, entity, value);
                                    }

                                    stack.restack();
                                }
                            }
                        }
                    }
                }
            }

            // Fix phantom apps in dash
            for (const window of this.windows.values()) {
                if (!window.actor_exists()) this.auto_tiler.detach_window(this, window.entity);
            }
        } else {
            const to_delete = [];

            for (const [entity, window] of this.windows.iter()) {
                if (!window.actor_exists()) {
                    to_delete.push(entity);
                    continue;
                }

                const ws = window.workspace_id();
                if (condition(ws)) {
                    window_move(this, entity, modify(ws));
                }
            }

            for (const e of to_delete) this.delete_entity(e);
        }

        // Update disabled workspaces
        const next_disabled = new Set<number>();
        for (const ws of this.disabled_workspaces) {
            if (condition(ws)) {
                next_disabled.add(modify(ws));
            } else {
                next_disabled.add(ws);
            }
        }
        this.disabled_workspaces = next_disabled;
    }

    on_workspace_removed(number: number) {
        this.disabled_workspaces.delete(number);

        // Disconnect all signals for the removed workspace
        const to_delete = [];
        const current_workspaces = [];
        const n = (global as any).workspace_manager.get_n_workspaces();
        for (let i = 0; i < n; i++) {
            const w = (global as any).workspace_manager.get_workspace_by_index(i);
            if (w) current_workspaces.push(w);
        }

        for (const [ws] of this.workspace_signals) {
            if (!current_workspaces.includes(ws)) {
                // Delete map reference to avoid leaks since workspace is removed.
                to_delete.push(ws);
            }
        }
        for (const ws of to_delete) {
            this.workspace_signals.delete(ws);
        }

        this.on_workspace_modify(
            (current) => current > number,
            (prev) => prev - 1,
        );
    }

    restack() {
        // NOTE: Workaround for GNOME Shell showing our hidden windows on a workspace switch
        if (this._timeouts['restack_source'] != null) {
            utils.source_remove(this._timeouts['restack_source']);
        }
        let attempts = 0;
        const id = GLib.timeout_add(GLib.PRIORITY_LOW, 100, () => {
            if (this.auto_tiler) {
                for (const container of this.auto_tiler.forest.stacks.values()) {
                    container.restack();
                }
            }

            const x = attempts;
            attempts += 1;
            if (x >= 3) {
                if (this._timeouts['restack_source'] === id) {
                    this._timeouts['restack_source'] = null;
                }
            }
            return x < 3;
        });
        this._timeouts['restack_source'] = id;
    }

    set_gap_inner(gap: number) {
        this.gap_inner_prev = this.gap_inner;
        this.gap_inner = gap * 4 * this.dpi;
        this.gap_inner_half = this.gap_inner / 2;
    }

    set_gap_outer(gap: number) {
        this.gap_outer_prev = this.gap_outer;
        this.gap_outer = gap * 4 * this.dpi;
        // Keep gap_top in sync whenever gap_outer changes
        this.compute_gap_top();
    }

    set_overlay(rect: Rectangle) {
        this.overlay.x = rect.x;
        this.overlay.y = rect.y;
        this.overlay.width = rect.width;
        this.overlay.height = rect.height;
    }

    /** Begin listening for signals from windows, and add any pre-existing windows. */
    signals_attach() {
        if (this._signals_attached) return;
        this._signals_attached = true;

        // this.conf_watch = this.attach_config();

        this.tiler.queue.start(100, (movement) => {
            movement();
            return true;
        });

        const workspace_manager = wom;

        for (const [, ws] of iter_workspaces(workspace_manager)) {
            this.setup_workspace_signals(ws);
        }

        this.connect(display as any, 'workareas-changed', () => {
            this.update_display_configuration(true);
        });

        this.size_changed_signal = this.connect(wim, 'size-change', (_, actor, event, _before, _after) => {
            if (this.auto_tiler) {
                const win = this.get_window(actor.get_meta_window());
                if (!win) return;

                if (event === Meta.SizeChange.MAXIMIZE || event === Meta.SizeChange.UNMAXIMIZE) {
                    this.register(Events.window_event(win, WindowEvent.Maximize));
                } else {
                    this.register(Events.window_event(win, WindowEvent.Fullscreen));
                }
            }
        });

        this.connect(this.settings.ext as any, 'changed', (_s: any, key: string) => {
            switch (key) {
                case 'active-hint':
                    if (indicator) indicator.toggle_active.setToggleState(this.settings.active_hint());

                    this.show_border_on_focused();
                    break;
                case 'active-hint-overlay-enabled':
                case 'active-hint-overlay-opacity':
                case 'hint-color-rgba':
                case 'active-hint-overlay-color-rgba':
                case 'active-hint-border-radius':
                case 'active-hint-border-width':
                case 'active-hint-overlay-all-windows':
                    this.show_border_on_focused();
                    break;
                case 'gap-inner':
                    this.on_gap_inner();
                    break;
                case 'gap-outer':
                    this.on_gap_outer();
                    break;
                case 'show-title':
                    this.on_show_window_titles();
                    break;
                case 'smart-gaps':
                    this.on_smart_gap();
                    this.show_border_on_focused();
                    break;
                case 'show-skip-taskbar':
                    if (this.settings.show_skiptaskbar()) {
                        _show_skip_taskbar_windows(this);
                    } else {
                        _hide_skip_taskbar_windows();
                    }
                    break;

            }
        });

        if (this.settings.mutter) {
            this.connect(this.settings.mutter as any, 'changed::workspaces-only-on-primary', () => {
                this.register(Events.global(GlobalEvent.MonitorsChanged));
            });
        }

        this.connect(layoutManager as any, 'monitors-changed', () => {
            this.register(Events.global(GlobalEvent.MonitorsChanged));
        });

        this.connect(overview as any, 'showing', () => {
            this.register(Events.global(GlobalEvent.OverviewShown));
        });

        this.connect(overview as any, 'hiding', () => {
            const window = this.focus_window();
            if (window) {
                this.on_focused(window);
            }
            this.register(Events.global(GlobalEvent.OverviewHidden));
        });
        // We have to connect this signal in an idle_add; otherwise work areas stop being calculated
        this.register_fn(() => {
            if (!this._signals_attached) return; // guard re-entry
            if (this._focused_signal_connected) return; // ADD this flag
            this._focused_signal_connected = true;

            if ((Main as any).sessionMode?.isLocked) this.update_display_configuration(false);

            this.connect((global as any).display, 'notify::focus-window', (display: any, window: any) => {
                // Disallow refocus if a modal window is active (GNOME 48+: Main.modalCount)
                if ((Main as any).modalCount > 0) {
                    return;
                }

                log.debug(`notify::focus-window fired, get_focus_window=${(global as any).display.get_focus_window()?.get_wm_class() ?? 'null'}`);

                const refocus_tiled_window = () => {
                    // Re-focus a window that was unfocused.
                    let window: Window.ShellWindow | null = null;
                    const [x, y] = this.prev_focused;

                    if (y) {
                        window = this.windows.get(y);
                    }

                    if (window === null && x) {
                        window = this.windows.get(x);
                    }

                    // Transient null-focus (mouse in gap) — window still owns focus, just refresh border.
                    if (window && window.meta.appears_focused) {
                        log.debug(`refocus_tiled_window: gap-hover guard — ${window.meta.get_wm_class()} still appears_focused, skipping activate()`);
                        this.show_border_on_focused();
                        return;
                    }

                    if (window && window.same_monitor() && window.same_workspace() && !window.meta.minimized) {
                        log.debug(`refocus_tiled_window: calling activate() on ${window.meta.get_wm_class()}`);
                        window.activate(false);
                    } else {
                        log.debug(`refocus_tiled_window: hide_all_borders (no valid window)`);
                        this.hide_all_borders();
                    }
                };

                // Delay to allow focus to resolve (fixes IntelliJ IDE windows).
                this.register_fn(() => {
                    // Skip if Clutter key-focus is on a shell panel/dock/indicator actor using the shared helper.
                    if (Window.clutter_focus_is_shell_panel()) {
                        log.debug(`focus-window handler: shell-panel/dock actor detected — skipping`);
                        return;
                    }

                    const meta_window = (global as any).display.get_focus_window();

                    if (meta_window) {
                        const shell_window = this.get_window(meta_window);

                        if (shell_window) {
                            // Avoid re-focusing a window that's already focused.
                            if (shell_window.entity !== this.prev_focused[1] && !shell_window.meta.minimized) {
                                this.on_focused(shell_window);
                            }
                        } else if (!meta_window.is_override_redirect()) {
                            // Prevent focusing desktop extension in auto-tiler mode
                            if (this.auto_tiler && meta_window.window_type === Meta.WindowType.DESKTOP) {
                                refocus_tiled_window();
                            } else {
                                // This section fixes Steam's sub-menus.
                                Lib.activate_window(meta_window);
                            }
                        }
                    } else if (this.auto_tiler) {
                        // Skip refocusing if a panel popup (calendar/notifications) temporarily hijacks focus.
                        if (Window.clutter_focus_is_shell_panel()) {
                            log.debug(`focus-window null: shell-panel/popup actor holds Clutter focus — skipping refocus`);
                            return;
                        }
                        // Skip refocus if the bordered window still appears focused (transient null-focus, e.g. gap hover).
                        if (this._bordered_entity !== null) {
                            const _bw = this.windows.get(this._bordered_entity);
                            if (_bw?.meta.appears_focused) {
                                log.debug(`focus-window null: bordered entity ${_bw.meta.get_wm_class()} still appears_focused — skipping refocus`);
                                return;
                            }
                        }
                        log.debug(`focus-window null: calling refocus_tiled_window`);
                        refocus_tiled_window();
                    }
                });

                return false;
            });

            const window = this.focus_window();
            if (window) {
                this.on_focused(window);
            }

            return false;
        });

        this.connect(display as any, 'window_created', (_, window: Meta.Window) => {
            this.register({ tag: 3, window });
        });

        // GNOME 40 removed the first argument of the callback
        this.connect(display as any, 'grab-op-begin', (_display, win, op) => {
            this.on_grab_start(win, op);
        });

        this.connect(display as any, 'grab-op-end', (_display, win, op) => {
            this.register_fn(() => this.on_grab_end(win, op));
        });

        this.connect(overview as any, 'window-drag-begin', (_, win) => {
            this.on_grab_start(win, 1);
        });

        this.connect(overview as any, 'window-drag-end', (_, win) => {
            this.register_fn(() => this.on_grab_end(win));
        });

        this.connect(overview as any, 'window-drag-cancelled', () => {
            this.unset_grab_op();
        });

        this.connect(wim, 'switch-workspace', () => {
            this.hide_all_borders(true);
        });

        this.connect(workspace_manager, 'active-workspace-changed', () => {
            this.on_active_workspace_changed();
        });

        this.connect(workspace_manager, 'workspace-removed', (_, number) => {
            this.on_workspace_removed(number);
        });

        this.connect(workspace_manager, 'workspace-added', (_, number) => {
            this.on_workspace_added(number);
        });

        // Bind show desktop and remove the active hint
        this.connect(workspace_manager, 'showing-desktop-changed', () => {
            this.hide_all_borders(true);
            this.prev_focused = [null, null];
        });

        this.connect(St.ThemeContext.get_for_stage(((global as any).stage as any)) as any, 'notify::scale-factor', () => this.update_scale());

        // Modes


        // Post-init

        if (this._first_startup) {
            for (const window of this.tab_list(Meta.TabList.NORMAL, null)) {
                this.register({ tag: 3, window: window.meta });
            }

            this.register_fn(() => {
                this._first_startup = false;
                this.init = false;
            });
        }
    }

    signals_remove() {
        for (const [object, signals] of this.signals) {
            for (const signal of signals) {
                object.disconnect(signal);
            }
        }

        if (this.conf_watch) {
            this.conf_watch[0].disconnect(this.conf_watch[1]);
            this.conf_watch = null;
        }

        this.tiler.queue.stop();

        this.signals.clear();

        const current_workspaces = [];
        const n = (global as any).workspace_manager.get_n_workspaces();
        for (let i = 0; i < n; i++) {
            const w = (global as any).workspace_manager.get_workspace_by_index(i);
            if (w) current_workspaces.push(w);
        }

        for (const [ws, signals] of this.workspace_signals) {
            if (current_workspaces.includes(ws)) {
                for (const signal of signals) {
                    ws.disconnect(signal);
                }
            }
        }
        this.workspace_signals.clear();

        this._signals_attached = false;
        this._focused_signal_connected = false;
    }

    suspend() {
        if (this._timeouts['suspend_timeout']) {
            utils.source_remove(this._timeouts['suspend_timeout']);
            this._timeouts['suspend_timeout'] = null;
        }

        // Cancel any pending resume to prevent race conditions
        if (this._timeouts['resume_timeout']) {
            utils.source_remove(this._timeouts['resume_timeout']);
            this._timeouts['resume_timeout'] = null;
        }

        if (this._timeouts['resume_timeout_source'] !== null) {
            utils.source_remove(this._timeouts['resume_timeout_source']);
            this._timeouts['resume_timeout_source'] = null;
        }

        this._resuming = false;

        this.suspended = true;
        this.signals_remove();
        this.hide_all_borders();
        if (this.keybindings) {
            this.keybindings.disable(this.keybindings.global).disable(this.keybindings.window_focus);
        }
    }

    resume() {
        if (this._timeouts['suspend_timeout']) {
            utils.source_remove(this._timeouts['suspend_timeout']);
            this._timeouts['suspend_timeout'] = null;
        }

        // Debounce: clear any previous resume schedule.
        if (this._timeouts['resume_timeout']) {
            utils.source_remove(this._timeouts['resume_timeout']);
            this._timeouts['resume_timeout'] = null;
        }

        if (this._resuming) return;

        // 600ms delay: GNOME 49 fires sessionMode.updated multiple times during unlock.
        this._resuming = true;
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 600, () => {
            if (this._timeouts['resume_timeout'] === id) {
                this._timeouts['resume_timeout'] = null;
            }
            if (this._destroyed) return GLib.SOURCE_REMOVE;

            this._resuming = false;

            if (sessionMode.isLocked) {
                return GLib.SOURCE_REMOVE;
            }

            this.suspended = false;

            if (this._signals_attached) {
                return GLib.SOURCE_REMOVE;
            }

            this.signals_attach();
            if (this.keybindings) {
                this.keybindings.enable(this.keybindings.global).enable(this.keybindings.window_focus);
            }
            if (this.settings.tile_by_default()) {
                if (!this.auto_tiler) {
                    this.auto_tile_on(false);
                }

                // Secondary retile: catch windows whose compositor actors
                // were not ready during the first pass after suspend
                const sub_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
                    if (this._timeouts['resume_timeout_source'] === sub_id) {
                        this._timeouts['resume_timeout_source'] = null;
                    }
                    if (this.suspended || !this.auto_tiler) return GLib.SOURCE_REMOVE;

                    for (const window of this.windows.values()) {
                        if (window.is_tilable(this) && !window.meta.minimized) {
                            const actor = window.meta.get_compositor_private();
                            if (actor && !this.auto_tiler.attached.contains(window.entity)) {
                                this.auto_tiler.auto_tile(this, window, true);
                            }
                        }
                    }

                    return GLib.SOURCE_REMOVE;
                });
                this._timeouts['resume_timeout_source'] = sub_id;
            }

            return GLib.SOURCE_REMOVE;
        });
        this._timeouts['resume_timeout'] = id;
    }

    suspend_for(minutes: number) {
        this.suspend();
        const id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, minutes * 60, () => {
            if (this._timeouts['suspend_timeout'] === id) {
                this._timeouts['suspend_timeout'] = null;
            }
            this.resume();
            return GLib.SOURCE_REMOVE;
        });
        this._timeouts['suspend_timeout'] = id;
    }

    size_changed_block() {
        utils.block_signal(wim, this.size_changed_signal);
    }

    size_changed_unblock() {
        utils.unblock_signal(wim, this.size_changed_signal);
    }

    size_signals_block(win: Window.ShellWindow) {
        this.add_tag(win.entity, Tags.Blocked);
    }

    size_signals_unblock(win: Window.ShellWindow) {
        this.delete_tag(win.entity, Tags.Blocked);
    }

    // Snaps all windows to the window grid
    snap_windows() {
        for (const window of this.windows.values()) {
            if (window.is_tilable(this)) this.tiler.snap(this, window);
        }
    }

    /** Switch to a workspace by its index */
    switch_to_workspace(id: number) {
        const ws = this.workspace_by_id(id);
        // workspace_by_id returns null when the index is out of range
        if (ws) ws.activate(Clutter.get_current_event_time());
    }

    tab_list(tablist: number, workspace: Meta.Workspace | null): Array<Window.ShellWindow> {
        const windows = display.get_tab_list(tablist, workspace);

        const matched = [];

        for (const window of windows) {
            const win = this.get_window(window);
            if (win) matched.push(win);
        }

        return matched;
    }

    *tiled_windows(): IterableIterator<Entity> {
        for (const entity of this.entities()) {
            if (this.contains_tag(entity, Tags.Tiled)) {
                yield entity;
            }
        }
    }

    /// If the auto-tilable status of a window has changed, detach or attach the window.
    tiling_config_reapply() {
        if (this.auto_tiler) {
            const at = this.auto_tiler;
            for (const [entity, window] of this.windows.iter()) {
                const attachment = at.attached.get(entity);
                if (window.is_tilable(this)) {
                    if (!attachment) {
                        at.auto_tile(this, window, this.init);
                    }
                } else if (attachment) {
                    at.detach_window(this, entity);
                }
            }
        }
    }

    toggle_tiling() {
        if (this.auto_tiler !== null) {
            this.auto_tile_off();
        } else {
            this.auto_tile_on();
        }
    }

    // Soft-disable: shuts down all extension features without destroying the panel indicator.
    // Equivalent to extension disable() but keeps the Indicator alive.
    ext_soft_disable() {
        if (this._ext_soft_disabled) return;
        this._ext_soft_disabled = true;

        // 1. Stop auto-tiling
        if (this.auto_tiler) {
            this.settings.set_edge_tiling(true);
            this.auto_tiler.destroy(this);
            this.auto_tiler = null;
        }

        // 2. Hide borders and disconnect window signals
        const entities = Array.from(this.windows.iter()).map(([e]) => e);
        for (const entity of entities) {
            this.teardown_window(entity);
            this.delete_entity(entity);
        }

        // 3. Clear all ECS storages to ensure a fresh state on enable

        // 4. Disable all keybindings
        this.keybindings.disable(this.keybindings.global)
            .disable(this.keybindings.window_focus);

        // 5. Remove all global window/workspace/display signals
        this.signals_remove();

        // 6. Remove GNOME Shell injections
        this.injections_remove();

        // 7. Clear pending timers/sources
        for (const key of Object.keys(this._timeouts)) {
            const id = this._timeouts[key];
            if (id !== null) {
                utils.source_remove(id);
                this._timeouts[key] = null;
            }
        }
        for (const src of this._schedule_idle_sources) {
            utils.source_remove(src);
        }
        this._schedule_idle_sources.clear();
        for (const [, src] of this.size_requests) {
            utils.source_remove(src);
        }
        this.size_requests.clear();

        // 8. Disable other handlers
        if (this.theme_consistency_handler) {
            this.theme_consistency_handler.disable();
            this.theme_consistency_handler = null;
        }
        if (this.workspace_switcher_style_handler) {
            this.workspace_switcher_style_handler.disable();
            this.workspace_switcher_style_handler = null;
        }
        if (this.panel_transparency_handler) {
            this.panel_transparency_handler.disable();
            this.panel_transparency_handler = null;
        }
        if (this.window_buttons_manager) {
            this.window_buttons_manager.disable();
            this.window_buttons_manager = null;
        }
        if (this.overview_layout_manager) {
            this.overview_layout_manager.disable();
            this.overview_layout_manager = null;
        }

        // 9. Final UI cleanup
        this.hide_all_borders();
        if (this.button) {
            this.button.icon.gicon = this.button_gio_icon_auto_off;
        }

        // 10. Update the toggle_tiled switch state in the menu
        if (indicator) {
            this._indicator_updating = true;
            indicator.toggle_tiled.setToggleState(false);
            this._indicator_updating = false;
            if (indicator.toggle_tiled.updateIcon) indicator.toggle_tiled.updateIcon(false);
            this._indicator_updating = true;
            indicator.toggle_workspace_tiled?.setToggleState(false);
            this._indicator_updating = false;
        }

        this.prev_focused = [null, null];
        this.workspace_active.clear();
    }

    /** Soft-enable: restores extension features after a soft-disable */
    ext_soft_enable() {
        if (!this._ext_soft_disabled) return;
        this._ext_soft_disabled = false;

        // 1. Re-attach GNOME Shell injections
        this.injections_add();

        // 2. Re-attach all signals
        this.signals_attach();

        // 3. Re-enable all keybindings
        this.keybindings.enable(this.keybindings.global)
            .enable(this.keybindings.window_focus);

        if (!this.window_buttons_manager) {
            this.window_buttons_manager = new WindowButtonsManager(this.settings);
            this.window_buttons_manager.enable();
        }
        if (!this.overview_layout_manager) {
            this.overview_layout_manager = new OverviewLayoutManager(this);
            this.overview_layout_manager.enable();
        }

        // 4. Restore auto-tiling if user had it enabled
        if (this.settings.tile_by_default()) {
            this.auto_tile_on(false); // false = do not re-save setting
        } else {
            this.settings.set_edge_tiling(true);
            if (this.settings.active_hint()) {
                this.show_border_on_focused();
            }
        }

        // 5. Restore theme consistency if user had it enabled
        if (this.settings.theme_consistency_style() !== 'default') {
            this.toggle_theme_consistency(this.settings.theme_consistency_style(), false);
        }

        // 6. Restore workspace-switcher style if user had it enabled
        if (isGnome50() && this.settings.workspace_switcher_style()) {
            this.toggle_workspace_switcher_style(true, false);
        }

        // 7b. Restore panel transparency if user had it enabled
        if (this.settings.panel_transparency()) {
            this.toggle_panel_transparency(true, false);
        }

        // 7. Update panel icon to on/off based on auto_tiler state
        if (this.button) {
            this.button.icon.gicon = this.auto_tiler
                ? this.button_gio_icon_auto_on
                : this.button_gio_icon_auto_off;
        }

        if (indicator) {
            // The toggle_tiled switch reflects overall "extension enabled" state
            this._indicator_updating = true;
            indicator.toggle_tiled.setToggleState(true); // extension is ON now
            this._indicator_updating = false;
            if (indicator.toggle_tiled.updateIcon) indicator.toggle_tiled.updateIcon(true);
            indicator.update_workspace_tiling_state();
        }
    }

    auto_tile_off(save_setting: boolean = true) {
        this.settings.set_edge_tiling(true);
        this.hide_all_borders();

        if (this.auto_tiler) {
            this.unregister_storage(this.auto_tiler.attached);
            this.auto_tiler.destroy(this);
            this.auto_tiler = null;
            if (save_setting) {
                this.settings.set_tile_by_default(false);
            }

            if (indicator) {
                this._indicator_updating = true;
                indicator.toggle_tiled.setToggleState(false);
                this._indicator_updating = false;
                if (indicator.toggle_tiled.updateIcon) indicator.toggle_tiled.updateIcon(false);
            }

            if (this.button) {
                this.button.icon.gicon = this.button_gio_icon_auto_off; // type: Gio.Icon
            }

            if (this.settings.active_hint()) {
                this.show_border_on_focused();
            }
        }
    }

    /** Enables or disables the workspace-switcher style (GNOME 50+ only). */
    toggle_workspace_switcher_style(enabled: boolean, save: boolean = true) {
        if (!isGnome50()) return;

        if (enabled) {
            if (!this.workspace_switcher_style_handler) {
                this.workspace_switcher_style_handler = new WorkspaceSwitcherStyle(
                    this.settings.hint_color_rgba(),
                );
            }
            this.workspace_switcher_style_handler.enable();
        } else {
            this.workspace_switcher_style_handler?.disable();
            this.workspace_switcher_style_handler = null;
        }

        if (save) {
            this.settings.set_workspace_switcher_style(enabled);
        }
    }



    /** Enables / updates the workspace animation style (static wallpaper + window swing). */
    toggle_workspace_animation(style: AnimationStyle, save: boolean = true) {
        if (style === 'none') {
            this.workspace_animation_handler?.disable();
            this.workspace_animation_handler = null;
        } else {
            if (!this.workspace_animation_handler) {
                this.workspace_animation_handler = new WorkspaceAnimationManager(style);
                this.workspace_animation_handler.enable();
            } else {
                this.workspace_animation_handler.setStyle(style);
            }
        }

        if (save) {
            this.settings.set_workspace_animation_style(style);
        }
    }

    toggle_window_animation(style: WindowAnimationStyle, save: boolean = true) {
        this.window_animation_handler.setStyle(style);

        if (save) {
            this.settings.set_window_animation_style(style);
        }
    }

    toggle_theme_consistency(style: string, save: boolean = true) {
        if (style !== 'default') {
            if (!this.theme_consistency_handler) {
                this.theme_consistency_handler = new ThemeConsistencyManager();
            }
            this.theme_consistency_handler.enable(style as any);

            // Not awaited: runs from a settings-changed signal handler, not enable()/disable(),
            // so there is no shell-lifecycle race. Errors are caught and logged inside.
            void applyThemeConsistency(style as 'rounded' | 'sharp');
        } else {
            this.theme_consistency_handler?.disable();
            this.theme_consistency_handler = null;
            // Not awaited: same rationale as above — errors are caught and logged inside.
            void restoreGtkDefaults();
        }

        if (save) {
            this.settings.set_theme_consistency_style(style);
        }
    }

    toggle_panel_transparency(enabled: boolean, save: boolean = true): void {
        if (enabled) {
            if (!this.panel_transparency_handler) {
                this.panel_transparency_handler = new PanelTransparencyManager(
                    this.settings.panel_transparency_opacity(),
                );
            }
            this.panel_transparency_handler.enable();
        } else {
            this.panel_transparency_handler?.disable();
            this.panel_transparency_handler = null;
        }

        if (save) {
            this.settings.set_panel_transparency(enabled);
        }
    }

    auto_tile_on(save_setting: boolean = true) {
        // Do not auto-tile if the extension is soft-disabled
        if (this._ext_soft_disabled) return;

        this.settings.set_edge_tiling(false);
        this.hide_all_borders();

        if (indicator) {
            this._indicator_updating = true;
            indicator.toggle_tiled.setToggleState(true);
            this._indicator_updating = false;
            if (indicator.toggle_tiled.updateIcon) indicator.toggle_tiled.updateIcon(true);
        }

        const original = this.active_workspace();

        if (this.auto_tiler) {
            this.unregister_storage(this.auto_tiler.attached);
            this.auto_tiler.destroy(this);
        }

        const tiler = new auto_tiler.AutoTiler(
            new Forest.Forest()
                .connect_on_attach(this.on_tile_attach.bind(this))
                .connect_on_detach(this.on_tile_detach.bind(this)),
            this.register_storage(),
        );

        this.auto_tiler = tiler;

        if (save_setting) {
            this.settings.set_tile_by_default(true);
        }
        if (this.button) {
            this.button.icon.gicon = this.button_gio_icon_auto_on; // type: Gio.Icon
        }

        for (const window of this.windows.values()) {
            if (window.is_tilable(this) && this.is_workspace_tiled(window.workspace_id())) {
                const actor = window.meta.get_compositor_private();
                if (actor) {
                    if (!window.meta.minimized) {
                        tiler.auto_tile(this, window, true);
                    }
                }
            }
        }

        this.register_fn(() => this.switch_to_workspace(original));
    }

    /** Calls a function once windows are no longer queued for movement. */
    schedule_idle(func: () => boolean): boolean {
        if (!this.movements.is_empty()) {
            const src = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                if (!this.movements.is_empty()) return true;
                this._schedule_idle_sources.delete(src);
                return func();
            });
            this._schedule_idle_sources.add(src);
        } else {
            func();
        }
        return false;
    }

    should_ignore_workspace(monitor: number): boolean {
        return this.settings.workspaces_only_on_primary() && monitor !== display.get_primary_monitor();
    }

    unset_grab_op() {
        if (this._timeouts['drag_signal'] != null) {
            this.overlay.visible = false;
            utils.source_remove(this._timeouts['drag_signal']);
            this._timeouts['drag_signal'] = null;
        }

        if (this.grab_op !== null) {
            const window = this.windows.get(this.grab_op.entity);
            if (window) this.size_signals_unblock(window);
            this.grab_op = null;
        }

        this.moved_by_mouse = false;
    }

    update_display_configuration_before() { }

    update_display_configuration(workareas_only: boolean) {
        if (!this.auto_tiler || sessionMode.isLocked) return;

        if (this.ignore_display_update) {
            this.ignore_display_update = false;
            return;
        }

        // Ignore the update if there are no monitors to assign to
        if (layoutManager.monitors.length === 0) return;

        const primary_display = display.get_primary_monitor();

        const primary_display_ready = (ext: Ext): boolean => {
            const mm = (global as any).backend.get_monitor_manager();
            const lm = mm ? mm.get_logical_monitors().find((m: any) => m.get_number() === primary_display) : null;
            const area = lm ? { x: lm.x, y: lm.y, width: lm.width, height: lm.height } : null;
            const work_area = ext.monitor_work_area(primary_display);

            if (!area || !work_area) return false;

            return !(area.width === work_area.width && area.height === work_area.height);
        };

        function displays_ready(): boolean {
            const mm = (global as any).backend.get_monitor_manager();
            const logicalMonitors = mm ? mm.get_logical_monitors() : [];
            const count = logicalMonitors.length;

            if (count === 0) return false;

            for (const lm of logicalMonitors) {
                if (!lm) return false;
                if (lm.width < 1 || lm.height < 1) return false;
            }

            return true;
        }

        if (!displays_ready() || !primary_display_ready(this)) {
            if (this._timeouts['displays_updating'] != null) return;
            if (this._timeouts['workareas_update'] != null) utils.source_remove(this._timeouts['workareas_update']);

            const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this.register_fn(() => {
                    this.update_display_configuration(workareas_only);
                });

                if (this._timeouts['workareas_update'] === id) {
                    this._timeouts['workareas_update'] = null;
                }

                return false;
            });
            this._timeouts['workareas_update'] = id;

            return;
        }

        // Update every tree on each display with the new dimensions
        const update_tiling = () => {
            if (!this.auto_tiler) return;

            for (const f of this.auto_tiler.forest.forks.values()) {
                if (!f.is_toplevel) continue;

                const display = this.monitor_work_area(f.monitor);

                if (display) {
                    const area = new Rect.Rectangle([display.x, display.y, display.width, display.height]);

                    f.smart_gapped = false;
                    f.set_area(area.clone());
                    this.auto_tiler.update_toplevel(this, f, f.monitor, this.settings.smart_gaps());
                }
            }
        };

        type Migration = [Fork, number, Rectangle, boolean];

        const migrations: Array<Migration> = [];

        const apply_migrations = (assigned_monitors: Set<number>) => {
            if (!migrations) return;

            new exec.OnceExecutor<Migration, Migration[]>(migrations).start(
                500,
                ([fork, new_monitor, workspace, find_workspace]) => {
                    let new_workspace;

                    if (find_workspace) {
                        if (assigned_monitors.has(new_monitor)) {
                            [new_workspace] = this.find_unused_workspace(new_monitor);
                        } else {
                            assigned_monitors.add(new_monitor);
                            new_workspace = 0;
                        }
                    } else {
                        new_workspace = fork.workspace;
                    }

                    fork.migrate(this, forest, workspace, new_monitor, new_workspace);
                    fork.set_ratio(fork.length() / 2);

                    return true;
                },
                () => update_tiling(),
            );
        };

        function mark_for_reassignment(ext: Ext, fork: Ecs.Entity) {
            for (const win of forest.iter(fork, node.NodeKind.WINDOW)) {
                if (win.inner.kind === 2) {
                    const entity = win.inner.entity;
                    const window = ext.windows.get(entity);
                    if (window) window.reassignment = true;
                }
            }
        }

        const [old_primary, old_displays] = this.displays;

        const changes = new Map<number, number>();

        // Records which display's windows were moved to what new display's ID
        for (const [entity, w] of this.windows.iter()) {
            if (!w.actor_exists()) continue;

            this.monitors.with(entity, ([mon]) => {
                const assignment = mon === old_primary ? primary_display : w.meta.get_monitor();
                changes.set(mon, assignment);
            });
        }

        // Fetch a new list of monitors
        const updated = new Map();

        for (const monitor of layoutManager.monitors) {
            const mon = monitor as unknown as Monitor;

            const m_rect = new Rectangle([(monitor as any).x, (monitor as any).y, (monitor as any).width, (monitor as any).height]);
            const ws = this.monitor_work_area(mon.index);

            updated.set(mon.index, { area: m_rect, ws });
        }

        const forest = this.auto_tiler.forest;

        if (old_displays.size === updated.size) {
            update_tiling();

            this.displays = [primary_display, updated];

            return;
        }

        this.displays = [primary_display, updated];

        if (utils.map_eq(old_displays, updated)) {
            return;
        }

        if (this._timeouts['displays_updating'] != null) utils.source_remove(this._timeouts['displays_updating']);

        if (this._timeouts['workareas_update'] != null) {
            utils.source_remove(this._timeouts['workareas_update']);
            this._timeouts['workareas_update'] = null;
        }

        // Delay actions in case of temporary connection loss
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            (() => {
                if (!this.auto_tiler) return;

                const toplevels = [];
                const assigned_monitors = new Set<number>();

                for (const [old_mon, new_mon] of changes) {
                    if (old_mon === new_mon) assigned_monitors.add(new_mon);
                }

                for (const f of forest.forks.values()) {
                    if (f.is_toplevel) {
                        toplevels.push(f);

                        let migration: null | [Fork, number, Rectangle, boolean] = null;

                        const displays = this.displays[1];

                        for (const [old_monitor, new_monitor] of changes) {
                            const display = displays.get(new_monitor);

                            if (!display) continue;

                            if (f.monitor === old_monitor) {
                                f.monitor = new_monitor;
                                f.workspace = 0;
                                migration = [f, new_monitor, display.ws, true];
                            }
                        }

                        if (!migration) {
                            const display = displays.get(f.monitor);
                            if (display) {
                                migration = [f, f.monitor, display.ws, false];
                            }
                        }

                        if (migration) {
                            mark_for_reassignment(this, migration[0].entity);
                            migrations.push(migration);
                        }
                    }
                }

                apply_migrations(assigned_monitors);

                return;
            })();

            if (this._timeouts['displays_updating'] === id) {
                this._timeouts['displays_updating'] = null;
            }
            return false;
        });
        this._timeouts['displays_updating'] = id;
    }

    update_scale() {
        const new_dpi = St.ThemeContext.get_for_stage(((global as any).stage as any)).scale_factor;
        this.dpi = new_dpi;

        // Reload gap and grid values using the new DPI to avoid scaling errors.
        this.load_settings();

        // Retile all forks with updated gap/grid values.
        this.update_inner_gap();
    }

    update_snapped() {
        for (const entity of this.snapped.find((val) => val)) {
            const window = this.windows.get(entity);
            if (window) this.tiler.snap(this, window);
        }
    }

    /// Fetches the window entity which is associated with the metacity window metadata.
    window_entity(meta: Meta.Window | null): Entity | null {
        if (!meta) return null;

        let id: number;

        try {
            id = meta.get_stable_sequence();
        } catch (e) {
            return null;
        }

        // Locate the window entity with the matching ID
        let entity = this.ids.find((comp) => comp == id).next().value;

        // If not found, create a new entity with a ShellWindow component.
        if (!entity) {
            const actor = meta.get_compositor_private();
            if (!actor) return null;

            let window_app: any, name: string;

            try {
                window_app = Window.window_tracker.get_window_app(meta);
                name = window_app.get_name().replace(/&/g, '&amp;');
            } catch (e) {
                return null;
            }

            // Only permit normal, dialog, and modal dialogs
            const window_type = (meta as any).get_window_type();
            if (window_type !== 0 && window_type !== 3 && window_type !== 4) {
                return null;
            }

            entity = this.create_entity();

            this.ids.insert(entity, id);
            this.names.insert(entity, name);

            const win = new Window.ShellWindow(entity, meta, window_app, this);

            this.windows.insert(entity, win);
            this.monitors.insert(entity, [win.meta.get_monitor(), win.workspace_id()]);

            const grab_focus = () => {
                this.schedule_idle(() => {
                    // Wait for Mutter's 'restacked' signal to avoid a stack_position race on new windows.
                    const restack_id = display.connect('restacked', () => {
                        display.disconnect(restack_id);

                        this.windows.with(entity, (window) => {
                            window.meta.raise();
                            window.meta.unminimize();
                            window.activate(false);
                        });
                    });

                    return false;
                });
            };

            if (this.auto_tiler && !win.meta.minimized && win.is_tilable(this) && this.is_workspace_tiled(win.workspace_id())) {
                const id = actor.connect('first-frame', () => {
                    // Recover prev_focused from workspace_active if empty before tiling.
                    if (this.auto_tiler && !this.previously_focused(win)) {
                        const ws_id = win.workspace_id();
                        const entity = this.workspace_active.get(ws_id);
                        if (entity && !Ecs.entity_eq(entity, win.entity)) {
                            const candidate = this.windows.get(entity);
                            if (
                                candidate &&
                                candidate.is_tilable(this) &&
                                this.auto_tiler.attached.contains(entity) &&
                                candidate.meta.get_monitor() === win.meta.get_monitor()
                            ) {
                                this.prev_focused[0] = this.prev_focused[1];
                                this.prev_focused[1] = entity;
                            }
                        }
                    }
                    this.auto_tiler?.auto_tile(this, win, this.init);
                    // Suppress the border until Mutter commits the post-tile
                    // frame rect — prevents it drawing at the old/wrong position.
                    win.mark_border_settling();
                    grab_focus();
                    actor.disconnect(id);
                });
            } else {
                grab_focus();
            }
        }
        return entity;
    }

    /// Returns the tilable window(s) that the mouse pointer is currently hovering above.
    *windows_at_pointer(cursor: Rectangle, monitor: number, workspace: number): IterableIterator<Window.ShellWindow> {
        for (const entity of this.monitors.find((m) => m[0] == monitor && m[1] == workspace)) {
            const window = this.windows.with(entity, (window) => {
                return window.is_tilable(this) && window.rect().contains(cursor) ? window : null;
            });

            if (window) yield window;
        }
    }

    cursor_status(): [Rectangle, number] {
        const cursor = cursor_rect();
        // named-property Mtk.Rectangle safe on 48/49/50
        const rect = new Mtk.Rectangle({ x: cursor.x, y: cursor.y, width: 1, height: 1 });
        let monitor = display.get_monitor_index_for_rect(rect);
        if (monitor < 0) monitor = this.active_monitor();
        return [cursor, monitor];
    }

    /** Fetch a workspace by its index */
    workspace_by_id(id: number): Meta.Workspace | null {
        return wom.get_workspace_by_index(id);
    }

    workspace_id(window: Window.ShellWindow | null = null): [number, number] {
        const id: [number, number] = window
            ? [window.meta.get_monitor(), window.workspace_id()]
            : [this.active_monitor(), this.active_workspace()];

        id[0] = Math.max(0, id[0]);
        id[1] = Math.max(0, id[1]);

        return id;
    }

    is_floating(window: Window.ShellWindow): boolean {
        let shall_float: boolean = false;
        const wm_class = window.meta.get_wm_class();
        const wm_title = window.meta.get_title();

        if (wm_class && wm_title) {
            shall_float = this.conf.window_shall_float(wm_class, wm_title);
        }

        const floating_tagged = this.contains_tag(window.entity, Tags.Floating);
        const force_tiled_tagged = this.contains_tag(window.entity, Tags.ForceTile);
        // Tags.Tiled does not seem to matter, so not checking here

        return (floating_tagged && !force_tiled_tagged) || (shall_float && !force_tiled_tagged);
    }
}

declare global {
    var oTilingExtension: any;
}

// Kept at module level so ext.suspend() can't kill it via signals_remove().
let _osk_signal: SignalID = 0;

export default class OTilingExtension extends Extension {
    enable() {
        globalThis.oTilingExtension = this;
        log.info('enable');

        if (!ext) {
            ext = new Ext();
            ext.setup();

            ext.register_fn(() => {
                if (ext?.auto_tiler) ext.snap_windows();
            });
        }

        // GNOME resuming us after a screen unlock, skip full re-init and avoid rebuilding the layout.
        if (ext.was_locked) {
            ext.was_locked = false;
            return;
        }

        if (ext.settings.show_skiptaskbar()) {
            _show_skip_taskbar_windows(ext);
        } else {
            _hide_skip_taskbar_windows();
        }

        ext.injections_add();
        ext.signals_attach();

        disable_window_attention_handler();

        layoutManager.addChrome(ext.overlay as any);

        const currentPanel = (Main as any).panel;
        if (!indicator && currentPanel) {
            indicator = new PanelSettings.Indicator(ext);
            currentPanel.addToStatusArea('o-tiling', indicator.button);
            indicator.button.visible = !ext.settings.hide_panel_icon();
        }

        // Workspace-number indicator in panel
        _toggle_workspace_number_indicator(ext.settings.workspace_number_indicator());
        _toggle_quick_settings_indicator(ext.settings.quick_settings_toggle());

        ext.keybindings.enable(ext.keybindings.global).enable(ext.keybindings.window_focus);

        if (ext.settings.tile_by_default()) {
            ext.auto_tile_on();
        }

        // Activate workspace-switcher style if enabled and on GNOME 50+
        if (isGnome50() && ext.settings.workspace_switcher_style()) {
            ext.toggle_workspace_switcher_style(true);
        }

        // OSK suspend/resume — must live here, not inside Ext, so that
        // ext.suspend() → signals_remove() cannot disconnect this listener.
        const keyboardBox = (layoutManager as any).keyboardBox;
        if (keyboardBox && !_osk_signal) {
            _osk_signal = keyboardBox.connect('notify::visible', () => {
                if (!ext) return;
                if (keyboardBox.visible) {
                    ext.suspend();
                } else {
                    ext.resume();
                }
            });
        }
    }
    disable() {
        log.info('disable');

        if (_osk_signal) {
            (layoutManager as any).keyboardBox?.disconnect(_osk_signal);
            _osk_signal = 0;
        }

        if (ext) {
            // Screen locking: mark as locked and skip full teardown so enable() can fast-resume.
            if ((Main as any).sessionMode?.isLocked) {
                ext.was_locked = true;
                return;
            }

            delete globalThis.oTilingExtension;
            layoutManager.removeChrome(ext.overlay as any);
            ext.destroy();
            _hide_skip_taskbar_windows();
            ext = null;
        }

        if (indicator) {
            indicator.destroy();
            indicator = null;
        }

        if (workspace_number_indicator) {
            workspace_number_indicator.destroy();
            workspace_number_indicator = null;
        }

        if (quick_settings_indicator) {
            quick_settings_indicator.destroy();
            quick_settings_indicator = null;
        }

        enable_window_attention_handler();
        Window.cleanup_main_loop_sources();
        scheduler.destroy();
    }
}

const handler = windowAttentionHandler;

function enable_window_attention_handler() {
    if (handler && !handler._windowDemandsAttentionId) {
        handler._windowDemandsAttentionId = (global as any).display.connect('window-demands-attention', (display: any, window: any) => {
            handler._onWindowDemandsAttention(display, window);
        });
    }
}

function disable_window_attention_handler() {
    if (handler && handler._windowDemandsAttentionId) {
        (global as any).display.disconnect(handler._windowDemandsAttentionId);
        handler._windowDemandsAttentionId = null;
    }
}

function _toggle_quick_settings_indicator(enable: boolean): void {
    const quickSettings = (Main as any).panel?.statusArea?.quickSettings;
    if (!quickSettings) return;

    if (enable && !quick_settings_indicator) {
        quick_settings_indicator = new (PanelSettings.QuickSettingsIndicator as any)(ext);
        quickSettings.addExternalIndicator(quick_settings_indicator);
    } else if (!enable && quick_settings_indicator) {
        quick_settings_indicator.destroy();
        quick_settings_indicator = null;
    }
}


function _toggle_workspace_number_indicator(enable: boolean): void {
    const currentPanel = (Main as any).panel;
    if (!currentPanel) return;

    // Show/hide GNOME's built-in workspace indicator (the dot strip)
    const builtinIndicator = currentPanel.statusArea?.['activities'] ??
        currentPanel.statusArea?.['workspace-indicator'] ??
        currentPanel._leftBox?.get_children()?.find((c: any) =>
            c.style_class?.includes('workspace-indicator')
        ) ?? null;

    if (enable) {
        if (!workspace_number_indicator) {
            workspace_number_indicator = new PanelSettings.WorkspaceNumberIndicator(ext);
            currentPanel.addToStatusArea('o-tiling-ws-number', workspace_number_indicator.button, 1, 'left');
        }
        // Hide the GNOME dot indicator if found
        if (builtinIndicator) builtinIndicator.hide();
    } else {
        if (workspace_number_indicator) {
            workspace_number_indicator.destroy();
            workspace_number_indicator = null;
        }
        // Restore the GNOME dot indicator
        if (builtinIndicator) builtinIndicator.show();
    }
}

function stylesheet_path(name: string) {
    return get_current_path() + '/' + name + '.css';
}

// Supplements the loaded theme with the extension's theme.
function load_theme(): string | any {
    try {
        const theme_context = St.ThemeContext.get_for_stage(((global as any).stage as any));
        const existing_theme: null | any = theme_context.get_theme();

        // get_theme() returns null if no custom theme — use new St.Theme()
        const theme = existing_theme ?? new St.Theme({});

        theme.unload_stylesheet(STYLESHEET);
        theme.load_stylesheet(STYLESHEET);
        theme_context.set_theme(theme);

        return STYLESHEET_PATH;
    } catch (e) {
        log.error('failed to load stylesheet: ' + e);
        return null;
    }
}

function* iter_workspaces(manager: any): IterableIterator<[number, any]> {
    let idx = 0;
    let ws = manager.get_workspace_by_index(idx);
    while (ws !== null) {
        yield [idx, ws];
        idx += 1;
        ws = manager.get_workspace_by_index(idx);
    }
}

// Use null as sentinel (not undefined) so cleanup path triggers reliably.
let default_isoverviewwindow_ws: any = null;
let default_isoverviewwindow_ws_thumbnail: any = null;

// Determine method name once (works for GNOME 46-48 and 49-50).
const WS_OVERVIEW_KEY: string | null =
    '_isOverviewWindow' in (Workspace.prototype as any) ? '_isOverviewWindow'
        : 'isOverviewWindow' in (Workspace.prototype as any) ? 'isOverviewWindow'
            : null;

const WST_OVERVIEW_KEY: string | null =
    '_isOverviewWindow' in (WorkspaceThumbnail.prototype as any) ? '_isOverviewWindow'
        : 'isOverviewWindow' in (WorkspaceThumbnail.prototype as any) ? 'isOverviewWindow'
            : null;
let default_init_appswitcher: any;
let default_getwindowlist_windowswitcher: any;
let default_getcaption_windowpreview: any;
let default_getcaption_workspace: any;

/** Decorates skip_taskbar handling to include specific window types */
function _show_skip_taskbar_windows(ext: Ext) {
    // Handle the overview
    if (WS_OVERVIEW_KEY && default_isoverviewwindow_ws === null) {
        default_isoverviewwindow_ws =
            (Workspace.prototype as any)[WS_OVERVIEW_KEY] ?? null;
        (Workspace.prototype as any)[WS_OVERVIEW_KEY] = function (win: any) {
            const meta_win = win;
            // Guard: call original only if it actually existed
            const base = default_isoverviewwindow_ws
                ? default_isoverviewwindow_ws.call(this, win)
                : false;
            return is_valid_minimize_to_tray(meta_win, ext) || base;
        };
    } else if (!WS_OVERVIEW_KEY) {
        log.warn('Workspace overview method not found. Skip-taskbar feature disabled.');
        return;
    }

    // Handle _getCaption errors
    if (!default_getcaption_windowpreview) {
        default_getcaption_windowpreview = (WindowPreview.prototype as any)._getCaption;
        log.debug(`override (workspace as any)._getCaption`);
        // 3.38+ _getCaption
        (WindowPreview.prototype as any)._getCaption = function () {
            if ((this as any).metaWindow.title) return (this as any).metaWindow.title;

            const tracker = Shell.WindowTracker.get_default();
            const app = tracker.get_window_app((this as any).metaWindow);
            return app ? app.get_name() : '';
        };
    } else {
        log.warn('WindowPreview._getCaption not found. Caption override skipped.');
    }

    // Handle the workspace thumbnail
    if (WST_OVERVIEW_KEY && default_isoverviewwindow_ws_thumbnail === null) {
        default_isoverviewwindow_ws_thumbnail =
            (WorkspaceThumbnail.prototype as any)[WST_OVERVIEW_KEY] ?? null;

        if (default_isoverviewwindow_ws_thumbnail) {
            (WorkspaceThumbnail.prototype as any)[WST_OVERVIEW_KEY] = function (win: any) {
                const meta_win = win.get_meta_window();
                const base = default_isoverviewwindow_ws_thumbnail
                    ? default_isoverviewwindow_ws_thumbnail.call(this, win)
                    : false;
                return is_valid_minimize_to_tray(meta_win, ext) || base;
            };
        }
    }



    // Handle switch-windows
    if (!default_getwindowlist_windowswitcher) {
        default_getwindowlist_windowswitcher = WindowSwitcherPopup.prototype._getWindowList;
        WindowSwitcherPopup.prototype._getWindowList = function () {
            let workspace = null;

            if ((this as any)._settings.get_boolean('current-workspace-only')) {
                const workspaceManager = (global as any).workspace_manager;
                workspace = workspaceManager.get_active_workspace();
            }

            const windows = (global as any).display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace);
            const seen = new Set();
            return windows
                .map((w: any) => {
                    const meta_win = w.is_attached_dialog() ? w.get_transient_for() : w;
                    if (meta_win) {
                        if (!meta_win.skip_taskbar || is_valid_minimize_to_tray(meta_win, ext)) {
                            return meta_win;
                        }
                    }
                    return null;
                })
                .filter((w: any) => {
                    if (w == null || seen.has(w)) return false;
                    seen.add(w);
                    return true;
                }) as Meta.Window[];
        };
    }
}

/**
 * Cleans up and restores the decorators for skip_taskbar when o-tiling
 * is disabled. Called on extension disable.
 */
function _hide_skip_taskbar_windows() {
    if (WS_OVERVIEW_KEY && default_isoverviewwindow_ws !== null) {
        if (default_isoverviewwindow_ws) {
            (Workspace.prototype as any)[WS_OVERVIEW_KEY] = default_isoverviewwindow_ws;
        } else {
            // Original didn't exist — remove our patch entirely
            delete (Workspace.prototype as any)[WS_OVERVIEW_KEY];
        }
        default_isoverviewwindow_ws = null;
    }

    if (default_getcaption_windowpreview) {
        (WindowPreview.prototype as any)._getCaption = default_getcaption_windowpreview;
        default_getcaption_windowpreview = null;
    }

    if (WST_OVERVIEW_KEY && default_isoverviewwindow_ws_thumbnail !== null) {
        if (default_isoverviewwindow_ws_thumbnail) {
            (WorkspaceThumbnail.prototype as any)[WST_OVERVIEW_KEY] =
                default_isoverviewwindow_ws_thumbnail;
        } else {
            // Only delete if it's not null/undefined to avoid setting 'null' as a property
            if (WST_OVERVIEW_KEY) {
                delete (WorkspaceThumbnail.prototype as any)[WST_OVERVIEW_KEY];
            }
        }
        default_isoverviewwindow_ws_thumbnail = null;
    }

    if (default_init_appswitcher) {
        // AppSwitcher.prototype._init = default_init_appswitcher;
        default_init_appswitcher = null;
    }

    if (default_getwindowlist_windowswitcher) {
        WindowSwitcherPopup.prototype._getWindowList = default_getwindowlist_windowswitcher;
        default_getwindowlist_windowswitcher = null;
    }
}

/** Checks if a window is a valid minimize-to-tray target */
function is_valid_minimize_to_tray(meta_win: Meta.Window, ext: Ext) {
    const cfg = ext.conf;
    let valid_min_to_tray = false;
    switch (meta_win.window_type) {
        case Meta.WindowType.NORMAL:
        case Meta.WindowType.UTILITY: // Gimp (Non-Single Window Mode)
            // Don't track OR (override redirect)-windows since those are never allowed to be window managed:
            valid_min_to_tray = !meta_win.is_override_redirect();
            break;
    }

    const gnome_shell_wm_class = meta_win.get_wm_class() === 'Gjs' || meta_win.get_wm_class() === 'Gnome-shell';
    const show_skiptb = !cfg.skiptaskbar_shall_hide(meta_win);

    valid_min_to_tray =
        valid_min_to_tray &&
        !meta_win.is_attached_dialog() &&
        show_skiptb &&
        meta_win.skip_taskbar &&
        meta_win.get_wm_class() !== null &&
        !gnome_shell_wm_class;

    return valid_min_to_tray;
}
