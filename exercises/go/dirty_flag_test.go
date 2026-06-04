package exercises

import (
	"strings"
	"testing"
)

type Transform struct {
	x, y    float64
	dirty   bool
	cachedS string
}

func NewTransform(x, y float64) *Transform {
	return &Transform{x: x, y: y, dirty: true}
}

func (t *Transform) SetPosition(x, y float64) {
	if t.x != x || t.y != y {
		t.x = x
		t.y = y
		t.dirty = true
	}
}

func (t *Transform) WorldMatrix() string {
	if t.dirty {
		t.cachedS = strings.Repeat(".", int(t.x+t.y)) // simulate expensive computation
		t.dirty = false
	}
	return t.cachedS
}

func (t *Transform) IsDirty() bool { return t.dirty }

func TestDirtyFlagInitiallyDirty(t *testing.T) {
	tr := NewTransform(1, 2)
	if !tr.IsDirty() {
		t.Error("should be dirty initially")
	}
}

func TestDirtyFlagClearedAfterCompute(t *testing.T) {
	tr := NewTransform(1, 2)
	tr.WorldMatrix()
	if tr.IsDirty() {
		t.Error("should be clean after computation")
	}
}

func TestDirtyFlagSetOnChange(t *testing.T) {
	tr := NewTransform(1, 2)
	tr.WorldMatrix()
	tr.SetPosition(5, 6)
	if !tr.IsDirty() {
		t.Error("should be dirty after position change")
	}
}

func TestDirtyFlagNoRedundantDirty(t *testing.T) {
	tr := NewTransform(1, 2)
	tr.WorldMatrix()
	tr.SetPosition(1, 2) // same position
	if tr.IsDirty() {
		t.Error("should not mark dirty for same values")
	}
}

func TestDirtyFlagCacheReuse(t *testing.T) {
	tr := NewTransform(3, 0)
	r1 := tr.WorldMatrix()
	r2 := tr.WorldMatrix()
	if r1 != r2 {
		t.Error("cached result should be reused")
	}
}
