/**
 * Queue forecast engine.
 *
 * Predicts gate, food, restroom and transit queue wait times based on current
 * zone density, throughput rates and trend direction. Uses an arrival-rate
 * model: forecastWait = (arrivalRate − throughput) × lookaheadMinutes / throughput.
 */
export class QueueForecaster {
  /**
   * @param {import('../stadium-state/state-engine.js').StateEngine} state
   * @param {import('../event-stream/event-bus.js').EventBus} bus
   */
  constructor(state, bus) {
    this._state = state;
    this._bus = bus;
    /** Lookahead window for forecast (minutes). */
    this._lookaheadMin = 15;
  }

  /** Recalculate all queue forecasts and emit threshold events. */
  update() {
    const queues = this._state.getQueues();
    const zones = this._state.getSnapshot().zones;
    const forecasts = [];

    for (const q of queues) {
      const zone = zones[q.zone];
      if (!zone) {
        continue;
      }

      /* Estimate arrival rate from zone density and trend. */
      const trendMultiplier = q.trend === 'rising' ? 1.3 : q.trend === 'falling' ? 0.7 : 1.0;
      const baseArrivalRate = zone.density * q.throughputPerMin * 1.5;
      const arrivalRate = baseArrivalRate * trendMultiplier;

      /* Queue builds when arrivals exceed throughput. */
      const surplus = Math.max(0, arrivalRate - q.throughputPerMin);
      const forecastWait = q.currentWaitMinutes + (surplus * this._lookaheadMin) / Math.max(q.throughputPerMin, 1);

      const forecast = {
        queueId: q.id,
        zone: q.zone,
        label: q.label,
        currentWaitMinutes: q.currentWaitMinutes,
        forecastWaitMinutes: Math.round(forecastWait * 10) / 10,
        trend: q.trend,
        throughputPerMin: q.throughputPerMin,
        arrivalRate: Math.round(arrivalRate * 10) / 10,
      };
      forecasts.push(forecast);

      /* Emit threshold breach event if forecast crosses warning/critical lines. */
      if (forecastWait >= 20 && q.currentWaitMinutes < 20) {
        this._bus.emit('event:new', {
          id: `evt-qf-${Date.now()}-${q.id}`,
          timestamp: new Date().toISOString(),
          source: 'system',
          category: 'queue',
          type: 'forecast-threshold',
          zone: q.zone,
          severity: forecastWait >= 30 ? 'critical' : 'warning',
          payload: { queueId: q.id, forecastWaitMinutes: forecast.forecastWaitMinutes, trend: q.trend },
          triggeredBy: null,
          cascadeDepth: 1,
        });
      }
    }

    this._latestForecasts = forecasts;
    return forecasts;
  }

  /** Get latest computed forecasts. */
  getForecasts() {
    return this._latestForecasts || this.update();
  }

  /** Get forecast for a specific queue. */
  getForecast(queueId) {
    const forecasts = this.getForecasts();
    return forecasts.find((f) => f.queueId === queueId) || null;
  }
}
