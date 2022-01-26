"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Listener = void 0;
const assert_1 = require("assert");
const common_1 = require("./common");
const dgram_1 = require("dgram");
const ReadContext_1 = require("./utils/ReadContext");
function readConnectionInfo(p_ctx, p_address) {
    const magic = p_ctx.getString(4);
    if (magic !== common_1.DISCOVERY_MESSAGE_MARKER) {
        return null;
    }
    const result = {
        token: p_ctx.read(16),
        source: p_ctx.readNetworkStringUTF16(),
        action: p_ctx.readNetworkStringUTF16(),
        software: {
            name: p_ctx.readNetworkStringUTF16(),
            version: p_ctx.readNetworkStringUTF16(),
        },
        port: p_ctx.readUInt16(),
        address: p_address,
    };
    (0, assert_1.strict)(p_ctx.isEOF());
    return result;
}
class Listener {
    constructor(p_detected, p_lost) {
        this.detected = null;
        this.lost = null;
        this.socket = null;
        this.foundDevices = {};
        this.currentDeviceId = 0;
        this.elapsedTime = 0;
        this.cleanupInterval = 1000; // In milliseconds. It's too specific to add to common
        this.detected = p_detected;
        this.lost = p_lost;
        this.socket = (0, dgram_1.createSocket)('udp4');
        this.socket.on('message', (p_announcement, p_remote) => {
            const ctx = new ReadContext_1.ReadContext(p_announcement.buffer, false);
            const result = readConnectionInfo(ctx, p_remote.address);
            (0, assert_1.strict)(ctx.tell() === p_remote.size);
            if (result === null ||
                result.software.name === 'OfflineAnalyzer' ||
                common_1.EXCLUDE_DEVICES.includes(result.source)) {
                return;
            }

            if (result === null ||
                result.software.name === 'JM08' ||
                common_1.EXCLUDE_DEVICES.includes(result.source)) {
                return;
            }

            (0, assert_1.strict)(result.action === common_1.Action.Login || result.action === common_1.Action.Logout);
            // FIXME: find other way to generate unique key for this device
            const key = `${JSON.stringify(result.token)}`;
            if (this.foundDevices.hasOwnProperty(key)) {
                this.foundDevices[key].time = this.elapsedTime;
            }
            else {
                this.foundDevices[key] = {
                    time: this.elapsedTime,
                    id: this.currentDeviceId++,
                };
                this.detected(this.foundDevices[key].id, result);
            }
        });
        console.info('Listening for StageLinq devices ...');
        this.socket.bind(common_1.LISTEN_PORT);
    }
    release() {
        (0, assert_1.strict)(this.socket);
        this.socket.close;
        this.socket = null;
    }
    update(p_elapsed) {
        const prevTime = this.elapsedTime;
        this.elapsedTime += p_elapsed;
        if (this.elapsedTime > common_1.DISCOVERY_TIMEOUT && this.currentDeviceId === 0) {
            throw new Error('Failed to detect any controller');
        }
        // Check if a cleanup interval has passed
        {
            const cleanupsBefore = Math.floor(prevTime / this.cleanupInterval);
            const cleanupsAfter = Math.floor(this.elapsedTime / this.cleanupInterval);
            if (cleanupsAfter !== cleanupsBefore) {
                this.cleanup();
            }
        }
    }
    cleanup() {
        const cleaned = {};
        for (const [key, elem] of Object.entries(this.foundDevices)) {
            if (this.elapsedTime - elem.time < common_1.LOST_TIMEOUT) {
                cleaned[key] = elem;
            }
            else {
                this.lost(elem.id);
            }
        }
        this.foundDevices = cleaned;
    }
}
exports.Listener = Listener;
//# sourceMappingURL=Listener.js.map
