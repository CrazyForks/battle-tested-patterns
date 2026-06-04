package exercises

import "testing"

type Observer interface {
	Update(event string)
}

type EventBus struct {
	listeners map[string][]Observer
}

func NewEventBus() *EventBus {
	return &EventBus{listeners: make(map[string][]Observer)}
}

func (eb *EventBus) Subscribe(event string, obs Observer) {
	eb.listeners[event] = append(eb.listeners[event], obs)
}

func (eb *EventBus) Publish(event string) {
	for _, obs := range eb.listeners[event] {
		obs.Update(event)
	}
}

type recorder struct {
	events []string
}

func (r *recorder) Update(event string) {
	r.events = append(r.events, event)
}

func TestObserverReceivesEvents(t *testing.T) {
	bus := NewEventBus()
	r := &recorder{}
	bus.Subscribe("click", r)
	bus.Publish("click")
	bus.Publish("click")

	if len(r.events) != 2 {
		t.Errorf("expected 2 events, got %d", len(r.events))
	}
}

func TestObserverMultipleSubscribers(t *testing.T) {
	bus := NewEventBus()
	r1 := &recorder{}
	r2 := &recorder{}
	bus.Subscribe("resize", r1)
	bus.Subscribe("resize", r2)
	bus.Publish("resize")

	if len(r1.events) != 1 || len(r2.events) != 1 {
		t.Error("both subscribers should receive the event")
	}
}

func TestObserverNoFalseNotifications(t *testing.T) {
	bus := NewEventBus()
	r := &recorder{}
	bus.Subscribe("click", r)
	bus.Publish("scroll")

	if len(r.events) != 0 {
		t.Error("should not receive events for unsubscribed topics")
	}
}
