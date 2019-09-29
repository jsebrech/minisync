import * as winston from "winston";

export type Logger = winston.Logger;

let _logger: Logger = null;

export function defaultLogger() {
    if (!_logger) _logger = createDefaultLogger();
    return _logger;
}

function createDefaultLogger(): Logger {
    return winston.createLogger({
        level: "error",
        transports: [
            new winston.transports.Console({
                format: winston.format.simple()
            })
        ]
    });
}
