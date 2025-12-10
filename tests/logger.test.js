const TelegramErrorLogger = require('../src/index');

// Mock axios
jest.mock('axios');
const axios = require('axios');

describe('TelegramErrorLogger', () => {
    let logger;
    const mockConfig = {
        botToken: 'test-bot-token',
        chatId: 'test-chat-id',
        appName: 'Test App',
        environment: 'test'
    };

    beforeEach(() => {
        logger = new TelegramErrorLogger(mockConfig);
        axios.post.mockClear();
    });

    afterEach(() => {
        logger.destroy();
    });

    describe('Constructor', () => {
        test('should create logger with valid config', () => {
            expect(logger).toBeInstanceOf(TelegramErrorLogger);
            expect(logger.config.appName).toBe('Test App');
            expect(logger.config.environment).toBe('test');
        });

        test('should throw error if botToken is missing', () => {
            expect(() => {
                new TelegramErrorLogger({ chatId: 'test' });
            }).toThrow('Telegram bot token is required');
        });

        test('should throw error if chatId is missing', () => {
            expect(() => {
                new TelegramErrorLogger({ botToken: 'test' });
            }).toThrow('Telegram chat ID is required');
        });

        test('should use default values for optional config', () => {
            const minimalLogger = new TelegramErrorLogger({
                botToken: 'test',
                chatId: 'test'
            });

            expect(minimalLogger.config.appName).toBe('Application');
            expect(minimalLogger.config.environment).toBe('production');
            expect(minimalLogger.config.enableStackTrace).toBe(true);

            minimalLogger.destroy();
        });
    });

    describe('sendError', () => {
        test('should send error to Telegram', async () => {
            axios.post.mockResolvedValue({
                data: { ok: true, result: { message_id: 123 } }
            });

            const error = new Error('Test error');
            const result = await logger.sendError(error);

            expect(axios.post).toHaveBeenCalledTimes(1);
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/sendMessage'),
                expect.objectContaining({
                    chat_id: 'test-chat-id',
                    text: expect.stringContaining('Test error')
                }),
                expect.any(Object)
            );
            expect(result).toEqual({ ok: true, result: { message_id: 123 } });
        });

        test('should include context in error message', async () => {
            axios.post.mockResolvedValue({
                data: { ok: true }
            });

            const error = new Error('Test error');
            const context = {
                method: 'GET',
                url: '/api/test',
                userId: '123'
            };

            await logger.sendError(error, context);

            const callArgs = axios.post.mock.calls[0][1];
            expect(callArgs.text).toContain('GET');
            expect(callArgs.text).toContain('/api/test');
        });

        test('should filter errors based on errorFilter', async () => {
            const filterLogger = new TelegramErrorLogger({
                ...mockConfig,
                errorFilter: (error) => error.statusCode >= 500
            });

            const error400 = new Error('Client error');
            error400.statusCode = 400;

            const error500 = new Error('Server error');
            error500.statusCode = 500;

            await filterLogger.sendError(error400);
            expect(axios.post).not.toHaveBeenCalled();

            await filterLogger.sendError(error500);
            expect(axios.post).toHaveBeenCalledTimes(1);

            filterLogger.destroy();
        });

        test('should respect rate limiting', async () => {
            axios.post.mockResolvedValue({ data: { ok: true } });

            const rateLimitLogger = new TelegramErrorLogger({
                ...mockConfig,
                rateLimitWindow: 1000,
                rateLimitMax: 2
            });

            const error = new Error('Test error');

            // First two should succeed
            await rateLimitLogger.sendError(error);
            await rateLimitLogger.sendError(error);
            expect(axios.post).toHaveBeenCalledTimes(2);

            // Third should be rate limited
            await rateLimitLogger.sendError(error);
            expect(axios.post).toHaveBeenCalledTimes(2);

            rateLimitLogger.destroy();
        });

        test('should deduplicate errors', async () => {
            axios.post.mockResolvedValue({ data: { ok: true } });

            const dedupeLogger = new TelegramErrorLogger({
                ...mockConfig,
                deduplicate: true,
                deduplicateWindow: 5000
            });

            const error = new Error('Duplicate error');

            await dedupeLogger.sendError(error, { route: '/test' });
            expect(axios.post).toHaveBeenCalledTimes(1);

            // Same error should be deduplicated
            await dedupeLogger.sendError(error, { route: '/test' });
            expect(axios.post).toHaveBeenCalledTimes(1);

            // Different context should not be deduplicated
            await dedupeLogger.sendError(error, { route: '/other' });
            expect(axios.post).toHaveBeenCalledTimes(2);

            dedupeLogger.destroy();
        });

        test('should handle Telegram API errors gracefully', async () => {
            axios.post.mockRejectedValue(new Error('Network error'));

            const error = new Error('Test error');
            const result = await logger.sendError(error);

            expect(result).toBeNull();
        });
    });

    describe('sendCustomMessage', () => {
        test('should send custom message to Telegram', async () => {
            axios.post.mockResolvedValue({
                data: { ok: true }
            });

            await logger.sendCustomMessage('Test message', {
                level: 'info',
                title: 'Test Title'
            });

            expect(axios.post).toHaveBeenCalledTimes(1);
            const callArgs = axios.post.mock.calls[0][1];
            expect(callArgs.text).toContain('Test message');
            expect(callArgs.text).toContain('Test Title');
        });

        test('should include data in custom message', async () => {
            axios.post.mockResolvedValue({
                data: { ok: true }
            });

            await logger.sendCustomMessage('Test message', {
                level: 'warning',
                data: { key: 'value', count: 42 }
            });

            const callArgs = axios.post.mock.calls[0][1];
            expect(callArgs.text).toContain('key');
            expect(callArgs.text).toContain('value');
        });
    });

    describe('sendRawMessage', () => {
        test('should send raw message without formatting', async () => {
            axios.post.mockResolvedValue({
                data: { ok: true }
            });

            const rawMessage = 'Plain text message';
            await logger.sendRawMessage(rawMessage);

            expect(axios.post).toHaveBeenCalledTimes(1);
            const callArgs = axios.post.mock.calls[0][1];
            expect(callArgs.text).toBe(rawMessage);
        });
    });

    describe('Rate Limiting', () => {
        test('should clean up old rate limit entries', async () => {
            jest.useFakeTimers();

            const rateLimitLogger = new TelegramErrorLogger({
                ...mockConfig,
                rateLimitWindow: 1000,
                rateLimitMax: 5
            });

            expect(rateLimitLogger.errorCounts.size).toBe(0);

            // Trigger cleanup
            jest.advanceTimersByTime(61000);

            rateLimitLogger.destroy();
            jest.useRealTimers();
        });
    });

    describe('Deduplication', () => {
        test('should generate consistent error hashes', () => {
            const error1 = new Error('Test error');
            const error2 = new Error('Test error');
            const context = { route: '/test' };

            const hash1 = logger.getErrorHash(error1, context);
            const hash2 = logger.getErrorHash(error2, context);

            expect(hash1).toBe(hash2);
        });

        test('should generate different hashes for different errors', () => {
            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');
            const context = { route: '/test' };

            const hash1 = logger.getErrorHash(error1, context);
            const hash2 = logger.getErrorHash(error2, context);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('Cleanup', () => {
        test('should clear interval on destroy', () => {
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            logger.destroy();

            expect(clearIntervalSpy).toHaveBeenCalled();
            clearIntervalSpy.mockRestore();
        });
    });
});
