/**
 * Gemini orchestrator — AI-powered coordinated decision maker.
 *
 * Receives the full stadium situation context (risk report + cascade impact +
 * state snapshot) and asks Google Gemini to produce a single coordinated
 * response plan spanning security, volunteers, accessibility, announcements
 * and fan rerouting. Falls back to the deterministic rule engine on any error.
 */
import { randomUUID } from 'node:crypto';
import env from '../core/environment.js';

/** Lightweight prompt-injection sanitiser. */
function sanitize(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ignore\s+(previous|above|all)\s+(instructions?|prompts?)/gi, '[filtered]')
    .replace(/you\s+are\s+now/gi, '[filtered]')
    .replace(/system\s*:\s*/gi, '[filtered]')
    .trim()
    .slice(0, 2000);
}

/** Runtime metrics. */
export const aiMetrics = {
  geminiCalls: 0,
  ruleEngineCalls: 0,
  errors: 0,
  cacheHits: 0,
};

export class GeminiOrchestrator {
  /**
   * @param {import('../stadium-state/state-engine.js').StateEngine} state
   * @param {import('./rule-engine.js').RuleEngine} ruleEngine
   */
  constructor(state, ruleEngine) {
    this._state = state;
    this._ruleEngine = ruleEngine;
  }

  /**
   * Generate a coordinated response plan.
   * @param {object} riskReport — from RiskAnalyzer
   * @param {object} cascadeImpact — from CascadeSimulator
   * @returns {Promise<object>} Decision object
   */
  async orchestrate(riskReport, cascadeImpact) {
    const decisionId = `dec-${randomUUID().slice(0, 8)}`;
    const stateSnapshot = this._state.getSnapshot();

    let recommendation;

    if (env.gemini.enabled) {
      try {
        recommendation = await this._callGemini(riskReport, cascadeImpact, stateSnapshot);
        aiMetrics.geminiCalls++;
      } catch (err) {
        console.error('[GeminiOrchestrator] Gemini call failed, using rule engine:', err.message);
        aiMetrics.errors++;
        recommendation = this._ruleEngine.decide(riskReport, cascadeImpact);
        recommendation.source = 'rules';
        aiMetrics.ruleEngineCalls++;
      }
    } else {
      recommendation = this._ruleEngine.decide(riskReport, cascadeImpact);
      recommendation.source = 'rules';
      aiMetrics.ruleEngineCalls++;
    }

    return {
      id: decisionId,
      createdAt: new Date().toISOString(),
      trigger: {
        riskType: riskReport.type,
        riskLevel: riskReport.severity,
        zone: riskReport.zone,
        summary: riskReport.detail,
      },
      cascadeImpact: {
        riskLevel: cascadeImpact?.riskLevel || 'low',
        summary: cascadeImpact?.summary || 'No cascade impact',
        affectedZones: cascadeImpact?.effects?.length || 0,
      },
      aiRecommendation: {
        source: recommendation.source || 'gemini',
        reasoning: recommendation.reasoning,
        actions: recommendation.actions,
        confidence: recommendation.confidence || 0.85,
      },
      approval: {
        status: 'pending',
        approvedActions: [],
        approvedBy: null,
        approvedAt: null,
        reason: null,
      },
      execution: {
        status: 'pending',
        results: [],
      },
    };
  }

  /** Call the Gemini API with full situation context. */
  async _callGemini(riskReport, cascadeImpact, snapshot) {
    const systemPrompt = [
      'You are the AI operations advisor for Stadium Pulse AI at the FIFA World Cup 2026.',
      'You receive a complete stadium situation report and must produce a COORDINATED response plan.',
      'Your plan must address ALL affected systems: crowd management, volunteer dispatch, accessibility, announcements, transport, and fan routing.',
      'Each action must have: type (dispatch-volunteer | announce | reroute | close-zone | restrict-zone | open-zone | adjust-transport | escalate), target, detail, priority (1=urgent), and estimatedImpact.',
      'Respond ONLY with valid JSON: { "reasoning": "...", "actions": [...], "confidence": 0.0-1.0 }',
    ].join(' ');

    const situationReport = sanitize(JSON.stringify({
      risk: { type: riskReport.type, severity: riskReport.severity, zone: riskReport.zone, detail: riskReport.detail },
      cascade: { riskLevel: cascadeImpact?.riskLevel, summary: cascadeImpact?.summary, affectedZones: cascadeImpact?.effects?.length || 0 },
      hotspots: snapshot.zones ? Object.values(snapshot.zones).filter((z) => z.densityBand === 'critical' || z.densityBand === 'high').map((z) => ({ id: z.id, density: z.density, band: z.densityBand })) : [],
      weather: snapshot.weather,
      openIncidents: snapshot.incidents ? Object.values(snapshot.incidents).filter((i) => i.status !== 'resolved').length : 0,
      availableVolunteers: snapshot.volunteers?.filter((v) => v.status === 'available').map((v) => ({ id: v.id, name: v.name, role: v.role, zone: v.zone, languages: v.languages })) || [],
      brokenAccessibleRoutes: snapshot.accessibility?.brokenRoutes?.length || 0,
    }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.gemini.timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.model}:generateContent?key=${env.gemini.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nSITUATION REPORT:\n${situationReport}` }] }],
          generationConfig: {
            maxOutputTokens: env.gemini.maxTokens,
            temperature: 0.3,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      /* Extract JSON from response (may be wrapped in markdown code fences). */
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        source: 'gemini',
        reasoning: parsed.reasoning || 'AI-generated coordinated response',
        actions: (parsed.actions || []).map((a, i) => ({ id: i, ...a })),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Generate a multilingual alert message using Gemini.
   * @param {string} message — base message
   * @param {string[]} languages — target language codes
   * @returns {Promise<object>} translations keyed by language code
   */
  async translateAlert(message, languages = ['en', 'es', 'fr', 'pt']) {
    if (!env.gemini.enabled) {
      const result = {};
      for (const lang of languages) {
        result[lang] = lang === 'en' ? message : `[${lang}] ${message}`;
      }
      return result;
    }

    try {
      const prompt = [
        `Translate this stadium announcement into these languages: ${languages.join(', ')}.`,
        `Respond ONLY with JSON: { "en": "...", "es": "...", ... }`,
        `\nMessage: "${sanitize(message)}"`,
      ].join('\n');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.model}:generateContent?key=${env.gemini.apiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), env.gemini.timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.2 },
          }),
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { en: message };
      } finally {
        clearTimeout(timer);
      }
    } catch {
      const result = {};
      for (const lang of languages) {
        result[lang] = lang === 'en' ? message : `[${lang}] ${message}`;
      }
      return result;
    }
  }

  /**
   * Answer a fan's question grounded in current stadium state and rules.
   * @param {object} input - { question, currentZone, destination, language, accessibilityNeeds }
   * @returns {Promise<object>} { answer, language, groundedFacts, usedLlm }
   */
  async answerFanQuestion({ question, currentZone = 'gate-b', destination = 'sensory-room', language = 'en', accessibilityNeeds = [] } = {}) {
    const snapshot = this._state.getSnapshot();
    const fromZone = snapshot.zones[currentZone] || snapshot.zones['gate-b'];
    const toZone = snapshot.zones[destination] || snapshot.zones['sensory-room'];
    const weather = snapshot.weather;
    const needs = Array.isArray(accessibilityNeeds) ? accessibilityNeeds : [];
    const isWheelchair = needs.includes('wheelchair');
    const isVisual = needs.includes('visual');
    const isHearing = needs.includes('hearing');

    const groundedFacts = {
      from: fromZone?.label || currentZone,
      to: toZone?.label || destination,
      crowdLevel: toZone?.densityBand || 'moderate',
      occupancy: `${Math.round((toZone?.density || 0.4) * 100)}%`,
      stepFreeRequired: isWheelchair,
      weather: `${weather.condition} (${weather.severity})`,
      brokenRoutes: snapshot.accessibility.brokenRoutes.length,
    };

    if (!env.gemini.enabled) {
      return {
        answer: `Directing you from ${groundedFacts.from} to ${groundedFacts.to}. Crowd level is currently ${groundedFacts.crowdLevel}. ${isWheelchair ? 'Step-free accessible route selected.' : 'Standard route active.'} Follow overhead stadium signage.`,
        language,
        groundedFacts,
        usedLlm: false,
      };
    }

    try {
      const prompt = [
        `You are Stadium Pulse AI, the official multilingual fan assistant for FIFA World Cup 2026 at MetLife Stadium.`,
        `Answer the fan's question in requested language: ${language}. Keep answer concise (2-3 sentences), helpful, and grounded ONLY in these FACTS:`,
        `FACTS: From: ${groundedFacts.from}, To: ${groundedFacts.to}, Crowd Level: ${groundedFacts.crowdLevel}, Occupancy: ${groundedFacts.occupancy}, Step-free mode: ${isWheelchair ? 'Required' : 'Standard'}, Weather: ${groundedFacts.weather}, Disrupted Accessible Routes: ${groundedFacts.brokenRoutes}.`,
        `QUESTION: ${sanitize(question || `How do I reach ${groundedFacts.to}?`)}`,
      ].join('\n');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.model}:generateContent?key=${env.gemini.apiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), env.gemini.timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 256, temperature: 0.3 },
          }),
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
          answer: text.trim() || `Route from ${groundedFacts.from} to ${groundedFacts.to} resolved. Crowd level is ${groundedFacts.crowdLevel}.`,
          language,
          groundedFacts,
          usedLlm: true,
        };
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return {
        answer: `Route from ${groundedFacts.from} to ${groundedFacts.to} resolved. Crowd level is ${groundedFacts.crowdLevel}. ${isWheelchair ? 'Step-free path enabled.' : ''}`,
        language,
        groundedFacts,
        usedLlm: false,
      };
    }
  }
}
