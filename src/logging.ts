let _logger: Logger;

export function defaultLogger() {
    if (!_logger) _logger = new ConsoleLogger();
    return _logger;
}

export interface LogMethod {
    (...args: any[]): Logger;
}

export type LogLevelString = "error" | "warn" | "info" | "debug" | "none";

export interface Logger {
    level: LogLevelString;
    error: LogMethod;
    warn: LogMethod;
    info: LogMethod;
    debug: LogMethod;
};

class ConsoleLogger implements Logger {
    level: LogLevelString = 'debug';
    error: LogMethod = (...args) => { 
        (this.level !== "none") && console.error(...args);
        return this;
    }
    warn: LogMethod = (...args) => { 
        (['warn', 'info', 'debug'].indexOf(this.level) >= 0) && console.warn(...args);
        return this; 
    }
    info: LogMethod = (...args) => { 
        (this.level === 'debug' || this.level === 'info') && console.info(...args);
        return this;
    }
    debug: LogMethod = (...args) => { 
        (this.level === 'debug') && console.debug(...args);
        return this; 
    }
}
