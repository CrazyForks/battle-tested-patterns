use std::collections::HashMap;

struct Version {
    value: String,
    timestamp: u64,
    deleted: bool,
}

struct MVCCStore {
    data: HashMap<String, Vec<Version>>,
    clock: u64,
}

impl MVCCStore {
    fn new() -> Self { // TODO: implement
        Self {
            data: HashMap::new(),
            clock: 0,
        }
    }

    fn put(&mut self, key: &str, value: &str) -> u64 { // TODO: implement
        self.clock += 1;
        self.data
            .entry(key.to_string())
            .or_default()
            .push(Version {
                value: value.to_string(),
                timestamp: self.clock,
                deleted: false,
            });
        self.clock
    }

    fn get(&self, key: &str, as_of: u64) -> Option<&str> { // TODO: implement
        let versions = self.data.get(key)?;
        for v in versions.iter().rev() {
            if v.timestamp <= as_of {
                if v.deleted {
                    return None;
                }
                return Some(&v.value);
            }
        }
        None
    }

    fn delete(&mut self, key: &str) -> u64 { // TODO: implement
        self.clock += 1;
        self.data
            .entry(key.to_string())
            .or_default()
            .push(Version {
                value: String::new(),
                timestamp: self.clock,
                deleted: true,
            });
        self.clock
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic() {
        let mut s = MVCCStore::new();
        let ts = s.put("key", "v1");
        assert_eq!(s.get("key", ts), Some("v1"));
    }

    #[test]
    fn test_time_travel() {
        let mut s = MVCCStore::new();
        let ts1 = s.put("key", "v1");
        let ts2 = s.put("key", "v2");
        let _ = s.put("key", "v3");

        assert_eq!(s.get("key", ts1), Some("v1"));
        assert_eq!(s.get("key", ts2), Some("v2"));
    }

    #[test]
    fn test_delete() {
        let mut s = MVCCStore::new();
        let ts1 = s.put("key", "alive");
        let ts_d = s.delete("key");

        assert_eq!(s.get("key", ts_d), None);
        assert_eq!(s.get("key", ts1), Some("alive"));
    }

    #[test]
    fn test_future() {
        let mut s = MVCCStore::new();
        s.put("key", "v1");
        assert_eq!(s.get("key", 0), None);
    }
}
