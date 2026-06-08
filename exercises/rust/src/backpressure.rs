use std::collections::VecDeque;

pub struct BoundedQueue {
    buf: VecDeque<i32>,
    cap: usize,
}

impl BoundedQueue {
    pub fn new(capacity: usize) -> Self { // TODO: implement
        BoundedQueue { buf: VecDeque::with_capacity(capacity), cap: capacity }
    }

    pub fn push(&mut self, item: i32) -> Result<(), &'static str> { // TODO: implement
        if self.buf.len() >= self.cap {
            return Err("queue full: backpressure");
        }
        self.buf.push_back(item);
        Ok(())
    }

    pub fn pop(&mut self) -> Option<i32> { // TODO: implement
        self.buf.pop_front()
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize { // TODO: implement
        self.buf.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_accepts() {
        let mut q = BoundedQueue::new(3);
        for i in 0..3 {
            assert!(q.push(i).is_ok());
        }
    }

    #[test]
    fn test_rejects_when_full() {
        let mut q = BoundedQueue::new(2);
        q.push(1).unwrap();
        q.push(2).unwrap();
        assert!(q.push(3).is_err());
    }

    #[test]
    fn test_drain_then_accept() {
        let mut q = BoundedQueue::new(2);
        q.push(1).unwrap();
        q.push(2).unwrap();
        q.pop();
        assert!(q.push(3).is_ok());
    }

    #[test]
    fn test_fifo_order() {
        let mut q = BoundedQueue::new(5);
        for i in 1..=3 {
            q.push(i).unwrap();
        }
        for i in 1..=3 {
            assert_eq!(q.pop(), Some(i));
        }
    }
}
