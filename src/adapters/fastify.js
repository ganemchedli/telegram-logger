const fp = require('fastify-plugin');
const TelegramErrorLogger = require('../index');

/**
 * Fastify plugin for Telegram error logging
 * @param {import('fastify').FastifyInstance} fastify - Fastify instance
 * @param {object} options - Plugin options
 */
async function telegramErrorLoggerPlugin(fastify, options) {
    // Create logger instance
    const logger = new TelegramErrorLogger(options);

    // Decorate Fastify instance with the logger
    fastify.decorate('telegramLogger', logger);

    // Add onError hook for automatic error logging
    fastify.addHook('onError', async (request, reply, error) => {
        try {
            // Check if route should be excluded
            if (options.excludeRoutes && options.excludeRoutes.includes(request.url)) {
                return;
            }

            // Apply error filter if configured
            if (options.errorFilter && !options.errorFilter(error, request)) {
                return;
            }

            // Extract context from request
            const context = extractContext(request, options);

            // Send error to Telegram
            await logger.sendError(error, context);
        } catch (err) {
            // Don't throw errors from the logger itself
            fastify.log.error('Failed to send error to Telegram:', err);
        }
    });

    // Add onClose hook to cleanup
    fastify.addHook('onClose', async (instance) => {
        logger.destroy();
    });
}

/**
 * Extract context from Fastify request
 * @param {import('fastify').FastifyRequest} request - Fastify request object
 * @param {object} options - Plugin options
 * @returns {object} - Extracted context
 */
function extractContext(request, options) {
    const context = {
        method: request.method,
        url: request.url,
        route: request.routeOptions?.url || request.routerPath,
        params: request.params || {},
        query: request.query || {}
    };

    // Include body if configured
    if (options.includeBody !== false && request.body) {
        context.body = request.body;
    }

    // Include headers if configured
    if (options.includeHeaders && request.headers) {
        context.headers = request.headers;
    }

    // Extract user information if custom extractor provided
    if (options.extractUser && typeof options.extractUser === 'function') {
        try {
            context.user = options.extractUser(request);
        } catch (err) {
            // Ignore errors in user extraction
        }
    } else if (request.user) {
        // Default user extraction
        context.userId = request.user.id || request.user.userId;
        context.user = request.user;
    }

    // Include IP address
    context.ip = request.ip;

    // Include any custom context
    if (options.contextExtractor && typeof options.contextExtractor === 'function') {
        try {
            const customContext = options.contextExtractor(request);
            context.custom = customContext;
        } catch (err) {
            // Ignore errors in custom context extraction
        }
    }

    return context;
}

/**
 * Create a route-level error handler
 * @param {TelegramErrorLogger} logger - Logger instance
 * @param {object} options - Handler options
 * @returns {Function} - Error handler function
 */
function createRouteErrorHandler(logger, options = {}) {
    return async function (error, request, reply) {
        try {
            const context = extractContext(request, options);
            await logger.sendError(error, context);
        } catch (err) {
            // Don't throw errors from the logger itself
            console.error('Failed to send error to Telegram:', err);
        }

        // Re-throw the error or send error response
        if (options.rethrow !== false) {
            throw error;
        }
    };
}

// Export as Fastify plugin
module.exports = fp(telegramErrorLoggerPlugin, {
    fastify: '4.x || 5.x',
    name: '@telegram-error-logger/fastify'
});

// Export helper function
module.exports.createRouteErrorHandler = createRouteErrorHandler;
module.exports.extractContext = extractContext;
