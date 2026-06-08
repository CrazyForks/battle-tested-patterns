use std::collections::{BTreeSet, HashMap};

struct LSMTree {
    mem_table: HashMap<String, String>,
    threshold: usize,
    sstables: Vec<HashMap<String, String>>,
}

impl LSMTree {
    fn new(threshold: usize) -> Self { // TODO: implement
        Self {
            mem_table: HashMap::new(),
            threshold,
            sstables: Vec::new(),
        }
    }

    fn put(&mut self, key: &str, value: &str) { // TODO: implement
        self.mem_table.insert(key.to_string(), value.to_string());
        if self.mem_table.len() >= self.threshold {
            self.flush();
        }
    }

    fn flush(&mut self) { // TODO: implement
        if self.mem_table.is_empty() {
            return;
        }
        let frozen = std::mem::take(&mut self.mem_table);
        self.sstables.push(frozen);
    }

    fn get(&self, key: &str) -> Option<&str> { // TODO: implement
        if let Some(v) = self.mem_table.get(key) {
            return Some(v);
        }
        for sst in self.sstables.iter().rev() {
            if let Some(v) = sst.get(key) {
                return Some(v);
            }
        }
        None
    }

    fn sst_count(&self) -> usize { // TODO: implement
        self.sstables.len()
    }

    #[allow(dead_code)]
    fn all_keys(&self) -> Vec<String> { // TODO: implement
        let mut seen = BTreeSet::new();
        for k in self.mem_table.keys() {
            seen.insert(k.clone());
        }
        for sst in &self.sstables {
            for k in sst.keys() {
                seen.insert(k.clone());
            }
        }
        seen.into_iter().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_put_get() {
        let mut l = LSMTree::new(10);
        l.put("foo", "bar");
        l.put("baz", "qux");
        assert_eq!(l.get("foo"), Some("bar"));
    }

    #[test]
    fn test_auto_flush() {
        let mut l = LSMTree::new(3);
        l.put("a", "1");
        l.put("b", "2");
        l.put("c", "3");
        assert_eq!(l.sst_count(), 1);
        assert_eq!(l.get("a"), Some("1"));
    }

    #[test]
    fn test_overwrite() {
        let mut l = LSMTree::new(10);
        l.put("key", "old");
        l.flush();
        l.put("key", "new");
        assert_eq!(l.get("key"), Some("new"));
    }

    #[test]
    fn test_missing() {
        let mut l = LSMTree::new(10);
        l.put("a", "1");
        assert_eq!(l.get("z"), None);
    }
}
