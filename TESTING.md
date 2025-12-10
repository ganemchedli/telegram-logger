# Testing the Package Privately

Since the package is marked as `"private": true` in `package.json`, it won't be published to npm. Here are several ways to test your package locally:

## Method 1: Using `npm link` (Recommended for Local Testing)

This creates a symlink to your package, allowing you to use it in other projects on your machine.

### Step 1: Link the package
```bash
cd /home/ganem/Documents/GitHub/telegram-logger
npm link
```

### Step 2: Use it in your test project
```bash
cd /path/to/your/test-project
npm link @telegram-error-logger/core
```

### Step 3: Use it in your code
```javascript
const telegramErrorLogger = require('@telegram-error-logger/core/src/adapters/fastify');
// or
const TelegramErrorLogger = require('@telegram-error-logger/core');
```

### Step 4: Unlink when done
```bash
# In your test project
npm unlink @telegram-error-logger/core

# In the package directory
npm unlink
```

## Method 2: Using `npm pack` (Recommended for Testing Installation)

This creates a tarball that simulates what would be published to npm.

### Step 1: Create the package tarball
```bash
cd /home/ganem/Documents/GitHub/telegram-logger
npm pack
```

This creates a file like `telegram-error-logger-core-1.0.0.tgz`

### Step 2: Install in your test project
```bash
cd /path/to/your/test-project
npm install /home/ganem/Documents/GitHub/telegram-logger/telegram-error-logger-core-1.0.0.tgz
```

### Step 3: Use it normally
```javascript
const telegramErrorLogger = require('@telegram-error-logger/core/src/adapters/fastify');
```

## Method 3: Direct Path Installation

Install directly from the local directory.

```bash
cd /path/to/your/test-project
npm install /home/ganem/Documents/GitHub/telegram-logger
```

## Method 4: Using a Private Git Repository

If you want to share with others privately:

### Step 1: Push to a private GitHub repository
```bash
cd /home/ganem/Documents/GitHub/telegram-logger
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 2: Install from Git in other projects
```bash
npm install git+https://github.com/ganem/telegram-logger.git
```

Or add to `package.json`:
```json
{
  "dependencies": {
    "@telegram-error-logger/core": "git+https://github.com/ganem/telegram-logger.git"
  }
}
```

## Method 5: Using a Private npm Registry

For team/organization use, you can use:
- **Verdaccio** (self-hosted private npm registry)
- **GitHub Packages**
- **npm private packages** (paid)

### Example with GitHub Packages:

1. Update `package.json`:
```json
{
  "name": "@YOUR_GITHUB_USERNAME/telegram-error-logger",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

2. Create `.npmrc` in your project:
```
@YOUR_GITHUB_USERNAME:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

3. Publish:
```bash
npm publish
```

## Quick Test Setup

Here's a quick way to test the package:

### 1. Create a test directory
```bash
mkdir ~/test-telegram-logger
cd ~/test-telegram-logger
npm init -y
```

### 2. Install dependencies
```bash
npm install fastify dotenv
```

### 3. Link or install your package
```bash
npm link @telegram-error-logger/core
# OR
npm install /home/ganem/Documents/GitHub/telegram-logger
```

### 4. Create a test file (`test.js`)
```javascript
require('dotenv').config();
const fastify = require('fastify');
const telegramErrorLogger = require('@telegram-error-logger/core/src/adapters/fastify');

const app = fastify({ logger: true });

app.register(telegramErrorLogger, {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
  appName: 'Test App',
  environment: 'development'
});

app.get('/', async () => {
  return { message: 'Hello!' };
});

app.get('/error', async () => {
  throw new Error('Test error - this should be sent to Telegram!');
});

app.listen({ port: 3000 }, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Visit http://localhost:3000/error to trigger an error');
});
```

### 5. Create `.env` file
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### 6. Run the test
```bash
node test.js
```

### 7. Test the error
Visit `http://localhost:3000/error` in your browser or:
```bash
curl http://localhost:3000/error
```

You should receive a Telegram message with the error details!

## When Ready to Publish Publicly

When you're ready to publish to npm:

1. **Remove the private flag**:
   ```json
   {
     "private": false
   }
   ```
   Or simply delete the `"private": true` line.

2. **Login to npm**:
   ```bash
   npm login
   ```

3. **Publish**:
   ```bash
   npm publish --access public
   ```

   Note: For scoped packages (@telegram-error-logger/core), you need `--access public` unless you have a paid npm account.

## Testing Checklist

Before publishing, make sure to test:

- ✅ Installation works
- ✅ All imports work correctly
- ✅ Fastify integration works
- ✅ Express integration works
- ✅ Error messages are sent to Telegram
- ✅ Custom messages work
- ✅ Rate limiting works
- ✅ Deduplication works
- ✅ Error filtering works
- ✅ TypeScript definitions work (if using TypeScript)
- ✅ All tests pass (`npm test`)

## Troubleshooting

### "Cannot find module" error
- Make sure you're using the correct import path
- Try `npm link` again
- Check that the package is in `node_modules`

### Package not updating
- Unlink and re-link: `npm unlink && npm link`
- Or reinstall: `npm uninstall @telegram-error-logger/core && npm install /path/to/package`

### Tests failing
- Run `npm test` in the package directory
- Make sure all dependencies are installed

---

**Recommended Approach**: Use `npm link` for active development and `npm pack` when you want to test the final package before publishing.
