use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{ipc::Channel, State};

struct Terminal {
    _child: Box<dyn Child + Send + Sync>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

#[derive(Default)]
struct TerminalState(Mutex<HashMap<u32, Terminal>>);

#[derive(Clone, Serialize)]
struct TerminalOutput {
    id: u32,
    data: Vec<u8>,
}

fn spawn_terminal(output: Channel<TerminalOutput>, id: u32) -> anyhow::Result<Terminal> {
    let pair = native_pty_system().openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let mut command = CommandBuilder::new("zsh");
    command.arg("-il");
    command.cwd(env!("CARGO_MANIFEST_DIR"));
    let child = pair.slave.spawn_command(command)?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader()?;
    thread::spawn(move || {
        let mut buffer = [0; 4096];
        while let Ok(count) = reader.read(&mut buffer) {
            if count == 0 {
                break;
            }
            let _ = output.send(TerminalOutput { id, data: buffer[..count].to_vec() });
        }
    });

    let writer = Arc::new(Mutex::new(pair.master.take_writer()?));
    let master = Arc::new(Mutex::new(pair.master));
    let startup_writer = Arc::clone(&writer);
    thread::spawn(move || {
        thread::sleep(std::time::Duration::from_millis(100));
        if let Ok(mut writer) = startup_writer.lock() {
            let _ = writer.write_all(b"ls\r");
            let _ = writer.flush();
        }
    });
    Ok(Terminal {
        _child: child,
        master,
        writer,
    })
}

#[tauri::command]
fn create_terminal(
    id: u32,
    on_output: Channel<TerminalOutput>,
    state: State<TerminalState>,
) -> Result<(), String> {
    let terminal = spawn_terminal(on_output, id).map_err(|error| error.to_string())?;
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .insert(id, terminal);
    Ok(())
}

#[tauri::command]
fn write_terminal(id: u32, data: String, state: State<TerminalState>) -> Result<(), String> {
    let terminals = state.0.lock().map_err(|error| error.to_string())?;
    let terminal = terminals.get(&id).ok_or("terminal not found")?;
    let mut writer = terminal.writer.lock().map_err(|error| error.to_string())?;
    writer.write_all(data.as_bytes()).map_err(|error| error.to_string())?;
    writer.flush().map_err(|error| error.to_string())
}

#[tauri::command]
fn resize_terminal(id: u32, cols: u16, rows: u16, state: State<TerminalState>) -> Result<(), String> {
    let terminals = state.0.lock().map_err(|error| error.to_string())?;
    let terminal = terminals.get(&id).ok_or("terminal not found")?;
    terminal
        .master
        .lock()
        .map_err(|error| error.to_string())?
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .manage(TerminalState::default())
        .invoke_handler(tauri::generate_handler![
            create_terminal,
            write_terminal,
            resize_terminal
        ])
        .run(tauri::generate_context!())
        .expect("run Tauri application");
}
