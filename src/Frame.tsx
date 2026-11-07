import { useLayoutEffect, useRef, CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { FrameProps } from './types.js'
import { coverAllFrames, nextZIndex, registerFrame, syncCatchers } from './canvas.js'

const BORDER = 5 // five-pixel border around the header + viewport
const HEADER_HEIGHT = 32
// The resize grab zone: anywhere on the border (5px) plus five pixels inside it.
const RESIZE_ZONE = BORDER + 5
const MIN_W = 120
const MIN_H = 80

// Chrome theme colors. These must be distinct so the border is actually visible.
const COLOR_BORDER = '#444444'
const COLOR_HEADER = '#2d2d2d'
const COLOR_HEADER_TEXT = '#dddddd'
const COLOR_VIEWPORT = '#1e1e1e'

type Edges = { left: boolean; right: boolean; top: boolean; bottom: boolean }

export function Frame(props: FrameProps) {
    const outerRef = useRef<HTMLDivElement>(null)
    const catcherRef = useRef<HTMLDivElement>(null)
    // Current geometry. w/h are the VIEWPORT dimensions; x/y are canvas-relative.
    const geo = useRef({ x: props.x, y: props.y, w: props.width, h: props.height })
    // Freezes cursor updates during an active drag/resize.
    const draggingRef = useRef(false)

    // The catcher is hidden until registerFrame decides whether this frame is the frontmost.
    useLayoutEffect(() => registerFrame({
        getZIndex: () => Number(outerRef.current!.style.zIndex),
        setCatcher: (visible, cursor = '') => {
            const catcher = catcherRef.current!
            catcher.style.display = visible ? 'block' : 'none'
            catcher.style.cursor = cursor
        },
    }), [])

    const outerWidth = (w: number) => w + 2 * BORDER
    const outerHeight = (h: number) => h + HEADER_HEIGHT + 2 * BORDER

    function applyGeo(): void {
        const outer = outerRef.current
        if (!outer) return
        outer.style.left = geo.current.x + 'px'
        outer.style.top = geo.current.y + 'px'
        outer.style.width = outerWidth(geo.current.w) + 'px'
        outer.style.height = outerHeight(geo.current.h) + 'px'
    }

    function hitTest(clientX: number, clientY: number): Edges {
        const r = outerRef.current!.getBoundingClientRect()
        const lx = clientX - r.left
        const ly = clientY - r.top
        return {
            left: lx <= RESIZE_ZONE,
            right: lx >= r.width - RESIZE_ZONE,
            top: ly <= RESIZE_ZONE,
            bottom: ly >= r.height - RESIZE_ZONE,
        }
    }

    function cursorFor(e: Edges): string {
        if ((e.left && e.top) || (e.right && e.bottom)) return 'nwse-resize'
        if ((e.right && e.top) || (e.left && e.bottom)) return 'nesw-resize'
        if (e.left || e.right) return 'ew-resize'
        if (e.top || e.bottom) return 'ns-resize'
        return ''
    }

    // Rule 2: track the cursor in onMouseMove (bubble phase) on the outer div. Never use
    // React state for the cursor — write directly to outer.style.cursor.
    function onMouseMove(ev: ReactMouseEvent): void {
        if (draggingRef.current) return // Rule 3
        const outer = outerRef.current!
        const edges = hitTest(ev.clientX, ev.clientY)
        const c = cursorFor(edges)
        if (c) {
            outer.style.cursor = c
            return
        }
        // Over the header (the grab bar) but not an edge -> move cursor.
        const r = outer.getBoundingClientRect()
        const ly = ev.clientY - r.top
        outer.style.cursor = ly <= BORDER + HEADER_HEIGHT ? 'move' : 'default'
    }

    // Shared engine for dragging (no edges) and resizing (one or two edges).
    function startGesture(edges: Edges, startX: number, startY: number, cursor: string): void {
        draggingRef.current = true // Rule 3
        document.body.style.cursor = cursor // Rule 4: lock the cursor globally
        coverAllFrames(cursor) // Keep iframes from swallowing the gesture's mouse events.

        const start = { ...geo.current }
        const isResize = edges.left || edges.right || edges.top || edges.bottom

        function onMove(e: globalThis.MouseEvent): void {
            const dx = e.clientX - startX
            const dy = e.clientY - startY
            const outer = outerRef.current!

            if (isResize) {
                let { x, y, w, h } = start
                if (edges.right) w = Math.max(MIN_W, start.w + dx)
                if (edges.bottom) h = Math.max(MIN_H, start.h + dy)
                if (edges.left) {
                    // Rule 5: left resize keeps the opposite (right) edge fixed.
                    const newW = Math.max(MIN_W, start.w - dx)
                    x = start.x + (start.w - newW)
                    w = newW
                }
                if (edges.top) {
                    // Rule 5: top resize keeps the opposite (bottom) edge fixed.
                    const newH = Math.max(MIN_H, start.h - dy)
                    y = start.y + (start.h - newH)
                    h = newH
                }
                geo.current = { x, y, w, h }
            } else {
                // Header drag with bounds checking against the canvas.
                let nx = start.x + dx
                let ny = start.y + dy
                const canvas = outer.offsetParent as HTMLElement | null
                if (canvas) {
                    const cw = canvas.clientWidth
                    const ch = canvas.clientHeight
                    const ow = outerWidth(start.w)
                    // Left: right edge stays >= 30px from the left. Right: left edge <= cw-30.
                    nx = Math.max(30 - ow, Math.min(cw - 30, nx))
                    // Up: top stays >= 0. Down: bottom of header stays within the canvas.
                    ny = Math.max(0, Math.min(ch - (BORDER + HEADER_HEIGHT), ny))
                }
                geo.current = { ...geo.current, x: nx, y: ny }
            }
            applyGeo()
        }

        function onUp(): void {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            draggingRef.current = false // Rule 3
            document.body.style.cursor = '' // Rule 4 cleanup
            syncCatchers()
        }

        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    // Rule 1: onMouseDownCapture on the outer div fires before any child's bubble handler.
    // It raises this frame to the top of the stack, then intercepts edge clicks for resizing.
    function onMouseDownCapture(ev: ReactMouseEvent): void {
        outerRef.current!.style.zIndex = String(nextZIndex())
        syncCatchers()

        const edges = hitTest(ev.clientX, ev.clientY)
        const onEdge = edges.left || edges.right || edges.top || edges.bottom
        if (!onEdge) {
            // Non-edge click: let the header's drag handler fire normally.
            return
        }
        // Edge click: stop the header handler from also firing, then start the resize.
        ev.stopPropagation()
        startGesture(edges, ev.clientX, ev.clientY, cursorFor(edges) || 'default')
    }

    // Rule 6: the header drag handler lives on the header child (bubble phase). It is only
    // reached for non-edge clicks because the capture handler stops propagation on edges.
    function onHeaderMouseDown(ev: ReactMouseEvent): void {
        const noEdge: Edges = { left: false, right: false, top: false, bottom: false }
        startGesture(noEdge, ev.clientX, ev.clientY, 'move')
    }

    const outerStyle: CSSProperties = {
        position: 'absolute',
        left: props.x,
        top: props.y,
        width: outerWidth(props.width),
        height: outerHeight(props.height),
        zIndex: props.zIndex,
        background: COLOR_BORDER,
        boxSizing: 'border-box',
        padding: BORDER,
        overflow: 'hidden',
    }

    const innerStyle: CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
    }

    const headerStyle: CSSProperties = {
        height: HEADER_HEIGHT,
        flex: '0 0 auto',
        background: COLOR_HEADER,
        color: COLOR_HEADER_TEXT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        fontSize: 13,
        fontFamily: 'sans-serif',
        userSelect: 'none',
    }

    const viewportStyle: CSSProperties = {
        flex: '1 1 auto',
        background: COLOR_VIEWPORT,
        overflow: 'hidden',
        position: 'relative',
    }

    const catcherStyle: CSSProperties = {
        display: 'none',
        position: 'absolute',
        inset: 0,
        zIndex: 2147483647,
    }

    return (
        <div
            ref={outerRef}
            style={outerStyle}
            onMouseDownCapture={onMouseDownCapture}
            onMouseMove={onMouseMove}
        >
            <div style={innerStyle}>
                <div style={headerStyle} onMouseDown={onHeaderMouseDown}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {props.title}
                    </span>
                    {/* Rule 7: clicking a header button must not start a header drag. */}
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: 2 }}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {props.headerButtons}
                    </div>
                </div>
                <div style={viewportStyle}>
                    {props.children}
                    <div ref={catcherRef} style={catcherStyle} />
                </div>
            </div>
        </div>
    )
}
