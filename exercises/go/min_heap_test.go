package exercises

import "testing"

// MinHeap — Go idiomatic implementation using a slice.
type MinHeap struct {
	data []int
}

func NewMinHeap() *MinHeap {
	return &MinHeap{}
}

func (h *MinHeap) Len() int {
	return len(h.data)
}

func (h *MinHeap) Peek() (int, bool) {
	if len(h.data) == 0 {
		return 0, false
	}
	return h.data[0], true
}

func (h *MinHeap) Push(val int) {
	h.data = append(h.data, val)
	h.siftUp(len(h.data) - 1)
}

func (h *MinHeap) Pop() (int, bool) {
	if len(h.data) == 0 {
		return 0, false
	}
	val := h.data[0]
	last := len(h.data) - 1
	h.data[0] = h.data[last]
	h.data = h.data[:last]
	if len(h.data) > 0 {
		h.siftDown(0)
	}
	return val, true
}

func (h *MinHeap) siftUp(i int) {
	for i > 0 {
		parent := (i - 1) / 2
		if h.data[i] < h.data[parent] {
			h.data[i], h.data[parent] = h.data[parent], h.data[i]
			i = parent
		} else {
			break
		}
	}
}

func (h *MinHeap) siftDown(i int) {
	n := len(h.data)
	for {
		left := 2*i + 1
		right := 2*i + 2
		smallest := i

		if left < n && h.data[left] < h.data[smallest] {
			smallest = left
		}
		if right < n && h.data[right] < h.data[smallest] {
			smallest = right
		}
		if smallest != i {
			h.data[i], h.data[smallest] = h.data[smallest], h.data[i]
			i = smallest
		} else {
			break
		}
	}
}

func TestMinHeapPushAndPeek(t *testing.T) {
	h := NewMinHeap()
	h.Push(5)
	h.Push(3)
	h.Push(7)
	if val, ok := h.Peek(); !ok || val != 3 {
		t.Errorf("Peek() = %d, want 3", val)
	}
}

func TestMinHeapPopOrder(t *testing.T) {
	h := NewMinHeap()
	h.Push(5)
	h.Push(1)
	h.Push(3)
	h.Push(2)
	h.Push(4)

	expected := []int{1, 2, 3, 4, 5}
	for _, want := range expected {
		got, ok := h.Pop()
		if !ok || got != want {
			t.Errorf("Pop() = %d, want %d", got, want)
		}
	}

	if _, ok := h.Pop(); ok {
		t.Error("Pop() should return false for empty heap")
	}
}

func TestMinHeapEmpty(t *testing.T) {
	h := NewMinHeap()
	if h.Len() != 0 {
		t.Error("new heap should be empty")
	}
	if _, ok := h.Pop(); ok {
		t.Error("Pop() on empty heap should return false")
	}
	if _, ok := h.Peek(); ok {
		t.Error("Peek() on empty heap should return false")
	}
}
