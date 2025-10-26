use tokio_tungstenite::{
    connect_async,
    tungstenite::protocol::Message,
};
use futures_util::StreamExt;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Position {
    x: f32,
    y: f32,
    z: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Color {
    r: u8,
    g: u8,
    b: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Planet {
    size: f32,
    colors: [Color; 3],
    module_type: u8,
    position: Position,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Player {
    id: u32,
    name: String,
    level: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GameState {
    planets: Vec<Planet>,
    players: Vec<Player>,
    initial_player_location: Position,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Connecting to Crux Server...");
    
    let (ws_stream, _) = connect_async("ws://localhost:8080").await?;
    println!("✅ Connected to server!\n");

    let (_write, mut read) = ws_stream.split();
    let mut game_state: Option<GameState> = None;

    while let Some(msg) = read.next().await {
        match msg? {
            Message::Binary(data) => {
                println!("📦 Received binary game state ({} bytes)", data.len());
                
                match bincode::deserialize::<GameState>(&data) {
                    Ok(state) => {
                        game_state = Some(state.clone());
                        println!("\n🌍 Game State Loaded:");
                        println!("   📍 Initial player location: ({:.1}, {:.1}, {:.1})", 
                            state.initial_player_location.x,
                            state.initial_player_location.y,
                            state.initial_player_location.z);
                        println!("   🪐 Planets: {}", state.planets.len());
                        println!("   👥 Players: {}", state.players.len());
                        
                        println!("\n🪐 Planet details:");
                        for (i, planet) in state.planets.iter().enumerate() {
                            println!("   Planet {}: size={:.1}, module_type={}, pos=({:.1}, {:.1}, {:.1})",
                                i + 1,
                                planet.size,
                                planet.module_type,
                                planet.position.x,
                                planet.position.y,
                                planet.position.z);
                            println!("      Colors: RGB({},{},{}), RGB({},{},{}), RGB({},{},{})",
                                planet.colors[0].r, planet.colors[0].g, planet.colors[0].b,
                                planet.colors[1].r, planet.colors[1].g, planet.colors[1].b,
                                planet.colors[2].r, planet.colors[2].g, planet.colors[2].b);
                        }
                        println!();
                    }
                    Err(e) => eprintln!("❌ Failed to deserialize game state: {}", e),
                }
            }
            Message::Text(text) => {
                println!("💬 Server: {}", text);
            }
            Message::Close(_) => {
                println!("\n👋 Connection closed by server");
                break;
            }
            Message::Ping(_) => {
                // Pongs are handled automatically
            }
            _ => {}
        }
    }

    if let Some(state) = game_state {
        println!("\n✅ Successfully received game state with {} planets", state.planets.len());
    }

    Ok(())
}