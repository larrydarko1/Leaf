// Ad-hoc code sign macOS app bundles after packing.
// Without this, unsigned apps downloaded from the internet are rejected
// as "corrupted" by Gatekeeper on macOS Ventura+ (13+).
// Ad-hoc signing makes macOS show "unidentified developer" instead,
// which users can bypass with right-click → Open.

const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
    // Only sign on macOS builds
    if (context.electronPlatformName !== 'darwin') return;

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
};
