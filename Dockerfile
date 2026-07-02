# Use Python 3.12 slim for lightweight deployment
FROM python:3.12-slim

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user with UID 1000 (required for Hugging Face Spaces)
RUN useradd -m -u 1000 user
ENV PATH="/home/user/.local/bin:$PATH"

# Copy backend requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code, script, and metadata, giving ownership to 'user'
COPY --chown=user backend/ ./backend/
COPY --chown=user rank.py .
COPY --chown=user submission_metadata.yaml .
COPY --chown=user Dataset/ ./Dataset/

# Copy compiled frontend assets
COPY --chown=user frontend/dist/ ./frontend/dist/

# Set up temp directory with correct permissions
RUN mkdir -p /app/temp && chown -R user:user /app

# Switch to the non-root user
USER user

# Expose port
EXPOSE 7860

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=7860

# Start server
CMD ["python", "-m", "uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "7860"]
