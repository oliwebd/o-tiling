// ─── Stub declarations for internal GNOME Shell resource modules ───────────
declare module 'resource:///org/gnome/shell/ui/screenShield.js';
declare module 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
declare module 'resource:///org/gnome/shell/ui/workspace.js';
declare module 'resource:///org/gnome/shell/ui/windowPreview.js';
declare module 'resource:///org/gnome/shell/ui/altTab.js';
declare module 'resource:///org/gnome/shell/ui/modalDialog.js';
declare module 'resource:///org/gnome/shell/ui/overview.js' {
    export class Overview {
        show(): void;
        hide(): void;
        [key: string]: any;
    }
}
declare module 'resource:///org/gnome/shell/misc/util.js' {
    export function spawn(argv: string[]): void;
    export function spawnCommandLine(commandLine: string): void;
    export function trySpawn(argv: string[]): void;
    export function trySpawnCommandLine(commandLine: string): void;
    export function formatTime(time: Date): string;
    export function ensureActorVisibleInScrollView(scrollView: any, actor: any): void;
}
declare module 'resource:///org/gnome/shell/ui/popupMenu.js';
declare module 'resource:///org/gnome/shell/ui/panelMenu.js';
declare module 'resource:///org/gnome/shell/ui/notificationDaemon.js';
declare module 'resource:///org/gnome/shell/ui/messageList.js';
declare module 'resource:///org/gnome/shell/ui/mpris.js';
declare module 'resource:///org/gnome/shell/ui/messageTray.js';
declare module 'resource:///org/gnome/shell/ui/status/keyboard.js';
declare module 'resource:///org/gnome/shell/ui/status/volume.js';
declare module 'resource:///org/gnome/shell/ui/slider.js';
declare module 'resource:///org/gnome/shell/ui/runDialog.js';
declare module 'resource:///org/gnome/shell/ui/appDisplay.js';
declare module 'resource:///org/gnome/shell/ui/dateMenu.js';
declare module 'resource:///org/gnome/shell/ui/screenshot.js';
declare module 'resource:///org/gnome/shell/ui/windowManager.js';
declare module 'resource:///org/gnome/shell/ui/quickSettings.js';
