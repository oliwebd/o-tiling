/// <reference types="@girs/gjs" />
/// <reference types="@girs/gnome-shell/ambient" />

import "@girs/gjs/dom";
import "@girs/gnome-shell/extensions/global";

declare const _: (arg: string) => string;

// ─── Global convenience types ──────────────────────────────────────────────
declare global {
    type SignalID = number;
    type WorkspaceID = number;
    const global: any;
}

// ─── GObject namespace augmentation ────────────────────────────────────────
declare namespace GObject {
    type SignalID = number;
}

// ─── Stub declarations for internal GNOME Shell resource modules ───────────
declare module 'resource:///org/gnome/shell/ui/screenShield.js' {
    const ScreenShield: any;
    export { ScreenShield };
}
declare module 'resource:///org/gnome/shell/ui/workspaceThumbnail.js' {
    const WorkspaceThumbnail: any;
    export { WorkspaceThumbnail };
}
declare module 'resource:///org/gnome/shell/ui/workspace.js' {
    const Workspace: any;
    export { Workspace };
}
declare module 'resource:///org/gnome/shell/ui/windowPreview.js' {
    const WindowPreview: any;
    export { WindowPreview };
}
declare module 'resource:///org/gnome/shell/ui/altTab.js' {
    const WindowSwitcherPopup: any;
    export { WindowSwitcherPopup };
}
