use std::collections::HashMap;

struct Registry {
    handlers: HashMap<String, Box<dyn Fn(&str) -> String>>,
}

impl Registry {
    fn new() -> Self { // TODO: implement
        Self {
            handlers: HashMap::new(),
        }
    }

    fn register( // TODO: implement
        &mut self,
        name: &str,
        handler: impl Fn(&str) -> String + 'static,
    ) -> Result<(), String> {
        if self.handlers.contains_key(name) {
            return Err(format!("handler {:?} already registered", name));
        }
        self.handlers.insert(name.to_string(), Box::new(handler));
        Ok(())
    }

    fn get(&self, name: &str) -> Option<&dyn Fn(&str) -> String> { // TODO: implement
        self.handlers.get(name).map(|h| h.as_ref())
    }

    fn len(&self) -> usize { // TODO: implement
        self.handlers.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_and_get() {
        let mut r = Registry::new();
        r.register("json", |data| format!("{{{:?}}}", data))
            .unwrap();

        let h = r.get("json").unwrap();
        let result = h("test");
        assert!(result.contains("test"));
    }

    #[test]
    fn test_duplicate() {
        let mut r = Registry::new();
        r.register("xml", |data| data.to_string()).unwrap();
        assert!(r.register("xml", |data| data.to_string()).is_err());
    }

    #[test]
    fn test_missing() {
        let r = Registry::new();
        assert!(r.get("nonexistent").is_none());
    }

    #[test]
    fn test_multiple() {
        let mut r = Registry::new();
        r.register("a", |d| format!("a:{}", d)).unwrap();
        r.register("b", |d| format!("b:{}", d)).unwrap();
        r.register("c", |d| format!("c:{}", d)).unwrap();

        assert_eq!(r.len(), 3);
        let h = r.get("b").unwrap();
        assert_eq!(h("x"), "b:x");
    }
}
