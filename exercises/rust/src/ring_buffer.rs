pub struct RingBuffer<T> {
    buffer: Vec<Option<T>>,
    head: usize,
    tail: usize,
    count: usize,
    capacity: usize,
}

impl<T> RingBuffer<T> {
    pub fn new(capacity: usize) -> Self { // TODO: implement
        let mut buffer = Vec::with_capacity(capacity);
        buffer.resize_with(capacity, || None);
        RingBuffer { buffer, head: 0, tail: 0, count: 0, capacity }
    }

    pub fn enqueue(&mut self, item: T) -> bool { // TODO: implement
        if self.count == self.capacity {
            return false;
        }
        self.buffer[self.tail] = Some(item);
        self.tail = (self.tail + 1) % self.capacity;
        self.count += 1;
        true
    }

    pub fn dequeue(&mut self) -> Option<T> { // TODO: implement
        if self.count == 0 {
            return None;
        }
        let item = self.buffer[self.head].take();
        self.head = (self.head + 1) % self.capacity;
        self.count -= 1;
        item
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize { // TODO: implement
        self.count
    }

    #[allow(dead_code)]
    pub fn is_full(&self) -> bool { // TODO: implement
        self.count == self.capacity
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enqueue_dequeue() {
        let mut rb = RingBuffer::new(3);
        assert!(rb.enqueue(1));
        assert!(rb.enqueue(2));
        assert!(rb.enqueue(3));
        assert!(!rb.enqueue(4));

        assert_eq!(rb.dequeue(), Some(1));
        assert_eq!(rb.dequeue(), Some(2));
        assert_eq!(rb.dequeue(), Some(3));
        assert_eq!(rb.dequeue(), None);
    }

    #[test]
    fn test_wrap_around() {
        let mut rb = RingBuffer::new(2);
        rb.enqueue("a");
        rb.enqueue("b");
        rb.dequeue();
        rb.enqueue("c");

        assert_eq!(rb.dequeue(), Some("b"));
        assert_eq!(rb.dequeue(), Some("c"));
    }

    #[test]
    fn test_empty() {
        let rb: RingBuffer<i32> = RingBuffer::new(4);
        assert_eq!(rb.len(), 0);
        assert!(!rb.is_full());
    }

    #[test]
    fn test_full_cycle() {
        let mut rb = RingBuffer::new(3);
        for round in 0..5 {
            for i in 0..3 {
                assert!(rb.enqueue(round * 3 + i));
            }
            for i in 0..3 {
                assert_eq!(rb.dequeue(), Some(round * 3 + i));
            }
        }
    }
}
