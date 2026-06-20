import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test('app launches and shows main window', async () => {
    const app = await electron.launch({
        args: [path.join(process.cwd(), 'out/main/index.js')],
    });

    const window = await app.firstWindow();
    await expect(window.locator('#app')).toBeVisible();

    await app.close();
});
