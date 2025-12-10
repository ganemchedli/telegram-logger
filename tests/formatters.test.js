const ErrorFormatter = require('../src/formatters/errorFormatter');
const MessageFormatter = require('../src/formatters/messageFormatter');

describe('ErrorFormatter', () => {
    let formatter;

    beforeEach(() => {
        formatter = new ErrorFormatter({
            appName: 'Test App',
            environment: 'test',
            enableStackTrace: true
        });
    });

    describe('format', () => {
        test('should format basic error', () => {
            const error = new Error('Test error');
            const formatted = formatter.format(error);

            expect(formatted).toContain('Test App');
            expect(formatted).toContain('Test error');
            expect(formatted).toContain('test');
        });

        test('should include error type and code', () => {
            const error = new Error('Test error');
            error.name = 'ValidationError';
            error.code = 'ERR_VALIDATION';
            error.statusCode = 400;

            const formatted = formatter.format(error);

            expect(formatted).toContain('ValidationError');
            expect(formatted).toContain('ERR_VALIDATION');
            expect(formatted).toContain('400');
        });

        test('should include context information', () => {
            const error = new Error('Test error');
            const context = {
                method: 'POST',
                url: '/api/users',
                userId: '123',
                params: { id: '456' },
                query: { filter: 'active' }
            };

            const formatted = formatter.format(error, context);

            expect(formatted).toContain('POST');
            expect(formatted).toContain('/api/users');
            expect(formatted).toContain('123');
        });

        test('should sanitize sensitive data in body', () => {
            const error = new Error('Test error');
            const context = {
                body: {
                    username: 'john',
                    password: 'secret123',
                    apiKey: 'key123'
                }
            };

            const formatted = formatter.format(error, context);

            expect(formatted).toContain('john');
            expect(formatted).toContain('[REDACTED]');
            expect(formatted).not.toContain('secret123');
            expect(formatted).not.toContain('key123');
        });

        test('should sanitize sensitive headers', () => {
            const error = new Error('Test error');
            const context = {
                headers: {
                    'content-type': 'application/json',
                    'authorization': 'Bearer token123',
                    'cookie': 'session=abc123'
                }
            };

            const formatted = formatter.format(error, context);

            expect(formatted).toContain('application/json');
            expect(formatted).toContain('[REDACTED]');
            expect(formatted).not.toContain('token123');
            expect(formatted).not.toContain('abc123');
        });

        test('should include stack trace when enabled', () => {
            const error = new Error('Test error');
            const formatted = formatter.format(error);

            expect(formatted).toContain('Stack Trace');
            expect(formatted).toContain('Error: Test error');
        });

        test('should exclude stack trace when disabled', () => {
            const noStackFormatter = new ErrorFormatter({
                appName: 'Test App',
                enableStackTrace: false
            });

            const error = new Error('Test error');
            const formatted = noStackFormatter.format(error);

            expect(formatted).not.toContain('Stack Trace');
        });

        test('should truncate long stack traces', () => {
            const formatter = new ErrorFormatter({
                appName: 'Test App',
                maxStackTraceLines: 3
            });

            const error = new Error('Test error');
            const formatted = formatter.format(error);

            const stackLines = formatted.match(/at /g);
            expect(stackLines.length).toBeLessThanOrEqual(3);
        });

        test('should escape HTML characters', () => {
            const error = new Error('Error with <script>alert("xss")</script>');
            const formatted = formatter.format(error);

            expect(formatted).toContain('&lt;script&gt;');
            expect(formatted).toContain('&lt;/script&gt;');
            expect(formatted).not.toContain('<script>');
        });

        test('should use appropriate emoji for error severity', () => {
            const error500 = new Error('Server error');
            error500.statusCode = 500;
            const formatted500 = formatter.format(error500);
            expect(formatted500).toContain('🔥');

            const error400 = new Error('Client error');
            error400.statusCode = 400;
            const formatted400 = formatter.format(error400);
            expect(formatted400).toContain('⚠️');
        });
    });

    describe('formatObject', () => {
        test('should format simple objects', () => {
            const obj = { key: 'value', count: 42 };
            const formatted = formatter.formatObject(obj);

            expect(formatted).toContain('key');
            expect(formatted).toContain('value');
            expect(formatted).toContain('42');
        });

        test('should truncate large objects', () => {
            const largeObj = { data: 'x'.repeat(1000) };
            const formatted = formatter.formatObject(largeObj);

            expect(formatted.length).toBeLessThan(600);
            expect(formatted).toContain('...');
        });

        test('should handle circular references', () => {
            const obj = { name: 'test' };
            obj.self = obj;

            const formatted = formatter.formatObject(obj);
            expect(formatted).toContain('Unable to serialize');
        });
    });
});

describe('MessageFormatter', () => {
    let formatter;

    beforeEach(() => {
        formatter = new MessageFormatter({
            appName: 'Test App',
            environment: 'test'
        });
    });

    describe('format', () => {
        test('should format basic message', () => {
            const formatted = formatter.format('Test message');

            expect(formatted).toContain('Test message');
        });

        test('should include title when provided', () => {
            const formatted = formatter.format('Test message', {
                title: 'Important Notice'
            });

            expect(formatted).toContain('Important Notice');
            expect(formatted).toContain('Test message');
        });

        test('should use correct emoji for different levels', () => {
            const levels = [
                { level: 'info', emoji: 'ℹ️' },
                { level: 'success', emoji: '✅' },
                { level: 'warning', emoji: '⚠️' },
                { level: 'error', emoji: '❌' },
                { level: 'critical', emoji: '🔥' }
            ];

            levels.forEach(({ level, emoji }) => {
                const formatted = formatter.format('Test', { level });
                expect(formatted).toContain(emoji);
            });
        });

        test('should include data when provided', () => {
            const formatted = formatter.format('Test message', {
                data: { key: 'value', count: 42 }
            });

            expect(formatted).toContain('key');
            expect(formatted).toContain('value');
            expect(formatted).toContain('42');
        });

        test('should handle string data', () => {
            const formatted = formatter.format('Test message', {
                data: 'Additional information'
            });

            expect(formatted).toContain('Additional information');
        });

        test('should include timestamp by default', () => {
            const formatted = formatter.format('Test message');
            expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        test('should exclude timestamp when disabled', () => {
            const formatted = formatter.format('Test message', {
                includeTimestamp: false
            });

            expect(formatted).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        test('should include app info by default', () => {
            const formatted = formatter.format('Test message');

            expect(formatted).toContain('Test App');
            expect(formatted).toContain('test');
        });

        test('should exclude app info when disabled', () => {
            const formatted = formatter.format('Test message', {
                includeAppInfo: false
            });

            expect(formatted).not.toContain('Test App');
        });

        test('should escape HTML characters in user content', () => {
            const formatted = formatter.format('Message with <script>alert("xss")</script>');

            // User content should be escaped
            expect(formatted).toContain('&lt;script&gt;');
            expect(formatted).not.toContain('<script>');

            // But formatter's own HTML tags should be preserved
            expect(formatted).toContain('<b>');
            expect(formatted).toContain('<i>');
        });
    });
});
