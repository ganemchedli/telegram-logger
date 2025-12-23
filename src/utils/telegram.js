const axios = require('axios');

/**
 * Telegram API utility for sending messages
 */
class TelegramClient {
    constructor(botToken, chatId) {
        if (!botToken) {
            throw new Error('Telegram bot token is required');
        }
        if (!chatId) {
            throw new Error('Telegram chat ID is required');
        }

        this.botToken = botToken;
        this.chatId = chatId;
        this.baseUrl = `https://api.telegram.org/bot${botToken}`;
        this.maxMessageLength = 4096; // Telegram's message length limit
    }

    /**
     * Send a message to Telegram
     * @param {string} message - The message to send
     * @param {object} options - Additional options
     * @returns {Promise<object>} - Telegram API response
     */
    async sendMessage(message, options = {}) {
        try {
            const truncatedMessage = this.truncateMessage(message);

            const payload = {
                chat_id: this.chatId,
                text: truncatedMessage,
                parse_mode: options.parseMode || 'HTML',
                disable_web_page_preview: options.disableWebPagePreview !== false,
                ...options
            };

            const response = await axios.post(
                `${this.baseUrl}/sendMessage`,
                payload,
                {
                    timeout: options.timeout || 10000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            // Don't throw errors from the logger itself to avoid infinite loops
            console.error('Failed to send Telegram message:', error.message);
            return null;
        }
    }

    /**
     * Truncate message to fit Telegram's length limit
     * @param {string} message - The message to truncate
     * @returns {string} - Truncated message
     */
    truncateMessage(message) {
        if (message.length <= this.maxMessageLength) {
            return message;
        }

        const truncationNotice = '\n\n... (message truncated)';
        const maxLength = this.maxMessageLength - truncationNotice.length;

        return message.substring(0, maxLength) + truncationNotice;
    }

    /**
     * Send a message with retry logic
     * @param {string} message - The message to send
     * @param {object} options - Additional options
     * @param {number} retries - Number of retries
     * @returns {Promise<object>} - Telegram API response
     */
    async sendMessageWithRetry(message, options = {}, retries = 3) {
        let lastError;

        for (let i = 0; i < retries; i++) {
            try {
                const result = await this.sendMessage(message, options);
                if (result) {
                    return result;
                }
            } catch (error) {
                lastError = error;
                // Wait before retrying (exponential backoff)
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        }

        console.error(`Failed to send Telegram message after ${retries} retries:`, lastError?.message);
        return null;
    }
}

module.exports = TelegramClient;
