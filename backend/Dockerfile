FROM golang:1.26.5-alpine3.24 AS builder

WORKDIR /src

ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOPROXY=https://proxy.golang.org,direct

RUN apk add --no-cache ca-certificates git

COPY go.mod ./
RUN go mod download

COPY . .

RUN go mod tidy \
    && go build \
       -trimpath \
       -ldflags="-s -w" \
       -o /out/cloud-blog-api \
       .

FROM alpine:3.24

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app \
    && adduser -S -G app app

ENV TZ=Asia/Shanghai
ENV GIN_MODE=release

COPY --from=builder \
    /out/cloud-blog-api \
    /usr/local/bin/cloud-blog-api

USER app

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/cloud-blog-api"]
