/// Bitmask pattern — Rust idiomatic implementation using bitflags-style constants.

pub const READ: u32 = 1 << 0;
pub const WRITE: u32 = 1 << 1;
pub const EXECUTE: u32 = 1 << 2;
pub const DELETE: u32 = 1 << 3;

pub fn has_flag(flags: u32, flag: u32) -> bool {
    (flags & flag) == flag
}

pub fn has_any(flags: u32, mask: u32) -> bool {
    (flags & mask) != 0
}

pub fn set_flag(flags: u32, flag: u32) -> u32 {
    flags | flag
}

pub fn clear_flag(flags: u32, flag: u32) -> u32 {
    flags & !flag
}

pub fn toggle_flag(flags: u32, flag: u32) -> u32 {
    flags ^ flag
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_and_check_flag() {
        let flags = set_flag(0, READ);
        assert!(has_flag(flags, READ));
        assert!(!has_flag(flags, WRITE));
    }

    #[test]
    fn test_multiple_flags() {
        let flags = READ | WRITE;
        assert!(has_flag(flags, READ));
        assert!(has_flag(flags, WRITE));
        assert!(!has_flag(flags, EXECUTE));
    }

    #[test]
    fn test_clear_flag() {
        let flags = READ | WRITE | EXECUTE;
        let flags = clear_flag(flags, WRITE);
        assert!(has_flag(flags, READ));
        assert!(!has_flag(flags, WRITE));
        assert!(has_flag(flags, EXECUTE));
    }

    #[test]
    fn test_toggle_flag() {
        let flags = READ;
        let flags = toggle_flag(flags, WRITE);
        assert!(has_flag(flags, WRITE));
        let flags = toggle_flag(flags, WRITE);
        assert!(!has_flag(flags, WRITE));
    }

    #[test]
    fn test_has_any() {
        let dangerous = WRITE | DELETE;
        assert!(!has_any(READ, dangerous));
        assert!(has_any(READ | WRITE, dangerous));
    }

    #[test]
    fn test_check_compound_permission() {
        let required = READ | WRITE;
        let editor = READ | WRITE | EXECUTE;
        let viewer = READ;
        assert!(has_flag(editor, required));
        assert!(!has_flag(viewer, required));
    }
}
