struct Batch<T> {
    size: usize,
    buffer: Vec<T>,
    batches: Vec<Vec<T>>,
}

impl<T: Clone> Batch<T> {
    fn new(size: usize) -> Self { // TODO: implement
        Self {
            size,
            buffer: Vec::new(),
            batches: Vec::new(),
        }
    }

    fn add(&mut self, item: T) { // TODO: implement
        self.buffer.push(item);
        if self.buffer.len() >= self.size {
            self.flush();
        }
    }

    fn flush(&mut self) { // TODO: implement
        if self.buffer.is_empty() {
            return;
        }
        let batch = self.buffer.drain(..).collect();
        self.batches.push(batch);
    }

    fn batches(&self) -> &[Vec<T>] { // TODO: implement
        &self.batches
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_auto_flush() {
        let mut b = Batch::new(3);
        for i in 1..=6 {
            b.add(i);
        }
        let batches = b.batches();
        assert_eq!(batches.len(), 2);
        assert_eq!(batches[0], vec![1, 2, 3]);
        assert_eq!(batches[1], vec![4, 5, 6]);
    }

    #[test]
    fn test_batch_manual_flush() {
        let mut b = Batch::new(10);
        b.add("a");
        b.add("b");
        b.flush();

        let batches = b.batches();
        assert_eq!(batches.len(), 1);
        assert_eq!(batches[0], vec!["a", "b"]);
    }

    #[test]
    fn test_batch_empty_flush() {
        let mut b: Batch<i32> = Batch::new(5);
        b.flush();
        assert!(b.batches().is_empty());
    }

    #[test]
    fn test_batch_partial_and_full() {
        let mut b = Batch::new(3);
        for i in 1..=7 {
            b.add(i);
        }
        b.flush();

        let batches = b.batches();
        assert_eq!(batches.len(), 3);
        assert_eq!(batches[2], vec![7]);
    }
}
