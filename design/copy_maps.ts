import fs from 'fs'

import { encode } from '../src/map_packer.ts'

function readLevel(name: number) {

    let grid = fs.readFileSync(`maps/simplified/${name}/IntGrid.csv`).toString().replaceAll(',', '').replaceAll('\n', '')
    let json = JSON.parse(fs.readFileSync(`maps/simplified/${name}/data.json`).toString())
    let x = json.x
    let y = json.y
    let w = json.width
    let h = json.height
    grid = encode(grid).toString()
    data += `
${name} ${x} ${y} ${w}
${grid}
`.trim()
}

let levels = fs.readdirSync('maps/simplified')
let data = ''

for (let level of levels) {
    readLevel(level)
    data += '\n'
}

fs.writeFileSync('../public/tilemaps.map', data)
console.log('public/tilemaps.map written')