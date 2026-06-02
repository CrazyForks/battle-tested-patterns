package exercises

import "testing"

// Permission flags — Go idiomatic: typed constants with iota
type Permission uint32

const (
	Read    Permission = 1 << iota // 0b0001
	Write                          // 0b0010
	Execute                        // 0b0100
	Delete                         // 0b1000
)

func HasFlag(flags, flag Permission) bool {
	return flags&flag == flag
}

func HasAny(flags, mask Permission) bool {
	return flags&mask != 0
}

func SetFlag(flags, flag Permission) Permission {
	return flags | flag
}

func ClearFlag(flags, flag Permission) Permission {
	return flags &^ flag // Go's AND NOT operator
}

func ToggleFlag(flags, flag Permission) Permission {
	return flags ^ flag
}

func TestSetAndCheckFlag(t *testing.T) {
	flags := SetFlag(0, Read)
	if !HasFlag(flags, Read) {
		t.Error("expected Read flag to be set")
	}
	if HasFlag(flags, Write) {
		t.Error("expected Write flag to not be set")
	}
}

func TestMultipleFlags(t *testing.T) {
	flags := Read | Write
	tests := []struct {
		name   string
		flag   Permission
		expect bool
	}{
		{"Read", Read, true},
		{"Write", Write, true},
		{"Execute", Execute, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := HasFlag(flags, tc.flag); got != tc.expect {
				t.Errorf("HasFlag(%b, %b) = %v, want %v", flags, tc.flag, got, tc.expect)
			}
		})
	}
}

func TestClearFlag(t *testing.T) {
	flags := Read | Write | Execute
	flags = ClearFlag(flags, Write)
	if HasFlag(flags, Write) {
		t.Error("Write should be cleared")
	}
	if !HasFlag(flags, Read) || !HasFlag(flags, Execute) {
		t.Error("Read and Execute should still be set")
	}
}

func TestToggleFlag(t *testing.T) {
	flags := Permission(Read)
	flags = ToggleFlag(flags, Write)
	if !HasFlag(flags, Write) {
		t.Error("Write should be set after toggle")
	}
	flags = ToggleFlag(flags, Write)
	if HasFlag(flags, Write) {
		t.Error("Write should be cleared after second toggle")
	}
}

func TestHasAny(t *testing.T) {
	dangerous := Write | Delete
	if HasAny(Read, dangerous) {
		t.Error("Read-only should not match dangerous ops")
	}
	if !HasAny(Read|Write, dangerous) {
		t.Error("Read+Write should match dangerous ops")
	}
}

func TestCompoundPermission(t *testing.T) {
	required := Read | Write
	editor := Read | Write | Execute
	viewer := Permission(Read)

	if !HasFlag(editor, required) {
		t.Error("editor should have all required permissions")
	}
	if HasFlag(viewer, required) {
		t.Error("viewer should not have all required permissions")
	}
}
