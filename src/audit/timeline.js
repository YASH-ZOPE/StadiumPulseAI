/**
 * Audit timeline — immutable event and decision log.
 *
 * Records every event, decision, approval and action execution in an ordered
 * timeline. Supports replay and filtering for post-incident review.
 */
export class Timeline {
  constructor() {
    /** @type {Array<object>} */
    this._entries = [];
    this._maxEntries = 1000;
  }

  /** Record a stadium event. */
  recordEvent(evt) {
    this._add({
      entryType: 'event',
      id: evt.id,
      timestamp: evt.timestamp,
      category: evt.category,
      type: evt.type,
      zone: evt.zone,
      severity: evt.severity,
      summary: `[${evt.category}] ${evt.type} at ${evt.zone || 'global'} (${evt.severity})`,
      detail: evt.payload,
    });
  }

  /** Record a decision (AI recommendation). */
  recordDecision(decision) {
    this._add({
      entryType: 'decision',
      id: decision.id,
      timestamp: decision.createdAt,
      category: 'decision',
      type: 'ai-recommendation',
      zone: decision.trigger?.zone || null,
      severity: decision.trigger?.riskLevel || 'info',
      summary: `AI recommends ${decision.aiRecommendation.actions.length} action(s): ${decision.trigger?.summary || ''}`,
      detail: {
        source: decision.aiRecommendation.source,
        reasoning: decision.aiRecommendation.reasoning,
        actionCount: decision.aiRecommendation.actions.length,
        confidence: decision.aiRecommendation.confidence,
      },
    });
  }

  /** Record an approval/rejection. */
  recordApproval(decision) {
    this._add({
      entryType: 'approval',
      id: `${decision.id}-approval`,
      timestamp: decision.approval.approvedAt,
      category: 'approval',
      type: decision.approval.status,
      zone: decision.trigger?.zone || null,
      severity: 'info',
      summary: `Decision ${decision.id} ${decision.approval.status} by ${decision.approval.approvedBy} (${decision.approval.approvedActions.length} actions)`,
      detail: {
        decisionId: decision.id,
        status: decision.approval.status,
        approvedActions: decision.approval.approvedActions,
        reason: decision.approval.reason,
      },
    });
  }

  /** Record an escalation action. */
  recordEscalation(action) {
    this._add({
      entryType: 'escalation',
      id: `esc-${Date.now()}`,
      timestamp: new Date().toISOString(),
      category: 'escalation',
      type: 'escalate',
      zone: null,
      severity: 'critical',
      summary: action.detail,
      detail: action,
    });
  }

  /** Get the full timeline (newest first). */
  getTimeline(limit = 100) {
    return this._entries.slice(-limit).reverse();
  }

  /** Filter timeline by category. */
  getByCategory(category, limit = 50) {
    return this._entries
      .filter((e) => e.category === category)
      .slice(-limit)
      .reverse();
  }

  /** Get a specific entry by ID. */
  getEntry(id) {
    return this._entries.find((e) => e.id === id) || null;
  }

  /** Get timeline stats. */
  getStats() {
    const counts = {};
    for (const entry of this._entries) {
      counts[entry.entryType] = (counts[entry.entryType] || 0) + 1;
    }
    return { total: this._entries.length, ...counts };
  }

  _add(entry) {
    if (this._entries.length >= this._maxEntries) {
      this._entries.shift();
    }
    this._entries.push(entry);
  }

  /** Clear (for tests). */
  reset() {
    this._entries = [];
  }
}
