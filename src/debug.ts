import type { Sign } from "./collision"
import type { PositionVelocity } from "./play"

function log_sign(sign: Sign) {
    return sign < 0 ? '-' : sign > 0 ? '+' : 'O'
}
function log_number(a: number, end = 4) {
    return `${Math.floor(a)}`.padEnd(end)
}

export function log_horizontal(body: PositionVelocity, state: string) {
    return `${state}X:${log_number(body.x)}V:${log_sign(body.vhs)}${log_number(body.vh)}A:${log_sign(body.ahs)}${log_number(body.ah)}A<${body.minAccelH}:${body.maxAccelH}>V<${body.minSpeedH}:${body.maxSpeedH}>`
}
export function log_vertical(body: PositionVelocity, state: string) {
    return `${state}Y:${log_number(body.y)}V:${log_sign(body.vvs)}${log_number(body.vv)}A:${log_sign(body.avs)}${log_number(body.av)}A<${body.minAccelV}:${body.maxAccelV}>V<${body.minSpeedV}:${body.maxSpeedV}>`
}