try {
    const Mtk = (await import('gi://Mtk')).default;
    console.log('Mtk found:', Mtk);
} catch (e) {
    console.log('Mtk not found');
}
try {
    const Clutter = (await import('gi://Clutter')).default;
    console.log('Clutter.Color:', Clutter.Color);
} catch (e) {
    console.log('Clutter not found');
}
