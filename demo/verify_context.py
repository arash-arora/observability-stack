import os
import time
from observix import observe, init_observability, capture_context

# Mock env setup for testing (using localhost by default)
os.environ["OBSERVIX_HOST"] = "http://localhost:8000"
os.environ["OBSERVIX_API_KEY"] = "dummy-key"

init_observability()

@observe
def retrieve_documents(query):
    # Simulate retrieval
    docs = [
        "Document A content related to query.",
        "Document B content also related.",
        "Irrelevant document C."
    ]
    print(f"Retrieving docs for: {query}")
    
    # Capture context!
    capture_context(docs)
    
    return docs

@observe
def main():
    print("Starting process...")
    retrieve_documents("test query")
    print("Done. Check logs for 'context' attribute in span headers/metadata.")

if __name__ == "__main__":
    main()
    time.sleep(2) # Allow exporter to flush
