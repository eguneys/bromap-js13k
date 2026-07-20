export type Action = string
export type Key = string

export class Keyboard {

    static bindTo = (canvas: HTMLCanvasElement) => {
        return new Keyboard(canvas)
    }

    private constructor(_canvas: HTMLCanvasElement) {
        document.addEventListener('keydown', (e: KeyboardEvent) => this.on_down(e.key))
        document.addEventListener('keyup', (e: KeyboardEvent) => this.on_up(e.key))

        this.keymappings = new Map()
        this.action_is_down = new Set()
        this.action_is_just_up = new Set()
        this.action_is_just_down = new Set()
    }

    private keymappings: Map<Key, Action>
    private action_is_just_down: Set<Action>
    private action_is_just_up: Set<Action>
    private action_is_down: Set<Action>

    public add_keymapping(key: Key, action: Action) {
        this.keymappings.set(key, action)
    }

    public is_just_down(action: Action) {
        return this.action_is_just_down.has(action)
    }
    public is_down(action: Action) {
        return this.action_is_down.has(action)
    }
    public is_just_up(action: Action) {
        return this.action_is_just_up.has(action)
    }

    private on_down = (key: string) => {
        let action = this.keymappings.get(key)
        if (action) {
            if (this.action_is_down.has(action)) {
                return
            }
            this.action_is_just_down.add(action)
        }
    }

    private on_up = (key: string) => {
        let action = this.keymappings.get(key)
        if (action) {
            this.action_is_just_up.add(action)
        }

    }

    update() {
        for (let action_down of this.action_is_just_down) {
            this.action_is_down.add(action_down)
        }

        for (let action_up of this.action_is_just_up) {
            this.action_is_down.delete(action_up)
        }

        this.action_is_just_down.clear()
        this.action_is_just_up.clear()
    }
}