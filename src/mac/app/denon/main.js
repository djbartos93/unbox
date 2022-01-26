"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//import { strict as assert } from 'assert';
//import { Controller } from './Controller';
const sleep_1 = require("./utils/sleep");
const announce_1 = require("./announce");
//import minimist = require('minimist');
const Listener_1 = require("./Listener");
const fs = require("fs");

const ControllerMgr_1 = require("./ControllerMgr");
require('console-stamp')(console, {
    format: ':date(HH:MM:ss) :label',
});
/*
function makeDownloadPath(p_path: string) {
    const path = `./localdb/${p_path}`;
    let paths = path.split(/[/\\]/).filter((e) => e.length > 0);
    const isFolder = p_path.endsWith('/') || p_path.endsWith('\\');
    let filename = '';
    if (isFolder === false) {
        filename = paths[paths.length - 1];
        paths.pop();
    }
    const newPath = paths.join('/');
    fs.mkdirSync(newPath, { recursive: true });
    return newPath + ('/' + filename);
}
*/
async function main() {
    //const args = minimist(process.argv.slice(2));
    const mgr = new ControllerMgr_1.ControllerMgr();
    const detected = function (p_id, p_info) {
        console.info(`Found '${p_info.source}' Controller with ID '${p_id}' at '${p_info.address}:${p_info.port}' with following software:`, p_info.software);
        mgr.createController(p_id, p_info);
    };
    const lost = function (p_id) {
        console.info(`Controller with ID '${p_id}' is lost`);
        mgr.destroyController(p_id);
    };
    const listener = new Listener_1.Listener(detected, lost);
    // Main, infinite loop

    /*
    const controller = new Controller();
    await controller.connect();

    if (!args.disableFileTransfer) {
        const ftx = await controller.connectToService(FileTransfer);
        assert(ftx);
        const sources = await ftx.getSources();
        {
            const sync = !args.skipsync;
            for (const source of sources) {
                const dbPath = makeDownloadPath(source.database.location);
                // FIXME: Move all this away from main
                if (sync) {
                    const file = await ftx.getFile(source.database.location);
                    fs.writeFileSync(dbPath, file);
                    console.info(`downloaded: '${source.database.location}' and stored in '${dbPath}'`);
                }
                await controller.addSource(source.name, dbPath, makeDownloadPath(`${source.name}/Album Art/`));

                if (sync) {
                    await controller.dumpAlbumArt(source.name);
                }
            }
            ftx.disconnect();
        }
    }


    */
    // Endless loop
}
async function denonn () {
    let returnCode = 0;
    try {
        process.on('SIGINT', async function () {
            console.info('... exiting');
            // Ensure SIGINT won't be impeded by some error
            try {
                await (0, announce_1.unannounce)();
            }
            catch (err) {
                const message = err.stack.toString();
                console.error(message);
            }
            process.exit(returnCode);
        });
        await (0, announce_1.announce)();
        // FIXME: main should be called when we found a device; not after waiting some random amount of time
        await (0, sleep_1.sleep)(500);
        await main();
    }
    catch (err) {
        const message = err.stack.toString();
        console.error(message);
        returnCode = 1;
    }
    await (0, announce_1.unannounce)();
    process.exit(returnCode);
} exports.denonn = denonn;



;
//# sourceMappingURL=main.js.map
