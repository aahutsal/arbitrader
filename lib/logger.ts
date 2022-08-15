import winston from "winston";

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    defaultMeta: { service: 'arbitrator-service' },
    transports: [
        //
        // - Write all logs with importance level of `error` or less to `error.debug`
        // - Write all logs with importance level of `info` or less to `combined.debug`
        //
        new winston.transports.File({ filename: 'error.debug', level: 'error' }),
        new winston.transports.File({ filename: 'combined.debug' }),
    ],
});
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

export { logger }
