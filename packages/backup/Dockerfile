FROM alpine:3.19

# Install required packages
RUN apk add --no-cache \
    postgresql16-client \
    bash \
    curl \
    tar \
    gzip \
    openssl \
    jq \
    tzdata

# Create app directory
WORKDIR /app

# Copy scripts
COPY scripts/ /app/scripts/

# Make scripts executable
RUN chmod +x /app/scripts/*.sh

# Create backup directories
RUN mkdir -p /backups/daily

# Health check - verify backup is less than 45 minutes old (for 30-min interval)
HEALTHCHECK --interval=15m --timeout=10s --start-period=2m --retries=3 \
    CMD /app/scripts/verify.sh --health

# Run scheduler
CMD ["/app/scripts/scheduler.sh"]
