import winston from "winston";
/**
 * Structured logger with timestamps, levels, and colored console output.
 * Production would add file transport with rotation.
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "liquifi-bot" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
        })
      ),
    }),
  ],
});
