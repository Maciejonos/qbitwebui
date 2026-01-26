FROM golang:1.22-alpine AS builder

WORKDIR /build
COPY go.mod .
COPY main.go .

RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o net-agent .

FROM alpine:3.19

RUN apk add --no-cache \
	curl \
	wget \
	ca-certificates \
	bind-tools \
	iproute2 \
	iputils \
	traceroute

RUN ARCH=$(uname -m) && \
	case "$ARCH" in \
	x86_64) ARCH="x86_64" ;; \
	aarch64) ARCH="aarch64" ;; \
	*) echo "Unsupported arch: $ARCH" && exit 1 ;; \
	esac && \
	wget -q -O /tmp/speedtest.tgz \
	"https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-${ARCH}.tgz" && \
	tar -xzf /tmp/speedtest.tgz -C /usr/local/bin speedtest && \
	rm /tmp/speedtest.tgz && \
	chmod +x /usr/local/bin/speedtest

COPY --from=builder /build/net-agent /usr/local/bin/net-agent

ENV PORT=9999
ENV QBT_URL=http://localhost:8080

EXPOSE 9999

ENTRYPOINT ["/usr/local/bin/net-agent"]
