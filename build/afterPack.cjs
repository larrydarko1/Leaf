/**
 * 1. Drop onnxruntime-node's prebuilt binaries for platforms we are not building. The npm package
 *    ships darwin + linux + win32 (~259 MB) and the loader only ever touches one of them, so the
 *    rest is dead weight in every installer. Every copy in the tree is walked, not just the root
 *    one — v3.0.1 shipped ~210 MB of unpruned binaries because a nested duplicate was missed.
 * 2. Drop the @node-llama-cpp backend packages we are not building. npm resolves these by `cpu`
 *    field, and on linux-x64 that pulls six of them (~696 MB) — including 593 MB of CUDA runtime —
 *    when getLlama() only ever loads one. See LLAMA_KEEP for what each platform keeps.
 * 3. Ad-hoc code sign macOS app bundles. Without this, unsigned apps downloaded from the internet
 *    are rejected as "corrupted" by Gatekeeper on macOS Ventura+ (13+). Ad-hoc signing makes macOS
 *    show "unidentified developer" instead, which users can bypass with right-click → Open.
 * Order matters: pruning has to happen before signing, or the signature covers files that are no
 * longer there and macOS rejects the bundle.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARCH_NAMES = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' };

const LLAMA_KEEP = {
    'darwin-arm64': ['mac-arm64-metal'],
    'linux-x64': ['linux-x64', 'linux-x64-vulkan'],
};

// @huggingface/transformers pins onnxruntime-node exactly, so npm nests a second copy beside the
// root one. Both ship every platform; pruning only the root leaves ~210 MB of the other in place.
function onnxBinDirs(dir, depth = 0) {
    if (depth > 8) return [];
    const found = [];

    for (const entry of dirsIn(dir)) {
        const full = path.join(dir, entry);
        if (entry === 'onnxruntime-node') {
            if (fs.existsSync(path.join(full, 'bin'))) found.push(path.join(full, 'bin'));
            continue;
        }
        found.push(...onnxBinDirs(full, depth + 1));
    }

    return found;
}

function pruneOnnxRuntime(context) {
    const resourcesDir = context.packager.getResourcesDir(context.appOutDir);
    const modulesDir = path.join(resourcesDir, 'app.asar.unpacked', 'node_modules');

    if (!fs.existsSync(modulesDir)) {
        console.warn(`[afterPack] unpacked node_modules not found, skipping prune: ${modulesDir}`);
        return;
    }

    const binDirs = onnxBinDirs(modulesDir);
    if (binDirs.length === 0) {
        console.warn('[afterPack] no onnxruntime-node copies found, skipping prune');
        return;
    }

    const keepPlatform = context.electronPlatformName; // 'darwin' | 'linux' | 'win32'
    const arch = ARCH_NAMES[context.arch];
    const keepArches = arch === 'universal' ? ['x64', 'arm64'] : [arch];

    let removed = 0;
    for (const binDir of binDirs) {
        removed += pruneOnnxCopy(binDir, keepPlatform, keepArches);
    }

    console.log(
        `[afterPack] onnxruntime prune freed ${(removed / 1024 / 1024).toFixed(0)} MB across ${binDirs.length} cop${binDirs.length === 1 ? 'y' : 'ies'} (kept ${keepPlatform}/${keepArches.join(',')})`,
    );
}

function pruneOnnxCopy(binDir, keepPlatform, keepArches) {
    let removed = 0;
    let kept = 0;
    // bin/<napi-vN>/<platform>/<arch>. Directory entries are read with withFileTypes so a symlink
    // is never mistaken for a directory and followed out of the build tree.
    for (const napi of dirsIn(binDir)) {
        const napiDir = path.join(binDir, napi);

        for (const platform of dirsIn(napiDir)) {
            const platformDir = path.join(napiDir, platform);

            if (platform !== keepPlatform) {
                removed += sizeOf(platformDir);
                fs.rmSync(platformDir, { recursive: true, force: true });
                console.log(`[afterPack] pruned ${napi}/${platform}`);
                continue;
            }

            for (const archDir of dirsIn(platformDir)) {
                if (keepArches.includes(archDir)) {
                    kept++;
                    continue;
                }
                removed += sizeOf(path.join(platformDir, archDir));
                fs.rmSync(path.join(platformDir, archDir), { recursive: true, force: true });
                console.log(`[afterPack] pruned ${napi}/${platform}/${archDir}`);
            }
        }
    }

    if (kept === 0) {
        throw new Error(
            `[afterPack] ${binDir} has no build for ${keepPlatform}/${keepArches.join(',')} — ` +
                `refusing to ship an app with no ONNX runtime. Drop this target or pin a version that provides it.`,
        );
    }

    return removed;
}

function pruneLlamaBackends(context) {
    const resourcesDir = context.packager.getResourcesDir(context.appOutDir);
    const pkgDir = path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', '@node-llama-cpp');

    if (!fs.existsSync(pkgDir)) {
        console.warn(`[afterPack] @node-llama-cpp dir not found, skipping prune: ${pkgDir}`);
        return;
    }

    const target = `${context.electronPlatformName}-${ARCH_NAMES[context.arch]}`;
    const keep = LLAMA_KEEP[target];

    // An unmapped target means an untested platform, not permission to delete every backend.
    if (!keep) {
        console.warn(`[afterPack] no llama backend mapping for ${target}, leaving all in place`);
        return;
    }

    let removed = 0;
    const present = dirsIn(pkgDir);

    for (const pkg of present) {
        if (keep.includes(pkg)) continue;
        removed += sizeOf(path.join(pkgDir, pkg));
        fs.rmSync(path.join(pkgDir, pkg), { recursive: true, force: true });
        console.log(`[afterPack] pruned @node-llama-cpp/${pkg}`);
    }

    const survivors = keep.filter((pkg) => present.includes(pkg));
    if (survivors.length === 0) {
        throw new Error(
            `[afterPack] none of the expected llama backends (${keep.join(', ')}) were installed for ` +
                `${target} — the runner's arch probably does not match the build target.`,
        );
    }

    console.log(
        `[afterPack] llama prune freed ${(removed / 1024 / 1024).toFixed(0)} MB (kept ${survivors.join(', ')})`,
    );
}

function dirsIn(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
}

function sizeOf(dir) {
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        total += entry.isDirectory() ? sizeOf(full) : fs.statSync(full).size;
    }
    return total;
}

function adhocSign(context) {
    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(context.appOutDir, `${appName}.app`);

    console.log(`[afterPack] Ad-hoc signing: ${appPath}`);

    try {
        // --force: replace any existing signature
        // --deep:  recursively sign nested code (frameworks, helpers)
        // --sign -: ad-hoc identity (no certificate required)
        execSync(`codesign --force --deep --sign - "${appPath}"`, {
            stdio: 'inherit',
        });
        console.log('[afterPack] Ad-hoc signing complete');
    } catch (error) {
        console.warn('[afterPack] Ad-hoc signing failed (non-fatal):', error.message);
        // Don't fail the build — the app will still work locally,
        // just won't pass Gatekeeper when downloaded from the internet.
    }
}

exports.default = async function (context) {
    pruneOnnxRuntime(context);
    pruneLlamaBackends(context);

    if (context.electronPlatformName === 'darwin') adhocSign(context);
};
