const connect = require('connect');
const serveStatic = require('serve-static');
const fs = require('fs');
const path = require("path");
const Playlist = require('./playlist');
const Store = require('electron-store');

class Unbox {

    constructor(mainWindow, ipcMain) {
        this.outputPath = process.platform != 'darwin' ? require('os').homedir() + '\\unbox_output' : require('os').homedir() + '/unbox_output';
        this.mode = '';
        this.mainWindow = mainWindow;
        this.ipcMain = ipcMain;
        this.playlist = new Playlist(ipcMain, mainWindow);
        this.lastTrack = null;
        this.config = new Store();
    }

    _buildOutputDir() {

        fs.rmdirSync(this.outputPath, { recursive: true });

        try {
            fs.accessSync(this.outputPath, fs.constants.R_OK | fs.constants.W_OK);
        } catch (err) {
            fs.mkdirSync(this.outputPath);
        }

    }

    startmodeHandler() {
        this.ipcMain.on('switch-mode', (event, arg) => {
            this.mode = arg;
            this.playlist.setMode(this.mode);
        })
    }


    startconfigService() {

        this.config.set('ip', Object.values(require('os').networkInterfaces()).reduce((r, list) => r.concat(list.reduce((rr, i) => rr.concat(i.family === 'IPv4' && !i.internal && i.address || []), [])), [])[0] || 'http://localhost');
        this.mainWindow.webContents.send('config', this.config.store);

        this.ipcMain.on('config-update', (event, arg) => {
            this.config.store = { ...this.config.store, ...arg };
            fs.writeFileSync(path.join(this.outputPath, 'config.json'), JSON.stringify(this.config.store));
        })
    }

    buildDisplay() {

        this.ipcMain.on('update-text-color', (event, arg) => {
            fs.writeFileSync(path.join(this.outputPath, 'text-color.json'), JSON.stringify({ color: arg }));
        })

        this.ipcMain.on('update-background-color', (event, arg) => {
            fs.writeFileSync(path.join(this.outputPath, 'background-color.json'), JSON.stringify({ color: arg }));
        })

        this.ipcMain.on('kuvo-url', (event, arg) => {
            this.kuvoURL = arg;
        })

        this._buildOutputDir();

        const dir = fs.opendirSync(path.join('/Volumes/warehouse/Users/erbartos/Documents/Code/unbox/src/mac/app/overlays'));
        let dirent;
        while ((dirent = dir.readSync()) !== null) {
            let fileName = dirent.name;
            fs.copyFile(path.join('/Volumes/warehouse/Users/erbartos/Documents/Code/unbox/src/mac/app/overlays', fileName), path.join(this.outputPath, fileName), (err) => {
                if (err) { console.log(err) };
            });
        }
        dir.closeSync();
    }

    startWebServer() {
        var app = connect();
        app.use(serveStatic(this.outputPath));
        this.server = app.listen(8080);
    }

    stopWebServer() {
        this.server.close();
    }

    reportLastTrack() {
        let mostRecentArtist = this.playlist.poller.currentTrackDetails['artist'];
        let mostrecentTrack = this.playlist.poller.currentTrackDetails['track'];
        if (mostRecentArtist) {
            this.mainWindow.webContents.send('track-update', mostRecentArtist + ' - ' + mostrecentTrack);
        }

        if ((this.config['db-token']) && (this.lastTrack != mostrecentTrack) && (mostrecentTrack)) {
            this.mainWindow.webContents.send('db-update', {
                'artist': this.playlist.poller.currentTrackDetails['artist'].toUpperCase(),
                'track': this.playlist.poller.currentTrackDetails['track'].toUpperCase()
            });
        }

        this.lastTrack = mostrecentTrack;
    }
}

module.exports = Unbox;
