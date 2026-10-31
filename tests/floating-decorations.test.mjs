import { test } from "node:test";
import assert from "node:assert/strict";
import { methods } from "./shell-methods.mjs";

const extPath = "src/extension.ts";
const winPath = "src/window/window.ts";
const stackPath = "src/engine/stack.ts";
test("floating drag hides the old border immediately", () => {
  const Subject = methods(extPath, "Ext", ["on_grab_start"]);
  const ext = new Subject();
  let hidden = 0;
  const win = {
    grab: false,
    hide_border: () => hidden++,
    is_tilable: () => false,
  };
  ext.get_window = () => win;
  ext.on_grab_start({}, 1);
  assert.equal(win.grab, true);
  assert.equal(hidden, 1);
});
test("floating drag end clears grab state and refreshes the border despite no tiling grab", () => {
  const Subject = methods(extPath, "Ext", ["on_grab_end"]);
  const ext = new Subject();
  let settled = 0;
  const win = { grab: true, mark_border_settling: () => settled++ };
  ext.get_window = () => win;
  ext.grab_op = null;
  ext.on_grab_end({}, 1);
  assert.equal(win.grab, false);
  assert.equal(settled, 1);
  ext.on_grab_end({}, 1);
  assert.equal(settled, 1, "duplicate drag-end must not restart settling");
});
function windowFixture() {
  const callbacks = [];
  const Subject = methods(winPath, "ShellWindow", ["show_border"], {
    GLib: {
      PRIORITY_DEFAULT: 0,
      SOURCE_REMOVE: false,
      source_remove() {},
      timeout_add(p, ms, cb) {
        callbacks.push(cb);
        return callbacks.length;
      },
    },
    ACTIVE_HINT_SHOW_ID: null,
  });
  const win = new Subject();
  win.grab = false;
  win._border_settle_id = null;
  win._border_pending_initial_tile = false;
  win.border = {
    visible: false,
    show() {
      this.visible = true;
    },
    hide() {
      this.visible = false;
    },
  };
  win.hide_border = () => win.border.hide();
  win.update_border_layout = () => {};
  win.update_border_style = () => {};
  win.restack = () => {};
  win.ext = {
    settings: {
      active_hint: () => true,
      active_hint_overlay_enabled: () => false,
    },
    focus_window: () => win,
  };
  win.actor_exists = () => true;
  win.is_maximized = () => false;
  win.smart_gapped = false;
  win.meta = {
    appears_focused: true,
    is_fullscreen: () => false,
    minimized: false,
  };
  return { win, callbacks };
}
test("focus events cannot show a border during a drag", () => {
  const { win } = windowFixture();
  win.grab = true;
  win.border.visible = true;
  win.show_border();
  assert.equal(win.border.visible, false);
});
test("a delayed show callback cannot revive the border after dragging begins", () => {
  const { win, callbacks } = windowFixture();
  win.show_border();
  assert.equal(win.border.visible, true);
  win.grab = true;
  win.border.hide();
  callbacks[0]();
  assert.equal(win.border.visible, false);
});
test("stack tabs follow final window order after the compositor restacks", () => {
  const callbacks = [];
  const Subject = methods(stackPath, "Stack", ["restack", "restack_now"], {
    lib: {
      later_add(type, cb) {
        callbacks.push(cb);
        return callbacks.length;
      },
      later_remove() {},
    },
    Meta: { LaterType: { BEFORE_REDRAW: 1 } },
    GLib: { SOURCE_REMOVE: false },
  });
  const stack = new Subject();
  stack._restack_id = null;
  let aboveFloating = true;
  stack.widgets = { tabs: { visible: true } };
  stack.is_disposed = () => false;
  stack.permitted_to_show = () => true;
  stack.on_grab = (cb) => cb();
  stack.reset_visibility = () => {};
  stack.reposition = () => {
    aboveFloating = false;
  };
  stack.restack();
  assert.equal(
    aboveFloating,
    true,
    "must defer until compositor order is final",
  );
  stack.restack();
  assert.equal(callbacks.length, 1, "coalesce repeated restack notifications");
  callbacks[0]();
  assert.equal(aboveFloating, false);
  assert.equal(stack._restack_id, null);
});
test("tabs stay immediately above their stack window and below floating windows", () => {
  const Subject = methods(stackPath, "Stack", ["reposition"]);
  const stack = new Subject();
  const children = [];
  const parent = {
    get_children: () => [...children],
    remove_child(a) {
      children.splice(children.indexOf(a), 1);
      a.parent = null;
    },
    add_child(a) {
      children.push(a);
      a.parent = this;
    },
    set_child_above_sibling(a, b) {
      this.remove_child(a);
      children.splice(children.indexOf(b) + 1, 0, a);
      a.parent = this;
    },
    set_child_below_sibling(a, b) {
      this.remove_child(a);
      children.splice(children.indexOf(b), 0, a);
      a.parent = this;
    },
  };
  const actor = (name) => ({
    name,
    parent,
    get_parent() {
      return this.parent;
    },
    show() {},
  });
  const stackActor = actor("stack");
  const float = actor("floating");
  const dialog = actor("dialog");
  const tabs = actor("tabs");
  children.push(stackActor, float, dialog, tabs);
  stack.widgets = { tabs };
  stack.is_disposed = () => false;
  stack.active = 1;
  stack.ext = {
    windows: new Map([
      [
        1,
        {
          meta: {
            get_compositor_private: () => stackActor,
            is_fullscreen: () => false,
          },
          is_maximized: () => false,
        },
      ],
    ]),
    maximized_on_active_display: () => false,
  };
  stack.reposition();
  assert.deepEqual(
    children.map((a) => a.name),
    ["stack", "tabs", "floating", "dialog"],
  );
  // Calling reposition repeatedly must not append tabs at the top of the layer.
  stack.reposition();
  assert.deepEqual(
    children.map((a) => a.name),
    ["stack", "tabs", "floating", "dialog"],
  );
});
test("destroying a stack cancels its queued restack callback", () => {
  const removed = [];
  let callback;
  const Subject = methods(
    stackPath,
    "Stack",
    ["restack", "restack_now", "destroy"],
    {
      lib: {
        later_add(t, cb) {
          callback = cb;
          return 9;
        },
        later_remove: (id) => removed.push(id),
      },
      Meta: { LaterType: { BEFORE_REDRAW: 1 } },
      GLib: { SOURCE_REMOVE: false },
      global: { display: { disconnect() {} } },
    },
  );
  const stack = new Subject();
  stack._restack_id = null;
  stack.active_disconnect = () => {};
  stack.tabs = [];
  stack.buttons = new Map();
  stack.widgets = { tabs: { destroy() {} } };
  stack.is_disposed = () => !stack.widgets;
  stack.restack();
  stack.destroy();
  assert.deepEqual(removed, [9]);
  assert.equal(stack.widgets, null);
  // Even a stale callback must not touch disposed actors.
  callback();
  assert.equal(stack._restack_id, null);
});
test("queued border restack cannot show or reposition the hint during a drag", () => {
  let callback;
  let layouts = 0;
  let hidden = 0;
  const Subject = methods(winPath, "ShellWindow", ["restack"], {
    RESTACK_STATE: { NORMAL: 0 },
    GLib: { SOURCE_REMOVE: false },
    lib: {
      later_add(type, cb) {
        callback = cb;
        return 1;
      },
      later_remove() {},
    },
    Meta: { LaterType: { BEFORE_REDRAW: 1 } },
  });
  const win = new Subject();
  win.grab = false;
  win._restack_id = null;
  win.border = {};
  win.update_border_layout = () => layouts++;
  win.hide_border = () => hidden++;
  win.meta = { is_fullscreen: () => false, minimized: false };
  win.is_maximized = () => false;
  win.restack();
  assert.equal(layouts, 1);
  win.grab = true;
  callback();
  assert.equal(layouts, 1);
  assert.equal(hidden, 1);
});
test("tiled drag end still runs tiling cleanup and border settling", () => {
  const Subject = methods(extPath, "Ext", ["on_grab_end"]);
  const ext = new Subject();
  let settled = 0;
  let dropped = 0;
  let cleaned = 0;
  const win = {
    grab: true,
    mark_border_settling: () => settled++,
    is_tilable: () => true,
  };
  ext.get_window = () => win;
  ext.grab_op = {};
  ext.on_grab_end_ = () => dropped++;
  ext.unset_grab_op = () => cleaned++;
  ext.on_grab_end({}, 1, {});
  assert.equal(win.grab, false);
  assert.equal(settled, 1);
  assert.equal(dropped, 1);
  assert.equal(cleaned, 1);
});
test("a pre-drag show timer cannot bypass post-drag settling", () => {
  const { win, callbacks } = windowFixture();
  win.show_border();
  win.border.hide();
  win.grab = false;
  win._border_settle_id = 99;
  callbacks[0]();
  assert.equal(win.border.visible, false);
});
test("post-drag settling accepts an already committed frame after one interval", () => {
  const callbacks = [];
  let shown = 0;
  const rect = { x: 20, y: 30, width: 400, height: 300 };
  const Subject = methods(
    winPath,
    "ShellWindow",
    ["mark_border_settling", "arm_border_settle"],
    {
      GLib: {
        PRIORITY_DEFAULT: 0,
        SOURCE_REMOVE: false,
        SOURCE_CONTINUE: true,
        source_remove() {},
        timeout_add(p, ms, cb) {
          callbacks.push(cb);
          return callbacks.length;
        },
      },
      BORDER_SETTLE_MAX_TRIES: 8,
    },
  );
  const win = new Subject();
  win._border_settle_id = null;
  win.hide_border = () => {};
  win.meta = { get_frame_rect: () => rect, is_fullscreen: () => false };
  win.actor_exists = () => true;
  win.border = {};
  win.ext = { focus_window: () => win };
  win.is_maximized = () => false;
  win.show_border = () => shown++;
  win.mark_border_settling(false);
  assert.equal(callbacks[0](), false);
  assert.equal(shown, 1);
});
for (const activeId of [1, 2, 3]) {
  test(`removing active tab ${activeId} immediately stops anchoring the stack to its floating window`, () => {
    const Subject = methods(
      stackPath,
      "Stack",
      ["remove_tab", "auto_activate"],
      { Ecs: { entity_eq: (a, b) => a === b } },
    );
    const stack = new Subject();
    stack.widgets = {};
    stack.tabs = [1, 2, 3].map((entity) => ({ entity }));
    stack.active = activeId;
    stack.active_id = activeId - 1;
    stack.prev_active = null;
    let disconnected = 0;
    let restacked = 0;
    stack.active_disconnect = () => disconnected++;
    stack.remove_tab_component = (c, idx) => stack.tabs.splice(idx, 1);
    stack.activate = (entity) => {
      stack.active = entity;
      stack.active_id = stack.tabs.findIndex((t) => t.entity === entity);
    };
    stack.restack = () => restacked++;
    assert.equal(stack.remove_tab(activeId), activeId - 1);
    assert.notEqual(stack.active, activeId);
    assert.ok(stack.tabs.some((t) => t.entity === stack.active));
    assert.equal(disconnected, 1);
    assert.equal(restacked, 1);
  });
}
test("removing an inactive tab preserves the active owner", () => {
  const Subject = methods(stackPath, "Stack", ["remove_tab", "auto_activate"], {
    Ecs: { entity_eq: (a, b) => a === b },
  });
  const stack = new Subject();
  stack.widgets = {};
  stack.tabs = [1, 2, 3].map((entity) => ({ entity }));
  stack.active = 3;
  stack.active_id = 2;
  stack.prev_active = null;
  stack.remove_tab_component = (c, idx) => stack.tabs.splice(idx, 1);
  stack.active_disconnect = () =>
    assert.fail("must not disconnect current owner");
  stack.activate = () => assert.fail("must not switch active tab");
  stack.restack = () => {};
  assert.equal(stack.remove_tab(1), 0);
  assert.equal(stack.active, 3);
  assert.equal(stack.active_id, 1);
});
