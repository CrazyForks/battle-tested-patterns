/// Min Heap pattern — Rust idiomatic implementation.
/// Placeholder for future implementation.

pub struct MinHeap<T: Ord> {
    data: Vec<T>,
}

impl<T: Ord> MinHeap<T> {
    pub fn new() -> Self { // TODO: implement
        MinHeap { data: Vec::new() }
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize { // TODO: implement
        self.data.len()
    }

    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool { // TODO: implement
        self.data.is_empty()
    }

    pub fn peek(&self) -> Option<&T> { // TODO: implement
        self.data.first()
    }

    pub fn push(&mut self, val: T) { // TODO: implement
        self.data.push(val);
        self.sift_up(self.data.len() - 1);
    }

    pub fn pop(&mut self) -> Option<T> { // TODO: implement
        if self.data.is_empty() {
            return None;
        }
        let last = self.data.len() - 1;
        self.data.swap(0, last);
        let val = self.data.pop();
        if !self.data.is_empty() {
            self.sift_down(0);
        }
        val
    }

    fn sift_up(&mut self, mut idx: usize) { // TODO: implement
        while idx > 0 {
            let parent = (idx - 1) / 2;
            if self.data[idx] < self.data[parent] {
                self.data.swap(idx, parent);
                idx = parent;
            } else {
                break;
            }
        }
    }

    fn sift_down(&mut self, mut idx: usize) { // TODO: implement
        let len = self.data.len();
        loop {
            let left = 2 * idx + 1;
            let right = 2 * idx + 2;
            let mut smallest = idx;

            if left < len && self.data[left] < self.data[smallest] {
                smallest = left;
            }
            if right < len && self.data[right] < self.data[smallest] {
                smallest = right;
            }
            if smallest != idx {
                self.data.swap(idx, smallest);
                idx = smallest;
            } else {
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_push_and_peek() {
        let mut heap = MinHeap::new();
        heap.push(5);
        heap.push(3);
        heap.push(7);
        assert_eq!(heap.peek(), Some(&3));
    }

    #[test]
    fn test_pop_order() {
        let mut heap = MinHeap::new();
        heap.push(5);
        heap.push(1);
        heap.push(3);
        heap.push(2);
        heap.push(4);

        assert_eq!(heap.pop(), Some(1));
        assert_eq!(heap.pop(), Some(2));
        assert_eq!(heap.pop(), Some(3));
        assert_eq!(heap.pop(), Some(4));
        assert_eq!(heap.pop(), Some(5));
        assert_eq!(heap.pop(), None);
    }

    #[test]
    fn test_empty_heap() {
        let mut heap: MinHeap<i32> = MinHeap::new();
        assert!(heap.is_empty());
        assert_eq!(heap.pop(), None);
        assert_eq!(heap.peek(), None);
    }
}
