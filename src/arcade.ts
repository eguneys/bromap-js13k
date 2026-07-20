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

export type ArcadePlayerState = 'idle' | 'fall' | 'jump-start' | 'jumping' | 'fall-start'
export class ArcadePlayer implements PositionBehavior {
    static create = () => {
        let res = new ArcadePlayer()

        res.body.minAccelH = 200
        res.body.maxAccelH = 400
        res.body.minSpeedH = 300
        res.body.maxSpeedH = 500

        res.body.minAccelV = 200
        res.body.maxAccelV = 400
        res.body.minSpeedV = 300
        res.body.maxSpeedV = 500

        return res
    }
    body: PositionVelocity = new PositionVelocity()

    butt!: ArcadePlayerButtonSigns
    coll!: ArcadePlayerCollisions

    state: ArcadePlayerState = 'idle'

    jumpingTimer = 0

    stateUpdates() {

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

        let { req_jump } = this.butt

        let coll_left = this.coll.get('l')
        let coll_right = this.coll.get('r')
        let coll_up = this.coll.get('u')
        let coll_down = this.coll.get('d')

        switch (this.state) {
            case 'jumping': {
                let drag = 10
                this.body.av -= drag

                if (this.jumpingTimer === 0) {
                    this.state = 'fall-start'
                }
            } break
            case 'jump-start': {
                this.body.avs = -1
                this.body.vvs = -1
                let jumpBoost = 120
                this.jumpingTimer = jumpBoost
                this.state = 'jumping'
            } break
            case 'fall': {
                if (coll_down?.gap === 0) {
                    this.state = 'idle'
                }
            } break
            case 'fall-start': {
                this.body.avs = 1
                this.body.vvs = 1
                this.state = 'fall'
            } break
            case 'idle': {
                if (req_h !== this.body.vhs) {
                    this.body.vhs = req_h as Sign
                }
                if (req_jump === 'just-down') {
                    this.state = 'jump-start'
                    break
                }
            } break
        }

        let gapEpsilon = 8

        if (coll_left && coll_left.gap < gapEpsilon) {
            if (this.body.vhs === -1) {
                this.body.vhs = 0

                this.body.x = Math.floor(this.body.x - coll_left.gap)
            }
        }
        if (coll_right && coll_right.gap < gapEpsilon) {
            if (this.body.vhs === 1) {
                this.body.vhs = 0
                this.body.x = Math.ceil(this.body.x + coll_right.gap)
            }
        }
        if (coll_up && coll_up.gap < gapEpsilon) {
            if (this.body.vvs === -1) {
                this.body.vvs = 0
                this.body.y = Math.floor(this.body.y - coll_up.gap)
            }
        }
        if (coll_down && coll_down.gap < gapEpsilon) {
            if (this.body.vvs === 1) {
                this.body.vvs = 0
                console.log(this.body.y, coll_down.gap, this.body.y + coll_down.gap)
                this.body.y = Math.ceil(this.body.y + coll_down.gap)
            }
        }
        console.log(this.body.y)

    }


    update(dt: number) {

        this.jumpingTimer = Math.max(0, this.jumpingTimer - dt)

        this.stateUpdates()

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

    update(_dt: number) {

    }
}

