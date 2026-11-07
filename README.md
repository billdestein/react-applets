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

### `setCanvas(id: string): void`

Uses the element with this id as the canvas. Call it once, before any `addApplet`.

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

### Types

`AppletProps`, `FrameProps`, and `AddAppletProps` are exported.

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
