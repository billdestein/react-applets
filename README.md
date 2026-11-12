# react-applets

A lightweight windowing system for React. Put a canvas `div` in your app, then open
**applets** on it: draggable, resizable, stackable frames, each rendered in its own React
root so moving one window never re-renders the others. Modal applets are supported too.

## Install

```bash
npm install react-applets
```

Requires `react` and `react-dom` 18 or 19. The package is ESM-only and ships TypeScript types.

## Quick start

```tsx
import { useEffect } from 'react'
import { setCanvas, addApplet, removeApplet, Frame, type AppletProps } from 'react-applets'

// An Applet is a component that renders a Frame.
function HelloApplet(props: AppletProps) {
    const close = <button onClick={() => removeApplet(props.appletId)}>✕</button>
    return (
        <Frame {...props} title={`Hello ${props.message.name}`} headerButtons={close}>
            <div style={{ color: 'white', padding: 12 }}>Drag me by the header, resize me from any edge.</div>
        </Frame>
    )
}

export function App() {
    useEffect(() => {
        setCanvas('canvas')
        addApplet(HelloApplet, { message: { name: 'world' }, width: 400, height: 250 })
    }, [])

    return <div id="canvas" style={{ position: 'relative', width: '100vw', height: '100vh' }} />
}
```

The canvas must be `position: relative`; frames are absolutely positioned inside it.

## API

### `setCanvas(id: string, options?: { theme?: Partial<Theme> }): void`

Uses the element with this id as the canvas. Call it once, before any `addApplet`. Pass a
theme to style the frames (see [Theming](#theming)).

### `setTheme(theme: Partial<Theme>): void`

Restyles every frame, including ones already open. See [Theming](#theming).

### `addApplet(Applet, props?): number`

Mounts `Applet` (a `ComponentType<AppletProps>`) on the canvas and returns its `appletId`.
All props are optional:

| Prop      | Default | Meaning |
|-----------|---------|---------|
| `width`   | `800`   | Initial viewport width in pixels |
| `height`  | `600`   | Initial viewport height in pixels |
| `x`, `y`  | top frame + 50 | Initial position relative to the canvas |
| `isModal` | `false` | Centers the frame and blocks clicks behind it with a translucent overlay |
| `message` | `undefined` | Opaque data passed through to your Applet |

### `removeApplet(appletId: number): void`

Unmounts the applet (and its modal overlay, if any).

### `<Frame>`

The window chrome. Pass through the geometry fields from `AppletProps` (spreading `{...props}`
is simplest) plus:

- `title: string`, shown left-aligned in the header
- `headerButtons: ReactNode`, shown right-aligned in the header (for example a close button)
- `children: ReactNode`, the window contents
- `className?: string` and `style?: CSSProperties`, applied to the frame's outer element for
  styling one applet differently. Position, size and stacking always come from the Frame.

### Types

`AppletProps`, `FrameProps`, `AddAppletProps`, `CanvasOptions`, and `Theme` are exported.

## Theming

Frames use a dark theme by default. Every applet renders in its own React root, so React
context from your app can't reach the frames; theming uses CSS custom properties instead, which
pass through the DOM to every frame.

### With CSS

Set any of these on the canvas, in a stylesheet or a media query:

```css
#canvas {
    --ra-border-color: #c4c4c4;
    --ra-header-background: #e8e8e8;
    --ra-header-color: #222222;
    --ra-viewport-background: #ffffff;
    --ra-modal-overlay: rgba(0, 0, 0, 0.25);
    --ra-font-family: system-ui, sans-serif;
    --ra-font-size: 13px;
}
```

### With JavaScript

```ts
import { setCanvas, setTheme, darkTheme, lightTheme } from 'react-applets'

setCanvas('canvas', { theme: lightTheme })
setTheme({ ...darkTheme, headerBackground: '#1d3b5a' })
```

`setTheme` takes a `Partial<Theme>`. It replaces the previous call's theme; keys you leave out
come from your stylesheet or, failing that, the dark defaults. Its color and font keys are
written as the custom properties above on the canvas element, so they win over a stylesheet.

| Key                  | CSS variable               | Dark default |
|----------------------|----------------------------|--------------|
| `borderColor`        | `--ra-border-color`        | `#444444` |
| `headerBackground`   | `--ra-header-background`   | `#2d2d2d` |
| `headerColor`        | `--ra-header-color`        | `#dddddd` |
| `viewportBackground` | `--ra-viewport-background` | `#1e1e1e` |
| `modalOverlay`       | `--ra-modal-overlay`       | `rgba(128, 128, 128, 0.4)` |
| `fontFamily`         | `--ra-font-family`         | `sans-serif` |
| `fontSize`           | `--ra-font-size`           | `13px` |
| `borderWidth`        | none, JavaScript only      | `5` |
| `headerHeight`       | none, JavaScript only      | `32` |

`borderWidth` and `headerHeight` are numbers of pixels and can only be set from JavaScript,
because dragging and resizing are calculated from them.

### Styling individual frames and the front frame

Frames carry stable class names: `ra-frame`, `ra-header`, `ra-title`, `ra-header-buttons` and
`ra-viewport`, plus `ra-modal-overlay` on the modal backdrop. The frontmost frame also has a
`data-active` attribute. Because the frame's colors are set inline, change them by setting the
custom properties rather than `background`:

```css
/* Dim the headers of frames that aren't in front. */
.ra-frame:not([data-active]) { --ra-header-color: #888888; }

/* A single applet with its own colors: <Frame className="alert" ...> */
.ra-frame.alert { --ra-header-background: #7a1f1f; }
```

## Behavior

- Drag a frame by its header. It stays reachable: it cannot go above the canvas top, and at
  least 30px stays on screen horizontally.
- Resize from any edge or corner (the 5px border plus 5px inside it).
- Clicking anywhere in a frame raises it to the top. This works even when the frame contains
  an iframe or webview, because every frame except the frontmost has an invisible click catcher
  over its body. As a result, the first click on a background frame only raises it; the click
  does not reach the frame's contents.
- Iframes don't interrupt dragging or resizing, because every frame body is covered while the
  gesture is in progress.
- Dragging and resizing update the DOM directly, with no React re-renders.

## License

MIT
