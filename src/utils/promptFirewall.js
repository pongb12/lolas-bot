
const Logger = require('./logger');
const Config = require('./config');
let pipeline = null; // Lazy-loaded Llama Guard model

class PromptFirewall {
  constructor() {
    this.ownerDebug = false;

    // Heuristic patterns (case-insensitive) - FALLBACK
    this.criticalPatterns = [
      /ignore (all )?previous/i,
      /ignore previous instructions/i,
      /system (prompt|message|instruction)s?/i,
      /hãy in (toàn bộ )?prompt/i,
      /show (me )?the prompt/i,
      /dưới đây là các luật/i,
      /reveal the system/i,
      /give me the system prompt/i,
      /disclose internal/i,
      /expose the prompt/i,
      /bypass (the )?filter/i,
      /act as .*system/i
    ];

    // Whitelist common safe topics (simple)
    this.whitelist = [
      /máy bay/i, /thời tiết/i, /nấu ăn/i, /học tập/i, /tin tức/i, /thể thao/i
    ];

    // Tracking attempts & bans
    this.attempts = new Map(); // userId -> [timestamps]
    this.bannedUsers = new Map(); // userId -> banUntilTimestamp (ms)

    // ML Prediction Cache: textHash -> { safe, confidence, timestamp }
    this.mlPredictionCache = new Map();

    // Configurable thresholds (from Config or defaults)
    this.BAN_THRESHOLD = Number(Config.BAN_THRESHOLD) || 5;
    this.BAN_DURATION = Number(Config.BAN_DURATION) || (24 * 60 * 60 * 1000); // default 24h
    this.ATTEMPT_WINDOW = Number(Config.ATTEMPT_WINDOW_MS) || (10 * 60 * 1000); // 10 minutes
    this.ML_CACHE_DURATION = Number(Config.ML_PREDICTION_CACHE_DURATION) || (3600 * 1000); // 1h
    this.ML_TIMEOUT = Number(Config.MODEL_INIT_TIMEOUT) || 30000; // 30s timeout for ML calls
    this.ENABLE_ML_MODE = Config.ENABLE_LLAMA_GUARD !== 'false'; // enabled by default

    // Cleanup interval handle
    this._cleanupInterval = null;
    this._modelInitialized = false;
    this._modelInitializing = false;

    // Start cleanup loop
    this.startCleanup();

    // Async init of Llama Guard model (non-blocking)
    if (this.ENABLE_ML_MODE) {
      this.initLlamaGuardAsync();
    }

    Logger.info('PromptFirewall: initialized (ML + regex hybrid mode)');
  }

  /* ================= LLAMA GUARD INIT ================= */

  async initLlamaGuardAsync() {
    if (this._modelInitialized || this._modelInitializing) return;
    this._modelInitializing = true;

    try {
      const start = Date.now();
      Logger.info('PromptFirewall: Loading Llama Guard model (meta-llama/llama-prompt-guard-2-86m)...');

      // Lazy load transformers
      const { pipeline: transformersPipeline } = await import('@xenova/transformers');

      // Initialize the text-classification pipeline with Llama Guard
      const modelStart = Date.now();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Model load timeout')), this.ML_TIMEOUT)
      );

      const modelPromise = transformersPipeline(
        'text-classification',
        'meta-llama/llama-prompt-guard-2-86m',
        { quantized: true } // Use quantized version for speed
      );

      pipeline = await Promise.race([modelPromise, timeoutPromise]);

      this._modelInitialized = true;
      Logger.success(`✅ Llama Guard loaded in ${Date.now() - modelStart}ms`);
      Logger.success(`PromptFirewall: ML mode ACTIVE (registry: meta-llama/llama-prompt-guard-2-86m)`);
    } catch (e) {
      Logger.warn(`⚠️  Llama Guard init failed (will use regex fallback): ${e?.message || e}`);
      this.ENABLE_ML_MODE = false;
    } finally {
      this._modelInitializing = false;
    }
  }

  /* ================= HASH UTILITY ================= */
  hashText(text) {
    // Simple hash for cache keys
    return require('crypto')
      .createHash('md5')
      .update(text)
      .digest('hex');
  }

  /* ================= ANALYZE ================= */
  
  // Fallback regex-only analysis
  analyzeContent(text) {
    // Returns { safe: boolean, reason?: string, confidence?: number }
    try {
      if (!text || typeof text !== 'string') return { safe: true };

      const lower = text.toLowerCase();

      // quick whitelist
      for (const p of this.whitelist) {
        if (p.test(lower)) return { safe: true, reason: 'whitelist' };
      }

      // critical regex
      for (const p of this.criticalPatterns) {
        if (p.test(lower)) {
          return { safe: false, reason: 'critical_regex_fallback', confidence: 1.0 };
        }
      }

      // heuristic checks
      if (/https?:\/\/(www\.)?(huggingface|github)\.co[^\s]*/i.test(text)) {
        return { safe: false, reason: 'suspicious_url_fallback', confidence: 0.9 };
      }

      if (text.length > 2000 && /prompt|instruction|system/i.test(text)) {
        return { safe: false, reason: 'long_possible_leak_fallback', confidence: 0.8 };
      }

      return { safe: true, reason: 'regex_pass' };
    } catch (e) {
      Logger.warn('PromptFirewall.analyzeContent error: ' + (e?.message || e));
      return { safe: false, reason: 'analyze_error' };
    }
  }

  // ML-powered analysis using Llama Guard
  async analyzeContentWithLlama(text) {
    if (!text || typeof text !== 'string') return { safe: true, source: 'empty' };

    try {
      const lower = text.toLowerCase();

      // Quick whitelist pass (bypass ML for performance)
      for (const p of this.whitelist) {
        if (p.test(lower)) return { safe: true, reason: 'whitelist', source: 'whitelist' };
      }

      // Check cache first
      const textHash = this.hashText(text);
      const cached = this.mlPredictionCache.get(textHash);
      if (cached && Date.now() - cached.timestamp < this.ML_CACHE_DURATION) {
        return { ...cached.result, source: 'cache', fromCache: true };
      }

      // If ML is disabled or not initialized, fall back to regex
      if (!this.ENABLE_ML_MODE || !this._modelInitialized) {
        return { ...this.analyzeContent(text), source: 'regex_fallback' };
      }

      // Call Llama Guard ML model with timeout
      const mlTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('ML analysis timeout')), 1000)
      );

      const mlPromise = (async () => {
        try {
          const result = await pipeline(text, {
            truncate: true,
            top_k: 1
          });

          // Llama Guard returns [{ label, score }]
          // label: "PROMPT_INJECTION" or "BENIGN"
          // score: confidence 0-1
          if (!result || !result[0]) {
            Logger.warn('Unexpected Llama Guard output format');
            return null;
          }

          const { label, score } = result[0];
          const safe = label !== 'PROMPT_INJECTION';
          const confidence = score || 0;

          // Cache result
          this.mlPredictionCache.set(textHash, {
            timestamp: Date.now(),
            result: {
              safe,
              reason: label,
              confidence,
              source: 'llama_guard'
            }
          });

          // Prune cache if too large
          if (this.mlPredictionCache.size > 1000) {
            const oldestKey = this.mlPredictionCache.keys().next().value;
            this.mlPredictionCache.delete(oldestKey);
          }

          return { safe, reason: label, confidence, source: 'llama_guard' };
        } catch (inner) {
          Logger.warn(`Llama Guard execution error: ${inner?.message || inner}`);
          // Fallback to regex on model error
          return { ...this.analyzeContent(text), source: 'regex_fallback_on_error' };
        }
      })();

      const result = await Promise.race([mlPromise, mlTimeout]);
      return result || { ...this.analyzeContent(text), source: 'regex_fallback_timeout' };
    } catch (e) {
      Logger.warn('PromptFirewall.analyzeContentWithLlama error: ' + (e?.message || e));
      return { ...this.analyzeContent(text), source: 'regex_fallback_exception' };
    }
  }

  /* ================= TRACK / BAN ================= */
  async trackAttempt(userId, question) {
    // Owner bypass
    if (userId === Config.OWNER_ID) {
      return { allowed: true, isOwner: true };
    }

    // check ban
    if (this.isBanned(userId)) {
      return { allowed: false, reason: 'banned' };
    }

    // Use ML-powered analysis (with regex fallback)
    const analysis = await this.analyzeContentWithLlama(question);

    if (!analysis.safe) {
      const now = Date.now();
      const arr = this.attempts.get(userId) || [];
      // remove old attempts
      const filtered = arr.filter(t => now - t < this.ATTEMPT_WINDOW);
      filtered.push(now);
      this.attempts.set(userId, filtered);

      Logger.warn(`PromptFirewall: user ${userId} triggered ${analysis.reason} (${analysis.confidence || 0}) — attempts=${filtered.length}`);

      if (filtered.length >= this.BAN_THRESHOLD) {
        this.banUser(userId, `auto:${analysis.reason}`);
        return { allowed: false, reason: 'banned' };
      }

      return { allowed: false, reason: 'warning' };
    }

    // allowed
    return { allowed: true };
  }

  banUser(userId, reason = 'manual') {
    const until = Date.now() + this.BAN_DURATION;
    this.bannedUsers.set(userId, until);
    Logger.error(`PromptFirewall: banned ${userId} until ${new Date(until).toISOString()} (reason=${reason})`);
  }

  unbanUser(userId) {
    if (this.bannedUsers.has(userId)) {
      this.bannedUsers.delete(userId);
      Logger.success(`PromptFirewall: unbanned ${userId}`);
      return true;
    }
    return false;
  }

  isBanned(userId) {
    const until = this.bannedUsers.get(userId);
    if (!until) return false;
    if (Date.now() > until) {
      this.bannedUsers.delete(userId);
      return false;
    }
    return true;
  }

  /* ================= UTILITIES ================= */

  isPromptLeakAttempt(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    return this.criticalPatterns.some(p => p.test(lower));
  }

  sanitizeResponse(text) {
    if (!text || typeof text !== 'string') return text;

    let s = text
      .replace(/(system prompt|system message|system instruction|system rules|prompt)/gi, '[REDACTED]')
      .replace(/(instruction|configuration|internal configuration)/gi, '[REDACTED]')
      .replace(/https?:\/\/(www\.)?huggingface\.co[^\s]*/gi, '[REDACTED_URL]')
      .replace(/https?:\/\/(www\.)?github\.com[^\s]*/gi, '[REDACTED_URL]');

    if (this.ownerDebug) {
      s += '\n\n[DEBUG: sanitized by PromptFirewall]';
    }
    return s;
  }

  getBannedUsers() {
    const out = [];
    for (const [uid, until] of this.bannedUsers.entries()) out.push({ userId: uid, until });
    return out;
  }

  getSecurityStats() {
    return {
      attemptsCount: this.attempts.size,
      bannedCount: this.bannedUsers.size,
      banThreshold: this.BAN_THRESHOLD,
      banDurationMs: this.BAN_DURATION,
      mlMode: this.ENABLE_ML_MODE,
      mlInitialized: this._modelInitialized,
      mlCacheSize: this.mlPredictionCache.size
    };
  }

  getMLStats() {
    return {
      modelInitialized: this._modelInitialized,
      modelInitializing: this._modelInitializing,
      cacheSize: this.mlPredictionCache.size,
      cacheDuration: this.ML_CACHE_DURATION,
      modelTimeout: this.ML_TIMEOUT,
      enabled: this.ENABLE_ML_MODE
    };
  }

  setOwnerDebugMode(enabled = false) {
    this.ownerDebug = !!enabled;
  }

  /* ================= CLEANUP ================= */

  startCleanup() {
    if (this._cleanupInterval) return;
    const intervalMs = Number(Config.FIREWALL_CLEANUP_INTERVAL_MS) || 60 * 1000;
    this._cleanupInterval = setInterval(() => {
      const now = Date.now();

      // prune attempts
      for (const [uid, arr] of this.attempts.entries()) {
        const filtered = (arr || []).filter(t => now - t < this.ATTEMPT_WINDOW);
        if (!filtered.length) this.attempts.delete(uid);
        else this.attempts.set(uid, filtered);
      }

      // prune expired bans
      for (const [uid, until] of this.bannedUsers.entries()) {
        if (now > until) {
          this.bannedUsers.delete(uid);
          Logger.info(`PromptFirewall: auto-unbanned ${uid}`);
        }
      }

      // prune expired ML cache entries
      for (const [hash, entry] of this.mlPredictionCache.entries()) {
        if (now - entry.timestamp > this.ML_CACHE_DURATION) {
          this.mlPredictionCache.delete(hash);
        }
      }
    }, intervalMs);

    Logger.info('PromptFirewall: started cleanup loop (ML + regex hybrid)');
  }

  stopCleanup() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
      Logger.info('PromptFirewall: stopped cleanup loop');
    }
  }
}

module.exports = new PromptFirewall();
