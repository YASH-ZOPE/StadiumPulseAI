/**
 * Alert composer — multilingual announcement builder.
 *
 * Turns an action into a clear, multilingual fan-facing announcement. Uses
 * Gemini for translation when available, with deterministic fallback templates.
 */
export class AlertComposer {
  /** @param {import('../decision-engine/gemini-orchestrator.js').GeminiOrchestrator} gemini */
  constructor(gemini) {
    this._gemini = gemini;
  }

  /**
   * Compose a multilingual alert from an action and state snapshot.
   * @param {object} action
   * @param {object} snapshot
   * @returns {Promise<object>} alert with translations
   */
  async compose(action, snapshot) {
    const baseMessage = this._buildBaseMessage(action, snapshot);
    const languages = snapshot.venue?.languages || ['en', 'es', 'fr', 'pt'];

    const translations = await this._gemini.translateAlert(baseMessage, languages);

    return {
      id: `alert-${Date.now()}`,
      timestamp: new Date().toISOString(),
      baseMessage,
      translations,
      priority: action.priority || 3,
      target: action.target,
      type: action.type,
    };
  }

  /** Build a human-readable alert message from an action. */
  _buildBaseMessage(action, snapshot) {
    switch (action.type) {
      case 'announce':
        return action.detail;
      case 'reroute':
        return `Attention: please follow updated directional signage. ${action.detail}`;
      case 'close-zone':
        return `${action.target} is temporarily closed. Please use alternative routes.`;
      case 'restrict-zone':
        return `${action.target} has restricted access. Stewards are directing foot traffic.`;
      case 'adjust-transport': {
        const weather = snapshot.weather?.condition || '';
        return `Transport update: shuttle service ${action.detail?.shuttleStatus || 'adjusted'} due to ${weather || 'operational conditions'}.`;
      }
      default:
        return action.detail || 'Stadium operations update — please follow staff directions.';
    }
  }
}
