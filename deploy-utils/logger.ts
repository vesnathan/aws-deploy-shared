/**
 * Shared Logger Utility
 *
 * ⚠️ CRITICAL: Used by ALL projects! Test changes across all integrated projects.
 *
 * Provides consistent logging across all deployment scripts with:
 * - Colored console output (chalk)
 * - Timestamps
 * - Spinners for long operations
 * - File logging
 * - Debug mode
 *
 * @see /home/liqk1ugzoezh5okwywlr_/dev/shared/deploy-utils/README.md
 */

import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";

// Debug mode state
let isDebugModeEnabled = false;

// Log file state
let logFilePath: string | null = null;
let logFileStream: fs.WriteStream | null = null;

// Spinner state
const spinnerFrames = ["|", "/", "-", "\\"];
let currentSpinnerFrame = 0;
let spinnerInterval: NodeJS.Timeout | null = null;

/**
 * Get formatted timestamp for console (HH:MM:SS.mmm)
 */
const getTimestamp = (): string => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const ms = now.getMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${ms}`;
};

/**
 * Get ISO timestamp for log files
 */
const getISOTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Write to log file
 */
const writeToLogFile = (level: string, message: string): void => {
  if (logFileStream) {
    const logEntry = `[${getISOTimestamp()}] [${level}] ${message}\n`;
    logFileStream.write(logEntry);
  }
};

/**
 * Clear spinner if running
 */
const clearSpinner = (): void => {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    process.stdout.write("\r" + " ".repeat(150) + "\r");
  }
};

/**
 * Create animated spinner
 */
const createSpinner = (message: string): (() => void) => {
  const timestamp = chalk.gray(`[${getTimestamp()}]`);
  let currentLine = `${timestamp} ${chalk.blue("[INFO]")} ${message} ${chalk.cyan("|")}`;
  process.stdout.write(currentLine);

  spinnerInterval = setInterval(() => {
    // Clear current line
    process.stdout.write("\r" + " ".repeat(currentLine.length) + "\r");

    // Update spinner frame and timestamp
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    currentSpinnerFrame = (currentSpinnerFrame + 1) % spinnerFrames.length;
    const spinnerChar = chalk.cyan(spinnerFrames[currentSpinnerFrame]);
    currentLine = `${timestamp} ${chalk.blue("[INFO]")} ${message} ${spinnerChar}`;
    process.stdout.write(currentLine);
  }, 150);

  // Return stop function
  return () => {
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      spinnerInterval = null;
    }
    process.stdout.write("\r" + " ".repeat(currentLine.length) + "\r");
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.blue("[INFO]"), message);
  };
};

/**
 * Main logger export
 */
export const logger = {
  /**
   * Plain output for menu/UI elements (no timestamp, no color)
   */
  menu: (message: string) => {
    writeToLogFile("MENU", message);
    console.log(message);
  },

  /**
   * Success message (green)
   */
  success: (message: string) => {
    writeToLogFile("SUCCESS", message);
    clearSpinner();
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.green("[SUCCESS]"), message);
  },

  /**
   * Warning message (yellow)
   */
  warning: (message: string) => {
    writeToLogFile("WARNING", message);
    clearSpinner();
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.yellow("[WARNING]"), message);
  },

  /**
   * Error message (red)
   */
  error: (message: string) => {
    writeToLogFile("ERROR", message);
    clearSpinner();
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.red("[ERROR]"), message);
  },

  /**
   * Info message (blue)
   */
  info: (message: string) => {
    writeToLogFile("INFO", message);
    clearSpinner();
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.blue("[INFO]"), message);
  },

  /**
   * Header message (bold blue)
   */
  header: (message: string) => {
    writeToLogFile("HEADER", message);
    clearSpinner();
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.bold.blue("[HEADER]"), message);
  },

  /**
   * Info with animated spinner (returns stop function)
   */
  infoWithSpinner: (message: string): (() => void) => {
    writeToLogFile("INFO", message + " (spinner)");
    return createSpinner(message);
  },

  /**
   * Debug message (magenta, only shown if debug mode enabled)
   */
  debug: (message: string) => {
    writeToLogFile("DEBUG", message);
    if (isDebugModeEnabled) {
      clearSpinner();
      const timestamp = chalk.gray(`[${getTimestamp()}]`);
      console.log(timestamp, chalk.magenta("[DEBUG]"), message);
    }
  },
};

/**
 * Enable/disable debug mode
 */
export const setDebugMode = (enabled: boolean): void => {
  isDebugModeEnabled = enabled;
  if (enabled) {
    logger.debug("Debug mode enabled");
  }
};

/**
 * Get debug mode state
 */
export const getDebugMode = (): boolean => {
  return isDebugModeEnabled;
};

/**
 * Reset debug mode to false
 */
export const resetDebugMode = (): void => {
  isDebugModeEnabled = false;
};

/**
 * Set log file path and open write stream
 */
export const setLogFile = (filePath: string): void => {
  // Close existing stream
  if (logFileStream) {
    logFileStream.end();
  }

  logFilePath = filePath;

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Open write stream
  logFileStream = fs.createWriteStream(filePath, { flags: "a" });

  // Write header
  const separator = "=".repeat(80);
  logFileStream.write(`\n${separator}\n`);
  logFileStream.write(`[${getISOTimestamp()}] Deployment started\n`);
  logFileStream.write(`${separator}\n`);
};

/**
 * Close log file stream
 */
export const closeLogFile = (): void => {
  if (logFileStream) {
    const separator = "=".repeat(80);
    logFileStream.write(`${separator}\n`);
    logFileStream.write(`[${getISOTimestamp()}] Deployment completed\n`);
    logFileStream.write(`${separator}\n\n`);
    logFileStream.end();
    logFileStream = null;
  }
  logFilePath = null;
};

/**
 * Get current log file path
 */
export const getLogFilePath = (): string | null => {
  return logFilePath;
};
