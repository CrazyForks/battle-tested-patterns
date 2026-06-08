use std::collections::HashMap;

struct Entry {
    key: String,
    value: i32,
    prev: usize,
    next: usize,
}

pub struct LRUCache {
    capacity: usize,
    entries: Vec<Entry>,
    map: HashMap<String, usize>,
    head: usize,
    tail: usize,
}

impl LRUCache {
    pub fn new(capacity: usize) -> Self { // TODO: implement
        let mut entries = Vec::with_capacity(capacity + 2);
        entries.push(Entry { key: String::new(), value: 0, prev: 0, next: 1 }); // sentinel head
        entries.push(Entry { key: String::new(), value: 0, prev: 0, next: 1 }); // sentinel tail
        LRUCache { capacity, entries, map: HashMap::new(), head: 0, tail: 1 }
    }

    fn remove(&mut self, idx: usize) { // TODO: implement
        let prev = self.entries[idx].prev;
        let next = self.entries[idx].next;
        self.entries[prev].next = next;
        self.entries[next].prev = prev;
    }

    fn push_front(&mut self, idx: usize) { // TODO: implement
        let first = self.entries[self.head].next;
        self.entries[idx].next = first;
        self.entries[idx].prev = self.head;
        self.entries[first].prev = idx;
        self.entries[self.head].next = idx;
    }

    pub fn get(&mut self, key: &str) -> Option<i32> { // TODO: implement
        let idx = *self.map.get(key)?;
        self.remove(idx);
        self.push_front(idx);
        Some(self.entries[idx].value)
    }

    pub fn put(&mut self, key: &str, value: i32) { // TODO: implement
        if let Some(&idx) = self.map.get(key) {
            self.entries[idx].value = value;
            self.remove(idx);
            self.push_front(idx);
            return;
        }
        if self.map.len() == self.capacity {
            let evict = self.entries[self.tail].prev;
            self.remove(evict);
            let evict_key = self.entries[evict].key.clone();
            self.map.remove(&evict_key);
            self.entries[evict].key = key.to_string();
            self.entries[evict].value = value;
            self.push_front(evict);
            self.map.insert(key.to_string(), evict);
        } else {
            let idx = self.entries.len();
            self.entries.push(Entry {
                key: key.to_string(),
                value,
                prev: 0,
                next: 0,
            });
            self.push_front(idx);
            self.map.insert(key.to_string(), idx);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic() {
        let mut c = LRUCache::new(2);
        c.put("a", 1);
        c.put("b", 2);
        assert_eq!(c.get("a"), Some(1));
        c.put("c", 3); // evicts "b"
        assert_eq!(c.get("b"), None);
    }

    #[test]
    fn test_update() {
        let mut c = LRUCache::new(2);
        c.put("a", 1);
        c.put("b", 2);
        c.put("a", 10);
        c.put("c", 3); // evicts "b"
        assert_eq!(c.get("a"), Some(10));
        assert_eq!(c.get("b"), None);
    }

    #[test]
    fn test_access_order() {
        let mut c = LRUCache::new(3);
        c.put("a", 1);
        c.put("b", 2);
        c.put("c", 3);
        c.get("a"); // promotes "a"
        c.put("d", 4); // evicts "b"
        assert_eq!(c.get("b"), None);
        assert_eq!(c.get("a"), Some(1));
    }
}
