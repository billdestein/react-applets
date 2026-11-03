import { createElement, ComponentType } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { AppletProps } from './types.js'

// The canvas is a single position:relative div in the host app. Each frame is mounted into
// its own plain unpositioned div (frameEl) appended to the canvas — invisible infrastructure
// that serves only as a ReactDOM.createRoot mount point. This keeps each frame in its own
// React tree so dragging one frame does not re-render the others.

let canvasEl: HTMLElement | null = null
let nextAppletId = 1
let topZIndex = 0

type AppletRecord = {
    appletId: number
    frameEl: HTMLDivElement
    root: Root
    isModal: boolean
    clickCatcher?: HTMLDivElement
    x: number
    y: number
    zIndex: number
}

const applets = new Map<number, AppletRecord>()

// Props accepted by addApplet; appletId, zIndex, and (when omitted) x/y are computed here.
export type AddAppletProps = {
    height?: number
    isModal?: boolean
    message?: any
    width?: number
    x?: number
    y?: number
}

export function setCanvas(id: string): void {
    const el = document.getElementById(id)
    if (!el) throw new Error(`setCanvas: no element found with id "${id}"`)
    canvasEl = el
}

// Returns a fresh z-index that is greater than every frame currently on the canvas. The
// Frame calls this on mouse-down to raise itself to the top of the stack.
export function nextZIndex(): number {
    topZIndex += 1
    return topZIndex
}

export function addApplet(
    AppletComponent: ComponentType<AppletProps>,
    props: AddAppletProps = {},
): number {
    if (!canvasEl) throw new Error('addApplet: canvas not set — call setCanvas first')

    const appletId = nextAppletId++
    const isModal = props.isModal ?? false
    const height = props.height ?? 600
    const width = props.width ?? 800

    // Find the topmost frame currently on the canvas (nearest in z order).
    let topFrame: AppletRecord | undefined
    for (const rec of applets.values()) {
        if (!topFrame || rec.zIndex > topFrame.zIndex) topFrame = rec
    }

    let x = props.x ?? (topFrame ? topFrame.x + 50 : 50)
    let y = props.y ?? (topFrame ? topFrame.y + 50 : 50)

    let clickCatcher: HTMLDivElement | undefined
    let zIndex: number

    if (isModal) {
        // Add a translucent click catcher that blocks all pointer events behind the modal.
        const catcherZ = topZIndex + 1
        clickCatcher = document.createElement('div')
        clickCatcher.style.position = 'absolute'
        clickCatcher.style.left = '0'
        clickCatcher.style.top = '0'
        clickCatcher.style.width = '100%'
        clickCatcher.style.height = '100%'
        clickCatcher.style.background = 'rgba(128, 128, 128, 0.4)'
        clickCatcher.style.zIndex = String(catcherZ)
        // Do NOT set pointer-events:none — we want it to block, not pass through.
        canvasEl.appendChild(clickCatcher)

        zIndex = catcherZ + 1
        topZIndex = zIndex

        // The modal frame is centered on the canvas; its x/y props are ignored.
        x = Math.max(0, Math.floor((canvasEl.clientWidth - width) / 2))
        y = Math.max(0, Math.floor((canvasEl.clientHeight - height) / 2))
    } else {
        zIndex = nextZIndex()
    }

    // frameEl must have NO position/left/top — it is invisible infrastructure. All
    // positioning lives on the outer div inside the Frame component. Because frameEl is an
    // unpositioned child of the position:relative canvas, the Frame's absolutely-positioned
    // outer div resolves its offsetLeft/offsetTop against the canvas, as required for drag
    // bounds checking.
    const frameEl = document.createElement('div')
    canvasEl.appendChild(frameEl)

    const root = createRoot(frameEl)
    const fullProps: AppletProps = {
        appletId,
        height,
        isModal,
        message: props.message,
        width,
        x,
        y,
        zIndex,
    }
    root.render(createElement(AppletComponent, fullProps))

    applets.set(appletId, { appletId, frameEl, root, isModal, clickCatcher, x, y, zIndex })
    return appletId
}

export function removeApplet(appletId: number): void {
    const rec = applets.get(appletId)
    if (!rec) return

    // Unmount asynchronously to avoid React's "synchronous unmount during render" warning
    // when removeApplet is called from within an event handler in the applet's own tree.
    const { root, frameEl, clickCatcher } = rec
    setTimeout(() => {
        root.unmount()
        if (frameEl.parentNode) frameEl.parentNode.removeChild(frameEl)
        if (clickCatcher && clickCatcher.parentNode) {
            clickCatcher.parentNode.removeChild(clickCatcher)
        }
    }, 0)

    applets.delete(appletId)
}
