use std::sync::{Condvar, Mutex};

pub const CHUNK_SIZE: usize = 4096;
const WINDOW_SIZE: usize = 32 * 1024;

#[derive(Default)]
pub struct OutputFlow {
    pending: Mutex<usize>,
    available: Condvar,
}

impl OutputFlow {
    pub fn wait_for_capacity(&self) {
        let pending = self.pending.lock().unwrap();
        drop(self.available.wait_while(pending, |pending| {
            *pending + CHUNK_SIZE > WINDOW_SIZE
        }).unwrap());
    }

    pub fn sent(&self, bytes: usize) {
        *self.pending.lock().unwrap() += bytes;
    }

    pub fn acknowledge(&self, bytes: usize) {
        let mut pending = self.pending.lock().unwrap();
        *pending = pending.saturating_sub(bytes);
        self.available.notify_one();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{sync::{Arc, mpsc}, thread, time::Duration};

    #[test]
    fn output_waits_until_consumed_and_resumes() {
        let flow = Arc::new(OutputFlow::default());
        flow.sent(WINDOW_SIZE);
        let worker_flow = flow.clone();
        let (tx, rx) = mpsc::channel();
        let worker = thread::spawn(move || {
            worker_flow.wait_for_capacity();
            tx.send(()).unwrap();
        });
        assert!(rx.recv_timeout(Duration::from_millis(20)).is_err());
        flow.acknowledge(CHUNK_SIZE);
        rx.recv_timeout(Duration::from_secs(1)).unwrap();
        worker.join().unwrap();
        assert_eq!(*flow.pending.lock().unwrap(), WINDOW_SIZE - CHUNK_SIZE);
    }
}
