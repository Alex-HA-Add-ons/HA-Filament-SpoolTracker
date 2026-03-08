// Simple logger utility for structured logging
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(level: string, component: string | undefined, message: string, ...args: any[]): string {
    const timestamp = new Date().toLocaleTimeString();
    const componentPrefix = component ? ` [${component}]` : '';
    const prefix = `[${timestamp}] ${level}${componentPrefix}`;
    
    if (args.length > 0) {
      return `${prefix}: ${message} ${args.map(arg => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}\n${arg.stack || 'No stack trace available'}`;
        } else if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (_e) {
            return `[Object: ${Object.prototype.toString.call(arg)}]`;
          }
        } else {
          return String(arg);
        }
      }).join(' ')}`;
    }
    
    return `${prefix}: ${message}`;
  }

  error(message: string, component?: any, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', component, message, ...args));
    }
  }

  warn(message: string, component?: any, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', component, message, ...args));
    }
  }

  info(message: string, component?: any, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', component, message, ...args));
    }
  }

  debug(message: string, component?: any, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', component, message, ...args));
    }
  }

  // Method to create component-specific logger using closure
  forComponent(component: string) {
    return {
      error: (message: string, ...args: any[]) => this.error(message, component, ...args),
      warn: (message: string, ...args: any[]) => this.warn(message, component, ...args),
      info: (message: string, ...args: any[]) => this.info(message, component, ...args),
      debug: (message: string, ...args: any[]) => this.debug(message, component, ...args)
    };
  }
}

// Create logger instance based on environment
const logLevel = process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG :
                 process.env.LOG_LEVEL === 'warn' ? LogLevel.WARN :
                 process.env.LOG_LEVEL === 'error' ? LogLevel.ERROR :
                 LogLevel.INFO;

// Create single logger instance
const logger = new Logger(logLevel);

// Factory function using closure
export function LOG(component: string) {
  return logger.forComponent(component);
}

// Default logger instance (for backward compatibility)
export { logger };
export { LogLevel }; 