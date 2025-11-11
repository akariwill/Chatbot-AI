import requests
import json
import time

API_URL = "http://localhost:8001/chat"

test_cases = [
    {
        "description": "Test 1: Sapaan Umum",
        "payload": {"query": "Halo, selamat siang kak?"}
    },
    {
        "description": "Test 2: Pertanyaan Troubleshooting",
        "payload": {"query": "Permisi kak, ini wifi saya lagi gangguan ya?"}
    },
    {
        "description": "Test 3: Pertanyaan Harga",
        "payload": {"query": "Berapa harga paket internetnya?"}
    },
    {
        "description": "Test 4: Kueri Kosong (Penanganan Error)",
        "payload": {"query": ""}
    },
    {
        "description": "Test 5: Pertanyaan Teknis (RAG)",
        "payload": {"query": "Dimna lokasi kantor wifinya?"}
    }
]

def run_all_tests():
    """
    Sends a series of test requests to the /chat endpoint and prints the responses.
    """
    print(f"--- Starting Chatbot Backend Test ---")
    all_tests_passed = True

    for test in test_cases:
        print(f"\nRunning: {test['description']}...")
        
        try:
            response = requests.post(API_URL, json=test["payload"])

            response.raise_for_status()

            print("Status: SUCCESS")
            print("Server Response:")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))

        except requests.exceptions.HTTPError as e:
            print(f"Status: FAILED (HTTP Error)")
            print(f"Response Code: {e.response.status_code}")
            print("Server Response:")
            print(json.dumps(e.response.json(), indent=2, ensure_ascii=False))
            if test["payload"]["query"] == "":
                 print("(This is expected for an empty query test)")
            else:
                all_tests_passed = False

        except requests.exceptions.RequestException as e:
            print(f"Status: FAILED (Connection Error)")
            print(f"Details: {e}")
            print("Please ensure the FastAPI backend is running at the correct address.")
            all_tests_passed = False
            break 
            
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            all_tests_passed = False

        time.sleep(1)

    print("\n--- Test Run Finished ---")
    if all_tests_passed:
        print("✅ All tests completed successfully.")
    else:
        print("❌ Some tests failed.")


if __name__ == "__main__":
    run_all_tests()