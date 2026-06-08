const MAX_LEVEL: usize = 4;

struct SkipNode {
    key: i32,
    value: String,
    next: Vec<Option<usize>>,
}

pub struct SkipList {
    nodes: Vec<SkipNode>,
    head: usize,
    level: usize,
    seed: u64,
}

impl SkipList {
    pub fn new() -> Self { // TODO: implement
        let head_node = SkipNode {
            key: i32::MIN,
            value: String::new(),
            next: vec![None; MAX_LEVEL],
        };
        SkipList {
            nodes: vec![head_node],
            head: 0,
            level: 0,
            seed: 42,
        }
    }

    fn random_level(&mut self) -> usize { // TODO: implement
        let mut lvl = 0;
        while lvl < MAX_LEVEL - 1 {
            self.seed ^= self.seed << 13;
            self.seed ^= self.seed >> 7;
            self.seed ^= self.seed << 17;
            if self.seed % 2 == 0 {
                lvl += 1;
            } else {
                break;
            }
        }
        lvl
    }

    pub fn insert(&mut self, key: i32, value: &str) { // TODO: implement
        let mut update = [0usize; MAX_LEVEL];
        let mut cur = self.head;

        for i in (0..=self.level).rev() {
            while let Some(next_idx) = self.nodes[cur].next[i] {
                if self.nodes[next_idx].key < key {
                    cur = next_idx;
                } else {
                    break;
                }
            }
            update[i] = cur;
        }

        if let Some(next_idx) = self.nodes[cur].next[0] {
            if self.nodes[next_idx].key == key {
                self.nodes[next_idx].value = value.to_string();
                return;
            }
        }

        let lvl = self.random_level();
        if lvl > self.level {
            for i in (self.level + 1)..=lvl {
                update[i] = self.head;
            }
            self.level = lvl;
        }

        let new_idx = self.nodes.len();
        self.nodes.push(SkipNode {
            key,
            value: value.to_string(),
            next: vec![None; lvl + 1],
        });

        for i in 0..=lvl {
            self.nodes[new_idx].next[i] = self.nodes[update[i]].next[i];
            self.nodes[update[i]].next[i] = Some(new_idx);
        }
    }

    pub fn search(&self, key: i32) -> Option<&str> { // TODO: implement
        let mut cur = self.head;
        for i in (0..=self.level).rev() {
            while let Some(next_idx) = self.nodes[cur].next[i] {
                if self.nodes[next_idx].key < key {
                    cur = next_idx;
                } else {
                    break;
                }
            }
        }
        if let Some(next_idx) = self.nodes[cur].next[0] {
            if self.nodes[next_idx].key == key {
                return Some(&self.nodes[next_idx].value);
            }
        }
        None
    }

    pub fn delete(&mut self, key: i32) -> bool { // TODO: implement
        let mut update = [0usize; MAX_LEVEL];
        let mut cur = self.head;

        for i in (0..=self.level).rev() {
            while let Some(next_idx) = self.nodes[cur].next[i] {
                if self.nodes[next_idx].key < key {
                    cur = next_idx;
                } else {
                    break;
                }
            }
            update[i] = cur;
        }

        let target = match self.nodes[cur].next[0] {
            Some(idx) if self.nodes[idx].key == key => idx,
            _ => return false,
        };

        for i in 0..=self.level {
            if self.nodes[update[i]].next[i] != Some(target) {
                break;
            }
            self.nodes[update[i]].next[i] = self.nodes[target].next[i];
        }

        while self.level > 0 && self.nodes[self.head].next[self.level].is_none() {
            self.level -= 1;
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_insert_and_search() {
        let mut sl = SkipList::new();
        sl.insert(3, "three");
        sl.insert(1, "one");
        sl.insert(2, "two");

        assert_eq!(sl.search(2), Some("two"));
        assert_eq!(sl.search(99), None);
    }

    #[test]
    fn test_delete() {
        let mut sl = SkipList::new();
        sl.insert(1, "one");
        sl.insert(2, "two");
        sl.insert(3, "three");

        assert!(sl.delete(2));
        assert_eq!(sl.search(2), None);
        assert_eq!(sl.search(1), Some("one"));
    }

    #[test]
    fn test_update() {
        let mut sl = SkipList::new();
        sl.insert(1, "old");
        sl.insert(1, "new");
        assert_eq!(sl.search(1), Some("new"));
    }

    #[test]
    fn test_ordering() {
        let mut sl = SkipList::new();
        for k in [50, 10, 30, 20, 40] {
            sl.insert(k, "");
        }
        let mut keys = vec![];
        let mut cur = sl.head;
        while let Some(next_idx) = sl.nodes[cur].next[0] {
            keys.push(sl.nodes[next_idx].key);
            cur = next_idx;
        }
        for i in 1..keys.len() {
            assert!(keys[i] > keys[i - 1], "keys not sorted: {:?}", keys);
        }
    }
}
