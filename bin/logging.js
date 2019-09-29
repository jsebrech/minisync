(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "winston"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var winston = require("winston");
    var _logger = null;
    function defaultLogger() {
        if (!_logger)
            _logger = createDefaultLogger();
        return _logger;
    }
    exports.defaultLogger = defaultLogger;
    function createDefaultLogger() {
        return winston.createLogger({
            level: "error",
            transports: [
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });
    }
});
//# sourceMappingURL=logging.js.map