import { ArcadeCameraCruise, ArcadePlayer, large_epsilon, type ArcadePlayerCollisions } from "./arcade"
import { box_area, box_intersects, box_intersectsRegion, box_min_distance, type Box, type Sign, type Vec2 } from "./collision"
import { log_horizontal, log_vertical } from "./debug"
import { Keyboard } from "./keyboard"
import { decode2 } from "./map_packer"

let managers: Managers

let render_debug: RenderDebug

export function _init() {
    managers = Managers.loadEverything()

    if (import.meta.env.DEV) {
        render_debug = new RenderDebug()
    }

}

let first_update_called = false
export function _update(dt: number) {

    first_update_called = true

    managers.update(dt)

    keyboard.update()

    if (import.meta.env.DEV) {
        render_debug.update()
    }
}

export function _render() {
    if (!first_update_called) return

    let sy = vheight / 360
    let sx = sy
    cx.setTransform(sx, 0, 0, sy, 0, 0)

    managers.render()

    if (import.meta.env.DEV) {
        render_debug.render_debug()
    }
}

function draw_tile(n: number, x: number, y: number) {
    let sx = (n % 8) * 8
    let sy = Math.floor(n / 8) * 8
    let sw = 8
    let sh = 8
    let scale = 4
    cx.drawImage(tile_png, sx, sy, sw, sh, Math.floor(x), Math.floor(y), sw * scale, sh * scale)
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
    dest: Box = { x: 0, y: 0, w: 0, h: 0 }
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
        draw_spr(sx, sy, sw, sh, dx, dy, w / sw, h / sh)
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
    w!: number
    h!: number
    active!: string
    private constructor(readonly frames: Map<string, Animation>) { }

    setActive(name: string) {
        this.active = name
        this.setPosition(this.position.x, this.position.y)
        this.setWidth(this.w, this.h)
    }

    setPosition(x: number, y: number) {
        this.position = { x, y }
        this.frames.get(this.active)!.dest.x = this.position.x
        this.frames.get(this.active)!.dest.y = this.position.y
    }

    setWidth(w: number, h: number) {
        this.w = w
        this.h = h
        this.frames.get(this.active)!.dest.w = this.w
        this.frames.get(this.active)!.dest.h = this.h
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
    constructor(readonly box: Box, readonly animation: AnimationManager) { }

    setFrustum(frustum: Box) {
        this.frustum = frustum
        let x = this.box.x - this.frustum.x
        let y = this.box.y - this.frustum.y
        this.animation.setPosition(x, y)
        this.animation.setWidth(this.box.w, this.box.h)
    }

    update(dt: number) {
        this.animation.update(dt)
    }

    render() {
        this.animation.render()
    }
}


class CollisionBoxesManager {

    constructor(readonly center: Box) { }

    _map = new Map()

    get collisions() {
        let { x, y, w, h } = this.center
        this._map.set('u', { x, y: y - h, w, h })
        this._map.set('l', { x: x - w, y, w, h })
        this._map.set('d', { x, y: y + h, w, h })
        this._map.set('r', { x: x + w, y, w, h })
        this._map.set('ul', { x: x - w, y: y - h, w, h })
        this._map.set('ur', { x: x + w, y: y - h, w, h })
        this._map.set('dl', { x: x - w, y: y + h, w, h })
        this._map.set('dr', { x: x + w, y: y + h, w, h })

        return this._map
    }
}

class Player {

    boxes = new CollisionBoxesManager({ x: 0, y: 0, w: 32, h: 32 })
    body = new MovableAnimationWithBoxRelativeToCamera(
        { x: 0, y: 0, w: 64, h: 64 },
        AnimationManager.fromFrames([
            ['walk-left', { x: 0, y: 64, w: 32, h: 32 }, [0, 1, 2, 3, 4]],
            ['walk-right', { x: 0, y: 0, w: 32, h: 32 }, [0, 1, 2, 3, 4]],
            ['idle', { x: 0, y: 32, w: 32, h: 32 }, [0, 1, 2, 3, 4]],
        ])
    )

    arcade: ArcadePlayer = ArcadePlayer.create()

    static spawn = (x: number, y: number) => {
        let p = new Player()
        p.arcade.body.x = x
        p.arcade.body.y = y
        p.body.box.x = p.arcade.body.x - p.body.box.w / 4
        p.body.box.y = p.arcade.body.y - p.body.box.h / 3
        p.boxes.center.x = p.arcade.body.x
        p.boxes.center.y = p.arcade.body.y
        p.body.animation.setActive('idle')
        return p
    }

    update(dt: number) {

        this.arcade.butt = {
            req_left: keyboard.getActionSign('go-left'),
            req_right: keyboard.getActionSign('go-right'),
            req_jump: keyboard.getActionSign('jump'),
        }

        this.arcade.update(dt)

        if (this.arcade.body.vhs === 0) {
            this.body.animation.setActive('idle')
        } else if (this.arcade.body.vhs === -1) {
            this.body.animation.setActive('walk-left')
        } else {
            this.body.animation.setActive('walk-right')
        }

        this.boxes.center.x = this.arcade.body.x
        this.boxes.center.y = this.arcade.body.y

        this.body.box.x = this.arcade.body.x - this.body.box.w / 4
        this.body.box.y = this.arcade.body.y - this.body.box.h / 3

        this.body.update(dt)
    }

    render() {
        this.body.render()
    }
}

class GridCollider {

    constructor(public grid_x: number, public grid_y: number, public grid: boolean[][]) { }


    getManifold(c: CollisionBoxesManager): ArcadePlayerCollisions {
        let result = new Map()
        let center = c.center
        for (let [name, box] of c.collisions) {

            let gap = this.getGap(box, center)
            if (gap !== undefined) {
                result.set(name, { gap })
            }
        }
        return result
    }


    getGap(box: Box, center: Box) {
        let coll = this.findCollisionIndex(box)
        if (coll) {
            let collBox = { x: + this.grid_x + coll[0] * 32, y: + this.grid_y + coll[1] * 32, w: center.w, h: center.h }
            return box_min_distance(collBox, center)
        }
    }

    findCollisionIndex(box: Box) {
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
        this.switchCollider(tilemap.grid_x, tilemap.grid_y, tilemap.collision_grid)
    }

    spawnPlayer(x: number, y: number) {
        this.player = Player.spawn(x, y)
    }

    switchCollider(grid_x: number, grid_y: number, c_grid: boolean[][]) {
        this.tile_collider = new GridCollider(grid_x, grid_y, c_grid)
    }

    update(dt: number) {
        this.player.arcade.coll = this.tile_collider.getManifold(this.player.boxes)
        this.player.update(dt)
    }

    render() {
        this.player.render()

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

//@ts-ignore
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


class CameraZones {

    static Deadzone: Box = { x: -80, y: -80, w: 160, h: 220 }

    arcade = ArcadeCameraCruise.create()

    followDeadzone(target_x: number, target_y: number) {
        let camera_x = this.arcade.body.x
        let camera_y = this.arcade.body.y
        let deadzone = CameraZones.Deadzone

        let deadzone_req_h: Sign = 0
        let deadzone_req_v: Sign = 0

        if (camera_x < target_x + deadzone.x) {
            deadzone_req_h = 1
        } else if (camera_x > target_x + deadzone.x + deadzone.w) {
            deadzone_req_h = -1
        } else {
            let edge_l = Math.abs(camera_x - (target_x + deadzone.x))
            let edge_r = Math.abs(camera_x - (target_x + deadzone.x + deadzone.w))

            if (edge_l < large_epsilon || edge_r < large_epsilon) {

            } else {
                deadzone_req_h = 0
            }
        }
        if (camera_y < target_y + deadzone.y) {
            deadzone_req_v = 1
        } else if (camera_y > target_y + deadzone.y + deadzone.h) {
            deadzone_req_v = -1
        } else {
            deadzone_req_v = 0
        }

        this.arcade.deadzone = {
            horizontal: deadzone_req_h as Sign,
            vertical: deadzone_req_v
        }


    }

    update(dt: number) {
        this.arcade.update(dt)
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
            this.MovableManager.player.body.box.x + this.MovableManager.player.body.box.w / 2,
            this.MovableManager.player.body.box.y + this.MovableManager.player.body.box.h)

        this.CameraZone.update(dt)

        this.Camera.lerpPanCenter(
            this.CameraZone.arcade.body.x,
            this.CameraZone.arcade.body.y)

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

        this.CameraZone.arcade.zone = {
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
    }
}

class RenderDebug {

    text: string[] = []
    text2: string[] = []

    text_cam: string[] = []
    text_cam_v: string[] = []

    update() {
        let player = managers.MovableManager.player
        let text = log_horizontal(player.arcade.body, player.arcade.state)

        this.text.push(text)
        if (this.text.length > 3) {
            this.text.shift()
        }
        let text2 = log_vertical(player.arcade.body, player.arcade.state)

        this.text2.push(text2)
        if (this.text2.length > 3) {
            this.text2.shift()
        }

        let camera = managers.CameraZone.arcade
        let text_cam = log_horizontal(camera.body, camera.state)

        this.text_cam.push(text_cam)
        if (this.text_cam.length > 3) {
            this.text_cam.shift()
        }

        let text_cam_v = log_vertical(camera.body, camera.state)

        this.text_cam_v.push(text_cam_v)
        if (this.text_cam_v.length > 3) {
            this.text_cam_v.shift()
        }
    }

    render_debug() {

        let player = managers.MovableManager.player

        let deadzoneBox = {
            x: managers.CameraZone.arcade.body.x + CameraZones.Deadzone.x,
            y: managers.CameraZone.arcade.body.y + CameraZones.Deadzone.y,
            w: CameraZones.Deadzone.w,
            h: CameraZones.Deadzone.h
        }
        render_box(deadzoneBox, 'rgba(0, 0, 0, 0.1)')

        render_box(player.body.box, 'rgba(0, 0, 0, 0.1)')

        render_box(player.boxes.center, 'yellow')
        for (let cc of player.boxes.collisions) {
            render_box(cc[1], 'rgba(0, 0, 0, 0.2)')
        }



        let j = 30
        for (let text of this.text) {
            cx.font = '20px monospace'
            cx.fillStyle = 'gold'
            cx.fillText(text, 40, j)
        }


        j = 54
        for (let text of this.text2) {

            cx.font = '20px monospace'
            cx.fillStyle = 'darkorange'
            cx.fillText(text, 40, j)
        }


        j = 84
        for (let text of this.text_cam) {

            cx.font = '20px monospace'
            cx.fillStyle = 'black'
            cx.fillText(text, 40, j)
        }


        j = 104
        for (let text of this.text_cam_v) {

            cx.font = '20px monospace'
            cx.fillStyle = 'black'
            cx.fillText(text, 40, j)
        }
    }
}

function render_box(box: Box, color = 'white') {
    cx.lineWidth = 1
    cx.strokeStyle = color
    cx.strokeRect(box.x - managers.Camera.frustum.x, box.y - managers.Camera.frustum.y, box.w, box.h)
}
