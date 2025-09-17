import winston from "winston";
import * as path from "path";
import * as fs from "fs";
import config from "./../configs/config.json" with { type: "json" };

// Log output directory and file
const WORK_DIR = config.WORK_DIR;
const outDir = path.resolve(WORK_DIR, "generated");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const serverLogPath = path.join(outDir, "server.log");

// Set up the Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      (info) => `${info.timestamp} [${info.level}]: ${String(info.message)}`
    )
  ),
  transports: [
    new winston.transports.File({
      filename: serverLogPath,
      level: "info",
    }),
  ],
});

export default logger;
