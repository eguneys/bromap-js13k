/**
 * Encodes a string grid (e.g., "0000100022") into a compact Uint8Array.
 * Format: [value1, count1, value2, count2, ...]
 */
export function encode(grid: string): string {
    //const result: number[] = [];
    const result: string[] = []
    let i = 0;

    while (i < grid.length) {
        const charCode = grid.charCodeAt(i);
        let count = 1;

        // Count consecutive identical characters (max 255 per segment)
        while (i + 1 < grid.length && grid.charCodeAt(i + 1) === charCode && count < 255) {
            count++;
            i++;
        }

        //result.push(charCode, count);
        result.push(`${grid[i]}${count}`)
        i++;
    }

    return result.join(' ')
    //return new Uint8Array(result);
}

export function decode2(data: string, width: number): string[][] {
    let result: string[] = []

    let i = 0

    for (let code of data.split(' ')) {
        let char = code[0]
        let count = parseInt(code.slice(1))
        for (let j = 0; j < count; j++)
            result[i++] = char
    }

    let grid: string[][] = []
    for (let j = 0; j < result.length / width; j++) {
        grid[j] = []
        for (let i = 0; i < width; i++) {
            grid[j][i] = result[j * width + i]
        }
    }
    return grid
}

/**
 * Decodes the Uint8Array back into the original string grid.
 */
export function decode(data: Uint8Array): string {
    let result = "";
    for (let i = 0; i < data.length; i += 2) {
        const charCode = data[i];
        const count = data[i + 1];
        result += String.fromCharCode(charCode).repeat(count);
    }
    return result;
}

// --- Example Usage ---
/*
const map = "00000000001000000222"; 
const encoded = encode(map);
const decoded = decode(encoded);

console.log("Original Length:", map.length); // 20
console.log("Encoded Length:", encoded.length); // 6 (Huge savings!)
console.log("Decoded matches:", map === decoded); // true
*/