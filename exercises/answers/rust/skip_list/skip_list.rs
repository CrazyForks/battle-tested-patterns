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
    pub fn new() -> Self {
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

    fn random_level(&mut self) -> usize {
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

    pub fn insert(&mut self, key: i32, value: &str) {
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

    pub fn search(&self, key: i32) -> Option<&str> {
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

    pub fn delete(&mut self, key: i32) -> bool {
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
