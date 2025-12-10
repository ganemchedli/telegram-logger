const fastify = require('fastify');
const telegramErrorLogger = require('../src/adapters/fastify');

// Mock the TelegramErrorLogger
jest.mock('../src/index');
const TelegramErrorLogger = require('../src/index');

describe('Fastify Plugin', () => {
    let app;
    let mockLogger;

    beforeEach(() => {
        // Create mock logger
        mockLogger = {
            sendError: jest.fn().mockResolvedValue({ ok: true }),
            sendCustomMessage: jest.fn().mockResolvedValue({ ok: true }),
            destroy: jest.fn()
        };

        TelegramErrorLogger.mockImplementation(() => mockLogger);

        // Create Fastify instance
        app = fastify();
    });

    afterEach(async () => {
        await app.close();
    });

    describe('Plugin Registration', () => {
        test('should register plugin successfully', async () => {
            await app.register(telegramErrorLogger, {
                botToken: 'test-token',
                chatId: 'test-chat-id'
            });

            expect(TelegramErrorLogger).toHaveBeenCalledWith(
                expect.objectContaining({
                    botToken: 'test-token',
                    chatId: 'test-chat-id'
                })
            );
        });

        test('should decorate Fastify instance with logger', async () => {
            await app.register(telegramErrorLogger, {
                botToken: 'test-token',
                chatId: 'test-chat-id'
            });

            expect(app.telegramLogger).toBeDefined();
            expect(app.telegramLogger).toBe(mockLogger);
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            await app.register(telegramErrorLogger, {
                botToken: 'test-token',
                chatId: 'test-chat-id',
                appName: 'Test App'
            });

            app.get('/error', async (request, reply) => {
                throw new Error('Test error');
            });

            app.get('/users/:userId', async (request, reply) => {
                throw new Error('User error');
            });

            app.post('/users', async (request, reply) => {
                throw new Error('Create error');
            });

            await app.ready();
        });

        test('should log errors automatically', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/error'
            });

            expect(response.statusCode).toBe(500);
            expect(mockLogger.sendError).toHaveBeenCalledTimes(1);
            expect(mockLogger.sendError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    method: 'GET',
                    url: '/error'
                })
            );
        });

        test('should extract context from request', async () => {
            await app.inject({
                method: 'GET',
                url: '/users/123?filter=active'
            });

            expect(mockLogger.sendError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    method: 'GET',
                    params: { userId: '123' },
                    query: { filter: 'active' }
                })
            );
        });

        test('should include request body when configured', async () => {
            await app.inject({
                method: 'POST',
                url: '/users',
                payload: { name: 'John', email: 'john@example.com' }
            });

            expect(mockLogger.sendError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    body: { name: 'John', email: 'john@example.com' }
                })
            );
        });
    });

    describe('Route Exclusion', () => {
        beforeEach(async () => {
            await app.register(telegramErrorLogger, {
                botToken: 'test-token',
                chatId: 'test-chat-id',
                excludeRoutes: ['/health']
            });

            app.get('/health', async (request, reply) => {
                throw new Error('Health check error');
            });

            app.get('/api', async (request, reply) => {
                throw new Error('API error');
            });

            await app.ready();
        });

        test('should not log errors from excluded routes', async () => {
            await app.inject({
                method: 'GET',
                url: '/health'
            });

            expect(mockLogger.sendError).not.toHaveBeenCalled();
        });

        test('should log errors from non-excluded routes', async () => {
            await app.inject({
                method: 'GET',
                url: '/api'
            });

            expect(mockLogger.sendError).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error Filtering', () => {
        beforeEach(async () => {
            await app.register(telegramErrorLogger, {
                botToken: 'test-token',
                chatId: 'test-chat-id',
                errorFilter: (error) => error.statusCode >= 500
            });

            app.get('/client-error', async (request, reply) => {
                const error = new Error('Client error');
                error.statusCode = 400;
                throw error;
            });

            app.get('/server-error', async (request, reply) => {
                const error = new Error('Server error');
                error.statusCode = 500;
                throw error;
            });

            await app.ready();
        });

        test('should filter out client errors', async () => {
            await app.inject({
                method: 'GET',
                url: '/client-error'
            });

            expect(mockLogger.sendError).not.toHaveBeenCalled();
        });

        test('should log server errors', async () => {
            await app.inject({
                method: 'GET',
                url: '/server-error'
            });

            expect(mockLogger.sendError).toHaveBeenCalledTimes(1);
        });
    });

    describe('User Extraction', () => {
        beforeEach(async () => {
            await app.register(telegramErrorLogger, {
                botToken: 'test-token',
                chatId: 'test-chat-id',
                extractUser: (request) => {
                    return { id: request.headers['x-user-id'] };
                }
            });

            app.get('/protected', async (request, reply) => {
                throw new Error('Protected error');
            });

            await app.ready();
        });

        test('should extract user from request', async () => {
            await app.inject({
                method: 'GET',
                url: '/protected',
                headers: {
                    'x-user-id': '12345'
                }
            });

            expect(mockLogger.sendError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    user: { id: '12345' }
                })
            );
        });
    });

    describe('Manual Logging', () => {
        beforeEach(async () => {
            await app.register(telegramErrorLogger, {
                botToken: 'test-token',
                chatId: 'test-chat-id'
            });

            app.get('/manual', async (request, reply) => {
                await app.telegramLogger.sendError(
                    new Error('Manual error'),
                    { custom: 'context' }
                );
                return { success: true };
            });

            await app.ready();
        });

        test('should allow manual error logging', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/manual'
            });

            expect(response.statusCode).toBe(200);
            expect(mockLogger.sendError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    custom: 'context'
                })
            );
        });
    });

    describe('Cleanup', () => {
        test('should destroy logger on close', async () => {
            await app.register(telegramErrorLogger, {
                botToken: 'test-token',
                chatId: 'test-chat-id'
            });

            await app.ready();
            await app.close();

            expect(mockLogger.destroy).toHaveBeenCalled();
        });
    });
});
