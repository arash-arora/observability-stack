import clickhouse_connect
from app.core.config import settings

def migrate_traces():
    print("Migrating traces table...")
    try:
        client = clickhouse_connect.get_client(
            host=settings.CLICKHOUSE_HOST,
            port=settings.CLICKHOUSE_PORT,
            username=settings.CLICKHOUSE_USER,
            password=settings.CLICKHOUSE_PASSWORD
        )
        
        # Check if column exists
        result = client.command("DESCRIBE TABLE traces")
        # result is usually a string (if format is TabSeparated) or list of lists
        # But command returns unparsed result usually? No, clickhouse-connect command returns result.
        # Let's just try to add it. If it exists, it will fail, which is fine (or we catch it).
        
        try:
            client.command("ALTER TABLE traces ADD COLUMN IF NOT EXISTS application_name Nullable(String)")
            print("Added application_name column to traces.")
        except Exception as e:
            print(f"Error adding column: {e}")
            
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate_traces()
