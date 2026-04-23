import esbuild from 'esbuild';
import * as fsPromises from 'node:fs/promises';
const { copyFile, mkdir, writeFile, readFile, readdir } = fsPromises;
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { glob } from 'glob';
import process from 'node:process';

const BUILD_DIR = 'dist';
const SRC_DIR = 'src';

const IS_WATCH = process.argv.includes('--watch');

interface EntryPoint {
    in: string;
    out: string;
}

async function copyAssets() {
    // 2. Copy static assets
    const assets = [
        'metadata.json',
        'dark.css',
        'light.css',
        'highcontrast.css',
    ];

    for (const asset of assets) {
        await copyFile(asset, path.join(BUILD_DIR, asset));
    }

    // Copy shader
    await copyFile(path.join(SRC_DIR, 'rounded_corners.frag'), path.join(BUILD_DIR, 'rounded_corners.frag'));

    // 3. Handle Icons
    await mkdir(path.join(BUILD_DIR, 'icons'), { recursive: true });
    const icons = await glob('icons/**/*');
    for (const icon of icons) {
        const dest = path.join(BUILD_DIR, icon);
        await mkdir(path.dirname(dest), { recursive: true });
        await copyFile(icon, dest);
    }

    // 4. Handle Keybindings XML
    await mkdir(path.join(BUILD_DIR, 'keybindings'), { recursive: true });
    const kbFiles = await glob('keybindings/*.xml');
    for (const kb of kbFiles) {
        await copyFile(kb, path.join(BUILD_DIR, kb));
    }

    // 5. Handle Schemas
    await mkdir(path.join(BUILD_DIR, 'schemas'), { recursive: true });
    const schemas = await glob('schemas/*.xml');
    for (const schema of schemas) {
        await copyFile(schema, path.join(BUILD_DIR, schema));
    }

    // Compile schemas in build dir
    try {
        execSync(`glib-compile-schemas ${path.join(BUILD_DIR, 'schemas')}`);
    } catch (e: any) {
        console.error('Failed to compile schemas:', e.message);
        process.exit(1);
    }
}

async function build() {
    // Ensure build directory exists
    try {
        await mkdir(BUILD_DIR, { recursive: true });
    } catch (e: any) {}

    console.log(IS_WATCH ? 'Watching O-tiling extension...' : 'Building O-tiling extension...');

    const entryPoints: EntryPoint[] = [
        { in: path.join(SRC_DIR, 'extension.ts'), out: 'extension' },
        { in: path.join(SRC_DIR, 'prefs.ts'), out: 'prefs' },
        { in: path.join(SRC_DIR, 'color_dialog', 'main.ts'), out: 'color_dialog/main' },
        { in: path.join(SRC_DIR, 'floating_exceptions', 'main.ts'), out: 'floating_exceptions/main' }
    ];

    const commonConfig: esbuild.BuildOptions = {
        bundle: true,
        format: 'esm',
        platform: 'neutral',
        target: 'es2022',
        external: ['gi://*', 'resource://*'],
        minify: false,
        sourcemap: false,
    };

    if (IS_WATCH) {
        for (const entry of entryPoints) {
            const ctx = await esbuild.context({
                ...commonConfig,
                entryPoints: [entry.in],
                outfile: path.join(BUILD_DIR, `${entry.out}.js`),
            });
            await ctx.watch();
        }
        await copyAssets();
        console.log('Watch mode active.');
    } else {
        for (const entry of entryPoints) {
            await esbuild.build({
                ...commonConfig,
                entryPoints: [entry.in],
                outfile: path.join(BUILD_DIR, `${entry.out}.js`),
            });
        }
        await copyAssets();
        console.log('Build complete! Output in:', BUILD_DIR);
    }
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});
