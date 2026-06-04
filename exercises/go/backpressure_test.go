package exercises

import (
	"errors"
	"testing"
)

type BoundedQueue struct {
	buf  []int
	cap  int
}

func NewBoundedQueue(capacity int) *BoundedQueue {
	return &BoundedQueue{cap: capacity}
}

func (q *BoundedQueue) Push(item int) error {
	if len(q.buf) >= q.cap {
		return errors.New("queue full: backpressure")
	}
	q.buf = append(q.buf, item)
	return nil
}

func (q *BoundedQueue) Pop() (int, bool) {
	if len(q.buf) == 0 {
		return 0, false
	}
	item := q.buf[0]
	q.buf = q.buf[1:]
	return item, true
}

func (q *BoundedQueue) Len() int { return len(q.buf) }

func TestBackpressureAccepts(t *testing.T) {
	q := NewBoundedQueue(3)
	for i := 0; i < 3; i++ {
		if err := q.Push(i); err != nil {
			t.Errorf("push %d should succeed: %v", i, err)
		}
	}
}

func TestBackpressureRejects(t *testing.T) {
	q := NewBoundedQueue(2)
	q.Push(1)
	q.Push(2)
	if err := q.Push(3); err == nil {
		t.Error("should reject when full")
	}
}

func TestBackpressureDrain(t *testing.T) {
	q := NewBoundedQueue(2)
	q.Push(1)
	q.Push(2)
	q.Pop()
	if err := q.Push(3); err != nil {
		t.Error("should accept after draining")
	}
}

func TestBackpressureOrder(t *testing.T) {
	q := NewBoundedQueue(5)
	for i := 1; i <= 3; i++ {
		q.Push(i)
	}
	for i := 1; i <= 3; i++ {
		got, ok := q.Pop()
		if !ok || got != i {
			t.Errorf("Pop() = %d, want %d", got, i)
		}
	}
}
