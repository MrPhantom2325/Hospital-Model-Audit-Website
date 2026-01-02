# Model Audit Testing Application

A full-stack application for analyzing ML model metrics using the Hugging Face model `PhantomAjusshi/phi3-auditor-merged`.

## Project Structure

```
model-audit-testing/
├── app/                    # Next.js frontend
│   ├── page.tsx           # Main application page
│   └── globals.css        # Global styles
├── backend/                # FastAPI backend
│   ├── main.py            # API server
│   └── requirements.txt   # Python dependencies
└── package.json           # Node.js dependencies
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Run the FastAPI server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Install Node.js dependencies:
```bash
npm install --legacy-peer-deps
```

2. (Optional) Create a `.env.local` file to configure the API URL:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If not set, it defaults to `http://localhost:8000`.

3. Run the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Usage

1. Start the backend server first (port 8000)
2. Start the frontend server (port 3000)
3. Enter model metrics either manually or upload a JSON file
4. Click "RUN MODEL" to analyze the metrics
5. View the analysis results in the Model Output card

## API Endpoints

- `GET /` - API status
- `GET /health` - Health check
- `POST /analyze` - Analyze model metrics

### Example API Request

```json
{
  "auc": 0.8523,
  "accuracy": 0.7865,
  "precision": 0.8234,
  "recall": 0.7432,
  "f1Score": 0.7823,
  "ece": 0.0452,
  "brier": 0.1234,
  "drift": 0.0523,
  "missingRate": 0.0145,
  "labelShift": 0.0832,
  "positiveRate": 0.4521,
  "dataIntegrity": 2
}
```

### Example API Response

```json
{
  "label": "Needs Review",
  "explanation": "The model shows moderate calibration drift and integrity issues."
}
```

## Environment Variables

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL` - Backend API URL (defaults to `http://localhost:8000`)

### Backend
- `HF_TOKEN` - Optional Hugging Face token if model requires authentication

## Notes

- The Hugging Face model will be downloaded on first use (requires internet connection)
- Model loading may take a few minutes on first startup
- Ensure you have sufficient RAM/VRAM for the model (4B parameters)
- For production deployments, update `NEXT_PUBLIC_API_URL` in your environment to point to your production API
