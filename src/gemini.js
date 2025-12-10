const { GoogleGenerativeAI } = require("@google/generative-ai");
const Config = require('./utils/config');
const Logger = require('./utils/logger');

class GeminiHandler {
    constructor() {
        this.config = Config;
        
        try {
            this.genAI = new GoogleGenerativeAI(this.config.GEMINI_API_KEY);
            
            // SỬA LỖI: Dùng gemini-2.0-flash-exp (bản mới nhất)
            this.model = this.genAI.getGenerativeModel({ 
                model: this.config.GEMINI_MODEL,
                generationConfig: {
                    maxOutputTokens: this.config.MAX_TOKENS,
                    temperature: this.config.TEMPERATURE,
                    topP: 0.95,
                    topK: 40,
                }
            });
            
            this.chatHistories = new Map();
            this.maxHistory = this.config.MAX_HISTORY;
            this.requestCache = new Map();
            this.cacheDuration = 30000;
            
            this.systemPrompt = `Bạn là Lol.AI, trợ lý AI của server Discord "Lol".
Hãy trả lời NGẮN GỌN, THÂN THIỆN bằng tiếng Việt.
Giới thiệu là "Lol.AI" khi được hỏi.`;
            
            Logger.success(`✅ Gemini đã sẵn sàng với model: ${this.config.GEMINI_MODEL}`);
            
        } catch (error) {
            Logger.error('Lỗi khởi tạo Gemini:', error.message);
            throw error;
        }
    }

    initUserHistory(userId) {
        if (!this.chatHistories.has(userId)) {
            const initialHistory = [
                { role: "user", parts: [{ text: this.systemPrompt }] },
                { role: "model", parts: [{ text: "Xin chào! Tôi là **Lol.AI** - trợ lý AI của server Lol! 😊\nTôi có thể giúp gì cho bạn?" }] }
            ];
            this.chatHistories.set(userId, initialHistory);
        }
        return this.chatHistories.get(userId);
    }

    addToHistory(userId, role, content) {
        const history = this.initUserHistory(userId);
        const limitedContent = content.length > 500 ? content.substring(0, 500) + "..." : content;
        
        history.push({ role, parts: [{ text: limitedContent }] });
        
        if (history.length > this.maxHistory + 2) {
            const systemPart = history.slice(0, 2);
            const recentPart = history.slice(-this.maxHistory);
            this.chatHistories.set(userId, [...systemPart, ...recentPart]);
        }
    }

    clearHistory(userId) {
        const hadHistory = this.chatHistories.has(userId);
        this.chatHistories.delete(userId);
        this.requestCache.delete(userId);
        return hadHistory;
    }

    getHistoryInfo(userId) {
        const history = this.initUserHistory(userId);
        return {
            totalMessages: Math.max(0, history.length - 2),
            hasHistory: history.length > 2
        };
    }

    async ask(userId, question) {
        const startTime = Date.now();
        
        try {
            // Cache check
            const cacheKey = `${userId}:${question.substring(0, 50)}`;
            const cached = this.requestCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp < this.cacheDuration)) {
                Logger.api(`Cache hit cho user ${userId.substring(0, 8)}...`);
                return cached.response;
            }

            Logger.api(`User ${userId.substring(0, 8)}... hỏi: ${question.substring(0, 50)}...`);
            
            const cleanQuestion = this.sanitizeInput(question);
            
            if (cleanQuestion.length < 1) {
                return "Vui lòng nhập câu hỏi! 😊";
            }
            
            if (cleanQuestion.length > 1000) {
                return "Câu hỏi quá dài! Vui lòng ngắn gọn hơn.";
            }

            this.addToHistory(userId, 'user', cleanQuestion);
            const history = this.chatHistories.get(userId);
            
            const chat = this.model.startChat({ 
                history: history,
                generationConfig: {
                    maxOutputTokens: this.config.MAX_TOKENS,
                    temperature: this.config.TEMPERATURE,
                }
            });

            // Timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 8000)
            );
            
            const requestPromise = chat.sendMessage(cleanQuestion);
            const result = await Promise.race([requestPromise, timeoutPromise]);
            const response = await result.response;
            const text = response.text();
            
            if (!text || text.trim().length === 0) {
                throw new Error('Empty response from AI');
            }

            this.addToHistory(userId, 'model', text);
            
            // Cache
            this.requestCache.set(cacheKey, {
                response: text,
                timestamp: Date.now()
            });
            
            // Limit cache size
            if (this.requestCache.size > 100) {
                const firstKey = this.requestCache.keys().next().value;
                this.requestCache.delete(firstKey);
            }
            
            const duration = Date.now() - startTime;
            Logger.success(`✅ Response (${duration}ms, ${text.length} chars)`);
            
            return text;

        } catch (error) {
            const duration = Date.now() - startTime;
            Logger.error(`❌ Gemini error (${duration}ms):`, error.message);
            
            if (error.message.includes('API_KEY') || error.message.includes('key')) {
                return "❌ Lỗi Key.";
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                return "⚠️ Hết giới hạn. Thử lại sau!";
            } else if (error.message.includes('model') || error.message.includes('not found')) {
                return `❌ Lỗi Model: "${this.config.GEMINI_MODEL}" không tồn tại. Thử đổi model!`;
            } else if (error.message.includes('timeout')) {
                return "⏰ Hết thời gian chờ. Thử lại!";
            } else {
                return `❌ Lỗi: ${error.message}`;
            }
        }
    }

    sanitizeInput(input) {
        if (!input || typeof input !== 'string') return '';
        return input.trim().substring(0, 2000);
    }
}

module.exports = new GeminiHandler();
