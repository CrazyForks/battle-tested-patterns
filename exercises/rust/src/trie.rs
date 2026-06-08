use std::collections::BTreeMap;

struct TrieNode {
    children: BTreeMap<u8, TrieNode>,
    is_end: bool,
}

pub struct Trie {
    root: TrieNode,
}

impl TrieNode {
    fn new() -> Self { // TODO: implement
        TrieNode { children: BTreeMap::new(), is_end: false }
    }
}

impl Trie {
    pub fn new() -> Self { // TODO: implement
        Trie { root: TrieNode::new() }
    }

    pub fn insert(&mut self, word: &str) { // TODO: implement
        let mut node = &mut self.root;
        for &b in word.as_bytes() {
            node = node.children.entry(b).or_insert_with(TrieNode::new);
        }
        node.is_end = true;
    }

    pub fn search(&self, word: &str) -> bool { // TODO: implement
        let mut node = &self.root;
        for &b in word.as_bytes() {
            match node.children.get(&b) {
                Some(child) => node = child,
                None => return false,
            }
        }
        node.is_end
    }

    pub fn starts_with(&self, prefix: &str) -> bool { // TODO: implement
        let mut node = &self.root;
        for &b in prefix.as_bytes() {
            match node.children.get(&b) {
                Some(child) => node = child,
                None => return false,
            }
        }
        true
    }

    pub fn autocomplete(&self, prefix: &str) -> Vec<String> { // TODO: implement
        let mut node = &self.root;
        for &b in prefix.as_bytes() {
            match node.children.get(&b) {
                Some(child) => node = child,
                None => return vec![],
            }
        }
        let mut results = vec![];
        Self::collect_words(node, prefix.to_string(), &mut results);
        results
    }

    fn collect_words(node: &TrieNode, prefix: String, results: &mut Vec<String>) { // TODO: implement
        if node.is_end {
            results.push(prefix.clone());
        }
        for (&ch, child) in &node.children {
            let mut next_prefix = prefix.clone();
            next_prefix.push(ch as char);
            Self::collect_words(child, next_prefix, results);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_insert_and_search() {
        let mut t = Trie::new();
        t.insert("apple");
        t.insert("app");
        assert!(t.search("apple"));
        assert!(t.search("app"));
        assert!(!t.search("ap"));
    }

    #[test]
    fn test_starts_with() {
        let mut t = Trie::new();
        t.insert("hello");
        assert!(t.starts_with("hel"));
        assert!(!t.starts_with("world"));
    }

    #[test]
    fn test_autocomplete() {
        let mut t = Trie::new();
        t.insert("car");
        t.insert("card");
        t.insert("care");
        t.insert("careful");
        t.insert("dog");

        let results = t.autocomplete("car");
        assert_eq!(results, vec!["car", "card", "care", "careful"]);
    }

    #[test]
    fn test_empty() {
        let t = Trie::new();
        assert!(!t.search("anything"));
    }
}
