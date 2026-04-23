
function set_alpha(color, alpha) {
    if (color.startsWith('rgba')) {
        return color.replace(/,[\s]*[\d.]+\)$/, `, ${alpha})`);
    } else if (color.startsWith('rgb')) {
        return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    }
    return color;
}

console.log("Test 1:", set_alpha('rgba(53, 132, 228, 1)', 0.1));
console.log("Test 2:", set_alpha('rgba(53, 132, 228, 1.0)', 0.1));
console.log("Test 3:", set_alpha('rgba(53, 132, 228,0.5)', 0.1));
console.log("Test 4:", set_alpha('rgb(53, 132, 228)', 0.1));
