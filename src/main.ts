import './style.css'
import * as play from './play'

export function Loop(update: (dt: number) => void, render: (alpha: number) => void, after_render?: () => void) {

  let is_running = true
  let animationFrameId: number
  const timestep = 1000 / 60
  let last_time = performance.now()
  let accumulator = 0

  function step(current_time: number) {
    if (!is_running) return
    animationFrameId = requestAnimationFrame(step)


    let delta_time = Math.min(current_time - last_time, 25)
    last_time = current_time

    accumulator += delta_time

    while (accumulator >= timestep) {
      update(timestep)
      accumulator -= timestep
    }

    render(accumulator / timestep)

    after_render?.()
  }
  animationFrameId = requestAnimationFrame(step)


  return () => {
    is_running = false
    cancelAnimationFrame(animationFrameId)
  }
}



export function Init_canvas(container: HTMLElement, set_viewport: (top: number, left: number, width: number, height: number) => void, set_canvas: (canvas: HTMLCanvasElement) => void, render: () => void) {

  let canvas = document.createElement('canvas')
  set_canvas(canvas)

  const resizeToContainer = () => {
    const dpr = window.devicePixelRatio || 1

    const rect = container.getBoundingClientRect()

    const targetWidth = Math.floor(rect.width * dpr)
    const targetHeight = Math.floor(rect.height * dpr)


    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {

      canvas.width = targetWidth
      canvas.height = targetHeight
      set_viewport(rect.top, rect.left, canvas.width, canvas.height)

      cx.imageSmoothingEnabled = false
      render()
    }
  }

  const resizeObserver = new ResizeObserver(() => resizeToContainer())
  resizeObserver.observe(container)
  container.appendChild(canvas)

  let cx = canvas.getContext('2d')!

  return cx
}

async function app(el: HTMLElement) {

  let scene = play

  let initialized = false
  let cx = Init_canvas(el, scene._set_viewport, scene._set_canvas, () => {
    if (initialized) {
      scene._render()
    }
  })

  await scene._load()

  scene._set_ctx(cx)

  scene._init()

  Loop(scene._update, scene._render)
}

app(document.getElementById('app')!)