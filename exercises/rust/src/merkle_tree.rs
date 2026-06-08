use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

fn hash_leaf(data: &str) -> u64 { // TODO: implement
    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    hasher.finish()
}

fn hash_pair(a: u64, b: u64) -> u64 { // TODO: implement
    let mut hasher = DefaultHasher::new();
    a.hash(&mut hasher);
    b.hash(&mut hasher);
    hasher.finish()
}

struct MerkleTree {
    root: u64,
    leaves: Vec<u64>,
    layers: Vec<Vec<u64>>,
}

impl MerkleTree {
    fn build(data: &[&str]) -> Self { // TODO: implement
        if data.is_empty() {
            return Self {
                root: 0,
                leaves: Vec::new(),
                layers: Vec::new(),
            };
        }

        let leaves: Vec<u64> = data.iter().map(|d| hash_leaf(d)).collect();
        let mut layers = vec![leaves.clone()];
        let mut current = leaves.clone();

        while current.len() > 1 {
            let mut next = Vec::new();
            let mut i = 0;
            while i < current.len() {
                if i + 1 < current.len() {
                    next.push(hash_pair(current[i], current[i + 1]));
                } else {
                    next.push(current[i]);
                }
                i += 2;
            }
            layers.push(next.clone());
            current = next;
        }

        Self {
            root: current[0],
            leaves,
            layers,
        }
    }

    fn root(&self) -> u64 { // TODO: implement
        self.root
    }

    fn leaf_count(&self) -> usize { // TODO: implement
        self.leaves.len()
    }

    #[allow(dead_code)]
    fn depth(&self) -> usize { // TODO: implement
        self.layers.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_root() {
        let tree = MerkleTree::build(&["a", "b", "c", "d"]);
        assert_ne!(tree.root(), 0);
        assert_eq!(tree.leaf_count(), 4);
    }

    #[test]
    fn test_deterministic() {
        let t1 = MerkleTree::build(&["x", "y", "z"]);
        let t2 = MerkleTree::build(&["x", "y", "z"]);
        assert_eq!(t1.root(), t2.root());
    }

    #[test]
    fn test_change_sensitivity() {
        let t1 = MerkleTree::build(&["a", "b", "c"]);
        let t2 = MerkleTree::build(&["a", "b", "d"]);
        assert_ne!(t1.root(), t2.root());
    }

    #[test]
    fn test_single_element() {
        let tree = MerkleTree::build(&["only"]);
        let expected = hash_leaf("only");
        assert_eq!(tree.root(), expected);
    }
}
