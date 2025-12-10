#!/bin/bash

# Quick Test Script for Telegram Error Logger
# This script sets up a test environment and runs a quick test

echo "🚀 Setting up test environment for Telegram Error Logger..."

# Create test directory
TEST_DIR="$HOME/telegram-logger-test"
echo "📁 Creating test directory: $TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Initialize npm project if not exists
if [ ! -f "package.json" ]; then
    echo "📦 Initializing npm project..."
    npm init -y
fi

# Install dependencies
echo "📥 Installing dependencies..."
npm install fastify dotenv --silent

# Install the telegram-logger package
echo "📦 Installing telegram-error-logger from local tarball..."
PACKAGE_PATH="/home/ganem/Documents/GitHub/telegram-logger/telegram-error-logger-core-1.0.0.tgz"
npm install "$PACKAGE_PATH" --silent

# Create test file
echo "📝 Creating test file..."
cat > test.js << 'EOF'
require('dotenv').config();
const fastify = require('fastify');
const telegramErrorLogger = require('@telegram-error-logger/core/src/adapters/fastify');

const app = fastify({ logger: true });

// Register Telegram error logger
app.register(telegramErrorLogger, {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
  appName: 'Test App',
  environment: 'development',
  deduplicate: true,
  rateLimitMax: 5
});

// Normal route
app.get('/', async () => {
  return { message: 'Hello! Visit /error to test error logging.' };
});

// Error route
app.get('/error', async () => {
  throw new Error('Test error - this should be sent to Telegram!');
});

// Custom notification route
app.get('/notify', async (request, reply) => {
  await app.telegramLogger.sendCustomMessage(
    'Test notification from quick test script',
    {
      level: 'info',
      title: 'Test Notification',
      data: { timestamp: new Date().toISOString() }
    }
  );
  return { message: 'Notification sent!' };
});

// Start server
app.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('\n✅ Server is running!');
  console.log('🌐 URL: http://localhost:3000');
  console.log('\n📍 Available endpoints:');
  console.log('  GET  /        - Normal response');
  console.log('  GET  /error   - Trigger an error (will send to Telegram)');
  console.log('  GET  /notify  - Send a custom notification');
  console.log('\n💡 Press Ctrl+C to stop the server\n');
});
EOF

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "🔑 Creating .env file..."
    cat > .env << 'EOF'
# Add your Telegram credentials here
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
EOF
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file and add your Telegram credentials!"
    echo "   File location: $TEST_DIR/.env"
    echo ""
    read -p "Press Enter after you've updated the .env file..."
fi

# Run the test
echo ""
echo "🎯 Starting test server..."
echo ""
node test.js
