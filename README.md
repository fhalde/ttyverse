# TTY verse

A 3D space for your interactive terminals.

Starts with an empty space. Press ⌘/Ctrl + T to create your first terminal.

Each completed foreground zsh command launches a little rocket from its terminal,
with a golden exhaust trail. Animations respect the system's reduced-motion setting.

## Run locally

- Node.js
- npm
- Cargo/Rust toolchain
- zsh

```sh
npm run build
cargo run
```

## Controls

| Control | Action |
| --- | --- |
| W / A / S / D | Move through the scene in flight mode |
| Q / E | Move down / up |
| Shift | Boost flight speed |
| Mouse | Look around in flight mode |
| F | Capture the mouse for flight |
| Click a terminal | Move the camera to it and focus it for typing |
| Esc | Leave the terminal and return to flight |
| ⌘/Ctrl + T | Create a terminal ahead of the camera |
| ⌘/Ctrl + , | Toggle settings for fonts and flight speed |
