// Type definitions for @telegram-error-logger/core

export interface TelegramErrorLoggerConfig {
    /** Telegram bot token (required) */
    botToken: string;
    /** Telegram chat ID (required) */
    chatId: string;
    /** Application name */
    appName?: string;
    /** Environment (e.g., 'production', 'development') */
    environment?: string;
    /** Enable stack trace in error messages */
    enableStackTrace?: boolean;
    /** Maximum number of stack trace lines to include */
    maxStackTraceLines?: number;
    /** Include request headers in error context */
    includeHeaders?: boolean;
    /** Include request body in error context */
    includeBody?: boolean;
    /** Array of routes to exclude from logging */
    excludeRoutes?: string[];
    /** Function to filter which errors to send */
    errorFilter?: (error: Error, context?: any) => boolean;
    /** Function to extract user information from request */
    extractUser?: (request: any) => any;
    /** Function to extract custom context from request */
    contextExtractor?: (request: any) => any;
    /** Rate limit window in milliseconds */
    rateLimitWindow?: number;
    /** Maximum number of errors per rate limit window */
    rateLimitMax?: number;
    /** Enable error deduplication */
    deduplicate?: boolean;
    /** Deduplication window in milliseconds */
    deduplicateWindow?: number;
    /** Number of retry attempts for sending messages */
    retryAttempts?: number;
}

export interface ErrorContext {
    /** HTTP method */
    method?: string;
    /** Request URL */
    url?: string;
    /** Request path */
    path?: string;
    /** Route pattern */
    route?: string;
    /** Route parameters */
    params?: Record<string, any>;
    /** Query parameters */
    query?: Record<string, any>;
    /** Request body */
    body?: any;
    /** Request headers */
    headers?: Record<string, string>;
    /** User ID */
    userId?: string | number;
    /** User object */
    user?: any;
    /** IP address */
    ip?: string;
    /** Custom context */
    custom?: any;
}

export interface MessageOptions {
    /** Message level (info, warning, error, etc.) */
    level?: 'info' | 'success' | 'warning' | 'error' | 'critical' | 'debug' | 'alert';
    /** Message title */
    title?: string;
    /** Additional data to include */
    data?: any;
    /** Include timestamp in message */
    includeTimestamp?: boolean;
    /** Include application info in message */
    includeAppInfo?: boolean;
}

export interface TelegramApiResponse {
    ok: boolean;
    result?: any;
    error_code?: number;
    description?: string;
}

export class TelegramErrorLogger {
    constructor(config: TelegramErrorLoggerConfig);

    /**
     * Send an error to Telegram
     * @param error - The error object
     * @param context - Additional context
     * @returns Telegram API response
     */
    sendError(error: Error, context?: ErrorContext): Promise<TelegramApiResponse | null>;

    /**
     * Send a custom message to Telegram
     * @param message - The message text
     * @param options - Formatting options
     * @returns Telegram API response
     */
    sendCustomMessage(message: string, options?: MessageOptions): Promise<TelegramApiResponse | null>;

    /**
     * Send a raw message to Telegram (bypass formatting)
     * @param message - The raw message
     * @param options - Telegram API options
     * @returns Telegram API response
     */
    sendRawMessage(message: string, options?: any): Promise<TelegramApiResponse | null>;

    /**
     * Cleanup and destroy the logger instance
     */
    destroy(): void;
}

// Fastify Plugin Types
import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';

export interface FastifyTelegramLoggerOptions extends TelegramErrorLoggerConfig {
    /** Custom context extractor for Fastify requests */
    contextExtractor?: (request: FastifyRequest) => any;
    /** Custom user extractor for Fastify requests */
    extractUser?: (request: FastifyRequest) => any;
    /** Error filter for Fastify */
    errorFilter?: (error: Error, request: FastifyRequest) => boolean;
}

declare module 'fastify' {
    interface FastifyInstance {
        telegramLogger: TelegramErrorLogger;
    }
}

export const fastifyPlugin: FastifyPluginCallback<FastifyTelegramLoggerOptions>;

export function createRouteErrorHandler(
    logger: TelegramErrorLogger,
    options?: any
): (error: Error, request: FastifyRequest, reply: FastifyReply) => Promise<void>;

// Express Middleware Types
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export interface ExpressTelegramLoggerOptions extends TelegramErrorLoggerConfig {
    /** Custom context extractor for Express requests */
    contextExtractor?: (request: Request) => any;
    /** Custom user extractor for Express requests */
    extractUser?: (request: Request) => any;
    /** Error filter for Express */
    errorFilter?: (error: Error, request: Request) => boolean;
}

export function createExpressMiddleware(
    options: ExpressTelegramLoggerOptions
): ErrorRequestHandler;

export default TelegramErrorLogger;
