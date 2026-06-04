pub struct Transform {
    x: f64,
    y: f64,
    dirty: bool,
    cached: String,
}

impl Transform {
    pub fn new(x: f64, y: f64) -> Self {
        Transform { x, y, dirty: true, cached: String::new() }
    }

    pub fn set_position(&mut self, x: f64, y: f64) {
        if (self.x - x).abs() > f64::EPSILON || (self.y - y).abs() > f64::EPSILON {
            self.x = x;
            self.y = y;
            self.dirty = true;
        }
    }

    pub fn world_matrix(&mut self) -> &str {
        if self.dirty {
            self.cached = ".".repeat((self.x + self.y) as usize);
            self.dirty = false;
        }
        &self.cached
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initially_dirty() {
        let t = Transform::new(1.0, 2.0);
        assert!(t.is_dirty());
    }

    #[test]
    fn test_cleared_after_compute() {
        let mut t = Transform::new(1.0, 2.0);
        t.world_matrix();
        assert!(!t.is_dirty());
    }

    #[test]
    fn test_set_on_change() {
        let mut t = Transform::new(1.0, 2.0);
        t.world_matrix();
        t.set_position(5.0, 6.0);
        assert!(t.is_dirty());
    }

    #[test]
    fn test_no_redundant_dirty() {
        let mut t = Transform::new(1.0, 2.0);
        t.world_matrix();
        t.set_position(1.0, 2.0);
        assert!(!t.is_dirty());
    }

    #[test]
    fn test_cache_reuse() {
        let mut t = Transform::new(3.0, 0.0);
        let r1 = t.world_matrix().to_string();
        let r2 = t.world_matrix().to_string();
        assert_eq!(r1, r2);
    }
}
