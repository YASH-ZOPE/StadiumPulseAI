/**
 * Approval gate — human-in-the-loop state machine.
 *
 * Every AI recommendation must pass through this gate before actions are
 * executed. An operator can approve all, approve a subset, or reject with a
 * reason. This ensures AI augments human judgment without replacing it.
 */
export class ApprovalGate {
  /**
   * @param {import('../event-stream/event-bus.js').EventBus} bus
   * @param {import('../audit/timeline.js').Timeline} timeline
   */
  constructor(bus, timeline) {
    this._bus = bus;
    this._timeline = timeline;
    /** @type {Map<string, object>} */
    this._pending = new Map();
  }

  /** Register a new decision as pending approval. */
  propose(decision) {
    decision.approval.status = 'pending';
    this._pending.set(decision.id, decision);
  }

  /**
   * Approve a decision (all or partial).
   * @param {string} decisionId
   * @param {number[]} approvedActionIds — indices of approved actions (empty = approve all)
   * @param {string} [approvedBy='operator']
   * @returns {object|null} updated decision
   */
  approve(decisionId, approvedActionIds, approvedBy = 'operator') {
    const decision = this._pending.get(decisionId);
    if (!decision) {
      return null;
    }

    const allActionIds = decision.aiRecommendation.actions.map((a) => a.id);
    const approved =
      !approvedActionIds || approvedActionIds.length === 0
        ? allActionIds
        : approvedActionIds.filter((id) => allActionIds.includes(id));

    decision.approval = {
      status: approved.length === allActionIds.length ? 'approved' : 'partial',
      approvedActions: approved,
      approvedBy,
      approvedAt: new Date().toISOString(),
      reason: null,
    };

    this._pending.delete(decisionId);
    this._bus.emit('decision:approved', decision);
    return decision;
  }

  /**
   * Reject a decision.
   * @param {string} decisionId
   * @param {string} reason
   * @param {string} [rejectedBy='operator']
   * @returns {object|null} updated decision
   */
  reject(decisionId, reason, rejectedBy = 'operator') {
    const decision = this._pending.get(decisionId);
    if (!decision) {
      return null;
    }

    decision.approval = {
      status: 'rejected',
      approvedActions: [],
      approvedBy: rejectedBy,
      approvedAt: new Date().toISOString(),
      reason: reason || 'Rejected by operator',
    };

    this._pending.delete(decisionId);
    this._timeline.recordApproval(decision);
    this._bus.emit('decision:updated', decision);
    return decision;
  }

  /** Get all pending decisions. */
  getPending() {
    return [...this._pending.values()];
  }

  /** Get a specific pending decision. */
  getDecision(id) {
    return this._pending.get(id) || null;
  }
}
