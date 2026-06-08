use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, PartialEq)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

pub struct ColorFactory {
    cache: HashMap<String, Arc<Color>>,
}

impl ColorFactory {
    pub fn new() -> Self { // TODO: implement
        ColorFactory { cache: HashMap::new() }
    }

    pub fn get(&mut self, name: &str) -> Arc<Color> { // TODO: implement
        if let Some(c) = self.cache.get(name) {
            return c.clone();
        }
        let color = match name {
            "red" => Color { r: 255, g: 0, b: 0 },
            "green" => Color { r: 0, g: 255, b: 0 },
            "blue" => Color { r: 0, g: 0, b: 255 },
            _ => Color { r: 0, g: 0, b: 0 },
        };
        let arc = Arc::new(color);
        self.cache.insert(name.to_string(), arc.clone());
        arc
    }

    #[allow(dead_code)]
    pub fn cache_size(&self) -> usize { // TODO: implement
        self.cache.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shared_instance() {
        let mut f = ColorFactory::new();
        let r1 = f.get("red");
        let r2 = f.get("red");
        assert!(Arc::ptr_eq(&r1, &r2));
    }

    #[test]
    fn test_different_instances() {
        let mut f = ColorFactory::new();
        let r = f.get("red");
        let g = f.get("green");
        assert!(!Arc::ptr_eq(&r, &g));
    }

    #[test]
    fn test_correct_values() {
        let mut f = ColorFactory::new();
        let r = f.get("red");
        assert_eq!(*r, Color { r: 255, g: 0, b: 0 });
    }

    #[test]
    fn test_memory_saving() {
        let mut f = ColorFactory::new();
        for _ in 0..1000 {
            f.get("blue");
        }
        assert_eq!(f.cache_size(), 1);
    }
}
