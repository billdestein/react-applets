import { useLayoutEffect, useRef, CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { FrameProps } from './types.js'
import { coverAllFrames, nextZIndex, registerFrame, syncCatchers } from './canvas.js'
import { cssVar, getGeometry } from './theme.js'

// The border width and header height come from the theme (see theme.ts) and are read at the
// moment they are needed, so setTheme can change them while frames are open.
// The resize grab zone: anywhere on the border plus five pixels inside it.
const RESIZE_INSET = 5
const MIN_W = 120
const MIN_H = 80

type Edges = { left: boolean; right: boolean; top: boolean; bottom: boolean }

export function Frame(props: FrameProps) {
    const outerRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)
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
        // data-active marks the frontmost frame, so hosts can style it with CSS.
        setActive: active => {
            const outer = outerRef.current!
            if (active) outer.setAttribute('data-active', '')
            else outer.removeAttribute('data-active')
        },
        relayout: () => {
            const { borderWidth, headerHeight } = getGeometry()
            outerRef.current!.style.padding = borderWidth + 'px'
            headerRef.current!.style.height = headerHeight + 'px'
            applyGeo()
        },
    }), [])

    const outerWidth = (w: number) => w + 2 * getGeometry().borderWidth
    const outerHeight = (h: number) => {
        const { borderWidth, headerHeight } = getGeometry()
        return h + headerHeight + 2 * borderWidth
    }

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
        const zone = getGeometry().borderWidth + RESIZE_INSET
        return {
            left: lx <= zone,
            right: lx >= r.width - zone,
            top: ly <= zone,
            bottom: ly >= r.height - zone,
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
        const { borderWidth, headerHeight } = getGeometry()
        outer.style.cursor = ly <= borderWidth + headerHeight ? 'move' : 'default'
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
                    const { borderWidth, headerHeight } = getGeometry()
                    ny = Math.max(0, Math.min(ch - (borderWidth + headerHeight), ny))
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

    // Geometry is rendered from geo rather than props, so a re-render after the user has moved
    // or resized the frame, or after setTheme, does not snap it back to its initial geometry.
    const { borderWidth, headerHeight } = getGeometry()
    const outerStyle: CSSProperties = {
        background: cssVar('borderColor'),
        ...props.style,
        position: 'absolute',
        left: geo.current.x,
        top: geo.current.y,
        width: outerWidth(geo.current.w),
        height: outerHeight(geo.current.h),
        zIndex: props.zIndex,
        boxSizing: 'border-box',
        padding: borderWidth,
        overflow: 'hidden',
    }

    const innerStyle: CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
    }

    const headerStyle: CSSProperties = {
        height: headerHeight,
        flex: '0 0 auto',
        background: cssVar('headerBackground'),
        color: cssVar('headerColor'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        fontSize: cssVar('fontSize'),
        fontFamily: cssVar('fontFamily'),
        userSelect: 'none',
    }

    const viewportStyle: CSSProperties = {
        flex: '1 1 auto',
        background: cssVar('viewportBackground'),
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
            className={props.className ? `ra-frame ${props.className}` : 'ra-frame'}
            style={outerStyle}
            onMouseDownCapture={onMouseDownCapture}
            onMouseMove={onMouseMove}
        >
            <div style={innerStyle}>
                <div ref={headerRef} className="ra-header" style={headerStyle} onMouseDown={onHeaderMouseDown}>
                    <span className="ra-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {props.title}
                    </span>
                    {/* Rule 7: clicking a header button must not start a header drag. */}
                    <div
                        className="ra-header-buttons"
                        style={{ display: 'flex', alignItems: 'center', gap: 2 }}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {props.headerButtons}
                    </div>
                </div>
                <div className="ra-viewport" style={viewportStyle}>
                    {props.children}
                    <div ref={catcherRef} style={catcherStyle} />
                </div>
            </div>
        </div>
    )
}
