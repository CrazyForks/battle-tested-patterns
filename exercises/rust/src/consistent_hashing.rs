use std::collections::{BTreeMap, HashMap};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub struct HashRing {
    ring: BTreeMap<u64, String>,
    replicas: usize,
    #[allow(dead_code)]
    nodes: HashMap<String, Vec<u64>>,
}

fn hash_key(key: &str) -> u64 { // TODO: implement
    let mut h = DefaultHasher::new();
    key.hash(&mut h);
    h.finish()
}

impl HashRing {
    pub fn new(replicas: usize) -> Self { // TODO: implement
        HashRing {
            ring: BTreeMap::new(),
            replicas,
            nodes: HashMap::new(),
        }
    }

    pub fn add_node(&mut self, node: &str) { // TODO: implement
        let mut hashes = vec![];
        for i in 0..self.replicas {
            let vkey = format!("{}#{}", node, i);
            let h = hash_key(&vkey);
            self.ring.insert(h, node.to_string());
            hashes.push(h);
        }
        self.nodes.insert(node.to_string(), hashes);
    }

    pub fn remove_node(&mut self, node: &str) { // TODO: implement
        if let Some(hashes) = self.nodes.remove(node) {
            for h in hashes {
                self.ring.remove(&h);
            }
        }
    }

    pub fn get_node(&self, key: &str) -> Option<&str> { // TODO: implement
        if self.ring.is_empty() {
            return None;
        }
        let h = hash_key(key);
        let node = self.ring.range(h..).next()
            .or_else(|| self.ring.iter().next())
            .map(|(_, v)| v.as_str());
        node
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic() {
        let mut hr = HashRing::new(3);
        hr.add_node("server-a");
        hr.add_node("server-b");
        hr.add_node("server-c");
        assert!(hr.get_node("my-key").is_some());
    }

    #[test]
    fn test_consistency() {
        let mut hr = HashRing::new(50);
        hr.add_node("server-a");
        hr.add_node("server-b");
        hr.add_node("server-c");

        let keys = ["user:1", "user:2", "user:3", "session:abc", "order:999"];
        let results: Vec<_> = keys.iter().map(|k| hr.get_node(k).unwrap().to_string()).collect();

        for (i, k) in keys.iter().enumerate() {
            assert_eq!(hr.get_node(k).unwrap(), results[i], "inconsistent mapping for {}", k);
        }
    }

    #[test]
    fn test_minimal_disruption() {
        let mut hr = HashRing::new(50);
        hr.add_node("server-a");
        hr.add_node("server-b");

        let keys: Vec<String> = (0..100).map(|i| format!("key-{}", i)).collect();
        let before: Vec<_> = keys.iter().map(|k| hr.get_node(k).unwrap().to_string()).collect();

        hr.add_node("server-c");
        let moved = keys.iter().enumerate()
            .filter(|(i, k)| hr.get_node(k).unwrap() != before[*i])
            .count();

        assert!(moved < keys.len(), "adding a node should not remap all keys");
    }

    #[test]
    fn test_remove_node() {
        let mut hr = HashRing::new(10);
        hr.add_node("server-a");
        hr.add_node("server-b");
        hr.remove_node("server-a");

        for k in ["k1", "k2", "k3"] {
            assert_eq!(hr.get_node(k).unwrap(), "server-b");
        }
    }
}
