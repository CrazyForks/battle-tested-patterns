use std::collections::VecDeque;

pub struct Actor<M, S> {
    state: S,
    mailbox: VecDeque<M>,
}

impl<M, S> Actor<M, S> {
    pub fn new(initial_state: S) -> Self {
        Actor { state: initial_state, mailbox: VecDeque::new() }
    }

    pub fn send(&mut self, msg: M) {
        self.mailbox.push_back(msg);
    }

    pub fn process<F>(&mut self, handler: F)
    where F: Fn(&S, M) -> S {
        while let Some(msg) = self.mailbox.pop_front() {
            self.state = handler(&self.state, msg);
        }
    }

    pub fn state(&self) -> &S {
        &self.state
    }
}
