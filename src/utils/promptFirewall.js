
const Logger = require('./logger');
const Config = require('./config');

class PromptFirewall {
  constructor() {
    this.ownerDebug = false;

    // Heuristic patterns (case-insensitive)
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

    // Configurable thresholds (from Config or defaults)
    this.BAN_THRESHOLD = Number(Config.BAN_THRESHOLD) || 5;
    this.BAN_DURATION = Number(Config.BAN_DURATION_MS) || (24 * 60 * 60 * 1000); // default 24h
    this.ATTEMPT_WINDOW = Number(Config.ATTEMPT_WINDOW_MS) || (10 * 60 * 1000); // 10 minutes

    // Cleanup interval handle
    this._cleanupInterval = null;

    // Start cleanup loop
    this.startCleanup();

    Logger.info('PromptFirewall: initialized (heuristic-only mode)');
  }

  /* ================= ANALYZE ================= */
  async analyzeContent(text) {
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
          return { safe: false, reason: 'critical_regex', confidence: 1.0 };
        }
      }

      // heuristic checks: suspicious url to huggingface/github, long prompt dumps, many special tokens
      if (/https?:\/\/(www\.)?(huggingface|github)\.co[^\s]*/i.test(text)) {
        return { safe: false, reason: 'suspicious_url', confidence: 0.9 };
      }

      // suspicious length: user asking to print huge internal prompt
      if (text.length > 2000 && /prompt|instruction|system/i.test(text)) {
        return { safe: false, reason: 'long_possible_leak', confidence: 0.8 };
      }

      // default safe
      return { safe: true };
    } catch (e) {
      Logger.warn('PromptFirewall.analyzeContent error: ' + (e?.message || e));
      return { safe: false, reason: 'analyze_error' };
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

    const analysis = await this.analyzeContent(question);

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
      banDurationMs: this.BAN_DURATION
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
    }, intervalMs);

    Logger.info('PromptFirewall: started cleanup loop (heuristic-only)');
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
