import os, json
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"],
)

MODEL = "gemini-2.5-flash-lite"

def generate_summary(location: dict):
    prompt = prompt = f"""
        You are a real estate market analyst assistant.

        You will be given only:
        - building_name
        - building_location (city, country)

        Return ONLY valid JSON. No markdown. No extra text.

        Required JSON format:

        {{
        "building_name": "",
        "location": "",
        "predicted_price_or_rent": {{
            "type": "rent_or_sale",
            "amount": "",
            "currency": "",
            "confidence": "low|medium|high",
            "notes": ""
        }},
        "future_price_projection": {{
            "1_year": "",
            "5_year": "",
            "trend": "up|stable|down",
            "confidence": "low|medium|high",
            "notes": ""
        }},
        "nearby_food": [],
        "nearby_schools": []
        }}

        Rules:
        - At least 3 food places
        - At least 3 schools
        - Use estimates if unknown

        INPUT:
        {json.dumps(location)}
    """


    response = client.models.generate_content_stream(
    model=MODEL,
    contents=[prompt],
    config={"response_mime_type": "application/json"},
    )

    text = "".join(chunk.text for chunk in response if getattr(chunk, "text", None)).strip()

    return json.loads(text)