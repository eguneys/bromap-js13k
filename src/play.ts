import { box_area, box_intersects, box_intersectsRegion, type Box, type Vec2 } from "./collision"
import { log_horizontal, log_vertical } from "./debug"
import { Keyboard, type Action } from "./keyboard"
import { decode2 } from "./map_packer"

let managers: Managers

export function _init() {
    managers = Managers.loadEverything()
}

let first_update_called = false
export function _update(dt: number) {

    first_update_called = true

    managers.update(dt)

    keyboard.update()
}

export function _render() {
    if (!first_update_called) return

    let sx = vwidth / 640
    let sy = vheight / 360
    cx.setTransform(sx, 0, 0, sy, 0, 0)

    managers.render()
}

function draw_tile(n: number, x: number, y: number) {
    let sx = (n % 16) * 16
    let sy = Math.floor(n / 16) * 16
    let sw = 16
    let sh = 16
    let scale = 2
    cx.drawImage(tile_png, sx, sy, sw, sh, x, y, sw * scale, sh * scale)
}



function draw_bg(sx: number, sy: number, sw: number, sh: number, x: number, y: number, scale: number) {
    cx.drawImage(bg_png, sx, sy, sw, sh, x, y, sw * scale, sh * scale)
}

function draw_spr(sx: number, sy: number, sw: number, sh: number, x: number, y: number, scale_x: number, scale_y: number) {
    cx.drawImage(spr_png, sx, sy, sw, sh, x, y, sw * scale_x, sh * scale_y)
}

class Animation {

    fps = 7.2

    t = 0
    frame = 0
    public dest: Box = { x: 0, y: 0, w: 1, h: 1 }
    constructor(readonly source: Box, readonly frames: number[]) { }

    update(dt: number) {
        this.t += dt

        let frame_durationMs = 1000 / this.fps
        let elapsed_frames = this.t / frame_durationMs

        if (elapsed_frames > 1) {
            let leftover_frames = elapsed_frames % frame_durationMs
            this.t = leftover_frames
            this.frame += 1
            if (this.frame === this.frames.length) {
                this.frame = 0
            }
        }
    }

    render() {

        let sw = this.source.w
        let sh = this.source.h
        let sx = this.source.x + this.frames[this.frame] * sw
        let sy = this.source.y
        let dx = this.dest.x
        let dy = this.dest.y
        let w = this.dest.w
        let h = this.dest.h
        draw_spr(sx, sy, sw, sh, dx, dy, w, h)
    }
}

class AnimationManager {

    static fromFrames(data: [string, Box, number[]][]) {
        let frames = new Map()
        for (let item of data) {
            let [name, box, fs] = item

            frames.set(name, new Animation(box, fs))
        }
        return new AnimationManager(frames)
    }

    position: Vec2 = { x: 0, y: 0 }
    scale: Vec2 = { x: 1, y: 1 }
    active!: string
    private constructor(readonly frames: Map<string, Animation>) { }

    setActive(name: string) {
        this.active = name
        this.setScale(this.scale.x, this.scale.y)
        this.setPosition(this.position.x, this.position.y)
    }

    setScale(x: number, y: number) {
        this.scale = { x, y }
        this.frames.get(this.active)!.dest.w = this.scale.x
        this.frames.get(this.active)!.dest.h = this.scale.y
    }

    setPosition(x: number, y: number) {
        this.position = { x, y }
        this.frames.get(this.active)!.dest.x = this.position.x
        this.frames.get(this.active)!.dest.y = this.position.y
    }

    update(dt: number) {
        this.frames.get(this.active)!.update(dt)
    }

    render() {
        this.frames.get(this.active)!.render()
    }

}

class MovableAnimationWithBoxRelativeToCamera {

    frustum!: Box
    constructor(readonly box: Box, readonly animation: AnimationManager) {

    }

    setFrustum(frustum: Box) {
        this.frustum = frustum
        let x = this.box.x - this.frustum.x
        let y = this.box.y + 16 - this.box.h - 8 - this.frustum.y
        this.animation.setPosition(x, y)
    }

    update(dt: number) {
        this.animation.update(dt)
    }

    render() {
        this.animation.render()
    }
}

type ActionSign = 'just-down' | 'just-up' | 'up' | 'down'
type Sign = 1 | -1 | 0
const epsilon = 0.5
const large_epsilon = 16


abstract class PositionBehavior {
    body!: PositionVelocity
    abstract update(dt: number): void
    abstract initBody(body: PositionVelocity): void
}

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

    static create = (beh: PositionBehavior) => {
        let res = new PositionVelocity()
        res.setBehavior(beh)
        return res
    }

    beh!: PositionBehavior

    setBehavior(beh: PositionBehavior) {
        this.beh = beh
        beh.initBody(this)
    }

    vertical_updates(dt: number) {
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

class StillBehavior extends PositionBehavior {
    static get Zero() { return new StillBehavior() }
    update(_dt: number) { }
    initBody(body: PositionVelocity) { this.body = body }
}



type ArcadeCameraMovement = 'idle' | 'moving' | 'pivot' | 'stick'
class ArcadeCameraCruise extends StillBehavior {

    override initBody(body: PositionVelocity) {
        super.initBody(body)

        body.minAccelH = 200
        body.maxAccelH = 300
        body.minSpeedH = 200
        body.maxSpeedH = 3000
    }

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

    cruise_horizontal(req_stop: boolean, req_h: Sign) {
        switch (this.horizontal) {
            case 'stick': {
                if (!req_stop) {
                    this.horizontal = 'idle'
                }
            } break
            case 'idle': {
                let drag = 10
                this.body.ah -= drag
                if (req_h !== 0) {
                    this.body.vhs = req_h
                    this.body.ahs = 1
                    this.horizontal = 'moving'
                }
            } break
            case 'moving': {

                if (req_stop) {
                    this.body.ahs = -1
                    this.body.vhs = req_h
                    this.body.ah = this.body.minAccelH
                    this.horizontal = 'stick'
                    break
                }

                let momentum = 10
                this.body.ah += momentum

                if (req_h === 0) {
                    this.body.ahs = -1
                }
                if (this.body.vhs - this.body.minSpeedH < epsilon) {
                    if (req_h === 0) {
                        this.body.vhs = 0
                        this.horizontal = 'idle'
                    }
                }
                if (req_h !== this.body.vhs) {
                    this.horizontal = 'pivot'
                    this.body.ahs = -1
                }
            } break
            case 'pivot': {
                if (this.body.vhs - this.body.minSpeedH < epsilon) {
                    if (req_h === 0) {
                        this.body.vhs = 0
                        this.horizontal = 'idle'
                    } else {
                        this.body.vhs = req_h
                        this.horizontal = 'moving'
                    }
                }
            }
        }

    }


    cruise_vertical(_req_h: Sign) {
    }
}

type ArcadeHorizontalMovement = 'idle' | 'pivot' | 'moving' | 'hitwall'
type ArcadeVerticalMovement = 'idle' | 'fall' | 'jumping' | 'landing' | 'jump-boost-start'
class ArcadePlayer extends StillBehavior {


    v_text: string[] = []
    h_text: string[] = []

    minAccelH = 200
    maxAccelH = 400
    minSpeedH = 200
    maxSpeedH = 400

    minAccelV = 200
    maxAccelV = 400
    minSpeedV = 200
    maxSpeedV = 400


    horizontal: ArcadeHorizontalMovement = 'idle'
    vertical: ArcadeVerticalMovement = 'idle'

    constructor(readonly player: Player) {
        super()
    }

    tempBoostAccelH = 0
    tempBoostAccelV = 0

    tempBoostSpeedV = 0

    landingFloatTimer = 0
    landedStumbleTimer = 0

    jumpBufferTimer = 0

    get justLanded() {
        return this.landedStumbleTimer > 0
    }

    update(dt: number) {

        if (import.meta.env.DEV) {
            let v_text = log_vertical(this.body, `${this.vertical}`.padEnd(8))
            let h_text = log_horizontal(this.body, `${this.horizontal}`.padEnd(8))
            this.v_text.push(v_text)
            if (this.v_text.length > 3)
                this.v_text.shift()
            this.h_text.push(h_text)
            if (this.h_text.length > 3)
                this.h_text.shift()
        }

        this.tempBoostAccelH = Math.max(0, this.tempBoostAccelH - dt)
        this.tempBoostAccelV = Math.max(0, this.tempBoostAccelV - dt)

        this.tempBoostSpeedV = Math.max(0, this.tempBoostSpeedV - dt)

        this.landingFloatTimer = Math.max(0, this.landingFloatTimer - dt)
        this.landedStumbleTimer = Math.max(0, this.landedStumbleTimer - dt)

        this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt)

        let multMinAccelH = 1,
            multMaxAccelH = 1,
            multMinSpeedH = 1,
            multMaxSpeedH = 1

        if (this.tempBoostAccelH > 0) {
            multMaxAccelH *= 2
        }

        this.body.minAccelH = this.minAccelH * multMinAccelH
        this.body.maxAccelH = this.maxAccelH * multMaxAccelH
        this.body.minSpeedH = this.minSpeedH * multMinSpeedH
        this.body.maxSpeedH = this.maxSpeedH * multMaxSpeedH



        let multMinAccelV = 1,
            multMaxAccelV = 1,
            multMinSpeedV = 1,
            multMaxSpeedV = 1

        if (this.tempBoostAccelV > 0) {
            multMaxAccelV *= 2
        }

        if (this.tempBoostSpeedV > 0) {
            multMaxSpeedV *= 2
        }


        this.body.minAccelV = this.minAccelV * multMinAccelV
        this.body.maxAccelV = this.maxAccelV * multMaxAccelV
        this.body.minSpeedV = this.minSpeedV * multMinSpeedV
        this.body.maxSpeedV = this.maxSpeedV * multMaxSpeedV
    }

    cruise_vertical(req_fall: boolean, req_j: ActionSign) {

        switch (this.vertical) {
            case 'landing': {
                let smooth_float = 300
                this.body.av -= smooth_float

                if (this.landingFloatTimer === 0) {
                    this.vertical = 'fall'
                }
            } break
            case 'jumping': {
                let drag = 30
                this.body.av += drag
                if (this.body.vv - this.body.minSpeedV < epsilon) {
                    this.body.vvs = 1
                    this.body.avs = 1
                    this.body.av = this.body.minAccelV
                    this.vertical = 'landing'
                    this.landingFloatTimer = 200
                }
            } break
            case 'idle': {
                let smooth = 30
                this.body.vv -= smooth
                this.body.av -= smooth
                if (req_fall) {
                    this.vertical = 'fall'
                }

                if (req_j === 'just-down') {
                    this.vertical = 'jump-boost-start'
                    break
                }
            } break
            case 'jump-boost-start': {
                this.body.avs = -1
                this.body.av = this.body.minAccelV

                let jump_boost = 100

                this.body.vvs = -1
                this.body.vv = this.body.maxSpeedV + jump_boost

                this.tempBoostSpeedV = 30
                this.vertical = 'jumping'
            } break
            case 'fall': {
                this.body.vvs = 1
                this.body.avs = 1
                let gravity_falls = 7
                this.body.av += gravity_falls

                if (req_j === 'just-down') {
                    this.jumpBufferTimer = 500
                }

                if (!req_fall) {

                    if (this.jumpBufferTimer > 0) {
                        this.vertical = 'jump-boost-start'
                        break
                    }



                    this.body.vv = 0
                    this.body.av = 0
                    this.landedStumbleTimer = 60
                    this.vertical = 'idle'
                }
            } break
        }
    }

    cruise_horizontal(req_hitwall: Sign, req_left: ActionSign, req_right: ActionSign) {

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

        switch (this.horizontal) {
            case 'idle': {
                let drag = 10
                this.body.ahs = -1
                this.body.ah -= drag

                if (just_req_h !== this.body.vhs) {
                    this.body.vhs = just_req_h as Sign
                    this.body.ahs = 1
                    let boost = 530
                    this.body.ah += boost
                    this.horizontal = 'moving'
                    break
                }
                if (req_h !== this.body.vhs) {
                    this.body.vhs = req_h as Sign
                    this.body.ahs = 1
                    let boost = 330
                    this.body.ah += boost
                    this.horizontal = 'moving'
                    break
                }
            } break
            case 'hitwall': {
                // ahs = req_hitwall
                if (req_h !== this.body.ahs) {
                    if (req_h === 0) {
                        this.horizontal = 'idle'
                    } else {
                        this.body.vhs = req_h as Sign
                        this.horizontal = 'moving'
                    }
                }
            } break
            case 'moving': {
                let drag = 7
                this.body.ah -= drag

                if (req_hitwall) {
                    this.body.vhs = 0
                    this.body.vh = 0
                    this.body.ah = 0
                    this.body.ahs = req_hitwall
                    this.horizontal = 'hitwall'
                    break
                }

                if (just_req_h === this.body.vhs) {
                    this.body.ah += 170
                } else if (req_h === this.body.vhs) {
                    this.body.ah += 70
                } else {
                    if (this.body.vh - this.body.minAccelV < epsilon) {
                        // still

                        if (req_h === 0) {
                            this.body.vhs = 0
                            this.body.ahs = 0
                            this.horizontal = 'idle'
                        } else {

                        }
                    } else {
                        // moving

                        if (req_h === 0) {
                            // request stop
                            this.body.ahs = -1
                            let brake = 300
                            this.body.ah += brake
                            this.tempBoostAccelH = 30
                        } else {
                            // request pivot
                            this.horizontal = 'pivot'
                        }
                    }
                }

                if (just_stop_h === this.body.vhs) {
                    this.body.ahs = -this.body.vhs as Sign
                }

            } break
            case 'pivot': {
                this.tempBoostAccelH = 30
                this.body.ahs = -1

                let twitch = 100
                this.body.ah += twitch
                if (this.body.vh - this.body.minSpeedH < epsilon) {
                    this.body.vhs = req_h as Sign
                    this.body.ahs = 1

                    if (this.body.vhs === 0) {
                        this.horizontal = 'idle'
                    } else {
                        this.horizontal = 'moving'
                    }
                }
            } break
        }
    }



}


class GridCollider {

    constructor(readonly grid_x: number, readonly grid_y: number, readonly grid: boolean[][]) { }

    resolve_y(box: Box, boxFu: Box): [Sign, number] | undefined {

        let y_start = Math.floor(Math.min(box.y, boxFu.y))
        let y_end = Math.ceil(Math.max(box.y, boxFu.y))

        for (let y = y_start; y < y_end; y++) {
            let ci = this.find_collision_index({ x: box.x, y, w: box.w, h: box.h })
            if (ci !== undefined) {
                let edge_up = ci[1] * 32
                let edge_down = edge_up + 32

                if (Math.abs(box.y - this.grid_y - edge_down) < Math.abs(box.y - this.grid_y + box.h - edge_up)) {
                    return [-1, edge_down + this.grid_y]
                } else {
                    return [1, edge_up - box.h + this.grid_y]
                }

                return [0, 0]
            }
            /*
            if (this.find_collision_index({ x: box.x, y, w: box.w, h: box.h }) !== undefined) {
                if (Math.abs(y - box.y) < Math.abs(y - boxFu.y)) {
                    let sign: Sign = y - box.y < y - box.y - box.h ? 1 : -1
                    return [sign, y + sign]
                } else {
                    let sign: Sign = y - box.y < y - box.y - box.h ? 1 : -1
                    return [sign as Sign, y + sign]
                }
            }
                */
        }
    }

    resolve_x(box: Box, boxFu: Box): [Sign, number] | undefined {

        let x_start = Math.floor(Math.min(box.x, boxFu.x))
        let x_end = Math.ceil(Math.max(box.x, boxFu.x))

        for (let x = x_start; x < x_end; x++) {
            let ci = this.find_collision_index({ x, y: box.y, w: box.w, h: box.h })
            if (ci !== undefined) {
                let edge_left = ci[0] * 32
                let edge_right = edge_left + 32

                if (Math.abs(box.x - this.grid_x - edge_right) < Math.abs(box.x - this.grid_x + box.w - edge_left)) {
                    return [-1, edge_right + this.grid_x]
                } else {
                    return [1, edge_left - box.w + this.grid_x]
                }

                return [0, 0]
            }
        }
    }

    private find_collision_index(box: Box) {

        let on_grid_x = box.x - this.grid_x
        let on_grid_y = box.y - this.grid_y

        let i_left = Math.floor(on_grid_x / 32)
        let i_right = Math.ceil((on_grid_x + box.w) / 32)

        let j_up = Math.floor(on_grid_y / 32)
        let j_down = Math.ceil((on_grid_y + box.h) / 32)

        for (let j = j_up; j < j_down; j++)
            for (let i = i_left; i < i_right; i++) {
                if (this.grid[j][i]) {
                    return [i, j]
                }
            }
    }


    render_debug() {
        for (let j = 0; j < this.grid.length; j++) {
            for (let i = 0; i < this.grid[j].length; i++) {
                if (this.grid[j][i]) {
                    render_box({ x: this.grid_x + i * 32, y: this.grid_y + j * 32, w: 32, h: 32 })
                }
            }
        }

        let j = 30
        for (let text of managers.MovableManager.player.arcade.v_text) {
            cx.textAlign = 'center'
            cx.fillStyle = 'black'
            cx.font = '16px monospace'
            cx.fillText(text, 300, j)
            j += 18
        }

        j = 100
        for (let text of managers.MovableManager.player.arcade.h_text) {
            cx.textAlign = 'center'
            cx.fillStyle = 'black'
            cx.font = '16px monospace'
            cx.fillText(text, 300, j)
            j += 18
        }



        j = 3330
        for (let text of managers.CameraZone.arcade.v_text) {
            cx.textAlign = 'center'
            cx.fillStyle = 'lightgreen'
            cx.font = '16px monospace'
            cx.fillText(text, 300, j)
            j += 18
        }
    }
}

class Player {

    body = new MovableAnimationWithBoxRelativeToCamera(
        { x: 0, y: 0, w: 32, h: 32 },
        AnimationManager.fromFrames([
            ['walk-left', { x: 0, y: 64, w: 32, h: 32 }, [0, 1, 2, 3, 4]],
            ['walk-right', { x: 0, y: 0, w: 32, h: 32 }, [0, 1, 2, 3, 4]],
            ['idle', { x: 0, y: 32, w: 32, h: 32 }, [0, 1, 2, 3, 4]],
        ])
    )

    arcade: ArcadePlayer = new ArcadePlayer(this)
    still: StillBehavior = StillBehavior.Zero
    vel: PositionVelocity = PositionVelocity.create(this.still)

    static spawn = (x: number, y: number) => {

        let p = new Player()
        p.vel.x = x
        p.vel.y = y
        p.body.box.x = x
        p.body.box.y = y
        p.vel.setBehavior(p.arcade)
        return p
    }

    private constructor() {
        this.body.animation.setActive('idle')
        this.body.animation.setScale(2, 2)
    }

    req_hitwall: Sign = 0
    resolve_x(x: number, sign: Sign) {
        this.vel.x = x
        this.body.box.x = this.vel.x
        this.req_hitwall = sign
    }

    no_resolve_x() {
        this.req_hitwall = 0
    }


    req_fall = false
    resolve_y(y: number) {
        this.vel.y = y
        this.body.box.y = this.vel.y
        this.req_fall = false
    }

    no_resolve_y() {
        this.req_fall = true
    }

    update(dt: number) {

        let req_left = getActionSign('go-left')
        let req_right = getActionSign('go-right')
        this.arcade.cruise_horizontal(this.req_hitwall, req_left, req_right)

        let req_j = getActionSign('jump')

        this.arcade.cruise_vertical(this.req_fall, req_j)

        this.arcade.update(dt)
        this.vel.update(dt)

        if (this.vel.vhs === 0) {
            this.body.animation.setActive('idle')
        } else if (this.vel.vhs === -1) {
            this.body.animation.setActive('walk-left')
        } else {
            this.body.animation.setActive('walk-right')
        }

        this.body.box.x = this.vel.x
        this.body.box.y = this.vel.y
        this.body.update(dt)
    }

    render() {
        this.body.render()

        render_box(this.body.box)
    }
}

function getActionSign(action: Action) {
    let req: ActionSign = 'up'
    if (keyboard.is_just_down(action)) {
        req = 'just-down'
    } else if (keyboard.is_just_up(action)) {
        req = 'just-up'
    } else if (keyboard.is_down(action)) {
        req = 'down'
    }

    return req
}

function render_box(box: Box) {
    cx.lineWidth = 1
    cx.strokeStyle = 'white'
    cx.strokeRect(box.x - managers.Camera.frustum.x, box.y - managers.Camera.frustum.y, box.w, box.h)
}


class MovableManager {

    player!: Player
    tile_collider!: GridCollider

    spawnTilemap(tilemap: TileMap) {
        let PlayerTile = '4'
        let ps = tilemap.find(PlayerTile)!
        this.spawnPlayer(ps.x, ps.y)
        this.switchTilemap(tilemap)
    }

    switchTilemap(tilemap: TileMap) {

        this.spawnCollider(tilemap.grid_x, tilemap.grid_y, tilemap.collision_grid)
    }

    spawnPlayer(x: number, y: number) {
        this.player = Player.spawn(x, y)
    }

    spawnCollider(grid_x: number, grid_y: number, c_grid: boolean[][]) {
        this.tile_collider = new GridCollider(grid_x, grid_y, c_grid)
    }

    update(dt: number) {

        let box = { ...this.player.body.box }
        this.player.update(dt)
        let boxFu = { ...this.player.body.box }
        let y_collision = this.tile_collider.resolve_y(box, boxFu)
        if (y_collision) {
            let [, y] = y_collision
            this.player.resolve_y(y)
        } else {
            this.player.no_resolve_y()
        }

        box.y = this.player.body.box.y
        boxFu.y = this.player.body.box.y
        let x_collision = this.tile_collider.resolve_x(box, boxFu)
        if (x_collision) {
            let [sign, x] = x_collision
            this.player.resolve_x(x, sign)
        } else {
            this.player.no_resolve_x()
        }
    }


    render() {
        this.player.render()

    }

    render_debug() {
        this.tile_collider.render_debug()
    }
}
class World {
    constructor(readonly box: Box) { }
}

class WorldsCamera {

    readonly frustum: Box

    constructor(public worlds: Map<string, World>, gameWidth: number, gameHeight: number) {
        this.frustum = { x: 0, y: 0, w: gameWidth, h: gameHeight }
    }

    get left() {
        return this.frustum.x
    }

    get right() {
        return this.frustum.x + this.frustum.w
    }

    get top() {
        return this.frustum.y
    }

    get bottom() {
        return this.frustum.y + this.frustum.h
    }

    panCenter(x: number, y: number) {
        let targetX = x - 640 / 2
        let targetY = y - 360 / 2

        this.frustum.x = targetX
        this.frustum.y = targetY
    }

    lerpPanCenter(x: number, y: number) {
        let targetX = x - 640 / 2
        let targetY = y - 360 / 2

        this.frustum.x = this.frustum.x + (targetX - this.frustum.x) * 0.07
        this.frustum.y = this.frustum.y + (targetY - this.frustum.y) * 0.09
    }

    visibleWorlds() {
        let visible: [string, Box][] = []

        for (let [name, world] of this.worlds) {

            if (box_intersects(world.box, this.frustum)) {
                visible.push([name, box_intersectsRegion(world.box, this.frustum)])
            }
        }
        return new Map(visible)
    }

}



let tilemaps_map!: string
let tile_png!: HTMLImageElement
let bg_png!: HTMLImageElement
let spr_png!: HTMLImageElement
export async function _load() {

    tile_png = new Image()
    tile_png.src = './tiles.png'

    bg_png = new Image()
    bg_png.src = './background.png'

    spr_png = new Image()
    spr_png.src = './sprites.png'
    return Promise.all([
        new Promise(resolve => tile_png.onload = resolve),
        new Promise(resolve => bg_png.onload = resolve),
        new Promise(resolve => spr_png.onload = resolve),
        fetch(`./tilemaps.map`).then(_ => _.text()).then(_ => tilemaps_map = _)
    ])
}

let cx: CanvasRenderingContext2D
export function _set_ctx(ctx: CanvasRenderingContext2D) {
    cx = ctx
}

let vwidth = 0
let vheight = 0
export function _set_viewport(_top: number, _left: number, width: number, height: number) {
    vwidth = width
    vheight = height
}


let keyboard: Keyboard
export function _set_canvas(canvas: HTMLCanvasElement) {
    keyboard = Keyboard.bindTo(canvas)
    keyboard.add_keymapping('w', 'look-up')
    keyboard.add_keymapping('a', 'go-left')
    keyboard.add_keymapping('d', 'go-right')
    keyboard.add_keymapping('s', 'look-down')
    keyboard.add_keymapping('j', 'jump')
    keyboard.add_keymapping('i', 'dash')
}

class RepeatingParallax {

    patterns: Box[]
    get visiblePatterns() {
        return this.patterns.filter(_ => box_intersects(_, this.frustum))
    }

    constructor(readonly source: Box, readonly world: Box, readonly offset: Vec2, readonly scale: number) {
        this.patterns = []

        let pattern_w = source.w * scale
        let pattern_h = source.h * scale

        for (let x = world.x - offset.x; x < world.x + world.w; x += pattern_w) {
            for (let y = world.y - offset.y; y < world.y + world.h; y += pattern_h) {
                this.patterns.push({ x, y, w: pattern_w, h: pattern_h })
            }
        }
    }

    frustum: Box = { x: 0, y: 0, w: 0, h: 0 }
    setFrustum(frustum: Box) {
        this.frustum = frustum
    }

    render() {
        let sx = this.source.x
        let sy = this.source.y
        let sw = this.source.w
        let sh = this.source.h

        for (let pattern of this.visiblePatterns) {
            let dx = pattern.x - this.frustum.x
            let dy = pattern.y - this.frustum.y
            draw_bg(sx, sy, sw, sh, dx, dy, this.scale)
        }
    }
}


class ParallaxManager {

    parallax: RepeatingParallax[] = []

    setFrustum(frustum: Box) {
        for (let px of this.parallax) {
            px.setFrustum(frustum)
        }
    }

    render() {
        for (let px of this.parallax) {
            px.render()
        }
    }

}


class TileMap {

    constructor(readonly grid_x: number, readonly grid_y: number, readonly grid: string[][]) { }

    get collision_grid() {
        const wall = '1'
        return this.grid.map(lines => lines.map(_ => _ === wall))
    }

    find(needle: string) {
        let grid = this.grid
        for (let j = 0; j < grid.length; j++) {
            for (let i = 0; i < grid[j].length; i++) {
                let char = grid[j][i]
                if (char === needle) {
                    return { x: this.grid_x + i * 32, y: this.grid_y + j * 32 }
                }
            }
        }
    }

    frustum!: Box
    setFrustum(frustum: Box) {
        this.frustum = frustum
    }


    render() {

        let grid = this.grid
        for (let j = 0; j < grid.length; j++) {
            for (let i = 0; i < grid[j].length; i++) {
                let char = parseInt(grid[j][i])
                if (char !== 0) {
                    let x = this.grid_x + i * 32 - this.frustum.x
                    let y = this.grid_y + j * 32 - this.frustum.y
                    draw_tile(char, x, y)
                }
            }
        }
    }
}

type CameraZone = { left?: number, up?: number, right?: number, down?: number }

class CameraZones {

    static Deadzone: Box = { x: -110, y: -110, w: 220, h: 220 }

    arcade = new ArcadeCameraCruise()
    vel: PositionVelocity = PositionVelocity.create(this.arcade)
    zone!: CameraZone

    deadzone_req_h: Sign = 0
    deadzone_req_v: Sign = 0

    followDeadzone(x: number, y: number) {
        let deadzone = CameraZones.Deadzone
        if (this.vel.x < x + deadzone.x) {
            this.deadzone_req_h = 1
        } else if (this.vel.x > x + deadzone.x + deadzone.w) {
            this.deadzone_req_h = -1
        } else {
            let edge_l = Math.abs(this.vel.x - (x + deadzone.x))
            let edge_r = Math.abs(this.vel.x - (x + deadzone.x + deadzone.w))

            if (edge_l < large_epsilon || edge_r < large_epsilon) {

            } else {
                this.deadzone_req_h = 0
            }
        }
        if (this.vel.y < y + deadzone.y) {
            this.deadzone_req_v = 1
        } else if (this.vel.y > y + deadzone.y + deadzone.h) {
            this.deadzone_req_v = -1
        } else {
            this.deadzone_req_v = 0
        }
    }

    immediate_lock = true

    update(dt: number) {

        let req_h: Sign = this.deadzone_req_h
        let req_stop = false
        if (this.zone.left !== undefined) {
            let dx = this.zone.left - this.vel.x + 320
            if (Math.abs(dx) < large_epsilon) {
                this.vel.x = this.zone.left + 320 - dx
                req_stop = req_h !== 1
                if (req_stop) {
                    req_h = 0
                }
            } else if (dx > epsilon) {
                req_h = 1
            }
        } else if (this.zone.right !== undefined && this.vel.x + 640 > this.zone.right) {
            req_h = -1
        }

        this.arcade.cruise_horizontal(req_stop, req_h)

        let req_v: Sign = this.deadzone_req_v
        if (this.zone.up !== undefined && this.vel.y < this.zone.up) {
            req_v = 1
        } else if (this.zone.down !== undefined && this.vel.y + 640 > this.zone.down) {
            req_v = -1
        }

        this.arcade.cruise_vertical(req_v)

        this.arcade.update(dt)
        this.vel.update(dt)

        if (this.immediate_lock) {
            if (this.zone.left) this.vel.x = Math.max(this.zone.left, this.vel.x)
            if (this.zone.right) this.vel.x = Math.min(this.zone.right - 640, this.vel.x)
            if (this.zone.up) this.vel.y = Math.max(this.zone.up, this.vel.y)
            if (this.zone.down) this.vel.y = Math.min(this.zone.down - 360, this.vel.y)
        }
    }
}


class Managers {

    static loadEverything = () => {
        let res = new Managers()

        res.Camera = new WorldsCamera(res.Worlds, 640, 360)

        let ll = tilemaps_map.trim().split('\n')
        for (let i = 0; i < ll.length; i += 2) {
            let header = ll[i]
            let lines = ll[i + 1]

            let [name, x_str, y_str, width] = header.split(' ')

            let rows = parseInt(width) / 16
            let data = decode2(lines, rows)
            let cols = data.length

            let x = parseInt(x_str) / 16 * 32
            let y = parseInt(y_str) / 16 * 32

            res.TileMaps.set(name, new TileMap(x, y, data))
            res.Worlds.set(name, new World({ x, y, w: rows * 32, h: cols * 32 }))
        }

        let tilemap = res.TileMaps.get('Backyard')!

        res.MovableManager.spawnTilemap(tilemap)

        res.Camera.panCenter(
            res.MovableManager.player.body.box.x,
            res.MovableManager.player.body.box.y)

        res.setCameraZone()

        res.ParallaxManager.parallax = [
            new RepeatingParallax(
                { x: 0, y: 0, w: 75, h: 37 },
                res.Worlds.get('Backyard')!.box, { x: 0, y: 0 }, 10),
            new RepeatingParallax(
                { x: 0, y: 0, w: 75, h: 37 },
                res.Worlds.get('Backyard2')!.box, { x: 0, y: 0 }, 10),
            new RepeatingParallax(
                { x: 0, y: 81, w: 53, h: 37 },
                res.Worlds.get('Garage')!.box, { x: 0, y: 0 }, 10),
        ]

        return res
    }

    Camera!: WorldsCamera

    CameraZone = new CameraZones()

    MovableManager = new MovableManager()


    TileMaps: Map<string, TileMap> = new Map()
    Worlds: Map<string, World> = new Map()

    ParallaxManager = new ParallaxManager()

    activeMap = 'Backyard'

    setFrustum(frustum: Box) {
        this.ParallaxManager.setFrustum(frustum)
        this.MovableManager.player.body.setFrustum(frustum)

        for (let map of this.TileMaps.values()) {
            map.setFrustum(frustum)
        }
    }

    update(dt: number) {
        this.MovableManager.update(dt)

        this.CameraZone.followDeadzone(
            this.MovableManager.player.body.box.x,
            this.MovableManager.player.body.box.y)

        this.CameraZone.update(dt)

        this.Camera.lerpPanCenter(
            this.CameraZone.vel.x,
            this.MovableManager.player.body.box.y)

        let nextMap = this.activeMap
        let region =
            box_intersectsRegion(
                this.MovableManager.player.body.box,
                this.Worlds.get(nextMap)!.box)
        for (let [map, world_box] of this.Camera.visibleWorlds()) {
            let next_region =
                box_intersectsRegion(this.MovableManager.player.body.box, world_box)
            if (box_area(next_region) > box_area(region)) {
                nextMap = map
                region = next_region
            }
        }

        if (nextMap !== this.activeMap) {
            this.transitionToNextMap(nextMap)

        }

        this.setFrustum(this.Camera.frustum)
    }

    transitionToNextMap(map: string) {
        this.activeMap = map
        let tilemap = this.TileMaps.get(this.activeMap)!
        this.MovableManager.switchTilemap(tilemap)

        this.setCameraZone()
    }

    setCameraZone() {
        let tilemap = this.TileMaps.get(this.activeMap)!
        const CameraLeftTile = '5'
        const CameraRightTile = '6'
        const CameraUpTile = '7'
        const CameraDownTile = '8'

        this.CameraZone.zone = {
            left: tilemap.find(CameraLeftTile)?.x,
            right: tilemap.find(CameraRightTile)?.x,
            up: tilemap.find(CameraUpTile)?.y,
            down: tilemap.find(CameraDownTile)?.y,
        }
    }

    render() {
        this.ParallaxManager.render()
        this.MovableManager.render()

        for (let map of this.TileMaps.values()) {
            map.render()
        }

        this.MovableManager.render_debug()
    }
}