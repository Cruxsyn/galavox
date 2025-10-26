use tokio_tungstenite::{
    accept_async,
    tungstenite::protocol::Message,
};
use futures_util::{StreamExt, SinkExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use serde::{Serialize, Deserialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

/*
Game State Protocol:

Binary message structure:
- Planet array: each planet has size, colors(3), module type, and position
- Player array: each player has id, name, level
- Initial player location
*/

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
    colors: [Color; 3],  // 3 colors as specified
    module_type: u8,     // 0-255 for different module types
    position: Position,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Player {
    id: u32,
    name: String,
    level: u32,
    position: Position,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GameState {
    planets: Vec<Planet>,
    players: Vec<Player>,
    initial_player_location: Position,
}

#[derive(Clone)]
struct GameServer {
    state: Arc<Mutex<GameState>>,
    connected_players: Arc<Mutex<HashMap<String, Player>>>,
    broadcast_tx: broadcast::Sender<Vec<u8>>,
}


impl GameServer {
    fn new() -> Self {
        let initial_state = Self::create_initial_state();
        let (broadcast_tx, _) = broadcast::channel(100);
        GameServer {
            state: Arc::new(Mutex::new(initial_state)),
            connected_players: Arc::new(Mutex::new(HashMap::new())),
            broadcast_tx,
        }
    }

    fn create_initial_state() -> GameState {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        // Create some planets
        let planets = (0..10)
            .map(|i| {
                let angle = (i as f32) * std::f32::consts::PI * 2.0 / 10.0;
                let radius = 500.0 + rng.gen_range(0.0..200.0);
                
                Planet {
                    size: rng.gen_range(50.0..150.0),
                    colors: [
                        Color { 
                            r: rng.gen_range(0..255), 
                            g: rng.gen_range(0..255), 
                            b: rng.gen_range(0..255) 
                        },
                        Color { 
                            r: rng.gen_range(0..255), 
                            g: rng.gen_range(0..255), 
                            b: rng.gen_range(0..255) 
                        },
                        Color { 
                            r: rng.gen_range(0..255), 
                            g: rng.gen_range(0..255), 
                            b: rng.gen_range(0..255) 
                        },
                    ],
                    module_type: rng.gen_range(0..5),
                    position: Position {
                        x: angle.cos() * radius,
                        y: rng.gen_range(-100.0..100.0),
                        z: angle.sin() * radius,
                    },
                }
            })
            .collect();

        GameState {
            planets,
            players: Vec::new(),
            initial_player_location: Position { x: 0.0, y: 0.0, z: 0.0 },
        }
    }

    fn get_state(&self) -> GameState {
        self.state.lock().unwrap().clone()
    }

    fn update_player_position(&self, player_id: String, position: Position) {
        {
            let mut players = self.connected_players.lock().unwrap();
            if let Some(player) = players.get_mut(&player_id) {
                player.position = position.clone();
                println!("📍 Updated player {} position to ({:.1}, {:.1}, {:.1})", 
                         player_id, position.x, position.y, position.z);
            }
        }
    
    }
    
    fn broadcast_game_state(&self) {
        let game_state = self.get_state();
        if let Ok(binary_data) = bincode::serialize(&game_state) {
            // Send to broadcast channel (ignore if no receivers)
            let _ = self.broadcast_tx.send(binary_data);
        }
    }

    fn add_player(&self, player_id: String, name: String) -> Player {
        let mut players = self.connected_players.lock().unwrap();
        let player = Player {
            id: players.len() as u32,
            name: name.clone(),
            level: 1,
            position: Position { x: 0.0, y: 0.0, z: 0.0 },
        };
        players.insert(player_id, player.clone());
        
        // Update game state players list
        let mut state = self.state.lock().unwrap();
        state.players.push(player.clone());
        
        player
    }

    fn remove_player(&self, player_id: &str) {
        let mut players = self.connected_players.lock().unwrap();
        if let Some(player) = players.remove(player_id) {
            // Remove from game state
            let mut state = self.state.lock().unwrap();
            state.players.retain(|p| p.id != player.id);
            println!("👤 Player {} disconnected", player.name);
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let game_server = GameServer::new();
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    
    println!("🎮 Crux Game Server started on 127.0.0.1:8080");
    println!("📡 Waiting for connections...\n");

    loop {
        let (stream, addr) = listener.accept().await?;
        let server = game_server.clone();
        
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, addr, server).await {
                eprintln!("❌ Error handling connection from {}: {}", addr, e);
            }
        });
    }
}

async fn handle_connection(
    stream: TcpStream,
    addr: std::net::SocketAddr,
    server: GameServer,
) -> Result<(), Box<dyn std::error::Error>> {
    let ws_stream = accept_async(stream).await?;
    println!("✅ New WebSocket connection from: {}", addr);

    let (mut write, mut read) = ws_stream.split();

    // Subscribe to broadcast channel
    let mut broadcast_rx = server.broadcast_tx.subscribe();

    // Create player ID from address
    let player_id = addr.to_string();
    let _player = server.add_player(player_id.clone(), format!("Player_{}", addr.port()));

    // Send initial game state as binary message
    let game_state = server.get_state();
    let binary_data = bincode::serialize(&game_state)?;
    
    println!("📦 Sending initial game state to {} ({} bytes)", addr, binary_data.len());
    write.send(Message::Binary(binary_data.into())).await?;
    
    // Send welcome text message
    write.send(Message::Text("Welcome to Crux Server!".into())).await?;

    // Handle incoming messages and broadcast updates concurrently
    loop {
        tokio::select! {
            // Handle incoming messages from client
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        println!("💬 [{}] {}", addr, text);
                        write.send(Message::Text(format!("Echo: {}", text).into())).await?;
                    }
                    Some(Ok(Message::Binary(data))) => {
                        // Decode position update (3 floats = 12 bytes)
                        if data.len() == 12 {
                            let position = decode_position(&data)?;
                            server.update_player_position(player_id.clone(), position);
                        } else {
                            println!("📦 [{}] Received binary data ({} bytes) - unknown format", addr, data.len());
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        println!("👋 [{}] Connection closed", addr);
                        break;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        write.send(Message::Pong(data)).await?;
                    }
                    Some(Err(e)) => {
                        eprintln!("❌ [{}] Error: {}", addr, e);
                        break;
                    }
                    None => break,
                    _ => {}
                }
            }
            
            // Receive broadcast updates and send to client
            broadcast = broadcast_rx.recv() => {
                if let Ok(binary_data) = broadcast {
                    write.send(Message::Binary(binary_data.into())).await?;
                }
            }
        }
    }

    // Clean up player on disconnect
    server.remove_player(&player_id);

    Ok(())
}

fn decode_position(data: &[u8]) -> Result<Position, Box<dyn std::error::Error>> {
    if data.len() != 12 {
        return Err("Invalid position data length".into());
    }

    // Read 3 f32 values in little-endian format
    let x = f32::from_le_bytes([data[0], data[1], data[2], data[3]]);
    let y = f32::from_le_bytes([data[4], data[5], data[6], data[7]]);
    let z = f32::from_le_bytes([data[8], data[9], data[10], data[11]]);

    Ok(Position { x, y, z })
}
