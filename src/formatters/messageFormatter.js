/**
 * Format custom messages for Telegram
 */
class MessageFormatter {
    constructor(config = {}) {
        this.appName = config.appName || 'Application';
        this.environment = config.environment || 'production';
    }

    /**
     * Format a custom message for Telegram
     * @param {string} message - The message text
     * @param {object} options - Formatting options
     * @returns {string} - Formatted message
     */
    format(message, options = {}) {
        const {
            level = 'info',
            title,
            data,
            includeTimestamp = true,
            includeAppInfo = true
        } = options;

        const sections = [];

        // Header
        if (includeAppInfo) {
            sections.push(this.formatHeader(level, title));
        } else if (title) {
            sections.push(`${this.getLevelEmoji(level)} <b>${this.escapeHtml(title)}</b>`);
        }

        // Main message
        sections.push(this.escapeHtml(message));

        // Additional data
        if (data) {
            sections.push(this.formatData(data));
        }

        // Footer
        if (includeTimestamp) {
            sections.push(this.formatFooter());
        }

        return sections.join('\n\n');
    }

    /**
     * Format the message header
     * @param {string} level - Message level (info, warning, success, etc.)
     * @param {string} title - Optional title
     * @returns {string} - Formatted header
     */
    formatHeader(level, title) {
        const emoji = this.getLevelEmoji(level);
        const levelText = level.toUpperCase();

        let header = `${emoji} <b>${levelText}</b>`;

        if (title) {
            header += `\n<b>${this.escapeHtml(title)}</b>`;
        }

        header += `\n<b>App:</b> ${this.appName} (${this.environment})`;

        return header;
    }

    /**
     * Format additional data
     * @param {object|string} data - Data to format
     * @returns {string} - Formatted data
     */
    formatData(data) {
        if (typeof data === 'string') {
            return `<b>📊 Data</b>\n${this.escapeHtml(data)}`;
        }

        if (typeof data === 'object') {
            try {
                const jsonStr = JSON.stringify(data, null, 2);
                return `<b>📊 Data</b>\n<code>${this.escapeHtml(jsonStr)}</code>`;
            } catch (error) {
                return `<b>📊 Data</b>\n[Unable to serialize data]`;
            }
        }

        return `<b>📊 Data</b>\n${this.escapeHtml(String(data))}`;
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
     * Get emoji for message level
     * @param {string} level - Message level
     * @returns {string} - Emoji
     */
    getLevelEmoji(level) {
        const emojiMap = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            critical: '🔥',
            debug: '🐛',
            alert: '🚨'
        };

        return emojiMap[level.toLowerCase()] || 'ℹ️';
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

module.exports = MessageFormatter;
