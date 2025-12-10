/**
 * Format error objects for Telegram messages
 */
class ErrorFormatter {
    constructor(config = {}) {
        this.appName = config.appName || 'Application';
        this.environment = config.environment || 'production';
        this.enableStackTrace = config.enableStackTrace !== false;
        this.maxStackTraceLines = config.maxStackTraceLines || 10;
    }

    /**
     * Format an error with context for Telegram
     * @param {Error} error - The error object
     * @param {object} context - Additional context
     * @returns {string} - Formatted message
     */
    format(error, context = {}) {
        const sections = [];

        // Header
        sections.push(this.formatHeader(error));

        // Error details
        sections.push(this.formatErrorDetails(error));

        // Context
        if (context && Object.keys(context).length > 0) {
            sections.push(this.formatContext(context));
        }

        // Stack trace
        if (this.enableStackTrace && error.stack) {
            sections.push(this.formatStackTrace(error.stack));
        }

        // Footer
        sections.push(this.formatFooter());

        return sections.join('\n\n');
    }

    /**
     * Format the message header
     * @param {Error} error - The error object
     * @returns {string} - Formatted header
     */
    formatHeader(error) {
        const emoji = this.getErrorEmoji(error);
        return `${emoji} <b>Error in ${this.appName}</b>\n` +
            `<b>Environment:</b> ${this.environment}`;
    }

    /**
     * Format error details
     * @param {Error} error - The error object
     * @returns {string} - Formatted error details
     */
    formatErrorDetails(error) {
        const details = [`<b>📋 Error Details</b>`];

        details.push(`<b>Type:</b> ${error.name || 'Error'}`);
        details.push(`<b>Message:</b> ${this.escapeHtml(error.message || 'No message')}`);

        if (error.code) {
            details.push(`<b>Code:</b> ${error.code}`);
        }

        if (error.statusCode) {
            details.push(`<b>Status Code:</b> ${error.statusCode}`);
        }

        return details.join('\n');
    }

    /**
     * Format context information
     * @param {object} context - Context object
     * @returns {string} - Formatted context
     */
    formatContext(context) {
        const lines = [`<b>🔍 Context</b>`];

        // Request information
        if (context.method || context.url) {
            lines.push(`<b>Request:</b> ${context.method || 'N/A'} ${context.url || context.path || 'N/A'}`);
        }

        if (context.route) {
            lines.push(`<b>Route:</b> ${context.route}`);
        }

        // User information
        if (context.userId || context.user) {
            const userId = context.userId || context.user?.id || 'Unknown';
            lines.push(`<b>User:</b> ${userId}`);
        }

        // Query parameters
        if (context.query && Object.keys(context.query).length > 0) {
            lines.push(`<b>Query:</b> ${this.formatObject(context.query, 1)}`);
        }

        // Request params
        if (context.params && Object.keys(context.params).length > 0) {
            lines.push(`<b>Params:</b> ${this.formatObject(context.params, 1)}`);
        }

        // Request body (be careful with sensitive data)
        if (context.body && Object.keys(context.body).length > 0) {
            const sanitizedBody = this.sanitizeBody(context.body);
            lines.push(`<b>Body:</b> ${this.formatObject(sanitizedBody, 1)}`);
        }

        // Headers (if included)
        if (context.headers && Object.keys(context.headers).length > 0) {
            const sanitizedHeaders = this.sanitizeHeaders(context.headers);
            lines.push(`<b>Headers:</b> ${this.formatObject(sanitizedHeaders, 1)}`);
        }

        // Custom context
        if (context.custom) {
            lines.push(`<b>Custom:</b> ${this.formatObject(context.custom, 1)}`);
        }

        return lines.join('\n');
    }

    /**
     * Format stack trace
     * @param {string} stack - Stack trace string
     * @returns {string} - Formatted stack trace
     */
    formatStackTrace(stack) {
        const lines = stack.split('\n').slice(0, this.maxStackTraceLines);
        const truncated = stack.split('\n').length > this.maxStackTraceLines;

        let formatted = `<b>📚 Stack Trace</b>\n<code>${this.escapeHtml(lines.join('\n'))}</code>`;

        if (truncated) {
            formatted += '\n<i>... (truncated)</i>';
        }

        return formatted;
    }

    /**
     * Format footer with timestamp
     * @returns {string} - Formatted footer
     */
    formatFooter() {
        const timestamp = new Date().toISOString();
        return `<i>⏰ ${timestamp}</i>`;
    }

    /**
     * Get appropriate emoji for error type
     * @param {Error} error - The error object
     * @returns {string} - Emoji
     */
    getErrorEmoji(error) {
        if (error.statusCode) {
            if (error.statusCode >= 500) return '🔥';
            if (error.statusCode >= 400) return '⚠️';
        }
        return '❌';
    }

    /**
     * Format an object for display
     * @param {object} obj - Object to format
     * @param {number} maxDepth - Maximum depth to traverse
     * @returns {string} - Formatted object
     */
    formatObject(obj, maxDepth = 2) {
        try {
            const str = JSON.stringify(obj, null, 2);
            if (str.length > 500) {
                return this.escapeHtml(str.substring(0, 500)) + '...';
            }
            return this.escapeHtml(str);
        } catch (error) {
            return '[Unable to serialize]';
        }
    }

    /**
     * Sanitize request body to remove sensitive data
     * @param {object} body - Request body
     * @returns {object} - Sanitized body
     */
    sanitizeBody(body) {
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization'];
        const sanitized = { ...body };

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }

        return sanitized;
    }

    /**
     * Sanitize headers to remove sensitive data
     * @param {object} headers - Request headers
     * @returns {object} - Sanitized headers
     */
    sanitizeHeaders(headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        const sanitized = { ...headers };

        for (const header of sensitiveHeaders) {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        }

        return sanitized;
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        if (typeof text !== 'string') {
            text = String(text);
        }

        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}

module.exports = ErrorFormatter;
