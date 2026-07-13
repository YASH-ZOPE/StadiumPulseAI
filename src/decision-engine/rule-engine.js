/**
 * Deterministic rule engine — offline decision fallback.
 *
 * Produces valid, auditable action plans without any AI model. This ensures
 * the platform never hard-fails: if Gemini is unavailable, the rule engine
 * generates the same quality of coordinated response from explicit priority
 * matrices and response playbooks.
 */
export class RuleEngine {
  /** @param {import('../stadium-state/state-engine.js').StateEngine} state */
  constructor(state) {
    this._state = state;
  }

  /**
   * Generate a deterministic action plan for a risk + cascade report.
   * @param {object} riskReport
   * @param {object} cascadeImpact
   * @returns {object} decision with actions
   */
  decide(riskReport, cascadeImpact) {
    const actions = [];
    let actionId = 0;

    /* ── Crowd-critical: restrict zone + reroute + dispatch stewards ── */
    if (riskReport.type === 'crowd-critical' || riskReport.type === 'crowd-high') {
      if (riskReport.zone) {
        actions.push({
          id: actionId++,
          type: 'restrict-zone',
          target: riskReport.zone,
          detail: 'restricted',
          priority: 1,
          estimatedImpact: 'Reduce inflow to prevent crush risk',
        });

        const available = this._state.getAvailableVolunteers('steward');
        if (available.length > 0) {
          actions.push({
            id: actionId++,
            type: 'dispatch-volunteer',
            target: available[0].id,
            detail: `Deploy ${available[0].name} to ${riskReport.zone} for crowd management`,
            priority: 2,
            estimatedImpact: 'On-ground crowd direction',
          });
        }
      }

      actions.push({
        id: actionId++,
        type: 'announce',
        target: 'all-gates',
        detail: 'Direct fans to less congested entry points',
        priority: 3,
        estimatedImpact: 'Redistribute incoming crowd flow',
      });
    }

    /* ── Queue excessive: open alternate lanes + announce ── */
    if (riskReport.type === 'queue-excessive') {
      actions.push({
        id: actionId++,
        type: 'announce',
        target: riskReport.zone || 'all',
        detail: `Queue at ${riskReport.detail} — directing fans to alternatives`,
        priority: 2,
        estimatedImpact: 'Reduce wait by redistributing queue load',
      });

      actions.push({
        id: actionId++,
        type: 'reroute',
        target: 'fans',
        detail: 'Activate alternate queue lanes and signage',
        priority: 2,
        estimatedImpact: 'Spread queue across multiple service points',
      });
    }

    /* ── Weather threat: shelter protocol + transport adjust ── */
    if (riskReport.type === 'weather-threat') {
      actions.push({
        id: actionId++,
        type: 'announce',
        target: 'all',
        detail: 'Weather advisory — move to covered areas',
        priority: 1,
        estimatedImpact: 'Fan safety during adverse weather',
      });

      actions.push({
        id: actionId++,
        type: 'adjust-transport',
        target: 'transit-hub',
        detail: { shuttleStatus: 'delayed' },
        priority: 3,
        estimatedImpact: 'Prevent exposure during transport',
      });

      const medVol = this._state.getAvailableVolunteers('medical');
      if (medVol.length > 0) {
        actions.push({
          id: actionId++,
          type: 'dispatch-volunteer',
          target: medVol[0].id,
          detail: `Pre-position ${medVol[0].name} for weather-related medical support`,
          priority: 2,
          estimatedImpact: 'Rapid response to heat/lightning injuries',
        });
      }
    }

    /* ── Accessibility disruption: reroute + dispatch accessibility host ── */
    if (riskReport.type === 'accessibility-disruption') {
      actions.push({
        id: actionId++,
        type: 'reroute',
        target: 'accessible-paths',
        detail: 'Update wayfinding signage to accessible alternatives',
        priority: 1,
        estimatedImpact: 'Maintain mobility-impaired access',
      });

      const accVol = this._state.getAvailableVolunteers('accessibility');
      if (accVol.length > 0) {
        actions.push({
          id: actionId++,
          type: 'dispatch-volunteer',
          target: accVol[0].id,
          detail: `Deploy ${accVol[0].name} to guide wheelchair users on alternative routes`,
          priority: 1,
          estimatedImpact: 'Personal assistance for affected guests',
        });
      }
    }

    /* ── Multi-incident escalation ──────────────── */
    if (riskReport.type === 'multi-incident') {
      actions.push({
        id: actionId++,
        type: 'escalate',
        target: 'operations-command',
        detail: 'Multiple critical incidents — escalate to senior operations lead',
        priority: 1,
        estimatedImpact: 'Unified incident command',
      });
    }

    /* ── Add cascade-aware actions ──────────────── */
    if (cascadeImpact?.effects) {
      const wouldBreach = cascadeImpact.effects.filter((e) => e.wouldBreachThreshold);
      for (const breach of wouldBreach) {
        actions.push({
          id: actionId++,
          type: 'reroute',
          target: breach.zone,
          detail: `Pre-emptively redirect flow away from ${breach.label} (projected ${breach.projectedDensity}%)`,
          priority: 2,
          estimatedImpact: `Prevent cascade overload at ${breach.label}`,
        });
      }
    }

    return {
      actions,
      reasoning: this._buildReasoning(riskReport, cascadeImpact, actions),
      confidence: 0.75,
    };
  }

  _buildReasoning(riskReport, cascadeImpact, actions) {
    const parts = [
      `Risk detected: ${riskReport.type} (${riskReport.severity}) — ${riskReport.detail}.`,
    ];
    if (cascadeImpact?.summary) {
      parts.push(`Cascade analysis: ${cascadeImpact.summary}`);
    }
    parts.push(`Generated ${actions.length} coordinated action(s) from the operational playbook.`);
    return parts.join(' ');
  }
}
