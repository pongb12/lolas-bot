const { GoogleGenerativeAI } = require("@google/generative-ai");
const Config = require('./utils/config');
const Logger = require('./logger');

class GeminiHandler {
    constructor() {
        this.config = Config;
        
        // Khởi tạo Gemini với API Key
        try {
            this.genAI = new GoogleGenerativeAI(this.config.GEMINI_API_KEY);
            
            // Sử dụng model gemini-1.5-flash (NHANH NHẤT) hoặc gemini-1.5-pro
            // Fix lỗi: không dùng gemini-pro cũ
            this.model = this.genAI.getGenerativeModel({ 
                model: this.config.GEMINI_MODEL,
                generationConfig: {
                    maxOutputTokens: this.config.MAX_TOKENS,
                    temperature: this.config.TEMPERATURE,
                    topP: 0.95,
                    topK: 40,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            });
            
            this.chatHistories = new Map();
            this.maxHistory = this.config.MAX_HISTORY;
            this.requestCache = new Map(); // Cache đơn giản
            this.cacheDuration = 30000; // 30 giây
            
            // System prompt tối ưu
            this.systemPrompt = `Bạn là Lol.AI, trợ lý AI thân thiện của server Discord "Lol".

THÔNG TIN:
- Tên: Lol.AI
- Vai trò: AI Assistant chính thức
- Tính cách: Vui vẻ, nhiệt tình, hài hước
- Ngôn ngữ: Ưu tiên tiếng Việt

QUY TẮC:
1. Luôn trả lời NGẮN GỌN, XÚC TÍCH (dưới 3 câu khi có thể)
2. Giới thiệu là "Lol.AI" khi được hỏi
3. Dùng tiếng Việt tự nhiên
4. Thêm 1-2 emoji phù hợp
5. KHÔNG giải thích dài dòng
6. Ưu tiên tốc độ phản hồi`;

            Logger.success(`✅ Ai đã sẵn sàng: ${this.config.GEMINI_MODEL}`);
            
        } catch (error) {
            Logger.error('Lỗi khởi tạo Gemini:', error.message);
            throw error;
        }
    }

    // Khởi tạo lịch sử với system prompt
    initUserHistory(userId) {
        if (!this.chatHistories.has(userId)) {
            const initialHistory = [
                { 
                    role: "user", 
                    parts: [{ text: this.systemPrompt }] 
                },
                { 
                    role: "model", 
                    parts: [{ text: "Xin chào! Tôi là **Lol.AI** - trợ lý AI siêu tốc của server Lol! 🚀\n\nTôi có thể giúp gì cho bạn?" }] 
                }
            ];
            this.chatHistories.set(userId, initialHistory);
        }
        return this.chatHistories.get(userId);
    }

    // Thêm tin nhắn vào lịch sử (tối ưu)
    addToHistory(userId, role, content) {
        const history = this.initUserHistory(userId);
        
        // Giới hạn độ dài content để tăng tốc
        const limitedContent = content.length > 500 ? content.substring(0, 500) + "..." : content;
        
        history.push({ 
            role, 
            parts: [{ text: limitedContent }] 
        });
        
        // Giữ lịch sử ngắn gọn
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
        this.requestCache.delete(userId); // Xóa cache
        return hadHistory;
    }

    // Lấy thông tin lịch sử
    getHistoryInfo(userId) {
        const history = this.initUserHistory(userId);
        return {
            totalMessages: Math.max(0, history.length - 2),
            hasHistory: history.length > 2
        };
    }

    // Xử lý câu hỏi - TỐI ƯU TỐC ĐỘ
    async ask(userId, question) {
        const startTime = Date.now();
        
        try {
            // Kiểm tra cache trước
            const cacheKey = `${userId}:${question.substring(0, 50)}`;
            const cached = this.requestCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp < this.cacheDuration)) {
                Logger.api(`Cache hit cho user ${userId.substring(0, 8)}... (${Date.now() - startTime}ms)`);
                return cached.response;
            }

            Logger.api(`User ${userId.substring(0, 8)}... hỏi: ${question.substring(0, 50)}...`);
            
            // Làm sạch và validate input
            const cleanQuestion = this.sanitizeInput(question);
            
            if (cleanQuestion.length < 1) {
                return "Vui lòng nhập câu hỏi! 😊";
            }
            
            if (cleanQuestion.length > 1000) {
                return "Câu hỏi quá dài! Vui lòng ngắn gọn hơn (tối đa 1000 ký tự).";
            }

            // Thêm vào lịch sử
            this.addToHistory(userId, 'user', cleanQuestion);
            const history = this.chatHistories.get(userId);
            
            // Tạo chat session với history
            const chat = this.model.startChat({ 
                history: history,
                generationConfig: {
                    maxOutputTokens: this.config.MAX_TOKENS,
                    temperature: this.config.TEMPERATURE,
                }
            });

            // Gửi request với timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 10000)
            );
            
            const requestPromise = chat.sendMessage(cleanQuestion);
            
            const result = await Promise.race([requestPromise, timeoutPromise]);
            const response = await result.response;
            const text = response.text();
            
            // Validate response
            if (!text || text.trim().length === 0) {
                throw new Error('Empty response from AI');
            }

            // Thêm vào lịch sử và cache
            this.addToHistory(userId, 'model', text);
            
            // Cache câu trả lời
            this.requestCache.set(cacheKey, {
                response: text,
                timestamp: Date.now()
            });
            
            // Giới hạn cache size
            if (this.requestCache.size > 100) {
                const firstKey = this.requestCache.keys().next().value;
                this.requestCache.delete(firstKey);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            Logger.success(`✅ Response cho ${userId.substring(0, 8)}... (${duration}ms, ${text.length} chars)`);
            
            return text;

        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            Logger.error(`❌ Gemini error (${duration}ms):`, error.message);
            
            // Phân loại lỗi chi tiết
            if (error.message.includes('API_KEY') || error.message.includes('key')) {
                return "❌ **Lỗi Key:** Vui lòng kiểm tra lại Key!";
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                return "⚠️ **Hết giới hạn:**Dã hết quota. Vui lòng thử lại sau 1 phút!";
            } else if (error.message.includes('model') || error.message.includes('not found')) {
                return `❌ **Lỗi Model:** Model "${this.config.GEMINI_MODEL}" không tồn tại!`;
            } else if (error.message.includes('timeout')) {
                return "⏰ **Hết thời gian chờ:** AI đang quá tải. Vui lòng thử lại!";
            } else if (error.message.includes('safety')) {
                return "⚠️ **Nội dung bị chặn:** Câu hỏi vi phạm chính sách an toàn.";
            } else {
                return `❌ **Lỗi:** ${error.message}. Vui lòng thử lại sau!`;
            }
        }
    }

    // Làm sạch input
    sanitizeInput(input) {
        if (!input || typeof input !== 'string') return '';
        
        return input
            .trim()
            .replace(/[<>]/g, '') // Xóa HTML tags
            .replace(/\s+/g, ' ') // Chuẩn hóa khoảng trắng
            .substring(0, 2000); // Giới hạn độ dài
    }

    // Xóa cache cũ
    cleanupOldCache() {
        const now = Date.now();
        for (const [key, value] of this.requestCache.entries()) {
            if (now - value.timestamp > this.cacheDuration) {
                this.requestCache.delete(key);
            }
        }
    }
}

module.exports = new GeminiHandler();
