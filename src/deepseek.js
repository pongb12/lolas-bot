const axios = require('axios');
const Config = require('./utils/config');
const Logger = require('./utils/logger');

class DeepSeekHandler {
    constructor() {
        this.config = Config;
        
        // Cấu hình API
        this.apiConfig = {
            url: this.config.DEEPSEEK_API_URL,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.DEEPSEEK_API_KEY}`
            },
            timeout: 30000 // 30 giây
        };
        
        // Quản lý lịch sử chat
        this.chatHistories = new Map();
        this.maxHistory = this.config.MAX_HISTORY;
        
        // Cache để tăng tốc độ
        this.requestCache = new Map();
        this.cacheDuration = 30000; // 30 giây
        
        // System prompt
        this.systemPrompt = `Bạn là Lol.AI, trợ lý AI thân thiện của server Discord "Lol".
Hãy trả lời NGẮN GỌN, RÕ RÀNG bằng tiếng Việt.
Luôn giới thiệu mình là "Lol.AI" khi được hỏi.
Giữ câu trả lời dưới 4-7 câu khi có thể.`;
        
        Logger.success(`✅ DeepSeek đã sẵn sàng với model: ${this.config.DEEPSEEK_MODEL}`);
    }
    
    // Khởi tạo lịch sử cho user
    initUserHistory(userId) {
        if (!this.chatHistories.has(userId)) {
            this.chatHistories.set(userId, [
                { role: "system", content: this.systemPrompt },
                { role: "assistant", content: "Xin chào! Tôi là **Lol.AI** - trợ lý AI của server Lol! 😊\nTôi có thể giúp gì cho bạn?" }
            ]);
        }
        return this.chatHistories.get(userId);
    }
    
    // Thêm tin nhắn vào lịch sử
    addToHistory(userId, role, content) {
        const history = this.initUserHistory(userId);
        
        // Giới hạn độ dài content
        const limitedContent = content.length > 500 ? content.substring(0, 500) + "..." : content;
        
        history.push({ role, content: limitedContent });
        
        // Giữ lịch sử trong giới hạn
        if (history.length > this.maxHistory + 2) {
            const systemPart = history.slice(0, 2);
            const recentPart = history.slice(-this.maxHistory);
            this.chatHistories.set(userId, [...systemPart, ...recentPart]);
        }
    }
    
    // Xóa lịch sử
    clearHistory(userId) {
        const hadHistory = this.chatHistories.has(userId);
        this.chatHistories.delete(userId);
        this.requestCache.delete(userId);
        return hadHistory;
    }
    
    // Lấy thông tin lịch sử
    getHistoryInfo(userId) {
        const history = this.initUserHistory(userId);
        return {
            totalMessages: Math.max(0, history.length - 2),
            hasHistory: history.length > 2,
            history: history.slice(2) // Bỏ system prompt
        };
    }
    
    // Gọi API DeepSeek
    async ask(userId, question) {
        const startTime = Date.now();
        
        try {
            // Kiểm tra cache
            const cacheKey = `${userId}:${question.substring(0, 50)}`;
            const cached = this.requestCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp < this.cacheDuration)) {
                Logger.api(`Cache hit cho user ${userId.substring(0, 8)}...`);
                return cached.response;
            }
            
            Logger.api(`User ${userId.substring(0, 8)}... hỏi: ${question.substring(0, 50)}...`);
            
            // Làm sạch input
            const cleanQuestion = this.sanitizeInput(question);
            
            if (cleanQuestion.length < 1) {
                return "Vui lòng nhập câu hỏi! 😊";
            }
            
            if (cleanQuestion.length > 2000) {
                return "Câu hỏi quá dài! Vui lòng ngắn gọn hơn (tối đa 2000 ký tự).";
            }
            
            // Thêm vào lịch sử
            this.addToHistory(userId, "user", cleanQuestion);
            const history = this.chatHistories.get(userId);
            
            // Chuẩn bị request data
            const requestData = {
                model: this.config.DEEPSEEK_MODEL,
                messages: history,
                max_tokens: this.config.MAX_TOKENS,
                temperature: 0.7,
                stream: false
            };
            
            // Gọi API với timeout
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 10000)
            );
            
            const apiPromise = axios.post(
                this.apiConfig.url,
                requestData,
                {
                    headers: this.apiConfig.headers,
                    timeout: 15000
                }
            );
            
            const response = await Promise.race([apiPromise, timeoutPromise]);
            
            // Xử lý response
            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const aiResponse = response.data.choices[0].message.content;
                
                if (!aiResponse || aiResponse.trim().length === 0) {
                    throw new Error('Empty response from AI');
                }
                
                // Thêm vào lịch sử và cache
                this.addToHistory(userId, "assistant", aiResponse);
                
                this.requestCache.set(cacheKey, {
                    response: aiResponse,
                    timestamp: Date.now()
                });
                
                // Giới hạn cache size
                if (this.requestCache.size > 100) {
                    const firstKey = this.requestCache.keys().next().value;
                    this.requestCache.delete(firstKey);
                }
                
                const duration = Date.now() - startTime;
                Logger.success(`✅ Response (${duration}ms, ${aiResponse.length} chars)`);
                
                return aiResponse;
            } else {
                throw new Error('Invalid response format from API');
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            Logger.error(`❌ DeepSeek error (${duration}ms):`, error.message);
            
            // Xử lý lỗi cụ thể
            if (error.response) {
                // Lỗi từ API response
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 401 || status === 403) {
                    return "❌ Lỗi xác thực Key. Vui lòng kiểm tra lại Key!";
                } else if (status === 429) {
                    return "⚠️ Đã vượt quá giới hạn request. Vui lòng thử lại sau 1 phút!";
                } else if (status === 500) {
                    return "🔧 Lỗi server AI. Vui lòng thử lại sau!";
                } else if (data && data.error && data.error.message) {
                    return `❌ API Error: ${data.error.message}`;
                }
            } else if (error.message.includes('timeout')) {
                return "⏰ Hết thời gian chờ. AI đang quá tải, vui lòng thử lại!";
            } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
                return "🌐 Lỗi kết nối mạng. Vui lòng thử lại sau!";
            }
            
            return `❌ Lỗi: ${error.message}. Vui lòng thử lại!`;
        }
    }
    
    // Làm sạch input
    sanitizeInput(input) {
        if (!input || typeof input !== 'string') return '';
        return input.trim().substring(0, 4000);
    }
}

module.exports = new DeepSeekHandler();
