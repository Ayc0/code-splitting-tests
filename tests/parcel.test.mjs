import test from "node:test";
import path from "node:path";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { Parcel } from '@parcel/core';

test("builds and tree-shakes using parcel", async (t) => {
    await using dir = await fs.mkdtempDisposable('vite');

    // Parcel forwards process.execArgv to its Worker threads, but Node 24 / CI
    // runners inject flags (e.g. --node-snapshot, --secure-heap, --tls-cipher-list)
    // that the Worker constructor rejects with ERR_WORKER_INVALID_EXEC_ARGV.
    process.execArgv = [];

    let bundler = new Parcel({
        entries: 'src/index.js',
        defaultConfig: '@parcel/config-default',
        mode: 'production',
        defaultTargetOptions: {
            distDir: path.join(process.cwd(), dir.path, 'dist'),
            engines: {
                browsers: ['last 1 Chrome version']
            }
        }
    });

    let { bundleGraph } = await bundler.run();

    const bundles = bundleGraph.getBundles()

    const builtIndex = bundles.find((bundle) => bundle.filePath.includes('index'))
    const builtFileAsyncAwait = bundles.find((bundle) => bundle.filePath.includes('file-async-await'))
    const builtFileAsyncModule = bundles.find((bundle) => bundle.filePath.includes('file-async-module'))
    const builtFileAsyncPicked = bundles.find((bundle) => bundle.filePath.includes('file-async-picked'))


    const getCode = (bundle) => fs.readFile(bundle.filePath, 'utf8')
    const builtIndexCode = await getCode(builtIndex)
    const builtFileAsyncAwaitCode = await getCode(builtFileAsyncAwait)
    const builtFileAsyncModuleCode = await getCode(builtFileAsyncModule)
    const builtFileAsyncPickedCode = await getCode(builtFileAsyncPicked)

    t.test("properly bundles important variables", () => {
        assert.match(builtIndexCode, /TO KEEP IN BUNDLE SYNC REQUIRE DESTRUCTURING/)
        assert.match(builtIndexCode, /TO KEEP IN BUNDLE SYNC REQUIRE MODULE/)
        assert.match(builtIndexCode, /TO KEEP IN BUNDLE SYNC REQUIRE CHAINING/)

        assert.match(builtIndexCode, /TO KEEP IN BUNDLE SYNC IMPORT/)
        assert.match(builtFileAsyncAwaitCode, /TO KEEP IN BUNDLE TOP LEVEL AWAITED/)
        assert.match(builtFileAsyncModuleCode, /TO KEEP IN BUNDLE ASYNC WHOLE MODULE/)
        assert.match(builtFileAsyncPickedCode, /TO KEEP IN BUNDLE ASYNC IMPORTED PICKED/)
    })

    t.test("tree shakes sync require destructuring", () => {
        assert.doesNotMatch(builtIndexCode, /SHOULD BE REMOVED FROM BUNDLE SYNC REQUIRE DESTRUCTURING/)
    })

    t.test("tree shakes sync require module", () => {
        assert.doesNotMatch(builtIndexCode, /SHOULD BE REMOVED FROM BUNDLE SYNC REQUIRE MODULE/)
    })

    t.test("tree shakes sync require chaining", () => {
        assert.doesNotMatch(builtIndexCode, /SHOULD BE REMOVED FROM BUNDLE SYNC REQUIRE CHAINING/)
    })

    t.test("tree shakes sync modules", () => {
        assert.doesNotMatch(builtIndexCode, /SHOULD BE REMOVED FROM BUNDLE SYNC IMPORT/)
    })

    t.test("tree shakes async modules top level awaited", () => {
        assert.doesNotMatch(builtFileAsyncAwaitCode, /SHOULD BE REMOVED FROM BUNDLE TOP LEVEL AWAITED/)
    })

    t.test("tree shakes async modules import() whole module", () => {
        assert.doesNotMatch(builtFileAsyncModuleCode, /SHOULD BE REMOVED FROM BUNDLE ASYNC WHOLE MODULE/)
    })

    t.test("tree shakes async modules import() + picked", () => {
        assert.doesNotMatch(builtFileAsyncPickedCode, /SHOULD BE REMOVED FROM BUNDLE ASYNC IMPORTED PICKED/)
    })
});
