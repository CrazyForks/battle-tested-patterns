import { describe, it, expect } from 'vitest';

/**
 * State Machine - Intermediate: Traffic Light Controller.
 *
 * TODO: Implement a traffic light state machine with states
 * green/yellow/red and timed transitions. A pedestrian_request
 * event forces transition to red (via yellow if currently green).
 * Track full state history.
 */

type TrafficState = 'green' | 'yellow' | 'red';
type TrafficEvent = 'TIMER' | 'PEDESTRIAN_REQUEST';

interface TransitionResult {
  from: TrafficState;
  to: TrafficState;
  event: TrafficEvent;
}

class TrafficLightController {
  private current: TrafficState;
  private history: TransitionResult[] = [];

  private readonly transitions: Record<TrafficState, Partial<Record<TrafficEvent, TrafficState>>> = {
    green:  { TIMER: 'yellow', PEDESTRIAN_REQUEST: 'yellow' },
    yellow: { TIMER: 'red', PEDESTRIAN_REQUEST: 'red' },
    red:    { TIMER: 'green' },
  };

  constructor(initial: TrafficState = 'green') {
    this.current = initial; // TODO: implement
  }

  get state(): TrafficState {
    return this.current; // TODO: implement
  }

  /** Process an event. Returns true if a transition occurred. */
  send(event: TrafficEvent): boolean {
    const next = this.transitions[this.current][event]; // TODO: implement
    if (next === undefined) return false;
    this.history.push({ from: this.current, to: next, event });
    this.current = next;
    return true;
  }

  /** Check if an event is valid from the current state */
  can(event: TrafficEvent): boolean {
    return this.transitions[this.current][event] !== undefined; // TODO: implement
  }

  /** Return the full transition history */
  getHistory(): TransitionResult[] {
    return [...this.history]; // TODO: implement
  }

  /** Run a full normal cycle: green -> yellow -> red -> green */
  runCycle(): TrafficState[] {
    const states: TrafficState[] = [this.current]; // TODO: implement
    this.send('TIMER');
    states.push(this.current);
    this.send('TIMER');
    states.push(this.current);
    this.send('TIMER');
    states.push(this.current);
    return states;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('State Machine - Intermediate: Traffic Light Controller', () => {
  it('should complete a normal cycle', () => {
    const light = new TrafficLightController('green');
    const cycle = light.runCycle();
    expect(cycle).toEqual(['green', 'yellow', 'red', 'green']);
  });

  it('should handle pedestrian request during green', () => {
    const light = new TrafficLightController('green');
    expect(light.send('PEDESTRIAN_REQUEST')).toBe(true);
    expect(light.state).toBe('yellow');
    // Continue to red on next TIMER
    expect(light.send('TIMER')).toBe(true);
    expect(light.state).toBe('red');
  });

  it('should ignore pedestrian request during red', () => {
    const light = new TrafficLightController('red');
    expect(light.send('PEDESTRIAN_REQUEST')).toBe(false);
    expect(light.state).toBe('red');
  });

  it('should reject invalid transitions', () => {
    const light = new TrafficLightController('green');
    expect(light.can('TIMER')).toBe(true);
    expect(light.can('PEDESTRIAN_REQUEST')).toBe(true);

    const redLight = new TrafficLightController('red');
    expect(redLight.can('PEDESTRIAN_REQUEST')).toBe(false);
    expect(redLight.can('TIMER')).toBe(true);
  });

  it('should track full state history', () => {
    const light = new TrafficLightController('green');
    light.send('TIMER');
    light.send('PEDESTRIAN_REQUEST'); // yellow -> red (pedestrian shortcut)
    light.send('TIMER');

    const history = light.getHistory();
    expect(history).toEqual([
      { from: 'green', to: 'yellow', event: 'TIMER' },
      { from: 'yellow', to: 'red', event: 'PEDESTRIAN_REQUEST' },
      { from: 'red', to: 'green', event: 'TIMER' },
    ]);
  });
});
