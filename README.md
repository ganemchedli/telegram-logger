# Telegram Error Logger

A comprehensive error logging package for Node.js applications with Telegram integration. Supports **Fastify** and **Express** frameworks with automatic error tracking, rate limiting, deduplication, and rich formatting.

![npm version](https://img.shields.io/npm/v/@telegram-error-logger/core)
![License](https://img.shields.io/npm/l/@telegram-error-logger/core)

## ✨ Features

- 🚀 **Framework Support**: First-class support for Fastify and Express
- 📊 **Rich Formatting**: Beautiful, structured error messages with context
- 🔒 **Security**: Automatic sanitization of sensitive data (passwords, tokens, etc.)
- ⚡ **Rate Limiting**: Prevent spam with configurable rate limits
- 🔄 **Deduplication**: Avoid duplicate error notifications
- 🎯 **Error Filtering**: Only send errors that matter
- 🔧 **Highly Configurable**: Extensive options for customization
- 📝 **TypeScript Support**: Full TypeScript definitions included
- ✅ **Well Tested**: Comprehensive test coverage

## 📦 Installation

```bash
npm install @telegram-error-logger/core
```

## 🚀 Quick Start

### Prerequisites

1. Create a Telegram bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Get your chat ID (use [@userinfobot](https://t.me/userinfobot))

### Fastify Example

```javascript
const fastify = require('fastify');
const telegramErrorLogger = require('@telegram-error-logger/core/src/adapters/fastify');

const app = fastify();

// Register the plugin
app.register(telegramErrorLogger, {
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  appName: 'My Fastify App',
  environment: 'production'
});

// Errors are automatically logged!
app.get('/error', async (request, reply) => {
  throw new Error('Something went wrong!');
});

app.listen({ port: 3000 });
```

### Express Example

```javascript
const express = require('express');
const createExpressMiddleware = require('@telegram-error-logger/core/src/adapters/express');

const app = express();

// Register the middleware (after routes, before error handlers)
app.use(createExpressMiddleware({
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  appName: 'My Express App',
  environment: 'production'
}));

// Errors are automatically logged!
app.get('/error', (req, res, next) => {
  next(new Error('Something went wrong!'));
});

app.listen(3000);
```

### Standalone Usage

```javascript
const TelegramErrorLogger = require('@telegram-error-logger/core');

const logger = new TelegramErrorLogger({
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  appName: 'My App'
});

// Send errors
try {
  // Your code
} catch (error) {
  await logger.sendError(error, {
    userId: '123',
    action: 'processing payment'
  });
}

// Send custom messages
await logger.sendCustomMessage('Deployment completed!', {
  level: 'success',
  data: { version: '1.2.3' }
});
```

## 📖 Configuration Options

### Core Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `botToken` | `string` | **required** | Telegram bot token |
| `chatId` | `string` | **required** | Telegram chat ID |
| `appName` | `string` | `'Application'` | Your application name |
| `environment` | `string` | `'production'` | Environment (dev, staging, prod) |
| `enableStackTrace` | `boolean` | `true` | Include stack traces in errors |
| `maxStackTraceLines` | `number` | `10` | Max stack trace lines to include |

### Framework-Specific Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeHeaders` | `boolean` | `false` | Include request headers |
| `includeBody` | `boolean` | `true` | Include request body |
| `excludeRoutes` | `string[]` | `[]` | Routes to exclude from logging |
| `errorFilter` | `function` | `null` | Filter function for errors |
| `extractUser` | `function` | `null` | Extract user from request |
| `contextExtractor` | `function` | `null` | Extract custom context |

### Advanced Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rateLimitWindow` | `number` | `60000` | Rate limit window (ms) |
| `rateLimitMax` | `number` | `10` | Max errors per window |
| `deduplicate` | `boolean` | `false` | Enable deduplication |
| `deduplicateWindow` | `number` | `300000` | Deduplication window (ms) |
| `retryAttempts` | `number` | `3` | Retry attempts for sending |

## 🎯 Advanced Usage

### Error Filtering

Only send server errors (5xx):

```javascript
app.register(telegramErrorLogger, {
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  errorFilter: (error) => {
    return !error.statusCode || error.statusCode >= 500;
  }
});
```

### User Extraction

Extract user information from requests:

```javascript
app.register(telegramErrorLogger, {
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  extractUser: (request) => {
    return {
      id: request.user?.id,
      email: request.user?.email
    };
  }
});
```

### Custom Context

Add custom context to errors:

```javascript
app.register(telegramErrorLogger, {
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  contextExtractor: (request) => {
    return {
      requestId: request.id,
      userAgent: request.headers['user-agent'],
      correlationId: request.headers['x-correlation-id']
    };
  }
});
```

### Rate Limiting

Prevent spam during error storms:

```javascript
app.register(telegramErrorLogger, {
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  rateLimitWindow: 60000, // 1 minute
  rateLimitMax: 5 // Max 5 errors per minute
});
```

### Deduplication

Avoid duplicate notifications:

```javascript
app.register(telegramErrorLogger, {
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  deduplicate: true,
  deduplicateWindow: 300000 // 5 minutes
});
```

### Manual Logging (Fastify)

```javascript
// Access the logger instance
app.get('/manual', async (request, reply) => {
  try {
    await riskyOperation();
  } catch (error) {
    // Manual error logging with custom context
    await app.telegramLogger.sendError(error, {
      custom: {
        operation: 'riskyOperation',
        retryCount: 3
      }
    });
    throw error;
  }
});

// Send custom notifications
app.post('/deploy', async (request, reply) => {
  await app.telegramLogger.sendCustomMessage(
    'New deployment started',
    {
      level: 'info',
      title: 'Deployment',
      data: {
        version: request.body.version,
        user: request.user.email
      }
    }
  );
});
```

### Route-Level Error Handlers (Fastify)

```javascript
app.post('/critical', {
  errorHandler: async (error, request, reply) => {
    // Custom handling for this specific route
    await app.telegramLogger.sendError(error, {
      custom: {
        criticalRoute: true,
        priority: 'high'
      }
    });
    
    reply.status(500).send({ error: 'Critical error occurred' });
  }
}, async (request, reply) => {
  // Route handler
});
```

## 📋 Message Levels

Custom messages support different severity levels:

- `info` ℹ️ - Informational messages
- `success` ✅ - Success notifications
- `warning` ⚠️ - Warning messages
- `error` ❌ - Error messages
- `critical` 🔥 - Critical alerts
- `debug` 🐛 - Debug information
- `alert` 🚨 - Important alerts

```javascript
await logger.sendCustomMessage('Database backup completed', {
  level: 'success',
  data: { size: '2.5GB', duration: '45s' }
});
```

## 🔒 Security

The logger automatically sanitizes sensitive data:

- **Passwords**: Any field named `password`, `pwd`, `secret`
- **Tokens**: `token`, `apiKey`, `api_key`, `authorization`
- **Headers**: `authorization`, `cookie`, `x-api-key`, `x-auth-token`

All sensitive fields are replaced with `[REDACTED]`.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📝 Examples

Check the `examples/` directory for complete working examples:

- `examples/fastify-example.js` - Comprehensive Fastify integration
- `examples/express-example.js` - Complete Express setup

Run examples:

```bash
# Copy .env.example to .env and add your credentials
cp .env.example .env

# Run Fastify example
npm run example:fastify

# Run Express example
npm run example:express
```

## 🏗️ Project Structure

```
telegram-error-logger/
├── src/
│   ├── index.js                 # Main TelegramErrorLogger class
│   ├── formatters/
│   │   ├── errorFormatter.js    # Error message formatting
│   │   └── messageFormatter.js  # Custom message formatting
│   ├── adapters/
│   │   ├── fastify.js          # Fastify plugin
│   │   └── express.js          # Express middleware
│   ├── utils/
│   │   └── telegram.js         # Telegram API client
│   └── index.d.ts              # TypeScript definitions
├── tests/                       # Test files
├── examples/                    # Usage examples
└── package.json
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

## 🙏 Acknowledgments

Built with:
- [axios](https://github.com/axios/axios) - HTTP client
- [fastify-plugin](https://github.com/fastify/fastify-plugin) - Fastify plugin helper
- [jest](https://jestjs.io/) - Testing framework

## 📞 Support

- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/telegram-error-logger/issues)
- 💬 Telegram: [@yourtelegramhandle](https://t.me/yourtelegramhandle)

---

Made with ❤️ for better error monitoring
