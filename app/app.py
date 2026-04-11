from fastapi import FastAPI
# from app.api.v1.router import api_routers

app = FastAPI()

@app.get("/")
def health_check():
    return "App is running."