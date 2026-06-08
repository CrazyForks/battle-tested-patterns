use std::collections::VecDeque;
use std::sync::Mutex;

struct WorkQueue {
    items: Mutex<VecDeque<i32>>,
}

impl WorkQueue {
    fn new() -> Self { // TODO: implement
        Self {
            items: Mutex::new(VecDeque::new()),
        }
    }

    fn push(&self, item: i32) { // TODO: implement
        self.items.lock().unwrap().push_back(item);
    }

    fn pop(&self) -> Option<i32> { // TODO: implement
        self.items.lock().unwrap().pop_back() // LIFO
    }

    fn steal(&self) -> Option<i32> { // TODO: implement
        self.items.lock().unwrap().pop_front() // FIFO
    }

    #[allow(dead_code)]
    fn len(&self) -> usize { // TODO: implement
        self.items.lock().unwrap().len()
    }
}

struct WorkStealingPool {
    queues: Vec<WorkQueue>,
}

impl WorkStealingPool {
    fn new(workers: usize) -> Self { // TODO: implement
        let queues = (0..workers).map(|_| WorkQueue::new()).collect();
        Self { queues }
    }

    fn submit(&self, worker: usize, item: i32) { // TODO: implement
        self.queues[worker].push(item);
    }

    fn process(&self, worker: usize) -> Option<i32> { // TODO: implement
        if let Some(item) = self.queues[worker].pop() {
            return Some(item);
        }
        for (i, q) in self.queues.iter().enumerate() {
            if i != worker {
                if let Some(item) = q.steal() {
                    return Some(item);
                }
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_own_queue() {
        let pool = WorkStealingPool::new(2);
        pool.submit(0, 10);
        pool.submit(0, 20);

        let item = pool.process(0).unwrap();
        assert_eq!(item, 20); // LIFO
    }

    #[test]
    fn test_steals() {
        let pool = WorkStealingPool::new(2);
        pool.submit(0, 10);
        pool.submit(0, 20);

        let item = pool.process(1).unwrap();
        assert_eq!(item, 10); // FIFO steal
    }

    #[test]
    fn test_empty() {
        let pool = WorkStealingPool::new(3);
        assert!(pool.process(0).is_none());
    }

    #[test]
    fn test_fairness() {
        let pool = WorkStealingPool::new(2);
        for i in 1..=10 {
            pool.submit(0, i);
        }

        let mut stolen = Vec::new();
        while let Some(item) = pool.process(1) {
            stolen.push(item);
        }
        assert_eq!(stolen.len(), 10);
    }
}
