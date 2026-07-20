import { log_horizontal, log_vertical } from "./debug"
import type { ActionSign } from "./keyboard"

export class PositionVelocity {

    x = 0
    y = 0

    vhs: Sign = 0
    vh = 0

    vv = 0
    vvs: Sign = 0

    ahs: Sign = 0
    ah = 0

    avs: Sign = 0
    av = 0

    minSpeedV = 0
    maxSpeedV = 0

    minAccelV = 0
    maxAccelV = 0

    minSpeedH = 0
    maxSpeedH = 0

    minAccelH = 0
    maxAccelH = 0

    private vertical_updates(dt: number) {
        let dtSec = dt * 0.001

        this.av = Math.max(this.minAccelV, Math.min(this.maxAccelV, this.av))

        this.vv += this.avs * this.av * dtSec

        this.vv = Math.max(this.minSpeedV, Math.min(this.maxSpeedV, this.vv))

        this.y += this.vvs * this.vv * dtSec
    }

    private horizontal_updates(dt: number) {
        let dtSec = dt * 0.001

        this.ah = Math.max(this.minAccelH, Math.min(this.maxAccelH, this.ah))

        this.vh += this.ahs * this.ah * dtSec

        this.vh = Math.max(this.minSpeedH, Math.min(this.maxSpeedH, this.vh))

        this.x += this.vhs * this.vh * dtSec
    }


    update(dt: number) {
        this.horizontal_updates(dt)
        this.vertical_updates(dt)
    }
}

export interface PositionBehavior {
    body: PositionVelocity
    update(dt: number): void
}


export type Sign = 1 | -1 | 0
export const epsilon = 0.5
export const large_epsilon = 2

export type ArcadePlayerButtonSigns = {
    req_left: ActionSign
    req_right: ActionSign
    req_jump: ActionSign
}

export type CollisionManifold = {
    gap: number
}
export type CollisionSource = 'u' | 'l' | 'd' | 'r' | 'ul' | 'ur' | 'dl' | 'dr'
export type ArcadePlayerCollisions = Map<CollisionSource, CollisionManifold>

export type ArcadePlayerState = 'idle'
export class ArcadePlayer implements PositionBehavior {
    static create = () => { return new ArcadePlayer() }
    body: PositionVelocity = new PositionVelocity()

    butt!: ArcadePlayerButtonSigns
    coll!: ArcadePlayerCollisions

    state: ArcadePlayerState = 'idle'

    update(dt: number) {

        let { req_left, req_right } = this.butt

        let just_req_h: Sign = 0
        let req_h: Sign = 0
        let just_stop_h: Sign = 0
        if (req_left === 'just-down') {
            just_req_h += -1
        } else if (req_left === 'down') {
            req_h += -1
        } else if (req_left === 'just-up') {
            just_stop_h += -1
        }
        if (req_right === 'just-down') {
            just_req_h += 1
        } else if (req_right === 'down') {
            req_h += 1
        } else if (req_right === 'just-up') {
            just_stop_h += 1
        }

        switch (this.state) {
            case 'idle': {
                if (req_h !== this.body.vhs) {
                }
            } break
        }

        this.body.update(dt)
    }

}





type ArcadeCameraMovement = 'idle' | 'moving' | 'pivot' | 'stick'
export class ArcadeCameraCruise implements PositionBehavior {

    static create = () => {
        let res = new ArcadeCameraCruise()

        res.body = new PositionVelocity()

        res.body.minAccelH = 200
        res.body.maxAccelH = 300
        res.body.minSpeedH = 200
        res.body.maxSpeedH = 3000
        return res
    }

    body!: PositionVelocity

    horizontal: ArcadeCameraMovement = 'idle'
    vertical: ArcadeCameraMovement = 'idle'

    text: string[] = []

    update(_dt: number) {

        if (import.meta.env.DEV) {
            let text = log_vertical(this.body, `${this.vertical}`.padEnd(8))
            text = log_horizontal(this.body, `${this.horizontal}`.padEnd(8))
            this.text.push(text)
            if (this.text.length > 3)
                this.text.shift()
        }
    }
}

