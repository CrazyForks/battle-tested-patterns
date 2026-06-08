use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub struct BloomFilter {
    bits: Vec<bool>,
    size: usize,
    num_hashes: usize,
}

impl BloomFilter {
    pub fn new(size: usize, num_hashes: usize) -> Self { // TODO: implement
        BloomFilter {
            bits: vec![false; size],
            size,
            num_hashes,
        }
    }

    fn hashes(&self, item: &str) -> Vec<usize> { // TODO: implement
        let mut h1 = DefaultHasher::new();
        item.hash(&mut h1);
        let hash1 = h1.finish();

        let mut h2 = DefaultHasher::new();
        format!("{}#", item).hash(&mut h2);
        let hash2 = h2.finish();

        (0..self.num_hashes)
            .map(|i| ((hash1.wrapping_add((i as u64).wrapping_mul(hash2))) % self.size as u64) as usize)
            .collect()
    }

    pub fn add(&mut self, item: &str) { // TODO: implement
        for idx in self.hashes(item) {
            self.bits[idx] = true;
        }
    }

    pub fn may_contain(&self, item: &str) -> bool { // TODO: implement
        self.hashes(item).iter().all(|&idx| self.bits[idx])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_and_check() {
        let mut bf = BloomFilter::new(1024, 3);
        bf.add("hello");
        bf.add("world");
        assert!(bf.may_contain("hello"));
        assert!(bf.may_contain("world"));
    }

    #[test]
    fn test_no_false_negatives() {
        let mut bf = BloomFilter::new(4096, 5);
        let items = ["alpha", "beta", "gamma", "delta", "epsilon"];
        for item in &items {
            bf.add(item);
        }
        for item in &items {
            assert!(bf.may_contain(item), "false negative for {}", item);
        }
    }

    #[test]
    fn test_probably_absent() {
        let mut bf = BloomFilter::new(4096, 5);
        bf.add("present");
        let absent = ["absent1", "absent2", "absent3", "missing", "nope"];
        let false_positives: usize = absent.iter().filter(|&&item| bf.may_contain(item)).count();
        assert!(false_positives < absent.len(), "all absent items reported present — filter broken");
    }
}
