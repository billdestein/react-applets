// Theming for the Applets windowing system.
//
// Each applet renders in its own React root, so React context from the host app never reaches
// the frames. Colors and fonts are therefore CSS custom properties: the Frame reads them with
// var(--ra-..., default), and because custom properties inherit through the DOM regardless of
// React roots, setting them on the canvas (in a stylesheet or through setTheme) themes every
// frame. Border width and header height are different: the Frame's drag and resize math needs
// them as numbers, so they live here in JS and can only be changed through setTheme.

export type Theme = {
    // Colors and fonts, applied as CSS custom properties.
    borderColor: string
    headerBackground: string
    headerColor: string
    viewportBackground: string
    modalOverlay: string
    fontFamily: string
    fontSize: string
    // Geometry in pixels, used by the Frame's layout and gesture math.
    borderWidth: number
    headerHeight: number
}

export const darkTheme: Theme = {
    borderColor: '#444444',
    headerBackground: '#2d2d2d',
    headerColor: '#dddddd',
    viewportBackground: '#1e1e1e',
    modalOverlay: 'rgba(128, 128, 128, 0.4)',
    fontFamily: 'sans-serif',
    fontSize: '13px',
    borderWidth: 5,
    headerHeight: 32,
}

export const lightTheme: Theme = {
    borderColor: '#c4c4c4',
    headerBackground: '#e8e8e8',
    headerColor: '#222222',
    viewportBackground: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.25)',
    fontFamily: 'sans-serif',
    fontSize: '13px',
    borderWidth: 5,
    headerHeight: 32,
}

type ColorKey = Exclude<keyof Theme, 'borderWidth' | 'headerHeight'>

export const cssVariables: Record<ColorKey, string> = {
    borderColor: '--ra-border-color',
    headerBackground: '--ra-header-background',
    headerColor: '--ra-header-color',
    viewportBackground: '--ra-viewport-background',
    modalOverlay: '--ra-modal-overlay',
    fontFamily: '--ra-font-family',
    fontSize: '--ra-font-size',
}

// The CSS value for a themed property: the custom property, falling back to the dark default.
export function cssVar(key: ColorKey): string {
    return `var(${cssVariables[key]}, ${darkTheme[key]})`
}

let geometry = { borderWidth: darkTheme.borderWidth, headerHeight: darkTheme.headerHeight }

export function getGeometry(): { borderWidth: number; headerHeight: number } {
    return geometry
}

// Writes the theme's colors and fonts onto el as custom properties and records its geometry.
// Only the keys present are written; any other custom property set by an earlier call is
// removed, so the value comes from the host's stylesheet or the dark default instead.
export function applyTheme(el: HTMLElement | null, theme: Partial<Theme>): void {
    geometry = {
        borderWidth: theme.borderWidth ?? darkTheme.borderWidth,
        headerHeight: theme.headerHeight ?? darkTheme.headerHeight,
    }
    if (!el) return
    for (const key of Object.keys(cssVariables) as ColorKey[]) {
        const value = theme[key]
        if (value === undefined) el.style.removeProperty(cssVariables[key])
        else el.style.setProperty(cssVariables[key], value)
    }
}
