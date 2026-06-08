struct Arena {
    buf: Vec<u8>,
    off: usize,
}

impl Arena {
    fn new(size: usize) -> Self { // TODO: implement
        Self {
            buf: vec![0u8; size],
            off: 0,
        }
    }

    fn alloc(&mut self, n: usize) -> Option<&mut [u8]> { // TODO: implement
        if self.off + n > self.buf.len() {
            return None;
        }
        let start = self.off;
        self.off += n;
        Some(&mut self.buf[start..start + n])
    }

    fn reset(&mut self) { // TODO: implement
        self.off = 0;
    }

    fn used(&self) -> usize { // TODO: implement
        self.off
    }

    #[allow(dead_code)]
    fn cap(&self) -> usize { // TODO: implement
        self.buf.len()
    }

    fn avail(&self) -> usize { // TODO: implement
        self.buf.len() - self.off
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_alloc() {
        let mut a = Arena::new(64);
        let s1 = a.alloc(16);
        assert!(s1.is_some());
        assert_eq!(s1.unwrap().len(), 16);

        let s2 = a.alloc(32);
        assert!(s2.is_some());
        assert_eq!(s2.unwrap().len(), 32);
        assert_eq!(a.used(), 48);
    }

    #[test]
    fn test_overflow() {
        let mut a = Arena::new(32);
        assert!(a.alloc(16).is_some());
        assert!(a.alloc(20).is_none());
    }

    #[test]
    fn test_reset() {
        let mut a = Arena::new(64);
        a.alloc(32);
        a.alloc(16);
        a.reset();
        assert_eq!(a.used(), 0);
        assert_eq!(a.avail(), 64);
    }

    #[test]
    fn test_disjoint() {
        let mut a = Arena::new(64);
        let s1 = a.alloc(8).unwrap();
        s1.fill(0xFF);

        let s2 = a.alloc(8).unwrap();
        for &b in s2.iter() {
            assert_eq!(b, 0, "allocations should be disjoint");
        }
    }
}
