"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControllerMgr = void 0;
const assert_1 = require("assert");
const Controller_1 = require("./Controller");
const services_1 = require("./services");
class ControllerMgr {
    constructor() {
        this.controllers = {};
    }
    async createController(p_id, p_info) {
        (0, assert_1.strict)(!this.controllers[p_id]);
        const controller = new Controller_1.Controller(p_id, p_info);
        this.controllers[p_id] = controller;
        // FIXME: Do we need to connect to controller in 'create' as well?
        const servicePorts = await controller.connect();
        // FIXME: Come up with some logic to have more control over which services I want to connect to for specific controllers
        if (servicePorts.StateMap) {
            await controller.connectToService(services_1.StateMap);
        }
        // FIXME: Disabled for now
        /*
        if (servicePorts.FileTransfer) {
            await controller.connectToService(FileTransfer);
        }
        */
        return controller;
    }
    async destroyController(p_id) {
        if (this.controllers[p_id]) {
            this.controllers[p_id].disconnect();
            delete this.controllers[p_id];
        }
    }
    update(p_elapsedTime) {
        p_elapsedTime;
    }
}
exports.ControllerMgr = ControllerMgr;
//# sourceMappingURL=ControllerMgr.js.map