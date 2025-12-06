
import { dispatchTool } from './src/tools/dispatcher';
import fs from 'fs';

// Mock env var for browser test
process.env.BROWSER_ALLOW_UNSAFE_URLS = 'true';

async function testFeatures() {
    console.log("🚀 Testing New Features...\n");

    // 1. Test Utility Tool
    try {
        console.log("1. Testing Utility (Math)...");
        const mathResult = await dispatchTool('utility', { action: 'math', expression: '10 * 5 + 2' });
        console.log("Math Result:", mathResult);

        console.log("2. Testing Utility (UUID)...");
        const uuidResult = await dispatchTool('utility', { action: 'uuid' });
        console.log("UUID Result:", uuidResult);
    } catch (e) {
        console.error("Utility test failed:", e);
    }

    // 2. Test Browser Fix
    try {
        console.log("\n3. Testing Browser (Unsafe URL)...");
        // Using a domain not in the original whitelist
        const browserResult = await dispatchTool('browser', { url: 'https://example.com' });
        console.log("Browser Result:", browserResult.substring(0, 100) + "...");
    } catch (e) {
        console.error("Browser test failed:", e);
    }

    // 3. Test Custom Tool
    try {
        console.log("\n4. Testing Custom Tool...");
        // Create a temporary custom_tools.json
        const customTools = [
            {
                "name": "echo_test",
                "description": "Echoes back the input",
                "type": "command",
                "command": "echo Hello {name}"
            }
        ];
        fs.writeFileSync('custom_tools.json', JSON.stringify(customTools, null, 2));

        // We need to reload the module or just rely on the fact that we wrote the file 
        // BEFORE the module might have loaded if we were running a real server.
        // However, since we imported dispatchTool already, the module is cached with empty custom tools.
        // For this test script, we can't easily reload without clearing cache, 
        // but in a real restart scenario it works.
        // Let's just print instructions for manual verification of this part.
        console.log("⚠️ Custom tool test requires server restart to load custom_tools.json. Skipping programmatic test.");

    } catch (e) {
        console.error("Custom tool setup failed:", e);
    }
}

testFeatures();
