const axios = require('axios');
const Config = require('./utils/config');
const Logger = require('./utils/logger');

class AIHandler {
    constructor() {
        this.config = Config;
        
        if (!this.config.GROQ_API_KEY) {
            Logger.error('❌ GROQ_API_KEY không được cấu hình!');
            throw new Error('Missing Groq API Key');
        }
        
        // Groq API Config
        this.apiConfig = {
            url: this.config.GROQ_API_URL,
            headers: {
                'Authorization': `Bearer ${this.config.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        };
        
        // Chat histories (riêng cho public và private)
        this.publicHistories = new Map();    // Chat công khai trong server
        this.privateHistories = new Map();   // Chat riêng trong private channels
        this.maxHistory = this.config.MAX_HISTORY;
        
        // Cache for performance
        this.requestCache = new Map();
        this.cacheDuration = 30000; // 30 giây
        
        Logger.success(`✅ Groq AI: Model=${this.config.GROQ_MODEL}`);
    }
    
    // === PUBLIC CHAT METHODS ===
    async askPublic(userId, question, context = 'general') {
        return await this.processRequest(userId, question, this.publicHistories, 'public', context);
    }
    
    async search(userId, query) {
        const searchPrompt = `Bạn là công cụ tìm kiếm thông minh. Hãy tìm kiếm và tổng hợp thông tin về: "${query}"
        
        Yêu cầu:
        1. Tập trung vào thông tin thực tế, chính xác
        2. Nếu có số liệu, hãy đề cập nguồn (nếu biết)
        3. Ưu tiên thông tin mới nhất
        4. Trình bày ngắn gọn, có cấu trúc
        5. Ưu tiên trả lời bằng tiếng Anh để tiết kiệm Token
        
        Tìm kiếm: ${query}`;
        
        return await this.processRequest(userId, searchPrompt, this.publicHistories, 'search', 'search');
    }
    
    // === PRIVATE CHAT METHODS ===
    async askPrivate(userId, question) {
        return await this.processRequest(userId, question, this.privateHistories, 'private', 'private');
    }
    
    // === CORE PROCESSING ===
    async processRequest(userId, question, historyMap, chatType, context) {
        const startTime = Date.now();
        const cacheKey = `${userId}:${chatType}:${question.substring(0, 50)}`;
        
        try {
            // Cache check
            const cached = this.requestCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < this.cacheDuration)) {
                Logger.api(`Cache hit for ${userId.substring(0, 8)} [${chatType}]`);
                return cached.response;
            }
            
            Logger.api(`${chatType.toUpperCase()} User ${userId.substring(0, 8)}: ${question.substring(0, 50)}...`);
            
            // Get or create history
            if (!historyMap.has(userId)) {
                historyMap.set(userId, []);
            }
            
            const history = historyMap.get(userId);
            const messages = this.buildMessages(question, history, chatType, context);
            
            // API Request
            const requestData = {
                model: this.config.GROQ_MODEL,
                messages: messages,
                max_tokens: this.config.MAX_TOKENS,
                temperature: chatType === 'search' ? 0.3 : 0.7,
                stream: false
            };
            
            const response = await axios.post(this.apiConfig.url, requestData, {
                headers: this.apiConfig.headers,
                timeout: 15000
            });
            
            if (response.data.choices && response.data.choices[0]) {
                const aiResponse = response.data.choices[0].message.content;
                
                // Update history
                this.updateHistory(history, question, aiResponse);
                
                // Cache response
                this.requestCache.set(cacheKey, {
                    response: aiResponse,
                    timestamp: Date.now()
                });
                
                // Clean old cache
                if (this.requestCache.size > 200) {
                    const firstKey = this.requestCache.keys().next().value;
                    this.requestCache.delete(firstKey);
                }
                
                const duration = Date.now() - startTime;
                Logger.success(`✅ ${chatType.toUpperCase()} Response (${duration}ms)`);
                
                return aiResponse;
            }
            
            throw new Error('Invalid API response');
            
        } catch (error) {
            const duration = Date.now() - startTime;
            return this.handleError(error, duration, chatType);
        }
    }
    
    buildMessages(question, history, chatType, context) {
        const systemPrompts = {
            'public': `Bạn là Lol.AI, trợ lý AI thân thiện của server Discord "Lol".
            
            Context: ${context}
            
            Hãy trả lời:
            1. NGẮN GỌN (1-3 câu khi có thể)
            2. Bằng tiếng Việt tự nhiên, nhưng nếu quá dài dùng tiếng Anh để tiết kiệm Token
            3. Thêm chút hài hước nếu phù hợp
            4. KHÔNG giải thích dài dòng
            5. Nếu không biết, nói thẳng`,
            
            'private': `Bạn đang trong PRIVATE CHAT riêng tư với một user.
            
            Quy tắc:
            1. Có thể trả lời dài hơn, chi tiết hơn
            2. Giữ tính riêng tư, không chia sẻ thông tin ra ngoài
            3. Hỗ trợ sâu hơn về mọi chủ đề
            4. Luôn tôn trọng và thân thiện`,
            
            'search': `Bạn là công cụ tìm kiếm thông minh.
            
            Nhiệm vụ:
            1. Cung cấp thông tin CHÍNH XÁC, KHÁCH QUAN
            2. Nếu có số liệu, đề cập năm/nguồn
            3. Ưu tiên thông tin cập nhật
            4. Phân tích đa chiều khi cần
            5. Ghi rõ "🔍 Tìm kiếm:" ở đầu`
        };
        
        const messages = [
            { role: 'system', content: systemPrompts[chatType] || systemPrompts.public }
        ];
        
        // Add recent history
        const recentHistory = history.slice(-this.maxHistory * 2);
        messages.push(...recentHistory);
        
        // Add current question
        messages.push({ role: 'user', content: question });
        
        return messages;
    }
    
    updateHistory(history, question, response) {
        history.push({ role: 'user', content: question.substring(0, 500) });
        history.push({ role: 'assistant', content: response.substring(0, 1000) });
        
        // Keep history within limit
        if (history.length > this.maxHistory * 2) {
            history.splice(0, history.length - this.maxHistory * 2);
        }
    }
    
    // === HISTORY MANAGEMENT ===
    clearPublicHistory(userId) {
        const hadHistory = this.publicHistories.has(userId);
        this.publicHistories.delete(userId);
        this.clearCacheForUser(userId, 'public');
        return hadHistory;
    }
    
    clearPrivateHistory(userId) {
        const hadHistory = this.privateHistories.has(userId);
        this.privateHistories.delete(userId);
        this.clearCacheForUser(userId, 'private');
        return hadHistory;
    }
    
    clearAllHistory(userId) {
        const publicCleared = this.clearPublicHistory(userId);
        const privateCleared = this.clearPrivateHistory(userId);
        return { publicCleared, privateCleared };
    }
    
    getHistoryInfo(userId, type = 'all') {
        const result = {
            public: {
                totalMessages: 0,
                hasHistory: false,
                history: []
            },
            private: {
                totalMessages: 0,
                hasHistory: false,
                history: []
            }
        };
        
        if (type === 'all' || type === 'public') {
            if (this.publicHistories.has(userId)) {
                const history = this.publicHistories.get(userId);
                result.public = {
                    totalMessages: history.length,
                    hasHistory: history.length > 0,
                    history: [...history]
                };
            }
        }
        
        if (type === 'all' || type === 'private') {
            if (this.privateHistories.has(userId)) {
                const history = this.privateHistories.get(userId);
                result.private = {
                    totalMessages: history.length,
                    hasHistory: history.length > 0,
                    history: [...history]
                };
            }
        }
        
        return result;
    }
    
    clearCacheForUser(userId, type) {
        for (const [key, value] of this.requestCache.entries()) {
            if (key.startsWith(`${userId}:${type}`) || key.startsWith(`${userId}:`)) {
                this.requestCache.delete(key);
            }
        }
    }
    
    handleError(error, duration, chatType) {
        Logger.error(`❌ ${chatType.toUpperCase()} Error (${duration}ms):`, error.message);
        
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            
            switch(status) {
                case 401:
                    return '🔑 Lỗi xác thực Key. Vui lòng kiểm tra lại!';
                case 429:
                    return '⚠️ Đã vượt quá giới hạn request. Vui lòng chờ 1 phút!';
                case 402:
                case 403:
                    return `❌ Lỗi truy cập Key. ${data?.error?.message || 'Vui lòng thử lại sau.'}`;
                default:
                    return `❌ Lỗi Key (${status}): ${data?.error?.message || 'Vui lòng thử lại.'}`;
            }
        } else if (error.code === 'ECONNABORTED') {
            return '⏰ Hết thời gian chờ. Groq đang quá tải!';
        } else if (error.message.includes('network')) {
            return '🌐 Lỗi kết nối mạng. Kiểm tra internet!';
        }
        
        return '❌ Đã xảy ra lỗi. Vui lòng thử lại sau!';
    }
}

module.exports = new AIHandler();
