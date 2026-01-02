# Setup Instructions

Since large files (Models) and build artifacts (llama.cpp build) were excluded from git, you need to perform the following steps when setting up on a new machine.

## 1. Prerequisites
- Python 3.10+
- Git
- C++ Compiler (for llama.cpp)
- Node.js & npm (for frontend)

## 2. Re-create the Environment

### A. Setup `llama.cpp`
The `llama.cpp` folder is excluded because it contains system-specific build files. You need to compile it for your new machine.

```bash
# From the project root
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make
# OR if you have cmake:
# mkdir build && cd build && cmake .. && cmake --build . --config Release
cd ..
```
*Note: Ensure the built server binary is at `llama.cpp/build/bin/llama-server` or `llama.cpp/llama-server`. You might need to adjust `backend/start.sh` depending on where `make` puts the binary.*

### B. Download the Model
The model file `phi3-auditor-q4.gguf` (~2.2GB) was too large for GitHub.
1.  Create a `models/` directory in the root if it doesn't exist.
2.  Download the `phi3-auditor-q4.gguf` model (or transfer it from your old machine) and place it in `models/`.

### C. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### D. Frontend Setup
```bash
# From project root
npm install
```

## 3. Running the App
Use the provided start script:
```bash
chmod +x backend/start.sh
./backend/start.sh
```
