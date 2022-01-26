"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Controller = void 0;
const assert_1 = require("assert");
const common_1 = require("./common");
const ReadContext_1 = require("./utils/ReadContext");
const WriteContext_1 = require("./utils/WriteContext");
const sleep_1 = require("./utils/sleep");
const FileType = require("file-type");
const tcp = require("./utils/tcp");
const fs = require("fs");
const Database = require("better-sqlite3");
class Controller {
    ///////////////////////////////////////////////////////////////////////////
    // Constructor
    constructor(p_id, p_connectionInfo) {
        this._id = null;
        this.connection = null;
        this.connectionInfo = null;
        this.serviceRequestAllowed = false;
        this.servicePorts = {};
        this.services = {
            StateMap: null,
            FileTransfer: null,
        };
        this.timeAlive = 0;
        this.connectedSources = {};
        (0, assert_1.strict)(p_id >= 0);
        this._id = p_id;
        this.connectionInfo = p_connectionInfo;
    }
    ///////////////////////////////////////////////////////////////////////////
    // Getters / Setters
    get id() {
        return this._id;
    }
    ///////////////////////////////////////////////////////////////////////////
    // Connect / Disconnect
    async connect() {
        (0, assert_1.strict)(this.connectionInfo);
        this.connection = await tcp.connect(this.connectionInfo.address, this.connectionInfo.port);
        this.connection.socket.on('data', (p_message) => {
            this.messageHandler(p_message);
        });
        return await this.requestAvailableServices();
    }
    disconnect() {
        // Disconnect all services
        for (const [key, service] of Object.entries(this.services)) {
            if (service) {
                service.disconnect();
            }
            this.services[key] = null;
        }
        (0, assert_1.strict)(this.connection);
        this.connection.destroy();
        this.connection = null;
    }
    ///////////////////////////////////////////////////////////////////////////
    // Message Handler
    messageHandler(p_message) {
        const ctx = new ReadContext_1.ReadContext(p_message.buffer, false);
        while (ctx.isEOF() === false) {
            const id = ctx.readUInt32();
            // FIXME: Verify token
            ctx.seek(16); // Skip token; present in all messages
            switch (id) {
                case common_1.MessageId.TimeStamp:
                    ctx.seek(16); // Skip token; present in all messages
                    // Time Alive is in nanoseconds; convert back to seconds
                    this.timeAlive = Number(ctx.readUInt64() / (1000n * 1000n * 1000n));
                    break;
                case common_1.MessageId.ServicesAnnouncement:
                    const service = ctx.readNetworkStringUTF16();
                    const port = ctx.readUInt16();
                    this.servicePorts[service] = port;
                    break;
                case common_1.MessageId.ServicesRequest:
                    this.serviceRequestAllowed = true;
                    break;
                default:
                    assert_1.strict.fail(`Unhandled message id '${id}'`);
                    break;
            }
        }
    }
    ///////////////////////////////////////////////////////////////////////////
    // Public methods
    getTimeAlive() {
        return this.timeAlive;
    }
    // Factory function
    async connectToService(c) {
        (0, assert_1.strict)(this.connection);
        // FIXME: find out why we need these waits before connecting to a service
        await (0, sleep_1.sleep)(500);
        const serviceName = c.name;
        if (this.services[serviceName]) {
            return this.services[serviceName];
        }
        (0, assert_1.strict)(this.servicePorts.hasOwnProperty(serviceName));
        (0, assert_1.strict)(this.servicePorts[serviceName] > 0);
        const port = this.servicePorts[serviceName];
        const service = new c(this.connectionInfo.address, port, this);
        await service.connect();
        this.services[serviceName] = service;
        return service;
    }
    async addSource(p_sourceName, p_localDbPath, p_localAlbumArtPath) {
        if (this.connectedSources[p_sourceName]) {
            return;
        }
        const db = new Database(p_localDbPath);
        // Get all album art extensions
        const stmt = db.prepare('SELECT * FROM AlbumArt WHERE albumArt NOT NULL');
        const result = stmt.all();
        const albumArtExtensions = {};
        for (const entry of result) {
            const filetype = await FileType.fromBuffer(entry.albumArt);
            albumArtExtensions[entry.id] = filetype ? filetype.ext : null;
        }
        this.connectedSources[p_sourceName] = {
            db: db,
            albumArt: {
                path: p_localAlbumArtPath,
                extensions: albumArtExtensions,
            },
        };
    }
    async dumpAlbumArt(p_sourceName) {
        if (!this.connectedSources[p_sourceName]) {
            assert_1.strict.fail(`Source '${p_sourceName}' not connected`);
            return;
        }
        const path = this.connectedSources[p_sourceName].albumArt.path;
        if (fs.existsSync(path) === false) {
            fs.mkdirSync(path, { recursive: true });
        }
        const result = await this.querySource(p_sourceName, 'SELECT * FROM AlbumArt WHERE albumArt NOT NULL');
        for (const entry of result) {
            const filetype = await FileType.fromBuffer(entry.albumArt);
            const ext = filetype ? '.' + filetype.ext : '';
            const filepath = `${path}/${entry.id}${ext}`;
            fs.writeFileSync(filepath, entry.albumArt);
        }
        console.info(`dumped ${result.length} albums arts in '${path}'`);
    }
    // Database helpers
    querySource(p_sourceName, p_query, ...p_params) {
        if (!this.connectedSources[p_sourceName]) {
            //assert.fail(`Source '${p_sourceName}' not connected`);
            return [];
        }
        const db = this.connectedSources[p_sourceName].db;
        const stmt = db.prepare(p_query);
        return stmt.all(p_params);
    }
    getAlbumArtPath(p_networkPath) {
        const result = this.getSourceAndTrackFromNetworkPath(p_networkPath);
        if (!result) {
            return null;
        }
        const sql = 'SELECT * FROM Track WHERE path = ?';
        const dbResult = this.querySource(result.source, sql, result.trackPath);
        if (dbResult.length === 0) {
            return null;
        }
        (0, assert_1.strict)(dbResult.length === 1); // there can only be one path
        const id = dbResult[0].idAlbumArt;
        const ext = this.connectedSources[result.source].albumArt.extensions[id];
        if (!ext) {
            return null;
        }
        return `${this.connectedSources[result.source].albumArt.path}${id}.${ext}`;
    }
    ///////////////////////////////////////////////////////////////////////////
    // Private methods
    getSourceAndTrackFromNetworkPath(p_path) {
        if (!p_path || p_path.length === 0) {
            return null;
        }
        const parts = p_path.split('/');
        //assert(parts.length > )
        (0, assert_1.strict)(parts[0] === 'net:');
        (0, assert_1.strict)(parts[1] === '');
        (0, assert_1.strict)(parts[2].length === 36);
        const source = parts[3];
        let trackPath = parts.slice(5).join('/');
        if (parts[4] !== 'Engine Library') {
            // This probably occurs with RekordBox conversions; tracks are outside Engine Library folder
            trackPath = `../${parts[4]}/${trackPath}`;
        }
        return {
            source: source,
            trackPath: trackPath,
        };
    }
    async requestAvailableServices() {
        (0, assert_1.strict)(this.connection);
        return new Promise(async (resolve, reject) => {
            setTimeout(() => {
                reject(new Error('Failed to requestServices'));
            }, common_1.CONNECT_TIMEOUT);
            // Wait for serviceRequestAllowed
            while (true) {
                if (this.serviceRequestAllowed) {
                    break;
                }
                await (0, sleep_1.sleep)(250);
            }
            // FIXME: Refactor into message writer helper class
            const ctx = new WriteContext_1.WriteContext();
            ctx.writeUInt32(common_1.MessageId.ServicesRequest);
            ctx.write(common_1.CLIENT_TOKEN);
            const written = await this.connection.write(ctx.getBuffer());
            (0, assert_1.strict)(written === ctx.tell());
            while (true) {
                // FIXME: How to determine when all services have been announced?
                if (Object.keys(this.servicePorts).length > 3) {
                    console.info('Discovered the following services:');
                    for (const [name, port] of Object.entries(this.servicePorts)) {
                        console.info(`\tport: ${port} => ${name}`);
                    }
                    resolve(this.servicePorts);
                    break;
                }
                await (0, sleep_1.sleep)(250);
            }
        });
    }
}
exports.Controller = Controller;
//# sourceMappingURL=Controller.js.map