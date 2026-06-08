struct BPlusLeaf {
    keys: Vec<i32>,
    values: Vec<String>,
}

struct BPlusTree {
    order: usize,
    leaves: Vec<BPlusLeaf>,
}

impl BPlusTree {
    fn new(order: usize) -> Self { // TODO: implement
        Self {
            order,
            leaves: vec![BPlusLeaf {
                keys: Vec::new(),
                values: Vec::new(),
            }],
        }
    }

    fn find_leaf_idx(&self, key: i32) -> usize { // TODO: implement
        for (i, leaf) in self.leaves.iter().enumerate() {
            if leaf.keys.is_empty() || key <= *leaf.keys.last().unwrap() {
                return i;
            }
        }
        self.leaves.len() - 1
    }

    fn insert(&mut self, key: i32, value: &str) { // TODO: implement
        let leaf_idx = self.find_leaf_idx(key);
        let leaf = &mut self.leaves[leaf_idx];

        // Update existing
        if let Some(pos) = leaf.keys.iter().position(|&k| k == key) {
            leaf.values[pos] = value.to_string();
            return;
        }

        // Insert sorted
        let pos = leaf.keys.partition_point(|&k| k < key);
        leaf.keys.insert(pos, key);
        leaf.values.insert(pos, value.to_string());

        // Split if full
        if leaf.keys.len() > self.order {
            let mid = leaf.keys.len() / 2;
            let new_leaf = BPlusLeaf {
                keys: leaf.keys[mid..].to_vec(),
                values: leaf.values[mid..].to_vec(),
            };
            leaf.keys.truncate(mid);
            leaf.values.truncate(mid);
            self.leaves.insert(leaf_idx + 1, new_leaf);
        }
    }

    fn search(&self, key: i32) -> Option<&str> { // TODO: implement
        for leaf in &self.leaves {
            if let Some(pos) = leaf.keys.iter().position(|&k| k == key) {
                return Some(&leaf.values[pos]);
            }
        }
        None
    }

    fn range_scan(&self, low: i32, high: i32) -> Vec<&str> { // TODO: implement
        let mut result = Vec::new();
        for leaf in &self.leaves {
            for (i, &k) in leaf.keys.iter().enumerate() {
                if k >= low && k <= high {
                    result.push(leaf.values[i].as_str());
                }
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_insert_and_search() {
        let mut tree = BPlusTree::new(3);
        tree.insert(5, "five");
        tree.insert(3, "three");
        tree.insert(7, "seven");
        tree.insert(1, "one");

        assert_eq!(tree.search(3), Some("three"));
        assert_eq!(tree.search(99), None);
    }

    #[test]
    fn test_range_scan() {
        let mut tree = BPlusTree::new(4);
        for i in 1..=10 {
            tree.insert(i, "v");
        }
        let result = tree.range_scan(3, 6);
        assert_eq!(result.len(), 4);
    }

    #[test]
    fn test_update() {
        let mut tree = BPlusTree::new(3);
        tree.insert(1, "old");
        tree.insert(1, "new");
        assert_eq!(tree.search(1), Some("new"));
    }

    #[test]
    fn test_split() {
        let mut tree = BPlusTree::new(3);
        for i in 1..=10 {
            tree.insert(i, "v");
        }
        for i in 1..=10 {
            assert!(tree.search(i).is_some(), "key {} should exist", i);
        }
    }
}
