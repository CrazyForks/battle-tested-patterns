pub struct DoubleBuffer {
    buffers: [Vec<u8>; 2],
    front: usize,
}

impl DoubleBuffer {
    pub fn new(size: usize) -> Self { // TODO: implement
        DoubleBuffer {
            buffers: [vec![0; size], vec![0; size]],
            front: 0,
        }
    }

    pub fn back(&mut self) -> &mut [u8] { // TODO: implement
        &mut self.buffers[1 - self.front]
    }

    pub fn front(&self) -> &[u8] { // TODO: implement
        &self.buffers[self.front]
    }

    pub fn swap(&mut self) { // TODO: implement
        self.front = 1 - self.front;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_swap() {
        let mut db = DoubleBuffer::new(4);
        db.back()[0] = b'A';
        db.back()[1] = b'B';
        db.swap();
        assert_eq!(db.front()[0], b'A');
        assert_eq!(db.front()[1], b'B');
    }

    #[test]
    fn test_independence() {
        let mut db = DoubleBuffer::new(4);
        db.back()[0] = b'X';
        assert_ne!(db.front()[0], b'X');
    }

    #[test]
    fn test_multiple_swaps() {
        let mut db = DoubleBuffer::new(2);
        db.back()[0] = 1;
        db.swap();
        db.back()[0] = 2;
        db.swap();
        assert_eq!(db.front()[0], 2);
    }
}
