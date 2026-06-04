use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum State {
    Idle,
    Pending,
    Approved,
    Rejected,
}

pub struct StateMachine {
    current: State,
    transitions: HashMap<(State, String), State>,
}

impl StateMachine {
    pub fn new(initial: State, transitions: Vec<(State, &str, State)>) -> Self {
        let map = transitions.into_iter()
            .map(|(from, event, to)| ((from, event.to_string()), to))
            .collect();
        StateMachine { current: initial, transitions: map }
    }

    pub fn send(&mut self, event: &str) -> Result<(), &'static str> {
        let key = (self.current.clone(), event.to_string());
        match self.transitions.get(&key) {
            Some(next) => {
                self.current = next.clone();
                Ok(())
            }
            None => Err("invalid transition"),
        }
    }

    pub fn current(&self) -> &State {
        &self.current
    }
}

fn approval_machine() -> StateMachine {
    StateMachine::new(State::Idle, vec![
        (State::Idle, "submit", State::Pending),
        (State::Pending, "approve", State::Approved),
        (State::Pending, "reject", State::Rejected),
        (State::Rejected, "resubmit", State::Pending),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_happy_path() {
        let mut sm = approval_machine();
        sm.send("submit").unwrap();
        assert_eq!(sm.current(), &State::Pending);
        sm.send("approve").unwrap();
        assert_eq!(sm.current(), &State::Approved);
    }

    #[test]
    fn test_invalid_transition() {
        let mut sm = approval_machine();
        assert!(sm.send("approve").is_err());
    }

    #[test]
    fn test_resubmit() {
        let mut sm = approval_machine();
        sm.send("submit").unwrap();
        sm.send("reject").unwrap();
        sm.send("resubmit").unwrap();
        assert_eq!(sm.current(), &State::Pending);
    }
}
