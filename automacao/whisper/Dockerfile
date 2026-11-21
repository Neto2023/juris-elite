FROM python:3.11-slim

# ffmpeg para decodificar o audio ogg/opus do WhatsApp.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir faster-whisper==1.0.3 requests==2.32.3

WORKDIR /app
COPY app.py .

ENV WHISPER_MODELS_DIR=/models
EXPOSE 8090
CMD ["python", "app.py"]
