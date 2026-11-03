import { ReactNode } from 'react'

// Passed by addApplet to an Applet component.
export type AppletProps = {
    appletId: number
    height: number
    isModal: boolean
    message: any
    width: number
    x: number
    y: number
    zIndex: number
}

// The Frame component's props. The Applet computes its title and header buttons and passes
// the geometry fields straight through. The Frame has no id of its own and does not read
// message.
export type FrameProps = {
    height: number
    isModal: boolean
    width: number
    x: number
    y: number
    zIndex: number
    title: string
    headerButtons: ReactNode
    children: ReactNode
}
