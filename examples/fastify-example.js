require('dotenv').config();
const fastify = require('fastify');
const telegramErrorLogger = require('../src/adapters/fastify');

// Create Fastify instance
const app = fastify({
    logger: true
});

// Register Telegram error logger plugin
app.register(telegramErrorLogger, {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    appName: 'Fastify Example App',
    environment: process.env.ENVIRONMENT || 'development',

    // Fastify-specific options
    includeHeaders: false,
    includeBody: true,
    excludeRoutes: ['/health', '/metrics'],

    // Error filtering - only send 5xx errors
    errorFilter: (error) => {
        return !error.statusCode || error.statusCode >= 500;
    },

    // Extract user info from request
    extractUser: (request) => {
        return request.user || { id: 'anonymous' };
    },

    // Rate limiting
    rateLimitWindow: 60000, // 1 minute
    rateLimitMax: 10,

    // Deduplication
    deduplicate: true,
    deduplicateWindow: 300000 // 5 minutes
});

// Health check route (excluded from error logging)
app.get('/health', async (request, reply) => {
    return { status: 'ok' };
});

// Example route that works fine
app.get('/', async (request, reply) => {
    return { message: 'Hello from Fastify!' };
});

// Example route that throws an error
app.get('/error', async (request, reply) => {
    throw new Error('This is a test error from Fastify!');
});

// Example route with custom error
app.get('/custom-error', async (request, reply) => {
    const error = new Error('Custom validation error');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
});

// Example route with params and query
app.get('/users/:userId', async (request, reply) => {
    const { userId } = request.params;

    if (userId === '999') {
        throw new Error('User not found');
    }

    return { userId, name: 'John Doe' };
});

// Example POST route with body
app.post('/users', async (request, reply) => {
    const { name, email } = request.body;

    if (!name || !email) {
        const error = new Error('Name and email are required');
        error.statusCode = 400;
        throw error;
    }

    return { id: 1, name, email };
});

// Example of manual error logging
app.get('/manual-log', async (request, reply) => {
    try {
        // Simulate some operation
        const result = riskyOperation();
        return { result };
    } catch (error) {
        // Manually log to Telegram with custom context
        await app.telegramLogger.sendError(error, {
            custom: {
                operation: 'riskyOperation',
                attemptNumber: 3
            }
        });

        throw error;
    }
});

// Example of sending custom messages
app.get('/notify', async (request, reply) => {
    await app.telegramLogger.sendCustomMessage(
        'A user just accessed the notify endpoint',
        {
            level: 'info',
            title: 'User Activity',
            data: {
                userId: request.user?.id || 'anonymous',
                ip: request.ip
            }
        }
    );

    return { message: 'Notification sent!' };
});

// Example with route-level error handler
app.post('/special', {
    errorHandler: async (error, request, reply) => {
        // Custom error handling for this specific route
        await app.telegramLogger.sendError(error, {
            custom: {
                specialRoute: true,
                importance: 'high'
            }
        });

        reply.status(500).send({
            error: 'Something went wrong in special route'
        });
    }
}, async (request, reply) => {
    throw new Error('Special route error');
});

// Helper function for example
function riskyOperation() {
    if (Math.random() > 0.5) {
        throw new Error('Random operation failed');
    }
    return 'success';
}

// Start server
const start = async () => {
    try {
        await app.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Fastify server running on http://localhost:3000');
        console.log('\nTry these endpoints:');
        console.log('  GET  /           - Normal response');
        console.log('  GET  /error      - Trigger an error');
        console.log('  GET  /users/999  - User not found error');
        console.log('  POST /users      - Create user (requires name and email)');
        console.log('  GET  /notify     - Send custom notification');
        console.log('  GET  /health     - Health check (no error logging)');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
