const TelegramErrorLogger = require('../index');

/**
 * Create Express middleware for Telegram error logging
 * @param {object} options - Middleware options
 * @returns {Function} - Express error middleware
 */
function createExpressMiddleware(options) {
    const logger = new TelegramErrorLogger(options);

    /**
     * Express error handling middleware
     * @param {Error} error - Error object
     * @param {import('express').Request} req - Express request
     * @param {import('express').Response} res - Express response
     * @param {import('express').NextFunction} next - Next function
     */
    return async function telegramErrorMiddleware(error, req, res, next) {
        try {
            // Check if route should be excluded
            if (options.excludeRoutes && options.excludeRoutes.includes(req.path)) {
                return next(error);
            }

            // Apply error filter if configured
            if (options.errorFilter && !options.errorFilter(error, req)) {
                return next(error);
            }

            // Extract context from request
            const context = extractContext(req, options);

            // Send error to Telegram (non-blocking)
            logger.sendError(error, context).catch(err => {
                console.error('Failed to send error to Telegram:', err);
            });
        } catch (err) {
            // Don't throw errors from the logger itself
            console.error('Error in Telegram logger middleware:', err);
        }

        // Always pass the error to the next middleware
        next(error);
    };
}

/**
 * Extract context from Express request
 * @param {import('express').Request} req - Express request object
 * @param {object} options - Middleware options
 * @returns {object} - Extracted context
 */
function extractContext(req, options) {
    const context = {
        method: req.method,
        url: req.originalUrl || req.url,
        route: req.route?.path,
        params: req.params || {},
        query: req.query || {}
    };

    // Include body if configured
    if (options.includeBody !== false && req.body) {
        context.body = req.body;
    }

    // Include headers if configured
    if (options.includeHeaders && req.headers) {
        context.headers = req.headers;
    }

    // Extract user information if custom extractor provided
    if (options.extractUser && typeof options.extractUser === 'function') {
        try {
            context.user = options.extractUser(req);
        } catch (err) {
            // Ignore errors in user extraction
        }
    } else if (req.user) {
        // Default user extraction
        context.userId = req.user.id || req.user.userId;
        context.user = req.user;
    }

    // Include IP address
    context.ip = req.ip || req.connection?.remoteAddress;

    // Include any custom context
    if (options.contextExtractor && typeof options.contextExtractor === 'function') {
        try {
            const customContext = options.contextExtractor(req);
            context.custom = customContext;
        } catch (err) {
            // Ignore errors in custom context extraction
        }
    }

    return context;
}

module.exports = createExpressMiddleware;
module.exports.extractContext = extractContext;
