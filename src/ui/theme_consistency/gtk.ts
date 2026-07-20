export function getGtkCss(style: 'rounded' | 'sharp'): string {
    const radius = style === 'rounded' ? '10px' : '0';

    return `
/* Rounded corners for normal floating windows */
window.main-window,
window.background,
window.main-window .base,
window.background .base,
window.main-window stack,
window.background stack,
dialog {
    border-radius: ${radius};
}

headerbar {
    border-radius: ${radius} ${radius} 0 0;
}

/* Remove rounded corners for maximized, tiled, snapped and fullscreen windows */
window.maximized,
window.tiled,
window.tiled-top,
window.tiled-bottom,
window.tiled-left,
window.tiled-right,
window.fullscreen,
window.maximized .main-window,
window.maximized .background,
window.maximized .base,
window.maximized stack,
window.tiled .main-window,
window.tiled .background,
window.tiled .base,
window.tiled stack,
window.fullscreen .main-window,
window.fullscreen .background {
    border-radius: 0;
}

window.maximized headerbar,
window.tiled headerbar,
window.tiled-top headerbar,
window.tiled-bottom headerbar,
window.tiled-left headerbar,
window.tiled-right headerbar,
window.fullscreen headerbar {
    border-radius: 0;
}
`;
}

// Backward compatibility
export const gtkCss = getGtkCss('rounded');
