use mini_redis::{client, Result};

#[tokio::main]
async fn main() -> Result<()> {

    // client::connect() is an asyncronos operation bit sense the next this we have to do is set the client we must await it
    let mut client = client::connect("127.0.0.1:6379").await?;

    client.set("hello", "world".into()).await?;

    let result = client.get("hello").await?;

    println!("got {:?}, from server", result);

    Ok(())
}
