package exercises

import (
	"errors"
	"testing"
)

type SMState string

const (
	Idle       SMState = "idle"
	Pending    SMState = "pending"
	Approved   SMState = "approved"
	Rejected   SMState = "rejected"
)

type transition struct {
	from  SMState
	event string
	to    SMState
}

type StateMachine struct {
	current     SMState
	transitions []transition
}

func NewStateMachine(initial SMState, transitions []transition) *StateMachine {
	return &StateMachine{current: initial, transitions: transitions}
}

func (sm *StateMachine) Send(event string) error {
	for _, t := range sm.transitions {
		if t.from == sm.current && t.event == event {
			sm.current = t.to
			return nil
		}
	}
	return errors.New("invalid transition")
}

func (sm *StateMachine) Current() SMState { return sm.current }

func newApprovalMachine() *StateMachine {
	return NewStateMachine(Idle, []transition{
		{Idle, "submit", Pending},
		{Pending, "approve", Approved},
		{Pending, "reject", Rejected},
		{Rejected, "resubmit", Pending},
	})
}

func TestStateMachineHappyPath(t *testing.T) {
	sm := newApprovalMachine()
	if err := sm.Send("submit"); err != nil {
		t.Fatal(err)
	}
	if sm.Current() != Pending {
		t.Errorf("expected Pending, got %s", sm.Current())
	}
	if err := sm.Send("approve"); err != nil {
		t.Fatal(err)
	}
	if sm.Current() != Approved {
		t.Errorf("expected Approved, got %s", sm.Current())
	}
}

func TestStateMachineInvalidTransition(t *testing.T) {
	sm := newApprovalMachine()
	if err := sm.Send("approve"); err == nil {
		t.Error("should reject invalid transition from idle")
	}
}

func TestStateMachineResubmit(t *testing.T) {
	sm := newApprovalMachine()
	sm.Send("submit")
	sm.Send("reject")
	if err := sm.Send("resubmit"); err != nil {
		t.Fatal(err)
	}
	if sm.Current() != Pending {
		t.Errorf("expected Pending after resubmit, got %s", sm.Current())
	}
}
