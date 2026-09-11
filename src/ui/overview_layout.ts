import * as Main from 'resource:///org/gnome/shell/ui/main.js';
// WorkspaceLayout is in workspace.js. Imported statically (it is always loaded as part of
// the overview) so enable()/disable() can run synchronously with no import race to guard against.
import { WorkspaceLayout } from 'resource:///org/gnome/shell/ui/workspace.js';
import * as log from '../utils/log.js';
import type { Ext } from '../extension.js';


/**
 * Manages the layout of window previews in the overview to match the tiled desktop layout.
 * Specifically patches WorkspaceLayout.prototype._updateWindowPositions.
 */
export class OverviewLayoutManager {
    private _ext: Ext;
    private _origUpdateWindowPositions: any = null;

    constructor(ext: Ext) {
        this._ext = ext;
    }

    enable(): void {
        try {
            if (!WorkspaceLayout) return;

            const proto = WorkspaceLayout.prototype as any;
            this._origUpdateWindowPositions = proto._updateWindowPositions;

            const self = this;
            proto._updateWindowPositions = function (this: any, ...args: any[]) {
                // Always call original logic first to handle non-tiled windows and maintain internal Shell state.
                self._origUpdateWindowPositions.apply(this, args);

                // If extension is soft-disabled or auto-tiling is globally off, we don't override.
                if (self._ext._ext_soft_disabled) return;

                const previews = this._windowPreviews || [];
                if (previews.length === 0) return;

                const container = this._container;
                if (!container) return;

                // monitorIndex is a property of the Workspace actor in GNOME 40+
                const monitorIndex = container.monitorIndex;
                const monitorArea = self._ext.monitor_area(monitorIndex);
                if (!monitorArea) return;

                const containerWidth = container.width;
                const containerHeight = container.height;

                // Guard: if container or monitor has zero dimensions, skip to avoid NaN propagating into Clutter allocation (GNOME 50 crash)
                if (!containerWidth || !containerHeight ||
                    !monitorArea.width || !monitorArea.height) return;

                for (const preview of previews) {
                    const metaWin = preview.metaWindow;
                    if (!metaWin) continue;

                    // Only override for windows managed by O-Tiling that are currently tiled
                    const winEntity = self._ext.window_entity(metaWin);
                    if (!winEntity) continue;

                    const isTiled = self._ext.auto_tiler?.attached.contains(winEntity);
                    if (!isTiled) continue;

                    // Get actual desktop frame rect
                    const frameRect = metaWin.get_frame_rect();

                    // Calculate relative position/size based on the monitor area
                    const xRel = (frameRect.x - monitorArea.x) / monitorArea.width;
                    const yRel = (frameRect.y - monitorArea.y) / monitorArea.height;
                    const wRel = frameRect.width / monitorArea.width;
                    const hRel = frameRect.height / monitorArea.height;

                    // Map to the overview workspace card coordinates
                    const targetRect = {
                        x: xRel * containerWidth,
                        y: yRel * containerHeight,
                        width: wRel * containerWidth,
                        height: hRel * containerHeight,
                    };

                    // Guard: reject any rect containing NaN or Infinity before it reaches Clutter's allocation pipeline
                    if (!Number.isFinite(targetRect.x) || !Number.isFinite(targetRect.y) ||
                        !Number.isFinite(targetRect.width) || !Number.isFinite(targetRect.height)) {
                        continue;
                    }

                    preview._setTargetRect(targetRect, 1.0);
                }
            };
        } catch (e) {
            log.warn(`OverviewLayoutManager: failed to enable: ${e}`);
        }
    }


    disable(): void {
        if (this._origUpdateWindowPositions) {
            (WorkspaceLayout.prototype as any)._updateWindowPositions = this._origUpdateWindowPositions;
            this._origUpdateWindowPositions = null;
        }
    }
}
