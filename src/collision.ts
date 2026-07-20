export type Box = { x: number, y: number, w: number, h: number }
export function box_intersects(a: Box, b: Box) {
    return a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
}

export function box_intersectsRegion(a: Box, b: Box) {
    `
    -----
       ----
-----
     --
     `

    let left = Math.max(a.x, b.x)
    let right = Math.min(a.x + a.w, b.x + b.w)

    let top = Math.max(a.y, b.y)
    let bottom = Math.min(a.y + a.h, b.y + b.h)

    return { x: left, y: top, w: right - left, h: bottom - top }
}


export function box_union(a: Box, b: Box) {
    let left_most = Math.min(a.x, b.x)
    let right_most = Math.max(a.x + a.w, b.x + b.w)

    let up_most = Math.min(a.y, b.y)
    let down_most = Math.max(a.y + a.h, b.y + b.h)

    return { x: left_most, y: up_most, w: right_most - left_most, h: down_most - up_most }
}


export function box_diff(a: Box, b: Box) {
    let left, right, up, down
    if (a.x < b.x) {
        left = a.x
        right = b.x
    } else if (a.x > b.x) {
        left = b.x + b.w
        right = a.x + a.w
    } else {
        left = a.x
        right = a.x + a.w
    }
    if (a.y < b.y) {
        up = a.y
        down = b.y
    } else if (a.y > b.y) {
        up = b.y + b.h
        down = a.y + a.h
    } else {
        up = a.y
        down = a.y + a.h
    }

    return { x: left, y: up, w: right - left, h: down - up }
}



export type Sign = -1 | 1 | 0
export type Side = [Sign, Sign]
export function box_side_of_point(box: Box, x: number, y: number, threshold = 0.1): [Sign, Sign] {
    let d_left = Math.abs(box.x - x)
    let d_right = Math.abs(box.x + box.w - x)

    let d_up = Math.abs(box.y - y)
    let d_down = Math.abs(box.y + box.h - y)

    let hs: Sign = 0
    let vs: Sign = 0

    if (d_left < d_right) {
        if (d_left <= threshold) {
            hs = -1
        }
    } else {
        if (d_right <= threshold) {
            hs = 1
        }
    }

    if (d_up < d_down) {
        if (d_up <= threshold) {
            vs = -1
        }
    } else {
        if (d_down <= threshold) {
            vs = 1
        }
    }

    return [hs, vs]
}

export function box_area(box: Box) {
    return box.w * box.h
}


export function box_min_distance(a: Box, b: Box): number {
    // Calculate the distance between the two boxes along the x-axis
    const dx = Math.max(
        0,
        Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)
    );

    // Calculate the distance between the two boxes along the y-axis
    const dy = Math.max(
        0,
        Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)
    );

    // The minimum distance is the Euclidean distance in the 2D plane
    return Math.sqrt(dx * dx + dy * dy);
}

export type Vec2 = { x: number, y: number }
export function distance(a: Vec2, b: Vec2) {
    let dx = a.x - b.x
    let dy = a.y - b.y

    return Math.sqrt(dx * dx + dy * dy)
}