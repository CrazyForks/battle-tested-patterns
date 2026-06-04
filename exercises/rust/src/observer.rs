pub struct EventBus {
    listeners: std::collections::HashMap<String, Vec<usize>>,
    logs: Vec<Vec<String>>,
}

impl EventBus {
    pub fn new() -> Self {
        EventBus {
            listeners: std::collections::HashMap::new(),
            logs: Vec::new(),
        }
    }

    pub fn add_listener(&mut self) -> usize {
        let id = self.logs.len();
        self.logs.push(Vec::new());
        id
    }

    pub fn subscribe(&mut self, event: &str, listener_id: usize) {
        self.listeners.entry(event.to_string()).or_default().push(listener_id);
    }

    pub fn publish(&mut self, event: &str) {
        if let Some(ids) = self.listeners.get(event).cloned() {
            for id in ids {
                self.logs[id].push(event.to_string());
            }
        }
    }

    pub fn events_for(&self, listener_id: usize) -> &[String] {
        &self.logs[listener_id]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_receives_events() {
        let mut bus = EventBus::new();
        let id = bus.add_listener();
        bus.subscribe("click", id);
        bus.publish("click");
        bus.publish("click");
        assert_eq!(bus.events_for(id).len(), 2);
    }

    #[test]
    fn test_multiple_subscribers() {
        let mut bus = EventBus::new();
        let id1 = bus.add_listener();
        let id2 = bus.add_listener();
        bus.subscribe("resize", id1);
        bus.subscribe("resize", id2);
        bus.publish("resize");
        assert_eq!(bus.events_for(id1).len(), 1);
        assert_eq!(bus.events_for(id2).len(), 1);
    }

    #[test]
    fn test_no_false_notifications() {
        let mut bus = EventBus::new();
        let id = bus.add_listener();
        bus.subscribe("click", id);
        bus.publish("scroll");
        assert!(bus.events_for(id).is_empty());
    }
}
