use bevy::prelude::*;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_systems(Startup, setup)
        .run();
}

fn setup(mut commands: Commands) {
    commands.spawn(Camera2d);

    commands.spawn((
        Text::new("Hello, world!"),
        TextFont {
            font_size: 48.0,
            ..default()
        },
        TextColor::WHITE,
    ));
}
