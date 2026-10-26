FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt . 
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python -m nigrani.generate && python -m nigrani.features && python -m nigrani.experiments && python -m nigrani.train
EXPOSE 8000
CMD ["uvicorn", "nigrani.api:app", "--host", "0.0.0.0", "--port", "8000"]
