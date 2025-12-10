require('dotenv').config();
const express = require('express');
const createExpressMiddleware = require('../src/adapters/express');

// Create Express app
const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route (before error logger to exclude it)
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Register Telegram error logger middleware
// IMPORTANT: This should be registered AFTER routes but BEFORE other error handlers
const telegramErrorMiddleware = createExpressMiddleware({
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    appName: 'Express Example App',
    environment: process.env.ENVIRONMENT || 'development',

    // Express-specific options
    includeHeaders: false,
    includeBody: true,
    excludeRoutes: ['/health', '/metrics'],

    // Error filtering - only send 5xx errors
    errorFilter: (error) => {
        return !error.statusCode || error.statusCode >= 500;
    },

    // Extract user info from request
    extractUser: (req) => {
        return req.user || { id: 'anonymous' };
    },

    // Rate limiting
    rateLimitWindow: 60000, // 1 minute
    rateLimitMax: 10,

    // Deduplication
    deduplicate: true,
    deduplicateWindow: 300000 // 5 minutes
});

// Example route that works fine
app.get('/', (req, res) => {
    res.json({ message: 'Hello from Express!' });
});

// Example route that throws an error
app.get('/error', (req, res, next) => {
    const error = new Error('This is a test error from Express!');
    next(error);
});

// Example route with custom error
app.get('/custom-error', (req, res, next) => {
    const error = new Error('Custom validation error');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    next(error);
});

// Example route with params and query
app.get('/users/:userId', (req, res, next) => {
    const { userId } = req.params;

    if (userId === '999') {
        return next(new Error('User not found'));
    }

    res.json({ userId, name: 'John Doe' });
});

// Example POST route with body
app.post('/users', (req, res, next) => {
    const { name, email } = req.body;

    if (!name || !email) {
        const error = new Error('Name and email are required');
        error.statusCode = 400;
        return next(error);
    }

    res.json({ id: 1, name, email });
});

// Example of async route with error
app.get('/async-error', async (req, res, next) => {
    try {
        await someAsyncOperation();
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Helper function for example
async function someAsyncOperation() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error('Async operation failed'));
        }, 100);
    });
}

// Register the Telegram error middleware
// This must come AFTER all routes
app.use(telegramErrorMiddleware);

// Final error handler (after Telegram middleware)
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        error: {
            message: err.message,
            code: err.code,
            statusCode
        }
    });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
    console.log('\nTry these endpoints:');
    console.log('  GET  /           - Normal response');
    console.log('  GET  /error      - Trigger an error');
    console.log('  GET  /users/999  - User not found error');
    console.log('  POST /users      - Create user (requires name and email)');
    console.log('  GET  /async-error - Async error example');
    console.log('  GET  /health     - Health check (no error logging)');
});
