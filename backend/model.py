import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
import gc
import json

MODEL_ID = "PhantomAjusshi/phi3-auditor-merged"

class AuditModel:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.device = self._get_device()
        print(f"Using device: {self.device}")

    def _get_device(self):
        if torch.backends.mps.is_available():
            return "mps"
        return "cpu"

    def load_model(self):
        if self.model is not None:
            return

        print("Loading model...")
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
            
            model_kwargs = {
                "dtype": "auto",
                "trust_remote_code": True,
                "attn_implementation": "eager"
            }
            
            # device_map requires 'accelerate' package. 
            # We will use .to(device) explicitly instead for better compatibility.

            self.model = AutoModelForCausalLM.from_pretrained(
                MODEL_ID, 
                **model_kwargs
            )
            
            if self.device:
                 self.model.to(self.device)
                 
            print("Model loaded successfully.")
        except Exception as e:
            print(f"Error loading model: {e}")
            raise e

    def analyze(self, metrics: dict):
        if self.model is None:
            self.load_model()

        # Construct prompt
        metrics_str = "\n".join([f"- {k}: {v}" for k, v in metrics.items()])
        prompt = f"""You are an expert AI model auditor. precise and critical.
        Analyze the following model performance metrics and determine if there is a drift or issue.
        
        Metrics:
        {metrics_str}
        
        Provide your analysis in the following JSON format:
        {{
            "label": "Status Label (e.g., No Drift, Major Drift, Critical Failure)",
            "explanation": "Detailed explanation of why you assigned this label."
        }}
        
        Analysis:
        """

        messages = [
            {"role": "user", "content": prompt},
        ]

        pipe = pipeline(
            "text-generation",
            model=self.model,
            tokenizer=self.tokenizer,
        )

        generation_args = {
            "max_new_tokens": 256,
            "return_full_text": False,
            "temperature": 0.1,
            "do_sample": True,
            "use_cache": False,
        }

        output = pipe(messages, **generation_args)
        generated_text = output[0]['generated_text']

        # Attempt to parse JSON from the output
        try:
            # Find JSON/Dict in the output if there's extra text
            start_idx = generated_text.find('{')
            end_idx = generated_text.rfind('}') + 1
            if start_idx != -1 and end_idx != -1:
                json_str = generated_text[start_idx:end_idx]
                return json.loads(json_str)
            else:
                 # Fallback if no strict JSON found
                return {
                    "label": "Analysis Generated",
                    "explanation": generated_text.strip()
                }
        except json.JSONDecodeError:
             return {
                "label": "Parsing Error",
                "explanation": f"Could not parse model output as JSON. Raw output: {generated_text}"
            }

audit_model = AuditModel()
