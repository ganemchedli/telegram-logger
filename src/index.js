const TelegramClient = require('./utils/telegram');
const ErrorFormatter = require('./formatters/errorFormatter');
const MessageFormatter = require('./formatters/messageFormatter');

/**
 * Main TelegramErrorLogger class
 */
class TelegramErrorLogger {
    constructor(config = {}) {
        // Validate required configuration
        if (!config.botToken) {
            throw new Error('Telegram bot token is required');
        }
        if (!config.chatId) {
            throw new Error('Telegram chat ID is required');
        }

        // Store configuration
        this.config = {
            botToken: config.botToken,
            chatId: config.chatId,
            appName: config.appName || 'Application',
            environment: config.environment || 'production',
            enableStackTrace: config.enableStackTrace !== false,
            maxStackTraceLines: config.maxStackTraceLines || 10,
            includeHeaders: config.includeHeaders || false,
            includeBody: config.includeBody !== false,
            excludeRoutes: config.excludeRoutes || [],
            errorFilter: config.errorFilter || null,
            extractUser: config.extractUser || null,
            rateLimitWindow: config.rateLimitWindow || 60000, // 1 minute
            rateLimitMax: config.rateLimitMax || 10,
            deduplicate: config.deduplicate || false,
            deduplicateWindow: config.deduplicateWindow || 300000, // 5 minutes
            retryAttempts: config.retryAttempts || 3
        };

        // Initialize components
        this.telegramClient = new TelegramClient(config.botToken, config.chatId);
        this.errorFormatter = new ErrorFormatter({
            appName: this.config.appName,
            environment: this.config.environment,
            enableStackTrace: this.config.enableStackTrace,
            maxStackTraceLines: this.config.maxStackTraceLines
        });
        this.messageFormatter = new MessageFormatter({
            appName: this.config.appName,
            environment: this.config.environment
        });

        // Rate limiting
        this.errorCounts = new Map();
        this.errorHashes = new Map(); // For deduplication

        // Start cleanup interval for rate limiting and deduplication
        this.startCleanupInterval();
    }

    /**
     * Send an error to Telegram
     * @param {Error} error - The error object
     * @param {object} context - Additional context
     * @returns {Promise<object>} - Telegram API response
     */
    async sendError(error, context = {}) {
        try {
            // Apply error filter if configured
            if (this.config.errorFilter && !this.config.errorFilter(error, context)) {
                return null;
            }

            // Check rate limiting
            if (!this.checkRateLimit()) {
                console.warn('Telegram error logger: Rate limit exceeded, skipping error');
                return null;
            }

            // Check deduplication
            if (this.config.deduplicate) {
                const errorHash = this.getErrorHash(error, context);
                if (this.isDuplicate(errorHash)) {
                    console.warn('Telegram error logger: Duplicate error detected, skipping');
                    return null;
                }
                this.recordError(errorHash);
            }

            // Format the error
            const formattedMessage = this.errorFormatter.format(error, context);

            // Send to Telegram
            return await this.telegramClient.sendMessageWithRetry(
                formattedMessage,
                {},
                this.config.retryAttempts
            );
        } catch (err) {
            console.error('Failed to send error to Telegram:', err.message);
            return null;
        }
    }

    /**
     * Send a custom message to Telegram
     * @param {string} message - The message text
     * @param {object} options - Formatting options
     * @returns {Promise<object>} - Telegram API response
     */
    async sendCustomMessage(message, options = {}) {
        try {
            const formattedMessage = this.messageFormatter.format(message, options);

            return await this.telegramClient.sendMessageWithRetry(
                formattedMessage,
                {},
                this.config.retryAttempts
            );
        } catch (error) {
            console.error('Failed to send custom message to Telegram:', error.message);
            return null;
        }
    }

    /**
     * Send a raw message to Telegram (bypass formatting)
     * @param {string} message - The raw message
     * @param {object} options - Telegram API options
     * @returns {Promise<object>} - Telegram API response
     */
    async sendRawMessage(message, options = {}) {
        try {
            return await this.telegramClient.sendMessage(message, options);
        } catch (error) {
            console.error('Failed to send raw message to Telegram:', error.message);
            return null;
        }
    }

    /**
     * Check if rate limit is exceeded
     * @returns {boolean} - True if within rate limit
     */
    checkRateLimit() {
        const now = Date.now();
        const windowStart = now - this.config.rateLimitWindow;

        // Clean old entries
        for (const [timestamp] of this.errorCounts) {
            if (timestamp < windowStart) {
                this.errorCounts.delete(timestamp);
            }
        }

        // Count errors in current window
        const errorCount = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);

        if (errorCount >= this.config.rateLimitMax) {
            return false;
        }

        // Record this error
        this.errorCounts.set(now, (this.errorCounts.get(now) || 0) + 1);
        return true;
    }

    /**
     * Generate a hash for error deduplication
     * @param {Error} error - The error object
     * @param {object} context - Error context
     * @returns {string} - Error hash
     */
    getErrorHash(error, context) {
        const key = `${error.name}:${error.message}:${context.route || context.url || ''}`;
        return key;
    }

    /**
     * Check if error is a duplicate
     * @param {string} errorHash - Error hash
     * @returns {boolean} - True if duplicate
     */
    isDuplicate(errorHash) {
        const lastSeen = this.errorHashes.get(errorHash);
        if (!lastSeen) {
            return false;
        }

        const now = Date.now();
        return (now - lastSeen) < this.config.deduplicateWindow;
    }

    /**
     * Record an error for deduplication
     * @param {string} errorHash - Error hash
     */
    recordError(errorHash) {
        this.errorHashes.set(errorHash, Date.now());
    }

    /**
     * Start cleanup interval for rate limiting and deduplication
     */
    startCleanupInterval() {
        // Clean up old entries every minute
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const rateLimitWindowStart = now - this.config.rateLimitWindow;
            const deduplicateWindowStart = now - this.config.deduplicateWindow;

            // Clean rate limit entries
            for (const [timestamp] of this.errorCounts) {
                if (timestamp < rateLimitWindowStart) {
                    this.errorCounts.delete(timestamp);
                }
            }

            // Clean deduplication entries
            for (const [hash, timestamp] of this.errorHashes) {
                if (timestamp < deduplicateWindowStart) {
                    this.errorHashes.delete(hash);
                }
            }
        }, 60000);

        // Don't keep the process alive just for this interval
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    /**
     * Stop the cleanup interval
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

module.exports = TelegramErrorLogger;
