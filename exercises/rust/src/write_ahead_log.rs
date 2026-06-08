#[allow(dead_code)]
pub struct WALEntry {
    pub lsn: usize,
    pub op: String,
    pub data: String,
}

pub struct WAL {
    log: Vec<WALEntry>,
    next_lsn: usize,
    committed: Option<usize>,
}

impl WAL {
    pub fn new() -> Self { // TODO: implement
        WAL { log: Vec::new(), next_lsn: 0, committed: None }
    }

    pub fn append(&mut self, op: &str, data: &str) -> usize { // TODO: implement
        let lsn = self.next_lsn;
        self.log.push(WALEntry {
            lsn,
            op: op.to_string(),
            data: data.to_string(),
        });
        self.next_lsn += 1;
        lsn
    }

    pub fn commit(&mut self, lsn: usize) -> Result<(), &'static str> { // TODO: implement
        if lsn >= self.next_lsn {
            return Err("invalid LSN");
        }
        match self.committed {
            Some(c) if lsn <= c => Ok(()),
            _ => {
                self.committed = Some(lsn);
                Ok(())
            }
        }
    }

    pub fn replay(&self) -> Vec<&WALEntry> { // TODO: implement
        match self.committed {
            None => vec![],
            Some(c) => self.log.iter().filter(|e| e.lsn <= c).collect(),
        }
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize { // TODO: implement
        self.log.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_append_and_replay() {
        let mut wal = WAL::new();
        let lsn1 = wal.append("SET", "x=1");
        let lsn2 = wal.append("SET", "y=2");
        wal.commit(lsn2).unwrap();

        let entries = wal.replay();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].lsn, lsn1);
        assert_eq!(entries[1].lsn, lsn2);
    }

    #[test]
    fn test_uncommitted_not_replayed() {
        let mut wal = WAL::new();
        wal.append("SET", "x=1");
        wal.append("SET", "y=2");
        assert!(wal.replay().is_empty());
    }

    #[test]
    fn test_partial_commit() {
        let mut wal = WAL::new();
        let lsn1 = wal.append("SET", "x=1");
        wal.append("SET", "y=2");
        wal.commit(lsn1).unwrap();
        assert_eq!(wal.replay().len(), 1);
    }

    #[test]
    fn test_invalid_commit() {
        let mut wal = WAL::new();
        assert!(wal.commit(999).is_err());
    }
}
